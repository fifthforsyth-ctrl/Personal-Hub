import { useState } from "react";
import { Landmark, RefreshCw, Link2, AlertTriangle, Loader2, ShieldCheck, Pencil, Check, Unplug, X } from "lucide-react";
import { connectBank, syncBank, disconnectBank, setAccountKind, renameAccount, countUnsortedInAccount } from "../../lib/api";
import { fmtMoney } from "../../lib/money";
import { friendlyError } from "../../lib/errors";
import { useToast, useConfirm } from "../ui/Feedback";

// Connecting, and the two accounts once connected.

// What SimpleFIN says when a setup token can't be used. These are already
// plain sentences that tell you what to do, so they're shown as they are;
// anything else gets plain words instead of whatever the server said.
const CLAIM_SENTENCES = [
  /^That doesn't look like a SimpleFIN setup token/,
  /^That token doesn't point at SimpleFIN Bridge/,
  /^SimpleFIN says that token has already been used/,
  /^Paste the setup token/,
];

function claimProblem(err) {
  const message = err?.message ?? "";
  if (CLAIM_SENTENCES.some((re) => re.test(message))) return message;
  if (/^SimpleFIN refused the token/.test(message)) return "SimpleFIN refused that token. Make a new one in SimpleFIN Bridge and paste that.";
  if (/^SimpleFIN returned something/.test(message)) return "SimpleFIN sent back something unexpected. Make a new token and try again.";
  return friendlyError(err, "Couldn't connect. Try again in a minute.");
}

// The last sync's failure, as what to do about it. The server stores its own
// wording ("Reconnect it from the Money page", "SimpleFIN returned 500."),
// which says nothing useful once you're already on the Money page.
function connectionProblem(lastError) {
  const message = lastError ?? "";
  if (/no longer accepts this connection/i.test(message)) {
    return { text: "Chase needs reconnecting. Get a new setup token at SimpleFIN Bridge and paste it here.", reconnect: true };
  }
  if (/subscription needs paying/i.test(message)) {
    return { text: "SimpleFIN Bridge says the subscription has run out. Renew it there, then sync again.", renew: true };
  }
  if (/^Saving the sync failed/i.test(message)) {
    return { text: "The last sync reached Chase but couldn't be saved. Try syncing again." };
  }
  return { text: "The last sync didn't go through. Try syncing again, and reconnect if it keeps happening.", reconnect: true };
}

