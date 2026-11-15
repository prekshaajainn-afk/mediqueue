import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [patient, setPatient] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('mediqueue_token') || null;
    } catch {
      return null;
    }
  });
  const [isLoading, setIsLoading] = useState(true);

  // Check current session on mount or token change
  const checkAuth = useCallback(async () => {
    const currentToken = localStorage.getItem('mediqueue_token');
    if (!currentToken) {
      setUser(null);
      setPatient(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res && res.user) {
        setUser(res.user);
        setPatient(res.patient || null);
      } else {
        localStorage.removeItem('mediqueue_token');
        setUser(null);
        setPatient(null);
      }
    } catch {
      // Token invalid or expired
      localStorage.removeItem('mediqueue_token');
      setUser(null);
      setPatient(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Login action
  const login = async (email, password) => {
    const res = await api.login({ email, password });
    if (res.access_token) {
      localStorage.setItem('mediqueue_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      setPatient(res.patient || null);
      return res;
    }
    throw new Error('Login failed: Token not received.');
  };

  // Register action
  const register = async (userData) => {
    const res = await api.register(userData);
    if (res.access_token) {
      localStorage.setItem('mediqueue_token', res.access_token);
      setToken(res.access_token);
      setUser(res.user);
      setPatient(res.patient || null);
      return res;
    }
    throw new Error('Registration failed: Token not received.');
  };

  // Quick Demo Login (for PBL Evaluators / seamless testing)
  const quickDemoLogin = async (roleType = 'patient') => {
    if (roleType === 'patient') {
      return login('anita@mediqueue.com', 'patient123');
    } else {
      return login('staff@mediqueue.hospital', 'staff123');
    }
  };

  // Logout action
  const logout = () => {
    localStorage.removeItem('mediqueue_token');
    setToken(null);
    setUser(null);
    setPatient(null);
  };

  // Refresh patient profile data in state
  const refreshPatientProfile = async () => {
    if (!token) return;
    try {
      const profile = await api.getPatientProfile();
      setPatient((prev) => ({ ...prev, ...profile }));
    } catch {
      // Ignore background refresh failure
    }
  };

  const value = {
    user,
    patient,
    token,
    role: user?.role || null,
    isAuthenticated: !!user,
    isPatient: user?.role === 'patient',
    isStaff: user?.role === 'staff',
    isLoading,
    login,
    register,
    quickDemoLogin,
    logout,
    refreshPatientProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
