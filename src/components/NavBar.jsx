import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  Sun,
  Moon,
  CalendarRange,
  CalendarDays,
  Target,
  BarChart3,
  Link2,
  LogOut,
  Flame,
  Wallet,
  StickyNote,
  Plus,
  Menu,
  X,
  Compass,
  Sparkles,
  ScanEye,
  Smartphone,
  Landmark,
  AlarmClock,
  Castle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCapture } from "./CaptureSheet";
import { todayStr, addDays } from "../lib/planDates";

// Four places you go, one thing you do from anywhere.
//
// The app used to have ten destinations side by side, and the thing you do
// most (log a win) was three taps down. Now the tabs are the four places
// you actually spend time (Today, Week, Board, Money), the ＋ opens capture
// from wherever you are, and everything else lives under More. Nothing was
// removed; it was moved out of the way of the daily path.
export const NAV = [
  { to: "/", label: "Today", Icon: Sun, end: true },
  { to: "/plan", label: "Week", Icon: CalendarRange },
  { to: "/study", label: "Board", Icon: StickyNote },
  { to: "/money", label: "Money", Icon: Wallet },
];

// The evening is a desk ritual, so it sits in the sidebar; on a phone it's
// reached from the banner Today shows after dark, or from More.
const EVENING = { to: "/evening", label: "Evening", Icon: Moon };

// Ask: questions about your whole record, answered with words and charts.
// In the sidebar under the four places; on a phone, one tap from the top bar.
const ASK = { to: "/ask", label: "Ask", Icon: Sparkles };

// Each place has one name, the same here as on its page.
//
// Work notes and the prayer and promptings log aren't listed: neither had
// been used since August, and tender mercies are kept from the Walk with God
// card now. Both pages and everything in them are still there, at /work and
// /spirit, for the day they're wanted again. The same goes for the goal
// wheel: the Range took its place, and the wheel is still at /tree.
export const MORE = [
  { to: "/evening", label: "Evening", Icon: Moon },
  { to: "/day", label: "Past days", Icon: CalendarDays },
  { to: "/mirror", label: "Weekly mirror", Icon: ScanEye },
  { to: "/overview", label: "Big picture", Icon: Compass },
  { to: "/ascent", label: "The Range", Icon: Target },
  { to: "/village", label: "Village", Icon: Castle },
  { to: "/temple", label: "Temple", Icon: Landmark },
  { to: "/wake", label: "Wake watch", Icon: AlarmClock },
  { to: "/reflect", label: "Charts", Icon: BarChart3 },
  { to: "/links", label: "Goal links", Icon: Link2 },
  { to: "/phone", label: "On your phone", Icon: Smartphone },
];

// "Past days" opens yesterday, the latest day that's over; today is on the
// tab bar already. It stays lit on whichever day you page to from there.
function hrefFor(to) {
  return to === "/day" ? `/day/${addDays(todayStr(), -1)}` : to;
}

function isActive(to, pathname) {
  return pathname === to || pathname.startsWith(`${to}/`);
}

// The sidebar leaves out the evening: it already has it up top.
function MoreLinks({ className, iconSize, withEvening = true }) {
  const { pathname } = useLocation();
  return MORE.filter((m) => withEvening || m.to !== "/evening").map(({ to, label, Icon }) => (
    <Link key={to} to={hrefFor(to)} className={className + (isActive(to, pathname) ? " active" : "")} aria-current={isActive(to, pathname) ? "page" : undefined}>
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

export function Sidebar() {
  const capture = useCapture();

  return (
    <nav className="sidebar" aria-label="Main">
      <div className="brand">
        <span className="brand-mark">
          <Flame size={16} strokeWidth={2.4} />
        </span>
        Personal Hub
      </div>

      <button className="btn btn--accent side-capture" onClick={() => capture.open()}>
        <Plus size={15} strokeWidth={2.6} />
        Capture
      </button>

      {[NAV[0], EVENING, ...NAV.slice(1), ASK].map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive: on }) => "side-link" + (on ? " active" : "")}>
          <Icon size={17} strokeWidth={2} />
          {label}
        </NavLink>
      ))}

      <div className="side-foot">
        <div className="eyebrow" style={{ padding: "0 11px 6px" }}>More</div>
        <MoreLinks className="side-link side-link--sm" iconSize={15} withEvening={false} />
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
// it, and the word is there until you do.
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
      {NAV.slice(0, 2).map(tab)}
      <button className="bottom-plus" onClick={() => capture.open()} aria-label="Capture" title="Capture">
        <Plus size={24} strokeWidth={2.6} />
      </button>
      {NAV.slice(2).map(tab)}
    </nav>
  );
}
