import SwiftUI

// The day at a glance: where you are in the plan, what's on Today, this
// week's focus goals and the lesson you're learning. The numbers sit small
// at the top and bottom; the words lead.
struct TodayView: View {
    @EnvironmentObject var store: HubStore
    @State private var finishing: TodayTask?

    var body: some View {
        NavigationStack {
            Group {
                if let t = store.today {
                    content(t)
                } else if let problem = store.problem {
                    VStack(spacing: 8) {
                        Text(problem).font(.footnote).multilineTextAlignment(.center)
                        Button("Try again") { Task { await store.refresh() } }
                    }
                } else {
                    ProgressView()
                }
            }
            .navigationTitle("Today")
        }
    }

    @ViewBuilder
    private func content(_ t: Today) -> some View {
        let now = Format.nowHHMM()
        List {
            Section {
                Text(Format.winsLine(t.wins, t.losses) + " · " + Format.minutes(t.minutes))
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .listRowBackground(Color.clear)

                if let run = t.running {
                    HStack {
                        Circle().fill(.orange).frame(width: 7, height: 7)
                        Text(run.category).lineLimit(1)
                        Spacer(minLength: 4)
                        Text(run.startedAt, style: .timer)
                            .monospacedDigit()
                            .foregroundStyle(.orange)
                    }
                }

                if let b = t.block {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(b.now == true ? "Now" : "Next at \(Format.clockWithHalf(b.start))")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                        Text(b.title).font(.headline)
                        if b.now == true, !b.end.isEmpty {
                            Text("till \(Format.clock(b.end))").font(.caption2).foregroundStyle(.secondary)
                        }
                    }
                }

                if let w = t.working {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Working on").font(.caption2).foregroundStyle(.secondary)
                        Text(w.text).font(.footnote).lineLimit(3)
                    }
                }
            }

            if !t.tasks.isEmpty {
                Section("Today") {
                    ForEach(t.tasks) { task in
                        Button {
                            finishing = task
                        } label: {
                            HStack(alignment: .top, spacing: 6) {
                                Image(systemName: "circle").font(.footnote).foregroundStyle(.orange)
                                VStack(alignment: .leading, spacing: 1) {
                                    Text(task.text).font(.footnote).lineLimit(3)
                                    if let q = task.quest {
                                        Text(q).font(.caption2).foregroundStyle(.secondary).lineLimit(1)
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if !t.plan.isEmpty {
                Section("Plan") {
                    ForEach(t.plan) { b in
                        let isNow = b.start <= now && now < b.end
                        let past = !b.end.isEmpty && b.end <= now
                        HStack(spacing: 6) {
                            Text(Format.clock(b.start))
                                .font(.caption2)
                                .monospacedDigit()
                                .frame(width: 34, alignment: .leading)
                                .foregroundStyle(isNow ? Color.orange : Color.secondary)
                            Text(b.title)
                                .font(.footnote)
                                .lineLimit(2)
                                .foregroundStyle(past ? .secondary : .primary)
                        }
                    }
                }
            }

            if !t.focus.isEmpty {
                Section("This week") {
                    ForEach(t.focus, id: \.self) { goal in
                        Text(goal).font(.footnote)
                    }
                }
            }

            if let lesson = t.lesson {
                Section("Learning") {
                    Text(lesson).font(.footnote)
                }
            }

            if !t.targets.isEmpty || t.slept != nil {
                Section("Minutes") {
                    if let slept = t.slept {
                        HStack {
                            Text("Slept").font(.footnote)
                            Spacer()
                            Text(Format.minutes(slept)).font(.footnote).monospacedDigit().foregroundStyle(.secondary)
                        }
                    }
                    ForEach(t.targets) { target in
                        VStack(alignment: .leading, spacing: 3) {
                            HStack {
                                Text(target.label).font(.footnote)
                                Spacer()
                                Text("\(Format.minutes(target.done)) of \(Format.minutes(target.goal))")
                                    .font(.caption2)
                                    .monospacedDigit()
                                    .foregroundStyle(.secondary)
                            }
                            ProgressView(value: Double(min(target.done, max(target.goal, 1))), total: Double(max(target.goal, 1)))
                                .tint(target.done >= target.goal ? .green : .orange)
                        }
                    }
                }
            }
        }
        .confirmationDialog(
            "Finished?",
            isPresented: Binding(get: { finishing != nil }, set: { if !$0 { finishing = nil } }),
            presenting: finishing
        ) { task in
            Button("Done") {
                Task { await store.act("done", ["id": task.id]) }
            }
            Button("Not yet", role: .cancel) {}
        } message: { task in
            Text(task.text)
        }
    }
}
