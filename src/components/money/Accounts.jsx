import { useState } from "react";
import { Landmark, RefreshCw, Link2, AlertTriangle, Loader2, ShieldCheck, Pencil, Check, Unplug } from "lucide-react";
import { connectBank, syncBank, disconnectBank, setAccountKind, renameAccount } from "../../lib/api";
import { fmtMoney } from "../../lib/money";

// Connecting, and the two accounts once connected.
export function ConnectBank({ onConnected }) {
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
      await onConnected();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card card--accent">
      <div className="card-head">
        <span className="card-title"><Landmark size={14} />Connect your Chase accounts</span>
      </div>

      <ol style={{ margin: "0 0 16px", paddingLeft: 20, fontSize: 13.5, lineHeight: 1.75 }}>
        <li>
          Sign up for <a href="https://bridge.simplefin.org" target="_blank" rel="noopener noreferrer">SimpleFIN Bridge</a>{" "}
          ($15 a year).
        </li>
        <li>In SimpleFIN, add Chase and sign in there. Make sure both checking accounts are included.</li>
        <li>Create a <strong>setup token</strong> in SimpleFIN and paste it below.</li>
      </ol>

      <form onSubmit={connect} className="stack stack--tight">
        <input
          className="input"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="Paste the setup token"
          autoComplete="off"
          spellCheck={false}
          style={{ fontFamily: "var(--font-mono)", fontSize: 12.5 }}
        />
        {error && <div className="form-error">{error}</div>}
        <button type="submit" className="btn btn--accent" disabled={busy || !token.trim()}>
          {busy ? <Loader2 size={14} className="spin" /> : <Link2 size={14} />}
          {busy ? "Connecting and reading 90 days…" : "Connect"}
        </button>
      </form>

      <div className="row" style={{ gap: 8, alignItems: "flex-start", marginTop: 14 }}>
        <ShieldCheck size={14} style={{ color: "var(--good)", flexShrink: 0, marginTop: 2 }} />
        <p className="faint" style={{ fontSize: 11.5, lineHeight: 1.55, margin: 0 }}>
          Your Chase login is entered on SimpleFIN's site, never here. The token is used once and thrown away; what
          it's exchanged for is read-only, kept server-side, and never sent back to this page. Nothing here can move
          money.
        </p>
      </div>
    </div>
  );
}

export function AccountCards({ overview, onChanged }) {
  const [syncing, setSyncing] = useState(false);
  const [note, setNote] = useState(null);
  const conn = overview?.connection;
  const accounts = (overview?.accounts ?? []).filter((a) => !a.hidden);

  async function sync() {
    setSyncing(true);
    setNote(null);
    try {
      const r = await syncBank();
      if (r.skipped) setNote(r.skipped === "synced in the last 15 minutes" ? "Already synced in the last 15 minutes." : r.skipped);
      else setNote(r.new > 0 ? `${r.new} new ${r.new === 1 ? "transaction" : "transactions"}.` : "Nothing new.");
      await onChanged();
    } catch (err) {
      setNote(err.message);
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect the bank? The stored access key is destroyed. Your transactions, budgets and receipts stay.")) return;
    await disconnectBank();
    await onChanged();
  }

  return (
    <div className="stack stack--tight">
      {conn?.status === "error" && (
        <div className="form-error row" style={{ gap: 8 }}>
          <AlertTriangle size={14} style={{ flexShrink: 0 }} />
          <span>{conn.last_error}</span>
        </div>
      )}
      {conn?.status === "connected" && conn.last_error && (
        <div className="card card--quiet row" style={{ gap: 8, padding: 12 }}>
          <AlertTriangle size={14} style={{ color: "var(--accent)", flexShrink: 0 }} />
          <span style={{ fontSize: 12.5 }}>SimpleFIN says: {conn.last_error}</span>
        </div>
      )}

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
        {accounts.map((a) => (
          <AccountCard key={a.id} account={a} onChanged={onChanged} />
        ))}
      </div>

      <div className="row row--between" style={{ gap: 10, flexWrap: "wrap" }}>
        <span className="faint" style={{ fontSize: 11.5 }}>
          {conn?.last_synced_at
            ? `Synced ${new Date(conn.last_synced_at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · syncs at 7am and 7pm`
            : "Not synced yet"}
          {note ? ` · ${note}` : ""}
        </span>
        <div className="row" style={{ gap: 6 }}>
          <button className="btn btn--ghost" onClick={disconnect} title="Disconnect the bank">
            <Unplug size={13} />
          </button>
          <button className="btn" onClick={sync} disabled={syncing}>
            {syncing ? <Loader2 size={13} className="spin" /> : <RefreshCw size={13} />}
            Sync now
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountCard({ account, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(account.nickname ?? "");
  const isBiz = account.kind === "business";
  const label = account.nickname || account.name;

  return (
    <div className="stat" style={{ borderColor: isBiz ? "var(--accent-line)" : "var(--line)" }}>
      <div className="stat-top">
        {editing ? (
          <form
            className="row"
            style={{ gap: 5, flex: 1 }}
            onSubmit={async (e) => {
              e.preventDefault();
              await renameAccount(account.id, nickname);
              setEditing(false);
              await onChanged();
            }}
          >
            <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={account.name} style={{ padding: "5px 8px", fontSize: 12.5 }} autoFocus />
            <button type="submit" className="btn-icon"><Check size={13} /></button>
          </form>
        ) : (
          <span className="stat-label row" style={{ gap: 6, minWidth: 0 }}>
            <span className="truncate">{label}</span>
            <button className="btn-icon" style={{ width: 22, height: 22 }} onClick={() => setEditing(true)} title="Rename">
              <Pencil size={11} />
            </button>
          </span>
        )}
      </div>

      <div className="stat-value">{fmtMoney(account.balance)}</div>
      {account.available != null && Number(account.available) !== Number(account.balance) && (
        <div className="faint" style={{ fontSize: 11.5, marginTop: 3 }}>{fmtMoney(account.available)} available</div>
      )}

      <div className="row row--between" style={{ marginTop: 10, gap: 8 }}>
        <span className="stat-foot" style={{ marginTop: 0 }}>
          {account.as_of ? `as of ${new Date(account.as_of).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}
        </span>
        {/* Decides the default for everything in this account. Correctable
            here because the name-based guess on first sync can be wrong. */}
        <div className="seg" style={{ padding: 2 }}>
          {["personal", "business"].map((k) => (
            <button
              key={k}
              className={"seg-btn" + (account.kind === k ? " active" : "")}
              style={{ padding: "3px 9px", fontSize: 11 }}
              onClick={async () => {
                if (account.kind === k) return;
                await setAccountKind(account.id, k);
                await onChanged();
              }}
            >
              {k === "personal" ? "Personal" : "Business"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
