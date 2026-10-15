import { todayStr, addDays } from "../../lib/planDates";

// When the evening starts, and when a night ends.
//
// From seven, Today turns toward the evening reflection. Before four in the
// morning it's still last night: a reflection written at half past midnight
// is about the day you just lived, so the evening opens on yesterday.
export const EVENING_HOUR = 19;
export const LATE_NIGHT_HOUR = 4;

export function eveningDate(now = new Date()) {
  const today = todayStr();
  return now.getHours() < LATE_NIGHT_HOUR ? addDays(today, -1) : today;
}

export function isEvening(now = new Date()) {
  return now.getHours() >= EVENING_HOUR;
}

export function isLateNight(now = new Date()) {
  return now.getHours() < LATE_NIGHT_HOUR;
}

// From eight in the evening until the small hours, the timer offers Going
// to bed: stop what's running and start Sleep in one tap.
export const BEDTIME_HOUR = 20;

export function isBedtime(now = new Date()) {
  return now.getHours() >= BEDTIME_HOUR || now.getHours() < LATE_NIGHT_HOUR;
}
