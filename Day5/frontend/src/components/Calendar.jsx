/**
 * カレンダー本体（月表示）
 * 過去日は選択不可。土曜=青・日祝=赤で表示
 */
import React, { useState, useEffect } from 'react';
import { isJapaneseHoliday } from '../utils/holiday';

/**
 * 指定年月のカレンダー用日付リスト（前月・次月の埋め合わせ含む）
 */
function getCalendarDays(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = first.getDay();
  const daysInMonth = last.getDate();
  const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;
  const days = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < totalCells; i++) {
    const diff = i - startOffset;
    const d = new Date(year, month, 1 + diff);
    d.setHours(0, 0, 0, 0);
    const isCurrentMonth = d.getMonth() === month;
    const isPast = d < today;
    const isToday = d.getTime() === today.getTime();
    const dayOfWeek = d.getDay();
    const isSunday = dayOfWeek === 0;
    const isSaturday = dayOfWeek === 6;
    const isHoliday = isJapaneseHoliday(d);
    // TopPage の「土日祝は休診」と整合させ、土日祝は選択不可にする
    const isSelectable = isCurrentMonth && !isPast && !isSaturday && !isSunday && !isHoliday;
    days.push({
      date: d,
      label: d.getDate(),
      isCurrentMonth,
      isPast,
      isToday,
      isSelectable,
      isSunday,
      isSaturday,
      isHoliday,
      key: d.toISOString(),
    });
  }
  return days;
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];

function toDateStr(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function Calendar({ selectedDate, onSelectDate, reservedDates = new Set(), onMonthChange }) {
  const now = new Date();
  const [year, setYear] = useState(selectedDate ? selectedDate.getFullYear() : now.getFullYear());
  const [month, setMonth] = useState(selectedDate ? selectedDate.getMonth() : now.getMonth());
  const days = getCalendarDays(year, month);

  const notifyMonth = (y, m) => {
    if (typeof onMonthChange === 'function') onMonthChange(y, m);
  };

  useEffect(() => {
    notifyMonth(year, month);
  }, []);

  const handlePrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
      notifyMonth(year - 1, 11);
    } else {
      setMonth((m) => m - 1);
      notifyMonth(year, month - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
      notifyMonth(year + 1, 0);
    } else {
      setMonth((m) => m + 1);
      notifyMonth(year, month + 1);
    }
  };

  const handleDayClick = (day) => {
    if (!day.isSelectable) return;
    onSelectDate(day.date);
  };

  const monthLabel = `${year}年 ${month + 1}月`;

  return (
    <div className="calendar">
      <div className="calendar-header">
        <button type="button" className="calendar-nav" onClick={handlePrevMonth} aria-label="前月">
          ‹
        </button>
        <h2 className="calendar-title">{monthLabel}</h2>
        <button type="button" className="calendar-nav" onClick={handleNextMonth} aria-label="次月">
          ›
        </button>
      </div>
      <div className="calendar-weekdays">
        {WEEKDAYS.map((w, i) => (
          <span
            key={w}
            className={`calendar-weekday ${i === 0 ? 'calendar-weekday-sun' : ''} ${i === 6 ? 'calendar-weekday-sat' : ''}`}
          >
            {w}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            className={`calendar-day ${!day.isCurrentMonth ? 'calendar-day-other' : ''} ${
              day.isPast ? 'calendar-day-past' : ''
            } ${day.isToday ? 'calendar-day-today' : ''} ${
              day.isSelectable ? 'calendar-day-selectable' : ''
            } ${day.isSunday ? 'calendar-day-sunday' : ''} ${day.isSaturday ? 'calendar-day-saturday' : ''            } ${
              day.isHoliday ? 'calendar-day-holiday' : ''
            } ${reservedDates.has(toDateStr(day.date)) ? 'calendar-day-reserved' : ''} ${
              selectedDate &&
              day.date.getTime() === selectedDate.getTime()
                ? 'calendar-day-selected'
                : ''
            }`}
            onClick={() => handleDayClick(day)}
            disabled={!day.isSelectable}
            aria-label={day.isToday ? `今日、${day.date.getMonth() + 1}月${day.label}日` : `${day.date.getMonth() + 1}月${day.label}日`}
          >
            <span className="calendar-day-num">{day.label}</span>
            {day.isToday && <span className="calendar-day-badge">今日</span>}
            {reservedDates.has(toDateStr(day.date)) && (
              <span className="calendar-day-reserved-badge">予約</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export default Calendar;
