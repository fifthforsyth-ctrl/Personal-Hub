# Scripts

Two scripts that run on your Mac, in this order:

1. **`sync-obsidian.mjs`** — reads your vault, pushes tagged notes to Personal Hub
2. **`distill-notes.mjs`** — reads the notes that arrived, writes back a theme + core points

They're separate on purpose: syncing is free and instant, distilling costs a
little money and takes a few seconds per note. You can sync often and distill
when you feel like it.

## One-time setup

Create `scripts/.env.local` (gitignored — it never leaves this machine):

```
HUB_EMAIL=your@email.com
HUB_PASSWORD=your-personal-hub-password
ANTHROPIC_API_KEY=sk-ant-...
```

Get the Anthropic key from [console.anthropic.com](https://console.anthropic.com/settings/keys).
You only need it for `distill-notes.mjs`; the sync script works without one.

## Running them

```bash
cd "/Users/aaronforsyth/Desktop/Personal Hub"
set -a && source scripts/.env.local && set +a

node scripts/sync-obsidian.mjs --vault ~/path/to/YourVault --tag hub
node scripts/distill-notes.mjs
```

`set -a && source ... && set +a` loads the env file into the shell so both
scripts can read it.

### Which notes get synced

Any `.md` note tagged **`#hub`** — either in the frontmatter (`tags: [hub, cfm]`)
or inline in the body. Change the tag with `--tag something-else`.

Optional frontmatter it understands:

```yaml
---
title: Alma 32 and the seed
date: 2026-08-27
source: scripture        # scripture | conference | come_follow_me | other
ref: Alma 32:28
tags: [hub, cfm]
---
```

None of it is required — the filename becomes the title, the file's modified
date becomes the study date, and the source is inferred from tags and content.

### Useful flags

| Flag | Effect |
|---|---|
| `--dry-run` | Sync: show what would change, write nothing |
| `--limit 5` | Distill: cap the batch size |
| `--redo` | Distill: re-process notes that already have a distillation |

## What to expect

- **Re-running is safe.** A note is keyed by its vault path, so editing and
  re-syncing updates it in place instead of making a duplicate. Unchanged
  notes are skipped entirely.
- **Editing a note clears its distillation** and marks it for reprocessing, so
  the theme never describes a version of the note that no longer exists.
- **Your original text is never modified.** The distillation lands in separate
  columns and is shown above the full note in the app, never instead of it.
- **Verse references are indexed on sync** — `Alma 32:21`, `D&C 88:119`,
  `2 Ne. 2:25` — which is what makes the Scripture tab work.

## Cost

Only `distill-notes.mjs` costs anything: roughly **$0.02 per note** at Claude
Opus 5 rates. Daily study for a month lands well under a dollar. Everything
else in Personal Hub is free.
