/**
 * Privacy Settings Page
 * User privacy controls, consent management, and data rights
 * 
 * Sprint 4: User Privacy Controls
 */

import React, { useState, useEffect } from 'react';
import './PrivacySettings.css';

interface PrivacySettings {
  faceAuthEnabled: boolean;
  faceDataConsent: boolean;
  dataSharingConsent: boolean;
  marketingConsent: boolean;
  allowFaceForPayment: boolean;
  requireSecondFactor: boolean;
  dataRetentionPreference: 'minimal' | 'standard' | 'extended';
  lastPrivacyReview: string | null;
}

interface DataStats {
  faceProfilesCount: number;
  paymentMethodsCount: number;
  pendingDeletionRequests: number;
}

interface PaymentStatus {
  paymentEnabled: boolean;
  pausedAt: string | null;
  pauseReason: string | null;
}

export const PrivacySettings: React.FC = () => {
  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [dataStats, setDataStats] = useState<DataStats | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pauseReason, setPauseReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteType, setDeleteType] = useState<string>('');

  useEffect(() => {
    loadPrivacyData();
  }, []);

  const loadPrivacyData = async () => {
    setLoading(true);
    try {
      // Load privacy settings
      const settingsRes = await fetch('/api/privacy/settings');
      const settingsData = await settingsRes.json();
      setSettings(settingsData.settings);
      setDataStats(settingsData.dataStats);

      // Load payment status
      const paymentRes = await fetch('/api/payment/status');
      const paymentData = await paymentRes.json();
      setPaymentStatus(paymentData);
    } catch (error) {
      console.error('Error loading privacy data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof PrivacySettings, value: any) => {
    if (!settings) return;

    setSaving(true);
    try {
      const response = await fetch('/api/privacy/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: value }),
      });

      if (response.ok) {
        setSettings({ ...settings, [key]: value });
      } else {
        alert('Error updating setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      alert('Error updating setting');
    } finally {
      setSaving(false);
    }
  };

  const togglePayment = async () => {
    if (!paymentStatus) return;

    try {
      const response = await fetch('/api/payment/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: pauseReason || undefined }),
      });

      if (response.ok) {
        const data = await response.json();
        setPaymentStatus(data);
        setPauseReason('');
        alert(data.paymentEnabled ? 'Payments resumed' : 'Payments paused');
      } else {
        alert('Error toggling payment status');
      }
    } catch (error) {
      console.error('Error toggling payment:', error);
      alert('Error toggling payment status');
    }
  };

  const requestDataDeletion = async (type: string) => {
    try {
      const response = await fetch('/api/privacy/delete-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestType: type }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Deletion request submitted. Check your email for confirmation link.`);
        setShowDeleteConfirm(false);
        loadPrivacyData();
      } else {
        alert('Error submitting deletion request');
      }
    } catch (error) {
      console.error('Error requesting deletion:', error);
      alert('Error submitting deletion request');
    }
  };

  const exportData = async () => {
    try {
      const response = await fetch('/api/privacy/export');
      const data = await response.json();
      
      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `privacy-data-${new Date().toISOString()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
      alert('Error exporting data');
    }
  };

  if (loading || !settings || !paymentStatus) {
    return <div className="loading-container">Loading privacy settings...</div>;
  }

  return (
    <div className="privacy-settings">
      <div className="settings-header">
        <h1>🔒 Privacy & Security Settings</h1>
        <p className="subtitle">Manage your data, consent, and privacy preferences</p>
      </div>

      {/* Data Overview */}
      <div className="section">
        <h2>📊 Your Data</h2>
        <div className="data-stats">
          <div className="stat-card">
            <div className="stat-icon">👤</div>
            <div className="stat-value">{dataStats?.faceProfilesCount || 0}</div>
            <div className="stat-label">Face Profiles</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">💳</div>
            <div className="stat-value">{dataStats?.paymentMethodsCount || 0}</div>
            <div className="stat-label">Payment Methods</div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🗑️</div>
            <div className="stat-value">{dataStats?.pendingDeletionRequests || 0}</div>
            <div className="stat-label">Pending Deletions</div>
          </div>
        </div>
      </div>

      {/* Payment Control */}
      <div className="section">
        <h2>💰 Payment Control</h2>
        <div className="payment-control">
          <div className="control-header">
            <div>
              <h3>Payment Status</h3>
              <p className="control-description">
                {paymentStatus.paymentEnabled
                  ? 'Payments are currently enabled'
                  : 'Payments are currently paused'}
              </p>
              {paymentStatus.pausedAt && (
                <p className="pause-info">
                  Paused since: {new Date(paymentStatus.pausedAt).toLocaleString()}
                  {paymentStatus.pauseReason && ` - ${paymentStatus.pauseReason}`}
                </p>
              )}
            </div>
            <button
              className={`toggle-btn ${paymentStatus.paymentEnabled ? 'enabled' : 'paused'}`}
              onClick={togglePayment}
            >
              {paymentStatus.paymentEnabled ? '⏸️ Pause Payments' : '▶️ Resume Payments'}
            </button>
          </div>
          {paymentStatus.paymentEnabled && (
            <div className="pause-reason-input">
              <input
                type="text"
                placeholder="Optional: Reason for pausing (e.g., traveling, lost device)"
                value={pauseReason}
                onChange={(e) => setPauseReason(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Face Authentication */}
      <div className="section">
        <h2>👤 Face Authentication</h2>
        <div className="setting-item">
          <div className="setting-info">
            <h3>Enable Face Authentication</h3>
            <p>Allow using your face to log in and verify payments</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.faceAuthEnabled}
              onChange={(e) => updateSetting('faceAuthEnabled', e.target.checked)}
              disabled={saving}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <h3>Allow Face for Payments</h3>
            <p>Use face recognition to authorize payments</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.allowFaceForPayment}
              onChange={(e) => updateSetting('allowFaceForPayment', e.target.checked)}
              disabled={saving}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <h3>Require Second Factor</h3>
            <p>Always require a second authentication factor even with face recognition</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.requireSecondFactor}
              onChange={(e) => updateSetting('requireSecondFactor', e.target.checked)}
              disabled={saving}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {/* Consent Management */}
      <div className="section">
        <h2>✅ Consent & Permissions</h2>
        <div className="setting-item">
          <div className="setting-info">
            <h3>Face Data Consent</h3>
            <p>Allow us to store and process your facial biometric data</p>
            {settings.faceDataConsent && (
              <p className="consent-warning">⚠️ Revoking this will delete your face profiles</p>
            )}
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.faceDataConsent}
              onChange={(e) => updateSetting('faceDataConsent', e.target.checked)}
              disabled={saving}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <h3>Data Sharing</h3>
            <p>Allow sharing anonymized data with third parties for analytics</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.dataSharingConsent}
              onChange={(e) => updateSetting('dataSharingConsent', e.target.checked)}
              disabled={saving}
            />
            <span className="slider"></span>
          </label>
        </div>

        <div className="setting-item">
          <div className="setting-info">
            <h3>Marketing Communications</h3>
            <p>Receive promotional emails and product updates</p>
          </div>
          <label className="switch">
            <input
              type="checkbox"
              checked={settings.marketingConsent}
              onChange={(e) => updateSetting('marketingConsent', e.target.checked)}
              disabled={saving}
            />
            <span className="slider"></span>
          </label>
        </div>
      </div>

      {/* Data Retention */}
      <div className="section">
        <h2>🗄️ Data Retention</h2>
        <div className="retention-options">
          <label className={`retention-option ${settings.dataRetentionPreference === 'minimal' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="retention"
              value="minimal"
              checked={settings.dataRetentionPreference === 'minimal'}
              onChange={(e) => updateSetting('dataRetentionPreference', e.target.value)}
              disabled={saving}
            />
            <div className="option-content">
              <h3>Minimal</h3>
              <p>Keep data for the minimum required time (30 days)</p>
            </div>
          </label>
          <label className={`retention-option ${settings.dataRetentionPreference === 'standard' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="retention"
              value="standard"
              checked={settings.dataRetentionPreference === 'standard'}
              onChange={(e) => updateSetting('dataRetentionPreference', e.target.value)}
              disabled={saving}
            />
            <div className="option-content">
              <h3>Standard</h3>
              <p>Keep data for standard period (1 year)</p>
            </div>
          </label>
          <label className={`retention-option ${settings.dataRetentionPreference === 'extended' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="retention"
              value="extended"
              checked={settings.dataRetentionPreference === 'extended'}
              onChange={(e) => updateSetting('dataRetentionPreference', e.target.value)}
              disabled={saving}
            />
            <div className="option-content">
              <h3>Extended</h3>
              <p>Keep data indefinitely for better service</p>
            </div>
          </label>
        </div>
      </div>

      {/* Data Rights */}
      <div className="section">
        <h2>📋 Your Data Rights</h2>
        <div className="data-rights">
          <button className="right-btn" onClick={exportData}>
            <span className="btn-icon">📥</span>
            <div className="btn-content">
              <h3>Export Your Data</h3>
              <p>Download a copy of all your data (GDPR/CCPA)</p>
            </div>
          </button>

          <button
            className="right-btn danger"
            onClick={() => {
              setDeleteType('face_data');
              setShowDeleteConfirm(true);
            }}
          >
            <span className="btn-icon">🗑️</span>
            <div className="btn-content">
              <h3>Delete Face Data</h3>
              <p>Permanently delete all your face profiles</p>
            </div>
          </button>

          <button
            className="right-btn danger"
            onClick={() => {
              setDeleteType('all_data');
              setShowDeleteConfirm(true);
            }}
          >
            <span className="btn-icon">⚠️</span>
            <div className="btn-content">
              <h3>Delete All Data</h3>
              <p>Delete all your data except account login</p>
            </div>
          </button>

          <button
            className="right-btn danger"
            onClick={() => {
              setDeleteType('account_closure');
              setShowDeleteConfirm(true);
            }}
          >
            <span className="btn-icon">❌</span>
            <div className="btn-content">
              <h3>Close Account</h3>
              <p>Permanently delete your account and all data</p>
            </div>
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>⚠️ Confirm Deletion</h2>
              <button className="close-btn" onClick={() => setShowDeleteConfirm(false)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p className="warning-text">
                This action cannot be undone. You will receive a confirmation email to proceed.
              </p>
              <p>
                Are you sure you want to delete:{' '}
                <strong>
                  {deleteType === 'face_data' && 'Face Data'}
                  {deleteType === 'all_data' && 'All Data'}
                  {deleteType === 'account_closure' && 'Your Account'}
                </strong>
                ?
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="confirm-btn danger"
                onClick={() => requestDataDeletion(deleteType)}
              >
                Yes, Delete
              </button>
              <button
                className="confirm-btn cancel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
