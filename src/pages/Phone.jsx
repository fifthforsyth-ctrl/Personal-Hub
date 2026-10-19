import { useState } from "react";
import { Smartphone, Vibrate, Volume2, Copy, Check, ExternalLink, LayoutGrid } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { fetchWidgetKey, newWidgetKey, deleteWidgetKey, fetchWinLosses, fetchTimeEntries, fetchOpenTimeEntry, fetchCategories } from "../lib/api";
import { SUPABASE_URL } from "../lib/supabaseClient";
import { useLoad } from "../lib/useLoad";
import { usePhoneFeel, setOn } from "../lib/phoneFeel";
import { playClink } from "../lib/clink";
import { haptic } from "../lib/haptics";
import { buildWidgetScript } from "../lib/widgetScript";
import { parseDateStr, todayStr } from "../lib/planDates";
import { colorFor, fmtMinutes, setCategoryColors } from "../lib/categories";
import { trackedMinutes, minutesByCategory } from "../components/today/minutes";
import { useToast, useConfirm } from "../components/ui/Feedback";
import Swords from "../components/ui/Swords";
import LoadError from "../components/ui/LoadError";
import "../styles/phone.css";

// On your phone: how the Hub feels in the hand, and today on the home screen.
//
// Haptics and the clink are switches kept on this device. The widget runs
// in Scriptable (see lib/widgetScript.js for why): this page makes the key,
// writes the script with it, and walks through the four steps of putting it
// on the home screen. The preview is today's real numbers, drawn the way
// the widget draws them.

const SCRIPTABLE = "https://apps.apple.com/app/scriptable/id1405459188";

async function loadPhone(userId) {
  const since = parseDateStr(todayStr()).toISOString();
  const [key, wl, entries, running, cats] = await Promise.all([
    fetchWidgetKey(userId),
    fetchWinLosses(userId, { sinceISO: since, limit: 200 }),
    fetchTimeEntries(userId, { sinceISO: since, limit: 200 }),
    fetchOpenTimeEntry(userId),
    fetchCategories(userId).catch(() => null),
  ]);
  if (cats) setCategoryColors(cats);
  const ended = entries.filter((e) => e.ended_at);
  return {
    key,
    wins: wl.filter((w) => w.kind === "win").length,
    losses: wl.filter((w) => w.kind === "loss").length,
    tracked: trackedMinutes(ended),
    cats: minutesByCategory(ended),
    running,
  };
}

function ago(iso) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function Toggle({ on, onChange, label }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={"toggle" + (on ? " toggle--on" : "")} onClick={() => onChange(!on)}>
      <span className="toggle__knob" />
    </button>
  );
}

