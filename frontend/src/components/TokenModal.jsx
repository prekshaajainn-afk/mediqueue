import React from 'react';
import { CheckCircle2, Printer, X, Clock, Users, Building2 } from 'lucide-react';
import { formatWaitTime } from '../utils/constants';

export default function TokenModal({ entry, onClose }) {
  if (!entry) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ color: '#0d9488' }}>
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Queue Token Issued</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>Patient successfully enqueued</p>
            </div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose} style={{ padding: '4px 8px' }}>
            <X size={16} />
          </button>
        </div>

        <div className="modal-body" style={{ textAlign: 'center' }}>
          <div style={{
            background: 'linear-gradient(135deg, #f0fdfa 0%, #e0f2fe 100%)',
            border: '2px dashed #0d9488',
            borderRadius: '16px',
            padding: '24px',
            marginBottom: '20px'
          }}>
            <div style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#0d9488', fontWeight: 700, letterSpacing: '0.05em' }}>
              Hospital Queue Token
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '4.2rem',
              fontWeight: 900,
              color: '#0f172a',
              lineHeight: 1.1,
              margin: '8px 0'
            }}>
              #{entry.token_number}
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#ffffff',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#0369a1',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
            }}>
              <Building2 size={16} />
              <span>{entry.department}</span>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
            textAlign: 'left',
            marginBottom: '16px'
          }}>
            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Patient Name</div>
              <div style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.95rem' }}>{entry.patient_name}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>ID: #{entry.patient_id}</div>
            </div>

            <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '10px' }}>
              <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Estimated Wait</div>
              <div style={{ fontWeight: 700, color: '#0d9488', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={14} />
                <span>{formatWaitTime(entry.estimated_wait_minutes)}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Users size={12} />
                <span>{entry.patients_ahead || 0} patient(s) ahead</span>
              </div>
            </div>
          </div>

          <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: 0 }}>
            * Estimated wait time is calculated dynamically based on department queue length and average consultation duration.
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={() => window.print()}>
            <Printer size={16} />
            <span>Print Token Slip</span>
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
