import React from 'react';
import {
  HeartPulse,
  LayoutDashboard,
  Ticket,
  Calendar,
  History,
  User,
  LogOut,
  ArrowRightLeft,
  RefreshCw,
  Radio,
} from 'lucide-react';
import NotificationCenter from './NotificationCenter';

export default function PatientNavbar({
  activeTab,
  setActiveTab,
  patient,
  user,
  onLogout,
  onSwitchToStaff,
  onManualRefresh,
  isRefreshing,
  notifications,
  onClearNotifications,
  soundEnabled,
  onToggleSound,
  isConnected,
  activeVisit,
}) {
  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    {
      id: 'queue',
      label: 'Live Queue & Token',
      icon: Ticket,
      badge: activeVisit ? `#${activeVisit.token_number}` : null,
    },
    { id: 'appointments', label: 'My Appointments', icon: Calendar },
    { id: 'history', label: 'Visit History', icon: History },
    { id: 'profile', label: 'Patient Profile', icon: User },
  ];

  return (
    <header className="patient-header">
      {/* Top Banner Row */}
      <div className="patient-top-bar">
        <div className="patient-brand-block">
          <div className="brand-icon-box">
            <HeartPulse size={20} />
          </div>
          <div>
            <div className="patient-portal-title">
              MediQueue <span className="portal-pill">PATIENT PORTAL</span>
            </div>
            <p className="patient-portal-sub">Real-Time Patient Flow & Queue Tracking</p>
          </div>
        </div>

        <div className="patient-header-actions">
          {/* Backend / WS Status */}
          <div className="status-badge-inline" style={{ background: isConnected ? '#ecfdf5' : '#fef2f2', color: isConnected ? '#047857' : '#991b1b', border: `1px solid ${isConnected ? '#a7f3d0' : '#fecaca'}` }}>
            <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
            <span>{isConnected ? 'Hospital Live' : 'Offline'}</span>
          </div>

          {/* Refresh Button */}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onManualRefresh}
            disabled={isRefreshing}
            title="Refresh Live Data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>

          {/* Notifications Center */}
          <NotificationCenter
            notifications={notifications}
            onClearNotifications={onClearNotifications}
            soundEnabled={soundEnabled}
            onToggleSound={onToggleSound}
          />

          {/* User Account & Evaluator Portal Switcher */}
          <div className="patient-user-pill">
            <div className="user-avatar-dot">
              <User size={14} />
            </div>
            <div className="user-pill-text">
              <span className="user-name">{patient?.name || user?.email}</span>
              <span className="user-tag">Patient #{patient?.id}</span>
            </div>

            {/* Switch to Staff Portal Button for PBL Evaluators */}
            <button
              type="button"
              className="btn btn-outline btn-xs"
              onClick={onSwitchToStaff}
              title="Switch to Hospital Staff Dashboard"
              style={{ marginLeft: '6px', fontSize: '0.72rem' }}
            >
              <ArrowRightLeft size={12} />
              <span>Staff Portal</span>
            </button>

            <button
              type="button"
              className="btn-icon-subtle"
              onClick={onLogout}
              title="Sign Out"
              style={{ color: '#ef4444', marginLeft: '4px' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <nav className="patient-tabs-nav">
        <div className="patient-tabs-list">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`patient-nav-tab ${isActive ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
                {tab.badge && (
                  <span className="tab-token-badge">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
