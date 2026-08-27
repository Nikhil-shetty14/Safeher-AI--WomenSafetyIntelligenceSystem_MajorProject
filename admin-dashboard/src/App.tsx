import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./AuthContext";
import { SocketProvider } from "./SocketContext";
import Sidebar from "./Sidebar";
import LoginPage from "./LoginPage";
import Dashboard from "./Dashboard";
import AlertsPage from "./AlertsPage";
import MapPage from "./MapPage";
import UsersPage from "./UsersPage";
import AnalyticsPage from "./AnalyticsPage";
import ConsoleSettingsPage from "./ConsoleSettingsPage";
import ComplaintsPage from "./ComplaintsPage";
import BroadcastPage from "./BroadcastPage";
import AdminProfilePage from "./AdminProfilePage";
import AdminManagementPage from "./AdminManagementPage";
import StateCommandCenter from "./StateCommandCenter";
import AIIntelligenceCenter from "./AIIntelligenceCenter";
import "./index.css";

const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="command-center">
    <Sidebar />
    <main
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {children}
    </main>
  </div>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAdminAuth();
  return isAdmin ? (
    <Layout>{children}</Layout>
  ) : (
    <Navigate to="/login" replace />
  );
};

const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAdminAuth();
  return isAdmin ? <Navigate to="/" replace /> : <>{children}</>;
};

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/alerts"
        element={
          <ProtectedRoute>
            <AlertsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/complaints"
        element={
          <ProtectedRoute>
            <ComplaintsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <MapPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <UsersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <ConsoleSettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/broadcasts"
        element={
          <ProtectedRoute>
            <BroadcastPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AdminProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-management"
        element={
          <ProtectedRoute>
            <AdminManagementPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/state-command"
        element={
          <ProtectedRoute>
            <StateCommandCenter />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-intelligence"
        element={
          <ProtectedRoute>
            <AIIntelligenceCenter />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AdminAuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </AdminAuthProvider>
  );
}
