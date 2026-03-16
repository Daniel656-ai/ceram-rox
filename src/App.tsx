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
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import WorkPlanPage from "./pages/WorkPlanPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminServicesPage from "./pages/AdminServicesPage";
import AdminStatsPage from "./pages/AdminStatsPage";
import AdminWorkstationsPage from "./pages/AdminWorkstationsPage";
import AdminPermissionsPage from "./pages/AdminPermissionsPage";
import AdminSyncPage from "./pages/AdminSyncPage";
import AdminRolesPage from "./pages/AdminRolesPage";
import CalendarPage from "./pages/CalendarPage";
import SamplesPage from "./pages/SamplesPage";
import SampleDetailPage from "./pages/SampleDetailPage";
import ResultsDatabasePage from "./pages/ResultsDatabasePage";
import RawMaterialsPage from "./pages/RawMaterialsPage";
import RawMaterialDetailPage from "./pages/RawMaterialDetailPage";
import ConsumablesPage from "./pages/ConsumablesPage";
import TemplatesPage from "./pages/TemplatesPage";
import BatchPlanningPage from "./pages/BatchPlanningPage";
import BulkSamplePage from "./pages/BulkSamplePage";
import LabPlanningPage from "./pages/LabPlanningPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/auth" element={<Auth />} />
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
              <Route path="/projekte" element={<ProjectsPage />} />
              <Route path="/projekte/:id" element={<ProjectDetailPage />} />
              <Route path="/proben" element={<SamplesPage />} />
              <Route path="/proben/:id" element={<SampleDetailPage />} />
              <Route path="/arbeitsplanung" element={<WorkPlanPage />} />
              <Route path="/admin/benutzer" element={<AdminUsersPage />} />
              <Route path="/admin/messdienstleistungen" element={<AdminServicesPage />} />
              <Route path="/admin/statistiken" element={<AdminStatsPage />} />
              <Route path="/admin/arbeitsplaetze" element={<AdminWorkstationsPage />} />
              <Route path="/admin/berechtigungen" element={<AdminPermissionsPage />} />
              <Route path="/admin/rollen" element={<AdminRolesPage />} />
              <Route path="/admin/synchronisation" element={<AdminSyncPage />} />
              <Route path="/kalender" element={<CalendarPage />} />
              <Route path="/ergebnisse" element={<ResultsDatabasePage />} />
              <Route path="/rohstoffe" element={<RawMaterialsPage />} />
              <Route path="/rohstoffe/:id" element={<RawMaterialDetailPage />} />
              <Route path="/verbrauchsmaterialien" element={<ConsumablesPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
