import React from 'react';
import {
  ClipboardCheck,
  Hourglass,
  Megaphone,
  Stethoscope,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Wifi,
  WifiOff,
} from 'lucide-react';

export default function LiveQueueTracker({
  activeVisit,
  wsConnected,
}) {
  if (!activeVisit) return null;

  const status = activeVisit.status;
  const isCancelled = status === 'CANCELLED';

  // Progression Stages
  // 1: Registered
  // 2: Waiting
  // 3: Called (When patients_ahead === 0 or status is IN_PROGRESS)
  // 4: In Consultation (status === IN_PROGRESS)
  // 5: Completed (status === COMPLETED)

  let currentStageIndex = 1; // default Registered
  if (status === 'WAITING') {
    currentStageIndex = activeVisit.patients_ahead === 0 ? 3 : 2;
  } else if (status === 'IN_PROGRESS') {
    currentStageIndex = 4;
  } else if (status === 'COMPLETED') {
    currentStageIndex = 5;
  }

  const stages = [
    {
      index: 1,
      id: 'registered',
      title: 'Registered',
      description: 'Token issued in system',
      icon: ClipboardCheck,
    },
    {
      index: 2,
      id: 'waiting',
      title: 'Waiting in Queue',
      description: activeVisit.patients_ahead > 0 ? `${activeVisit.patients_ahead} patients ahead` : 'In waiting lounge',
      icon: Hourglass,
    },
    {
      index: 3,
      id: 'called',
      title: 'Called to Room',
      description: `Proceed to ${activeVisit.room_number || 'Room 101'}`,
      icon: Megaphone,
    },
    {
      index: 4,
      id: 'consultation',
      title: 'In Consultation',
      description: 'With doctor now',
      icon: Stethoscope,
    },
    {
      index: 5,
      id: 'completed',
      title: 'Completed',
      description: 'Consultation finished',
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="card live-tracker-card">
      <div className="card-header tracker-header">
        <div className="tracker-header-left">
          <div className="tracker-badge-pill">
            <Radio size={14} className="animate-pulse" />
            <span>LIVE PATIENT JOURNEY TRACKER</span>
          </div>
          <h3 className="tracker-title">Real-Time Consultation Progress</h3>
        </div>

        <div className="ws-status-badge">
          {wsConnected ? (
            <span className="ws-connected-pill">
              <Wifi size={14} />
              <span>WebSocket Connected</span>
            </span>
          ) : (
            <span className="ws-disconnected-pill">
              <WifiOff size={14} />
              <span>Polling Fallback (6s)</span>
            </span>
          )}
        </div>
      </div>

      <div className="card-body tracker-body">
        {isCancelled ? (
          <div className="alert alert-danger tracker-cancelled-alert">
            <div className="alert-icon-box">
              <XCircle size={24} />
            </div>
            <div>
              <strong>Token #{activeVisit.token_number} Was Cancelled or Marked No-Show</strong>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                This queue session has ended. If you still require medical attention, please rejoin the queue or visit the hospital reception desk.
              </p>
            </div>
          </div>
        ) : (
          <div className="stepper-horizontal">
            {stages.map((stage) => {
              const Icon = stage.icon;
              const isPast = stage.index < currentStageIndex;
              const isCurrent = stage.index === currentStageIndex;
              const isUpcoming = stage.index > currentStageIndex;

              let stepClass = 'stepper-step';
              if (isPast) stepClass += ' step-completed';
              if (isCurrent) stepClass += ' step-active';
              if (isUpcoming) stepClass += ' step-upcoming';

              return (
                <div key={stage.id} className={stepClass}>
                  <div className="step-circle-wrapper">
                    <div className="step-circle">
                      {isPast ? <CheckCircle2 size={18} /> : <Icon size={18} />}
                    </div>
                    {stage.index < stages.length && (
                      <div className={`step-connector ${isPast ? 'connector-filled' : ''}`} />
                    )}
                  </div>
                  <div className="step-content">
                    <div className="step-title">{stage.title}</div>
                    <div className="step-desc">{stage.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Dynamic Contextual Guidance Banner */}
        <div className="tracker-guidance-box">
          {status === 'WAITING' && activeVisit.patients_ahead > 0 && (
            <div className="guidance-content waiting-guidance">
              <Hourglass size={18} />
              <span>
                You are currently in position <strong>#{activeVisit.queue_position}</strong>. 
                Average wait for {activeVisit.department} is estimated at <strong>~{activeVisit.estimated_wait_minutes} minutes</strong>.
              </span>
            </div>
          )}

          {status === 'WAITING' && activeVisit.patients_ahead === 0 && (
            <div className="guidance-content called-guidance animate-bounce-gentle">
              <Megaphone size={18} />
              <span>
                <strong>You are next in line!</strong> Please move to <strong>{activeVisit.room_number || 'Room 101'}</strong>. The doctor will call your token shortly.
              </span>
            </div>
          )}

          {status === 'IN_PROGRESS' && (
            <div className="guidance-content active-guidance">
              <Stethoscope size={18} />
              <span>
                <strong>Your consultation with {activeVisit.doctor_name || 'the physician'} is currently in progress.</strong>
              </span>
            </div>
          )}

          {status === 'COMPLETED' && (
            <div className="guidance-content completed-guidance">
              <CheckCircle2 size={18} />
              <span>
                <strong>Consultation completed.</strong> Pick up any prescribed medications at the hospital pharmacy.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
