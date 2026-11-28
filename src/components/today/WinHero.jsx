import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, CloudOff, ChevronDown } from "lucide-react";
import { useToast } from "../ui/Feedback";
import { knownWinLabels, loadWinLabels } from "./winLabels";
import { useOutbox, withTaps, waitingTaps, logTap, renameTap, removeTap, isUnnamed } from "./tapOutbox";
import TapEditor from "./TapEditor";
import WeighIn from "./WeighIn";
import { isWeighIn } from "../../lib/honest";
import Swords from "../ui/Swords";
import { playClink } from "../../lib/clink";
import { haptic } from "../../lib/haptics";

// Wins, right under the timer, because wins are what keep you going.
//
// The card reads left to right: the count, big; the latest wins by name;
// and the Win button. Tapping the names opens the list of today's wins,
// where any of them can be renamed or removed.
//
// One tap logs a win and the count jumps immediately: the tap is kept on the
// phone and sent behind it, so a bad signal never makes you wait for your
// own encouragement, and never loses the win. Once it's logged you can name
// it, or tap one of the wins you log most and it's named in one more tap.
// Every tap can be undone for a few seconds, and any win on the list can be
// renamed or removed later by tapping it. "Weigh myself" also offers the
// number, so the weight is kept beside the win.
//
// The Win button carries two crossed swords. Every win swings them together
// with the sound of a sword fight and a strike you feel (sound and haptics can each be
// turned off under More > On your phone).
//
// Losses are deliberately quiet: small grey words, no count, nothing red.
// They're kept because logging them keeps you honest (and, in your own
// words, keeps you logging the wins), but they only appear in the evening.

const NAMING_MS = 20000;
const PILLS = 8;
const NAMES = 3;

