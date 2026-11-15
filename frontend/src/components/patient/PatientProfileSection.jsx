import React, { useState } from 'react';
import {
  User,
  Phone,
  Mail,
  Calendar,
  Shield,
  Edit2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Building,
} from 'lucide-react';

export default function PatientProfileSection({
  profile,
  onUpdateProfile,
  isUpdating,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(profile?.name || '');
  const [age, setAge] = useState(profile?.age || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await onUpdateProfile({
        name: name.trim(),
        age: parseInt(age, 10),
        phone: phone.trim(),
      });
      setIsEditing(false);
      setSuccessMsg('Profile information updated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to update profile.');
    }
  };

  return (
    <div className="patient-profile-section">
      <div className="section-header-box">
        <div>
          <h3 className="section-title">Patient Profile & Medical Identity</h3>
          <p className="section-subtitle">
            Authenticated hospital identity registered in MediQueue Hospital Information System.
          </p>
        </div>

        {!isEditing && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              setName(profile?.name || '');
              setAge(profile?.age || '');
              setPhone(profile?.phone || '');
              setIsEditing(true);
            }}
          >
            <Edit2 size={14} />
            <span>Edit Contact Info</span>
          </button>
        )}
      </div>

      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="profile-layout-grid">
        {/* Left ID Card */}
        <div className="card patient-id-card">
          <div className="id-card-header">
            <div className="id-badge-circle">
              <User size={36} />
            </div>
            <h4 className="id-patient-name">{profile?.name}</h4>
            <span className="id-role-tag">VERIFIED PATIENT</span>
          </div>

          <div className="id-card-body">
            <div className="id-data-row">
              <span className="id-label">Patient Record ID</span>
              <span className="id-value">#MED-{profile?.id ? String(profile.id).padStart(5, '0') : '00001'}</span>
            </div>
            <div className="id-data-row">
              <span className="id-label">Age & Demographics</span>
              <span className="id-value">{profile?.age} Years</span>
            </div>
            <div className="id-data-row">
              <span className="id-label">Contact Phone</span>
              <span className="id-value">{profile?.phone}</span>
            </div>
            <div className="id-data-row">
              <span className="id-label">Registered Email</span>
              <span className="id-value">{profile?.email}</span>
            </div>
            <div className="id-data-row">
              <span className="id-label">Total Hospital Visits</span>
              <span className="id-value">{profile?.total_visits || 0} visits</span>
            </div>
          </div>

          <div className="id-card-footer">
            <Shield size={14} />
            <span>Encrypted Hospital Medical Record &bull; HIPAA Compliant</span>
          </div>
        </div>

        {/* Right Info / Edit Form */}
        <div className="card profile-details-card">
          <div className="card-header">
            <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#0f172a' }}>
              {isEditing ? 'Update Contact Information' : 'Hospital Registration Details'}
            </h4>
          </div>

          <div className="card-body">
            {isEditing ? (
              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    className="form-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Age (Years) *</label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      className="form-control"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Contact Phone *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="profile-info-blocks">
                <div className="info-block">
                  <span className="block-label">Healthcare Facility</span>
                  <div className="block-val">MediQueue Central Multispecialty Hospital</div>
                </div>
                <div className="info-block">
                  <span className="block-label">Primary Account Email</span>
                  <div className="block-val">{profile?.email}</div>
                </div>
                <div className="info-block">
                  <span className="block-label">Emergency Phone</span>
                  <div className="block-val">{profile?.phone}</div>
                </div>
                <div className="info-block">
                  <span className="block-label">Account Security</span>
                  <div className="block-val">
                    <span className="status-badge-inline" style={{ background: '#ecfdf5', color: '#047857' }}>
                      <CheckCircle2 size={12} /> Active & Verified Session
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
