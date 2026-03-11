import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LanguageProvider } from './context/LanguageContext';
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
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const CompleteProfile = lazy(() => import('./pages/CompleteProfile'));
const AgentApp = lazy(() => import('./pages/AgentApp'));
const MasterDashboard = lazy(() => import('./pages/MasterDashboard'));
const SuperMasterDashboard = lazy(() => import('./pages/SuperMasterDashboard'));
const RegisterFee = lazy(() => import('./pages/RegisterFee'));
const ShortRedirect = lazy(() => import('./pages/ShortRedirect'));
const RecruitmentLogin = lazy(() => import('./pages/RecruitmentLogin'));
import RecruitmentLayout from './layouts/RecruitmentLayout';
import InstallProvider from './components/InstallPrompt';
import UpdatePrompt from './components/UpdatePrompt';
import SplashScreen from './components/SplashScreen';

const RoleBasedRedirect = () => {
  const { profile, loading } = useAuth();
  if (loading) return null;
  if (!profile) return <Navigate to="/login" replace />;

  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'super_master') return <Navigate to="/super" replace />;
  if (profile.role === 'master_agent') return <Navigate to="/master" replace />;
  if (profile.role === 'agent') return <Navigate to="/agent" replace />;

  return <Navigate to="/dashboard" replace />;
};

const ProtectedRoute = ({ children, requireAdmin = false, requireAgent = false, requireMaster = false, requireSuper = false }) => {
  const { user, profile, loading } = useAuth();

  const isProfessionalPath = requireAgent || requireMaster || requireSuper;

  // Wait for initial auth loading
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  // Still loading profile if user exists but profile is null
  if (user && profile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // If profile is false, the user logged in but has no profile document. We log them out or redirect to a fallback.
  // For now, if no profile, we can't let them in, but we shouldn't trap them in a spinner.
  if (user && profile === false) {
    // We could navigate them away, or just return an error UI. 
    return <Navigate to="/login" replace />;
  }

  if (!user) {
    if (requireAdmin) return <Navigate to="/admin/login" replace />;
    if (isProfessionalPath) return <Navigate to="/hq/login" replace />;
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && profile?.role !== 'admin') {
    return <RoleBasedRedirect />;
  }

  if (requireAgent && profile?.role !== 'agent') {
    return <RoleBasedRedirect />;
  }

  if (requireMaster && profile?.role !== 'master_agent') {
    return <RoleBasedRedirect />;
  }

  if (requireSuper && profile?.role !== 'super_master') {
    return <RoleBasedRedirect />;
  }

  return children;
};

const App = () => {
  const [showSplash, setShowSplash] = React.useState(true);

  React.useEffect(() => {
    // Capture referral code from URL
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      console.log("📍 Captured referral code:", ref);
      sessionStorage.setItem('hazina_referrer', ref);
    }

    // Hide splash screen after 3 seconds
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 3000); // 3 seconds

    return () => clearTimeout(timer);
  }, []);

  return (
    <BrowserRouter>
      <LanguageProvider>
        <ToastProvider>
          <AuthProvider>
            <InstallProvider>
              {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
              <Suspense fallback={<SplashScreen />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/hq/login" element={<RecruitmentLogin />} />
                  <Route path="/r/:agentCode" element={<ShortRedirect />} />
                  <Route path="/admin/login" element={<AdminLogin />} />

                  {/* Independent Admin Portal */}
                  <Route path="/admin" element={
                    <ProtectedRoute requireAdmin={true}>
                      <AdminPanel />
                    </ProtectedRoute>
                  } />

                  {/* Mobile App Layout - Consumer Facing */}
                  <Route element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/topup" element={<TopUp />} />
                    <Route path="/family" element={<FamilyMembers />} />
                    <Route path="/claim" element={<CrisisClaim />} />
                    <Route path="/benefits" element={<Benefits />} />
                    <Route path="/referrals" element={<Referrals />} />
                    <Route path="/settings" element={<ProfileSettings />} />
                    <Route path="/complete-profile" element={<CompleteProfile />} />
                    <Route path="/pay-registration" element={<RegisterFee />} />
                    <Route path="/" element={<RoleBasedRedirect />} />
                  </Route>

                  {/* Recruitment Portals - Professional Management Layout */}
                  <Route element={
                    <ProtectedRoute>
                      <RecruitmentLayout />
                    </ProtectedRoute>
                  }>
                    <Route path="/agent" element={
                      <ProtectedRoute requireAgent={true}>
                        <AgentApp />
                      </ProtectedRoute>
                    } />
                    <Route path="/master" element={
                      <ProtectedRoute requireMaster={true}>
                        <MasterDashboard />
                      </ProtectedRoute>
                    } />
                    <Route path="/super" element={
                      <ProtectedRoute requireSuper={true}>
                        <SuperMasterDashboard />
                      </ProtectedRoute>
                    } />
                  </Route>
                </Routes>
              </Suspense>
              <UpdatePrompt />
            </InstallProvider>
          </AuthProvider>
        </ToastProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
};

export default App;
