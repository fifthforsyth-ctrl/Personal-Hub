import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  Sun,
  CalendarRange,
  Target,
  LogOut,
  Flame,
  Wallet,
  StickyNote,
  Plus,
  Menu,
  X,
  Sparkles,
  ScanEye,
  Smartphone,
  Watch,
  Landmark,
  Castle,
  RotateCw,
  Heart,
  Wand2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCapture } from "./CaptureSheet";
import { refreshApp } from "../lib/refresh";
import { unreadLoveCount } from "../lib/love";
import "../styles/love.css";

// Five places you go, one thing you do from anywhere.
//
// The tabs are the places you actually spend time: Today, Week, Targets,
// Board and Money. Targets holds the whole ladder, biggest to smallest: the
// mission, the lifetime goals, the quests and lessons with their camps, and
// the week's focus, each with a page of its own. It took the place of both
// the Quests tab and the Range. The ＋ opens capture from wherever you are,
// and everything else lives under More.
//
// The evening isn't a tab. You go to it from the big black "Evening
// reflection" button on Today, which is where the day ends anyway, so one
// way in is enough.
export const NAV = [
  { to: "/", label: "Today", Icon: Sun, end: true },
  { to: "/plan", label: "Week", Icon: CalendarRange },
  { to: "/targets", label: "Targets", Icon: Target },
  { to: "/study", label: "Board", Icon: StickyNote },
  { to: "/money", label: "Money", Icon: Wallet },
];

// Love: what you and the one you love share. A heart with a dot while
// something from them is new; checked every minute and whenever the app
// comes back to the front.
const LOVE = { to: "/love", label: "Love", Icon: Heart };

function useLoveUnread() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!user?.id) return undefined;
    let alive = true;
    const check = () => {
      if (document.visibilityState !== "visible") return;
      unreadLoveCount()
        .then((n) => alive && setCount(n))
        .catch(() => {});
    };
    check();
    const timer = setInterval(check, 60000);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("love-changed", check);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("love-changed", check);
    };
  }, [user?.id]);
  return count;
}

// Ask: questions about your whole record, answered with words and charts.
// In the sidebar under the four places; on a phone, one tap from the top bar.
const ASK = { to: "/ask", label: "Ask", Icon: Sparkles };

// Each place has one name, the same here as on its page.
//
// Work notes and the prayer and promptings log aren't listed: neither had
// been used since August, and tender mercies are kept from the Walk with God
// card now. Both pages and everything in them are still there, at /work and
// /spirit, for the day they're wanted again. The same goes for the goal
// wheel: the Targets tab took its place (its lifetime goals are the wheel's
// top goals), and the wheel itself is still at /tree, a tap from a goal's
// edit sheet.
//
// Past days went the same way: you weren't opening it. Any day is still one
// tap away from the week strip on Today, the Week page and the evening, and
// /day/<date> still works.
export const MORE = [
  { to: "/builder", label: "Builder", Icon: Wand2 },
  { to: "/mirror", label: "Weekly mirror", Icon: ScanEye },
  { to: "/village", label: "Village", Icon: Castle },
  { to: "/temple", label: "Temple", Icon: Landmark },
  { to: "/phone", label: "On your phone", Icon: Smartphone },
  { to: "/watch", label: "On your watch", Icon: Watch },
];

function isActive(to, pathname) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

function MoreLinks({ className, iconSize }) {
  const { pathname } = useLocation();
  return MORE.map(({ to, label, Icon }) => (
    <Link key={to} to={to} className={className + (isActive(to, pathname) ? " active" : "")} aria-current={isActive(to, pathname) ? "page" : undefined}>
      <Icon size={iconSize} strokeWidth={2} />
      {label}
    </Link>
  ));
}

// Signing out asks first, in place: it's one tap from every page, and a
// slip on a phone means typing the password back in with one thumb.
function SignOut({ className, iconSize }) {
  const { signOut } = useAuth();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        <LogOut size={iconSize} strokeWidth={2} />
        Sign out
      </button>
    );
  }

  return (
    <div className="signout-ask" role="group" aria-label="Sign out">
      <span>Sign out on this device?</span>
      <div className="signout-ask__actions">
        <button type="button" className="btn btn--sm" onClick={() => setAsking(false)} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn--sm btn--accent"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await signOut();
          }}
        >
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
    </div>
  );
}