export default function Phone() {
  const { user } = useAuth();
  const userId = user?.id;
  const toast = useToast();
  const confirm = useConfirm();
  const haptics = usePhoneFeel("haptics");
  const sounds = usePhoneFeel("sounds");
  const [clash, setClash] = useState(0);
  const [script, setScript] = useState(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, error, reload } = useLoad(() => (userId ? loadPhone(userId) : null), [userId]);
  const key = data?.key;

  function trySwords() {
    playClink();
    haptic("win");
    setClash((c) => c + 1);
  }

  async function makeScript() {
    if (key && !(await confirm({ title: "Make a new widget script?", body: "The widget you have now stops updating until you paste the new script into it.", confirmLabel: "Make a new one" }))) return;
    setBusy(true);
    try {
      const k = await newWidgetKey();
      setScript(buildWidgetScript({ appUrl: window.location.origin, apiUrl: `${SUPABASE_URL}/functions/v1/widget`, key: k }));
      setCopied(false);
      reload();
    } catch (err) {
      toast.error(err, "Couldn't make the widget key. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      toast.show("Copied. Paste it into a new script in Scriptable.");
    } catch {
      toast.show("Couldn't copy. Press and hold the script, then Select All and Copy.");
    }
  }

  async function turnOff() {
    if (!(await confirm({ title: "Turn the widget off?", body: "Its key stops working, so the widget shows nothing until you make a new script.", confirmLabel: "Turn off" }))) return;
    try {
      await deleteWidgetKey(userId);
      setScript(null);
      reload();
      toast.show("Widget turned off");
    } catch (err) {
      toast.error(err, "Couldn't turn the widget off. Try again.");
    }
  }

  return (
    <div className="page phone-page">
      <div className="eyebrow">Settings</div>
      <h1 className="page-title">On your phone</h1>
      <p className="page-sub" style={{ marginBottom: 18 }}>How the Hub feels in your hand, and today on your home screen.</p>

      <div className="card">
        <div className="card-head">
          <span className="card-title"><Smartphone size={14} />Feel</span>
        </div>

        <div className="phone-row">
          <Vibrate size={18} className="phone-row__icon" />
          <div className="phone-row__text">
            <strong>Haptics</strong>
            <span>A light tap on every press, a strike on every win. On iPhone it needs iOS 18 or later and System Haptics on (Settings, Sounds &amp; Haptics).</span>
          </div>
          <Toggle on={haptics} onChange={(v) => setOn("haptics", v)} label="Haptics" />
        </div>

        <div className="phone-row">
          <Volume2 size={18} className="phone-row__icon" />
          <div className="phone-row__text">
            <strong>Sounds</strong>
            <span>The swords clink when you log a win. The silent switch mutes it.</span>
          </div>
          <Toggle on={sounds} onChange={(v) => setOn("sounds", v)} label="Sounds" />
        </div>

        <button type="button" className="btn btn--block phone-try" onClick={trySwords}>
          <Swords size={20} clash={clash} />
          Try the swords
        </button>
      </div>

      <div className="card">
        <div className="card-head">
          <span className="card-title"><LayoutGrid size={14} />Home screen widget</span>
          {data && <span className={"phone-status" + (key ? " phone-status--on" : "")}>{key ? (key.last_used_at ? `On · updated ${ago(key.last_used_at)}` : "On · waiting for the widget") : "Off"}</span>}
        </div>

        {error && <LoadError error={error} onRetry={reload} />}

        <WidgetPreview data={data} />

        <ol className="phone-steps">
          <li>
            <strong>Get Scriptable</strong>, a free app that draws widgets.{" "}
            <a href={SCRIPTABLE} target="_blank" rel="noreferrer" className="phone-link">
              App Store <ExternalLink size={12} />
            </a>
          </li>
          <li>
            <strong>Make your widget script</strong> and copy it.
            {script ? (
              <div className="phone-script">
                <textarea readOnly value={script} rows={5} onFocus={(e) => e.target.select()} aria-label="Widget script" />
                <button type="button" className="btn btn--accent btn--block" onClick={copy}>
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {copied ? "Copied" : "Copy script"}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn--block phone-make" onClick={makeScript} disabled={busy || !data}>
                {busy ? "Making it…" : key ? "Make a new script" : "Make my widget script"}
              </button>
            )}
          </li>
          <li>
            <strong>In Scriptable, tap +</strong>, paste, and name it Hub at the top.
          </li>
          <li>
            <strong>Touch and hold your home screen</strong>, tap Edit, then Add Widget. Choose Scriptable and a size, add it, then tap the new widget and set Script to Hub. Small, medium and large all work, and so do the lock screen sizes.
          </li>
        </ol>
        <p className="phone-note">It refreshes on its own every few minutes (iPhone decides exactly when). Tapping it opens the Hub.</p>

        {key && (
          <button type="button" className="btn btn--ghost btn--sm phone-off" onClick={turnOff}>
            Turn the widget off
          </button>
        )}
      </div>
    </div>
  );
}

// The medium widget, drawn from today's numbers.
function WidgetPreview({ data }) {
  const cats = data?.cats ?? [];
  const total = cats.reduce((s, c) => s + c.minutes, 0);
  return (
    <div className="widget-preview" aria-label="What the widget shows">
      <div className="widget-preview__wins">
        <div className="widget-preview__eyebrow">
          <Swords size={13} className="widget-preview__swords" />
          Wins
        </div>
        <div className="widget-preview__count">{data ? data.wins : "–"}</div>
        <div className="widget-preview__losses">{data ? (data.losses === 1 ? "1 loss" : `${data.losses} losses`) : ""}</div>
      </div>
      <div className="widget-preview__minutes">
        <div className="widget-preview__head">
          <span className="widget-preview__eyebrow">Minutes</span>
          <span className="mono">{data?.tracked ? fmtMinutes(data.tracked) : "–"}</span>
        </div>
        <div className="widget-preview__bar">
          {cats.map((c) => (
            <i key={c.category} style={{ width: `${(c.minutes / total) * 100}%`, background: colorFor(c.category) }} />
          ))}
        </div>
        {cats.slice(0, data?.running ? 2 : 3).map((c) => (
          <div key={c.category} className="widget-preview__row">
            <span className="dot" style={{ background: colorFor(c.category) }} />
            <span className="truncate">{c.category}</span>
            <span className="mono muted">{fmtMinutes(c.minutes)}</span>
          </div>
        ))}
        {data?.running && (
          <div className="widget-preview__row">
            <span className="dot" style={{ background: "var(--accent)" }} />
            <strong className="truncate">{data.running.category}</strong>
            <span className="mono muted">running</span>
          </div>
        )}
      </div>
    </div>
  );
}
