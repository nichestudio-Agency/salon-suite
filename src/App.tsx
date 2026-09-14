import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./app/auth-context";
import { CartProvider } from "./app/cart-context";
import { RequireClient } from "./app/RequireClient";
import { RequireOwner } from "./app/RequireOwner";
import { RoleHome } from "./app/RoleHome";
import { DashboardLayout } from "./app/DashboardLayout";
import { CustomerLayout } from "./app/CustomerLayout";
import { SalonTenantProvider } from "./app/salon-tenant-context";
import { BookingPage } from "./pages/BookingPage";
import { BookingsPage } from "./pages/BookingsPage";
import { CartPage } from "./pages/CartPage";
import { CatalogPage } from "./pages/CatalogPage";
import { HoursPage } from "./pages/HoursPage";
import { LoginPage } from "./pages/LoginPage";
import { MyOrdersPage } from "./pages/MyOrdersPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { OperatorsPage } from "./pages/OperatorsPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductsPage } from "./pages/ProductsPage";
import { RegisterClientPage } from "./pages/RegisterClientPage";
import { ServicesPage } from "./pages/ServicesPage";
import { CustomerServicesPage } from "./pages/CustomerServicesPage";
import { CustomerOperatorsPage } from "./pages/CustomerOperatorsPage";
import { CustomerHomePage } from "./pages/CustomerHomePage";
import { DashboardHomePage } from "./pages/DashboardHomePage";
import { ClientsPage } from "./pages/ClientsPage";
import { RequireSuperAdmin } from "./app/RequireSuperAdmin";
import { PlatformLayout } from "./app/PlatformLayout";
import { PlatformDashboardPage } from "./pages/PlatformDashboardPage";
import { LoyaltyCardPage } from "./pages/LoyaltyCardPage";
import { LoyaltyManagementPage } from "./pages/LoyaltyManagementPage";
import { CustomerProfilePage } from "./pages/CustomerProfilePage";
import { CustomerSupportPage } from "./pages/CustomerSupportPage";
import { SalonSupportPage } from "./pages/SalonSupportPage";
import { PlatformSupportPage } from "./pages/PlatformSupportPage";
import { DataImportPage } from "./pages/DataImportPage";
import { SalonAccessPage } from "./pages/SalonAccessPage";
import { CashIntegrationsPage } from "./pages/CashIntegrationsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SalonTenantProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<SalonAccessPage />} />
            <Route path="/salone/:code" element={<SalonAccessPage />} />
            <Route path="/accedi" element={<LoginPage />} />
            <Route path="/registrati" element={<RegisterClientPage />} />
            <Route path="/registrati-salone" element={<OnboardingPage />} />
            <Route path="/area" element={<RoleHome />} />
            <Route element={<RequireClient><CustomerLayout /></RequireClient>}>
              <Route path="/home" element={<CustomerHomePage />} />
              <Route path="/prenota" element={<BookingPage />} />
              <Route path="/servizi" element={<CustomerServicesPage />} />
              <Route path="/operatori" element={<CustomerOperatorsPage />} />
              <Route path="/catalogo" element={<CatalogPage />} />
              <Route path="/carrello" element={<CartPage />} />
              <Route path="/i-miei-ordini" element={<MyOrdersPage />} />
              <Route path="/fidelity" element={<LoyaltyCardPage />} />
              <Route path="/profilo" element={<CustomerProfilePage />} />
              <Route path="/assistenza" element={<CustomerSupportPage />} />
            </Route>
            <Route
              path="/dashboard"
              element={
                <RequireOwner>
                  <DashboardLayout />
                </RequireOwner>
              }
            >
              <Route index element={<DashboardHomePage />} />
              <Route path="prenotazioni" element={<BookingsPage />} />
              <Route path="statistiche" element={<AnalyticsPage />} />
              <Route path="clienti" element={<ClientsPage />} />
              <Route path="servizi" element={<ServicesPage />} />
              <Route path="operatori" element={<OperatorsPage />} />
              <Route path="orari" element={<HoursPage />} />
              <Route path="prodotti" element={<ProductsPage />} />
              <Route path="ordini" element={<OrdersPage />} />
              <Route path="notifiche" element={<NotificationsPage />} />
              <Route path="fidelity" element={<LoyaltyManagementPage />} />
              <Route path="assistenza" element={<SalonSupportPage />} />
              <Route path="importa" element={<DataImportPage />} />
              <Route path="integrazioni" element={<CashIntegrationsPage />} />
            </Route>
            <Route path="/admin" element={<RequireSuperAdmin><PlatformLayout /></RequireSuperAdmin>}>
              <Route index element={<PlatformDashboardPage />} />
              <Route path="assistenza" element={<PlatformSupportPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </BrowserRouter>
        </SalonTenantProvider>
      </CartProvider>
    </AuthProvider>
  );
}
