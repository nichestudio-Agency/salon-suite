import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./app/auth-context";
import { RequireClient } from "./app/RequireClient";
import { RequireOwner } from "./app/RequireOwner";
import { RoleHome } from "./app/RoleHome";
import { DashboardLayout } from "./app/DashboardLayout";
import { BookingPage } from "./pages/BookingPage";
import { BookingsPage } from "./pages/BookingsPage";
import { CatalogPage } from "./pages/CatalogPage";
import { HoursPage } from "./pages/HoursPage";
import { LoginPage } from "./pages/LoginPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OperatorsPage } from "./pages/OperatorsPage";
import { ProductsPage } from "./pages/ProductsPage";
import { RegisterClientPage } from "./pages/RegisterClientPage";
import { ServicesPage } from "./pages/ServicesPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/accedi" element={<LoginPage />} />
          <Route path="/registrati" element={<RegisterClientPage />} />
          <Route path="/registrati-salone" element={<OnboardingPage />} />
          <Route path="/area" element={<RoleHome />} />
          <Route
            path="/prenota"
            element={
              <RequireClient>
                <BookingPage />
              </RequireClient>
            }
          />
          <Route
            path="/catalogo"
            element={
              <RequireClient>
                <CatalogPage />
              </RequireClient>
            }
          />
          <Route
            path="/dashboard"
            element={
              <RequireOwner>
                <DashboardLayout />
              </RequireOwner>
            }
          >
            <Route index element={<Navigate to="servizi" replace />} />
            <Route path="prenotazioni" element={<BookingsPage />} />
            <Route path="servizi" element={<ServicesPage />} />
            <Route path="operatori" element={<OperatorsPage />} />
            <Route path="orari" element={<HoursPage />} />
            <Route path="prodotti" element={<ProductsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/area" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
