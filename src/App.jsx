import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
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
import ErrorBoundary from './components/ErrorBoundary';

const RoleBasedRedirect = () => {
  const { profile, loading } = useAuth();
  console.log("🚦 RoleBasedRedirect: profile =", profile?.role, "loading =", loading);
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!profile) return <Navigate to="/login" replace />;

  if (profile.role === 'admin') return <Navigate to="/admin" replace />;
  if (profile.role === 'super_master') return <Navigate to="/smagent/dashboard" replace />;
  if (profile.role === 'master_agent') return <Navigate to="/magent/dashboard" replace />;
  if (profile.role === 'agent') return <Navigate to="/agent/dashboard" replace />;

  return <Navigate to="/dashboard" replace />;
};

const RoleProtectedRoute = ({ children, requireAdmin = false, requireAgent = false, requireMaster = false, requireSuper = false, noRecruiters = false }) => {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  const isProfessionalPath = requireAgent || requireMaster || requireSuper;
  const isRecruiter = ['super_master', 'master_agent', 'agent'].includes(profile?.role);

  // Wait for initial auth loading
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) {
    if (requireAdmin) return <Navigate to="/admin/login" replace />;
    if (isProfessionalPath) return <Navigate to="/agent" replace />;
    return <Navigate to="/login" replace />;
  }

  // Still loading profile if user exists but profile is null
  if (profile === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (profile === false) {
    return <Navigate to="/login" replace />;
  }

  // Stricter check: If we are in the guardian/consumer zone but the user is a recruiter, bounce them to HQ
  if (noRecruiters && isRecruiter) {
    return <RoleBasedRedirect />;
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
      <ErrorBoundary>
        <LanguageProvider>
          <ToastProvider>
            <AuthProvider>
              <InstallProvider>
                {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
                <Suspense fallback={<SplashScreen />}>
                  <Routes>
                    <Route path="/" element={<RoleProtectedRoute><RoleBasedRedirect /></RoleProtectedRoute>} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/agent" element={<RecruitmentLogin />} />
                    <Route path="/smagent" element={<RecruitmentLogin />} />
                    <Route path="/magent" element={<RecruitmentLogin />} />
                    <Route path="/r/:agentCode" element={<ShortRedirect />} />
                    <Route path="/admin/login" element={<AdminLogin />} />
  
                    {/* Independent Admin Portal */}
                    <Route path="/admin" element={
                      <RoleProtectedRoute requireAdmin={true}>
                        <AdminPanel />
                      </RoleProtectedRoute>
                    } />
  
                    {/* Mobile App Layout - Consumer Facing (Guardians Only) */}
                    <Route element={
                      <RoleProtectedRoute noRecruiters={true}>
                        <AppLayout />
                      </RoleProtectedRoute>
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
                    </Route>
  
                    {/* Recruitment Portals - Professional Management Layout */}
                    <Route element={
                      <RoleProtectedRoute>
                        <RecruitmentLayout />
                      </RoleProtectedRoute>
                    }>
                      <Route path="/agent/dashboard" element={
                        <RoleProtectedRoute requireAgent={true}>
                          <AgentApp />
                        </RoleProtectedRoute>
                      } />
                      <Route path="/magent/dashboard" element={
                        <RoleProtectedRoute requireMaster={true}>
                          <MasterDashboard />
                        </RoleProtectedRoute>
                      } />
                      <Route path="/smagent/dashboard" element={
                        <RoleProtectedRoute requireSuper={true}>
                          <SuperMasterDashboard />
                        </RoleProtectedRoute>
                      } />
                    </Route>
                  </Routes>
                </Suspense>
                <UpdatePrompt />
              </InstallProvider>
            </AuthProvider>
          </ToastProvider>
        </LanguageProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default App;
