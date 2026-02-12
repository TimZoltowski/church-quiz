import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home.jsx";
import Host from "./pages/Host.jsx";
import Join from "./pages/Join.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/host" element={<Host />} />
      <Route path="/join" element={<Join />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}