export function ConnectBank({ onConnected, reconnect = false, onCancel }) {
  const toast = useToast();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function connect(e) {
    e.preventDefault();
    if (!token.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await connectBank(token.trim());
      // The token is spent the moment it is claimed. Clearing it here means it
      // isn't sitting in the page afterwards either.
      setToken("");
      toast.show(reconnect ? "Reconnected" : "Connected");
      onConnected();
    } catch (err) {
      setError(claimProblem(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card--accent">
      <div className="card-head">
        <span className="card-title"><Landmark size={14} />{reconnect ? "Reconnect Chase" : "Connect your Chase accounts"}</span>
        {onCancel && (
          <button type="button" className="btn-icon" onClick={onCancel} disabled={busy} aria-label="Cancel reconnecting" title="Cancel">
            <X size={16} />
          </button>
        )}
      </div>

      {reconnect ? (
        <p className="card-note" style={{ marginBottom: 14 }}>
          In <a href="https://bridge.simplefin.org" target="_blank" rel="noopener noreferrer">SimpleFIN Bridge</a>, check
          Chase is still signed in, then create a new <strong>setup token</strong> and paste it below. Your transactions,
          budgets and receipts stay as they are.
        </p>
      ) : (
        <ol className="money-connect-steps">
          <li>
            Sign up for <a href="https://bridge.simplefin.org" target="_blank" rel="noopener noreferrer">SimpleFIN Bridge</a>{" "}
            ($15 a year).
          </li>
          <li>In SimpleFIN, add Chase and sign in there. Make sure both checking accounts are included.</li>
          <li>Create a <strong>setup token</strong> in SimpleFIN and paste it below.</li>
        </ol>
      )}

      <form onSubmit={connect} className="stack stack--tight">
        <input
          className="input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the setup token"
          aria-label="Setup token"
          autoComplete="off"
          spellCheck={false}
          style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}
        />
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn--accent" disabled={busy || !token.trim()}>
          {busy ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />}
          {busy ? "Connecting and reading 90 days…" : reconnect ? "Reconnect" : "Connect"}
        </button>
      </form>

      <div className="money-connect-safe">
        <ShieldCheck size={14} style={{ color: "var(--good)", flexShrink: 0, marginTop: 2 }} />
        <p>
          Your Chase login is entered on SimpleFIN's site, never here. The token is used once and thrown away; what
          it's exchanged for is read-only, kept server-side, and never sent back to this page. Nothing here can move
          money.
        </p>
      </div>
    </div>
  );
}

// What a manual sync came back with, in words.
function syncNote(r) {
  if (r?.skipped === "synced in the last 15 minutes") return "Already up to date: it synced in the last 15 minutes.";
  if (r?.skipped === "not connected") return "Not connected, so there's nothing to sync.";
  if (r?.skipped) return "The connection key is missing. Reconnect to keep syncing.";
  const n = Number(r?.new) || 0;
  return n > 0 ? `${n} new ${n === 1 ? "transaction" : "transactions"}.` : "Nothing new.";
}

export function AccountCards({ overview, onChanged, onReconnect, reconnecting = false }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [note, setNote] = useState(null);
  const conn = overview?.connection;
  const accounts = (overview?.accounts ?? []).filter((a) => !a.hidden);
  const problem = conn?.status === "error" ? connectionProblem(conn.last_error) : null;

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    setNote(null);
    try {
      setNote(syncNote(await syncBank()));
    } catch (err) {
      // A failed sync is stored on the connection, so the banner above the
      // accounts says what to do; this line only says it happened.
      setNote(friendlyError(err, "The sync didn't go through."));
    } finally {
      setSyncing(false);
      onChanged();
    }
  }

  async function disconnect() {
    if (disconnecting) return;
    const ok = await confirm({
      title: "Disconnect Chase?",
      body: "The stored access key is destroyed and syncing stops. Your transactions, budgets and receipts stay. Connecting again takes a new setup token from SimpleFIN Bridge.",
      confirmLabel: "Disconnect",
    });
    if (!ok) return;
    setDisconnecting(true);
    try {
      await disconnectBank();
      toast.show("Disconnected");
      onChanged();
    } catch (err) {
      toast.error(err, "Couldn't disconnect. Try again.");
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <div className="stack stack--tight">
      {problem && !reconnecting && (
        <div className="money-banner" role="alert">
          <AlertTriangle size={15} className="money-banner__icon" />
          <span className="money-banner__text">{problem.text}</span>
          <span className="money-banner__actions">
            {problem.renew && (
              <a className="btn btn--sm" href="https://bridge.simplefin.org" target="_blank" rel="noopener noreferrer">
                Open SimpleFIN Bridge
              </a>
            )}
            {problem.reconnect && (
              <button type="button" className="btn btn--sm btn--accent" onClick={onReconnect}>
                Reconnect
              </button>
            )}
          </span>
        </div>
      )}
      {/* Warnings from a sync that otherwise worked: SimpleFIN's own words,
          quietly, since nothing here needs doing about them. */}
      {conn?.status === "connected" && conn.last_error && (
        <div className="money-banner money-banner--quiet">
          <AlertTriangle size={14} className="money-banner__icon" />
          <span className="money-banner__text">SimpleFIN says: {conn.last_error}</span>
        </div>
      )}

      <div className="money-accounts">
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} onChanged={onChanged} />
        ))}
      </div>

      <div className="money-sync">
        <span className="money-sync__note">
          {conn?.last_synced_at
            ? `Synced ${new Date(conn.last_synced_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · syncs at 7am and 7pm`
            : "Not synced yet"}
          {note ? ` · ${note}` : ""}
        </span>
        <span className="money-sync__actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={disconnect} disabled={disconnecting || syncing}>
            {disconnecting ? <Loader2 size={13} className="spin" /> : <Unplug size={13} />}
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </button>
          <button type="button" className="btn btn--sm money-sync__btn" onClick={sync} disabled={syncing || disconnecting}>
            {syncing ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
            {syncing ? "Syncing…" : "Sync now"}
          </button>
        </span>
      </div>
    </div>
  );
}

