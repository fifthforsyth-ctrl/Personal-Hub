// Web Push with nothing but WebCrypto: the message encrypted for one browser
// (RFC 8291, aes128gcm) and signed for the push service (VAPID, RFC 8292).
// Kept free of Deno and npm so the same file is tested under Node
// (scripts/test-webpush.mjs) and run in the edge function.

const enc = new TextEncoder();

export function b64urlToBytes(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function bytesToB64url(b: Uint8Array): string {
  let bin = "";
  for (const x of b) bin += String.fromCharCode(x);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8);
  return new Uint8Array(bits);
}

// The payload encrypted for one subscription (one record, aes128gcm).
export async function encryptPayload(
  payload: Uint8Array,
  p256dhB64: string,
  authB64: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16))
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(p256dhB64);
  const authSecret = b64urlToBytes(authB64);

  const local = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey("raw", local.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, local.privateKey, 256));

  const ikm = await hkdf(authSecret, ecdh, concat(enc.encode("WebPush: info\0"), uaPublic, asPublic), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);

  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(payload, new Uint8Array([2])))
  );

  const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096);
  header[20] = asPublic.length;
  header.set(asPublic, 21);
  return concat(header, sealed);
}

// The Authorization header for a push service: a JWT signed with the
// VAPID private key, good for twelve hours.
export async function vapidAuth(endpoint: string, publicB64: string, privateB64: string, subject: string): Promise<string> {
  const pub = b64urlToBytes(publicB64);
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: privateB64,
    ext: true,
  };
  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const header = bytesToB64url(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = bytesToB64url(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject }))
  );
  const signed = `${header}.${claims}`;
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(signed)));
  return `vapid t=${signed}.${bytesToB64url(sig)}, k=${publicB64}`;
}

export type Subscription = { endpoint: string; p256dh: string; auth: string };

// Sends one message. Resolves to the push service's status: 201 is sent;
// 404 and 410 mean the subscription is gone for good.
export async function sendPush(
  sub: Subscription,
  message: unknown,
  vapid: { publicKey: string; privateKey: string; subject: string },
  fetcher: typeof fetch = fetch
): Promise<number> {
  const body = await encryptPayload(enc.encode(JSON.stringify(message)), sub.p256dh, sub.auth);
  const res = await fetcher(sub.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuth(sub.endpoint, vapid.publicKey, vapid.privateKey, vapid.subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(24 * 3600),
      Urgency: "normal",
    },
    body,
  });
  await res.arrayBuffer().catch(() => null);
  return res.status;
}
