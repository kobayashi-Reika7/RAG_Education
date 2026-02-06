/**
 * 予約可能時間のボタン表示
 * 選択可能: 通常 / 予約済み・満枠: グレーアウト＋disabled / 選択中: 強調
 * showAvailability=true のとき「○（空きあり）」「×（満枠）」を表示（担当医未指定時）
 */
import React from 'react';

function TimeSlot({ slots = [], disabledSet = new Set(), selected = '', onSelect, showAvailability = false }) {
  if (slots.length === 0) {
    return (
      <p className="form-step-empty" role="status">
        この日は予約可能な時間がありません。
      </p>
    );
  }

  return (
    <div className="time-slots">
      {slots.map((t) => {
        const isDisabled = disabledSet.has(t);
        const isSelected = selected === t;
        const label = showAvailability ? (isDisabled ? `× ${t}` : `○ ${t}`) : t;
        return (
          <button
            key={t}
            type="button"
            className={`time-slot-btn ${isSelected ? 'time-slot-btn-selected' : ''} ${isDisabled ? 'time-slot-btn-disabled' : ''}`}
            onClick={() => !isDisabled && onSelect && onSelect(t)}
            disabled={isDisabled}
            aria-pressed={isSelected}
            aria-disabled={isDisabled}
            title={showAvailability && isDisabled ? '満枠' : showAvailability && !isDisabled ? '空きあり' : undefined}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export default TimeSlot;
