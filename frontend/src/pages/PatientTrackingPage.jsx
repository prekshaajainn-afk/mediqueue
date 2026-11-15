import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  Users,
  AlertCircle,
  Building2,
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import { formatWaitTime } from '../utils/constants';
import api from '../services/api';

export default function PatientTrackingPage({ departments, queue }) {
  const [tokenInput, setTokenInput] = useState('');
  const [deptInput, setDeptInput] = useState('ALL');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [trackedToken, setTrackedToken] = useState(null);

  // Fetch token details
  const handleTrack = async (e) => {
    if (e) e.preventDefault();
    const tokenNum = parseInt(tokenInput, 10);
    if (!tokenInput || isNaN(tokenNum) || tokenNum <= 0) {
      setErrorMsg('Please enter a valid positive token number.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await api.trackToken(tokenNum, deptInput);
      setTrackedToken(res);
    } catch (err) {
      setTrackedToken(null);
      setErrorMsg(err.message || `Token #${tokenNum} could not be found.`);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-Time Sync: Whenever queue changes over WebSockets, automatically reflect updates for the tracked token
  useEffect(() => {
    if (!trackedToken || !queue) return;

    const matchedEntry = queue.find(
      (item) =>
        item.token_number === trackedToken.token_number &&
        (deptInput === 'ALL' || item.department === trackedToken.department)
    );

    if (matchedEntry) {
      setTrackedToken(matchedEntry);
    }
  }, [queue, deptInput, trackedToken]);

  return (
    <div className="page-container" style={{ maxWidth: '760px' }}>
      {/* Search Bar Card */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <div className="card-title">
            <Search size={18} />
            <span>Track Your Queue Token</span>
          </div>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '18px' }}>
            Check your real-time waiting status, queue position, and estimated consultation time.
          </p>

          <form onSubmit={handleTrack}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr auto', gap: '12px', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Token Number *</label>
                <input
                  type="number"
                  min="1"
                  className="form-control"
                  placeholder="e.g. 1"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Department (Optional)</label>
                <select
                  className="form-control"
                  value={deptInput}
                  onChange={(e) => setDeptInput(e.target.value)}
                >
                  <option value="ALL">Any Department</option>
                  {(departments || []).map((d) => (
                    <option key={d.name} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ height: '42px', padding: '0 20px' }}
              >
                <Search size={16} />
                <span>{isLoading ? 'Checking...' : 'Track Token'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {errorMsg && (
        <div className="alert alert-danger">
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tracked Result Display */}
      {trackedToken && (
        <div className="card">
          <div className="card-body" style={{ padding: '32px 28px' }}>
            {/* Header with Patient Name & Department */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '20px',
              marginBottom: '24px',
              gap: '12px',
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                  Patient Name
                </span>
                <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#0f172a', margin: '2px 0 0' }}>
                  {trackedToken.patient_name}
                </h3>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                  Hospital Department
                </span>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 700,
                  color: '#0d9488',
                  fontSize: '1rem',
                  marginTop: '2px',
                }}>
                  <Building2 size={16} />
                  <span>{trackedToken.department}</span>
                </div>
              </div>
            </div>

            {/* Prominent Status Banner */}
            <div style={{ textAlign: 'center', marginBottom: '28px' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em' }}>
                Your Token Number
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '4.5rem',
                fontWeight: 900,
                color: '#0d9488',
                lineHeight: 1.1,
                margin: '8px 0',
              }}>
                #{trackedToken.token_number}
              </div>

              <div style={{ marginTop: '8px' }}>
                <StatusBadge status={trackedToken.status} />
              </div>
            </div>

            {/* Status-specific Guidance */}
            {trackedToken.status === 'WAITING' && (
              <div style={{
                backgroundColor: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}>
                <div>
                  <div style={{ fontSize: '0.78rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>
                    Patients Ahead
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b45309', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={20} />
                    <span>
                      {trackedToken.patients_ahead === 0
                        ? 'You are next in line!'
                        : `${trackedToken.patients_ahead} patient(s)`}
                    </span>
                  </div>
                </div>

                <div>
                  <div style={{ fontSize: '0.78rem', color: '#92400e', textTransform: 'uppercase', fontWeight: 600 }}>
                    Estimated Wait Time
                  </div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#b45309', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={20} />
                    <span>{formatWaitTime(trackedToken.estimated_wait_minutes)}</span>
                  </div>
                </div>
              </div>
            )}

            {trackedToken.status === 'IN_PROGRESS' && (
              <div style={{
                backgroundColor: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#0369a1', fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>
                  Doctor is Ready for You!
                </div>
                <p style={{ color: '#0284c7', fontSize: '0.9rem', margin: 0 }}>
                  Please proceed directly to the <strong>{trackedToken.department}</strong> consultation room.
                </p>
              </div>
            )}

            {trackedToken.status === 'COMPLETED' && (
              <div style={{
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#047857', fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>
                  Consultation Completed
                </div>
                <p style={{ color: '#059669', fontSize: '0.9rem', margin: 0 }}>
                  Your hospital visit has finished. Thank you for using MediQueue!
                </p>
              </div>
            )}

            {trackedToken.status === 'CANCELLED' && (
              <div style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '20px',
                marginBottom: '24px',
                textAlign: 'center',
              }}>
                <div style={{ color: '#991b1b', fontWeight: 700, fontSize: '1.1rem', marginBottom: '4px' }}>
                  Token Cancelled / No-Show
                </div>
                <p style={{ color: '#dc2626', fontSize: '0.9rem', margin: 0 }}>
                  This token was marked as cancelled. Please speak with the hospital reception if you need a new token.
                </p>
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              fontSize: '0.78rem',
              color: '#059669',
              fontWeight: 600,
            }}>
              <span className="status-dot online" />
              <span>Real-Time WebSocket Sync Active &bull; Instant live updates</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
