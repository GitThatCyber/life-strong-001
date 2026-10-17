import SwiftUI
import UniformTypeIdentifiers

struct SnapshotDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    var data: Data
    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
struct FoundationHome: View {
    @ObservedObject var app: AppState
    @State private var error: String?
    @State private var exporting = false
    @State private var document: SnapshotDocument?
    @State private var exercises: [Exercise] = []
    @State private var templates: [WorkoutTemplate] = []
    @State private var sessions: [WorkoutSession] = []
    var body: some View {
        NavigationStack {
            List {
                Section {
                    Label(app.isCloudRehearsal ? "Private iCloud rehearsal" : "Local training library", systemImage: app.isCloudRehearsal ? "icloud" : "iphone")
                    Text(app.isCloudRehearsal ? "Disposable test data only. Local saves do not confirm cloud delivery." : "Works offline. Cloud sync is off in this build.").font(.footnote).foregroundStyle(.secondary)
                }
                if let error { Section { Text(error).foregroundStyle(.red).accessibilityIdentifier("home.error") } }
                Section("Build your library") {
                    NavigationLink("Create exercise") { ExerciseCreator(app: app) }.accessibilityIdentifier("home.createExercise")
                    NavigationLink("Create workout") { WorkoutCreator(app: app) }.accessibilityIdentifier("home.createWorkout")
                }
                Section("Exercises · \(exercises.count)") {
                    ForEach(exercises, id: \.id) { item in
                        VStack(alignment: .leading) { Text(item.name); Text(Measurement(rawValue: item.measurement)?.title ?? "Unknown type").font(.caption).foregroundStyle(.secondary) }
                    }
                }
                Section("Workouts · \(templates.count)") {
                    ForEach(templates, id: \.id) { template in NavigationLink(template.name) { WorkoutPreview(app: app, template: template) } }
                }
                Section("Saved sessions · \(sessions.count)") {
                    ForEach(sessions, id: \.id) { session in
                        NavigationLink { SessionRecorder(app: app, session: session) } label: {
                            VStack(alignment: .leading) { Text(session.templateName); Text("\(session.status.capitalized) · \(session.startedAt.formatted(date: .abbreviated, time: .shortened))").font(.caption).foregroundStyle(.secondary) }
                        }.accessibilityIdentifier("session.\(session.id.uuidString)")
                    }
                }
                Section {
                    Button("Export foundation snapshot", action: export).accessibilityIdentifier("home.export")
                    Text("Phase 7A rehearsal. Legacy import, programs, corrections, reminders and complete backup/restore follow in later phases. Keep using the existing app for real training.").font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Life Strong")
            .refreshable { refresh() }
            .onAppear(perform: refresh)
            .onChange(of: app.revision) { _, _ in refresh() }
            .fileExporter(isPresented: $exporting, document: document, contentType: .json, defaultFilename: "LifeStrong-foundation") { result in
                if case .failure(let failure) = result { error = failure.localizedDescription }
            }
        }
    }
    private func refresh() {
        guard let repo = app.repository else { return }
        do { exercises = try repo.exercises().filter { !$0.archived }; templates = try repo.templates().filter { !$0.archived }; sessions = try repo.sessions(); error = nil }
        catch { self.error = error.localizedDescription }
    }
    private func export() {
        guard let repo = app.repository else { return }
        do { document = SnapshotDocument(data: try FoundationSnapshot.capture(repository: repo).encoded()); exporting = true }
        catch { self.error = error.localizedDescription }
    }
}

struct ExerciseCreator: View {
    @ObservedObject var app: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var equipment = ""
    @State private var focus = ""
    @State private var measurement = Measurement.reps
    @State private var message: String?
    @State private var error: String?
    @State private var confirmLeave = false
    @FocusState private var nameFocused: Bool
    private var dirty: Bool { !name.isEmpty || !equipment.isEmpty || !focus.isEmpty || measurement != .reps }
    var body: some View {
        Form {
            Section("Exercise details") {
                TextField("Name", text: $name).accessibilityIdentifier("exercise.name").focused($nameFocused)
                TextField("Equipment", text: $equipment).accessibilityIdentifier("exercise.equipment")
                TextField("Muscle focus", text: $focus).accessibilityIdentifier("exercise.focus")
                Picker("Measurement type", selection: $measurement) {
                    ForEach(Measurement.allCases) { Text($0.title).tag($0) }
                }.pickerStyle(.navigationLink).accessibilityIdentifier("exercise.type")
            }
            if let error { Text(error).foregroundStyle(.red).accessibilityIdentifier("exercise.error") }
            if let message { Text(message).foregroundStyle(.green).accessibilityIdentifier("exercise.saved") }
            Button("Save exercise", action: save).disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty).accessibilityIdentifier("exercise.save")
        }
        .navigationTitle("Create exercise")
        .navigationBarBackButtonHidden()
        .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Back") { if dirty { confirmLeave = true } else { dismiss() } }.accessibilityIdentifier("editor.back") } }
        .confirmationDialog("Discard unsaved exercise?", isPresented: $confirmLeave, titleVisibility: .visible) { Button("Discard changes", role: .destructive) { dismiss() } }
    }
    private func save() {
        guard let repo = app.repository else { return }
        do {
            let item = try repo.createExercise(name: name, equipment: equipment, muscleFocus: focus, measurement: measurement)
            message = "Saved \(item.name). Ready for another exercise."; error = nil
            name = ""; equipment = ""; focus = ""; measurement = .reps; nameFocused = true; app.changed()
        } catch { self.error = error.localizedDescription }
    }
}
