import { useEffect, useState } from "react";
import { AlarmClock, Users, MessageSquare, Send, Trash2, History } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  fetchWakeWatch,
  saveWakeWatch,
  fetchWakePeers,
  addWakePeer,
  updateWakePeer,
  deleteWakePeer,
  fetchWakeReports,
  sendWakeTest,
} from "../lib/api";
import { useLoad } from "../lib/useLoad";
import { normalizePhone, prettyPhone, wakeClock, fillMessage, shortTime, OUTCOME, deliveryLine, upStreak } from "../lib/wake";
import { todayStr } from "../lib/planDates";
import { useToast, useConfirm } from "../components/ui/Feedback";
import LoadError from "../components/ui/LoadError";
import "../styles/phone.css";
import "../styles/wake.css";

// Wake watch: at 4:35 your peers hear whether you got up.
//
// Up by 4:35 (the Sleep timer stopped, or anything else started), and they
// get "up and fighting dragons". Still asleep, and the dragons text waits
// for "I'm up" so it can carry the time. The morning is judged in the
// database every minute (0078_wake_watch.sql) and the `wake` edge function
// sends the text, so it goes whether or not the Hub is open.
//
// It starts in practice: every morning is judged and shown here, nothing is
// texted, until "Text my peers for real" is on.

const DEFAULTS = {
  enabled: false,
  live: false,
  check_at: "04:35:00",
  give_up_at: "09:00:00",
  tz: "America/Denver",
  up_text: "Aaron is successfully up and fighting dragons",
  late_text: "The sleep dragons have defeated Aaron--he woke up at {time}",
  unlogged_text: "The sleep dragons have defeated Aaron--he hasn't logged waking up yet",
};

async function loadWake(userId) {
  const [watch, peers, reports] = await Promise.all([fetchWakeWatch(userId), fetchWakePeers(userId), fetchWakeReports(userId)]);
  return { watch, peers, reports };
}

function Toggle({ on, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={"toggle" + (on ? " toggle--on" : "")} onClick={() => onChange(!on)}>
      <span className="toggle__knob" />
    </button>
  );
}

