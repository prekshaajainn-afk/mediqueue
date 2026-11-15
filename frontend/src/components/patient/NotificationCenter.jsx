import React, { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Calendar,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react';

export default function NotificationCenter({
  notifications,
  onClearNotifications,
  soundEnabled,
  onToggleSound,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="notification-center-wrapper">
      <button
        type="button"
        className={`notif-bell-btn ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Patient Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && <span className="notif-count-pill">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notif-dropdown-card">
          <div className="notif-dropdown-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bell size={16} style={{ color: '#0d9488' }} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="badge badge-primary">{unreadCount} New</span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={onToggleSound}
                title={soundEnabled ? 'Chime sound enabled' : 'Chime sound muted'}
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              </button>
              <button
                type="button"
                className="btn-icon-subtle"
                onClick={() => setIsOpen(false)}
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="notif-dropdown-body">
            {notifications.length === 0 ? (
              <div className="notif-empty">
                <Bell size={24} style={{ color: '#cbd5e1', margin: '0 auto 8px' }} />
                <div>No new notifications</div>
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', margin: '2px 0 0' }}>
                  You will be notified when your token is called or updated.
                </p>
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`notif-item ${n.type}`}>
                  <div className="notif-icon-box">
                    {n.type === 'called' && <Megaphone size={16} />}
                    {n.type === 'status' && <CheckCircle2 size={16} />}
                    {n.type === 'appointment' && <Calendar size={16} />}
                    {n.type === 'info' && <Bell size={16} />}
                  </div>
                  <div className="notif-content">
                    <div className="notif-title">{n.title}</div>
                    <div className="notif-message">{n.message}</div>
                    <div className="notif-time">{n.time}</div>
                  </div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notif-dropdown-footer">
              <button
                type="button"
                className="btn-text-subtle"
                onClick={onClearNotifications}
              >
                Clear all notifications
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
