import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, ArrowRight, ChevronDown } from "lucide-react";
import { colorFor } from "../../lib/categories";
import { minutesOf, fmtTimeRange } from "../../lib/planDates";

// The blocks you laid out for today, on Today.
//
// Sunday's week plan (and anything you put on the day by hand) lands on each
// date as blocks. Here they're a plain list in the order you'll live them:
// what you're in now, then what's next. Blocks already behind you fold into
// one line so the morning doesn't push the afternoon off the screen; a tap
// opens them.
//
// Changing a block still happens on the day itself, one tap away.
export default function PlanBlocks({ date, chunks }) {
  const [showEarlier, setShowEarlier] = useState(false);
  const now = useNowMinutes();

  const blocks = (chunks ?? [])
    .filter((c) => c.start_time && c.end_time)
    .map((c) => {
      const from = minutesOf(c.start_time);
      let to = minutesOf(c.end_time);
      // Sleep at 9:30 PM until 4:30 AM ends tomorrow, not before it starts.
      if (to <= from) to += 24 * 60;
      return { ...c, from, to };
    })
    .sort((a, b) => a.from - b.from || a.to - b.to);

  const earlier = blocks.filter((b) => b.to <= now);
  const ahead = blocks.filter((b) => b.to > now);
  const shown = showEarlier || ahead.length === 0 ? blocks : ahead;
  const hidden = shown === blocks ? 0 : earlier.length;

  return (
    <div className="card plan-blocks">
      <div className="card-head" style={{ marginBottom: 8 }}>
        <span className="card-title"><CalendarClock size={14} />Today's plan</span>
        <Link to={`/day/${date}`} className="btn-link plan-blocks__open">
          {blocks.length > 0 ? "Open day" : "Plan it"}
          <ArrowRight size={13} />
        </Link>
      </div>

      {blocks.length === 0 && <p className="card-note">Nothing planned for today yet.</p>}

      {hidden > 0 && (
        <button type="button" className="plan-blocks__earlier" onClick={() => setShowEarlier(true)}>
          <ChevronDown size={13} />
          {hidden === 1 ? "1 earlier block" : `${hidden} earlier blocks`}
        </button>
      )}

      {shown.map((b) => {
        const isNow = b.from <= now && now < b.to;
        const past = b.to <= now;
        return (
          <div key={b.id} className={"plan-blocks__row" + (isNow ? " is-now" : "") + (past ? " is-past" : "")}>
            <span className="plan-blocks__time mono">{fmtTimeRange(b.start_time, b.end_time)}</span>
            <span className="plan-blocks__title">
              {b.category && <span className="dot" style={{ background: colorFor(b.category) }} />}
              <span className="truncate">{b.title || "Untitled block"}</span>
            </span>
            {isNow && <span className="plan-blocks__now">Now</span>}
          </div>
        );
      })}
    </div>
  );
}

// Minutes since midnight, kept current so "Now" moves with the clock.
function useNowMinutes() {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [now, setNow] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setNow(read()), 30000);
    return () => clearInterval(id);
  }, []);
  return now;
}
