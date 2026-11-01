import Foundation

enum Format {
    // 135 -> "2h 15m", 40 -> "40m".
    static func minutes(_ m: Int) -> String {
        let h = m / 60
        let r = m % 60
        if h == 0 { return "\(r)m" }
        return r == 0 ? "\(h)h" : "\(h)h \(r)m"
    }

    // "16:30" -> "4:30".
    static func clock(_ hhmm: String) -> String {
        let bits = hhmm.split(separator: ":")
        guard bits.count >= 2, let h = Int(bits[0]) else { return hhmm }
        let h12 = h % 12 == 0 ? 12 : h % 12
        return "\(h12):\(bits[1])"
    }

    // "16:30" -> "4:30 PM", for a lone time with no plan around it.
    static func clockWithHalf(_ hhmm: String) -> String {
        let bits = hhmm.split(separator: ":")
        guard bits.count >= 2, let h = Int(bits[0]) else { return hhmm }
        return "\(clock(hhmm)) \(h < 12 ? "AM" : "PM")"
    }

    // The time now, "HH:MM", to compare with plan blocks.
    static func nowHHMM(_ date: Date = Date()) -> String {
        let c = Calendar.current.dateComponents([.hour, .minute], from: date)
        return String(format: "%02d:%02d", c.hour ?? 0, c.minute ?? 0)
    }

    static func winsLine(_ wins: Int, _ losses: Int) -> String {
        var s = "⚔ \(wins) \(wins == 1 ? "win" : "wins")"
        if losses > 0 { s += " · \(losses) \(losses == 1 ? "loss" : "losses")" }
        return s
    }
}
