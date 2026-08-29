import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Today from "./pages/Today";
import Plan from "./pages/Plan";
import Spirit from "./pages/Spirit";
import Tree from "./pages/Tree";
import Reflect from "./pages/Reflect";
import Archive from "./pages/Archive";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/today" element={<Today />} />
            <Route path="/plan" element={<Plan />} />
            <Route path="/spirit" element={<Spirit />} />
            <Route path="/tree" element={<Tree />} />
            <Route path="/reflect" element={<Reflect />} />
            <Route path="/archive" element={<Archive />} />
          </Route>

          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="*" element={<Navigate to="/today" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
