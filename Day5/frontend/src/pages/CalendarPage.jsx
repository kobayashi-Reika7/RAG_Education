/**
 * カレンダー選択画面（メイン機能）
 * 月表示カレンダーで日付を選択。予約済みの日も表示する。
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import Calendar from '../components/Calendar';
import Breadcrumb from '../components/Breadcrumb';
import { getReservationsByUser } from '../services/reservation';

function CalendarPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth();
  const [selectedDate, setSelectedDate] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());

  const editingState = location.state?.isEditing
    ? {
        isEditing: true,
        editingReservationId: location.state.editingReservationId,
        editingReservation: location.state.editingReservation,
      }
    : null;

  useEffect(() => {
    if (!user?.uid) return;
    getReservationsByUser(user.uid).then(setReservations);
  }, [user?.uid]);

  const reservedDates = useMemo(
    () => new Set(reservations.map((r) => r.date).filter(Boolean)),
    [reservations]
  );

  const monthPrefix = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const reservationsThisMonth = useMemo(
    () => reservations.filter((r) => r.date && r.date.startsWith(monthPrefix)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)),
    [reservations, monthPrefix]
  );

  const handleMonthChange = (y, m) => {
    setViewYear(y);
    setViewMonth(m);
  };

  const handleSelectDate = (date) => {
    setSelectedDate(date);
    const dateStr = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
    navigate('/reserve/form', {
      state: { selectedDate: dateStr, ...(editingState || {}) },
    });
  };

  return (
    <div className="page page-calendar">
      <Breadcrumb
        items={[
          { label: 'Top', to: '/' },
          { label: 'メニュー', to: '/menu' },
          { label: '日付選択' },
        ]}
      />
      <h1 className="page-title">予約日を選んでください</h1>
      <p className="page-lead calendar-hint">
        
      </p>
      <Calendar
        selectedDate={selectedDate}
        onSelectDate={handleSelectDate}
        reservedDates={reservedDates}
        onMonthChange={handleMonthChange}
      />
      <section className="calendar-month-reservations" aria-labelledby="calendar-month-reservations-title">
        <h2 id="calendar-month-reservations-title" className="calendar-month-reservations-title">
          {viewYear}年{viewMonth + 1}月の予約
        </h2>
        {reservationsThisMonth.length === 0 ? (
          <p className="calendar-month-reservations-empty">この月の予約はありません。</p>
        ) : (
          <ul className="calendar-month-reservations-list">
            {reservationsThisMonth.map((r) => (
              <li key={r.id} className="calendar-month-reservation-card">
                <p className="calendar-reservation-date-time">
                  <strong>{r.date}</strong> {r.time}
                </p>
                <p className="calendar-reservation-dept">{r.department}</p>
                <p className="calendar-reservation-doctor">{r.doctor ? `担当医: ${r.doctor}` : ''}</p>
                <p className="calendar-reservation-purpose">{r.purpose ? `目的: ${r.purpose}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className="page-actions calendar-actions btn-wrap-center">
        <button type="button" className="btn btn-secondary btn-nav" onClick={() => navigate('/menu')}>
          メニューに戻る
        </button>
      </div>
    </div>
  );
}

export default CalendarPage;
