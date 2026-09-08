import { Check, CircleDashed, HelpCircle, AlertTriangle, ArrowRight, Clock } from "lucide-react";
import { buildReport, fmtHours, fmtReportDate } from "../../lib/workReport";

// The screenshot version.
//
// Built to be cropped out of a screen and dropped into a chat, so it is a
// fixed width, has its own solid background rather than inheriting the page's,
// and puts the two things a boss reads first — the date and the hours — at the
// top in large type. Nothing here is interactive; anything you can press would
// only be a thing that looks broken in an image.
export default function ReportCard({ work, name }) {
  const r = buildReport(work);

  return (
    <div
      style={{
        width: 620,
        maxWidth: "100%",
        background: "var(--card)",
        border: "1px solid var(--line-strong)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid var(--line)", background: "linear-gradient(180deg, var(--accent-soft), transparent)" }}>
        <div className="row row--between" style={{ alignItems: "flex-end", gap: 16 }}>
          <div>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Daily update</div>
            <div style={{ fontSize: 20, fontWeight: 660, letterSpacing: "-0.02em" }}>{fmtReportDate(r.date)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="row" style={{ gap: 6, justifyContent: "flex-end", color: "var(--accent)" }}>
              <Clock size={15} />
              <span style={{ fontSize: 26, fontWeight: 680, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
                {fmtHours(r.minutes)}
              </span>
            </div>
            <div className="mono faint" style={{ fontSize: 10.5, marginTop: 4 }}>tracked</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 24px 22px" }} className="stack">
        <Section
          title="Done"
          icon={Check}
          color="var(--good)"
          items={[
            ...r.done.map((t) => ({ key: t.id, text: t.title })),
            ...r.extras.map((n) => ({ key: n.id, text: n.body, meta: n.minutes ? fmtHours(n.minutes) : null })),
          ]}
        />

        <Section
          title="Still in progress"
          icon={CircleDashed}
          color="var(--text-2)"
          items={r.open.map((t) => ({
            key: t.id,
            text: t.title,
            meta: t.rolled > 0 ? `carried ${t.rolled}d` : null,
          }))}
        />

        <Section
          title="Need from you"
          icon={AlertTriangle}
          color="var(--accent)"
          items={[
            ...r.blocked.map((n) => ({ key: n.id, text: n.body })),
            ...r.questions.map((n) => ({ key: n.id, text: n.body, question: true })),
          ]}
        />

        <Section
          title="Tomorrow"
          icon={ArrowRight}
          color="var(--text-2)"
          items={r.tomorrow.map((t, i) => ({ key: i, text: t.title }))}
          emptyText="Not planned yet"
        />

        {name && (
          <div className="faint" style={{ fontSize: 12, textAlign: "right", marginTop: 4 }}>— {name}</div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon: Icon, color, items, emptyText }) {
  if (items.length === 0 && !emptyText) return null;

  return (
    <div>
      <div className="row" style={{ gap: 7, marginBottom: 8 }}>
        <Icon size={13} style={{ color, flexShrink: 0 }} />
        <span style={{ fontSize: 11.5, fontWeight: 650, textTransform: "uppercase", letterSpacing: "0.07em", color }}>
          {title}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="faint" style={{ fontSize: 13, paddingLeft: 20 }}>{emptyText}</div>
      ) : (
        <div className="stack" style={{ gap: 6 }}>
          {items.map((it) => (
            <div key={it.key} className="row" style={{ gap: 9, alignItems: "flex-start", paddingLeft: 2 }}>
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: color,
                  flexShrink: 0,
                  marginTop: 8,
                }}
              />
              <span style={{ flex: 1, fontSize: 14, lineHeight: 1.5 }}>
                {it.question && <HelpCircle size={12} style={{ color: "var(--accent)", marginRight: 5, verticalAlign: -1 }} />}
                {it.text}
              </span>
              {it.meta && <span className="mono faint" style={{ fontSize: 11, flexShrink: 0, marginTop: 3 }}>{it.meta}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
