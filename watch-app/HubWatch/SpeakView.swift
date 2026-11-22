import AVFoundation
import SwiftUI
import WatchKit
import WidgetKit

// Say anything to the Hub: "record a $25 personal purchase for groceries",
// "add milk, eggs and call Dad to my clipboard", "start Plugin", "win, up at
// 4:30". Tap to talk, tap to send. The Hub turns it into words (ElevenLabs),
// does it, and answers out loud on the watch.
struct SpeakView: View {
    @EnvironmentObject var store: HubStore
    @StateObject private var voice = VoiceRecorder()

    var body: some View {
        ScrollView {
            VStack(spacing: 8) {
                Button {
                    Task { await tapped() }
                } label: {
                    ZStack {
                        Circle()
                            .fill(voice.recording ? Color.orange : Color.white.opacity(0.15))
                            .frame(width: 84, height: 84)
                        if voice.working {
                            ProgressView()
                        } else {
                            Image(systemName: voice.recording ? "stop.fill" : "mic.fill")
                                .font(.system(size: 30, weight: .semibold))
                                .foregroundStyle(voice.recording ? .black : .white)
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(voice.working)

                Text(voice.recording ? "Listening… tap to send" : voice.working ? "Working…" : "Tap and speak")
                    .font(.footnote)
                    .foregroundStyle(.secondary)

                if !voice.heard.isEmpty {
                    Text("“\(voice.heard)”")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                if !voice.said.isEmpty {
                    Text(voice.said)
                        .font(.footnote)
                        .multilineTextAlignment(.center)
                }
            }
            .frame(maxWidth: .infinity)
        }
        .navigationTitle("Speak")
        .onDisappear { voice.cancel() }
    }

    private func tapped() async {
        if voice.recording {
            await voice.finishAndSend()
            WidgetCenter.shared.reloadAllTimelines()
            await store.refresh()
        } else {
            await voice.start()
        }
    }
}

@MainActor
final class VoiceRecorder: NSObject, ObservableObject, AVAudioPlayerDelegate {
    @Published var recording = false
    @Published var working = false
    @Published var heard = ""
    @Published var said = ""

    private var recorder: AVAudioRecorder?
    private var player: AVAudioPlayer?
    private var limit: Task<Void, Never>?
    private let file = FileManager.default.temporaryDirectory.appendingPathComponent("hub-voice.m4a")

    func start() async {
        heard = ""
        said = ""
        guard await AVAudioApplication.requestRecordPermission() else {
            said = "The Hub needs the microphone: Settings > Privacy & Security > Microphone > Hub."
            WKInterfaceDevice.current().play(.failure)
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .default)
            try session.setActive(true)
            let settings: [String: Any] = [
                AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
                AVSampleRateKey: 16_000,
                AVNumberOfChannelsKey: 1,
                AVEncoderAudioQualityKey: AVAudioQuality.medium.rawValue,
            ]
            try? FileManager.default.removeItem(at: file)
            let r = try AVAudioRecorder(url: file, settings: settings)
            guard r.record() else { throw HubError.hub("Couldn't start the microphone.") }
            recorder = r
            recording = true
            WKInterfaceDevice.current().play(.start)
            // A minute at most, then it sends itself.
            limit = Task { [weak self] in
                try? await Task.sleep(nanoseconds: 60_000_000_000)
                guard let self, self.recording else { return }
                await self.finishAndSend()
            }
        } catch {
            said = error.localizedDescription
            WKInterfaceDevice.current().play(.failure)
        }
    }

    func cancel() {
        limit?.cancel()
        recorder?.stop()
        recorder = nil
        recording = false
    }

    func finishAndSend() async {
        limit?.cancel()
        guard let r = recorder else { return }
        r.stop()
        recorder = nil
        recording = false
        working = true
        defer { working = false }
        WKInterfaceDevice.current().play(.stop)
        do {
            let audio = try Data(contentsOf: file)
            let reply = try await HubAPI.shared.voice(audio: audio, mime: "audio/m4a")
            heard = reply.heard ?? ""
            said = reply.say
            WKInterfaceDevice.current().play(reply.ok ? .success : .failure)
            if let b64 = reply.audio, let mp3 = Data(base64Encoded: b64) { play(mp3) }
        } catch {
            said = error.localizedDescription
            WKInterfaceDevice.current().play(.failure)
        }
    }

    private func play(_ mp3: Data) {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playback, mode: .spokenAudio)
            try session.setActive(true)
            let p = try AVAudioPlayer(data: mp3)
            p.delegate = self
            player = p
            p.play()
        } catch {
            // The words are on screen either way.
        }
    }

    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
