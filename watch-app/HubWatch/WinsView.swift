import SwiftUI

// One tap logs a win: your habits first, then the wins you log most. Say
// anything else, log a loss, or keep a note on your board.
struct WinsView: View {
    @EnvironmentObject var store: HubStore

    var body: some View {
        NavigationStack {
            List {
                if let t = store.today {
                    Text(Format.winsLine(t.wins, t.losses) + " today")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .listRowBackground(Color.clear)
                }

                Section {
                    ForEach(store.today?.habits ?? [], id: \.self) { habit in
                        Button {
                            Task { await store.act("win", ["label": habit]) }
                        } label: {
                            HStack(spacing: 8) {
                                Text("⚔")
                                Text(habit).lineLimit(2)
                            }
                        }
                        .disabled(store.busy)
                    }
                    NavigationLink {
                        SayView(kind: .win)
                    } label: {
                        Label("Say a win…", systemImage: "mic")
                    }
                }

                Section {
                    NavigationLink {
                        SayView(kind: .loss)
                    } label: {
                        Label("Loss…", systemImage: "xmark.circle")
                    }
                    NavigationLink {
                        SayView(kind: .note)
                    } label: {
                        Label("Note…", systemImage: "note.text")
                    }
                }
            }
            .navigationTitle("Wins")
        }
    }
}
