// The "Sync to Hub" bookmark: reads FamilySearch from your signed-in tab and
// sends the Hub a fresh snapshot, so the Temple page keeps itself current.
//
// It runs on www.familysearch.org, as you, with GETs only: your pedigree
// (9 generations), the temple status of everyone in it, every open
// ordinance with who holds it, and the work you've reserved that's now
// completed. Nothing in FamilySearch is reserved, changed or shared. The
// snapshot goes to the temple-sync edge function with the bookmark's key;
// if the browser won't send it there, it's saved as a file to load instead.
//
// familySearchSync is turned into the bookmark's code with toString(), so it
// must stay self-contained: no imports and nothing from outside its body.
// `cfg` carries everything it needs; `cfg.quiet` skips the on-page panel and
// `cfg.send === false` returns the snapshot without sending it (for tests).

// Bumped whenever the bookmark's code changes, so the Hub can tell you to
// make a new one (a bookmark keeps the code it was made with).
export const SYNC_VERSION = 3;

export async function familySearchSync(cfg) {
  const ROOT_FALLBACK = cfg.root || "KWBN-5QK";
  const OWNER_FALLBACK = cfg.owner || "M9MG-YS4";
  const PID = /^[A-Z0-9]{4}-[A-Z0-9]{3}$/;

  // --- A small panel in the corner, so you can see it working ------------------
  let panel = null;
  function say(text, html) {
    if (cfg.quiet) return;
    if (!panel) {
      panel = document.createElement("div");
      panel.setAttribute(
        "style",
        "position:fixed;right:16px;bottom:16px;z-index:2147483647;max-width:320px;padding:14px 16px;border-radius:14px;" +
          "background:#111;color:#fff;font:14px/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)"
      );
      document.body.appendChild(panel);
    }
    panel.textContent = "";
    const b = document.createElement("b");
    b.textContent = "Sync to Hub";
    panel.appendChild(b);
    const p = document.createElement("div");
    p.style.marginTop = "4px";
    p.textContent = text;
    panel.appendChild(p);
    if (html) panel.appendChild(html);
  }
  function closeLater(ms) {
    if (panel) setTimeout(() => panel && panel.remove(), ms);
  }

  if (!/familysearch\.org$/.test(location.hostname)) {
    say("Open FamilySearch first (signed in), then tap the bookmark there.");
    closeLater(6000);
    return null;
  }
  const tok = (document.cookie.match(/fssessionid=([^;]+)/) || [])[1];
  if (!tok) {
    say("Sign in to FamilySearch first, then tap the bookmark again.");
    closeLater(6000);
    return null;
  }

  async function get(url, accept) {
    const r = await fetch(url, { headers: { Accept: accept || "application/json", Authorization: "Bearer " + tok } });
    if (!r.ok) throw new Error(`FamilySearch said ${r.status} for ${url.split("?")[0]}`);
    return r.status === 204 ? null : r.json();
  }
  async function eachLimited(list, n, fn) {
    let i = 0;
    const workers = Array.from({ length: Math.min(n, list.length) }, async () => {
      while (i < list.length) {
        const k = i++;
        await fn(list[k], k);
      }
    });
    await Promise.all(workers);
  }

  try {
    say("Reading your tree…");
    let root = ROOT_FALLBACK;
    let owner = OWNER_FALLBACK;
    try {
      const me = await get("/platform/users/current", "application/x-fs-v1+json");
      const u = me && me.users && me.users[0];
      if (u && PID.test(u.personId || "")) root = u.personId;
      // Reservations name you by your tree user id (like M9MG-YS4), not the
      // account id (cis.user.…).
      if (u && PID.test(u.treeUserId || "")) owner = u.treeUserId;
    } catch (e) {
      // The ids from the Hub still work.
    }

    // 1. The pedigree.
    const anc = await get(`/platform/tree/ancestry?person=${root}&generations=8&personDetails=`, "application/x-fs-v1+json");
    const persons = (anc && anc.persons) || [];
    if (!persons.length) throw new Error("FamilySearch sent back an empty tree.");

    // 2. Temple status for everyone who has died.
    const dead = persons.filter((p) => !p.living).map((p) => p.id);
    const rollup = {};
    let n = 0;
    await eachLimited(dead, 4, async (id) => {
      try {
        const j = await get(`/service/tree/tree-data/v8/person/${id}/summary?includeTempleRollupStatus=true`);
        rollup[id] = (j && j.templeRollupStatus) || null;
      } catch (e) {
        rollup[id] = null;
      }
      n++;
      if (n % 20 === 0) say(`Checking temple work… ${n} of ${dead.length}`);
    });

    // 3. Every ordinance for anyone not fully done.
    const K = { baptism: "bap", confirmation: "con", initiatory: "ini", endowment: "end" };
    const holder = (x) => {
      const alt = x.alternateReservationDetails;
      if (alt && alt.ownerId && alt.ownerId !== owner) return { mine: false, reserved_by: alt.ownerName || null };
      // Only whoever holds a reservation can give it back, so canUnreserve
      // marks yours even if your id was read differently.
      if (x.owner === owner || x.canUnreserve === true) return { mine: true, reserved_by: null };
      if (!x.owner) return { mine: null, reserved_by: null };
      if (x.owner === "MMMM-MMS") return { mine: false, reserved_by: "the temple" };
      return { mine: false, reserved_by: x.ownerName || null };
    };
    const reasons = (x) => (x.whyNotQualifyingReasons || []).map((r) => (r && r.value) || String(r));
    async function readPerson(id) {
      const j = await get(
        `/service/tree/tree-data/reservations/person/${id}/ordinances?pendingTransfer=true&owner=${owner}&treeId=PRIVATE&enforceTemplePolicyEx=true`
      );
      const o = (j && j.data) || j || {};
      const out = [];
      for (const k of Object.keys(K)) {
        const x = o[k];
        if (!x || !x.status || x.status === "Completed") continue;
        out.push({ pid: id, kind: K[k], spouse_name: "", fs_status: x.status, reasons: reasons(x), ...holder(x) });
      }
      for (const [k, kind] of [
        ["sealingsToParents", "stp"],
        ["sealingsToSpouses", "sts"],
      ]) {
        const seen = new Set();
        for (const x of o[k] || []) {
          if (!x || !x.status || x.status === "Completed" || x.status === "NotAvailable") continue;
          const sp = kind === "sts" ? (x.relationships && x.relationships.spouseName) || "" : "";
          if (seen.has(sp)) continue;
          seen.add(sp);
          out.push({ pid: id, kind, spouse_name: sp, fs_status: x.status, reasons: reasons(x), ...holder(x) });
        }
      }
      return { o, out };
    }
    const ordinances = [];
    const read = new Set();
    const todo = dead.filter((id) => rollup[id] !== "COMPLETED");
    n = 0;
    await eachLimited(todo, 4, async (id) => {
      read.add(id);
      ordinances.push(...(await readPerson(id)).out);
      n++;
      if (n % 5 === 0) say(`Reading open ordinances… ${n} of ${todo.length}`);
    });

    // 3b. Everyone on your reservations, in your tree or not. The list's
    // shape isn't documented, so every person id is picked out of it: from
    // the lists this page already loaded, FamilySearch's own list address,
    // and the ids shown on the page. Each is then read like anyone else and
    // kept only if you hold one of their ordinances.
    say("Reading your reservations…");
    const found = new Set();
    const scan = (v, depth) => {
      if (depth > 8 || v == null) return;
      if (typeof v === "string") {
        if (PID.test(v)) found.add(v);
        return;
      }
      if (typeof v !== "object") return;
      for (const x of Array.isArray(v) ? v : Object.values(v)) scan(x, depth + 1);
    };
    const lists = new Set([`/service/tree/tree-data/reservations/list/${owner}`]);
    try {
      for (const e of performance.getEntriesByType("resource")) {
        const u = new URL(e.name, location.href);
        if (u.hostname === location.hostname && /reservation/i.test(u.pathname) && !/\/person\/|counts/.test(u.pathname)) lists.add(u.pathname + u.search);
      }
    } catch (e) {
      // No list from this page; the others still work.
    }
    for (const u of lists) {
      try {
        scan(await get(u), 0);
      } catch (e) {
        // Not every guess is a list.
      }
    }
    for (const m of (document.body && document.body.innerText ? document.body.innerText : "").match(/\b[A-Z0-9]{4}-[A-Z0-9]{3}\b/g) || []) found.add(m);
    const inTreeIds = new Set(persons.map((p) => p.id));
    const extra = [];
    const more = [...found].filter((id) => !read.has(id) && !inTreeIds.has(id) && id !== owner);
    n = 0;
    await eachLimited(more, 4, async (id) => {
      try {
        const { o, out } = await readPerson(id);
        if (out.some((x) => x.mine === true)) {
          ordinances.push(...out);
          extra.push({
            pid: id,
            name: o.name || [o.givenName, o.familyName].filter(Boolean).join(" ") || id,
            gender: /^f/i.test(o.gender || "") ? "F" : /^m/i.test(o.gender || "") ? "M" : "U",
            lifespan: o.lifespan || null,
            ahnentafel: null,
            generation: null,
            birth_place: null,
            death_place: null,
            rollup_status: null,
          });
        }
      } catch (e) {
        // A stray id that isn't a person.
      }
      n++;
      if (n % 5 === 0) say(`Reading your reservations… ${n} of ${more.length}`);
    });
    const yours = new Set(ordinances.filter((x) => x.mine === true).map((x) => x.pid));

    // 4. Work you reserved that's now completed (FamilySearch keeps 2 years).
    // Its shape isn't documented, so it's read loosely; if it can't be read,
    // `done` is left out and the Hub keeps the list it has.
    say("Reading your completed work…");
    let done;
    try {
      const TYPE = (v) => {
        const s = String(v || "").toLowerCase();
        if (/^b|bapt/.test(s)) return "B";
        if (/^c|confirm/.test(s)) return "C";
        if (/^i|initiat/.test(s)) return "I";
        if (/^e|endow/.test(s)) return "E";
        if (/parent|^sp|sealing_to_parent|stp/.test(s)) return "SP";
        if (/spouse|^ss|sealing_to_spouse|sts/.test(s)) return "SS";
        return null;
      };
      const pick = (r, keys) => {
        for (const k of keys) if (r[k] != null && r[k] !== "") return r[k];
        return null;
      };
      const rowsOf = (j) => {
        let best = [];
        const walk = (v, depth) => {
          if (depth > 4 || !v || typeof v !== "object") return;
          if (Array.isArray(v)) {
            if (v.length > best.length && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) best = v;
            v.slice(0, 3).forEach((x) => walk(x, depth + 1));
            return;
          }
          Object.values(v).forEach((x) => walk(x, depth + 1));
        };
        walk(j, 0);
        return best;
      };
      const byPid = new Map();
      const seenRows = new Set();
      for (let page = 0; page < 80; page++) {
        const j = await get(`/service/tree/tree-data/completed-ordinances?start=${page * 50}&count=50&offset=${page * 50}&limit=50`);
        let added = 0;
        const rows = rowsOf(j);
        for (const r of rows) {
          const pid = pick(r, ["personId", "pid", "id", "treePersonId"]);
          if (!pid || !PID.test(String(pid))) continue;
          const type = TYPE(pick(r, ["ordinanceType", "type", "ordinance", "ordinanceName"]));
          const date = pick(r, ["comparableCompletedDate", "completedDate", "completionDate", "date"]);
          const temple = pick(r, ["completedTemple", "templeName", "temple", "completedPlace"]);
          const rowKey = `${pid}|${type}|${date}`;
          if (seenRows.has(rowKey)) continue;
          seenRows.add(rowKey);
          added++;
          if (!byPid.has(pid)) {
            const g = String(pick(r, ["gender", "sex"]) || "");
            byPid.set(pid, {
              pid,
              name: String(pick(r, ["name", "personName", "fullName", "displayName"]) || pid),
              gender: /^f/i.test(g) ? "F" : /^m/i.test(g) ? "M" : "U",
              lifespan: pick(r, ["lifespan", "lifeSpan"]),
              ordinances: [],
            });
          }
          if (type) {
            const d = date ? String(date).slice(0, 10) : null;
            byPid.get(pid).ordinances.push({ type, date: d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : date, temple: temple ? String(temple).replace(/ (Utah|Missouri|Idaho) Temple$| Temple$/, "") : null });
          }
        }
        if (!added || rows.length < 50) break;
      }
      const inTree = new Set(persons.map((p) => p.id));
      if (byPid.size) done = [...byPid.values()].map((d) => ({ ...d, in_pedigree: inTree.has(d.pid) }));
    } catch (e) {
      done = undefined;
    }

    const people = persons
      .filter((p) => p.display && p.display.ascendancyNumber)
      .map((p) => {
        const d = p.display;
        const num = parseInt(d.ascendancyNumber, 10);
        return {
          pid: p.id,
          name: d.name || p.id,
          gender: /^f/i.test(d.gender || "") ? "F" : /^m/i.test(d.gender || "") ? "M" : "U",
          lifespan: d.lifespan || null,
          ahnentafel: Number.isInteger(num) ? num : null,
          generation: Number.isInteger(num) ? Math.floor(Math.log2(num)) + 1 : null,
          birth_place: d.birthPlace || null,
          death_place: d.deathPlace || null,
          rollup_status: p.living ? "LIVING" : rollup[p.id] || null,
        };
      });

    people.push(...extra);

    const snap = {
      kind: "hub-temple-snapshot",
      version: cfg.version || 3,
      synced_at: new Date().toISOString(),
      root,
      note: "Read from FamilySearch by the Sync to Hub bookmark.",
      people,
      ordinances,
    };
    if (done) snap.done = done;
    if (cfg.send === false) return snap;

    // 5. Send it to the Hub; if the browser won't, save it as a file.
    const summary = `You hold names for ${yours.size} people. ${ordinances.length} open ordinances across ${people.length} people${done ? `, and ${done.length} you've done` : ""}.`;
    try {
      const r = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sync-key": cfg.key },
        body: JSON.stringify(snap),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || `The Hub said ${r.status}`);
      const a = document.createElement("a");
      a.href = cfg.hub + "/temple";
      a.target = "_blank";
      a.textContent = "Open Temple in the Hub ↗";
      a.setAttribute("style", "display:inline-block;margin-top:8px;color:#ff8a3d;font-weight:600");
      say(`Sent: ${summary}`, a);
      closeLater(15000);
    } catch (e) {
      const blob = new Blob([JSON.stringify(snap)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `temple-snapshot-${snap.synced_at.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      say(`Couldn't reach the Hub (${e.message}). Saved it as a file instead: load it on the Temple page. ${summary}`);
      closeLater(30000);
    }
    return snap;
  } catch (e) {
    say(`Stopped: ${e.message}. Nothing was changed. Try again in a minute.`);
    closeLater(15000);
    return null;
  }
}

// The bookmark itself: the function above with this person's key baked in.
export function syncBookmarklet({ key, endpoint, hub, root, owner }) {
  const cfg = JSON.stringify({ key, endpoint, hub, root, owner, version: SYNC_VERSION });
  return "javascript:" + encodeURIComponent(`void((${familySearchSync.toString()})(${cfg}))`);
}
