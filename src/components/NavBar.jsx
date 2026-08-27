import { NavLink } from "react-router-dom";
import { Sunrise, CalendarClock, BarChart3, GitBranch, ScrollText, LogOut } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export function TopBar() {
  const { signOut } = useAuth();
  return (
    <div className="top-bar">
      <div className="nav-brand">
        <GitBranch size={17} color="var(--accent-strong)" />
        Personal Hub
      </div>
      <button className="btn-ghost" onClick={signOut} title="Sign out">
        <LogOut size={14} />
      </button>
    </div>
  );
}

export function BottomTabs() {
  const tabs = [
    { to: "/today", label: "Today", Icon: Sunrise },
    { to: "/plan", label: "Plan", Icon: CalendarClock },
    { to: "/tree", label: "Tree", Icon: GitBranch },
    { to: "/reflect", label: "Reflect", Icon: BarChart3 },
    { to: "/history", label: "History", Icon: ScrollText },
  ];
  return (
    <div className="bottom-tabs">
      {tabs.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => "bottom-tab" + (isActive ? " active" : "")}>
          <Icon size={19} />
          <span>{label}</span>
        </NavLink>
      ))}
    </div>
  );
}
