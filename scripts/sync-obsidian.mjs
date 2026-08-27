#!/usr/bin/env node
//
// Pushes tagged notes from an Obsidian vault into Personal Hub.
//
// WHY A PUSH SCRIPT AND NOT THE LOCAL REST API: the vision doc suggests
// Obsidian's Local REST API plugin, but that serves http://127.0.0.1 on this
// Mac only. The app runs on Vercel over HTTPS and gets used from an iPhone —
// the phone can't reach this machine's localhost at all, and even in a
// browser here, an HTTPS page calling HTTP-localhost is blocked as mixed
// content. So the vault pushes to Supabase instead of the app pulling, and
// every device sees the notes because they live in the cloud.
//
// Usage:
//   node scripts/sync-obsidian.mjs --vault ~/Obsidian/MyVault --tag hub
//
// Auth: set HUB_EMAIL and HUB_PASSWORD in scripts/.env.local (gitignored).
// The script signs in as you, so every row lands under your user_id and the
// same RLS that protects the app protects this.

import { createClient } from "@supabase/supabase-js";
import { readFile, readdir, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative, extname } from "node:path";
import { parseScriptureRefs } from "../src/lib/scripture.js";

const SUPABASE_URL = "https://bfednxteqhjljqdfdvsq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZWRueHRlcWhqbGpxZGZkdnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NTM1NTgsImV4cCI6MjEwMzQyOTU1OH0.Tft8vrFtjWnM-gVWD40IZVnrRqS99ivPq8W7H4qi50M";

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const VAULT = arg("vault");
const TAG = arg("tag", "hub");
const DRY_RUN = process.argv.includes("--dry-run");

if (!VAULT) {
  console.error("Usage: node scripts/sync-obsidian.mjs --vault <path-to-vault> [--tag hub] [--dry-run]");
  process.exit(1);
}

// --- frontmatter + body ----------------------------------------------------

// Minimal YAML frontmatter reader — only the scalar and inline-list shapes
// Obsidian actually writes for the fields we care about.
function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { meta: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end === -1) return { meta: {}, body: raw };

  const block = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  const meta = {};

  for (const line of block.split("\n")) {
    const m = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const [, key, valueRaw] = m;
    let value = valueRaw.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      value = value.replace(/^["']|["']$/g, "");
    }
    meta[key.toLowerCase()] = value;
  }
  return { meta, body };
}

function collectTags(meta, body) {
  const tags = new Set();
  const metaTags = meta.tags ?? meta.tag;
  if (Array.isArray(metaTags)) metaTags.forEach((t) => tags.add(String(t).replace(/^#/, "").toLowerCase()));
  else if (metaTags) String(metaTags).split(/[\s,]+/).forEach((t) => t && tags.add(t.replace(/^#/, "").toLowerCase()));
  for (const m of body.matchAll(/(?:^|\s)#([A-Za-z0-9_\/-]+)/g)) tags.add(m[1].toLowerCase());
  return [...tags];
}

// Come, Follow Me and General Conference get their own source kinds so the
// app can group a year of study by where it came from (doc §4.4).
function inferSource(meta, tags, body, title) {
  const declared = String(meta.source ?? "").toLowerCase();
  if (["scripture", "conference", "come_follow_me", "other"].includes(declared)) return declared;

  const haystack = `${tags.join(" ")} ${title}`.toLowerCase();
  if (/\b(cfm|come-follow-me|comefollowme|come_follow_me)\b/.test(haystack)) return "come_follow_me";
  if (/\b(conference|genconf|general-conference)\b/.test(haystack)) return "conference";
  if (parseScriptureRefs(`${title}\n${body}`).length > 0) return "scripture";
  return "other";
}

function isoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue; // .obsidian, .trash, .git
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (extname(entry.name) === ".md") yield full;
  }
}

// --- main ------------------------------------------------------------------

async function main() {
  const email = process.env.HUB_EMAIL;
  const password = process.env.HUB_PASSWORD;
  if (!email || !password) {
    console.error("Set HUB_EMAIL and HUB_PASSWORD (see scripts/README.md).");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    console.error("Sign-in failed:", authError.message);
    process.exit(1);
  }
  const userId = auth.user.id;

  let scanned = 0;
  let matched = 0;
  let written = 0;
  let skipped = 0;

  for await (const path of walk(VAULT)) {
    scanned += 1;
    const raw = await readFile(path, "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const tags = collectTags(meta, body);
    if (!tags.includes(TAG.toLowerCase())) continue;
    matched += 1;

    const relPath = relative(VAULT, path);
    const title = meta.title || relPath.split("/").pop().replace(/\.md$/, "");
    const hash = createHash("sha256").update(body).digest("hex");
    const stats = await stat(path);
    const studiedOn = isoDate(meta.date) ?? isoDate(stats.mtime) ?? new Date().toISOString().slice(0, 10);
    const refs = parseScriptureRefs(`${title}\n${body}`);

    // Unchanged since last sync? Leave it alone — re-writing would clear the
    // distillation for no reason and cost an AI call to redo.
    const { data: existing } = await supabase
      .from("study_notes")
      .select("id, content_hash")
      .eq("user_id", userId)
      .eq("obsidian_uid", relPath)
      .maybeSingle();

    if (existing && existing.content_hash === hash) {
      skipped += 1;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry-run] would ${existing ? "update" : "insert"}: ${relPath} (${refs.length} refs)`);
      written += 1;
      continue;
    }

    const row = {
      user_id: userId,
      title,
      body,
      source_kind: inferSource(meta, tags, body, title),
      source_ref: meta.ref || refs[0]?.rawRef || null,
      studied_on: studiedOn,
      tags,
      obsidian_uid: relPath,
      obsidian_path: path,
      content_hash: hash,
      synced_at: new Date().toISOString(),
      // Edited note: clear the old distillation so it gets reprocessed
      // against the new text rather than describing a version that's gone.
      ai_theme: null,
      ai_summary: null,
      ai_key_points: null,
      ai_processed_at: null,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error: saveError } = existing
      ? await supabase.from("study_notes").update(row).eq("id", existing.id).select("id").single()
      : await supabase.from("study_notes").insert(row).select("id").single();

    if (saveError) {
      console.error(`  ✗ ${relPath}: ${saveError.message}`);
      continue;
    }

    await supabase.from("scripture_refs").delete().eq("entity_type", "study_note").eq("entity_id", saved.id);
    if (refs.length > 0) {
      await supabase.from("scripture_refs").insert(
        refs.map((r) => ({
          user_id: userId,
          entity_type: "study_note",
          entity_id: saved.id,
          book: r.book,
          chapter: r.chapter,
          verse_start: r.verseStart,
          verse_end: r.verseEnd,
          raw_ref: r.rawRef,
        }))
      );
    }

    written += 1;
    console.log(`  ✓ ${relPath}${refs.length ? ` (${refs.map((r) => r.rawRef).join(", ")})` : ""}`);
  }

  console.log(
    `\nScanned ${scanned} notes · ${matched} tagged #${TAG} · ${written} written · ${skipped} unchanged`
  );

  if (written > 0 && !DRY_RUN) {
    console.log("Run distillation next:  node scripts/distill-notes.mjs");
  }

  await supabase.auth.signOut();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
