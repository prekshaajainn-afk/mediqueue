import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import PatientRegistrationPage from './pages/PatientRegistrationPage';
import QueueManagementPage from './pages/QueueManagementPage';
import PatientTrackingPage from './pages/PatientTrackingPage';
import AboutPage from './pages/AboutPage';
import PatientDashboardPage from './pages/PatientDashboardPage';
import PatientLoginPage from './pages/PatientLoginPage';
import api from './services/api';
import { DEFAULT_DEPARTMENTS } from './utils/constants';
import { useAuth } from './context/AuthContext';
import { ShieldAlert, ArrowRight, UserCheck } from 'lucide-react';

export default function App() {
  const { user, patient, isAuthenticated, isPatient, isStaff, isLoading: isAuthLoading, logout } = useAuth();

  // Detect URL path on start
  const getInitialView = () => {
    const path = window.location.pathname.toLowerCase();
    if (path.startsWith('/patient')) {
      return 'patient-portal';
    }
    return 'dashboard';
  };

  const [currentView, setCurrentView] = useState(getInitialView);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(true);

  // Core Staff Dashboard Data
  const [stats, setStats] = useState(null);
  const [queue, setQueue] = useState([]);
  const [departments, setDepartments] = useState(DEFAULT_DEPARTMENTS);

  // Refresh & Timers
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // Sync view changes with browser history and URL
  const navigateTo = (view) => {
    setCurrentView(view);
    const targetPath = view === 'patient-portal' ? '/patient/dashboard' : '/';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ view }, '', targetPath);
    }
  };

  // Listen to popstate (browser back/forward navigation)
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname.toLowerCase();
      if (path.startsWith('/patient')) {
        setCurrentView('patient-portal');
      } else {
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Central fetch function for Staff Dashboard
  const fetchAllData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const [statsData, queueData, deptsData] = await Promise.all([
        api.getStatsSummary().catch(() => null),
        api.getQueue().catch(() => []),
        api.getDepartments().catch(() => DEFAULT_DEPARTMENTS),
      ]);

      if (statsData) setStats(statsData);
      if (queueData) setQueue(queueData);
      if (deptsData && deptsData.length > 0) setDepartments(deptsData);

      setIsConnected(true);
      setLastUpdated(new Date());
    } catch {
      setIsConnected(false);
    } finally {
      if (!isSilent) setIsRefreshing(false);
    }
  }, []);

  // Mount effect
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Background polling every 6 seconds for staff dashboard
  useEffect(() => {
    if (currentView === 'patient-portal') return;

    const interval = setInterval(() => {
      fetchAllData(true);
    }, 6000);

    return () => clearInterval(interval);
  }, [fetchAllData, currentView]);

  // Handlers for queue actions in staff dashboard
  const handleQueueCreated = (newEntry) => {
    setQueue((prev) => [...prev, newEntry]);
    fetchAllData(true);
  };

  const handleStatusUpdated = (updatedEntry) => {
    setQueue((prev) =>
      prev.map((e) => (e.id === updatedEntry.id ? updatedEntry : e))
    );
    fetchAllData(true);
  };

  const handleEntryDeleted = (deletedId) => {
    setQueue((prev) => prev.filter((e) => e.id !== deletedId));
    fetchAllData(true);
  };

  const handleQueueReload = () => {
    fetchAllData(false);
  };

  // If loading authentication session
  if (isAuthLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '12px',
        backgroundColor: '#f8fafc',
      }}>
        <div className="status-dot online animate-ping" style={{ width: '20px', height: '20px' }} />
        <span style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: 600 }}>
          Initializing MediQueue...
        </span>
      </div>
    );
  }

  // -------------------------------------------------------------
  // PATIENT DASHBOARD VIEW
  // -------------------------------------------------------------
  if (currentView === 'patient-portal') {
    // If not authenticated or not a patient account, show Patient Login / Demo Login screen
    if (!isAuthenticated || !isPatient) {
      return (
        <PatientLoginPage
          onNavigateToStaff={() => navigateTo('dashboard')}
          onLoginSuccess={() => navigateTo('patient-portal')}
        />
      );
    }

    return (
      <PatientDashboardPage
        onNavigateToStaff={() => navigateTo('dashboard')}
      />
    );
  }

  // -------------------------------------------------------------
  // HOSPITAL STAFF DASHBOARD VIEW
  // -------------------------------------------------------------
  return (
    <div className="app-layout">
      {/* 5-Item Simplified Sidebar + Patient Portal link */}
      <Sidebar
        currentView={currentView}
        setCurrentView={navigateTo}
        isConnected={isConnected}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="main-content-wrapper">
        {/* Simplified Header */}
        <Navbar
          currentView={currentView}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onManualRefresh={() => fetchAllData(false)}
          isRefreshing={isRefreshing}
          lastUpdated={lastUpdated}
          isConnected={isConnected}
          onNavigateToPatient={() => navigateTo('patient-portal')}
        />

        {/* If user is logged in as a patient and visits staff dashboard, block and prompt redirection */}
        {isAuthenticated && isPatient && (
          <div style={{ padding: '0 28px', marginTop: '20px' }}>
            <div className="alert alert-warning" style={{ margin: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <ShieldAlert size={20} />
                <div>
                  <strong>Staff Dashboard Access Notice:</strong> You are currently signed in as patient <strong>{patient?.name}</strong>. Hospital staff operations are restricted.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => navigateTo('patient-portal')}
                >
                  <UserCheck size={14} />
                  <span>Return to My Patient Dashboard</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={logout}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Offline Banner if backend unreachable */}
        {!isConnected && (
          <div style={{ padding: '0 28px', marginTop: '20px' }}>
            <div className="alert alert-danger" style={{ margin: 0 }}>
              <div>
                <strong>Connection Error:</strong> Unable to reach the MediQueue backend server. Please try refreshing the page.
                <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                  If this persists, the server may be starting up — please wait 30 seconds and try again.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main View Router for Hospital Staff */}
        <main>
          {currentView === 'dashboard' && (
            <DashboardPage
              stats={stats}
              queue={queue}
              isConnected={isConnected}
              onNavigate={navigateTo}
            />
          )}

          {currentView === 'register' && (
            <PatientRegistrationPage
              departments={departments}
              onQueueCreated={handleQueueCreated}
              onNavigate={navigateTo}
            />
          )}

          {currentView === 'queue' && (
            <QueueManagementPage
              queue={queue}
              departments={departments}
              onStatusUpdated={handleStatusUpdated}
              onEntryDeleted={handleEntryDeleted}
              onQueueReload={handleQueueReload}
            />
          )}

          {currentView === 'tracking' && (
            <PatientTrackingPage departments={departments} />
          )}

          {currentView === 'about' && <AboutPage />}
        </main>
      </div>
    </div>
  );
}
