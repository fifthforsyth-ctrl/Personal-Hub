import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Today from "./pages/Today";
import Tree from "./pages/Tree";
import History from "./pages/History";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/today" element={<Today />} />
            <Route path="/tree" element={<Tree />} />
            <Route path="/history" element={<History />} />
          </Route>

          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
