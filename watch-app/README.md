# Hub for Apple Watch

A small watch app for the Hub, so the watch doesn't need the Shortcuts app
(whose iCloud sync can break and leave the watch with nothing).

- **Today**: where you are in today's plan, what's next, what you're working
  on, Today's tasks (tap one to finish it), this week's focus goals and the
  lesson you're learning, with wins, minutes and daily targets kept small.
- **Minutes**: the running timer, big, with Stop, and every category to start
  or switch to.
- **Wins**: one tap per habit, or say a win, a loss or a note.
- **Complication**: the running timer, or today's wins and what's next. Tap it
  to open the app.

It talks to the Hub's `watch` function (`supabase/functions/watch`, the `api`
calls) with your watch address, which `setup.sh` keeps in
`Shared/Secrets.swift` on your Mac only.

## Install

You need Xcode (Mac App Store, or developer.apple.com/download/applications)
with watchOS added, and your Apple ID signed in under Xcode > Settings >
Accounts.

1. In the Hub on your Mac: More > On your watch > Copy address.
2. In Terminal, from this folder: `./setup.sh` (it picks the address up from
   the clipboard and opens the project in Xcode).
3. In Xcode, if asked, pick your Team under Signing & Capabilities for both
   targets (HubWatch and HubWidget).
4. On the iPhone and the watch, turn on Developer Mode (Settings > Privacy &
   Security > Developer Mode) when it appears, and restart when asked.
5. Pick your watch at the top of Xcode and press Run. The first time, trust
   the developer on the iPhone (Settings > General > VPN & Device
   Management).
6. On the watch: press and hold the face > Edit > Complications > Hub.

With a free Apple ID the app stops opening after 7 days: plug in and press
Run again. A paid Apple Developer account makes that a year.

## Changing it

The screens are SwiftUI in `HubWatch/`, the complication in `HubWidget/`,
and the shared models and network code in `Shared/`. The data comes from
`appToday` and `appGlance` in `supabase/functions/watch/index.ts`, with the
pure parts in `app.js` (tested in `scripts/test.mjs`). `./setup.sh --check`
builds without signing to check it compiles.
