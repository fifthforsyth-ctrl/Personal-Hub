import Foundation
import SwiftUI
import WatchKit
import WidgetKit

// Holds today's Hub data for every screen, keeps the last good copy so the
// app opens instantly, and runs the buttons.
@MainActor
final class HubStore: ObservableObject {
    @Published var today: Today?
    @Published var loading = false
    @Published var problem: String?
    @Published var toast: String?
    @Published var busy = false

    private let cacheKey = "hub.today.v1"

    init() {
        if let data = UserDefaults.standard.data(forKey: cacheKey),
           let saved = try? HubAPI.decoder.decode(Today.self, from: data) {
            today = saved
        }
    }

    func refresh() async {
        loading = true
        defer { loading = false }
        do {
            let fresh = try await HubAPI.shared.today()
            today = fresh
            problem = nil
            if let data = try? HubAPI.encoder.encode(fresh) {
                UserDefaults.standard.set(data, forKey: cacheKey)
            }
        } catch {
            problem = error.localizedDescription
        }
    }

    // Runs one action, shows what the Hub said, buzzes, and refreshes the
    // screens and the watch face.
    func act(_ api: String, _ args: [String: String] = [:], haptic: WKHapticType = .success) async {
        guard !busy else { return }
        busy = true
        defer { busy = false }
        do {
            let reply = try await HubAPI.shared.act(api, args)
            WKInterfaceDevice.current().play(reply.ok ? haptic : .failure)
            show(reply.say)
        } catch {
            WKInterfaceDevice.current().play(.failure)
            show(error.localizedDescription)
        }
        WidgetCenter.shared.reloadAllTimelines()
        await refresh()
    }

    func show(_ line: String) {
        withAnimation { toast = line }
        let shown = line
        Task {
            try? await Task.sleep(nanoseconds: 2_800_000_000)
            if toast == shown { withAnimation { toast = nil } }
        }
    }

    // A timer started on the watch shows at once, before the Hub answers.
    func optimisticStart(_ category: String) {
        today?.running = Running(category: category, startedAt: Date())
    }

    func optimisticStop() {
        today?.running = nil
    }
}
