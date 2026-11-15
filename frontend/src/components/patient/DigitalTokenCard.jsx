import React, { useState } from 'react';
import {
  Ticket,
  Clock,
  Users,
  UserCheck,
  Building2,
  Calendar,
  AlertCircle,
  XCircle,
  Sparkles,
  Radio,
} from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { formatTime, formatWaitTime } from '../../utils/constants';

export default function DigitalTokenCard({
  activeVisit,
  departmentSummary,
  onCancelActive,
  isCancelling,
  lastUpdated,
}) {
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!activeVisit) return null;

  const isWaiting = activeVisit.status === 'WAITING';
  const isInProgress = activeVisit.status === 'IN_PROGRESS';
  const isCompleted = activeVisit.status === 'COMPLETED';
  const isCancelled = activeVisit.status === 'CANCELLED';

  return (
    <div className="digital-token-container">
      {/* Top Header Strip */}
      <div className="digital-token-header">
        <div className="token-brand-tag">
          <Ticket size={16} />
          <span>OFFICIAL DIGITAL QUEUE TOKEN</span>
        </div>
        <div className="live-sync-indicator">
          <span className="pulsing-live-dot" />
          <span>Real-time Active</span>
          {lastUpdated && (
            <span className="last-sync-time">
              &bull; Synced {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      <div className="digital-token-body">
        {/* Token Number & Status Row */}
        <div className="token-main-row">
          <div className="token-number-group">
            <span className="token-label">YOUR TOKEN NUMBER</span>
            <div className="token-display-number">
              <span className="token-hash">#</span>
              <span className="token-digits">{activeVisit.token_number}</span>
            </div>
            <div className="token-dept-badge">
              <Building2 size={14} />
              <span>{activeVisit.department}</span>
            </div>
          </div>

          <div className="token-status-group">
            <span className="status-label">CURRENT STATUS</span>
            <div style={{ marginTop: '6px' }}>
              <StatusBadge status={activeVisit.status} />
            </div>

            {/* Quick Consultation Badge */}
            {isInProgress && (
              <div className="consultation-active-pill">
                <Sparkles size={14} />
                <span>Doctor is seeing you right now</span>
              </div>
            )}
            {isWaiting && (
              <div className="queue-position-pill">
                <Users size={14} />
                <span>
                  {activeVisit.patients_ahead === 0
                    ? 'You are next in line!'
                    : `Position #${activeVisit.queue_position} (${activeVisit.patients_ahead} ahead)`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Clinical Assignment Info */}
        <div className="token-clinical-info">
          <div className="clinical-info-card">
            <div className="info-icon doctor-icon">
              <UserCheck size={18} />
            </div>
            <div>
              <div className="info-title">Assigned Doctor</div>
              <div className="info-value">{activeVisit.doctor_name || 'Department Physician'}</div>
              <div className="info-sub">Room: {activeVisit.room_number || 'Room 101'}</div>
            </div>
          </div>

          <div className="clinical-info-card">
            <div className="info-icon clock-icon">
              <Clock size={18} />
            </div>
            <div>
              <div className="info-title">Estimated Wait Time</div>
              <div className="info-value">
                {isInProgress ? 'Now in Room' : formatWaitTime(activeVisit.estimated_wait_minutes)}
              </div>
              <div className="info-sub">
                {isInProgress ? 'Consultation ongoing' : 'Calculated by hospital queue'}
              </div>
            </div>
          </div>

          <div className="clinical-info-card">
            <div className="info-icon calendar-icon">
              <Calendar size={18} />
            </div>
            <div>
              <div className="info-title">Registered At</div>
              <div className="info-value">{formatTime(activeVisit.created_at)}</div>
              <div className="info-sub">
                {activeVisit.created_at ? new Date(activeVisit.created_at).toLocaleDateString() : 'Today'}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar for Waiting Patients */}
        {isWaiting && (
          <div className="token-actions-bar">
            <div className="token-advice-text">
              <Radio size={14} className="animate-pulse" />
              <span>Please stay in the waiting lounge near <strong>{activeVisit.room_number || 'Room 101'}</strong>. Your token will be called here.</span>
            </div>

            {!showCancelConfirm ? (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => setShowCancelConfirm(true)}
              >
                <XCircle size={14} />
                <span>Leave Queue</span>
              </button>
            ) : (
              <div className="cancel-confirm-box">
                <span style={{ fontSize: '0.8rem', color: '#991b1b', fontWeight: 600 }}>
                  Confirm leaving queue?
                </span>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    await onCancelActive();
                    setShowCancelConfirm(false);
                  }}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Leaving...' : 'Yes, Leave'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCancelConfirm(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
