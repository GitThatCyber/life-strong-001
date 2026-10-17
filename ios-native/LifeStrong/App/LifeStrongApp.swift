import SwiftUI
import SwiftData
import CloudKit

@main struct LifeStrongApp: App {
    @StateObject private var state = AppState()
    var body: some Scene {
        WindowGroup {
            Group {
                if state.repository != nil { FoundationHome(app: state) }
                else {
                    VStack(spacing: 20) {
                        Image(systemName: "figure.strengthtraining.traditional").font(.largeTitle)
                        Text("Life Strong").font(.largeTitle.bold())
                        Text(state.startupError ?? "Opening your training library…").multilineTextAlignment(.center)
                        if state.startupError != nil && !state.accountChanged { Button("Try again") { Task { await state.open() } } }
                    }.padding().task { await state.open() }
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .CKAccountChanged)) { _ in state.stopForAccountChange() }
        }
    }
}

@MainActor final class AppState: ObservableObject {
    @Published var repository: TrainingRepository?
    @Published var revision = 0
    @Published var startupError: String?
    @Published var accountChanged = false
    private var opening = false
    private var container: ModelContainer?
    private(set) var drafts: DeviceDraftStore?
    #if CLOUDKIT_REHEARSAL
    let isCloudRehearsal = true
    #else
    let isCloudRehearsal = false
    #endif
    func open() async {
        guard !opening, repository == nil, !accountChanged else { return }
        opening = true; startupError = nil; defer { opening = false }
        do {
            let files = FileManager.default
            let base = files.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("LifeStrongFoundation", isDirectory: true)
            var folder = base.appendingPathComponent(isCloudRehearsal ? "CloudRehearsal" : "Local", isDirectory: true)
            #if DEBUG
            if ProcessInfo.processInfo.arguments.contains("-ui-testing"), let raw = ProcessInfo.processInfo.environment["LIFE_STRONG_UI_STORE"], let id = UUID(uuidString: raw) {
                guard !isCloudRehearsal else { throw TrainingError.invalid("Automated fixtures must not use a live iCloud container.") }
                folder = base.appendingPathComponent("UITests/\(id.uuidString)", isDirectory: true)
            }
            #endif
            try files.createDirectory(at: folder, withIntermediateDirectories: true)
            let storeURL = folder.appendingPathComponent("Training.store")
            #if CLOUDKIT_REHEARSAL
            guard let identifier = Bundle.main.object(forInfoDictionaryKey: "LifeStrongCloudContainer") as? String, identifier.hasSuffix(".rehearsal") else { throw TrainingError.invalid("Configure a separate rehearsal CloudKit container in Xcode first.") }
            let account = try await CKContainer(identifier: identifier).accountStatus()
            guard account == .available else { throw TrainingError.invalid("Sign into the intended iCloud account to open the disposable cloud rehearsal. Your local-only build is separate.") }
            container = try TrainingPersistence.privateRehearsal(at: storeURL, containerID: identifier)
            #else
            container = try TrainingPersistence.local(at: storeURL)
            #endif
            drafts = try DeviceDraftStore(url: folder.appendingPathComponent("device-drafts.json"))
            guard let container else { throw TrainingError.invalid("Training store could not open.") }
            repository = TrainingRepository(container: container)
        } catch {
            startupError = "Unable to open saved training data. \(error.localizedDescription) No storage was reset."
            repository = nil; container = nil
        }
    }
    func stopForAccountChange() {
        guard isCloudRehearsal else { return }
        accountChanged = true; repository = nil; container = nil; drafts = nil
        startupError = "iCloud account changed. Cloud rehearsal is locked. Close the app and return to the original account before reopening. Rehearsal files were preserved. Use only disposable fixture data in this phase."
    }
    func changed() { revision += 1 }
}
