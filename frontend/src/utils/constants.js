export const DEFAULT_DEPARTMENTS = [
  { id: 'gen_med', name: 'General Medicine', code: 'GEN', avg_duration_minutes: 10 },
  { id: 'cardio', name: 'Cardiology', code: 'CARD', avg_duration_minutes: 15 },
  { id: 'ortho', name: 'Orthopedics', code: 'ORTH', avg_duration_minutes: 12 },
  { id: 'pedia', name: 'Pediatrics', code: 'PED', avg_duration_minutes: 10 },
  { id: 'derma', name: 'Dermatology', code: 'DERM', avg_duration_minutes: 10 },
];

export const STATUS_CONFIG = {
  WAITING: {
    label: 'Waiting',
    color: '#b45309',
    bgColor: '#fef3c7',
    borderColor: '#fde68a',
    icon: 'Clock',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: '#0369a1',
    bgColor: '#e0f2fe',
    borderColor: '#bae6fd',
    icon: 'Activity',
  },
  COMPLETED: {
    label: 'Completed',
    color: '#047857',
    bgColor: '#d1fae5',
    borderColor: '#a7f3d0',
    icon: 'CheckCircle2',
  },
  CANCELLED: {
    label: 'Cancelled',
    color: '#b91c1c',
    bgColor: '#fee2e2',
    borderColor: '#fecaca',
    icon: 'XCircle',
  },
};

export function formatTime(isoString) {
  if (!isoString) return '--:--';
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatWaitTime(minutes) {
  if (minutes === 0 || minutes <= 0) return 'Immediate (Next)';
  if (minutes < 60) return `~${minutes} mins`;
  const hrs = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hrs >= 2 && remaining === 0) return `~${hrs} hrs (Max OPD)`;
  return `~${hrs} hr ${remaining > 0 ? `${remaining}m` : ''}`;
}
