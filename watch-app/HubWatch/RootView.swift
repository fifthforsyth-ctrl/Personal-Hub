import SwiftUI

// Three pages, swiped sideways: Today, Minutes, Wins. The complication
// opens Minutes when a timer is running, Today otherwise.
struct RootView: View {
    @EnvironmentObject var store: HubStore
    @State private var page = 0

    var body: some View {
        TabView(selection: $page) {
            TodayView().tag(0)
            MinutesView().tag(1)
            WinsView().tag(2)
        }
        .tabViewStyle(.page)
        .overlay(alignment: .bottom) {
            if let line = store.toast {
                Text(line)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 12))
                    .padding(.horizontal, 6)
                    .padding(.bottom, 2)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .onTapGesture { withAnimation { store.toast = nil } }
            }
        }
        .onOpenURL { url in
            switch url.host {
            case "minutes": page = 1
            case "wins": page = 2
            default: page = 0
            }
        }
    }
}
