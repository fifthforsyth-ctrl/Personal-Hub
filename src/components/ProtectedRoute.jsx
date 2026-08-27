import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { TopBar, BottomTabs } from "./NavBar";

export default function ProtectedRoute() {
  const { user, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      <TopBar />
      <div className="app-content">
        <Outlet />
      </div>
      <BottomTabs />
    </div>
  );
}
