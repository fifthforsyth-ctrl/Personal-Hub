// Anything that changes what the daily pages show says so with this event,
// and each page that's open reloads once. The capture sheet doesn't need to
// know what's under it, and nothing needs to know who's listening.
export function announceChange() {
  window.dispatchEvent(new Event("hub:changed"));
}
