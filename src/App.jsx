import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import LoginPage from './pages/LoginPage';

import AppLayout from './layouts/AppLayout';

// Dynamically imported components to reduce initial bundle size for PWA users
const Dashboard = lazy(() => import('./pages/Dashboard'));
const TopUp = lazy(() => import('./pages/TopUp'));
const FamilyMembers = lazy(() => import('./pages/FamilyMembers'));
const CrisisClaim = lazy(() => import('./pages/CrisisClaim'));
const Benefits = lazy(() => import('./pages/Benefits'));
const Referrals = lazy(() => import('./pages/Referrals'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));

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

import { LanguageProvider } from './context/LanguageContext';

const App = () => {
  React.useEffect(() => {
    // Capture referral code from URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      console.log("📍 Captured referral code:", ref);
      sessionStorage.setItem('hazina_referrer', ref);
    }
  }, []);

  return (
    <BrowserRouter>
      <LanguageProvider>
        <ToastProvider>
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
                <Route path="/benefits" element={<Benefits />} />
                <Route path="/referrals" element={<Referrals />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/settings" element={<ProfileSettings />} />
                <Route path="/complete-profile" element={<CompleteProfile />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>

  );
};

export default App;
