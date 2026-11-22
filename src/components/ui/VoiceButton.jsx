import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";
import { canRecord, recordingType } from "../../lib/voice";
import { haptic } from "../../lib/haptics";
import "../../styles/voice.css";

// Hold a conversation with the mic: tap to start, tap to stop. The recording
// goes to `onAudio(blob)`, which does whatever this button is for (turn it
// into words for a journal box, or run it as a command). While that runs the
// button spins; whatever it throws shows under the button.
//
// A recording stops itself after `maxSeconds` so a forgotten mic doesn't run
// all night.
export function useRecorder({ onAudio, maxSeconds = 180 }) {
  const [state, setState] = useState("idle"); // idle | recording | working
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(0);
  const rec = useRef(null);
  const timer = useRef(null);

  const cleanup = () => {
    clearInterval(timer.current);
    timer.current = null;
    rec.current?.stream?.getTracks().forEach((t) => t.stop());
  };
  useEffect(() => () => {
    if (rec.current?.state === "recording") {
      rec.current.onstop = null;
      rec.current.stop();
    }
    cleanup();
  }, []);

  async function start() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = recordingType();
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      r.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
      r.onstop = async () => {
        cleanup();
        const blob = new Blob(chunks, { type: r.mimeType || type || "audio/mp4" });
        if (blob.size < 500) {
          setState("idle");
          setError("Too short. Tap, speak, then tap again.");
          return;
        }
        setState("working");
        try {
          await onAudio(blob);
          haptic("success");
        } catch (err) {
          haptic("warning");
          setError(err?.message || "That didn't work. Try again.");
        } finally {
          setState("idle");
        }
      };
      r.stream = stream;
      rec.current = r;
      r.start();
      setSeconds(0);
      setState("recording");
      haptic("tap");
      const began = Date.now();
      timer.current = setInterval(() => {
        const s = Math.floor((Date.now() - began) / 1000);
        setSeconds(s);
        if (s >= maxSeconds && r.state === "recording") r.stop();
      }, 250);
    } catch (err) {
      cleanup();
      setState("idle");
      setError(err?.name === "NotAllowedError" ? "The Hub needs the microphone. Allow it in your browser settings." : "Couldn't start the microphone.");
    }
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  return { state, error, seconds, start, stop, toggle: () => (state === "recording" ? stop() : state === "idle" ? start() : null) };
}

const clock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function VoiceButton({ onAudio, label = "Speak", busyLabel = "Writing it down…", className = "", maxSeconds }) {
  const { state, error, seconds, toggle } = useRecorder({ onAudio, maxSeconds });
  if (!canRecord()) return null;
  const recording = state === "recording";
  const working = state === "working";
  return (
    <div className={`voice ${className}`}>
      <button
        type="button"
        className={`voice-btn${recording ? " voice-btn--on" : ""}`}
        onClick={toggle}
        disabled={working}
        aria-pressed={recording}
        aria-label={recording ? "Stop recording" : label}
      >
        {working ? <Loader2 size={14} className="voice-spin" /> : recording ? <Square size={12} /> : <Mic size={14} />}
        <span>{working ? busyLabel : recording ? `Stop · ${clock(seconds)}` : label}</span>
      </button>
      {error && <span className="voice-error">{error}</span>}
    </div>
  );
}
