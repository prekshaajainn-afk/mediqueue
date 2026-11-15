import React from 'react';
import {
  Users,
  Clock,
  Activity,
  Layers,
  HelpCircle,
} from 'lucide-react';
import { formatWaitTime } from '../../utils/constants';

export default function QueueMetricsCards({
  activeVisit,
  departmentSummary,
}) {
  if (!activeVisit) return null;

  const isWaiting = activeVisit.status === 'WAITING';
  const isInProgress = activeVisit.status === 'IN_PROGRESS';

  return (
    <div className="queue-metrics-grid">
      {/* 1. Queue Position */}
      <div className="metric-box position-metric">
        <div className="metric-icon-box">
          <Users size={20} />
        </div>
        <div className="metric-details">
          <span className="metric-label">CURRENT QUEUE POSITION</span>
          <div className="metric-value">
            {isInProgress ? (
              <span style={{ fontSize: '1.4rem', color: '#0284c7' }}>In Room</span>
            ) : isWaiting ? (
              <span>#{activeVisit.queue_position || 1}</span>
            ) : (
              <span>--</span>
            )}
          </div>
          <span className="metric-caption">
            {isInProgress
              ? 'Consultation in progress'
              : activeVisit.patients_ahead === 0
              ? 'You are next in line'
              : `Behind ${activeVisit.patients_ahead} patient${activeVisit.patients_ahead > 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      {/* 2. Patients Ahead */}
      <div className="metric-box ahead-metric">
        <div className="metric-icon-box">
          <Layers size={20} />
        </div>
        <div className="metric-details">
          <span className="metric-label">PATIENTS AHEAD</span>
          <div className="metric-value">
            {isInProgress ? 0 : activeVisit.patients_ahead}
          </div>
          <span className="metric-caption">
            {activeVisit.patients_ahead === 0
              ? 'No other patients waiting'
              : `Waiting for ${activeVisit.department}`}
          </span>
        </div>
      </div>

      {/* 3. Estimated Wait Time */}
      <div className="metric-box wait-metric">
        <div className="metric-icon-box">
          <Clock size={20} />
        </div>
        <div className="metric-details">
          <span className="metric-label">ESTIMATED WAIT TIME</span>
          <div className="metric-value">
            {isInProgress ? '0 mins' : formatWaitTime(activeVisit.estimated_wait_minutes)}
          </div>
          <span className="metric-caption" title="Dynamic rule-based estimate based on clinical duration averages">
            ~{departmentSummary?.average_consultation_minutes || 10}m avg / consultation *
          </span>
        </div>
      </div>

      {/* 4. Department Status */}
      <div className="metric-box dept-metric">
        <div className="metric-icon-box">
          <Activity size={20} />
        </div>
        <div className="metric-details">
          <span className="metric-label">DEPARTMENT STATUS</span>
          <div className="metric-value" style={{ fontSize: '1.25rem' }}>
            {departmentSummary?.current_serving_token
              ? `Serving #${departmentSummary.current_serving_token}`
              : 'Doctor Ready'}
          </div>
          <span className="metric-caption">
            {departmentSummary?.waiting_in_department || 0} total waiting in {activeVisit.department}
          </span>
        </div>
      </div>
    </div>
  );
}
