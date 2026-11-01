import SwiftUI

// The running timer, big, with Stop; and every category to start (or
// switch to), the ones you use most first.
struct MinutesView: View {
    @EnvironmentObject var store: HubStore

    var body: some View {
        NavigationStack {
            List {
                if let run = store.today?.running {
                    Section {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(run.category).font(.headline).lineLimit(1)
                            Text(run.startedAt, style: .timer)
                                .font(.system(size: 34, weight: .semibold, design: .rounded))
                                .monospacedDigit()
                                .foregroundStyle(.orange)
                        }
                        .listRowBackground(Color.clear)

                        Button(role: .destructive) {
                            store.optimisticStop()
                            Task { await store.act("stop", haptic: .stop) }
                        } label: {
                            Label("Stop", systemImage: "stop.fill")
                        }
                        .disabled(store.busy)
                    }
                }

                Section(store.today?.running == nil ? "Start" : "Switch to") {
                    let running = store.today?.running?.category
                    ForEach(store.today?.categories ?? [], id: \.self) { cat in
                        Button {
                            store.optimisticStart(cat)
                            Task { await store.act("start", ["category": cat], haptic: .start) }
                        } label: {
                            HStack {
                                Text(cat).lineLimit(1)
                                Spacer()
                                if cat == running {
                                    Image(systemName: "timer").foregroundStyle(.orange)
                                }
                            }
                        }
                        .disabled(store.busy || cat == running)
                    }
                }

                if store.today == nil {
                    Text(store.problem ?? "Loading…").font(.footnote).foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Minutes")
        }
    }
}
