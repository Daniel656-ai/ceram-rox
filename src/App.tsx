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
import WorkPlanPage from "./pages/WorkPlanPage";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminServicesPage from "./pages/AdminServicesPage";
import AdminStatsPage from "./pages/AdminStatsPage";
import AdminWorkstationsPage from "./pages/AdminWorkstationsPage";
import AdminPermissionsPage from "./pages/AdminPermissionsPage";
import CalendarPage from "./pages/CalendarPage";
import SamplesPage from "./pages/SamplesPage";
import ResultsDatabasePage from "./pages/ResultsDatabasePage";
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
              <Route path="/proben" element={<SamplesPage />} />
              <Route path="/arbeitsplanung" element={<WorkPlanPage />} />
              <Route path="/admin/benutzer" element={<AdminUsersPage />} />
              <Route path="/admin/messdienstleistungen" element={<AdminServicesPage />} />
              <Route path="/admin/statistiken" element={<AdminStatsPage />} />
              <Route path="/admin/arbeitsplaetze" element={<AdminWorkstationsPage />} />
              <Route path="/admin/berechtigungen" element={<AdminPermissionsPage />} />
              <Route path="/kalender" element={<CalendarPage />} />
              <Route path="/ergebnisse" element={<ResultsDatabasePage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
