import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  GitBranch,
  BarChart3,
  Link2,
  LogOut,
  Flame,
  BookOpen,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { todayStr } from "../lib/planDates";

// Home is the same route on both, and deliberately so: on a desktop it opens
// the wheel and the lifetime pie, on a phone it opens the capture surface.
// One address, the thing you actually reach for on that device.
export const NAV = [
  { to: "/", label: "Home", Icon: LayoutDashboard, end: true },
  { to: "/day", label: "Day", Icon: CalendarDays },
  { to: "/plan", label: "Plan", Icon: CalendarRange },
  { to: "/tree", label: "Goals", Icon: GitBranch },
  { to: "/reflect", label: "Reflect", Icon: BarChart3 },
];

// `/day` alone means today; the sidebar link has to say so explicitly or it
// would sit un-highlighted while you're looking straight at today's card.
function dayHref() {
  return `/day/${todayStr()}`;
}

export function Sidebar() {
  const { signOut } = useAuth();

  return (
    <nav className="sidebar">
      <div className="brand">
        <span className="brand-mark">
          <Flame size={16} strokeWidth={2.4} />
        </span>
        Personal Hub
      </div>

      {NAV.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to === "/day" ? dayHref() : to}
          end={end}
          className={({ isActive }) => "side-link" + (isActive ? " active" : "")}
        >
          <Icon size={17} strokeWidth={2} />
          {label}
        </NavLink>
      ))}

      <div className="side-foot">
        <NavLink to="/spirit" className={({ isActive }) => "side-link" + (isActive ? " active" : "")}>
          <BookOpen size={17} strokeWidth={2} />
          Study &amp; spirit
        </NavLink>
        <NavLink to="/links" className={({ isActive }) => "side-link" + (isActive ? " active" : "")}>
          <Link2 size={17} strokeWidth={2} />
          What feeds what
        </NavLink>
        <button className="side-link" onClick={signOut} style={{ width: "100%", background: "none", border: "none" }}>
          <LogOut size={17} strokeWidth={2} />
          Sign out
        </button>
      </div>
    </nav>
  );
}

export function TopBar() {
  const { signOut } = useAuth();
  return (
    <header className="topbar">
      <span className="brand-mark" style={{ width: 26, height: 26, borderRadius: 8 }}>
        <Flame size={14} strokeWidth={2.4} />
      </span>
      <strong style={{ fontSize: 14.5, fontWeight: 650, letterSpacing: "-0.01em" }}>Personal Hub</strong>
      <span className="spacer" />
      <button className="btn-icon" onClick={signOut} title="Sign out">
        <LogOut size={16} />
      </button>
    </header>
  );
}

export function BottomTabs() {
  return (
    <nav className="bottom-tabs">
      {NAV.map(({ to, label, Icon, end }) => (
        <NavLink
          key={to}
          to={to === "/day" ? dayHref() : to}
          end={end}
          className={({ isActive }) => "bottom-tab" + (isActive ? " active" : "")}
        >
          <Icon size={19} strokeWidth={2} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
