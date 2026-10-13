// What went wrong, in words a person would use. Raw messages like
// "TypeError: Failed to fetch" or "Assistant failed (529)" never reach the
// screen; they go to the console for whoever is debugging.

export function isOffline(err) {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return /failed to fetch|networkerror|load failed|network request failed|fetch failed/i.test(err?.message ?? "");
}

export function friendlyError(err, fallback = "Something went wrong. Try again.") {
  if (err) console.warn(err);
  const message = err?.message ?? String(err ?? "");
  const status = err?.status ?? 0;
  if (isOffline(err)) return "No connection right now.";
  if ([429, 502, 503, 529].includes(status) || /overloaded|rate.?limit|\(529\)|\(503\)|took longer than/i.test(message)) {
    return "The assistant is busy. Try again in a minute.";
  }
  if (status === 401 || /signed in|jwt expired|invalid jwt/i.test(message)) {
    return "You've been signed out. Sign in again to keep going.";
  }
  return fallback;
}
