import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AppLayout from './layouts/AppLayout';

// Dynamically imported components to reduce initial bundle size for PWA users
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TopUp = lazy(() => import('./pages/TopUp'));
const FamilyMembers = lazy(() => import('./pages/FamilyMembers'));
const CrisisClaim = lazy(() => import('./pages/CrisisClaim'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return <Navigate to="/login" replace />;

  return children;
};

const App = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={
            <ProtectedRoute>
              <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-slate-50">
                  <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              }>
                <AppLayout />
              </Suspense>
            </ProtectedRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/topup" element={<TopUp />} />
            <Route path="/family" element={<FamilyMembers />} />
            <Route path="/claim" element={<CrisisClaim />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/settings" element={<ProfileSettings />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
