import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { pathOf } from "../../lib/ladder";
import { fmtShortDate } from "../../lib/planDates";

// What's behind you on the Targets tab: the mountains finished (a patch for
// each quest and lesson mountain whose summit was reached), the lessons
// learned, and what was set aside for now, quests and lessons both. Kept
// closed under the ladder; each one still opens its own page, where its
// history, notes and camps are, and where it can be taken up again.

// A finished mountain, as a round badge: the peak, its flag, a stitched edge.
export function PatchMark() {
  return (
    <svg viewBox="0 0 34 34" aria-hidden="true">
      <circle cx="17" cy="17" r="15.6" fill="#fff" stroke="#141414" strokeWidth="1.5" />
      <circle cx="17" cy="17" r="12.4" fill="none" stroke="#141414" strokeOpacity="0.45" strokeWidth="0.9" strokeDasharray="1.6 1.6" />
      <path d="M8.6 23 14.8 13.2l2.4 3.4 1.6-2.2 6.6 8.6Z" fill="#141414" />
      <path d="M14.8 13.2V8" stroke="#141414" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M15.2 8.2h4.4l-1.2 1.6 1.2 1.6h-4.4z" fill="#f26a1b" />
    </svg>
  );
}

// The page a finished mountain opens: its quest's, or its lesson's (a
// lesson's mountain is never a page of its own).
function patchPath(p) {
  return p.lesson_id ? pathOf("lesson", p.lesson_id) : pathOf("quest", p.id);
}

// Finished quests and lesson mountains, oldest first; the one just earned
// (`fresh`, its id) springs in.
export function Patches({ patches, fresh }) {
  return (
    <ul className="patch-row ov-patches">
      {patches.map((p) => (
        <li key={p.id}>
          <Link
            to={patchPath(p)}
            className={"patch" + (p.id === fresh ? " new" : "")}
            aria-label={`${p.title}. ${p.lesson_id ? "Lesson" : "Quest"}, summit reached${p.finished_on ? ` ${fmtShortDate(p.finished_on)}` : ""}.`}
          >
            <PatchMark />
            <span>{p.title}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function count(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

// The whole fold, or nothing when there's nothing behind you yet. It opens
// by itself when a patch has just been earned.
export function BehindYou({ view, fresh }) {
  const patches = view?.patches ?? [];
  const learned = view?.learned ?? [];
  const aside = [
    ...(view?.setAside ?? []).map((q) => ({ key: q.id, to: pathOf("quest", q.id), title: q.title, kind: "Quest" })),
    ...(view?.lessonsAside ?? []).map((l) => ({ key: l.id, to: pathOf("lesson", l.id), title: l.title, kind: "Lesson" })),
  ];
  if (!patches.length && !learned.length && !aside.length) return null;

  const summary = [
    patches.length ? count(patches.length, "patch", "patches") : null,
    learned.length ? `${learned.length} learned` : null,
    aside.length ? `${aside.length} set aside` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="card ov-behind" aria-labelledby="ov-behind-h">
      <details className="ov-fold" open={fresh && patches.some((p) => p.id === fresh) ? true : undefined}>
        <summary>
          <h2 className="eyebrow" id="ov-behind-h">
            Behind you
          </h2>
          <span className="ov-note">{summary}</span>
          <ChevronDown size={16} className="ov-fold__chev" aria-hidden="true" />
        </summary>

        <div className="ov-behind__body">
          {patches.length > 0 && (
            <div className="ov-group">
              <h3 className="ov-group__label">Patches</h3>
              <Patches patches={patches} fresh={fresh} />
            </div>
          )}
          {learned.length > 0 && (
            <div className="ov-group">
              <h3 className="ov-group__label">Learned</h3>
              <ul className="ov-chips">
                {learned.map((l) => (
                  <li key={l.id}>
                    <Link to={pathOf("lesson", l.id)} className="chip chip--tap" aria-label={`${l.title}. Lesson, learned${l.ended_on ? ` ${fmtShortDate(l.ended_on)}` : ""}.`}>
                      <span className="truncate">{l.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {aside.length > 0 && (
            <div className="ov-group">
              <h3 className="ov-group__label">Set aside</h3>
              <ul className="ov-chips">
                {aside.map((x) => (
                  <li key={x.key}>
                    <Link to={x.to} className="chip chip--tap ov-chip--aside" aria-label={`${x.title}. ${x.kind}, set aside.`}>
                      <span className="truncate">{x.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </details>
    </section>
  );
}
