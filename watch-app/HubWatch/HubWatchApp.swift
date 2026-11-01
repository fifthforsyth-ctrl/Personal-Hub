import SwiftUI

@main
struct HubWatchApp: App {
    @StateObject private var store = HubStore()
    @Environment(\.scenePhase) private var phase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(store)
                .tint(.orange)
                .task { await store.refresh() }
                .onChange(of: phase) { _, now in
                    if now == .active { Task { await store.refresh() } }
                }
        }
    }
}
