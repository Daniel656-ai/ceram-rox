import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import OrdersPage from "./pages/OrdersPage";
import CreateOrderPage from "./pages/CreateOrderPage";
import ImportOrderPage from "./pages/ImportOrderPage";
import OrderDetailPage from "./pages/OrderDetailPage";
import TaskExecutionPage from "./pages/TaskExecutionPage";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import WorkPlanPage from "./pages/WorkPlanPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminServicesPage from "./pages/AdminServicesPage";
import AdminServiceDesignerPage from "./pages/AdminServiceDesignerPage";
import AdminServicePackagesPage from "./pages/AdminServicePackagesPage";
import PortfoliosPage from "./pages/PortfoliosPage";
import PortfolioDetailPage from "./pages/PortfolioDetailPage";
import AdminWorkPackageCategoriesPage from "./pages/AdminWorkPackageCategoriesPage";

import AdminStatsPage from "./pages/AdminStatsPage";
import AdminPermissionsPage from "./pages/AdminPermissionsPage";
import AdminSyncPage from "./pages/AdminSyncPage";
import AdminRolesPage from "./pages/AdminRolesPage";
import AdminDatabasePage from "./pages/AdminDatabasePage";
import AdminHazardNotificationsPage from "./pages/AdminHazardNotificationsPage";
import AdminCompanySettingsPage from "./pages/AdminCompanySettingsPage";
import CalendarPage from "./pages/CalendarPage";
import SamplesPage from "./pages/SamplesPage";
import SampleDetailPage from "./pages/SampleDetailPage";
import ResultsDatabasePage from "./pages/ResultsDatabasePage";
import RawMaterialsPage from "./pages/RawMaterialsPage";
import RawMaterialDetailPage from "./pages/RawMaterialDetailPage";
import ContainerScanPage from "./pages/ContainerScanPage";

import LabPlanningPage from "./pages/LabPlanningPage";
import MixturesPage from "./pages/MixturesPage";
import MixtureDetailPage from "./pages/MixtureDetailPage";
import BatchExecutionPage from "./pages/BatchExecutionPage";
import NotFound from "./pages/NotFound";
import ResetPassword from "./pages/ResetPassword";
import ChangePassword from "./pages/ChangePassword";
import AdminLabelTemplatesPage from "./pages/AdminLabelTemplatesPage";
import AdminSymbolsPage from "./pages/AdminSymbolsPage";
import OAuthConsent from "./pages/OAuthConsent";


import { UpdateChecker } from "@/components/UpdateChecker";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <UpdateChecker />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  <ChangePassword />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/auftraege" element={<OrdersPage />} />
              <Route path="/auftraege/neu" element={<CreateOrderPage />} />
              <Route path="/auftraege/import" element={<ImportOrderPage />} />
              <Route path="/auftraege/:id" element={<OrderDetailPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/aufgaben/:measurementId" element={<TaskExecutionPage />} />
              <Route path="/projekte" element={<ProjectsPage />} />
              <Route path="/projekte/:id" element={<ProjectDetailPage />} />
              <Route path="/portfolios" element={<PortfoliosPage />} />
              <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
              <Route path="/proben" element={<SamplesPage />} />
              <Route path="/proben/:id" element={<SampleDetailPage />} />
              <Route path="/arbeitsplanung" element={<WorkPlanPage />} />
              <Route path="/admin/benutzer" element={<AdminUsersPage />} />
              <Route path="/admin/messdienstleistungen" element={<AdminServicesPage />} />
              <Route path="/admin/prozess-designer" element={<AdminServiceDesignerPage />} />
              <Route path="/admin/prozess-designer/:templateId" element={<AdminServiceDesignerPage />} />
              <Route path="/admin/messdienstleistungen/:serviceId/designer" element={<Navigate to="/admin/prozess-designer" replace />} />
              <Route path="/admin/servicepakete" element={<AdminServicePackagesPage />} />

              <Route path="/admin/statistiken" element={<AdminStatsPage />} />} />
              <Route path="/admin/berechtigungen" element={<AdminPermissionsPage />} />
              <Route path="/admin/rollen" element={<AdminRolesPage />} />
              <Route path="/admin/synchronisation" element={<AdminSyncPage />} />
              <Route path="/admin/datenbank" element={<AdminDatabasePage />} />
              <Route path="/admin/gefahrstoff-verteiler" element={<AdminHazardNotificationsPage />} />
              <Route path="/admin/firmeneinstellungen" element={<AdminCompanySettingsPage />} />
              <Route path="/admin/etiketten" element={<AdminLabelTemplatesPage />} />
              <Route path="/admin/symbole" element={<AdminSymbolsPage />} />
              <Route path="/admin/ap-kategorien" element={<AdminWorkPackageCategoriesPage />} />

              <Route path="/kalender" element={<CalendarPage />} />
              <Route path="/ergebnisse" element={<ResultsDatabasePage />} />
              <Route path="/rohstoffe" element={<RawMaterialsPage />} />
              <Route path="/rohstoffe/scan" element={<ContainerScanPage />} />
              <Route path="/rohstoffe/:id" element={<RawMaterialDetailPage />} />
              
              <Route path="/laborplanung" element={<LabPlanningPage />} />
              <Route path="/mischungen" element={<MixturesPage />} />
              <Route path="/mischungen/:id" element={<MixtureDetailPage />} />
              <Route path="/mischungen/charge/:batchId" element={<BatchExecutionPage />} />
              <Route path="/chargen" element={<Navigate to="/mischungen?tab=chargen" replace />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
