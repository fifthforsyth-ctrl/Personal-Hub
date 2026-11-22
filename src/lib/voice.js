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

// Audio (or typed words) -> done, plus { heard, say, audio } to show and play.
export async function voiceCommand({ blob, text, speak = true }) {
  const payload = { api: "voice", speak: speak ? "yes" : "no" };
  if (text) payload.text = text;
  else {
    payload.audio = await blobToBase64(blob);
    payload.mime = blob.type || "audio/mp4";
  }
  return callWatch(payload);
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