// A day and a half: SimpleFIN refreshes from the bank about daily.
const STALE_MS = 36 * 3600 * 1000;

function AccountCard({ account, onChanged }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(account.nickname ?? "");
  const [busy, setBusy] = useState(false);
  const label = account.nickname || account.name;
  const stale = account.as_of && Date.now() - Date.parse(account.as_of) > STALE_MS;

  async function rename(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await renameAccount(account.id, nickname);
      setEditing(false);
      onChanged();
    } catch (err) {
      toast.error(err, "Couldn't rename it. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Changing the kind carries through to every purchase in the account that
  // hasn't been answered yet, so it asks first and says how many.
  async function changeKind(kind) {
    if (busy || account.kind === kind) return;
    setBusy(true);
    try {
      const count = await countUnsortedInAccount(account.id);
      const ok = await confirm({
        title: `Make ${label} a ${kind} account?`,
        body:
          count > 0
            ? `Its ${count} unsorted ${count === 1 ? "purchase" : "purchases"} will be marked as ${kind} too. Purchases you've already sorted stay as they are.`
            : `New purchases from it will start out as ${kind}. Purchases you've already sorted stay as they are.`,
        confirmLabel: kind === "business" ? "Make it business" : "Make it personal",
        danger: false,
      });
      if (!ok) return;
      await setAccountKind(account.id, kind);
      onChanged();
    } catch (err) {
      toast.error(err, "Couldn't change that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stat money-account">
      <div className="stat-top">
        {editing ? (
          <form className="money-account__rename" onSubmit={rename}>
            <input
              className="input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
              placeholder={account.name}
              aria-label="Account name"
              autoFocus
            />
            <button type="submit" className="btn-icon" disabled={busy} aria-label="Save the name" title="Save">
              {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            </button>
            <button type="button" className="btn-icon" disabled={busy} onClick={() => setEditing(false)} aria-label="Cancel renaming" title="Cancel">
              <X size={15} />
            </button>
          </form>
        ) : (
          <span className="stat-label money-account__name">
            <span className="truncate">{label}</span>
            <button
              type="button"
              className="btn-icon"
              onClick={() => {
                setNickname(account.nickname ?? "");
                setEditing(true);
              }}
              aria-label={`Rename ${label}`}
              title="Rename"
            >
              <Pencil size={13} />
            </button>
          </span>
        )}
      </div>

      {/* Available leads, because it's what you can actually spend: Chase
          counts a pending paycheck in it the same day, while the posted
          balance waits until the deposit clears. Showing posted in big type
          made a just-arrived paycheck look missing. */}
      <div className="stat-value">{fmtMoney(account.available ?? account.balance)}</div>
      {account.available != null && Number(account.available) !== Number(account.balance) && (
        <div className="money-account__sub">
          available · {fmtMoney(account.balance)} posted
          <span style={{ color: Number(account.available) > Number(account.balance) ? "var(--good-text)" : "var(--text-2)" }}>
            {" · "}
            {Number(account.available) > Number(account.balance) ? "+" : "−"}
            {fmtMoney(Math.abs(Number(account.available) - Number(account.balance)))} pending
          </span>
        </div>
      )}

      <div className="money-account__foot">
        {/* SimpleFIN only knows what it last fetched from Chase. When that's
            old, syncing more often changes nothing, so it says so in words
            rather than in a tooltip a phone can't show. */}
        <span className={"money-account__asof" + (stale ? " is-stale" : "")}>
          {account.as_of ? `As of ${new Date(account.as_of).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
          {stale && (
            <>
              <br />
              SimpleFIN hasn't heard from Chase since. Check Chase at SimpleFIN Bridge.
            </>
          )}
        </span>
        {/* Decides the default for everything in this account. Correctable
            here because the name-based guess on first sync can be wrong. */}
        <div className="seg money-kind" role="group" aria-label={`${label} is a`}>
          {["personal", "business"].map((k) => (
            <button
              key={k}
              type="button"
              className={"seg-btn" + (account.kind === k ? " active" : "")}
              aria-pressed={account.kind === k}
              disabled={busy}
              onClick={() => changeKind(k)}
            >
              {k === "personal" ? "Personal" : "Business"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
