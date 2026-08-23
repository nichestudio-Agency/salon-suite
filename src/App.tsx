import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./app/auth-context";
import { RequireOwner } from "./app/RequireOwner";
import { DashboardLayout } from "./app/DashboardLayout";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OperatorsPage } from "./pages/OperatorsPage";
import { ServicesPage } from "./pages/ServicesPage";

function Placeholder({ nome }: { nome: string }) {
  return <h2>{nome} (in arrivo nell'Increment 3b)</h2>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/accedi" element={<LoginPage />} />
          <Route path="/registrati-salone" element={<OnboardingPage />} />
          <Route
            path="/dashboard"
            element={
              <RequireOwner>
                <DashboardLayout />
              </RequireOwner>
            }
          >
            <Route index element={<Navigate to="servizi" replace />} />
            <Route path="servizi" element={<ServicesPage />} />
            <Route path="operatori" element={<OperatorsPage />} />
            <Route path="orari" element={<Placeholder nome="Orari" />} />
          </Route>
          <Route path="*" element={<Navigate to="/accedi" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
