import { useState } from "react";
import { Watch as WatchIcon, Copy, Check, ExternalLink, AlarmClock, HeartPulse, Link2, Download } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchWatchKey, newWatchKey, deleteWatchKey, fetchHealthDays, fetchHealthWorkouts, fetchLastHealthImport } from "../lib/api";
import { SUPABASE_URL } from "../lib/supabaseClient";
import { useLoad } from "../lib/useLoad";
import { todayStr, addDays, parseDateStr, fmtDayHeading } from "../lib/planDates";
import { fmtMins, lastUsedLine, watchAddress, workoutName } from "../lib/watch";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import "../styles/phone.css";

// On your watch: the Hub on an Apple Watch, which can't run the Hub itself.
//
// One address does everything (the `watch` edge function with your key in
// it): the "Hub" Shortcut on the watch logs wins and losses, starts and
// stops timers, ticks Today's tasks and keeps notes; a wake-up automation on
// the iPhone records when you're up; Health Auto Export sends sleep,
// workouts and the day's numbers from Apple Health. This page makes the
// address, walks through each setup, and shows what has come in.

const HAE = "https://apps.apple.com/app/health-auto-export-json-csv/id1115567069";

// Ready-made Shortcuts, signed so iPhone will open them. Each asks for your
// watch address when you add it. Empty until they're signed.
const SHORTCUTS = [];

const HAE_METRICS = [
  "Sleep Analysis",
  "Step Count",
  "Active Energy",
  "Apple Exercise Time",
  "Apple Stand Hour",
  "Resting Heart Rate",
  "Heart Rate Variability",
  "Heart Rate",
  "Respiratory Rate",
  "Blood Oxygen Saturation",
  "Apple Sleeping Wrist Temperature",
  "VO2 Max",
  "Mindful Minutes",
  "Time in Daylight",
  "Walking + Running Distance",
  "Flights Climbed",
  "Dietary Caffeine",
  "Weight & Body Mass",
];

