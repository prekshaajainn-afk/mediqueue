import React from 'react';
import {
  Info,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  HelpCircle,
} from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="page-container" style={{ maxWidth: '820px' }}>
      {/* Title Card */}
      <div className="card" style={{ borderLeft: '5px solid #0d9488', marginBottom: '20px' }}>
        <div className="card-body" style={{ padding: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: '#f0fdfa',
            color: '#0d9488',
            padding: '3px 10px',
            borderRadius: '12px',
            fontSize: '0.75rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}>
            <Sparkles size={14} />
            <span>College PBL Project</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '6px' }}>
            MediQueue — Real-Time Hospital Queue Management System
          </h2>
          <p style={{ color: '#475569', fontSize: '0.92rem', lineHeight: 1.5 }}>
            A lightweight, web-based hospital queuing platform built to eliminate waiting room congestion, calculate clear waiting times, and streamline patient flow from reception to doctor consultation desks.
          </p>
        </div>
      </div>

      {/* 3-Tier Architecture Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div className="card-title">
            <Layers size={18} />
            <span>System Architecture</span>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#0284c7', fontSize: '0.92rem', marginBottom: '4px' }}>
                1. Frontend
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                React 18 &bull; Vite 6<br />
                Clean Minimal UI<br />
                Lucide React Icons
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#0d9488', fontSize: '0.92rem', marginBottom: '4px' }}>
                2. Backend
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                FastAPI &bull; Python 3.14<br />
                Uvicorn Web Server<br />
                Pydantic Validation
              </p>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontWeight: 700, color: '#059669', fontSize: '0.92rem', marginBottom: '4px' }}>
                3. Database
              </div>
              <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>
                SQLite3 Engine<br />
                SQLAlchemy ORM<br />
                Zero Cloud Costs
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Waiting-Time Formula Card */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <div className="card-title">
            <Clock size={18} />
            <span>How Waiting Time is Calculated</span>
          </div>
        </div>
        <div className="card-body">
          <p style={{ fontSize: '0.88rem', color: '#475569', marginBottom: '12px' }}>
            MediQueue uses a clear, deterministic queuing model based on queue depth and department consultation baselines:
          </p>

          <div style={{
            backgroundColor: '#f1f5f9',
            fontFamily: "'JetBrains Mono', monospace",
            padding: '14px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            marginBottom: '12px',
          }}>
            Estimated Wait = (Patients Ahead in Dept &times; Avg Duration) + (Avg Duration / 2 if Doctor Active)
          </div>

          <div style={{ fontSize: '0.82rem', color: '#64748b' }}>
            Baseline consultation times: Cardiology (15 min), Orthopedics (12 min), General Medicine (10 min), Pediatrics (10 min), Dermatology (10 min).
          </div>
        </div>
      </div>

      {/* Quick Viva Checklist for Teachers/Examiners */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">
            <CheckCircle2 size={18} style={{ color: '#059669' }} />
            <span>Project Viva Demonstration Steps</span>
          </div>
        </div>
        <div className="card-body">
          <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '0.88rem', color: '#334155' }}>
            <li>
              <strong>1. Dashboard:</strong> Show the 3 key metric cards (Waiting, In Consultation, Completed) and recent patients.
            </li>
            <li>
              <strong>2. Register Patient:</strong> Click <em>Register New Patient</em>, enter name, age, department, and issue a token.
            </li>
            <li>
              <strong>3. Manage Queue:</strong> Click <em>Call Next Patient</em> or <em>Start Consultation</em>, then complete the visit.
            </li>
            <li>
              <strong>4. Patient Tracking:</strong> Switch to <em>Patient Tracking</em>, enter the token number, and watch live status updates.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}
