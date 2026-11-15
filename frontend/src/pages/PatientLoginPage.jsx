import React, { useState } from 'react';
import {
  HeartPulse,
  User,
  Lock,
  Mail,
  Phone,
  Calendar,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Stethoscope,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function PatientLoginPage({ onNavigateToStaff, onLoginSuccess }) {
  const { login, register, quickDemoLogin } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [email, setEmail] = useState('anita@mediqueue.com');
  const [password, setPassword] = useState('patient123');

  // Register Fields
  const [name, setName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [age, setAge] = useState('');
  const [phone, setPhone] = useState('');

  const [errorMsg, setErrorMsg] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await login(email.trim(), password);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      await register({
        name: name.trim(),
        email: regEmail.trim(),
        password: regPassword,
        age: parseInt(age, 10),
        phone: phone.trim(),
      });
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemo = async (demoEmail, demoPass) => {
    setErrorMsg(null);
    setIsLoading(true);
    try {
      await login(demoEmail, demoPass);
      if (onLoginSuccess) onLoginSuccess();
    } catch (err) {
      setErrorMsg(err.message || 'Demo login failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page-wrapper">
      <div className="login-card-container">
        {/* Top Brand Box */}
        <div className="login-header">
          <div className="brand-icon-box large">
            <HeartPulse size={26} />
          </div>
          <h2 className="login-brand-title">MediQueue</h2>
          <p className="login-brand-sub">Patient Queue & Flow Tracking Portal</p>
        </div>

        {/* Demo Login Quick Access for College PBL Evaluators */}
        <div className="demo-accounts-callout">
          <div className="demo-callout-header">
            <Sparkles size={15} style={{ color: '#0d9488' }} />
            <span>1-Click Evaluator Demo Access</span>
          </div>
          <div className="demo-buttons-row">
            <button
              type="button"
              className="btn btn-outline btn-xs demo-btn"
              disabled={isLoading}
              onClick={() => handleQuickDemo('anita@mediqueue.com', 'patient123')}
            >
              Demo Patient: Dr. Anita Desai
            </button>
            <button
              type="button"
              className="btn btn-outline btn-xs demo-btn"
              disabled={isLoading}
              onClick={() => handleQuickDemo('rohit@mediqueue.com', 'patient123')}
            >
              Demo Patient: Rohit Verma
            </button>
          </div>
        </div>

        {/* Mode Selector (Login vs Register) */}
        <div className="login-mode-tabs">
          <button
            type="button"
            className={`mode-tab ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setErrorMsg(null);
              setMode('login');
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`mode-tab ${mode === 'register' ? 'active' : ''}`}
            onClick={() => {
              setErrorMsg(null);
              setMode('register');
            }}
          >
            Register Patient Account
          </button>
        </div>

        {errorMsg && (
          <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Registered Email</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  className="form-control"
                  placeholder="e.g. anita@mediqueue.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={isLoading}
              style={{ marginTop: '18px' }}
            >
              {isLoading ? 'Verifying Session...' : 'Sign In to Patient Portal'}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="login-form">
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <div className="input-with-icon">
                <User size={16} className="input-icon" />
                <input
                  type="text"
                  className="form-control"
                  placeholder="e.g. Maya Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Email Address *</label>
              <div className="input-with-icon">
                <Mail size={16} className="input-icon" />
                <input
                  type="email"
                  className="form-control"
                  placeholder="maya@example.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label">Age *</label>
                <input
                  type="number"
                  min="0"
                  max="120"
                  className="form-control"
                  placeholder="30"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Phone *</label>
                <div className="input-with-icon">
                  <Phone size={15} className="input-icon" />
                  <input
                    type="tel"
                    className="form-control"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password *</label>
              <div className="input-with-icon">
                <Lock size={16} className="input-icon" />
                <input
                  type="password"
                  className="form-control"
                  placeholder="At least 6 characters"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-block btn-lg"
              disabled={isLoading}
              style={{ marginTop: '18px' }}
            >
              {isLoading ? 'Creating Account...' : 'Complete Patient Registration'}
            </button>
          </form>
        )}

        {/* Footer with Staff Portal Link */}
        <div className="login-footer">
          <div className="staff-switch-box">
            <span>Hospital Staff Member?</span>
            <button
              type="button"
              className="btn-link-action"
              onClick={onNavigateToStaff}
            >
              Open Staff Dashboard &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