// Loads the page again with everything fresh, for a change just made on
// another device. It turns while it works.
function RefreshButton({ size = 18 }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={"btn-icon refresh-btn" + (busy ? " busy" : "")}
      aria-label="Refresh"
      title="Refresh"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        refreshApp();
      }}
    >
      <RotateCw size={size} />
    </button>
  );
}

export function Sidebar() {
  const capture = useCapture();
  const unread = useLoveUnread();

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <span className="brand-mark">
          <Flame size={16} strokeWidth={2.4} />
        </span>
        Personal Hub
        <RefreshButton size={16} />
      </div>

      <button className="btn btn--accent side-capture" onClick={() => capture.open()}>
        <Plus size={15} strokeWidth={2.6} />
        Capture
      </button>

      {[...NAV, ASK].map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive: on }) => "side-link" + (on ? " active" : "")}>
          <Icon size={17} strokeWidth={2} />
          {label}
        </NavLink>
      ))}
      <NavLink to={LOVE.to} className={({ isActive: on }) => "side-link" + (on ? " active" : "")}>
        <Heart size={17} strokeWidth={2} />
        Love
        {unread > 0 && <span className="love-nav__count" aria-label={`${unread} new`}>{unread}</span>}
      </NavLink>

      <div className="side-foot">
        <div className="eyebrow" style={{ padding: "0 11px 6px" }}>More</div>
        <MoreLinks className="side-link side-link--sm" iconSize={15} />
        <div className="side-signout">
          <SignOut className="side-link side-link--sm side-link--quiet" iconSize={15} />
        </div>
      </div>
    </nav>
  );
}

export function TopBar() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const unread = useLoveUnread();

  // Following a link out of the menu should close it.
  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="topbar">
        <span className="brand-mark" style={{ width: 26, height: 26, borderRadius: 8 }}>
          <Flame size={14} strokeWidth={2.4} />
        </span>
        <strong style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: "-0.01em" }}>Personal Hub</strong>
        <span className="spacer" />
        <RefreshButton />
        <NavLink
          to="/love"
          className={({ isActive: on }) => "btn-icon love-nav" + (on ? " active" : "")}
          aria-label={unread > 0 ? `Love, ${unread} new` : "Love"}
          title="Love"
        >
          <Heart size={18} fill={unread > 0 ? "currentColor" : "none"} />
          {unread > 0 && <span className="love-nav__dot" />}
        </NavLink>
        <NavLink to="/ask" className={({ isActive: on }) => "btn-icon topbar-ask" + (on ? " active" : "")} aria-label="Ask" title="Ask">
          <Sparkles size={18} />
        </NavLink>
        <button className="btn-icon" onClick={() => setOpen(true)} aria-label="More" title="More" aria-expanded={open}>
          <Menu size={18} />
        </button>
      </header>

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="More" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="card-title">More</span>
              <button className="btn-icon" onClick={() => setOpen(false)} aria-label="Close" title="Close">
                <X size={17} />
              </button>
            </div>
            <nav className="more-list" aria-label="More">
              <MoreLinks className="more-link" iconSize={17} />
            </nav>
            <div className="more-signout">
              <SignOut className="more-link more-link--quiet" iconSize={17} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Round icons with their names under them: the icon is quick once you know
// it, and the word is there until you do. Five tabs and the ＋ have to fit a
// 360px phone, so the ＋ sits after the first three (Today, Week, Targets:
// the ones you're in all day) rather than dead centre. A tab stays lit on
// every page under it, so Targets shows as the place you are on a quest's
// page, a camp or a plan too (/targets/...).
export function BottomTabs() {
  const capture = useCapture();
  const tab = ({ to, label, Icon, end }) => (
    <NavLink key={to} to={to} end={end} className={({ isActive: on }) => "bottom-tab" + (on ? " active" : "")}>
      <span className="bottom-tab__icon">
        <Icon size={19} strokeWidth={1.8} />
      </span>
      <span className="bottom-tab__label">{label}</span>
    </NavLink>
  );

  return (
    <nav className="bottom-tabs" aria-label="Main">
      {NAV.slice(0, 3).map(tab)}
      <button className="bottom-plus" onClick={() => capture.open()} aria-label="Capture" title="Capture">
        <Plus size={24} strokeWidth={2.6} />
      </button>
      {NAV.slice(3).map(tab)}
    </nav>
  );
}
