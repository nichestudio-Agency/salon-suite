import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
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
import { CustomerNotificationsPage } from "./pages/CustomerNotificationsPage";
import { CustomerAppointmentsPage } from "./pages/CustomerAppointmentsPage";
import { SalonSupportPage } from "./pages/SalonSupportPage";
import { PlatformSupportPage } from "./pages/PlatformSupportPage";
import { DataImportPage } from "./pages/DataImportPage";
import { SalonAccessPage } from "./pages/SalonAccessPage";
import { CashIntegrationsPage } from "./pages/CashIntegrationsPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { TutorialPage } from "./pages/TutorialPage";
import { LivePresentationPage } from "./pages/LivePresentationPage";
import { DemoAccessPage } from "./pages/DemoAccessPage";
import { PhoneDemoPage } from "./pages/PhoneDemoPage";
import { PricingPresentationPage } from "./pages/PricingPresentationPage";
import { RequireSubscriptionFeature } from "./app/RequireSubscriptionFeature";
import "./pages/customer-v3.css";

function RouteScrollReset() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <SalonTenantProvider>
          <BrowserRouter>
          <RouteScrollReset />
          <Routes>
            <Route path="/" element={<SalonAccessPage />} />
            <Route path="/salone/:code" element={<SalonAccessPage />} />
            <Route path="/accedi" element={<LoginPage />} />
            <Route path="/registrati" element={<RegisterClientPage />} />
            <Route path="/registrati-salone" element={<OnboardingPage />} />
            <Route path="/presentazione" element={<LivePresentationPage />} />
            <Route path="/presentazione-prezzi" element={<PricingPresentationPage />} />
            <Route path="/presentazione/:variant" element={<LivePresentationPage />} />
            <Route path="/demo/access/:variant/:role" element={<DemoAccessPage />} />
            <Route path="/demo/app/:variant" element={<PhoneDemoPage />} />
            <Route path="/area" element={<RoleHome />} />
            <Route element={<RequireClient><RequireSubscriptionFeature feature="app_cliente" fallback="/"><CustomerLayout /></RequireSubscriptionFeature></RequireClient>}>
              <Route path="/home" element={<CustomerHomePage />} />
              <Route path="/prenota" element={<BookingPage />} />
              <Route path="/servizi" element={<CustomerServicesPage />} />
              <Route path="/operatori" element={<CustomerOperatorsPage />} />
              <Route path="/catalogo" element={<CatalogPage />} />
              <Route path="/carrello" element={<CartPage />} />
              <Route path="/i-miei-ordini" element={<MyOrdersPage />} />
              <Route path="/fidelity" element={<LoyaltyCardPage />} />
              <Route path="/appuntamenti" element={<CustomerAppointmentsPage />} />
              <Route path="/aggiornamenti" element={<CustomerNotificationsPage />} />
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
              <Route path="prenotazioni" element={<RequireSubscriptionFeature feature="agenda"><BookingsPage /></RequireSubscriptionFeature>} />
              <Route path="statistiche" element={<RequireSubscriptionFeature feature="statistiche"><AnalyticsPage /></RequireSubscriptionFeature>} />
              <Route path="clienti" element={<RequireSubscriptionFeature feature="clienti"><ClientsPage /></RequireSubscriptionFeature>} />
              <Route path="servizi" element={<RequireSubscriptionFeature feature="servizi_team"><ServicesPage /></RequireSubscriptionFeature>} />
              <Route path="operatori" element={<RequireSubscriptionFeature feature="servizi_team"><OperatorsPage /></RequireSubscriptionFeature>} />
              <Route path="orari" element={<RequireSubscriptionFeature feature="servizi_team"><HoursPage /></RequireSubscriptionFeature>} />
              <Route path="prodotti" element={<RequireSubscriptionFeature feature="prodotti_ordini"><ProductsPage /></RequireSubscriptionFeature>} />
              <Route path="ordini" element={<RequireSubscriptionFeature feature="prodotti_ordini"><OrdersPage /></RequireSubscriptionFeature>} />
              <Route path="notifiche" element={<RequireSubscriptionFeature feature="marketing"><NotificationsPage /></RequireSubscriptionFeature>} />
              <Route path="fidelity" element={<RequireSubscriptionFeature feature="fidelity"><LoyaltyManagementPage /></RequireSubscriptionFeature>} />
              <Route path="assistenza" element={<SalonSupportPage />} />
              <Route path="tutorial" element={<TutorialPage />} />
              <Route path="importa" element={<RequireSubscriptionFeature feature="importazione"><DataImportPage /></RequireSubscriptionFeature>} />
              <Route path="integrazioni" element={<RequireSubscriptionFeature feature="integrazioni"><CashIntegrationsPage /></RequireSubscriptionFeature>} />
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
