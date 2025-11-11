/**
 * Admin Review Panel
 * Manual review interface for suspicious face matches
 * 
 * Sprint 4: Manual Review Panel
 */

import React, { useState, useEffect } from 'react';
import './AdminReviewPanel.css';

interface ReviewItem {
  id: number;
  userId: number;
  userEmail: string;
  userName: string;
  matchedUserId?: number;
  similarityScore: number;
  matchType: 'enrollment' | 'verification' | 'payment';
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'escalated';
  reviewPriority: 'low' | 'medium' | 'high' | 'critical';
  autoFlaggedReason: string;
  metadata?: {
    ipAddress?: string;
    deviceFingerprint?: string;
    geoLocation?: { country?: string; city?: string };
  };
  createdAt: string;
}

interface QueueSummary {
  total: number;
  byPriority: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  byMatchType: {
    enrollment: number;
    verification: number;
    payment: number;
  };
  oldestPending: string | null;
}

export const AdminReviewPanel: React.FC = () => {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [summary, setSummary] = useState<QueueSummary | null>(null);
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [reviewDecision, setReviewDecision] = useState('');

  // Load review queue
  useEffect(() => {
    loadReviewQueue();
    loadQueueSummary();
  }, [filterStatus, filterPriority]);

  const loadReviewQueue = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: filterStatus,
        ...(filterPriority !== 'all' && { priority: filterPriority }),
      });

      const response = await fetch(`/api/admin/reviews?${params}`);
      const data = await response.json();
      setReviews(data.reviews || []);
    } catch (error) {
      console.error('Error loading review queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadQueueSummary = async () => {
    try {
      const response = await fetch('/api/admin/reviews/summary');
      const data = await response.json();
      setSummary(data);
    } catch (error) {
      console.error('Error loading queue summary:', error);
    }
  };

  const handleReviewDecision = async (
    reviewId: number,
    decision: 'approved' | 'rejected' | 'escalated'
  ) => {
    if (!reviewDecision.trim()) {
      alert('Please provide a decision reason');
      return;
    }

    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}/decision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewStatus: decision,
          decision: reviewDecision,
        }),
      });

      if (response.ok) {
        alert(`Review ${decision} successfully`);
        setSelectedReview(null);
        setReviewDecision('');
        loadReviewQueue();
        loadQueueSummary();
      } else {
        alert('Error submitting review decision');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Error submitting review decision');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return '#dc3545';
      case 'high': return '#fd7e14';
      case 'medium': return '#ffc107';
      case 'low': return '#28a745';
      default: return '#6c757d';
    }
  };

  const getMatchTypeIcon = (type: string) => {
    switch (type) {
      case 'enrollment': return '👤';
      case 'verification': return '🔐';
      case 'payment': return '💳';
      default: return '❓';
    }
  };

  return (
    <div className="admin-review-panel">
      <div className="panel-header">
        <h1>🛡️ Manual Review Panel</h1>
        <p className="subtitle">Review suspicious face matches and security events</p>
      </div>

      {/* Queue Summary */}
      {summary && (
        <div className="queue-summary">
          <div className="summary-card">
            <div className="summary-title">Total Pending</div>
            <div className="summary-value">{summary.total}</div>
          </div>
          <div className="summary-card critical">
            <div className="summary-title">Critical</div>
            <div className="summary-value">{summary.byPriority.critical}</div>
          </div>
          <div className="summary-card high">
            <div className="summary-title">High</div>
            <div className="summary-value">{summary.byPriority.high}</div>
          </div>
          <div className="summary-card medium">
            <div className="summary-title">Medium</div>
            <div className="summary-value">{summary.byPriority.medium}</div>
          </div>
          <div className="summary-card low">
            <div className="summary-title">Low</div>
            <div className="summary-value">{summary.byPriority.low}</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <div className="filter-group">
          <label>Status:</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="escalated">Escalated</option>
          </select>
        </div>
        <div className="filter-group">
          <label>Priority:</label>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
            <option value="all">All</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <button className="refresh-btn" onClick={loadReviewQueue}>
          🔄 Refresh
        </button>
      </div>

      {/* Review Queue */}
      <div className="review-queue">
        {loading ? (
          <div className="loading">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="empty-state">
            <p>✅ No reviews in queue</p>
          </div>
        ) : (
          <table className="review-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Type</th>
                <th>User</th>
                <th>Similarity</th>
                <th>Reason</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id} className={`priority-${review.reviewPriority}`}>
                  <td>
                    <span
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(review.reviewPriority) }}
                    >
                      {review.reviewPriority.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <span className="match-type">
                      {getMatchTypeIcon(review.matchType)} {review.matchType}
                    </span>
                  </td>
                  <td>
                    <div className="user-info">
                      <div className="user-name">{review.userName || 'Unknown'}</div>
                      <div className="user-email">{review.userEmail}</div>
                    </div>
                  </td>
                  <td>
                    <span className="similarity-score">
                      {(parseFloat(review.similarityScore.toString()) * 100).toFixed(1)}%
                    </span>
                  </td>
                  <td className="reason-cell">{review.autoFlaggedReason}</td>
                  <td>{new Date(review.createdAt).toLocaleString()}</td>
                  <td>
                    <button
                      className="review-btn"
                      onClick={() => setSelectedReview(review)}
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Review Modal */}
      {selectedReview && (
        <div className="modal-overlay" onClick={() => setSelectedReview(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Review Details</h2>
              <button className="close-btn" onClick={() => setSelectedReview(null)}>
                ✕
              </button>
            </div>

            <div className="modal-body">
              <div className="detail-section">
                <h3>Match Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Match Type:</label>
                    <span>{getMatchTypeIcon(selectedReview.matchType)} {selectedReview.matchType}</span>
                  </div>
                  <div className="detail-item">
                    <label>Priority:</label>
                    <span
                      className="priority-badge"
                      style={{ backgroundColor: getPriorityColor(selectedReview.reviewPriority) }}
                    >
                      {selectedReview.reviewPriority.toUpperCase()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <label>Similarity Score:</label>
                    <span>{(parseFloat(selectedReview.similarityScore.toString()) * 100).toFixed(2)}%</span>
                  </div>
                  <div className="detail-item">
                    <label>Created:</label>
                    <span>{new Date(selectedReview.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>User Information</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <label>Name:</label>
                    <span>{selectedReview.userName || 'Unknown'}</span>
                  </div>
                  <div className="detail-item">
                    <label>Email:</label>
                    <span>{selectedReview.userEmail}</span>
                  </div>
                  <div className="detail-item">
                    <label>User ID:</label>
                    <span>{selectedReview.userId}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Flagged Reason</h3>
                <p className="flagged-reason">{selectedReview.autoFlaggedReason}</p>
              </div>

              {selectedReview.metadata && (
                <div className="detail-section">
                  <h3>Metadata</h3>
                  <div className="detail-grid">
                    {selectedReview.metadata.ipAddress && (
                      <div className="detail-item">
                        <label>IP Address:</label>
                        <span>{selectedReview.metadata.ipAddress}</span>
                      </div>
                    )}
                    {selectedReview.metadata.geoLocation && (
                      <div className="detail-item">
                        <label>Location:</label>
                        <span>
                          {selectedReview.metadata.geoLocation.city}, {selectedReview.metadata.geoLocation.country}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="detail-section">
                <h3>Review Decision</h3>
                <textarea
                  className="decision-textarea"
                  placeholder="Enter your decision and reasoning..."
                  value={reviewDecision}
                  onChange={(e) => setReviewDecision(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                className="decision-btn approve"
                onClick={() => handleReviewDecision(selectedReview.id, 'approved')}
              >
                ✅ Approve
              </button>
              <button
                className="decision-btn reject"
                onClick={() => handleReviewDecision(selectedReview.id, 'rejected')}
              >
                ❌ Reject
              </button>
              <button
                className="decision-btn escalate"
                onClick={() => handleReviewDecision(selectedReview.id, 'escalated')}
              >
                ⚠️ Escalate
              </button>
              <button className="decision-btn cancel" onClick={() => setSelectedReview(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
