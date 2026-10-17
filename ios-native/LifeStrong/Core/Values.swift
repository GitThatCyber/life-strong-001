import Foundation
public enum TrainingError: LocalizedError {
    case invalid(String)
    public var errorDescription: String? { switch self { case .invalid(let message): return message } }
}
public enum Measurement: String, Codable, CaseIterable, Identifiable {
    case reps, weightReps = "weight_reps", duration, distanceDuration = "distance_duration"
    public var id: String { rawValue }
    public var title: String {
        switch self { case .reps: return "Repetitions"; case .weightReps: return "Weight and repetitions"; case .duration: return "Duration"; case .distanceDuration: return "Distance and duration" }
    }
    public var hasReps: Bool { self == .reps || self == .weightReps }
    public var hasWeight: Bool { self == .weightReps }
    public var hasDuration: Bool { self == .duration || self == .distanceDuration }
    public var hasDistance: Bool { self == .distanceDuration }
}
public struct Metrics: Codable, Equatable {
    public var reps: Int?
    public var weightKG: Double?
    public var durationSeconds: Double?
    public var distanceMeters: Double?
    public init(reps: Int? = nil, weightKG: Double? = nil, durationSeconds: Double? = nil, distanceMeters: Double? = nil) {
        self.reps = reps; self.weightKG = weightKG; self.durationSeconds = durationSeconds; self.distanceMeters = distanceMeters
    }
    public var summary: String {
        [reps.map { "\($0) reps" }, weightKG.map { "\($0.formatted()) kg" }, durationSeconds.map { "\($0.formatted()) sec" }, distanceMeters.map { "\($0.formatted()) m" }].compactMap { $0 }.joined(separator: " · ")
    }
    public func validate(for type: Measurement, requireAll: Bool) throws {
        let present = [reps != nil, weightKG != nil, durationSeconds != nil, distanceMeters != nil]
        let allowed = [type.hasReps, type.hasWeight, type.hasDuration, type.hasDistance]
        if zip(present, allowed).contains(where: { ($0 && !$1) || (requireAll && $1 && !$0) }) {
            throw TrainingError.invalid("Values must match \(type.title.lowercased()).")
        }
        if let reps, !(1...100000).contains(reps) { throw TrainingError.invalid("Repetitions must be 1–100,000.") }
        for (value, min, max, label) in [(weightKG, 0.0, 10000.0, "Load"), (durationSeconds, Double.leastNonzeroMagnitude, 604800.0, "Duration"), (distanceMeters, Double.leastNonzeroMagnitude, 10000000.0, "Distance")] {
            if let value, !value.isFinite || value < min || value > max { throw TrainingError.invalid("\(label) is outside the supported range.") }
        }
    }
}
public struct Targets: Codable, Equatable {
    public var sets: Int?
    public var reps: Int?
    public var weightKG: Double?
    public var durationSeconds: Double?
    public var distanceMeters: Double?
    public init(sets: Int? = nil, reps: Int? = nil, weightKG: Double? = nil, durationSeconds: Double? = nil, distanceMeters: Double? = nil) {
        self.sets = sets; self.reps = reps; self.weightKG = weightKG; self.durationSeconds = durationSeconds; self.distanceMeters = distanceMeters
    }
    public func validate(for type: Measurement) throws {
        if let sets, !(1...1000).contains(sets) { throw TrainingError.invalid("Target sets must be 1–1,000.") }
        try Metrics(reps: reps, weightKG: weightKG, durationSeconds: durationSeconds, distanceMeters: distanceMeters).validate(for: type, requireAll: false)
    }
    public var summary: String {
        let metrics = Metrics(reps: reps, weightKG: weightKG, durationSeconds: durationSeconds, distanceMeters: distanceMeters).summary
        let text = [sets.map { "\($0) sets" }, metrics.isEmpty ? nil : "\(metrics) per set"].compactMap { $0 }.joined(separator: " · ")
        return text.isEmpty ? "No structured targets" : text
    }
}
public struct TemplateInput {
    public var exerciseID: UUID
    public var targets: Targets
    public var instructions: String
    public var restSeconds: Int
    public init(exerciseID: UUID, targets: Targets = Targets(), instructions: String = "", restSeconds: Int = 60) {
        self.exerciseID = exerciseID; self.targets = targets; self.instructions = instructions; self.restSeconds = restSeconds
    }
}
public struct SetRequest: Codable, Equatable {
    public var operationID: UUID
    public var sessionID: UUID
    public var exerciseID: UUID
    public var position: Int
    public var values: Metrics
    public var createdAt: Date
    public init(operationID: UUID = UUID(), sessionID: UUID, exerciseID: UUID, position: Int, values: Metrics, createdAt: Date = Date()) {
        self.operationID = operationID; self.sessionID = sessionID; self.exerciseID = exerciseID; self.position = position; self.values = values; self.createdAt = createdAt
    }
}
public struct MetricDraft: Codable, Equatable {
    public var reps = ""
    public var weight = ""
    public var duration = ""
    public var distance = ""
    public init() {}
    public func metrics(for type: Measurement) throws -> Metrics {
        let metrics = try Metrics(reps: type.hasReps ? InputNumber.integer(reps, label: "Repetitions", optional: false) : nil,
            weightKG: type.hasWeight ? InputNumber.decimal(weight, label: "Load", optional: false) : nil,
            durationSeconds: type.hasDuration ? InputNumber.decimal(duration, label: "Duration", optional: false) : nil,
            distanceMeters: type.hasDistance ? InputNumber.decimal(distance, label: "Distance", optional: false) : nil)
        try metrics.validate(for: type, requireAll: true); return metrics
    }
}
public enum InputNumber {
    public static func decimal(_ text: String, label: String, optional: Bool = true) throws -> Double? {
        let input = text.trimmingCharacters(in: .whitespacesAndNewlines).replacingOccurrences(of: ",", with: ".")
        if input.isEmpty && optional { return nil }
        guard input.range(of: #"^\d+(\.\d+)?$"#, options: .regularExpression) != nil,
              let value = Double(input), value.isFinite else { throw TrainingError.invalid("Enter a valid \(label.lowercased()).") }
        return value
    }
    public static func integer(_ text: String, label: String, optional: Bool = true) throws -> Int? {
        guard let value = try decimal(text, label: label, optional: optional) else { return nil }
        guard value.rounded() == value, value >= 0, value <= 10000000 else { throw TrainingError.invalid("\(label) must be a whole number within the supported range.") }
        return Int(value)
    }
}
