import React from 'react';
import {
  Hourglass,
  Activity,
  CheckCircle2,
  UserPlus,
  ArrowRight,
  ListOrdered,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { formatTime } from '../utils/constants';

export default function DashboardPage({
  stats,
  queue,
  isConnected,
  onNavigate,
}) {
  const summary = stats || {
    waiting_count: 0,
    in_progress_count: 0,
    completed_count: 0,
  };

  // Recent 6 active queue entries
  const recentQueue = (queue || []).slice(-6).reverse();

  return (
    <div className="page-container">
      {/* Top Action Bar with Prominent Register Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '24px',
        backgroundColor: '#ffffff',
        padding: '18px 22px',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
      }}>
        <div>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
            Hospital Overview
          </h3>
          <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '2px 0 0' }}>
            System Status:{' '}
            <strong style={{ color: isConnected ? '#059669' : '#dc2626' }}>
              {isConnected ? 'Connected to SQLite Database' : 'Backend Disconnected'}
            </strong>
          </p>
        </div>

        <button
          className="btn btn-primary btn-lg"
          onClick={() => onNavigate('register')}
          style={{ boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)' }}
        >
          <UserPlus size={18} />
          <span>Register New Patient</span>
        </button>
      </div>

      {/* Only Three Primary Cards */}
      <div className="primary-stats-grid">
        <div className="primary-stat-card waiting">
          <div className="stat-icon-circle waiting">
            <Hourglass size={24} />
          </div>
          <div>
            <div className="stat-label">Waiting Patients</div>
            <div className="stat-number">{summary.waiting_count}</div>
          </div>
        </div>

        <div className="primary-stat-card serving">
          <div className="stat-icon-circle serving">
            <Activity size={24} />
          </div>
          <div>
            <div className="stat-label">In Consultation</div>
            <div className="stat-number">{summary.in_progress_count}</div>
          </div>
        </div>

        <div className="primary-stat-card completed">
          <div className="stat-icon-circle completed">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <div className="stat-label">Completed Today</div>
            <div className="stat-number">{summary.completed_count}</div>
          </div>
        </div>
      </div>

      {/* Simple Recent Patients Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ListOrdered size={18} />
            <span>Recent Patients & Active Queue</span>
          </div>

          <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('queue')}>
            <span>Open Manage Queue</span>
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Token #</th>
                <th>Patient Name</th>
                <th>Department</th>
                <th>Current Status</th>
                <th>Queued At</th>
              </tr>
            </thead>
            <tbody>
              {recentQueue.length > 0 ? (
                recentQueue.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="token-pill">#{item.token_number}</span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{item.patient_name}</td>
                    <td style={{ color: '#475569' }}>{item.department}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      {formatTime(item.created_at)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="empty-state">
                    No patients in the queue yet. Click "Register New Patient" above to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
