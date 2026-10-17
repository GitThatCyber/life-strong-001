import Foundation
import SwiftData

// Diagnostic native snapshot only. SQL migration import/restore belongs to 7B.
public struct FoundationSnapshot: Codable {
    public let format: String
    public let formatVersion: Int
    public let schemaVersion: String
    public let exportedAt: Date
    public let counts: [String: Int]
    public let exercises: [ExerciseRow]
    public let templates: [TemplateRow]
    public let templateExercises: [TemplateExerciseRow]
    public let sessions: [SessionRow]
    public let sessionExercises: [SessionExerciseRow]
    public let recordedSets: [SetRow]
    public struct ExerciseRow: Codable { public let id: UUID; public let name: String; public let equipment: String; public let muscleFocus: String; public let measurement: String; public let archived: Bool; public let revision: Int; public let createdAt: Date; public let updatedAt: Date }
    public struct TemplateRow: Codable { public let id: UUID; public let name: String; public let notes: String; public let archived: Bool; public let revision: Int; public let createdAt: Date; public let updatedAt: Date }
    public struct TemplateExerciseRow: Codable { public let id: UUID; public let templateID: UUID; public let exerciseID: UUID; public let position: Int; public let instructions: String; public let restSeconds: Int; public let targets: Targets }
    public struct SessionRow: Codable { public let id: UUID; public let operationID: UUID; public let templateID: UUID?; public let templateName: String; public let status: String; public let startedAt: Date; public let completedAt: Date?; public let updatedAt: Date }
    public struct SessionExerciseRow: Codable { public let id: UUID; public let sessionID: UUID; public let exerciseID: UUID; public let name: String; public let measurement: String; public let position: Int; public let instructions: String; public let restSeconds: Int; public let targets: Targets }
    public struct SetRow: Codable { public let id: UUID; public let operationID: UUID; public let exerciseID: UUID; public let position: Int; public let values: Metrics; public let createdAt: Date; public let updatedAt: Date; public let revision: Int }
    @MainActor public static func capture(repository: TrainingRepository) throws -> FoundationSnapshot {
        func order<T>(_ items: [T], by key: (T) -> UUID) -> [T] { items.sorted { key($0).uuidString < key($1).uuidString } }
        let es = try order(repository.exercises(), by: { $0.id }).map { ExerciseRow(id: $0.id, name: $0.name, equipment: $0.equipment, muscleFocus: $0.muscleFocus, measurement: $0.measurement, archived: $0.archived, revision: $0.revision, createdAt: $0.createdAt, updatedAt: $0.updatedAt) }
        let ts = try order(repository.templates(), by: { $0.id }).map { TemplateRow(id: $0.id, name: $0.name, notes: $0.notes, archived: $0.archived, revision: $0.revision, createdAt: $0.createdAt, updatedAt: $0.updatedAt) }
        let tes = try order(repository.context.fetch(FetchDescriptor<TemplateExercise>()), by: { $0.id }).map { entry -> TemplateExerciseRow in
            guard let template = entry.template, let exercise = entry.exercise else { throw TrainingError.invalid("Library data is still incomplete. Wait before exporting.") }
            return TemplateExerciseRow(id: entry.id, templateID: template.id, exerciseID: exercise.id, position: entry.position, instructions: entry.instructions, restSeconds: entry.restSeconds, targets: entry.targets)
        }
        let ss = try order(repository.sessions(), by: { $0.id }).map { SessionRow(id: $0.id, operationID: $0.operationID, templateID: $0.templateID, templateName: $0.templateName, status: $0.status, startedAt: $0.startedAt, completedAt: $0.completedAt, updatedAt: $0.updatedAt) }
        let ses = try order(repository.context.fetch(FetchDescriptor<SessionExercise>()), by: { $0.id }).map { entry -> SessionExerciseRow in
            guard let session = entry.session else { throw TrainingError.invalid("Session data is still incomplete. Wait before exporting.") }
            return SessionExerciseRow(id: entry.id, sessionID: session.id, exerciseID: entry.exerciseID, name: entry.name, measurement: entry.measurement, position: entry.position, instructions: entry.instructions, restSeconds: entry.restSeconds, targets: entry.targets)
        }
        let sets = try order(repository.context.fetch(FetchDescriptor<RecordedSet>()), by: { $0.id }).map { set -> SetRow in
            guard let exercise = set.exercise else { throw TrainingError.invalid("Set data is still incomplete. Wait before exporting.") }
            return SetRow(id: set.id, operationID: set.operationID, exerciseID: exercise.id, position: set.position, values: set.values, createdAt: set.createdAt, updatedAt: set.updatedAt, revision: set.revision)
        }
        return FoundationSnapshot(format: "life-strong-native-foundation", formatVersion: 1, schemaVersion: "1.0.0", exportedAt: Date(), counts: ["exercises": es.count, "templates": ts.count, "templateExercises": tes.count, "sessions": ss.count, "sessionExercises": ses.count, "recordedSets": sets.count], exercises: es, templates: ts, templateExercises: tes, sessions: ss, sessionExercises: ses, recordedSets: sets)
    }
    public func encoded() throws -> Data {
        let encoder = JSONEncoder(); encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        encoder.dateEncodingStrategy = .custom { date, encoder in
            var container = encoder.singleValueContainer()
            let format = ISO8601DateFormatter(); format.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            try container.encode(format.string(from: date))
        }
        return try encoder.encode(self)
    }
}
