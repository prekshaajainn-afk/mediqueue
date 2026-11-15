import React from 'react';
import { Menu, RefreshCw, Radio, UserCheck, ArrowRightLeft } from 'lucide-react';

const VIEW_TITLES = {
  dashboard: {
    title: 'Hospital Dashboard',
    subtitle: 'Live summary of patient queue and hospital activity',
  },
  register: {
    title: 'Register Patient',
    subtitle: 'Enter patient details and generate a queue token',
  },
  queue: {
    title: 'Manage Queue',
    subtitle: 'Call patients and update consultation status',
  },
  tracking: {
    title: 'Patient Tracking',
    subtitle: 'Check token status, position in line, and estimated wait time',
  },
  'patient-portal': {
    title: 'Patient Portal',
    subtitle: 'Dedicated real-time patient queue and consultation tracking',
  },
  about: {
    title: 'About MediQueue',
    subtitle: 'College PBL project overview, architecture, and features',
  },
};

export default function Navbar({
  currentView,
  onToggleSidebar,
  onManualRefresh,
  isRefreshing,
  lastUpdated,
  isConnected,
  onNavigateToPatient,
}) {
  const currentInfo = VIEW_TITLES[currentView] || VIEW_TITLES.dashboard;

  return (
    <header className="top-navbar">
      <div className="header-left">
        <button className="menu-toggle-btn" onClick={onToggleSidebar} aria-label="Toggle navigation">
          <Menu size={20} />
        </button>
        <div className="page-title-box">
          <h2>{currentInfo.title}</h2>
          <p>{currentInfo.subtitle}</p>
        </div>
      </div>

      <div className="header-actions">
        {/* Shortcut to Patient Portal for Evaluators */}
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onNavigateToPatient}
          title="Open Dedicated Patient Dashboard"
          style={{
            borderColor: '#0d9488',
            color: '#0d9488',
            fontWeight: 600,
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <UserCheck size={14} />
          <span>Patient Dashboard</span>
        </button>

        {/* Backend status badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '16px',
          backgroundColor: isConnected ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${isConnected ? '#a7f3d0' : '#fecaca'}`,
          fontSize: '0.78rem',
          fontWeight: 600,
          color: isConnected ? '#047857' : '#991b1b',
        }}>
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
          <span>{isConnected ? 'Connected' : 'Offline'}</span>
        </div>

        {/* Refresh button */}
        <button
          className="btn btn-secondary btn-sm"
          onClick={onManualRefresh}
          disabled={isRefreshing}
          title="Refresh queue data"
        >
          <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>

        {lastUpdated && (
          <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
            {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
    </header>
  );
}
