import SwiftUI
struct EntryForm: Identifiable {
    let id = UUID()
    let exercise: Exercise
    var sets = ""
    var reps = ""
    var weight = ""
    var duration = ""
    var distance = ""
    var rest = "60"
    var instructions = ""
    var type: Measurement? { Measurement(rawValue: exercise.measurement) }
    func input() throws -> TemplateInput {
        let targets = try Targets(sets: InputNumber.integer(sets, label: "Target sets"), reps: InputNumber.integer(reps, label: "Target repetitions"), weightKG: InputNumber.decimal(weight, label: "Target load"), durationSeconds: InputNumber.decimal(duration, label: "Target duration"), distanceMeters: InputNumber.decimal(distance, label: "Target distance"))
        guard let rest = try InputNumber.integer(rest, label: "Rest", optional: false) else { throw TrainingError.invalid("Rest is required.") }
        return TemplateInput(exerciseID: exercise.id, targets: targets, instructions: instructions, restSeconds: rest)
    }
}
struct WorkoutCreator: View {
    @ObservedObject var app: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var name = ""
    @State private var notes = ""
    @State private var entries: [EntryForm] = []
    @State private var library: [Exercise] = []
    @State private var choosing = false
    @State private var error: String?
    @State private var confirmLeave = false
    @State private var saved: WorkoutTemplate?
    var body: some View {
        Form {
            Section("Workout") {
                TextField("Name", text: $name).accessibilityIdentifier("workout.name")
                TextField("Description", text: $notes, axis: .vertical)
            }
            ForEach($entries) { $entry in
                Section(entry.exercise.name) {
                    if let type = entry.type {
                        NumberField("Target sets", value: $entry.sets)
                        if type.hasReps { NumberField("Target repetitions", value: $entry.reps) }
                        if type.hasWeight { NumberField("Target load (kg)", value: $entry.weight) }
                        if type.hasDuration { NumberField("Target duration per set (seconds)", value: $entry.duration) }
                        if type.hasDistance { NumberField("Target distance per set (meters)", value: $entry.distance) }
                        NumberField("Rest (seconds)", value: $entry.rest, optional: false)
                        TextField("Instructions", text: $entry.instructions, axis: .vertical)
                        HStack {
                            Button("Move up") { move(entry.id, by: -1) }.buttonStyle(.borderless)
                            Spacer()
                            Button("Move down") { move(entry.id, by: 1) }.buttonStyle(.borderless)
                        }
                        Button("Remove exercise", role: .destructive) { entries.removeAll { $0.id == entry.id } }
                    } else { Text("Unknown exercise type. Reopen this editor.") }
                }
            }
            Section {
                Button("Add exercise") { choosing = true }.disabled(entries.count >= 100).accessibilityIdentifier("workout.addExercise")
                Text("Targets guide the workout; actual results are entered separately. Blank targets are unspecified.").font(.footnote).foregroundStyle(.secondary)
            }
            if let error { Text(error).foregroundStyle(.red).accessibilityIdentifier("workout.error") }
            Button("Save workout", action: save).disabled(name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || entries.isEmpty || saved != nil).accessibilityIdentifier("workout.save")
        }
        .navigationTitle("Create workout")
        .navigationBarBackButtonHidden()
        .toolbar { ToolbarItem(placement: .topBarLeading) { Button("Back") { if !name.isEmpty || !entries.isEmpty { confirmLeave = true } else { dismiss() } }.accessibilityIdentifier("editor.back") } }
        .confirmationDialog("Discard unsaved workout?", isPresented: $confirmLeave, titleVisibility: .visible) { Button("Discard changes", role: .destructive) { dismiss() } }
        .sheet(isPresented: $choosing) {
            NavigationStack {
                List(library, id: \.id) { exercise in
                    Button(exercise.name) { entries.append(EntryForm(exercise: exercise)); choosing = false }.accessibilityIdentifier("choose.\(exercise.name)")
                }.navigationTitle("Choose exercise").toolbar { Button("Cancel") { choosing = false } }
                if library.isEmpty { Text("Create an exercise in the library first.").padding() }
            }
        }
        .onAppear { do { library = try app.repository?.exercises().filter { !$0.archived } ?? [] } catch { self.error = error.localizedDescription } }
    }
    private func move(_ id: UUID, by direction: Int) {
        guard let index = entries.firstIndex(where: { $0.id == id }), entries.indices.contains(index + direction) else { return }
        entries.swapAt(index, index + direction)
    }
    private func save() {
        guard let repo = app.repository, saved == nil else { return }
        do { saved = try repo.createTemplate(name: name, notes: notes, entries: entries.map { try $0.input() }); app.changed(); dismiss() }
        catch { self.error = error.localizedDescription }
    }
}
struct NumberField: View {
    let title: String
    @Binding var value: String
    let optional: Bool
    init(_ title: String, value: Binding<String>, optional: Bool = true) { self.title = title; _value = value; self.optional = optional }
    var body: some View {
        VStack(alignment: .leading) { Text(title).font(.subheadline); TextField(optional ? "Optional" : "Required", text: $value).keyboardType(.decimalPad).accessibilityLabel(title).accessibilityIdentifier(title) }
    }
}
struct WorkoutPreview: View {
    @ObservedObject var app: AppState
    let template: WorkoutTemplate
    @State private var operation = UUID()
    @State private var started: WorkoutSession?
    @State private var error: String?
    var body: some View {
        List {
            if let error { Text(error).foregroundStyle(.red) }
            ForEach(template.orderedEntries, id: \.id) { entry in
                VStack(alignment: .leading, spacing: 8) {
                    Text(entry.exercise?.name ?? "Exercise still loading").font(.headline)
                    Text(entry.targets.summary)
                    Text("Rest: \(entry.restSeconds) seconds").foregroundStyle(.secondary)
                    if !entry.instructions.isEmpty { Text(entry.instructions) }
                }
            }
            Button("Start workout offline", action: start).accessibilityIdentifier("workout.start")
        }.navigationTitle(template.name)
        .navigationDestination(item: $started) { session in SessionRecorder(app: app, session: session) }
    }
    private func start() {
        guard let repo = app.repository, started == nil else { return }
        do { started = try repo.startSession(template: template, operationID: operation); operation = UUID(); app.changed() }
        catch { self.error = error.localizedDescription }
    }
}
