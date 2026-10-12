import { fetchTopWinLabels } from "../../lib/api";

// The wins you log most, as chips on Today and in the capture sheet. The
// last list that loaded is kept (in memory, and on the phone), so the chips
// are there straight away and with no signal, then refreshed when they can be.
const KEY = "hub.win-labels.v1";
const known = new Map();

function storageKey(userId) {
  return `${KEY}.${userId}`;
}

export function knownWinLabels(userId) {
  if (!userId) return [];
  if (known.has(userId)) return known.get(userId);
  let labels = [];
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "null");
    if (Array.isArray(saved)) labels = saved.filter((l) => typeof l === "string");
  } catch (err) {
    console.warn(err);
  }
  known.set(userId, labels);
  return labels;
}

export async function loadWinLabels(userId) {
  const labels = await fetchTopWinLabels(userId);
  known.set(userId, labels);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(labels));
  } catch (err) {
    console.warn(err);
  }
  return labels;
}
