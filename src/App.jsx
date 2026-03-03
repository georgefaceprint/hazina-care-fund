import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import Dashboard from './pages/Dashboard';
import TopUp from './pages/TopUp';
import FamilyMembers from './pages/FamilyMembers';
import CrisisClaim from './pages/CrisisClaim';
import AppLayout from './layouts/AppLayout';

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
              <AppLayout />
            </ProtectedRoute>
          }>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/topup" element={<TopUp />} />
            <Route path="/family" element={<FamilyMembers />} />
            <Route path="/claim" element={<CrisisClaim />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            {/* These would be built next */}
            <Route path="/payouts" element={<Dashboard />} />
            <Route path="/settings" element={<Dashboard />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
