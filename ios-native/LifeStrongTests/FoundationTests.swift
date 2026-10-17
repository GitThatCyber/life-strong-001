import XCTest
import SwiftData
@testable import LifeStrongCore

@MainActor final class FoundationTests: XCTestCase {
    private func directory() throws -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("LifeStrongTests-\(UUID())", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true); return url
    }
    func testDiskRoundTripSnapshotsAndExport() async throws {
        let folder = try directory(); defer { try? FileManager.default.removeItem(at: folder) }
        let url = folder.appendingPathComponent("training.store")
        let container = try TrainingPersistence.local(at: url)
        let repo = TrainingRepository(container: container)
        let squat = try repo.createExercise(name: "Squat", equipment: "Dumbbell", muscleFocus: "Legs", measurement: .weightReps)
        let plank = try repo.createExercise(name: "Plank", equipment: "Mat", muscleFocus: "Core", measurement: .duration)
        let template = try repo.createTemplate(name: "Mixed workout", notes: "Offline", entries: [TemplateInput(exerciseID: squat.id, targets: Targets(sets: 3, reps: 8, weightKG: 0), instructions: "Comfortable effort", restSeconds: 60), TemplateInput(exerciseID: plank.id, targets: Targets(sets: 2, durationSeconds: 45), restSeconds: 15)])
        let operation = UUID()
        let session = try repo.startSession(template: template, operationID: operation)
        XCTAssertEqual(try repo.startSession(template: template, operationID: operation).id, session.id)
        XCTAssertEqual(session.orderedExercises.count, 2)
        let entry = try XCTUnwrap(session.orderedExercises.first)
        let request = SetRequest(sessionID: session.id, exerciseID: entry.id, position: 1, values: Metrics(reps: 6, weightKG: 10))
        let saved = try repo.record(request)
        XCTAssertEqual(try repo.record(request).id, saved.id)
        // Later library edits do not alter the active session snapshot.
        squat.name = "Renamed"; squat.measurement = "reps"; template.name = "Changed plan"; template.orderedEntries[0].targetReps = 20
        try repo.context.save()
        try repo.setStatus("completed", session: session)
        let completedAt = session.completedAt; try repo.setStatus("completed", session: session)
        XCTAssertEqual(session.completedAt, completedAt)
        XCTAssertThrowsError(try repo.setStatus("active", session: session))
        let reopened = TrainingRepository(container: try TrainingPersistence.local(at: url))
        let recovered = try XCTUnwrap(reopened.sessions().first)
        XCTAssertEqual(recovered.id, session.id); XCTAssertEqual(recovered.templateName, "Mixed workout")
        XCTAssertEqual(recovered.orderedExercises[0].name, "Squat")
        XCTAssertEqual(recovered.orderedExercises[0].measurement, "weight_reps")
        XCTAssertEqual(recovered.orderedExercises[0].targets, Targets(sets: 3, reps: 8, weightKG: 0))
        XCTAssertEqual(recovered.orderedExercises[0].orderedSets.first?.values.reps, 6)
        let export = try FoundationSnapshot.capture(repository: reopened)
        XCTAssertEqual(export.counts, ["exercises": 2, "templates": 1, "templateExercises": 2, "sessions": 1, "sessionExercises": 2, "recordedSets": 1])
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: export.encoded()) as? [String: Any])
        XCTAssertEqual(json["formatVersion"] as? Int, 1)
        XCTAssertNil(json["password"]); XCTAssertNil(json["token"])
        XCTAssertEqual(export.sessionExercises[0].sessionID, session.id)
        XCTAssertEqual(export.recordedSets.first?.values, request.values)
    }
    func testValidationRollbackAllMeasurementTypesAndOperationConflicts() async throws {
        let folder = try directory(); defer { try? FileManager.default.removeItem(at: folder) }
        let repo = TrainingRepository(container: try TrainingPersistence.local(at: folder.appendingPathComponent("training.store")))
        XCTAssertThrowsError(try repo.createExercise(name: " ", equipment: "", muscleFocus: "", measurement: .reps))
        let values = [Metrics(reps: 8), Metrics(reps: 8, weightKG: 0), Metrics(durationSeconds: 45), Metrics(durationSeconds: 600, distanceMeters: 2000)]
        for (index, type) in Measurement.allCases.enumerated() {
            let exercise = try repo.createExercise(name: type.title, equipment: "", muscleFocus: "", measurement: type)
            XCTAssertThrowsError(try repo.createTemplate(name: "Invalid", notes: "", entries: [TemplateInput(exerciseID: exercise.id, targets: Targets(sets: 0))]))
            let template = try repo.createTemplate(name: type.title, notes: "", entries: [TemplateInput(exerciseID: exercise.id)])
            let session = try repo.startSession(template: template, operationID: UUID())
            let entry = try XCTUnwrap(session.orderedExercises.first)
            XCTAssertThrowsError(try repo.setStatus("completed", session: session))
            let request = SetRequest(sessionID: session.id, exerciseID: entry.id, position: 1, values: values[index])
            _ = try repo.record(request)
            var conflict = request; conflict.position = 2
            XCTAssertThrowsError(try repo.record(conflict))
            try repo.setStatus("paused", session: session)
            var next = request; next.operationID = UUID(); next.position = 2
            XCTAssertThrowsError(try repo.record(next))
            try repo.setStatus("active", session: session)
            _ = try repo.record(next)
        }
        XCTAssertEqual(try repo.templates().count, 4); XCTAssertEqual(try repo.exercises().count, 4)
        XCTAssertThrowsError(try Metrics(reps: 1, durationSeconds: 4).validate(for: .reps, requireAll: true))
        XCTAssertThrowsError(try Metrics(weightKG: .infinity).validate(for: .weightReps, requireAll: false))
        XCTAssertThrowsError(try Metrics(durationSeconds: 0).validate(for: .duration, requireAll: true))
        XCTAssertThrowsError(try InputNumber.integer("1.5", label: "Sets"))
        XCTAssertThrowsError(try InputNumber.decimal("nan", label: "Duration"))
    }
    func testDeviceRecoveryAndLostAcknowledgementDoNotDuplicateSets() async throws {
        let folder = try directory(); defer { try? FileManager.default.removeItem(at: folder) }
        let repo = TrainingRepository(container: try TrainingPersistence.local(at: folder.appendingPathComponent("training.store")))
        let exercise = try repo.createExercise(name: "Lunge", equipment: "", muscleFocus: "", measurement: .reps)
        let template = try repo.createTemplate(name: "Recovery", notes: "", entries: [TemplateInput(exerciseID: exercise.id)])
        let session = try repo.startSession(template: template, operationID: UUID())
        let snapshot = try XCTUnwrap(session.orderedExercises.first)
        let url = folder.appendingPathComponent("drafts.json")
        let drafts = try DeviceDraftStore(url: url)
        var draft = SessionDraft(); draft.selectedExerciseID = snapshot.id
        var form = MetricDraft(); form.reps = "12"; draft.forms[snapshot.id.uuidString] = form
        draft.restDeadline = Date().addingTimeInterval(60)
        let request = SetRequest(sessionID: session.id, exerciseID: snapshot.id, position: 1, values: Metrics(reps: 12))
        draft.pending = request; try drafts.save(draft, sessionID: session.id)
        _ = try repo.record(request) // Simulated termination before clearing the persisted pending request.
        let recovered = try DeviceDraftStore(url: url).draft(sessionID: session.id)
        XCTAssertEqual(recovered, draft)
        XCTAssertEqual(try repo.record(XCTUnwrap(recovered.pending)).position, 1)
        XCTAssertEqual(snapshot.orderedSets.count, 1)
        // Malformed local state fails visibly rather than being silently replaced with an empty store.
        try Data("bad data".utf8).write(to: url)
        XCTAssertThrowsError(try DeviceDraftStore(url: url))
    }
}
