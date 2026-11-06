import { supabase } from "./supabaseClient";

// Notifications on this phone or computer (Web Push).
//
// On an iPhone they work only in the Hub added to the Home Screen (iOS 16.4
// or later), never in Safari itself, and only after a tap on "Turn on
// notifications" there. Each device turns them on once; the subscription is
// kept in push_subscriptions and the love-push function sends to it.

// The public half of the VAPID key pair (the private half is a Supabase
// secret). Safe to ship: it only lets the push service check our signature.
export const VAPID_PUBLIC_KEY = "BOBDXKVdOpgY7QVMjaCYUkne6vsk2RieYXar1FWZK9u5ejevbGWoti4MKN3kyWKqjU70-F1VkN3JRKXW2X8V2LU";

export function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

export function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

// "on", "off", "denied", "needs-home-screen" or "unsupported".
export async function pushState() {
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (!supported) return isIOS() && !isStandalone() ? "needs-home-screen" : "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function keyBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function deviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Mac/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  return "Browser";
}

// Must run straight from a tap: iPhone only asks from one.
export async function turnOnPush(userId) {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID_PUBLIC_KEY) });
  const json = sub.toJSON();
  const { error } = await supabase.from("push_subscriptions").upsert(
    { user_id: userId, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, device: deviceName(), failed_at: null },
    { onConflict: "endpoint" }
  );
  if (error) throw error;
  return "on";
}

export async function turnOffPush() {
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}

export async function sendTestPush() {
  const { data: s } = await supabase.auth.getSession();
  const token = s?.session?.access_token;
  if (!token) throw new Error("You need to be signed in.");
  const res = await fetch(`${supabase.supabaseUrl}/functions/v1/love-push`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, apikey: supabase.supabaseKey, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "test" }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || `The test didn't go (${res.status}).`);
  return body;
}
