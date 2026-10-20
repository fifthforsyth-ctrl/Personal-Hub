import { Link } from "react-router-dom";
import { Landmark, ArrowRight } from "lucide-react";
import { fetchNextTempleTrip } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { TRIP_TYPES } from "../../lib/temple";
import { addDays } from "../../lib/planDates";
import { fmtShortDate } from "../temple/format";

// The next temple trip, a week out or closer: its type, day and names, and
// whether the cards still need printing. One line into the Temple page.
// Shows nothing when there's no trip coming, or if it can't load.
export default function TempleTrip({ userId, date }) {
  const { data: trip } = useLoad(() => (userId ? fetchNextTempleTrip(userId, date) : null), [userId, date]);
  if (!trip || trip.planned_on > addDays(date, 7)) return null;

  const when = trip.planned_on === date ? "Today" : trip.planned_on === addDays(date, 1) ? "Tomorrow" : fmtShortDate(trip.planned_on);
  const names = (trip.items ?? []).map((it) => it.name.replace(/"/g, "").split(" ")[0]);

  return (
    <Link to="/temple" className="card temple-today">
      <span className="temple-today__icon" aria-hidden="true">
        <Landmark size={18} strokeWidth={1.9} />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span className="temple-today__title">
          Temple · {TRIP_TYPES[trip.kind]?.name ?? "Trip"} · {when}
        </span>
        <span className="temple-today__names">{names.join(", ")}</span>
      </span>
      {!trip.printed ? <span className="chip chip--accent">Print cards</span> : <ArrowRight size={15} />}
    </Link>
  );
}
