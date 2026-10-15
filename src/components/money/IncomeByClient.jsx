import { Users } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchMonthEarnings, fetchClientHistory } from "../../lib/api";
import { useLoad } from "../../lib/useLoad";
import { fmtMoney } from "../../lib/money";
import { fmtMinutes } from "../../lib/categories";
import { depositClient, earningsByClient } from "../../lib/honest";
import LoadError from "../ui/LoadError";
import { useReloadOn, shiftMonth, monthName } from "./shared";

// What came in from each client this month, beside the hours worked for
// them, and what that comes to an hour. A deposit's client is the one you
// picked on it, or the one its bank words name; an hour's client is the one
// picked when the timer stopped, or the one its category names. Hours with
// no client yet are said once, not guessed at.
export default function IncomeByClient({ monthKey, version }) {
  const { user } = useAuth();
  const { data, error, reload } = useLoad(async () => {
    if (!user?.id) return null;
    const [month, known] = await Promise.all([
      fetchMonthEarnings(user.id, monthKey, shiftMonth(monthKey, 1)),
      fetchClientHistory(user.id).catch(() => []),
    ]);
    const deposits = month.deposits.map((d) => ({ ...d, client: depositClient(d, known) }));
    return { ...earningsByClient(deposits, month.entries), untaggedIncome: deposits.filter((d) => !d.client).reduce((s, d) => s + Number(d.amount), 0) };
  }, [user?.id, monthKey]);
  useReloadOn(version, reload);

  if (error && !data) return <LoadError what="income by client" error={error} onRetry={reload} />;
  if (!data || (data.rows.length === 0 && data.untaggedMinutes === 0)) return null;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Users size={14} />Income by client</span>
        <span className="faint" style={{ fontSize: 12 }}>{monthName(monthKey)}</span>
      </div>
      {data.rows.length > 0 && (
        <div className="money-clients" role="table" aria-label="Income and hours by client">
          <div className="money-clients__row money-clients__row--head" role="row">
            <span role="columnheader">Client</span>
            <span role="columnheader">Came in</span>
            <span role="columnheader">Hours</span>
            <span role="columnheader">An hour</span>
          </div>
          {data.rows.map((r) => (
            <div key={r.client} className="money-clients__row" role="row">
              <span role="cell" className="money-clients__name">{r.client}</span>
              <span role="cell" className="mono">{r.amount > 0 ? fmtMoney(r.amount, { round: true }) : "—"}</span>
              <span role="cell" className="mono">{r.minutes > 0 ? fmtMinutes(r.minutes) : "—"}</span>
              <span role="cell" className="mono">{r.perHour ? fmtMoney(r.perHour, { round: true }) : "—"}</span>
            </div>
          ))}
        </div>
      )}
      <p className="card-note money-clients__note">
        {[
          data.untaggedMinutes > 0 ? `${fmtMinutes(data.untaggedMinutes)} of work this month has no client yet.` : null,
          data.untaggedIncome > 0 ? `${fmtMoney(data.untaggedIncome, { round: true })} came in without a client; open it below to say who.` : null,
          "Pay can land a month after the work, so read this across a few months.",
        ]
          .filter(Boolean)
          .join(" ")}
      </p>
    </div>
  );
}
