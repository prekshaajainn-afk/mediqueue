import React from 'react';
import { Clock, Activity, CheckCircle2, XCircle } from 'lucide-react';

export default function StatusBadge({ status }) {
  const normStatus = (status || 'WAITING').toUpperCase();

  switch (normStatus) {
    case 'WAITING':
      return (
        <span className="badge badge-waiting">
          <Clock size={12} />
          <span>Waiting</span>
        </span>
      );
    case 'IN_PROGRESS':
      return (
        <span className="badge badge-in_progress">
          <Activity size={12} className="pulse-icon" />
          <span>In Progress</span>
        </span>
      );
    case 'COMPLETED':
      return (
        <span className="badge badge-completed">
          <CheckCircle2 size={12} />
          <span>Completed</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span className="badge badge-cancelled">
          <XCircle size={12} />
          <span>Cancelled</span>
        </span>
      );
    default:
      return <span className="badge">{status}</span>;
  }
}
