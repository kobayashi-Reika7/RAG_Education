/**
 * 担当医スケジュールに基づく予約可能時間の算出
 * 日付 → 曜日 → その曜日の勤務時間 → 予約済みを除外
 */

/** YYYY-MM-DD から Firestore の曜日キー（sun, mon, ...）を返す */
export function getWeekdayKey(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return 'sun';
  const [y, m, d] = dateStr.split('-').map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return 'sun';
  const date = new Date(y, m - 1, d);
  const day = date.getDay(); // 0=Sun, 1=Mon, ...
  const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return keys[day] ?? 'sun';
}

/**
 * 担当医オブジェクトと日付から、その日の勤務時間枠を取得（予約済みは含めるが呼び出し側で disabled にできる）
 * @param {{ schedules: Record<string, string[]> }} doctor - getDoctorById の戻り値
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {string[]} その曜日の勤務時間の配列（30分刻み、昇順）
 */
export function getScheduleSlotsForDate(doctor, dateStr) {
  if (!doctor?.schedules || !dateStr) return [];
  const weekday = getWeekdayKey(dateStr);
  const slots = doctor.schedules[weekday];
  return Array.isArray(slots) ? [...slots].sort() : [];
}

/**
 * 表示用の時間枠一覧（勤務枠のうち、予約済みでないものは選択可能）
 * @param {{ schedules: Record<string, string[]> }} doctor
 * @param {string} dateStr - YYYY-MM-DD
 * @param {Set<string>} reservedTimes - 既に予約済みの時間の集合
 * @returns {{ slots: string[], disabledSet: Set<string> }} その日の全枠と、予約済みで無効にする時間の集合
 */
export function getTimeSlotsForDoctorAndDate(doctor, dateStr, reservedTimes) {
  const slots = getScheduleSlotsForDate(doctor, dateStr);
  const disabledSet = new Set();
  (reservedTimes || new Set()).forEach((t) => disabledSet.add(t));
  return { slots, disabledSet };
}
