import React, { useState } from 'react';
import {
  UserPlus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Building2,
  Users,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import api from '../services/api';
import { formatWaitTime } from '../utils/constants';

export default function PatientRegistrationPage({
  departments,
  onQueueCreated,
  onNavigate,
}) {
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    department: departments?.[0]?.name || 'General Medicine',
  });

  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [successEntry, setSuccessEntry] = useState(null);

  const validate = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Please enter the patient name.';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Name must be under 100 characters.';
    }

    const ageNum = parseInt(formData.age, 10);
    if (!formData.age || isNaN(ageNum)) {
      errors.age = 'Please enter a valid age.';
    } else if (ageNum < 0 || ageNum > 120) {
      errors.age = 'Age must be between 0 and 120 years.';
    }

    if (!formData.department) {
      errors.department = 'Please select a hospital department.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name.trim(),
        age: parseInt(formData.age, 10),
        department: formData.department.trim(),
      };

      const result = await api.quickRegisterAndQueue(payload);
      setSuccessEntry(result);

      if (onQueueCreated) {
        onQueueCreated(result);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Unable to register patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: '',
      age: '',
      department: departments?.[0]?.name || 'General Medicine',
    });
    setFormErrors({});
    setErrorMsg(null);
    setSuccessEntry(null);
  };

  return (
    <div className="page-container" style={{ maxWidth: '720px' }}>
      {errorMsg && (
        <div className="alert alert-danger">
          <AlertCircle size={20} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* When Registration Succeeds: Show Clear Token Confirmation */}
      {successEntry ? (
        <div className="card" style={{ borderTop: '4px solid #0d9488' }}>
          <div className="card-body" style={{ textAlign: 'center', padding: '36px 28px' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#ecfdf5',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '4px' }}>
              Patient Registered Successfully!
            </h3>
            <p style={{ color: '#64748b', fontSize: '0.9rem', marginBottom: '24px' }}>
              Token issued for <strong>{successEntry.patient_name}</strong>
            </p>

            {/* Prominent Token Display Box */}
            <div style={{
              backgroundColor: '#f0fdfa',
              border: '2px solid #99f6e4',
              borderRadius: '16px',
              padding: '24px',
              marginBottom: '28px',
            }}>
              <div style={{ fontSize: '0.85rem', color: '#0f766e', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Queue Token Number
              </div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '4.2rem',
                fontWeight: 900,
                color: '#0d9488',
                lineHeight: 1.1,
                margin: '6px 0',
              }}>
                #{successEntry.token_number}
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: '#ffffff',
                padding: '6px 16px',
                borderRadius: '20px',
                fontWeight: 600,
                color: '#0284c7',
                border: '1px solid #bae6fd',
                fontSize: '0.9rem',
              }}>
                <Building2 size={16} />
                <span>{successEntry.department}</span>
              </div>
            </div>

            {/* Position and Wait Time Details */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              textAlign: 'left',
              marginBottom: '28px',
            }}>
              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Queue Position
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Users size={16} color="#0d9488" />
                  <span>
                    {successEntry.patients_ahead === 0
                      ? 'You are next in line!'
                      : `${successEntry.patients_ahead} patient(s) ahead`}
                  </span>
                </div>
              </div>

              <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                  Estimated Wait Time
                </div>
                <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0d9488', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={16} color="#0d9488" />
                  <span>{formatWaitTime(successEntry.estimated_wait_minutes)}</span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={handleReset}>
                <RotateCcw size={16} />
                <span>Register Another Patient</span>
              </button>
              <button className="btn btn-primary" onClick={() => onNavigate('queue')}>
                <span>View in Manage Queue</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Simple Registration Form */
        <div className="card">
          <div className="card-header">
            <div className="card-title">
              <UserPlus size={18} />
              <span>Register Patient & Generate Token</span>
            </div>
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-group">
                <label className="form-label">Patient Name *</label>
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Ramesh Patel"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                {formErrors.name && <div className="form-error">{formErrors.name}</div>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Age (in years) *</label>
                  <input
                    type="number"
                    min="0"
                    max="120"
                    className="form-control"
                    placeholder="e.g. 28"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  />
                  {formErrors.age && <div className="form-error">{formErrors.age}</div>}
                </div>

                <div className="form-group">
                  <label className="form-label">Department *</label>
                  <select
                    className="form-control"
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  >
                    {(departments || []).map((dept) => (
                      <option key={dept.name} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  {formErrors.department && <div className="form-error">{formErrors.department}</div>}
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <button
                  type="submit"
                  className="btn btn-primary btn-lg"
                  disabled={isSubmitting}
                  style={{ width: '100%' }}
                >
                  <UserPlus size={18} />
                  <span>{isSubmitting ? 'Generating Token...' : 'Register & Issue Token'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
