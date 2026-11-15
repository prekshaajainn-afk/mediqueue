import React, { useState } from 'react';
import {
  ListOrdered,
  PhoneCall,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Filter,
  Check,
  AlertCircle,
  ArrowRightLeft,
  X,
  Trash2,
  Sparkles,
  RefreshCw,
  Clock,
  RotateCcw,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { formatTime, formatWaitTime } from '../utils/constants';
import api from '../services/api';

export default function QueueManagementPage({
  queue,
  departments,
  onStatusUpdated,
  onEntryDeleted,
  onQueueReload,
}) {
  const [deptFilter, setDeptFilter] = useState('ALL');
  const [actionLoading, setActionLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Transfer Modal State
  const [transferTargetEntry, setTransferTargetEntry] = useState(null);
  const [transferDept, setTransferDept] = useState('');

  // Delete Confirmation State
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState(null);

  // Cleanup Modal State
  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupMode, setCleanupMode] = useState('stale_test'); // 'stale_test', 'completed_cancelled', 'reset_all'
  const [cleanupDept, setCleanupDept] = useState('ALL');

  // Filter entries
  const filteredQueue = (queue || []).filter((entry) => {
    if (deptFilter !== 'ALL' && entry.department !== deptFilter) return false;
    return true;
  });

  const waitingCount = filteredQueue.filter((e) => e.status === 'WAITING').length;

  // Single Action Handler for status updates
  const handleStatusChange = async (queueId, newStatus) => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const updated = await api.updateQueueStatus(queueId, newStatus);
      const label =
        newStatus === 'IN_PROGRESS'
          ? 'Consultation Started'
          : newStatus === 'COMPLETED'
          ? 'Visit Completed'
          : 'Marked as No-Show';

      setFeedback({
        type: 'success',
        message: `Token #${updated.token_number} (${updated.patient_name}): ${label}.`,
      });

      if (onStatusUpdated) onStatusUpdated(updated);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update patient status.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Call Next Patient
  const handleCallNext = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.callNextPatient(deptFilter);
      if (res.called_patient) {
        setFeedback({
          type: 'success',
          message: `Now Calling Token #${res.called_patient.token_number} (${res.called_patient.patient_name}) for consultation!`,
        });
        if (onStatusUpdated) onStatusUpdated(res.called_patient);
      } else {
        setFeedback({
          type: 'info',
          message: 'No waiting patients found to call.',
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to call next patient.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Individual Queue Entry
  const handleDeleteEntry = async () => {
    if (!deleteConfirmEntry) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      await api.deleteQueueEntry(deleteConfirmEntry.id);
      setFeedback({
        type: 'success',
        message: `Token #${deleteConfirmEntry.token_number} (${deleteConfirmEntry.patient_name}) was deleted from the queue.`,
      });
      if (onEntryDeleted) onEntryDeleted(deleteConfirmEntry.id);
      setDeleteConfirmEntry(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to delete queue entry.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Submit Queue Cleanup / Reset
  const handleCleanupSubmit = async () => {
    setActionLoading(true);
    setFeedback(null);
    try {
      const res = await api.cleanupQueue({
        mode: cleanupMode,
        department: cleanupDept !== 'ALL' ? cleanupDept : undefined,
      });

      setFeedback({
        type: 'success',
        message: res.message || 'Queue cleanup completed successfully.',
      });

      setShowCleanupModal(false);
      if (onQueueReload) onQueueReload();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Cleanup operation failed.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Open Transfer Modal
  const openTransferModal = (entry) => {
    setTransferTargetEntry(entry);
    const otherDepts = (departments || []).filter((d) => d.name !== entry.department);
    setTransferDept(otherDepts[0]?.name || '');
  };

  // Submit Department Transfer
  const submitTransfer = async () => {
    if (!transferTargetEntry || !transferDept) return;
    setActionLoading(true);
    setFeedback(null);
    try {
      const newEntry = await api.transferPatient(transferTargetEntry.id, transferDept);
      setFeedback({
        type: 'success',
        message: `Transferred ${newEntry.patient_name} to ${newEntry.department} (New Token #${newEntry.token_number}).`,
      });
      setTransferTargetEntry(null);
      if (onStatusUpdated) onStatusUpdated(newEntry);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to transfer patient.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="page-container">
      {feedback && (
        <div className={`alert ${feedback.type === 'success' ? 'alert-success' : 'alert-danger'}`}>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Queue Controls Bar */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-body" style={{ padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
            {/* Department Filter Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Filter size={16} color="#64748b" />
              <label style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569' }}>
                Department:
              </label>
              <select
                className="form-control"
                style={{ width: 'auto', padding: '6px 12px', fontSize: '0.88rem' }}
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
              >
                <option value="ALL">All Departments</option>
                {(departments || []).map((d) => (
                  <option key={d.name} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>

              <span style={{ fontSize: '0.82rem', color: '#64748b', marginLeft: '6px' }}>
                Waiting:{' '}
                <strong style={{ color: waitingCount > 0 ? '#b45309' : '#059669' }}>
                  {waitingCount}
                </strong>
              </span>
            </div>

            {/* Actions: Call Next & Clean / Reset Queue */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                className="btn btn-primary"
                onClick={handleCallNext}
                disabled={actionLoading || waitingCount === 0}
                style={{ boxShadow: '0 2px 8px rgba(13, 148, 136, 0.25)' }}
                title="Call the next waiting patient into consultation"
              >
                <PhoneCall size={16} />
                <span>Call Next Patient</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCleanupModal(true)}
                title="Clean up old records, stale test patients, or reset queue"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={15} color="#0d9488" />
                <span>Clean / Reset Queue</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Queue Table */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <ListOrdered size={18} />
            <span>
              {deptFilter === 'ALL' ? 'All Active Departments' : deptFilter} Patient Queue
            </span>
          </div>
          <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Showing {filteredQueue.length} patient record{filteredQueue.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Token #</th>
                <th>Patient Name</th>
                <th>Department</th>
                <th>Current Status</th>
                <th>Queued Time & Wait Est.</th>
                <th style={{ textAlign: 'right', minWidth: '220px' }}>Queue Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQueue.length > 0 ? (
                filteredQueue.map((entry) => {
                  const isWaiting = entry.status === 'WAITING';
                  const isInProgress = entry.status === 'IN_PROGRESS';
                  const isCompleted = entry.status === 'COMPLETED';
                  const isCancelled = entry.status === 'CANCELLED';

                  return (
                    <tr
                      key={entry.id}
                      style={{
                        backgroundColor: isInProgress ? '#f0fdfa' : undefined,
                      }}
                    >
                      <td>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.95rem',
                            color: '#0d9488',
                            backgroundColor: '#f0fdfa',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid #ccfbf1',
                          }}
                        >
                          #{entry.token_number}
                        </span>
                      </td>

                      <td>
                        <div style={{ fontWeight: 700, color: '#0f172a' }}>
                          {entry.patient_name}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          Patient ID: #{entry.patient_id}
                        </div>
                      </td>

                      <td>
                        <div style={{ color: '#334155', fontWeight: 500 }}>
                          {entry.department}
                        </div>
                        {entry.doctor_name && (
                          <div style={{ fontSize: '0.74rem', color: '#0d9488' }}>
                            {entry.doctor_name}
                          </div>
                        )}
                      </td>

                      <td>
                        <StatusBadge status={entry.status} />
                      </td>

                      <td>
                        <div style={{ fontSize: '0.85rem', color: '#334155' }}>
                          {formatTime(entry.created_at)}
                        </div>
                        {isWaiting && (
                          <div style={{ fontSize: '0.76rem', color: '#b45309', fontWeight: 600 }}>
                            {formatWaitTime(entry.estimated_wait_minutes)}
                            {entry.patients_ahead !== undefined && (
                              <span style={{ color: '#92400e', fontWeight: 400, marginLeft: '4px' }}>
                                ({entry.patients_ahead} ahead)
                              </span>
                            )}
                          </div>
                        )}
                        {isInProgress && (
                          <div style={{ fontSize: '0.76rem', color: '#0284c7', fontWeight: 600 }}>
                            In Room Now
                          </div>
                        )}
                      </td>

                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                          {isWaiting && (
                            <>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleStatusChange(entry.id, 'IN_PROGRESS')}
                                disabled={actionLoading}
                                title="Begin doctor consultation"
                              >
                                <PlayCircle size={14} />
                                <span>Start Consultation</span>
                              </button>
                              <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => openTransferModal(entry)}
                                disabled={actionLoading}
                                title="Transfer patient to another department"
                              >
                                <ArrowRightLeft size={13} />
                                <span>Transfer</span>
                              </button>
                              <button
                                className="btn btn-danger-outline btn-sm"
                                onClick={() => handleStatusChange(entry.id, 'CANCELLED')}
                                disabled={actionLoading}
                                title="Mark patient as no-show"
                              >
                                <XCircle size={14} />
                                <span>No-Show</span>
                              </button>
                            </>
                          )}

                          {isInProgress && (
                            <>
                              <button
                                className="btn btn-success btn-sm"
                                onClick={() => handleStatusChange(entry.id, 'COMPLETED')}
                                disabled={actionLoading}
                                title="Finish and complete visit"
                              >
                                <CheckCircle2 size={14} />
                                <span>Complete Visit</span>
                              </button>
                              <button
                                className="btn btn-danger-outline btn-sm"
                                onClick={() => handleStatusChange(entry.id, 'CANCELLED')}
                                disabled={actionLoading}
                                title="Mark as cancelled/no-show"
                              >
                                <XCircle size={14} />
                                <span>No-Show</span>
                              </button>
                            </>
                          )}

                          {isCompleted && (
                            <span style={{ fontSize: '0.82rem', color: '#059669', display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
                              <Check size={14} />
                              <span>Finished</span>
                            </span>
                          )}

                          {isCancelled && (
                            <span style={{ fontSize: '0.82rem', color: '#dc2626', marginRight: '4px' }}>
                              No-Show
                            </span>
                          )}

                          {/* Delete Entry Button */}
                          <button
                            type="button"
                            className="btn-icon-danger"
                            onClick={() => setDeleteConfirmEntry(entry)}
                            disabled={actionLoading}
                            title="Delete this token record permanently"
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#94a3b8',
                              cursor: 'pointer',
                              padding: '5px',
                              borderRadius: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'color 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="empty-state">
                    No patients found for this department.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Entry Confirmation Modal */}
      {deleteConfirmEntry && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <div className="modal-title" style={{ color: '#dc2626' }}>
                <Trash2 size={18} />
                <span>Delete Queue Record</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setDeleteConfirmEntry(null)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.92rem', color: '#334155', margin: '0 0 12px' }}>
                Are you sure you want to delete <strong>Token #{deleteConfirmEntry.token_number}</strong> for{' '}
                <strong>{deleteConfirmEntry.patient_name}</strong> ({deleteConfirmEntry.department})?
              </p>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                This will permanently remove this queue entry and instantly update remaining wait times.
              </p>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteConfirmEntry(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteEntry}
                disabled={actionLoading}
              >
                {actionLoading ? 'Deleting...' : 'Delete Permanently'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Queue Maintenance & Cleanup Modal */}
      {showCleanupModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <Sparkles size={18} color="#0d9488" />
                <span>Queue Maintenance & Data Cleanup</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowCleanupModal(false)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '18px' }}>
                Select a cleanup action to purge old records, remove dummy test entries, or reset queue wait times:
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    border: cleanupMode === 'stale_test' ? '2px solid #0d9488' : '1px solid #e2e8f0',
                    backgroundColor: cleanupMode === 'stale_test' ? '#f0fdfa' : '#ffffff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="cleanupMode"
                    value="stale_test"
                    checked={cleanupMode === 'stale_test'}
                    onChange={(e) => setCleanupMode(e.target.value)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      Purge Stale & Test Data (Recommended)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      Deletes automated test patients and unserved waiting tokens from prior days to immediately fix 24hr wait time runaway.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    border: cleanupMode === 'completed_cancelled' ? '2px solid #0d9488' : '1px solid #e2e8f0',
                    backgroundColor: cleanupMode === 'completed_cancelled' ? '#f0fdfa' : '#ffffff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="cleanupMode"
                    value="completed_cancelled"
                    checked={cleanupMode === 'completed_cancelled'}
                    onChange={(e) => setCleanupMode(e.target.value)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
                      Clear Completed & Cancelled Visits
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      Removes finished and no-show entries to keep the queue table clean and fast.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    border: cleanupMode === 'reset_all' ? '2px solid #ef4444' : '1px solid #e2e8f0',
                    backgroundColor: cleanupMode === 'reset_all' ? '#fef2f2' : '#ffffff',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="cleanupMode"
                    value="reset_all"
                    checked={cleanupMode === 'reset_all'}
                    onChange={(e) => setCleanupMode(e.target.value)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#991b1b' }}>
                      Reset Entire Queue (Fresh Shift / Demo)
                    </div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                      Clears current queue entries so token numbering restarts from #1.
                    </div>
                  </div>
                </label>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Target Department</label>
                <select
                  className="form-control"
                  value={cleanupDept}
                  onChange={(e) => setCleanupDept(e.target.value)}
                >
                  <option value="ALL">All Hospital Departments</option>
                  {(departments || []).map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowCleanupModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={cleanupMode === 'reset_all' ? 'btn btn-danger' : 'btn btn-primary'}
                onClick={handleCleanupSubmit}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Execute Cleanup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Department Transfer Modal */}
      {transferTargetEntry && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div className="modal-title">
                <ArrowRightLeft size={18} color="#0d9488" />
                <span>Transfer Department</span>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setTransferTargetEntry(null)}
              >
                &times;
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '16px' }}>
                Transfer <strong>{transferTargetEntry.patient_name}</strong> from{' '}
                <strong>{transferTargetEntry.department}</strong> to another department. A new sequential token will be generated automatically.
              </p>

              <div className="form-group">
                <label className="form-label">Target Department *</label>
                <select
                  className="form-control"
                  value={transferDept}
                  onChange={(e) => setTransferDept(e.target.value)}
                >
                  {(departments || [])
                    .filter((d) => d.name !== transferTargetEntry.department)
                    .map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setTransferTargetEntry(null)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={submitTransfer}
                disabled={actionLoading}
              >
                {actionLoading ? 'Transferring...' : 'Confirm Transfer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
