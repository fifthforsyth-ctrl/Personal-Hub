import Foundation

enum HubError: LocalizedError {
    case noAddress
    case hub(String)
    case odd

    var errorDescription: String? {
        switch self {
        case .noAddress: return "No watch address yet. Run setup.sh on your Mac, then install again."
        case .hub(let say): return say
        case .odd: return "The Hub sent something odd. Try again."
        }
    }
}

// Talks to the Hub's `watch` function, using the address (with its key)
// that setup.sh wrote into Secrets.swift.
struct HubAPI {
    static let shared = HubAPI()

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: config)
    }()

    static let decoder: JSONDecoder = {
        let d = JSONDecoder()
        d.dateDecodingStrategy = .millisecondsSince1970
        return d
    }()

    static let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.dateEncodingStrategy = .millisecondsSince1970
        return e
    }()

    private var endpoint: URL? {
        guard Secrets.watchAddress.hasPrefix("https://"),
              var parts = URLComponents(string: Secrets.watchAddress) else { return nil }
        var items = parts.queryItems ?? []
        items.removeAll { $0.name == "tz" }
        items.append(URLQueryItem(name: "tz", value: TimeZone.current.identifier))
        parts.queryItems = items
        return parts.url
    }

    private func post(_ body: [String: String]) async throws -> Data {
        guard let url = endpoint else { throw HubError.noAddress }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)
        let (data, _) = try await session.data(for: request)
        return data
    }

    private func fetch<T: Decodable>(_ type: T.Type, _ body: [String: String]) async throws -> T {
        let data = try await post(body)
        if let value = try? Self.decoder.decode(T.self, from: data) { return value }
        if let reply = try? Self.decoder.decode(Reply.self, from: data) { throw HubError.hub(reply.say) }
        throw HubError.odd
    }

    func today() async throws -> Today {
        try await fetch(Today.self, ["api": "today"])
    }

    func glance() async throws -> Glance {
        try await fetch(Glance.self, ["api": "glance"])
    }

    // start (category), stop, win / loss (label), done (id), note (text).
    func act(_ api: String, _ args: [String: String] = [:]) async throws -> Reply {
        var body = args
        body["api"] = api
        let data = try await post(body)
        if let reply = try? Self.decoder.decode(Reply.self, from: data) { return reply }
        throw HubError.odd
    }
}
