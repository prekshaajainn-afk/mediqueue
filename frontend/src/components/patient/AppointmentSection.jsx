import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  UserCheck,
  Building2,
  Plus,
  AlertCircle,
  CheckCircle2,
  XCircle,
  FileText,
  MapPin,
} from 'lucide-react';
import StatusBadge from '../StatusBadge';

const TIME_SLOTS = [
  '09:00 AM',
  '09:30 AM',
  '10:00 AM',
  '10:30 AM',
  '11:00 AM',
  '11:30 AM',
  '02:00 PM',
  '02:30 PM',
  '03:00 PM',
  '03:30 PM',
  '04:00 PM',
];

export default function AppointmentSection({
  appointments,
  departments,
  doctors,
  onBookAppointment,
  onCancelAppointment,
  isBooking,
}) {
  const [showModal, setShowModal] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelConfirmId, setCancelConfirmId] = useState(null);

  // Form State
  const [dept, setDept] = useState(departments[0]?.name || 'General Medicine');
  const [docId, setDocId] = useState('');
  const [apptDate, setApptDate] = useState(() => {
    // Tomorrow by default
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [timeSlot, setTimeSlot] = useState('10:00 AM');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Filter doctors based on selected department
  const filteredDoctors = doctors.filter((d) => d.department === dept);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!dept) {
      setFormError('Please select a hospital department.');
      return;
    }
    if (!apptDate) {
      setFormError('Please select an appointment date.');
      return;
    }
    if (!timeSlot) {
      setFormError('Please choose a time slot.');
      return;
    }

    try {
      await onBookAppointment({
        department: dept,
        doctor_id: docId ? parseInt(docId, 10) : undefined,
        appointment_date: apptDate,
        time_slot: timeSlot,
        reason: reason || 'Clinical Consultation',
      });

      setActionSuccess('Appointment successfully scheduled and confirmed!');
      setShowModal(false);
      setReason('');
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      setFormError(err.message || 'Failed to book appointment. Please try again.');
    }
  };

  const handleCancelClick = async (id) => {
    setCancellingId(id);
    try {
      await onCancelAppointment(id);
      setActionSuccess('Appointment cancelled successfully.');
      setCancelConfirmId(null);
      setTimeout(() => setActionSuccess(null), 5000);
    } catch (err) {
      alert(err.message || 'Failed to cancel appointment.');
    } finally {
      setCancellingId(null);
    }
  };

  const upcomingAppts = appointments.filter((a) => a.status === 'CONFIRMED');
  const pastAppts = appointments.filter((a) => a.status !== 'CONFIRMED');

  return (
    <div className="appointments-section">
      {/* Top Banner with Book Button */}
      <div className="section-header-box">
        <div>
          <h3 className="section-title">My Hospital Appointments</h3>
          <p className="section-subtitle">
            Schedule future clinical consultations or manage upcoming doctor appointments.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setFormError(null);
            setShowModal(true);
          }}
        >
          <Plus size={16} />
          <span>Book New Appointment</span>
        </button>
      </div>

      {actionSuccess && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          <CheckCircle2 size={18} />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Upcoming Appointments */}
      <div className="appts-group">
        <h4 className="group-heading">
          <span>Upcoming Appointments</span>
          <span className="count-badge">{upcomingAppts.length}</span>
        </h4>

        {upcomingAppts.length === 0 ? (
          <div className="empty-sub-card">
            <Calendar size={32} className="empty-sub-icon" />
            <div className="empty-sub-title">No Upcoming Appointments</div>
            <p className="empty-sub-text">
              You do not have any upcoming doctor appointments. Book a consultation anytime.
            </p>
          </div>
        ) : (
          <div className="appts-cards-grid">
            {upcomingAppts.map((appt) => (
              <div key={appt.id} className="appt-card upcoming">
                <div className="appt-card-top">
                  <div className="appt-dept-badge">
                    <Building2 size={14} />
                    <span>{appt.department}</span>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>

                <div className="appt-doctor-row">
                  <div className="appt-avatar">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <div className="appt-doctor-name">{appt.doctor_name || 'Department Specialist'}</div>
                    <div className="appt-doctor-spec">{appt.doctor_specialization || 'Clinical Doctor'}</div>
                  </div>
                </div>

                <div className="appt-meta-info">
                  <div className="meta-item">
                    <Calendar size={14} />
                    <span>{appt.appointment_date}</span>
                  </div>
                  <div className="meta-item">
                    <Clock size={14} />
                    <span>{appt.time_slot}</span>
                  </div>
                  <div className="meta-item">
                    <MapPin size={14} />
                    <span>{appt.room_number || 'Room 101'}</span>
                  </div>
                </div>

                {appt.reason && (
                  <div className="appt-reason-box">
                    <FileText size={12} />
                    <span>{appt.reason}</span>
                  </div>
                )}

                <div className="appt-card-footer">
                  {cancelConfirmId === appt.id ? (
                    <div className="cancel-confirm-inline">
                      <span style={{ fontSize: '0.78rem', color: '#991b1b', fontWeight: 600 }}>
                        Cancel this appointment?
                      </span>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        disabled={cancellingId === appt.id}
                        onClick={() => handleCancelClick(appt.id)}
                      >
                        {cancellingId === appt.id ? 'Cancelling...' : 'Confirm'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setCancelConfirmId(null)}
                      >
                        Back
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => setCancelConfirmId(appt.id)}
                    >
                      <XCircle size={14} />
                      <span>Cancel Appointment</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past / Cancelled Appointments */}
      {pastAppts.length > 0 && (
        <div className="appts-group" style={{ marginTop: '32px' }}>
          <h4 className="group-heading">
            <span>Past & Cancelled Appointments</span>
            <span className="count-badge muted">{pastAppts.length}</span>
          </h4>

          <div className="appts-cards-grid">
            {pastAppts.map((appt) => (
              <div key={appt.id} className="appt-card past">
                <div className="appt-card-top">
                  <div className="appt-dept-badge">
                    <Building2 size={14} />
                    <span>{appt.department}</span>
                  </div>
                  <StatusBadge status={appt.status} />
                </div>

                <div className="appt-doctor-row">
                  <div className="appt-avatar muted">
                    <UserCheck size={20} />
                  </div>
                  <div>
                    <div className="appt-doctor-name">{appt.doctor_name || 'Department Specialist'}</div>
                    <div className="appt-doctor-spec">{appt.doctor_specialization || 'Clinical Doctor'}</div>
                  </div>
                </div>

                <div className="appt-meta-info">
                  <div className="meta-item">
                    <Calendar size={14} />
                    <span>{appt.appointment_date}</span>
                  </div>
                  <div className="meta-item">
                    <Clock size={14} />
                    <span>{appt.time_slot}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Book Appointment Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <div className="modal-title">
                <Calendar size={18} />
                <span>Schedule a Doctor Consultation</span>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setShowModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && (
                  <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
                    <AlertCircle size={16} />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Hospital Department *</label>
                  <select
                    className="form-control"
                    value={dept}
                    onChange={(e) => {
                      setDept(e.target.value);
                      setDocId('');
                    }}
                    required
                  >
                    {departments.map((d) => (
                      <option key={d.name} value={d.name}>
                        {d.name} ({d.avg_duration_minutes || 10}m avg consultation)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Preferred Doctor (Optional)</label>
                  <select
                    className="form-control"
                    value={docId}
                    onChange={(e) => setDocId(e.target.value)}
                  >
                    <option value="">Any Available Specialist</option>
                    {filteredDoctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} — {doc.specialization} ({doc.room_number})
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Appointment Date *</label>
                    <input
                      type="date"
                      className="form-control"
                      value={apptDate}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={(e) => setApptDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Time Slot *</label>
                    <select
                      className="form-control"
                      value={timeSlot}
                      onChange={(e) => setTimeSlot(e.target.value)}
                      required
                    >
                      {TIME_SLOTS.map((slot) => (
                        <option key={slot} value={slot}>
                          {slot}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason / Clinical Symptoms</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    placeholder="Briefly describe your symptoms or reason for visit (e.g. Regular health checkup, chest discomfort, fever)..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isBooking}
                >
                  {isBooking ? 'Confirming...' : 'Confirm Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
