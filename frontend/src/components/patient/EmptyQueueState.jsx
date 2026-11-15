import React, { useState } from 'react';
import {
  Ticket,
  PlusCircle,
  Calendar,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

export default function EmptyQueueState({
  departments,
  onJoinQueue,
  onNavigateAppointments,
  isJoining,
}) {
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [selectedDept, setSelectedDept] = useState(departments[0]?.name || 'General Medicine');
  const [joinError, setJoinError] = useState(null);

  const handleJoinSubmit = async (e) => {
    e.preventDefault();
    setJoinError(null);
    try {
      await onJoinQueue(selectedDept);
      setShowJoinModal(false);
    } catch (err) {
      setJoinError(err.message || 'Could not join queue. Please try again.');
    }
  };

  return (
    <div className="card empty-queue-hero-card">
      <div className="empty-queue-content">
        <div className="empty-hero-icon-box">
          <Ticket size={40} />
        </div>

        <h3 className="empty-hero-title">You Have No Active Queue Token</h3>
        <p className="empty-hero-desc">
          You are currently not queued for consultation today. You can join the walk-in queue immediately to receive a live digital token, or schedule a doctor appointment for a future date.
        </p>

        <div className="empty-hero-actions">
          <button
            type="button"
            className="btn btn-primary btn-lg"
            onClick={() => {
              setJoinError(null);
              setShowJoinModal(true);
            }}
          >
            <PlusCircle size={18} />
            <span>Join Walk-In Queue Now</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-lg"
            onClick={onNavigateAppointments}
          >
            <Calendar size={18} />
            <span>Book Doctor Appointment</span>
          </button>
        </div>
      </div>

      {/* Join Queue Modal */}
      {showJoinModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-title">
                <Ticket size={18} />
                <span>Join Department Queue</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowJoinModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleJoinSubmit}>
              <div className="modal-body">
                {joinError && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                    <AlertCircle size={16} />
                    <span>{joinError}</span>
                  </div>
                )}

                <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '16px' }}>
                  Select the hospital department where you need consultation. A sequential queue token will be issued for you immediately.
                </p>

                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className="form-control"
                    value={selectedDept}
                    onChange={(e) => setSelectedDept(e.target.value)}
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} &bull; {d.description || 'Clinical Care'} (~{d.avg_duration_minutes}m avg)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowJoinModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isJoining}
                >
                  {isJoining ? 'Issuing Token...' : 'Get Queue Token'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
