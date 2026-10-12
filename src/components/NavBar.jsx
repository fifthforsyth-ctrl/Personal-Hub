import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Sun,
  Moon,
  CalendarRange,
  CalendarDays,
  GitBranch,
  BarChart3,
  Link2,
  LogOut,
  Flame,
  BookOpen,
  Briefcase,
  Wallet,
  StickyNote,
  Plus,
  Menu,
  X,
  Compass,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCapture } from "./CaptureSheet";
import { todayStr } from "../lib/planDates";

// Four places you go, one thing you do from anywhere.
//
// The app used to have ten destinations side by side, and the thing you do
// most — log a win — was three taps down. Now the tabs are the four places
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

export const MORE = [
  { to: "/evening", label: "Evening reflection", Icon: Moon },
  { to: "/day", label: "Days", Icon: CalendarDays },
  { to: "/overview", label: "Big picture", Icon: Compass },
  { to: "/tree", label: "Goal wheel", Icon: GitBranch },
  { to: "/work", label: "Work", Icon: Briefcase },
  { to: "/reflect", label: "Charts", Icon: BarChart3 },
  { to: "/spirit", label: "Promptings & prayer", Icon: BookOpen },
  { to: "/links", label: "What feeds what", Icon: Link2 },
];

// `/day` alone means today; the link has to say so explicitly or it would sit
// un-highlighted while you're looking straight at today's card.
function hrefFor(to) {
  return to === "/day" ? `/day/${todayStr()}` : to;
}

export function Sidebar() {
  const { signOut } = useAuth();
  const capture = useCapture();

  return (
    <nav className="sidebar">
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

      {[NAV[0], EVENING, ...NAV.slice(1)].map(({ to, label, Icon, end }) => (
        <NavLink key={to} to={to} end={end} className={({ isActive }) => "side-link" + (isActive ? " active" : "")}>
          <Icon size={17} strokeWidth={2} />
          {label}
        </NavLink>
      ))}

      <div className="side-foot">
        <div className="eyebrow" style={{ padding: "0 11px 6px" }}>More</div>
        {MORE.filter((m) => m.to !== "/evening").map(({ to, label, Icon }) => (
          <NavLink key={to} to={hrefFor(to)} className={({ isActive }) => "side-link side-link--sm" + (isActive ? " active" : "")}>
            <Icon size={15} strokeWidth={2} />
            {label}
          </NavLink>
        ))}
        <button className="side-link side-link--sm" onClick={signOut} style={{ width: "100%", background: "none", border: "none" }}>
          <LogOut size={15} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </nav>
  );
}

export function TopBar() {
  const [open, setOpen] = useState(false);
  const { signOut } = useAuth();
  const location = useLocation();

  // Following a link out of the menu should close it.
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <>
      <header className="topbar">
        <span className="brand-mark" style={{ width: 26, height: 26, borderRadius: 8 }}>
          <Flame size={14} strokeWidth={2.4} />
        </span>
        <strong style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: "-0.01em" }}>Personal Hub</strong>
        <span className="spacer" />
        <button className="btn-icon" onClick={() => setOpen(true)} title="More">
          <Menu size={18} />
        </button>
      </header>

      {open && (
        <div className="sheet-backdrop" onClick={() => setOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <span className="card-title">More</span>
              <button className="btn-icon" onClick={() => setOpen(false)} title="Close">
                <X size={17} />
              </button>
            </div>
            <div className="more-list">
              {MORE.map(({ to, label, Icon }) => (
                <NavLink key={to} to={hrefFor(to)} className="more-link">
                  <Icon size={17} strokeWidth={2} />
                  {label}
                </NavLink>
              ))}
              <button className="more-link" onClick={signOut}>
                <LogOut size={17} strokeWidth={2} />
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function BottomTabs() {
  const capture = useCapture();
  const tab = ({ to, label, Icon, end }) => (
    <NavLink key={to} to={to} end={end} className={({ isActive }) => "bottom-tab" + (isActive ? " active" : "")}>
      <Icon size={19} strokeWidth={2} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <nav className="bottom-tabs">
      {NAV.slice(0, 2).map(tab)}
      <button className="bottom-plus" onClick={() => capture.open()} aria-label="Capture">
        <Plus size={24} strokeWidth={2.6} />
      </button>
      {NAV.slice(2).map(tab)}
    </nav>
  );
}
