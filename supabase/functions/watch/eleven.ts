// ElevenLabs: speech to text (what you said) and text to speech (what the
// Hub says back). The key lives only in the ELEVENLABS_API_KEY function
// secret; nothing on the watch or in the browser ever sees it.
//
// Optional secrets:
//   ELEVENLABS_VOICE_ID   the voice that answers (default: a calm premade
//                         male voice; any voice id from your ElevenLabs
//                         Voices page works)
//   ELEVENLABS_STT_MODEL  default scribe_v1
//   ELEVENLABS_TTS_MODEL  default eleven_flash_v2_5 (the quickest)

const BASE = "https://api.elevenlabs.io/v1";
const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb"; // "George", one of ElevenLabs' premade voices

export function elevenKey() {
  return Deno.env.get("ELEVENLABS_API_KEY")?.trim() || "";
}

export class VoiceError extends Error {}

// base64 (with or without a data: prefix) -> bytes.
export function fromBase64(b64: string) {
  const raw = b64.replace(/^data:[^,]*,/, "").replace(/\s+/g, "");
  const bin = atob(raw);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toBase64(bytes: Uint8Array) {
  let s = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

const EXT: Record<string, string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/x-m4a": "m4a",
  "audio/aac": "aac",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/mpeg": "mp3",
};

// Audio in, words out.
export async function transcribe(audio: Uint8Array, mime: string) {
  const key = elevenKey();
  if (!key) throw new VoiceError("Voice isn't set up yet: add the ELEVENLABS_API_KEY secret in Supabase.");
  if (audio.length < 200) throw new VoiceError("I didn't catch anything. Try again.");
  const type = (mime || "audio/mp4").split(";")[0].trim().toLowerCase();
  const form = new FormData();
  form.append("model_id", Deno.env.get("ELEVENLABS_STT_MODEL")?.trim() || "scribe_v1");
  form.append("tag_audio_events", "false");
  form.append("file", new Blob([audio as Uint8Array<ArrayBuffer>], { type }), `speech.${EXT[type] ?? "m4a"}`);
  const res = await fetch(`${BASE}/speech-to-text`, { method: "POST", headers: { "xi-api-key": key }, body: form });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("elevenlabs stt", res.status, detail.slice(0, 500));
    if (res.status === 401) throw new VoiceError("ElevenLabs turned the key down. Check the ELEVENLABS_API_KEY secret.");
    throw new VoiceError("ElevenLabs couldn't hear that. Try again.");
  }
  const body = await res.json().catch(() => ({}));
  return String(body?.text ?? "").replace(/\s+/g, " ").trim();
}

// Words in, an mp3 (base64) out. Null when it can't: the words still show.
export async function speak(text: string) {
  const key = elevenKey();
  const words = text.replace(/[⚔✓·]/g, " ").replace(/\s+/g, " ").trim().slice(0, 600);
  if (!key || !words) return null;
  const voice = Deno.env.get("ELEVENLABS_VOICE_ID")?.trim() || DEFAULT_VOICE;
  const res = await fetch(`${BASE}/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_64`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: words, model_id: Deno.env.get("ELEVENLABS_TTS_MODEL")?.trim() || "eleven_flash_v2_5" }),
  });
  if (!res.ok) {
    console.error("elevenlabs tts", res.status, (await res.text().catch(() => "")).slice(0, 500));
    return null;
  }
  return toBase64(new Uint8Array(await res.arrayBuffer()));
}
