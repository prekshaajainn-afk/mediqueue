import React from 'react';

export default function StatCard({ title, value, subtext, icon: Icon, color = '#0d9488', bgColor = '#f0fdfa' }) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <span className="stat-title">{title}</span>
        <div className="stat-icon-wrapper" style={{ backgroundColor: bgColor, color: color }}>
          <Icon size={20} />
        </div>
      </div>
      <div className="stat-value">{value}</div>
      {subtext && <div className="stat-subtext">{subtext}</div>}
    </div>
  );
}
