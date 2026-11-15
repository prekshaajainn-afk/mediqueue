import React from 'react';
import {
  LayoutDashboard,
  UserPlus,
  ListOrdered,
  Search,
  Info,
  HeartPulse,
  UserCheck,
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, isConnected, isOpen, onClose }) {
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'register', label: 'Register Patient', icon: UserPlus },
    { id: 'queue', label: 'Manage Queue', icon: ListOrdered },
    { id: 'tracking', label: 'Patient Tracking', icon: Search },
    { id: 'patient-portal', label: 'Patient Dashboard', icon: UserCheck, badge: 'New' },
    { id: 'about', label: 'About Project', icon: Info },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-icon-box">
          <HeartPulse size={20} />
        </div>
        <div className="brand-text">
          <h1>MediQueue</h1>
          <p>Hospital Staff System</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => {
                setCurrentView(item.id);
                if (onClose) onClose();
              }}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge && (
                <span className="badge badge-primary" style={{ marginLeft: 'auto', fontSize: '0.68rem', padding: '1px 6px' }}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          style={{
            width: '100%',
            marginBottom: '12px',
            fontSize: '0.78rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            borderColor: '#0d9488',
            color: '#0d9488',
          }}
          onClick={() => {
            setCurrentView('patient-portal');
            if (onClose) onClose();
          }}
        >
          <UserCheck size={14} />
          <span>Go to Patient Portal</span>
        </button>

        <div className="status-badge-inline">
          <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
          <span style={{ color: isConnected ? '#047857' : '#991b1b' }}>
            {isConnected ? 'Backend Online' : 'Backend Offline'}
          </span>
        </div>
      </div>
    </aside>
  );
}
