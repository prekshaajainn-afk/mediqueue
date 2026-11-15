import React, { useState } from 'react';
import { Monitor, Maximize2, Users, Clock, ShieldCheck } from 'lucide-react';
import { formatWaitTime } from '../utils/constants';

export default function QueueDisplayPage({ queue, departments, lastUpdated, connectionStatus }) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
      }
    }
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <div className="page-container">
      {/* Kiosk Display Wrapper */}
      <div style={{
        backgroundColor: '#0f172a',
        color: '#ffffff',
        borderRadius: '16px',
        padding: '28px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25)',
      }}>
        {/* Kiosk Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
          borderBottom: '1px solid #334155',
          paddingBottom: '20px',
          marginBottom: '28px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              backgroundColor: '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
            }}>
              <Monitor size={24} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, letterSpacing: '-0.01em', color: '#ffffff' }}>
                HOSPITAL WAITING ROOM DISPLAY
              </h1>
              <p style={{ fontSize: '0.82rem', color: '#94a3b8', margin: '2px 0 0' }}>
                Live Consultation Token Broadcast &bull; Please proceed when your token is called
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {/* Live Indicator */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isConnected ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${isConnected ? '#059669' : '#dc2626'}`,
              padding: '4px 10px',
              borderRadius: '20px',
              fontSize: '0.78rem',
              fontWeight: 700,
              color: isConnected ? '#34d399' : '#f87171',
            }}>
              <span className={`status-dot ${isConnected ? 'online' : 'offline'}`} />
              <span>{isConnected ? 'LIVE WEBSOCKET' : 'CONNECTING...'}</span>
            </div>

            <button
              onClick={toggleFullscreen}
              className="btn btn-secondary btn-sm"
              style={{
                backgroundColor: '#1e293b',
                color: '#ffffff',
                borderColor: '#475569',
              }}
            >
              <Maximize2 size={14} />
              <span>Fullscreen</span>
            </button>
          </div>
        </div>

        {/* Department Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '20px',
        }}>
          {(departments || []).map((dept) => {
            const deptQueue = (queue || []).filter((e) => e.department === dept.name);
            const serving = deptQueue.find((e) => e.status === 'IN_PROGRESS');
            const waiting = deptQueue.filter((e) => e.status === 'WAITING');

            return (
              <div
                key={dept.name}
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '12px',
                  border: '1px solid #334155',
                  overflow: 'hidden',
                }}
              >
                {/* Dept Title Bar */}
                <div style={{
                  padding: '14px 18px',
                  backgroundColor: 'rgba(15, 23, 42, 0.6)',
                  borderBottom: '1px solid #334155',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <span style={{ fontWeight: 700, fontSize: '0.98rem', color: '#f8fafc' }}>
                    {dept.name}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={12} />
                    <span>{waiting.length} waiting</span>
                  </span>
                </div>

                {/* Now Serving Big Number */}
                <div style={{
                  padding: '24px 20px',
                  textAlign: 'center',
                  background: 'linear-gradient(180deg, rgba(13, 148, 136, 0.15) 0%, transparent 100%)',
                  borderBottom: '1px solid #334155',
                }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#2dd4bf', fontWeight: 800 }}>
                    Now Serving
                  </div>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '3.6rem',
                    fontWeight: 900,
                    color: serving ? '#ffffff' : '#475569',
                    lineHeight: 1.1,
                    margin: '6px 0',
                    textShadow: serving ? '0 0 16px rgba(45, 212, 191, 0.35)' : 'none',
                  }}>
                    {serving ? `#${serving.token_number}` : '--'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: serving ? '#5eead4' : '#64748b', fontWeight: 500 }}>
                    {serving ? 'Doctor Room Active' : 'No patient currently inside'}
                  </div>
                </div>

                {/* Upcoming Waiting List */}
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px' }}>
                    Up Next In Queue
                  </div>

                  {waiting.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {waiting.slice(0, 3).map((w, index) => (
                        <div
                          key={w.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            backgroundColor: '#0f172a',
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: index === 0 ? '1px solid #0d9488' : '1px solid #334155',
                          }}
                        >
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontWeight: 800,
                            color: index === 0 ? '#2dd4bf' : '#e2e8f0',
                            fontSize: '0.92rem',
                          }}>
                            Token #{w.token_number}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} />
                            <span>{formatWaitTime(w.estimated_wait_minutes)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#64748b', fontSize: '0.82rem', padding: '8px' }}>
                      Queue is clear
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Privacy Note */}
        <div style={{
          marginTop: '28px',
          padding: '12px 18px',
          backgroundColor: '#1e293b',
          borderRadius: '8px',
          border: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '0.78rem',
          color: '#94a3b8',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} color="#34d399" />
            <span>Public Lobby Mode: Patient names and phone numbers are hidden for patient privacy.</span>
          </div>
          <div>
            MediQueue Real-Time Hospital Display
          </div>
        </div>
      </div>
    </div>
  );
}