export default function Wake() {
  const { user } = useAuth();
  const userId = user?.id;
  const toast = useToast();
  const confirm = useConfirm();
  const { data, error, reload, mutate } = useLoad(() => (userId ? loadWake(userId) : null), [userId]);

  const watch = { ...DEFAULTS, ...(data?.watch ?? {}) };
  const peers = data?.peers ?? [];
  const reports = data?.reports ?? [];
  const activePeers = peers.filter((p) => p.active);

  async function save(patch, done) {
    mutate((d) => d && { ...d, watch: { ...watch, ...patch } });
    try {
      const row = await saveWakeWatch(userId, patch);
      mutate((d) => d && { ...d, watch: row });
      if (done) toast.show(done);
    } catch (err) {
      toast.error(err, "Couldn't save that. Try again.");
      reload();
    }
  }

  async function goLive(on) {
    if (on) {
      const ok = await confirm({
        title: "Text your peers for real?",
        body: activePeers.length
          ? `From the next ${shortTime(watch.check_at)}, ${activePeers.map((p) => p.name).join(" and ")} get a text every morning.`
          : "No peers are on yet, so nothing will go until you add one.",
        confirmLabel: "Turn it on",
      });
      if (!ok) return;
    }
    save({ live: on }, on ? "Live. Your peers hear from the next morning on." : "Back to practice. Nothing gets texted.");
  }

  // A morning shows, in its own time zone, as the date it was.
  const today = todayStr();
  const thisMorning = reports.find((r) => r.date === today);

  return (
    <div className="page phone-page wake-page">
      <div className="eyebrow">Peer accountability</div>
      <h1 className="page-title">Wake watch</h1>
      <p className="page-sub" style={{ marginBottom: 18 }}>
        At {shortTime(watch.check_at)} your peers hear whether you're up. If the dragons win, they hear when you got up.
      </p>

      {error && <LoadError error={error} onRetry={reload} />}

      <div className="card">
        <div className="card-head">
          <span className="card-title"><AlarmClock size={14} />The watch</span>
          {data && (
            <span className={"phone-status" + (watch.enabled ? " phone-status--on" : "")}>
              {!watch.enabled ? "Off" : watch.live ? "On · texting" : "On · practice"}
            </span>
          )}
        </div>

        <div className="phone-row">
          <div className="phone-row__text">
            <strong>Watch my mornings</strong>
            <span>Judged at {shortTime(watch.check_at)} every day. Up means "I'm up" was tapped, or another timer started.</span>
          </div>
          <Toggle on={watch.enabled} onChange={(v) => save({ enabled: v })} label="Watch my mornings" disabled={!data} />
        </div>

        <div className="phone-row">
          <div className="phone-row__text">
            <strong>Text my peers for real</strong>
            <span>{watch.live ? "On. Each morning's text goes to every peer below." : "Off: practice. Each morning shows here as it would have gone, and nobody is texted."}</span>
          </div>
          <Toggle on={watch.live} onChange={goLive} label="Text my peers for real" disabled={!data || !watch.enabled} />
        </div>

        <div className="wake-times">
          <label>
            <span>Verdict at</span>
            <input className="input" type="time" id="wake-check" value={shortTime(watch.check_at).padStart(5, "0")} onChange={(e) => e.target.value && save({ check_at: e.target.value })} />
          </label>
          <label>
            <span>Give up waiting at</span>
            <input className="input" type="time" id="wake-giveup" value={shortTime(watch.give_up_at).padStart(5, "0")} onChange={(e) => e.target.value && save({ give_up_at: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title"><History size={14} />Mornings</span>
          {upStreak(reports) > 1 && <span className="phone-status phone-status--on">{upStreak(reports)} up in a row</span>}
        </div>
        {!reports.length ? (
          <p className="phone-note">{watch.enabled ? `Tomorrow at ${shortTime(watch.check_at)} is the first one.` : "Turn the watch on and the first morning shows here."}</p>
        ) : (
          <ul className="wake-days">
            {thisMorning == null && watch.enabled && <li className="wake-day wake-day--ahead"><span className="wake-day__date">Today</span><span className="wake-day__what">Not judged</span></li>}
            {reports.map((r) => (
              <li key={r.id} className={`wake-day wake-day--${OUTCOME[r.outcome]?.tone ?? "wait"}`}>
                <span className="wake-day__date">{r.date === today ? "Today" : new Date(`${r.date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}</span>
                <span className="wake-day__what">
                  <strong>{OUTCOME[r.outcome]?.label}{r.woke_at ? ` · ${wakeClock(r.woke_at, watch.tz)}` : ""}</strong>
                  {r.message && <q>{r.message}</q>}
                  <small>{deliveryLine(r)}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PeersCard userId={userId} checkAt={shortTime(watch.check_at)} peers={peers} reload={reload} toast={toast} confirm={confirm} />

      <MessagesCard watch={watch} save={save} />
    </div>
  );
}

function PeersCard({ userId, checkAt, peers, reload, toast, confirm }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(null);

  async function add(e) {
    e.preventDefault();
    const n = name.trim();
    const p = normalizePhone(phone);
    if (!n) return toast.show("Add their name.");
    if (!p) return toast.show("That number doesn't look right. Use 10 digits, like 801 555 1234.");
    setBusy(true);
    try {
      await addWakePeer(userId, { name: n, phone: p });
      setName("");
      setPhone("");
      reload();
      toast.show(`${n} added`);
    } catch (err) {
      toast.error(err, /duplicate|unique/i.test(err?.message ?? "") ? "That number is already on the list." : "Couldn't add them. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(peer) {
    if (!(await confirm({ title: `Remove ${peer.name}?`, body: "They stop getting the morning text.", confirmLabel: "Remove" }))) return;
    try {
      await deleteWakePeer(peer.id);
      reload();
    } catch (err) {
      toast.error(err, "Couldn't remove them. Try again.");
    }
  }

  async function toggle(peer, on) {
    try {
      await updateWakePeer(peer.id, { active: on });
      reload();
    } catch (err) {
      toast.error(err, "Couldn't change that. Try again.");
    }
  }

  async function test(peer) {
    if (!(await confirm({ title: `Text ${peer.name} now?`, body: `A real text goes to ${prettyPhone(peer.phone)}, telling them about the wake watch and how to stop it.`, confirmLabel: "Send it" }))) return;
    setTesting(peer.id);
    try {
      await sendWakeTest(peer.id);
      toast.show(`Sent to ${peer.name}`);
    } catch (err) {
      toast.error(err, "The test text didn't go.");
    } finally {
      setTesting(null);
    }
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><Users size={14} />Peers</span>
      </div>
      <p className="phone-note">Only people who've said yes to a text every morning, some as early as {checkAt}.</p>

      {peers.map((p) => (
        <div key={p.id} className="phone-row">
          <div className="phone-row__text">
            <strong>{p.name}</strong>
            <span className="mono">{prettyPhone(p.phone)}</span>
          </div>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => test(p)} disabled={testing === p.id}>
            <Send size={13} />{testing === p.id ? "Sending…" : "Test"}
          </button>
          <button type="button" className="btn-icon" aria-label={`Remove ${p.name}`} onClick={() => remove(p)}>
            <Trash2 size={15} />
          </button>
          <Toggle on={p.active} onChange={(v) => toggle(p, v)} label={`Text ${p.name}`} />
        </div>
      ))}

      <form className="wake-add" onSubmit={add}>
        <input className="input" id="wake-peer-name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        <input className="input" id="wake-peer-phone" placeholder="Mobile number" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" />
        <button type="submit" className="btn btn--accent" disabled={busy}>{busy ? "Adding…" : "Add"}</button>
      </form>
    </div>
  );
}

function MessagesCard({ watch, save }) {
  const [draft, setDraft] = useState({ up_text: watch.up_text, late_text: watch.late_text, unlogged_text: watch.unlogged_text });
  useEffect(() => {
    setDraft({ up_text: watch.up_text, late_text: watch.late_text, unlogged_text: watch.unlogged_text });
  }, [watch.up_text, watch.late_text, watch.unlogged_text]);

  const changed = ["up_text", "late_text", "unlogged_text"].some((k) => draft[k].trim() !== watch[k]);
  const sample = new Date(`${todayStr()}T05:23:00`).toISOString();
  const rows = [
    ["up_text", `Up by ${shortTime(watch.check_at)}`, draft.up_text],
    ["late_text", "Up late ({time} is when)", fillMessage(draft.late_text, sample, watch.tz)],
    ["unlogged_text", `Nothing logged by ${shortTime(watch.give_up_at)}`, draft.unlogged_text],
  ];

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title"><MessageSquare size={14} />The texts</span>
      </div>
      {rows.map(([k, label, preview]) => (
        <label key={k} className="wake-msg">
          <span>{label}</span>
          <textarea className="textarea" id={`wake-${k}`} rows={2} maxLength={300} value={draft[k]} onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))} />
          {k === "late_text" && <small>Reads: {preview}</small>}
        </label>
      ))}
      <button
        type="button"
        className="btn btn--block"
        disabled={!changed || Object.values(draft).some((v) => !v.trim())}
        onClick={() => save({ up_text: draft.up_text.trim(), late_text: draft.late_text.trim(), unlogged_text: draft.unlogged_text.trim() }, "Texts saved")}
      >
        Save the texts
      </button>
    </div>
  );
}
