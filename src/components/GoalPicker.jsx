import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X, CornerDownLeft, Ban, Star } from "lucide-react";

// Finding one goal among eighty-six.
//
// A <select> is the wrong instrument here: the tree has three separate nodes
// called "Reading" and two called "Obedience", so the title alone doesn't
// identify anything — you need the path. And scrolling eighty-six paths to
// find one is worse than typing four letters of it.
//
// So: type to filter, arrow keys to move, Enter to take it. With an empty
// box it shows what you'd most likely want anyway — the goals you've marked
// focused, then the pillars — rather than an alphabetical wall.

function score(goal, q) {
  const title = goal.title.toLowerCase();
  const path = goal.path.toLowerCase();
  if (title === q) return 0;
  if (title.startsWith(q)) return 1;
  if (title.includes(q)) return 2;
  if (path.includes(q)) return 3;
  // Last resort: every word of the query appears somewhere in the path, in
  // any order — so "study scripture" finds "Scripture Study".
  return q.split(/\s+/).every((w) => path.includes(w)) ? 4 : Infinity;
}

export default function GoalPicker({ goals, value, onPick, onClose, allowNone = true }) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      const focused = goals.filter((g) => g.is_focused);
      const pillars = goals.filter((g) => g.depth === 0 && !g.is_focused);
      const rest = goals.filter((g) => !g.is_focused && g.depth > 0);
      return [...focused, ...pillars, ...rest].slice(0, 60);
    }

    return goals
      .map((g) => ({ g, s: score(g, q) }))
      .filter((x) => x.s !== Infinity)
      .sort((a, b) => a.s - b.s || a.g.path.length - b.g.path.length)
      .slice(0, 60)
      .map((x) => x.g);
  }, [goals, query]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const options = allowNone ? [{ id: null, title: "Serves no goal", path: "Nothing on the tree — driving, meals, idle time" }, ...results] : results;

  function onKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(options.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = options[cursor];
      if (pick) onPick(pick.id, pick.id ? pick.path : null);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ padding: 0, maxWidth: 560, display: "flex", flexDirection: "column", maxHeight: "72vh" }}>
        <div className="row" style={{ gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line)" }}>
          <Search size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search your goals…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text)", fontSize: 15 }}
          />
          <button className="btn-icon" onClick={onClose} title="Close"><X size={16} /></button>
        </div>

        <div ref={listRef} style={{ overflowY: "auto", padding: 8 }}>
          {options.length === 0 && (
            <p className="empty" style={{ padding: "18px 10px" }}>No goal matches “{query}”.</p>
          )}

          {options.map((g, i) => {
            const isNone = g.id === null;
            const selected = value === g.id || (isNone && value == null);
            const parts = g.path.split(" › ");
            const leaf = isNone ? g.title : parts[parts.length - 1];
            const trail = isNone ? g.path : parts.slice(0, -1).join(" › ");

            return (
              <button
                key={g.id ?? "__none__"}
                data-i={i}
                onMouseEnter={() => setCursor(i)}
                onClick={() => onPick(g.id, g.id ? g.path : null)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  background: i === cursor ? "var(--inset)" : "transparent",
                  border: `1px solid ${i === cursor ? "var(--line-strong)" : "transparent"}`,
                  borderRadius: "var(--r)",
                  padding: "9px 11px",
                  color: "inherit",
                }}
              >
                <span className="row" style={{ gap: 8 }}>
                  {isNone && <Ban size={13} style={{ color: "var(--text-3)", flexShrink: 0 }} />}
                  {g.is_focused && <Star size={12} style={{ color: "var(--accent)", flexShrink: 0 }} fill="var(--accent)" />}
                  <span className="truncate" style={{ fontSize: 13.5, fontWeight: 570, color: selected ? "var(--accent)" : "var(--text)" }}>
                    {leaf}
                  </span>
                </span>
                {trail && (
                  <span className="truncate faint" style={{ display: "block", fontSize: 11.5, marginTop: 2, marginLeft: isNone || g.is_focused ? 21 : 0 }}>
                    {trail}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="row" style={{ gap: 14, padding: "10px 16px", borderTop: "1px solid var(--line)" }}>
          <span className="faint" style={{ fontSize: 11 }}>↑↓ to move</span>
          <span className="faint row" style={{ fontSize: 11, gap: 4 }}><CornerDownLeft size={11} /> to choose</span>
          <span className="faint" style={{ fontSize: 11 }}>esc to close</span>
          <span className="spacer" />
          <span className="mono faint" style={{ fontSize: 11 }}>{results.length} of {goals.length}</span>
        </div>
      </div>
    </div>
  );
}