async function loadWatch(userId) {
  const today = todayStr();
  const from = addDays(today, -6);
  const [key, days, workouts, last] = await Promise.all([
    fetchWatchKey(userId),
    fetchHealthDays(userId, from, today).catch(() => []),
    fetchHealthWorkouts(userId, parseDateStr(from).toISOString()).catch(() => []),
    fetchLastHealthImport(userId).catch(() => null),
  ]);
  return { key, days, workouts, last, from, today };
}

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function Watch() {
  const { user } = useAuth();
  const userId = user?.id;
  const toast = useToast();
  const confirm = useConfirm();
  const [address, setAddress] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, error, reload } = useLoad(() => (userId ? loadWatch(userId) : null), [userId]);
  const key = data?.key;

  async function makeAddress() {
    if (key && !(await confirm({ title: "Make a new watch address?", body: "The old one stops working, so the Shortcut, the wake-up and Health Auto Export each need the new one pasted in.", confirmLabel: "Make a new one" }))) return;
    setBusy(true);
    try {
      const k = await newWatchKey();
      setAddress(watchAddress(`${SUPABASE_URL}/functions/v1/watch`, k));
      setCopied(false);
      reload();
    } catch (err) {
      toast.error(err, "Couldn't make the watch address. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.show("Copied. It's shown only once, so paste it where it goes now.");
    } catch {
      toast.show("Couldn't copy. Press and hold the address, then Select All and Copy.");
    }
  }

  async function turnOff() {
    if (!(await confirm({ title: "Turn the watch off?", body: "Its address stops working: the Shortcut, the wake-up and Health Auto Export all stop reaching the Hub.", confirmLabel: "Turn off" }))) return;
    try {
      await deleteWatchKey(userId);
      setAddress(null);
      reload();
      toast.show("Watch turned off");
    } catch (err) {
      toast.error(err, "Couldn't turn it off. Try again.");
    }
  }

  return (
    <div className="page phone-page">
      <div className="eyebrow">Settings</div>
      <h1 className="page-title">On your watch</h1>
      <p className="page-sub" style={{ marginBottom: 18 }}>Wins, timers and Today's tasks from your wrist, and what your Apple Watch measures, in the Hub.</p>

      {error && <LoadError error={error} onRetry={reload} />}

      {/* 1. The address */}
      <div className="card">
        <div className="card-head">
          <span className="card-title"><Link2 size={14} />Your watch address</span>
          {data && <span className={"phone-status" + (key ? " phone-status--on" : "")}>{lastUsedLine(key)}</span>}
        </div>
        <p className="phone-note" style={{ marginTop: 0 }}>
          One private link that the Shortcut, the wake-up and Health Auto Export all use. It's shown once; anyone who has it can log to your Hub, so keep it to your own phone.
        </p>
        {address ? (
          <div className="phone-script">
            <textarea readOnly value={address} rows={3} onFocus={(e) => e.target.select()} aria-label="Watch address" />
            <button type="button" className="btn btn--accent btn--block" onClick={copy}>
              {copied ? <Check size={15} /> : <Copy size={15} />}
              {copied ? "Copied" : "Copy address"}
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn--block phone-make" onClick={makeAddress} disabled={busy || !data}>
            {busy ? "Making it…" : key ? "Make a new address" : "Make my watch address"}
          </button>
        )}
        {key && (
          <button type="button" className="btn btn--ghost btn--sm phone-off" onClick={turnOff}>
            Turn the watch off
          </button>
        )}
      </div>

      {/* 2. The Shortcut */}
      <div className="card">
        <div className="card-head">
          <span className="card-title"><WatchIcon size={14} />The Hub on your wrist</span>
        </div>
        <p className="phone-note" style={{ marginTop: 0 }}>
          A Shortcut called <strong>Hub</strong>. Tap it on your watch and pick: <strong>Win</strong> (your usual wins in a list, or say a new one), <strong>Loss</strong>, <strong>Start</strong>, <strong>Switch</strong> or <strong>Stop</strong> a timer, <strong>Task done</strong> (today's list from Quests), <strong>Note</strong> (lands on your board), or <strong>Today</strong> at a glance.
        </p>

        {SHORTCUTS.length > 0 && (
          <div className="watch-get">
            {SHORTCUTS.map((s) => (
              <a key={s.href} href={s.href} className="btn btn--block" target="_blank" rel="noreferrer">
                <Download size={15} />
                {s.label}
              </a>
            ))}
            <p className="phone-note">Open this page on your iPhone, tap one, then Add Shortcut and paste your watch address when it asks.</p>
          </div>
        )}

        <details className="watch-build" open={SHORTCUTS.length === 0}>
          <summary>Build it yourself (about 10 minutes)</summary>
          <ol className="phone-steps">
            <li>In <strong>Shortcuts</strong> on your iPhone, tap <strong>+</strong> and name it <strong>Hub</strong>.</li>
            <li>Add <strong>Text</strong> and leave it empty, then <strong>Set Variable</strong> named <code>Step</code>.</li>
            <li>Add another empty <strong>Text</strong>, then <strong>Set Variable</strong> named <code>Answer</code>.</li>
            <li>Add <strong>Repeat</strong>, set to <strong>6</strong> times. Everything below goes inside it.</li>
            <li>
              <strong>Get Contents of URL</strong>: paste your watch address. Tap the arrow: Method <strong>POST</strong>, Request Body <strong>JSON</strong>, and add two Text fields: <code>step</code> set to the Step variable, <code>answer</code> set to the Answer variable.
            </li>
            <li><strong>Get Dictionary Value</strong>: Value for <code>kind</code> in <em>Contents of URL</em>. Then <strong>Set Variable</strong> named <code>Kind</code>.</li>
            <li>
              <strong>If</strong> Kind is <code>done</code>: <strong>Get Dictionary Value</strong> for <code>say</code> in <em>Contents of URL</em>, then <strong>Show Result</strong>, then <strong>Stop This Shortcut</strong>. End If.
            </li>
            <li><strong>Get Dictionary Value</strong> for <code>step</code> in <em>Contents of URL</em>, then <strong>Set Variable</strong> <code>Step</code>.</li>
            <li><strong>Get Dictionary Value</strong> for <code>prompt</code> in <em>Contents of URL</em>, then <strong>Set Variable</strong> named <code>Prompt</code>.</li>
            <li>
              <strong>If</strong> Kind is <code>list</code>: <strong>Get Dictionary Value</strong> for <code>options</code> in <em>Contents of URL</em>, then <strong>Choose from List</strong> with the prompt set to Prompt, then <strong>Set Variable</strong> <code>Answer</code>. <strong>Otherwise</strong>: <strong>Ask for Input</strong> (Text) with the prompt set to Prompt, then <strong>Set Variable</strong> <code>Answer</code>. End If.
            </li>
          </ol>
          <p className="phone-note">Each time it says <em>Contents of URL</em>, tap the field and pick that variable by name; Shortcuts otherwise passes along whatever came just before. For a one-tap Win button, duplicate the Shortcut, name it <strong>Win</strong>, and type <code>win</code> into the first Text.</p>
        </details>

        <ol className="phone-steps">
          <li>In Shortcuts, touch and hold <strong>Hub</strong>, tap <strong>Details</strong>, and turn on <strong>Show on Apple Watch</strong>.</li>
          <li>On your watch, touch and hold the face, tap <strong>Edit</strong>, swipe to <strong>Complications</strong>, pick a spot, and choose <strong>Shortcuts</strong>, then <strong>Hub</strong>. Do the same with <strong>Win</strong> if you made one.</li>
          <li>You can also just say <strong>“Hey Siri, Hub.”</strong></li>
        </ol>
      </div>

      {/* 3. Waking up */}
      <div className="card">
        <div className="card-head">
          <span className="card-title"><AlarmClock size={14} />When you wake up</span>
        </div>
        <p className="phone-note" style={{ marginTop: 0 }}>
          Records the moment you're up, even with the phone locked: a running Sleep timer stops (so the morning check-in already has your night) and today's wake time is kept with your watch data.
        </p>
        <ol className="phone-steps">
          <li>In Shortcuts, tap <strong>Automation</strong>, then <strong>+</strong>, then <strong>Sleep</strong>. Choose <strong>Waking Up</strong> and <strong>Run Immediately</strong>, then <strong>Next</strong>.</li>
          <li>
            Tap <strong>New Blank Automation</strong> and add <strong>Get Contents of URL</strong> with your watch address. Tap the arrow: Method <strong>POST</strong>, Request Body <strong>JSON</strong>, and add one Text field: <code>go</code> set to <code>woke</code>.
          </li>
        </ol>
      </div>

      {/* 4. Health */}
      <div className="card">
        <div className="card-head">
          <span className="card-title"><HeartPulse size={14} />Sleep, workouts and health</span>
          {data?.last && <span className="phone-status phone-status--on">Synced {ago(data.last.received_at)}</span>}
        </div>
        <p className="phone-note" style={{ marginTop: 0 }}>
          Health Auto Export sends what your watch measures. Each night's sleep goes into your minutes as Sleep (unless you logged it), each workout as Exercise (unless you timed it), and the day's numbers sit quietly beside the evening and the Sunday mirror. Nothing becomes a win on its own.
        </p>
        <ol className="phone-steps">
          <li>
            <strong>Get Health Auto Export</strong> and allow it to read Health.{" "}
            <a href={HAE} target="_blank" rel="noreferrer" className="phone-link">
              App Store <ExternalLink size={12} />
            </a>
          </li>
          <li>Open <strong>Automations</strong>, tap <strong>+</strong>, and choose <strong>REST API</strong>. Paste your watch address as the URL.</li>
          <li>
            Data type <strong>Health Metrics</strong>, format <strong>JSON</strong>, grouped by <strong>Day</strong>, sleep summarized if it offers it. Pick these metrics: {HAE_METRICS.join(", ")}.
          </li>
          <li>Make a second REST API automation the same way with data type <strong>Workouts</strong>.</li>
          <li>Turn both on, and use the manual export to send the last 30 days once so the history fills in.</li>
        </ol>
        <p className="phone-note">iPhone keeps Health locked while the phone is locked, so new numbers arrive after you unlock it.</p>
        {data?.last?.summary && <ImportLine summary={data.last.summary} />}
      </div>

      {/* 5. What's come in */}
      {data && (data.days.length > 0 || data.workouts.length > 0) && <Received days={data.days} workouts={data.workouts} today={data.today} />}
    </div>
  );
}

function ImportLine({ summary }) {
  const bits = [];
  if (summary.days) bits.push(`${summary.days} ${summary.days === 1 ? "day" : "days"} of numbers`);
  if (summary.nights) bits.push(`${summary.nights} ${summary.nights === 1 ? "night" : "nights"}`);
  if (summary.workouts) bits.push(`${summary.workouts} ${summary.workouts === 1 ? "workout" : "workouts"}`);
  const added = [summary.sleepAdded && `${summary.sleepAdded} Sleep`, summary.workoutsAdded && `${summary.workoutsAdded} Exercise`].filter(Boolean);
  return (
    <p className="phone-note">
      Last sync: {bits.length ? bits.join(", ") : "nothing new"}
      {added.length ? `; added ${added.join(" and ")} to your minutes` : ""}.
      {summary.unknown?.length ? ` Not used yet: ${summary.unknown.slice(0, 6).join(", ")}.` : ""}
    </p>
  );
}

// The last seven days, newest first: sleep, steps, resting heart rate and
// the day's workouts.
function Received({ days, workouts, today }) {
  const byDate = new Map(days.map((d) => [String(d.date).slice(0, 10), d]));
  const dates = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  const workoutsOn = (date) => workouts.filter((w) => {
    const start = parseDateStr(date).getTime();
    const t = new Date(w.started_at).getTime();
    return t >= start && t < start + 86400000;
  });
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><HeartPulse size={14} />This week from your watch</span>
      </div>
      <div className="watch-days">
        {dates.map((date) => {
          const d = byDate.get(date);
          const w = workoutsOn(date);
          if (!d && !w.length) return null;
          return (
            <div key={date} className="watch-day">
              <span className="watch-day__date">{fmtDayHeading(date)}</span>
              <span className="watch-day__nums mono">
                {[d?.asleep_min && `${fmtMins(d.asleep_min)} sleep`, d?.steps && `${Math.round(d.steps).toLocaleString("en-US")} steps`, d?.resting_hr && `RHR ${Math.round(d.resting_hr)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {w.length > 0 && <span className="watch-day__workouts">{w.map((x) => `${workoutName(x.name)} ${fmtMins(x.minutes)}`).join(", ")}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
