/**
 * 日本の祝日判定（簡易：固定祝日＋国民の休日）
 * カレンダー・予約フォームで共通利用。
 * ※ バックエンド reservation_service._is_japanese_holiday と同一条件にすること（第2月曜の式など）。
 */

/**
 * @param {Date} date
 * @returns {boolean}
 */
export function isJapaneseHoliday(date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const fixed = [
    [1, 1],   // 元日
    [2, 11],  // 建国記念の日
    [4, 29],  // 昭和の日
    [5, 3],   // 憲法記念日
    [5, 4],   // みどりの日
    [5, 5],   // こどもの日
    [8, 11],  // 山の日
    [11, 3],  // 文化の日
    [11, 23], // 勤労感謝の日
    [12, 23], // 天皇誕生日（令和以前）
  ];
  if (fixed.some(([mm, dd]) => mm === m && dd === d)) return true;
  if (m === 2 && d === 23) return true; // 天皇誕生日
  const secondMondayJan = 8 + (8 - new Date(y, 0, 1).getDay()) % 7;
  if (m === 1 && d === secondMondayJan) return true;   // 成人の日（1月第2月曜）
  if (m === 7 && d === 18 && y >= 2023) return true;   // 海の日（2023〜固定）
  if (m === 9 && d === 23) return true;                // 秋分の日（近似）
  const secondMondayOct = 8 + (8 - new Date(y, 9, 1).getDay()) % 7;
  if (m === 10 && d === secondMondayOct) return true; // スポーツの日（10月第2月曜）
  return false;
}
