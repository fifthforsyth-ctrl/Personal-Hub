# Personal Hub

> "Organize yourselves; prepare every needful thing." — D&C 88:119

A private life dashboard: time, tasks, goals, health, finances, and
spiritual life in one system, so daily discipline stays visibly connected
to who you're becoming. See `Life_Dashboard_Vision.docx` for the full
vision this is built from.

This is **not** Symposium — Symposium is community goal-sharing;
Personal Hub is private life archival, tracking, and vision centered on
Christlike discipleship. The two apps' Goal Tree is the same underlying
idea and the same ring-wheel visualization, but every table in this app is
strictly private (`auth.uid() = user_id`, no shared visibility anywhere).

## Status

**Phase 0 + Goal Tree** (of the build roadmap in the vision doc): time
log, win/loss log, prayer log, and the full goal-tree wheel (Identity/
Character → Life Themes → Goals → Sub-goals → daily actions) are built.
Planning, spiritual/Obsidian integration, health, finance, and the AI
assistant are future phases.

## Local development

```
npm install
npm run dev
```

## Setup (one-time)

1. Create the Supabase project (see `supabase/migrations/0001_init.sql`
   for the schema — apply it via the Supabase SQL editor or the CLI).
2. Fill in `src/lib/supabaseClient.js` with the project's URL and anon key.
3. `npm run dev`, go to `/signup`, create your one account.

## Deploying

Deploys to Vercel from GitHub, same as Symposium — `vercel.json` rewrites
everything to `index.html` for the client-side router.

## On your phone/iPad

Once deployed, open the URL in Safari and **Share → Add to Home Screen**.
It installs as a standalone app (own icon, no browser chrome) via the PWA
manifest in `vite.config.js`.
