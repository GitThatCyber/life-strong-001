import Foundation
public struct SessionDraft: Codable, Equatable {
    public var selectedExerciseID: UUID?
    public var forms: [String: MetricDraft] = [:]
    public var pending: SetRequest?
    public var restDeadline: Date?
    public var pausedRestSeconds: Double?
    public init() {}
}
public struct DeviceState: Codable {
    public var version = 1
    public var sessions: [String: SessionDraft] = [:]
    public init() {}
}
@MainActor public final class DeviceDraftStore {
    private let url: URL
    public private(set) var state: DeviceState
    public init(url: URL) throws {
        self.url = url
        if FileManager.default.fileExists(atPath: url.path) {
            state = try JSONDecoder().decode(DeviceState.self, from: Data(contentsOf: url))
            guard state.version == 1 else { throw TrainingError.invalid("Unsupported device draft version. Preserve the file for recovery.") }
        } else { state = DeviceState() }
    }
    public func draft(sessionID: UUID) -> SessionDraft { state.sessions[sessionID.uuidString] ?? SessionDraft() }
    public func save(_ draft: SessionDraft, sessionID: UUID) throws {
        var next = state; next.sessions[sessionID.uuidString] = draft
        let data = try JSONEncoder().encode(next)
        try data.write(to: url, options: .atomic)
        state = next
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication], ofItemAtPath: url.path)
        #endif
    }
}
