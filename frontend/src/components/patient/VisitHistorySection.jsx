import React from 'react';
import {
  History,
  Calendar,
  Clock,
  UserCheck,
  Building2,
  CheckCircle2,
  XCircle,
  FileText,
} from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { formatTime } from '../../utils/constants';

export default function VisitHistorySection({ visits }) {
  const completedVisits = (visits || []).filter((v) => v.status !== 'WAITING');

  return (
    <div className="visit-history-section">
      <div className="section-header-box">
        <div>
          <h3 className="section-title">My Hospital Visit History</h3>
          <p className="section-subtitle">
            Records of all your past clinical consultations, department visits, and token outcomes.
          </p>
        </div>
      </div>

      {completedVisits.length === 0 ? (
        <div className="card empty-history-card">
          <div className="empty-state-content">
            <History size={42} className="empty-state-icon" />
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '12px 0 6px', color: '#1e293b' }}>
              No Prior Hospital Visits Found
            </h4>
            <p style={{ color: '#64748b', fontSize: '0.88rem', maxWidth: '420px', margin: '0 auto' }}>
              When you complete consultations or receive care in our hospital, your past records and consultation logs will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="card table-container-card">
          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Token #</th>
                  <th>Department</th>
                  <th>Assigned Doctor</th>
                  <th>Date & Time</th>
                  <th>Duration</th>
                  <th>Final Status</th>
                </tr>
              </thead>
              <tbody>
                {completedVisits.map((visit) => {
                  const visitDate = visit.created_at
                    ? new Date(visit.created_at).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })
                    : 'Recent';

                  return (
                    <tr key={visit.id}>
                      <td>
                        <span className="token-pill-badge">#{visit.token_number}</span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{visit.department}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {visit.room_number || 'Room 101'}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <UserCheck size={16} style={{ color: '#0d9488' }} />
                          <span>{visit.doctor_name || 'Department Physician'}</span>
                        </div>
                      </td>
                      <td>
                        <div>{visitDate}</div>
                        <div style={{ fontSize: '0.76rem', color: '#64748b' }}>
                          {formatTime(visit.created_at)}
                        </div>
                      </td>
                      <td>
                        {visit.consultation_minutes ? (
                          <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 600 }}>
                            {visit.consultation_minutes} mins
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Standard</span>
                        )}
                      </td>
                      <td>
                        <StatusBadge status={visit.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
