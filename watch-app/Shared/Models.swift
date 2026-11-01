import Foundation

// What the Hub's `watch` function sends the watch app (see the "watch app"
// part of supabase/functions/watch/index.ts). Times arrive as epoch
// milliseconds.

struct Running: Codable, Hashable {
    var category: String
    var startedAt: Date
}

struct PlanBlock: Codable, Hashable, Identifiable {
    var title: String
    var category: String?
    var start: String // "HH:MM"
    var end: String
    var now: Bool?

    var id: String { "\(start)-\(end)-\(title)" }
}

struct TodayTask: Codable, Hashable, Identifiable {
    var id: String
    var text: String
    var quest: String?
}

struct Working: Codable, Hashable {
    var text: String
    var since: Date?
}

struct DayTarget: Codable, Hashable, Identifiable {
    var label: String
    var done: Int
    var goal: Int

    var id: String { label }
}

struct Today: Codable {
    var date: String
    var wins: Int
    var losses: Int
    var minutes: Int
    var running: Running?
    var plan: [PlanBlock]
    var block: PlanBlock?
    var tasks: [TodayTask]
    var working: Working?
    var focus: [String]
    var lesson: String?
    var targets: [DayTarget]
    var slept: Int?
    var habits: [String]
    var categories: [String]
}

struct Glance: Codable {
    var wins: Int
    var losses: Int
    var minutes: Int
    var running: Running?
    var block: PlanBlock?

    static let sample = Glance(
        wins: 3, losses: 0, minutes: 135,
        running: Running(category: "Study", startedAt: Date().addingTimeInterval(-23 * 60)),
        block: PlanBlock(title: "Exercise", category: "Exercise", start: "17:00", end: "18:00", now: false)
    )
}

// Every action answers with a line to show.
struct Reply: Codable {
    var ok: Bool
    var say: String
}
