import SwiftUI
struct SessionRecorder: View {
    @ObservedObject var app: AppState
    let session: WorkoutSession
    @State private var draft = SessionDraft()
    @State private var loaded = false
    @State private var error: String?
    @State private var message: String?
    @State private var confirmComplete = false
    private var exercise: SessionExercise? { session.orderedExercises.first { $0.id == draft.selectedExerciseID } ?? session.orderedExercises.first }
    private var savedSetCount: Int { session.orderedExercises.reduce(0) { $0 + $1.orderedSets.count } }
    var body: some View {
        Form {
            Section {
                Text(session.status.capitalized).accessibilityIdentifier("session.status")
                Text("\(savedSetCount) \(savedSetCount == 1 ? "set" : "sets") saved locally").accessibilityIdentifier("session.count")
                Text("Plan and recorded results are separate. Cloud delivery is not confirmed by a local save.").font(.footnote).foregroundStyle(.secondary)
            }
            if let error { Text(error).foregroundStyle(.red).accessibilityIdentifier("session.error") }
            if let message { Text(message).foregroundStyle(.green).accessibilityIdentifier("session.message") }
            if let exercise, let type = Measurement(rawValue: exercise.measurement) {
                Section("Exercise") {
                    Picker("Selected exercise", selection: Binding(get: { draft.selectedExerciseID ?? exercise.id }, set: { id in change { $0.selectedExerciseID = id } })) {
                        ForEach(session.orderedExercises, id: \.id) { Text($0.name).tag($0.id) }
                    }.disabled(draft.pending != nil).accessibilityIdentifier("session.exercise")
                    Text("Plan: \(exercise.targets.summary)").accessibilityIdentifier("session.targets")
                    if !exercise.instructions.isEmpty { Text(exercise.instructions) }
                    Text("Rest default: \(exercise.restSeconds) seconds")
                }
                Section("Actual results") {
                    ForEach(exercise.orderedSets, id: \.id) { set in Text("Set \(set.position): \(set.values.summary)").accessibilityIdentifier("recorded.\(set.position)") }
                    if exercise.orderedSets.isEmpty { Text("No sets recorded.") }
                }
                if session.status != "completed" || draft.pending != nil {
                    Section(draft.pending == nil ? "Log actual set" : "Finish interrupted record") {
                        Group {
                            if type.hasReps { NumberField("Actual repetitions", value: field(\.reps, exercise: exercise), optional: false) }
                            if type.hasWeight { NumberField("Actual load (kg)", value: field(\.weight, exercise: exercise), optional: false) }
                            if type.hasDuration { NumberField("Actual duration (seconds)", value: field(\.duration, exercise: exercise), optional: false) }
                            if type.hasDistance { NumberField("Actual distance (meters)", value: field(\.distance, exercise: exercise), optional: false) }
                        }.disabled(draft.pending != nil || session.status != "active")
                        Button(draft.pending == nil ? "Record set" : "Retry interrupted record") { record(exercise: exercise, type: type) }
                            .disabled(!loaded || (session.status != "active" && draft.pending == nil)).accessibilityIdentifier("session.record")
                    }
                }
                Section("Rest timer") {
                    TimelineView(.periodic(from: .now, by: 1)) { timeline in
                        let remaining = draft.pausedRestSeconds ?? max(0, draft.restDeadline?.timeIntervalSince(timeline.date) ?? 0)
                        Text("\(Int(ceil(remaining)) / 60):\(String(format: "%02d", Int(ceil(remaining)) % 60))").font(.title.monospacedDigit()).accessibilityIdentifier("timer.remaining")
                    }
                    Text("Foreground timer only in this foundation build; background alerts arrive in Phase 7C.").font(.footnote).foregroundStyle(.secondary)
                    Button("Start rest") { change { $0.restDeadline = Date().addingTimeInterval(Double(exercise.restSeconds)); $0.pausedRestSeconds = nil } }.disabled(session.status != "active" || draft.pending != nil)
                    Button("Skip rest") { change { $0.restDeadline = nil; $0.pausedRestSeconds = nil } }
                }
            } else { Section { Text("Exercise data is still loading. Keep this saved session; do not recreate it.") } }
            if session.status != "completed" {
                Section {
                    Button(session.status == "paused" ? "Resume workout" : "Pause workout") { status(session.status == "paused" ? "active" : "paused") }.disabled(draft.pending != nil).accessibilityIdentifier("session.pause")
                    Button("Complete workout") { confirmComplete = true }.disabled(draft.pending != nil).accessibilityIdentifier("session.complete")
                }
            }
        }
        .navigationTitle(session.templateName)
        .onAppear(perform: recover)
        .confirmationDialog("Complete this workout? Unsaved fields will be cleared; recorded sets stay saved.", isPresented: $confirmComplete, titleVisibility: .visible) {
            Button("Complete workout") { status("completed") }
        }
    }
    private func persist(_ next: SessionDraft) throws {
        guard let store = app.drafts else { throw TrainingError.invalid("Device draft storage is unavailable.") }
        try store.save(next, sessionID: session.id); draft = next
    }
    private func change(_ work: (inout SessionDraft) -> Void) {
        var next = draft; work(&next)
        do { try persist(next); error = nil }
        catch { draft = next; self.error = "Input remains visible but could not be saved for recovery: \(error.localizedDescription)" }
    }
    private func field(_ key: WritableKeyPath<MetricDraft, String>, exercise: SessionExercise) -> Binding<String> {
        Binding(get: { (draft.forms[exercise.id.uuidString] ?? MetricDraft())[keyPath: key] }, set: { value in
            change { next in var form = next.forms[exercise.id.uuidString] ?? MetricDraft(); form[keyPath: key] = value; next.forms[exercise.id.uuidString] = form }
        })
    }
    private func recover() {
        guard !loaded else { return }
        draft = app.drafts?.draft(sessionID: session.id) ?? SessionDraft()
        if draft.selectedExerciseID == nil { draft.selectedExerciseID = session.orderedExercises.first?.id }
        loaded = true
        if draft.pending != nil { message = "Interrupted record recovered. Retry it to confirm the saved set without duplicating it." }
    }
    private func record(exercise: SessionExercise, type: Measurement) {
        guard let repo = app.repository else { return }
        do {
            let request: SetRequest
            if let pending = draft.pending { request = pending }
            else {
                let values = try (draft.forms[exercise.id.uuidString] ?? MetricDraft()).metrics(for: type)
                request = SetRequest(sessionID: session.id, exerciseID: exercise.id, position: (exercise.orderedSets.map(\.position).max() ?? 0) + 1, values: values)
                var next = draft; next.pending = request; try persist(next)
            }
            let result = try repo.record(request)
            var next = draft; next.pending = nil; next.forms[request.exerciseID.uuidString] = MetricDraft()
            if exercise.restSeconds > 0 { next.restDeadline = result.createdAt.addingTimeInterval(Double(exercise.restSeconds)); next.pausedRestSeconds = nil }
            try persist(next)
            error = nil; message = "Set \(result.position) saved locally."; app.changed()
        } catch { self.error = error.localizedDescription; app.changed() }
    }
    private func status(_ nextStatus: String) {
        guard let repo = app.repository else { return }
        do {
            try repo.setStatus(nextStatus, session: session)
            var next = draft
            if nextStatus == "paused", let deadline = next.restDeadline { next.pausedRestSeconds = max(0, deadline.timeIntervalSinceNow); next.restDeadline = nil }
            if nextStatus == "active", let seconds = next.pausedRestSeconds { next.restDeadline = Date().addingTimeInterval(seconds); next.pausedRestSeconds = nil }
            if nextStatus == "completed" { next.forms = [:]; next.restDeadline = nil; next.pausedRestSeconds = nil }
            try persist(next); error = nil; message = "Workout \(nextStatus) and saved locally."; app.changed()
        } catch { self.error = error.localizedDescription; app.changed() }
    }
}
