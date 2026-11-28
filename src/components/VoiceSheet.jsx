import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, Square, Loader2, X, Send, Plus, Volume2 } from "lucide-react";
import { canRecord, recordingType, voiceCommand, playReply, stopReply, unlockAudio, audioContext } from "../lib/voice";
import { haptic } from "../lib/haptics";
import { announceChange } from "./today/announce";
import "../styles/voice.css";

// Talk to the Hub, from the mic in the tab bar.
//
// Tap the mic and say it: "stop my last task and start Forsyth Media", "I'm
// going to bed", "add a $25.50 purchase under personal, it was groceries",
// "add laundry to my clipboard". It stops by itself when you stop talking
// (or tap to send), the Hub does it, and the answer is spoken back. When the
// Hub needs more ("How much was it?") it listens again on its own, and your
// answer goes back with the conversation so it can finish the job.
//
// Capture (Win, Loss, Minutes, Thought) is one tap away at the bottom, for
// when typing or tapping is quicker than talking.

// Quiet for this long after you've said something, and it sends.
const QUIET_MS = 1600;
const LOUD = 0.012; // RMS that counts as speech
const MAX_SECONDS = 60;

// Takes the whole screen, with the X at the top to leave (Aaron,
// 2026-11-23). In the Clean slate look the mic is the screen: a large black
// circle in the middle with one word under it for what's happening, which
// steps down to make room once there's a conversation above it. Opened from the mic in the tab bar, whose tap already called unlockAudio()
// so the answer can play out loud.
export default function VoiceSheet({ onClose, onCapture }) {
  const [turns, setTurns] = useState([]); // { heard, say, ok }
  const [phase, setPhase] = useState("idle"); // idle | recording | working | speaking
  const [error, setError] = useState("");
  const [typed, setTyped] = useState("");
  const rec = useRef(null);
  const watch = useRef(null);
  const alive = useRef(true);
  const turnsRef = useRef(turns);
  turnsRef.current = turns;
  const listRef = useRef(null);

  const supported = canRecord();

  const release = () => {
    clearInterval(watch.current);
    watch.current = null;
    rec.current?.stream?.getTracks().forEach((t) => t.stop());
    try {
      rec.current?.meter?.disconnect();
    } catch {
      // gone
    }
  };

  // Every callback below reads refs and state setters only, so it doesn't
  // matter which render's copy runs.
  async function send({ blob, text }) {
    setPhase("working");
    setError("");
    try {
      // Spoken in, spoken back; typed in, words back (no audio, no listening
      // again).
      const r = await voiceCommand({ blob, text, speak: !text, history: turnsRef.current.filter((t) => t.ok !== false) });
      if (!alive.current) return;
      const turn = { heard: r.heard || text || "", say: r.say || "", ok: r.ok !== false };
      setTurns((all) => [...all, turn]);
      if (r.did?.length) announceChange();
      haptic(turn.ok ? "success" : "warning");
      if (r.audio) {
        setPhase("speaking");
        await playReply(r.audio);
      }
      if (!alive.current) return;
      // A question back: listen for the answer straight away.
      if (r.ask && supported && !text) start();
      else setPhase("idle");
    } catch (err) {
      if (!alive.current) return;
      haptic("warning");
      setError(err?.message || "That didn't work. Try again.");
      setPhase("idle");
    }
  }

  async function start() {
    setError("");
    stopReply();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      const type = recordingType();
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      const chunks = [];
      r.ondataavailable = (e) => e.data?.size && chunks.push(e.data);
      r.onstop = () => {
        release();
        if (!alive.current) return;
        const blob = new Blob(chunks, { type: r.mimeType || type || "audio/mp4" });
        // Sent even when the level meter heard nothing: on some phones the
        // meter reads silence while the recording is fine, and ElevenLabs
        // says so if there really was nothing.
        if (blob.size < 500) {
          setPhase("idle");
          setError("Too short. Tap and speak.");
          return;
        }
        send({ blob });
      };
      r.heardSpeech = false;
      rec.current = r;
      r.start();
      setPhase("recording");
      haptic("tap");

      // Listen to the level, so it sends when you stop talking.
      const ac = audioContext();
      let meter = null;
      if (ac && ac.state === "running") {
        try {
          const srcNode = ac.createMediaStreamSource(stream);
          meter = ac.createAnalyser();
          meter.fftSize = 1024;
          srcNode.connect(meter);
          r.meter = srcNode;
        } catch {
          meter = null;
        }
      }
      const samples = meter ? new Float32Array(meter.fftSize) : null;
      const began = Date.now();
      let lastLoud = 0;
      watch.current = setInterval(() => {
        if (r.state !== "recording") return;
        const now = Date.now();
        if (meter) {
          meter.getFloatTimeDomainData(samples);
          let sum = 0;
          for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
          if (Math.sqrt(sum / samples.length) > LOUD) {
            r.heardSpeech = true;
            lastLoud = now;
          }
          if (r.heardSpeech && now - lastLoud > QUIET_MS) r.stop();
          // Nothing heard at all in 12 seconds: stop and send what there is.
          if (!r.heardSpeech && now - began > 12000) r.stop();
        } else {
          r.heardSpeech = true; // can't tell; trust the tap
        }
        if (now - began > MAX_SECONDS * 1000) r.stop();
      }, 100);
    } catch (err) {
      release();
      setPhase("idle");
      setError(err?.name === "NotAllowedError" ? "The Hub needs the microphone. Allow it in Settings for this app." : "Couldn't start the microphone.");
    }
  }

  function stop() {
    if (rec.current?.state === "recording") {
      rec.current.heardSpeech = true; // you tapped send: send it
      rec.current.stop();
    }
  }

  // Opening the sheet is the tap: start listening right away.
  useEffect(() => {
    alive.current = true;
    if (supported) start();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      alive.current = false;
      window.removeEventListener("keydown", onKey);
      if (rec.current?.state === "recording") {
        rec.current.onstop = null;
        rec.current.stop();
      }
      release();
      stopReply();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo?.({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length, phase]);

  const tapMic = () => {
    unlockAudio();
    if (phase === "recording") stop();
    else if (phase === "speaking") {
      stopReply();
      start();
    } else if (phase === "idle") start();
  };

  const submit = (e) => {
    e.preventDefault();
    const text = typed.trim();
    if (!text || phase === "working") return;
    unlockAudio();
    if (rec.current?.state === "recording") {
      rec.current.onstop = null;
      rec.current.stop();
      release();
    }
    stopReply();
    setTyped("");
    send({ text });
  };

  const [status, hint] = {
    recording: ["Listening", "It sends when you stop talking."],
    working: ["Working on it", ""],
    speaking: ["Answering", "Tap the mic to answer or say more."],
    idle: turns.length ? ["Say more", "Tap the mic."] : ["Speak to the Hub", "Tap the mic and say what you want done."],
  }[phase];

  // On the page itself, not inside the tab bar, whose blur would trap a
  // fixed backdrop.
  return createPortal(
    <div className={"voice-full" + (turns.length ? " voice-full--talking" : "")} role="dialog" aria-modal="true" aria-label="Speak to the Hub">
      <div className="voice-full__head">
        <button className="voice-full__close" onClick={onClose} aria-label="Close" title="Close">
          <X size={20} />
        </button>
      </div>

      <div className="voice-sheet__talk" ref={listRef}>
        {turns.map((t, i) => (
          <div key={i} className="voice-turn">
            {t.heard && <p className="voice-turn__you">{t.heard}</p>}
            {t.say && <p className={"voice-turn__hub" + (t.ok ? "" : " voice-turn__hub--off")}>{t.say}</p>}
          </div>
        ))}
      </div>

      <div className="voice-sheet__mic">
        {supported && (
          <button
            type="button"
            className={"voice-orb" + (phase === "recording" ? " voice-orb--on" : "")}
            onClick={tapMic}
            disabled={phase === "working"}
            aria-label={phase === "recording" ? "Send" : "Speak"}
          >
            {phase === "working" ? <Loader2 className="voice-spin" /> : phase === "recording" ? <Square className="voice-orb__stop" /> : phase === "speaking" ? <Volume2 /> : <Mic />}
          </button>
        )}
        <p className="voice-sheet__status" aria-live="polite">
          {supported ? status : "Type it below"}
        </p>
        <p className="voice-sheet__hint">{supported ? hint : "This browser can't record."}</p>
        {error && <p className="voice-error">{error}</p>}
      </div>

      <form className="voice-talk__row voice-sheet__type" onSubmit={submit}>
        <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Or type it" aria-label="Type it instead" maxLength={500} />
        <button type="submit" className="voice-sheet__send" disabled={!typed.trim() || phase === "working"} aria-label="Send">
          <Send size={18} />
        </button>
      </form>

      {onCapture && (
        <button type="button" className="voice-sheet__capture" onClick={onCapture}>
          <Plus size={15} />
          Log a win, loss, minutes or a thought by tapping
        </button>
      )}
    </div>,
    document.body
  );
}
