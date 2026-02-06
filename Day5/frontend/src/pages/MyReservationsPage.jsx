/**
 * 予約一覧画面（予約確認）
 * users/{uid}/reservations を取得し、カード形式で表示。変更・キャンセル操作を安全に提供。
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import Breadcrumb from '../components/Breadcrumb';
import { getReservationsByUser, deleteReservation } from '../services/reservation';
import { logout } from '../services/auth';

/** date: YYYY-MM-DD, time: HH:mm → 表示用 "2026/02/10 10:30" */
function formatDateTime(dateStr, timeStr) {
  if (!dateStr) return '—';
  const parts = dateStr.split('-').filter(Boolean);
  if (parts.length < 3) return dateStr;
  const dateFormatted = parts.join('/');
  const time = (timeStr || '').trim();
  return time ? `${dateFormatted} ${time}` : dateFormatted;
}

function MyReservationsPage() {
  const navigate = useNavigate();
  const user = useAuth();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchReservations = useCallback(() => {
    if (!user?.uid) return;
    setLoading(true);
    setError('');
    getReservationsByUser(user.uid)
      .then(setReservations)
      .catch((err) => setError(err?.message ?? '予約一覧の取得に失敗しました。'))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  useEffect(() => {
    fetchReservations();
  }, [fetchReservations]);

  const handleCancelClick = (r) => {
    setCancelTarget({ id: r.id, summary: formatDateTime(r.date, r.time) + ' ' + (r.department || '') });
  };

  const handleCancelConfirm = async () => {
    if (!user?.uid || !cancelTarget) return;
    setCancellingId(cancelTarget.id);
    setError('');
    try {
      await deleteReservation(user.uid, cancelTarget.id);
      setCancelTarget(null);
      setSuccessMessage('予約をキャンセルしました。');
      fetchReservations();
      setTimeout(() => setSuccessMessage(''), 4000);
    } catch (err) {
      setError(err?.message ?? 'キャンセルに失敗しました。');
    } finally {
      setCancellingId(null);
    }
  };

  const handleChangeClick = (r) => {
    navigate('/reserve/form', { state: { isEditing: true, editingReservationId: r.id, editingReservation: r } });
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      navigate('/login', { replace: true });
    }
  };

  const sortedReservations = useMemo(
    () => [...reservations].sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time)),
    [reservations]
  );

  return (
    <div className="page page-reservations">
      <Breadcrumb
        items={[
          { label: 'Top', to: '/' },
          { label: 'メニュー', to: '/menu' },
          { label: '予約一覧' },
        ]}
      />
      <header className="reservations-header">
        <h1 className="reservations-title">予約一覧</h1>
      </header>

      {loading && (
        <div className="reservations-loading" aria-live="polite">
          <span className="reservations-loading-spinner" aria-hidden />
          読み込み中…
        </div>
      )}
      {error && <p className="page-error" role="alert">{error}</p>}
      {successMessage && <p className="reservations-success" role="status">{successMessage}</p>}

      {!loading && !error && sortedReservations.length > 0 && (
        <ul className="reservations-list" aria-label="予約一覧">
          {sortedReservations.map((r) => (
            <li key={r.id} className="reservation-card">
              <p className="reservation-card-datetime">
                <span className="reservation-card-datetime-icon" aria-hidden>📅</span>
                {formatDateTime(r.date, r.time)}
              </p>
              <p className="reservation-card-meta">
                {[r.department || '—', r.purpose || '—'].filter(Boolean).join(' / ')}
              </p>
              <div className="reservation-card-actions">
                <button
                  type="button"
                  className="btn btn-secondary reservation-btn-change"
                  onClick={() => handleChangeClick(r)}
                  disabled={!!cancellingId}
                >
                  変更する
                </button>
                <button
                  type="button"
                  className="btn reservation-btn-cancel"
                  onClick={() => handleCancelClick(r)}
                  disabled={cancellingId === r.id}
                  aria-label="この予約をキャンセルする"
                >
                  {cancellingId === r.id ? 'キャンセル中…' : 'キャンセル'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && sortedReservations.length === 0 && (
        <div className="reservations-empty">
          <p className="reservations-empty-text">現在、予約はありません</p>
          <button type="button" className="btn btn-primary btn-nav" onClick={() => navigate('/reserve/form')}>
            予約する
          </button>
        </div>
      )}

      <div className="reservations-footer">
        <button type="button" className="btn btn-text" onClick={handleLogout}>
          ログアウト
        </button>
      </div>

      {/* キャンセル確認モーダル */}
      {cancelTarget && (
        <div className="reservation-cancel-overlay" role="dialog" aria-modal="true" aria-labelledby="cancel-dialog-title">
          <div className="reservation-cancel-dialog">
            <h2 id="cancel-dialog-title" className="reservation-cancel-dialog-title">キャンセルの確認</h2>
            <p className="reservation-cancel-dialog-message">
              この予約をキャンセルしますか？一度キャンセルすると元に戻せません。
            </p>
            <p className="reservation-cancel-dialog-summary">{cancelTarget.summary}</p>
            <div className="reservation-cancel-dialog-actions">
              <button
                type="button"
                className="btn reservation-btn-cancel-confirm"
                onClick={handleCancelConfirm}
                disabled={cancellingId === cancelTarget.id}
              >
                {cancellingId === cancelTarget.id ? '処理中…' : 'キャンセルする'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCancelTarget(null)}
                disabled={!!cancellingId}
              >
                戻る
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MyReservationsPage;
