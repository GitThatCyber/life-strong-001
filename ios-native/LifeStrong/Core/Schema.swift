import Foundation
import SwiftData

// CloudKit-compatible v1: no unique constraints, required attributes have defaults,
// and relationships are optional with explicit inverses. Domain IDs are portable.
public enum TrainingSchemaV1: VersionedSchema {
    public static var versionIdentifier = Schema.Version(1, 0, 0)
    public static var models: [any PersistentModel.Type] {
        [Exercise.self, WorkoutTemplate.self, TemplateExercise.self,
         WorkoutSession.self, SessionExercise.self, RecordedSet.self]
    }

    @Model public final class Exercise {
        public var id: UUID = UUID()
        public var name: String = ""
        public var equipment: String = ""
        public var muscleFocus: String = ""
        public var measurement: String = "reps"
        public var archived: Bool = false
        public var revision: Int = 0
        public var createdAt: Date = Date()
        public var updatedAt: Date = Date()
        @Relationship(deleteRule: .nullify, inverse: \TemplateExercise.exercise)
        public var templateEntries: [TemplateExercise]? = []
        public init(id: UUID = UUID(), name: String, equipment: String = "", muscleFocus: String = "", measurement: Measurement) {
            self.id = id; self.name = name; self.equipment = equipment
            self.muscleFocus = muscleFocus; self.measurement = measurement.rawValue
        }
    }

    @Model public final class WorkoutTemplate {
        public var id: UUID = UUID()
        public var name: String = ""
        public var notes: String = ""
        public var archived: Bool = false
        public var revision: Int = 0
        public var createdAt: Date = Date()
        public var updatedAt: Date = Date()
        @Relationship(deleteRule: .nullify, inverse: \TemplateExercise.template)
        public var entries: [TemplateExercise]? = []
        public init(id: UUID = UUID(), name: String, notes: String = "") { self.id = id; self.name = name; self.notes = notes }
        public var orderedEntries: [TemplateExercise] {
            (entries ?? []).sorted { $0.position == $1.position ? $0.id.uuidString < $1.id.uuidString : $0.position < $1.position }
        }
    }

    @Model public final class TemplateExercise {
        public var id: UUID = UUID()
        public var position: Int = 0
        public var instructions: String = ""
        public var restSeconds: Int = 60
        public var targetSets: Int? = nil
        public var targetReps: Int? = nil
        public var targetWeightKG: Double? = nil
        public var targetDurationSeconds: Double? = nil
        public var targetDistanceMeters: Double? = nil
        public var template: WorkoutTemplate? = nil
        public var exercise: Exercise? = nil
        public init(id: UUID = UUID(), exercise: Exercise, position: Int, targets: Targets, instructions: String, restSeconds: Int) {
            self.id = id; self.exercise = exercise; self.position = position
            self.instructions = instructions; self.restSeconds = restSeconds; self.targets = targets
        }
        public var targets: Targets {
            get { Targets(sets: targetSets, reps: targetReps, weightKG: targetWeightKG, durationSeconds: targetDurationSeconds, distanceMeters: targetDistanceMeters) }
            set { targetSets = newValue.sets; targetReps = newValue.reps; targetWeightKG = newValue.weightKG; targetDurationSeconds = newValue.durationSeconds; targetDistanceMeters = newValue.distanceMeters }
        }
    }

    @Model public final class WorkoutSession {
        public var id: UUID = UUID()
        public var operationID: UUID = UUID()
        public var templateID: UUID? = nil
        public var templateName: String = ""
        public var status: String = "active"
        public var startedAt: Date = Date()
        public var completedAt: Date? = nil
        public var updatedAt: Date = Date()
        @Relationship(deleteRule: .nullify, inverse: \SessionExercise.session)
        public var exercises: [SessionExercise]? = []
        public init(id: UUID = UUID(), operationID: UUID, template: WorkoutTemplate) {
            self.id = id; self.operationID = operationID; self.templateID = template.id; self.templateName = template.name
        }
        public var orderedExercises: [SessionExercise] {
            (exercises ?? []).sorted { $0.position == $1.position ? $0.id.uuidString < $1.id.uuidString : $0.position < $1.position }
        }
    }

    @Model public final class SessionExercise {
        public var id: UUID = UUID()
        public var exerciseID: UUID = UUID()
        public var name: String = ""
        public var measurement: String = "reps"
        public var position: Int = 0
        public var instructions: String = ""
        public var restSeconds: Int = 60
        public var targetSets: Int? = nil
        public var targetReps: Int? = nil
        public var targetWeightKG: Double? = nil
        public var targetDurationSeconds: Double? = nil
        public var targetDistanceMeters: Double? = nil
        public var session: WorkoutSession? = nil
        @Relationship(deleteRule: .nullify, inverse: \RecordedSet.exercise)
        public var sets: [RecordedSet]? = []
        public init(entry: TemplateExercise, source: Exercise) {
            self.exerciseID = source.id; self.name = source.name; self.measurement = source.measurement
            self.position = entry.position; self.instructions = entry.instructions; self.restSeconds = entry.restSeconds
            self.targetSets = entry.targetSets; self.targetReps = entry.targetReps; self.targetWeightKG = entry.targetWeightKG
            self.targetDurationSeconds = entry.targetDurationSeconds; self.targetDistanceMeters = entry.targetDistanceMeters
        }
        public var targets: Targets { Targets(sets: targetSets, reps: targetReps, weightKG: targetWeightKG, durationSeconds: targetDurationSeconds, distanceMeters: targetDistanceMeters) }
        public var orderedSets: [RecordedSet] {
            (sets ?? []).sorted { $0.position == $1.position ? $0.id.uuidString < $1.id.uuidString : $0.position < $1.position }
        }
    }

    @Model public final class RecordedSet {
        public var id: UUID = UUID()
        public var operationID: UUID = UUID()
        public var position: Int = 1
        public var reps: Int? = nil
        public var weightKG: Double? = nil
        public var durationSeconds: Double? = nil
        public var distanceMeters: Double? = nil
        public var createdAt: Date = Date()
        public var updatedAt: Date = Date()
        public var revision: Int = 0
        public var exercise: SessionExercise? = nil
        public init(request: SetRequest, exercise: SessionExercise) {
            self.operationID = request.operationID; self.exercise = exercise; self.position = request.position
            self.reps = request.values.reps; self.weightKG = request.values.weightKG
            self.durationSeconds = request.values.durationSeconds; self.distanceMeters = request.values.distanceMeters
            self.createdAt = request.createdAt; self.updatedAt = request.createdAt
        }
        public var values: Metrics { Metrics(reps: reps, weightKG: weightKG, durationSeconds: durationSeconds, distanceMeters: distanceMeters) }
    }
}
public enum TrainingMigrationPlan: SchemaMigrationPlan {
    public static var schemas: [any VersionedSchema.Type] { [TrainingSchemaV1.self] }
    public static var stages: [MigrationStage] { [] }
}
public typealias Exercise = TrainingSchemaV1.Exercise
public typealias WorkoutTemplate = TrainingSchemaV1.WorkoutTemplate
public typealias TemplateExercise = TrainingSchemaV1.TemplateExercise
public typealias WorkoutSession = TrainingSchemaV1.WorkoutSession
public typealias SessionExercise = TrainingSchemaV1.SessionExercise
public typealias RecordedSet = TrainingSchemaV1.RecordedSet
