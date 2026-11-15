import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  HeartPulse,
  Ticket,
  Clock,
  Calendar,
  UserCheck,
  Building2,
  Users,
  CheckCircle2,
  AlertCircle,
  Megaphone,
  Radio,
  ArrowRight,
  ShieldCheck,
  User,
  PlusCircle,
} from 'lucide-react';
import DigitalTokenCard from '../components/patient/DigitalTokenCard';
import LiveQueueTracker from '../components/patient/LiveQueueTracker';
import QueueMetricsCards from '../components/patient/QueueMetricsCards';
import AppointmentSection from '../components/patient/AppointmentSection';
import VisitHistorySection from '../components/patient/VisitHistorySection';
import PatientProfileSection from '../components/patient/PatientProfileSection';
import EmptyQueueState from '../components/patient/EmptyQueueState';
import PatientNavbar from '../components/patient/PatientNavbar';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function PatientDashboardPage({ onNavigateToStaff }) {
  const { user, patient, logout, refreshPatientProfile } = useAuth();

  const [activeTab, setActiveTab] = useState('overview'); // overview, queue, appointments, history, profile
  const [activeVisit, setActiveVisit] = useState(null);
  const [departmentSummary, setDepartmentSummary] = useState(null);
  const [visits, setVisits] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  // Action Loading States
  const [isJoining, setIsJoining] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Notifications State
  const [notifications, setNotifications] = useState([
    {
      id: 'welcome-1',
      title: 'Welcome to MediQueue',
      message: `Hello ${patient?.name || 'Patient'}, your patient portal is active.`,
      type: 'info',
      time: 'Just now',
      read: false,
    },
  ]);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Play audio chime when called
  const playNotificationChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch {
      // AudioContext unavailable or blocked
    }
  }, [soundEnabled]);

  // Central Patient Data Fetching
  const fetchPatientData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsRefreshing(true);
    try {
      const [visitRes, visitsList, apptsList, deptsList, docsList] = await Promise.all([
        api.getPatientActiveVisit().catch(() => ({ has_active_visit: false, visit: null })),
        api.getPatientVisits().catch(() => []),
        api.getPatientAppointments().catch(() => []),
        api.getDepartments().catch(() => []),
        api.getDoctors().catch(() => []),
      ]);

      if (visitRes.has_active_visit && visitRes.visit) {
        setActiveVisit(visitRes.visit);
        setDepartmentSummary(visitRes.department_summary);
      } else {
        setActiveVisit(null);
        setDepartmentSummary(null);
      }

      setVisits(visitsList || []);
      setAppointments(apptsList || []);
      if (deptsList && deptsList.length > 0) setDepartments(deptsList);
      if (docsList && docsList.length > 0) setDoctors(docsList);

      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed fetching patient dashboard data:', err);
    } finally {
      if (!isSilent) {
        setIsRefreshing(false);
        setIsLoading(false);
      }
    }
  }, []);

  // Initial Load
  useEffect(() => {
    fetchPatientData();
  }, [fetchPatientData]);

  // Real-Time WebSocket Connection & Event Handler
  useEffect(() => {
    let ws = null;
    let reconnectTimeout = null;

    const connectWebSocket = () => {
      try {
        const wsUrl = 'ws://127.0.0.1:8000/ws/queue';
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          setWsConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const entry = data.entry;
            const eventType = data.event;

            // Check if this event relates to this patient
            if (entry && (entry.patient_id === patient?.id || entry.patient_name === patient?.name)) {
              // Notification for status change
              let notifTitle = 'Queue Status Update';
              let notifType = 'status';

              if (eventType === 'PATIENT_CALLED' || entry.status === 'IN_PROGRESS') {
                notifTitle = 'Doctor is Ready For You!';
                notifType = 'called';
                playNotificationChime();
              } else if (eventType === 'VISIT_COMPLETED') {
                notifTitle = 'Consultation Completed';
                notifType = 'status';
              } else if (eventType === 'PATIENT_TRANSFERRED') {
                notifTitle = 'Department Transfer';
                notifType = 'info';
              }

              setNotifications((prev) => [
                {
                  id: `evt-${Date.now()}`,
                  title: notifTitle,
                  message: `Token #${entry.token_number} (${entry.department}): Status changed to ${entry.status}.`,
                  type: notifType,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                  read: false,
                },
                ...prev,
              ]);

              // Immediate state refresh
              fetchPatientData(true);
            } else if (activeVisit && data.department === activeVisit.department) {
              // Same department queue shifted (someone else was called or completed)
              fetchPatientData(true);
            }
          } catch {
            // Non-JSON ping
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          // Try reconnecting in 5s
          reconnectTimeout = setTimeout(connectWebSocket, 5000);
        };

        ws.onerror = () => {
          setWsConnected(false);
        };
      } catch {
        setWsConnected(false);
      }
    };

    connectWebSocket();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [patient?.id, patient?.name, activeVisit, fetchPatientData, playNotificationChime]);

  // Non-blocking Fallback Polling every 6 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPatientData(true);
    }, 6000);
    return () => clearInterval(interval);
  }, [fetchPatientData]);

  // Actions
  const handleJoinQueue = async (department) => {
    setIsJoining(true);
    try {
      const newEntry = await api.joinQueue(department);
      setActiveVisit(newEntry);
      setActiveTab('queue');
      setNotifications((prev) => [
        {
          id: `join-${Date.now()}`,
          title: 'Queue Token Issued',
          message: `Your Token #${newEntry.token_number} in ${newEntry.department} is active.`,
          type: 'info',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
        ...prev,
      ]);
      fetchPatientData(true);
    } finally {
      setIsJoining(false);
    }
  };

  const handleCancelActiveVisit = async () => {
    setIsCancelling(true);
    try {
      await api.cancelActiveVisit();
      setActiveVisit(null);
      setNotifications((prev) => [
        {
          id: `cancel-${Date.now()}`,
          title: 'Token Cancelled',
          message: 'You have left the active queue.',
          type: 'info',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
        ...prev,
      ]);
      fetchPatientData(true);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleBookAppointment = async (apptData) => {
    setIsBooking(true);
    try {
      const created = await api.bookAppointment(apptData);
      setAppointments((prev) => [created, ...prev]);
      setNotifications((prev) => [
        {
          id: `appt-${Date.now()}`,
          title: 'Appointment Confirmed',
          message: `Booked with ${created.doctor_name} for ${created.appointment_date} at ${created.time_slot}.`,
          type: 'appointment',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          read: false,
        },
        ...prev,
      ]);
      fetchPatientData(true);
    } finally {
      setIsBooking(false);
    }
  };

  const handleCancelAppointment = async (apptId) => {
    await api.cancelAppointment(apptId);
    setAppointments((prev) =>
      prev.map((a) => (a.id === apptId ? { ...a, status: 'CANCELLED' } : a))
    );
    setNotifications((prev) => [
      {
        id: `apptcanc-${Date.now()}`,
        title: 'Appointment Cancelled',
        message: 'Your scheduled consultation was cancelled.',
        type: 'info',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
      },
      ...prev,
    ]);
  };

  const handleUpdateProfile = async (profileData) => {
    setIsUpdatingProfile(true);
    try {
      await api.updatePatientProfile(profileData);
      await refreshPatientProfile();
      fetchPatientData(true);
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  // Next upcoming appointment
  const nextAppointment = appointments.find((a) => a.status === 'CONFIRMED');

  return (
    <div className="patient-portal-layout">
      {/* Patient Specific Header & Tabs Navigation */}
      <PatientNavbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        patient={patient}
        user={user}
        onLogout={logout}
        onSwitchToStaff={onNavigateToStaff}
        onManualRefresh={() => fetchPatientData(false)}
        isRefreshing={isRefreshing}
        notifications={notifications}
        onClearNotifications={() => setNotifications([])}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled(!soundEnabled)}
        isConnected={wsConnected}
        activeVisit={activeVisit}
      />

      <main className="patient-main-container">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="patient-overview-view">
            {/* A. Welcome Banner & Patient Identity */}
            <div className="patient-welcome-banner">
              <div className="welcome-text-side">
                <div className="patient-tag-pill">
                  <ShieldCheck size={14} />
                  <span>Authenticated Patient Portal</span>
                </div>
                <h2 className="welcome-title">
                  Welcome back, {patient?.name || 'Patient'}
                </h2>
                <p className="welcome-sub">
                  Medical ID: <strong>#MED-{patient?.id ? String(patient.id).padStart(5, '0') : '00001'}</strong> &bull;{' '}
                  Age: {patient?.age} Years &bull; Phone: {patient?.phone}
                </p>
              </div>

              <div className="welcome-stats-side">
                <div className="welcome-stat-chip">
                  <span className="stat-chip-label">Active Token</span>
                  <span className="stat-chip-val" style={{ color: activeVisit ? '#0d9488' : '#64748b' }}>
                    {activeVisit ? `#${activeVisit.token_number}` : 'None'}
                  </span>
                </div>
                <div className="welcome-stat-chip">
                  <span className="stat-chip-label">Upcoming Appt</span>
                  <span className="stat-chip-val" style={{ color: nextAppointment ? '#0284c7' : '#64748b' }}>
                    {nextAppointment ? nextAppointment.appointment_date : 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* B & C. Digital Token Card or Reassuring Empty State */}
            {activeVisit ? (
              <div style={{ marginBottom: '28px' }}>
                <DigitalTokenCard
                  activeVisit={activeVisit}
                  departmentSummary={departmentSummary}
                  onCancelActive={handleCancelActiveVisit}
                  isCancelling={isCancelling}
                  lastUpdated={lastUpdated}
                />

                <LiveQueueTracker
                  activeVisit={activeVisit}
                  wsConnected={wsConnected}
                />

                <QueueMetricsCards
                  activeVisit={activeVisit}
                  departmentSummary={departmentSummary}
                />
              </div>
            ) : (
              <EmptyQueueState
                departments={departments}
                onJoinQueue={handleJoinQueue}
                onNavigateAppointments={() => setActiveTab('appointments')}
                isJoining={isJoining}
              />
            )}

            {/* Overview Bottom Grid: Next Appointment & Recent Visits */}
            <div className="overview-subsections-grid">
              {/* Upcoming Appointment Widget */}
              <div className="card overview-card">
                <div className="card-header">
                  <div className="card-title">
                    <Calendar size={18} />
                    <span>Next Doctor Appointment</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setActiveTab('appointments')}
                  >
                    View All
                  </button>
                </div>

                <div className="card-body">
                  {nextAppointment ? (
                    <div className="overview-appt-box">
                      <div className="overview-appt-dept">{nextAppointment.department}</div>
                      <div className="overview-appt-doc">
                        <UserCheck size={16} />
                        <span>{nextAppointment.doctor_name}</span>
                      </div>
                      <div className="overview-appt-meta">
                        <span>{nextAppointment.appointment_date}</span> &bull;{' '}
                        <span>{nextAppointment.time_slot}</span> &bull;{' '}
                        <span>{nextAppointment.room_number || 'Room 101'}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-sub-card mini">
                      <Calendar size={24} className="empty-sub-icon" />
                      <div className="empty-sub-title">No Upcoming Appointments</div>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: '8px' }}
                        onClick={() => setActiveTab('appointments')}
                      >
                        Book Appointment
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Consultations Widget */}
              <div className="card overview-card">
                <div className="card-header">
                  <div className="card-title">
                    <Ticket size={18} />
                    <span>Recent Consultations</span>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary btn-xs"
                    onClick={() => setActiveTab('history')}
                  >
                    Full History
                  </button>
                </div>

                <div className="card-body">
                  {visits.length === 0 ? (
                    <div className="empty-sub-card mini">
                      <div className="empty-sub-title">No Previous Visits</div>
                      <p className="empty-sub-text">Completed consultations will appear here.</p>
                    </div>
                  ) : (
                    <div className="recent-visits-list">
                      {visits.slice(0, 3).map((v) => (
                        <div key={v.id} className="recent-visit-row">
                          <div className="visit-token-pill">#{v.token_number}</div>
                          <div className="visit-row-details">
                            <div className="visit-dept-text">{v.department}</div>
                            <div className="visit-sub-text">{v.doctor_name} &bull; {v.status}</div>
                          </div>
                          <div className="visit-date-text">
                            {v.created_at ? new Date(v.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Today'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: LIVE QUEUE & DIGITAL TOKEN */}
        {activeTab === 'queue' && (
          <div className="patient-queue-view">
            {activeVisit ? (
              <>
                <DigitalTokenCard
                  activeVisit={activeVisit}
                  departmentSummary={departmentSummary}
                  onCancelActive={handleCancelActiveVisit}
                  isCancelling={isCancelling}
                  lastUpdated={lastUpdated}
                />

                <LiveQueueTracker
                  activeVisit={activeVisit}
                  wsConnected={wsConnected}
                />

                <QueueMetricsCards
                  activeVisit={activeVisit}
                  departmentSummary={departmentSummary}
                />
              </>
            ) : (
              <EmptyQueueState
                departments={departments}
                onJoinQueue={handleJoinQueue}
                onNavigateAppointments={() => setActiveTab('appointments')}
                isJoining={isJoining}
              />
            )}
          </div>
        )}

        {/* TAB 3: MY APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <AppointmentSection
            appointments={appointments}
            departments={departments}
            doctors={doctors}
            onBookAppointment={handleBookAppointment}
            onCancelAppointment={handleCancelAppointment}
            isBooking={isBooking}
          />
        )}

        {/* TAB 4: VISIT HISTORY */}
        {activeTab === 'history' && (
          <VisitHistorySection visits={visits} />
        )}

        {/* TAB 5: PROFILE */}
        {activeTab === 'profile' && (
          <PatientProfileSection
            profile={{ ...patient, email: user?.email }}
            onUpdateProfile={handleUpdateProfile}
            isUpdating={isUpdatingProfile}
          />
        )}
      </main>
    </div>
  );
}
