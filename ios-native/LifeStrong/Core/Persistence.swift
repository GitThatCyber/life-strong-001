import Foundation
import SwiftData
public enum TrainingPersistence {
    public static var schema: Schema { Schema(versionedSchema: TrainingSchemaV1.self) }
    public static func local(at url: URL) throws -> ModelContainer {
        let configuration = ModelConfiguration("Training", schema: schema, url: url, cloudKitDatabase: .none)
        return try ModelContainer(for: schema, migrationPlan: TrainingMigrationPlan.self, configurations: configuration)
    }
    public static func privateRehearsal(at url: URL, containerID: String) throws -> ModelContainer {
        guard containerID.hasPrefix("iCloud."), containerID.hasSuffix(".rehearsal") else {
            throw TrainingError.invalid("Use a separately registered rehearsal iCloud container ending in .rehearsal.")
        }
        let configuration = ModelConfiguration("Training", schema: schema, url: url, cloudKitDatabase: .private(containerID))
        return try ModelContainer(for: schema, migrationPlan: TrainingMigrationPlan.self, configurations: configuration)
    }
}

@MainActor public final class TrainingRepository {
    public let context: ModelContext
    public init(container: ModelContainer) { context = ModelContext(container); context.autosaveEnabled = false }
    private func commit<T>(_ work: () throws -> T) throws -> T {
        do { let value = try work(); try context.save(); return value }
        catch { context.rollback(); throw error }
    }
    private func text(_ value: String, label: String, required: Bool = false, max: Int = 2000) throws -> String {
        let clean = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard clean.count <= max, !required || !clean.isEmpty else { throw TrainingError.invalid("\(label) is required and must fit within \(max) characters.") }
        return clean
    }
    public func exercises() throws -> [Exercise] { try context.fetch(FetchDescriptor<Exercise>(sortBy: [SortDescriptor(\.name)])) }
    public func templates() throws -> [WorkoutTemplate] { try context.fetch(FetchDescriptor<WorkoutTemplate>(sortBy: [SortDescriptor(\.name)])) }
    public func sessions() throws -> [WorkoutSession] { try context.fetch(FetchDescriptor<WorkoutSession>(sortBy: [SortDescriptor(\.startedAt, order: .reverse)])) }
    @discardableResult public func createExercise(name: String, equipment: String, muscleFocus: String, measurement: Measurement) throws -> Exercise {
        let name = try text(name, label: "Name", required: true, max: 160)
        let equipment = try text(equipment, label: "Equipment"), focus = try text(muscleFocus, label: "Muscle focus")
        return try commit { let item = Exercise(name: name, equipment: equipment, muscleFocus: focus, measurement: measurement); context.insert(item); return item }
    }
    @discardableResult public func createTemplate(name: String, notes: String, entries: [TemplateInput]) throws -> WorkoutTemplate {
        let name = try text(name, label: "Name", required: true, max: 160), notes = try text(notes, label: "Description")
        guard (1...100).contains(entries.count) else { throw TrainingError.invalid("Add between 1 and 100 exercises.") }
        let library = try exercises()
        var validated: [(TemplateInput, Exercise)] = []
        for input in entries {
            guard let exercise = library.first(where: { $0.id == input.exerciseID && !$0.archived }),
                  let type = Measurement(rawValue: exercise.measurement) else { throw TrainingError.invalid("A selected exercise is unavailable.") }
            try input.targets.validate(for: type)
            guard (0...3600).contains(input.restSeconds) else { throw TrainingError.invalid("Rest must be 0–3,600 seconds.") }
            _ = try text(input.instructions, label: "Instructions")
            validated.append((input, exercise))
        }
        return try commit {
            let template = WorkoutTemplate(name: name, notes: notes); context.insert(template)
            for (position, pair) in validated.enumerated() {
                let entry = TemplateExercise(exercise: pair.1, position: position, targets: pair.0.targets, instructions: pair.0.instructions, restSeconds: pair.0.restSeconds)
                context.insert(entry); entry.template = template
            }
            return template
        }
    }
    @discardableResult public func startSession(template: WorkoutTemplate, operationID: UUID) throws -> WorkoutSession {
        let matches = try sessions().filter { $0.operationID == operationID }
        if let prior = matches.first {
            guard matches.count == 1, prior.templateID == template.id else { throw TrainingError.invalid("Start operation conflicts with an existing session.") }
            return prior
        }
        guard !template.archived, !template.orderedEntries.isEmpty else { throw TrainingError.invalid("This workout is unavailable or empty.") }
        let entries = template.orderedEntries
        for entry in entries {
            guard let exercise = entry.exercise, !exercise.archived, let type = Measurement(rawValue: exercise.measurement) else { throw TrainingError.invalid("Workout is still loading or has an unavailable exercise.") }
            try entry.targets.validate(for: type)
        }
        return try commit {
            let session = WorkoutSession(operationID: operationID, template: template); context.insert(session)
            for entry in entries {
                guard let source = entry.exercise else { throw TrainingError.invalid("Missing exercise. Wait for the library to finish loading.") }
                let snapshot = SessionExercise(entry: entry, source: source); context.insert(snapshot); snapshot.session = session
            }
            return session
        }
    }
    @discardableResult public func record(_ request: SetRequest) throws -> RecordedSet {
        let session = try sessions().first { $0.id == request.sessionID }
        guard let session, let exercise = session.orderedExercises.first(where: { $0.id == request.exerciseID }),
              let type = Measurement(rawValue: exercise.measurement) else { throw TrainingError.invalid("Session exercise is missing or still loading.") }
        try request.values.validate(for: type, requireAll: true)
        guard (1...1000).contains(request.position) else { throw TrainingError.invalid("Set position must be 1–1,000.") }
        let existing = try context.fetch(FetchDescriptor<RecordedSet>()).filter { $0.operationID == request.operationID }
        if let prior = existing.first {
            guard existing.count == 1, prior.exercise?.id == exercise.id, prior.position == request.position, prior.values == request.values else { throw TrainingError.invalid("This save operation was already used with different values.") }
            return prior
        }
        guard session.status == "active" else { throw TrainingError.invalid("Resume the session before recording sets.") }
        guard !exercise.orderedSets.contains(where: { $0.position == request.position }) else { throw TrainingError.invalid("This set position already exists. Reopen the session before recording.") }
        return try commit { let set = RecordedSet(request: request, exercise: exercise); context.insert(set); session.updatedAt = Date(); return set }
    }
    public func setStatus(_ status: String, session: WorkoutSession) throws {
        guard ["active", "paused", "completed"].contains(status) else { throw TrainingError.invalid("Unknown workout status.") }
        guard session.status != "completed" || status == "completed" else { throw TrainingError.invalid("Completed workouts cannot be reopened.") }
        if status == "completed", !session.orderedExercises.contains(where: { !$0.orderedSets.isEmpty }) { throw TrainingError.invalid("Record at least one set first.") }
        try commit { session.status = status; session.updatedAt = Date(); if status == "completed" && session.completedAt == nil { session.completedAt = Date() } }
    }
}
