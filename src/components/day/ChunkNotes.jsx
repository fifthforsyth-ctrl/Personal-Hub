import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { NotebookPen, Check, StickyNote, X, ChevronDown, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { saveChunkNotes, fetchChunkHighlights, createCardFromChunk, fetchNotes } from "../../lib/api";
import { resolveHighlights, splitParagraphs, segmentsFor, selectionInfo, findInSource } from "../../lib/noteText";
import { NOTE_KINDS, kindOf } from "../../lib/noteKinds";

// Meeting notes, kept where the meeting was.
//
// A meeting is an hour of your day, so its notes hang off that hour rather
// than becoming a document in a separate filing system. The whole transcript
// stays here — it is a source, not something you'll reread — and the one line
// worth keeping gets pulled out into a card that points back at this day.
export default function ChunkNotes({ chunk, date }) {
  const { user } = useAuth();
  const [notes, setNotes] = useState(chunk.notes ?? "");
  const [saved, setSaved] = useState(chunk.notes ?? "");
  const [open, setOpen] = useState(Boolean(chunk.notes));
  const [editing, setEditing] = useState(false);
  const [highlights, setHighlights] = useState([]);
  const [cards, setCards] = useState([]);
  const [selection, setSelection] = useState(null);
  const [barPos, setBarPos] = useState(null);
  const [kindMenu, setKindMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef(null);

  const reload = useCallback(async () => {
    if (!user?.id) return;
    const [h, all] = await Promise.all([
      fetchChunkHighlights(user.id, [chunk.id]).catch(() => []),
      fetchNotes(user.id).catch(() => []),
    ]);
    setHighlights(h);
    setCards(all.filter((n) => n.origin_chunk_id === chunk.id));
  }, [user?.id, chunk.id]);

  useEffect(() => {
    if (open) reload();
  }, [open, reload]);

  useEffect(() => {
    setNotes(chunk.notes ?? "");
    setSaved(chunk.notes ?? "");
  }, [chunk.notes]);

  useEffect(() => {
    if (editing || !open) return;
    function capture() {
      const info = selectionInfo(bodyRef.current);
      const found = info ? findInSource(saved, info.text) : null;
      if (!info || !found) {
        setSelection(null);
        setBarPos(null);
        setKindMenu(false);
        return;
      }
      setSelection({ text: info.text.trim(), start: found.start, end: found.end });
      const box = bodyRef.current.getBoundingClientRect();
      const top = info.rect.top - box.top;
      setBarPos({ left: info.rect.left - box.left + info.rect.width / 2, top, below: top < 50 });
    }
    document.addEventListener("mouseup", capture);
    document.addEventListener("touchend", capture);
    return () => {
      document.removeEventListener("mouseup", capture);
      document.removeEventListener("touchend", capture);
    };
  }, [editing, open, saved]);

  const resolved = useMemo(() => resolveHighlights(saved, highlights), [saved, highlights]);
  const paragraphs = useMemo(() => splitParagraphs(saved), [saved]);
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  function clearSelection() {
    window.getSelection()?.removeAllRanges();
    setSelection(null);
    setBarPos(null);
    setKindMenu(false);
  }

  async function save() {
    setBusy(true);
    try {
      await saveChunkNotes(chunk.id, notes);
      setSaved(notes);
      setEditing(false);
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function makeCard(kind) {
    if (!selection) return;
    setBusy(true);
    try {
      await createCardFromChunk(user.id, {
        chunkId: chunk.id,
        date,
        quotedText: selection.text,
        startOffset: selection.start,
        endOffset: selection.end,
        noteKind: kind,
        title: selection.text.length <= 70 ? selection.text : selection.text.slice(0, 67).trimEnd() + "…",
      });
      clearSelection();
      await reload();
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="btn-link" style={{ marginTop: 8 }} onClick={() => setOpen(true)}>
        <NotebookPen size={12} />
        {saved ? "Notes from this block" : "Add notes"}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <button className="btn-link" onClick={() => setOpen(false)}>
          <ChevronDown size={12} />
          Notes
        </button>
        <button className="btn-link" onClick={() => (editing ? save() : setEditing(true))} disabled={busy}>
          {editing ? <Check size={12} /> : <NotebookPen size={12} />}
          {editing ? "Done" : saved ? "Edit" : "Write"}
        </button>
      </div>

      {editing ? (
        <textarea
          className="textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="What was said. Paste it, type it, don't tidy it — you'll pull the good lines out afterwards."
          style={{ minHeight: 170, fontSize: 14, lineHeight: 1.65 }}
          autoFocus
        />
      ) : saved.trim() ? (
        <div style={{ position: "relative" }}>
          <div ref={bodyRef}>
            {paragraphs.map((para) => (
              <p key={para.start} data-start={para.start} style={{ margin: "0 0 11px", fontSize: 13.5, lineHeight: 1.65, whiteSpace: "pre-wrap", color: "var(--text-2)" }}>
                {segmentsFor(para, resolved).map((seg, i) => {
                  const card = seg.highlight?.child_note_id ? cardById.get(seg.highlight.child_note_id) : null;
                  const color = card ? kindOf(card.note_kind).color : "var(--accent)";
                  return seg.highlight ? (
                    <mark
                      key={i}
                      title={card ? `Kept as: ${card.title}` : "Highlighted"}
                      style={{
                        background: `${color}22`,
                        color: "var(--text)",
                        borderBottom: `2px solid ${color}`,
                        borderRadius: 2,
                        padding: "1px 0",
                      }}
                    >
                      {seg.text}
                    </mark>
                  ) : (
                    <span key={i}>{seg.text}</span>
                  );
                })}
              </p>
            ))}
          </div>

          {selection && barPos && (
            <div
              style={{
                position: "absolute",
                left: Math.max(80, barPos.left),
                top: barPos.below ? barPos.top + 28 : barPos.top - 44,
                transform: "translateX(-50%)",
                display: "flex",
                gap: 4,
                background: "var(--surface)",
                border: "1px solid var(--line-strong)",
                borderRadius: "var(--r)",
                padding: 4,
                boxShadow: "var(--shadow-lift)",
                zIndex: 25,
                whiteSpace: "nowrap",
              }}
            >
              <button className="btn btn--accent" style={{ padding: "6px 10px", fontSize: 12.5 }} onClick={() => makeCard("counsel")} disabled={busy}>
                <StickyNote size={13} />
                Keep this
              </button>
              <button className="btn btn--accent" style={{ padding: "6px 6px" }} onClick={() => setKindMenu((v) => !v)} title="Keep it as a particular kind">
                <ChevronDown size={13} />
              </button>
              <button className="btn-icon" style={{ width: 28, height: 28 }} onClick={clearSelection}>
                <X size={14} />
              </button>

              {kindMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 5px)",
                    right: 0,
                    width: 228,
                    background: "var(--surface)",
                    border: "1px solid var(--line-strong)",
                    borderRadius: "var(--r)",
                    padding: 5,
                    boxShadow: "var(--shadow-lift)",
                  }}
                >
                  {NOTE_KINDS.map((k) => (
                    <button
                      key={k.key}
                      onClick={() => makeCard(k.key)}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", borderRadius: "var(--r-sm)", padding: "7px 9px", color: "inherit" }}
                    >
                      <span className="row" style={{ gap: 7 }}>
                        <span className="dot" style={{ background: k.color }} />
                        <span style={{ fontSize: 12.5, fontWeight: 550 }}>{k.label}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="faint" style={{ fontSize: 11, marginTop: 4 }}>
            Select any line to keep it as a card. The card points back here, so the full notes are always one press away.
          </p>
        </div>
      ) : (
        <p className="empty" style={{ fontSize: 12.5 }}>Nothing written from this block yet.</p>
      )}

      {cards.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line)" }}>
          <div className="eyebrow" style={{ marginBottom: 7 }}>Kept from this block</div>
          {cards.map((c) => (
            <Link
              key={c.id}
              to={`/study?note=${c.id}`}
              className="row"
              style={{ gap: 7, padding: "5px 0", fontSize: 12.5 }}
            >
              <span className="dot" style={{ background: kindOf(c.note_kind).color, width: 6, height: 6 }} />
              <span className="truncate" style={{ flex: 1, color: "var(--text-2)" }}>{c.title}</span>
              <ChevronRight size={12} style={{ color: "var(--text-3)", flexShrink: 0 }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
