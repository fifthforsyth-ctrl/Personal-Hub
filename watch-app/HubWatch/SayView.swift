import SwiftUI

// Dictate (or scribble) a win, a loss or a note, then send it.
struct SayView: View {
    enum Kind {
        case win, loss, note

        var title: String {
            switch self {
            case .win: return "Win"
            case .loss: return "Loss"
            case .note: return "Note"
            }
        }

        var prompt: String {
            switch self {
            case .win: return "What's the win?"
            case .loss: return "What was the loss?"
            case .note: return "Say the note"
            }
        }
    }

    let kind: Kind
    @EnvironmentObject var store: HubStore
    @Environment(\.dismiss) private var dismiss
    @State private var words = ""

    var body: some View {
        ScrollView {
            VStack(spacing: 10) {
                TextField(kind.prompt, text: $words, axis: .vertical)
                    .lineLimit(1...5)

                Button {
                    let said = words.trimmingCharacters(in: .whitespacesAndNewlines)
                    Task {
                        switch kind {
                        case .win: await store.act("win", ["label": said])
                        case .loss: await store.act("loss", ["label": said], haptic: .directionDown)
                        case .note: await store.act("note", ["text": said])
                        }
                    }
                    dismiss()
                } label: {
                    Text(kind == .note ? "Keep it" : "Log it").frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(words.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || store.busy)
            }
        }
        .navigationTitle(kind.title)
    }
}
