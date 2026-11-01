import SwiftUI
import WidgetKit

// The complication: the running timer if there is one, else today's wins
// and what's next in the plan. Tapping it opens the app.

struct GlanceEntry: TimelineEntry {
    let date: Date
    let glance: Glance?
}

struct GlanceProvider: TimelineProvider {
    private let cacheKey = "hub.glance.v1"

    func placeholder(in context: Context) -> GlanceEntry {
        GlanceEntry(date: Date(), glance: .sample)
    }

    func getSnapshot(in context: Context, completion: @escaping (GlanceEntry) -> Void) {
        if context.isPreview {
            completion(placeholder(in: context))
            return
        }
        Task {
            completion(GlanceEntry(date: Date(), glance: await load()))
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<GlanceEntry>) -> Void) {
        Task {
            let entry = GlanceEntry(date: Date(), glance: await load())
            // The app asks for a fresh one whenever you tap something; this
            // keeps it current the rest of the time.
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }

    private func load() async -> Glance? {
        if let fresh = try? await HubAPI.shared.glance() {
            if let data = try? HubAPI.encoder.encode(fresh) {
                UserDefaults.standard.set(data, forKey: cacheKey)
            }
            return fresh
        }
        guard let data = UserDefaults.standard.data(forKey: cacheKey) else { return nil }
        return try? HubAPI.decoder.decode(Glance.self, from: data)
    }
}

struct HubWidgetView: View {
    @Environment(\.widgetFamily) private var family
    let entry: GlanceEntry

    private var g: Glance? { entry.glance }

    var body: some View {
        switch family {
        case .accessoryCircular: circular
        case .accessoryInline: inline
        case .accessoryCorner: corner
        default: rectangular
        }
    }

    private var circular: some View {
        ZStack {
            AccessoryWidgetBackground()
            if let run = g?.running {
                VStack(spacing: 0) {
                    Image(systemName: "timer").font(.caption2)
                    Text(run.startedAt, style: .timer)
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .monospacedDigit()
                        .multilineTextAlignment(.center)
                        .minimumScaleFactor(0.6)
                }
                .padding(4)
            } else {
                VStack(spacing: 0) {
                    Text("⚔").font(.system(size: 14))
                    Text("\(g?.wins ?? 0)").font(.system(size: 18, weight: .semibold, design: .rounded))
                }
            }
        }
    }

    private var inline: some View {
        Group {
            if let run = g?.running {
                Text("\(run.category) ") + Text(run.startedAt, style: .timer)
            } else if let g {
                Text("⚔ \(g.wins) · \(Format.minutes(g.minutes))")
            } else {
                Text("Hub")
            }
        }
    }

    private var corner: some View {
        Group {
            if let run = g?.running {
                Image(systemName: "timer")
                    .font(.title3)
                    .widgetLabel { Text(run.startedAt, style: .timer) }
            } else {
                Text("⚔\(g?.wins ?? 0)")
                    .font(.system(size: 16, weight: .semibold, design: .rounded))
                    .widgetLabel { Text(g.map { Format.minutes($0.minutes) } ?? "Hub") }
            }
        }
    }

    private var rectangular: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let run = g?.running {
                HStack(spacing: 4) {
                    Image(systemName: "timer")
                    Text(run.category).lineLimit(1)
                }
                .font(.headline)
                Text(run.startedAt, style: .timer)
                    .font(.system(.title3, design: .rounded).weight(.semibold))
                    .monospacedDigit()
            } else {
                Text(g.map { Format.winsLine($0.wins, $0.losses) } ?? "Hub")
                    .font(.headline)
                Text(g.map { "\(Format.minutes($0.minutes)) tracked" } ?? "Open to load")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            if let b = g?.block {
                Text(b.now == true ? "Now: \(b.title)" : "\(Format.clock(b.start)) \(b.title)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

struct HubWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "HubGlance", provider: GlanceProvider()) { entry in
            HubWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color.clear }
                .widgetURL(URL(string: entry.glance?.running != nil ? "hubwatch://minutes" : "hubwatch://today"))
        }
        .configurationDisplayName("Hub")
        .description("Your timer, wins and what's next.")
        .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryInline, .accessoryCorner])
    }
}

@main
struct HubWidgetBundle: WidgetBundle {
    var body: some Widget {
        HubWidget()
    }
}
