import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ContentProvider } from "./lib/ContentContext";
import { HomePage } from "./pages/HomePage";
import { AdminPage } from "./pages/AdminPage";
import { MeCallbackPage } from "./pages/MeCallbackPage";

export default function App() {
  return (
    <ContentProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin/me-callback" element={<MeCallbackPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ContentProvider>
  );
}
