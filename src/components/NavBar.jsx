import { useEffect, useState } from "react";
import { NavLink, Link, useLocation } from "react-router-dom";
import {
  Sun,
  CalendarDays,
  Target,
  Columns2,
  LogOut,
  Flame,
  Wallet,
  StickyNote,
  Plus,
  Mic,
  Menu,
  X,
  Sparkles,
  Smartphone,
  Watch,
  Landmark,
  RotateCw,
  Heart,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCapture } from "./CaptureSheet";
import VoiceSheet from "./VoiceSheet";
import { unlockAudio } from "../lib/voice";
import { refreshApp } from "../lib/refresh";
import { unreadLoveCount } from "../lib/love";
import "../styles/love.css";
import { overlay } from "./ui/Overlay";

// Six places you go, one thing you do from anywhere.
//
// The tabs are the places you actually spend time: Today, Week, Tasks,
// Targets, Board and Money. Tasks holds every list: each quest's today,
// ongoing list, camps and clipboard, and plain lists for anything else
// (Aaron, 2026-11-22). Targets holds the whole ladder, biggest to smallest: the
// mission, the lifetime goals, the quests and lessons with their camps, and
// the week's focus, each with a page of its own. It took the place of both
// the Quests tab and the Range. The mic (the ＋ until 2026-11-23) takes
// anything you say from wherever you are,
// and everything else lives under More.
//
// The evening isn't a tab. You go to it from the big black "Evening
// reflection" button on Today, which is where the day ends anyway, so one
// way in is enough.
export const NAV = [
  { to: "/", label: "Today", Icon: Sun, end: true },
  { to: "/plan", label: "Week", Icon: CalendarDays },
  { to: "/tasks", label: "Tasks", Icon: Columns2 },
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
// In the sidebar under the six places; on a phone, in the menu.
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
// Past days went the same way: you weren't opening it. Any day is still a
// tap away from the Week page and the evening, and /day/<date> still works.
export const MORE = [
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

// The top of a phone page (Clean slate, 2026-11-23). There's no brand bar:
// the page's own title leads, and the corner holds the clipboard chip (the
// pull-down clipboard puts it in the slot here) and one menu button. The
// menu is everything that isn't a tab: Love, Ask, Temple, the phone and
// watch settings, Refresh and Sign out. A dot on the button says something
// new is waiting on Love.
export function PhoneTop() {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const location = useLocation();
  const unread = useLoveUnread();
  const on = (to) => isActive(to, location.pathname);

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
      <div className="phone-top">
        <span className="phone-top__slot" id="hub-clip-slot" />
        <button
          type="button"
          className="hub-menu"
          onClick={() => setOpen(true)}
          aria-label={unread > 0 ? `Menu, ${unread} new on Love` : "Menu"}
          title="Menu"
          aria-expanded={open}
        >
          <Menu size={20} strokeWidth={2.1} />
          {unread > 0 && <span className="hub-menu__dot" />}
        </button>
      </div>

      {open && overlay(
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="card-title">Menu</span>
              <button className="btn-icon" onClick={() => setOpen(false)} aria-label="Close" title="Close">
                <X size={17} />
              </button>
            </div>
            <nav className="more-list" aria-label="Menu">
              <Link to={LOVE.to} className={"more-link" + (on(LOVE.to) ? " active" : "")} aria-current={on(LOVE.to) ? "page" : undefined}>
                <Heart size={17} strokeWidth={2} />
                Love
                {unread > 0 && <span className="more-link__count" aria-label={`${unread} new`}>{unread}</span>}
              </Link>
              <Link to={ASK.to} className={"more-link" + (on(ASK.to) ? " active" : "")} aria-current={on(ASK.to) ? "page" : undefined}>
                <Sparkles size={17} strokeWidth={2} />
                Ask the Hub
              </Link>
              <MoreLinks className="more-link" iconSize={17} />
              <button
                type="button"
                className={"more-link" + (refreshing ? " busy" : "")}
                disabled={refreshing}
                onClick={() => {
                  setRefreshing(true);
                  refreshApp();
                }}
              >
                <RotateCw size={17} strokeWidth={2} />
                {refreshing ? "Refreshing…" : "Refresh"}
              </button>
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

// Plain icons with their names under them: the icon is quick once you know
// it, and the word is there until you do. Seven even slots: three tabs
// (Today, Week, Tasks: the ones you're in all day), the mic in the middle,
// three more. The round button was a ＋ for capture; since 2026-11-23 it's a
// mic (Aaron): say what you want done and the Hub does it and answers out
// loud. Capture is a tap away at the bottom of the voice sheet. A tab stays
// lit on every page under it, so Targets shows as the place you are on a
// quest's page, a camp or a plan too (/targets/...).
export function BottomTabs() {
  const capture = useCapture();
  const [talking, setTalking] = useState(false);
  const tab = ({ to, label, Icon, end }) => (
    <NavLink key={to} to={to} end={end} className={({ isActive: on }) => "bottom-tab" + (on ? " active" : "")}>
      <span className="bottom-tab__icon">
        <Icon size={22} strokeWidth={1.8} />
      </span>
      <span className="bottom-tab__label">{label}</span>
    </NavLink>
  );

  return (
    <nav className="bottom-tabs" aria-label="Main">
      {NAV.slice(0, 3).map(tab)}
      <button
        className="bottom-plus"
        onClick={() => {
          // Inside the tap, so the spoken answer is allowed to play later.
          unlockAudio();
          setTalking(true);
        }}
        aria-label="Speak to the Hub"
        title="Speak to the Hub"
      >
        <Mic size={24} strokeWidth={2.2} />
      </button>
      {NAV.slice(3).map(tab)}
      {talking && (
        <VoiceSheet
          onClose={() => setTalking(false)}
          onCapture={() => {
            setTalking(false);
            capture.open();
          }}
        />
      )}
    </nav>
  );
}
