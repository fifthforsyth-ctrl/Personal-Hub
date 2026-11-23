// Voice: record on this device, words come back from ElevenLabs through the
// Hub's `watch` function (the same one the watch app uses). The ElevenLabs
// key stays in the function's secrets; this file only ever sends audio.

import { supabase } from "./supabaseClient";

// What MediaRecorder can make here. iPhone Safari records mp4/aac; Chrome
// and Firefox record webm/opus. ElevenLabs takes either.
export function recordingType() {
  if (typeof MediaRecorder === "undefined") return null;
  for (const t of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported?.(t)) return t;
  }
  return "";
}

export const canRecord = () =>
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && recordingType() !== null;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function callWatch(payload) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error("You need to be signed in.");
  const res = await fetch(`${supabase.supabaseUrl}/functions/v1/watch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: supabase.supabaseKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  if (!body) throw new Error(`Voice didn't answer (${res.status}).`);
  if (body.ok === false && !body.heard) throw new Error(body.say || "Voice didn't work. Try again.");
  return body;
}

// Audio -> the words you said.
export async function transcribeBlob(blob) {
  const body = await callWatch({ api: "listen", audio: await blobToBase64(blob), mime: blob.type || "audio/mp4" });
  return String(body.text ?? "").trim();
}

// Audio (or typed words) -> done, plus { heard, say, ask, audio } to show and
// play. history is the conversation so far ([{ heard, say }]), so an answer
// to the Hub's question finishes the first ask; ask is true when the Hub is
// asking something back.
export async function voiceCommand({ blob, text, speak = true, history }) {
  const payload = { api: "voice", speak: speak ? "yes" : "no" };
  if (history?.length) payload.history = history.slice(-6).map((t) => ({ heard: t.heard, say: t.say }));
  if (text) payload.text = text;
  else {
    payload.audio = await blobToBase64(blob);
    payload.mime = blob.type || "audio/mp4";
  }
  return callWatch(payload);
}

// iPhones only play sound that a tap started. unlockAudio() runs inside the
// tap (the mic button) and opens a sound channel that stays open, so the
// spoken answer can play when it arrives seconds later.
let ctx = null;
export function unlockAudio() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    // A moment of silence, which is what actually unlocks it on iOS.
    const src = ctx.createBufferSource();
    src.buffer = ctx.createBuffer(1, 1, 22050);
    src.connect(ctx.destination);
    src.start(0);
    return ctx;
  } catch {
    return null;
  }
}
export const audioContext = () => ctx;

let playing = null;
export function stopReply() {
  try {
    playing?.stop?.();
    playing?.pause?.();
  } catch {
    // already done
  }
  playing = null;
}

// Plays the answer and resolves when it's finished (or couldn't play).
export async function playReply(b64) {
  if (!b64) return;
  stopReply();
  if (ctx) {
    try {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const buf = await ctx.decodeAudioData(bytes.buffer);
      await new Promise((resolve) => {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.onended = resolve;
        playing = src;
        src.start(0);
      });
      return;
    } catch {
      // fall through to a plain audio element
    }
  }
  await new Promise((resolve) => {
    const a = new Audio(`data:audio/mpeg;base64,${b64}`);
    playing = a;
    a.onended = resolve;
    a.onerror = resolve;
    a.play().catch(resolve);
  });
}

export function playBase64Mp3(b64) {
  if (!b64) return null;
  const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
  audio.play().catch(() => {});
  return audio;
}

// Add spoken words to what's already typed, with a space or a new line.
export function appendWords(current, words) {
  const said = String(words ?? "").trim();
  if (!said) return current ?? "";
  const now = String(current ?? "");
  if (!now.trim()) return said;
  return /\s$/.test(now) ? now + said : `${now} ${said}`;
}