export default function WinHero({ userId, date, rows, loaded }) {
  const toast = useToast();
  const outbox = useOutbox();
  const [bump, setBump] = useState(0);
  const [naming, setNaming] = useState(null);
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState(null);
  const [weighing, setWeighing] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [chips, setChips] = useState(() => knownWinLabels(userId));
  const namingTimer = useRef(null);
  const labelRef = useRef("");
  labelRef.current = label;

  useEffect(() => {
    if (!userId) return;
    setChips(knownWinLabels(userId));
    loadWinLabels(userId).then(setChips, (err) => console.warn(err));
  }, [userId]);

  useEffect(() => () => clearTimeout(namingTimer.current), []);

  const wins = withTaps(rows, outbox, { userId, date, kind: "win" });
  const waiting = waitingTaps(outbox, userId);
  const newestFirst = [...wins].reverse();
  const editingRow = wins.find((w) => w.id === editing);

  // The naming row is for the win you just logged. Left alone (and empty)
  // it folds away, so the chips below go back to logging new wins.
  function armNaming() {
    clearTimeout(namingTimer.current);
    namingTimer.current = setTimeout(() => {
      if (!labelRef.current.trim()) setNaming(null);
    }, NAMING_MS);
  }

  function closeNaming() {
    clearTimeout(namingTimer.current);
    setNaming(null);
    setLabel("");
  }

  function logWin(chipLabel) {
    playClink();
    haptic("win");
    const tap = logTap(userId, "win", chipLabel);
    setBump((b) => b + 1);
    setEditing(null);
    setWeighing(Boolean(chipLabel && isWeighIn(chipLabel)));
    if (chipLabel) {
      closeNaming();
    } else {
      setNaming(tap.id);
      setLabel("");
      armNaming();
    }
    toast.show(chipLabel ? `Win logged: ${chipLabel}` : "Win logged", { actionLabel: "Undo", onAction: () => undo(tap.id) });
  }

  function logLoss() {
    const tap = logTap(userId, "loss");
    toast.show("Logged quietly. You'll see it tonight.", { actionLabel: "Undo", onAction: () => undo(tap.id) });
  }

  function undo(id) {
    setNaming((n) => (n === id ? null : n));
    removeTap(id).catch((err) => toast.error(err, "Couldn't undo that, so it's still logged."));
  }

  // The name shows at once; if the Hub turns it down, the toast says so and
  // the win keeps its old name, ready to be tapped and named again.
  function saveName(text) {
    const id = naming;
    const t = text.trim();
    closeNaming();
    if (!id || !t) return;
    if (isWeighIn(t)) setWeighing(true);
    renameTap(id, t).catch((err) => toast.error(err, "Couldn't name that win. Tap it in the list to try again."));
  }

  const nameOf = (w) => (isUnnamed(w) ? "Win" : w.habit_label);
  const names = newestFirst.slice(0, NAMES).map(nameOf);
  const more = wins.length - names.length;
  const lossLink = (
    <button className="loss-link" onClick={logLoss} title="Log a loss. It's kept quiet until the evening.">
      Log a loss
    </button>
  );

  return (
    <div className="card win-hero">
      <div className="win-hero__top">
        <div key={bump} className={"win-count" + (bump ? " win-count--bump" : "")} aria-live="polite" aria-label={loaded ? `${wins.length} ${wins.length === 1 ? "win" : "wins"} today` : undefined}>
          {loaded ? wins.length : <span className="win-count__unknown">–</span>}
        </div>
        {wins.length > 0 ? (
          <button
            type="button"
            className="win-hero__names"
            aria-expanded={listOpen}
            title="See today's wins, to rename or remove one"
            onClick={() => {
              setListOpen((o) => !o);
              setEditing(null);
            }}
          >
            <span className="win-hero__label">
              Wins today
              <ChevronDown size={13} className={"win-hero__chev" + (listOpen ? " is-open" : "")} />
            </span>
            <span className="win-hero__list">
              {names.join(" · ")}
              {more > 0 && ` · +${more}`}
            </span>
          </button>
        ) : (
          <div className="win-hero__names">
            <span className="win-hero__label">Wins today</span>
            {loaded && <span className="win-hero__list win-hero__list--none">The first one is a tap away</span>}
          </div>
        )}
        <button className="btn btn--accent win-btn" onClick={() => logWin()}>
          <Swords size={22} clash={bump} />
          Win
        </button>
      </div>

      {waiting.count > 0 && (
        <p className="win-sync">
          <CloudOff size={13} />
          <span>
            {waiting.count === 1 ? "Saved on this phone." : `${waiting.count} saved on this phone.`}{" "}
            {waiting.offline
              ? `${waiting.count === 1 ? "It'll" : "They'll"} sync when you're back online.`
              : `${waiting.count === 1 ? "It'll" : "They'll"} sync as soon as the Hub answers.`}
          </span>
        </p>
      )}

      {weighing ? (
        <WeighIn key={bump} userId={userId} onDone={() => setWeighing(false)} />
      ) : naming ? (
        <form
          className="win-name"
          onSubmit={(e) => {
            e.preventDefault();
            saveName(label);
          }}
        >
          <label className="win-name__label" htmlFor="win-name-input">Name it:</label>
          <div className="row" style={{ gap: 8 }}>
            <input
              id="win-name-input"
              className="input"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value);
                armNaming();
              }}
              onFocus={armNaming}
              placeholder="What was it? (optional)"
            />
            <button type="submit" className="btn" style={{ flexShrink: 0 }}>
              {label.trim() ? "Save" : "Skip"}
            </button>
          </div>
          {chips.length > 0 && (
            <div className="win-chips">
              {chips.map((c) => (
                <button key={c} type="button" className="name-chip" onClick={() => saveName(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
        </form>
      ) : (
        <div className="win-quick">
          {/* The wins you log most, in one row that slides sideways. */}
          <div className="win-quick__chips">
            {chips.map((c) => (
              <button key={c} className="chip chip--tap" onClick={() => logWin(c)} aria-label={`Log a win: ${c}`}>
                <Plus size={12} />
                {c}
              </button>
            ))}
          </div>
          {lossLink}
        </div>
      )}
      {(weighing || naming) && <div className="win-quick">{lossLink}</div>}

      {listOpen && wins.length > 0 && (
        <div className="win-list">
          {newestFirst.slice(0, PILLS).map((w) => (
            <button
              key={w.id}
              type="button"
              className={"win-pill" + (isUnnamed(w) ? " win-pill--unnamed" : "") + (editing === w.id ? " win-pill--open" : "")}
              onClick={() => {
                closeNaming();
                setEditing((e) => (e === w.id ? null : w.id));
              }}
              aria-expanded={editing === w.id}
              title="Rename or remove"
            >
              {isUnnamed(w) ? "Win" : w.habit_label}
            </button>
          ))}
          {wins.length > PILLS && (
            <Link to={`/evening/${date}`} className="btn-link win-list__more">
              All {wins.length}
            </Link>
          )}
        </div>
      )}

      {listOpen && editingRow && <TapEditor key={editingRow.id} row={editingRow} onClose={() => setEditing(null)} />}
    </div>
  );
}
