import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Quote } from "lucide-react";
import { fetchNoteOfTheDay, markNoteSurfaced } from "../../lib/api";
import { kindOf } from "../../lib/noteKinds";
import { todayStr } from "../../lib/planDates";

// One note, handed back, every day.
//
// The pick is made in the database from the date, so it is the same note all
// day on every device — a thought you're meant to carry can't reshuffle every
// time you reload. It shows in full rather than as a link to itself: something
// you have to click to read is something you scroll past.
export default function DailyNote({ compact = false }) {
  const [note, setNote] = useState(null);
  const date = todayStr();

  useEffect(() => {
    let cancelled = false;
    fetchNoteOfTheDay(date)
      .then((n) => !cancelled && setNote(n))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (!note) return null;

  const kind = kindOf(note.note_kind);
  const text = note.body?.trim() || note.excerpt || "";
  const when = new Date(note.created_at).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });

  return (
    <div
      className="card"
      style={{
        borderColor: `${kind.color}44`,
        background: `linear-gradient(180deg, ${kind.color}12, transparent 55%), var(--card)`,
      }}
    >
      <div className="card-head">
        <span className="card-title">
          <span className="dot" style={{ background: kind.color, width: 8, height: 8 }} />
          {kind.label}
        </span>
        <span className="mono faint" style={{ fontSize: 11 }}>{when}</span>
      </div>

      <h3 style={{ fontSize: compact ? 15 : 16.5, marginBottom: 9 }}>{note.title}</h3>

      {note.excerpt && note.body?.trim() && (
        <blockquote
          className="prose prose--sm"
          style={{
            margin: "0 0 11px",
            paddingLeft: 12,
            borderLeft: `2px solid ${kind.color}66`,
            color: "var(--text-2)",
            fontStyle: "italic",
          }}
        >
          {note.excerpt}
        </blockquote>
      )}

      <div
        className="prose"
        style={
          compact
            ? { display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden", fontSize: 14 }
            : undefined
        }
      >
        {text}
      </div>

      <div className="row" style={{ gap: 10, marginTop: 14 }}>
        {note.source_ref && (
          <span className="chip" style={{ fontSize: 10.5 }}>
            <Quote size={10} />
            {note.source_ref}
          </span>
        )}
        <span className="spacer" />
        <Link
          to={`/study?note=${note.id}`}
          className="btn-link"
          onClick={() => markNoteSurfaced(note.id).catch(() => {})}
        >
          Open it
          <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}
