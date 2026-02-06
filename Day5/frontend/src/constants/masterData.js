/**
 * 予約フォーム用マスタデータ
 * 大分類・診療科・予約目的・担当医・時間枠（30分刻み）
 */

// 大分類 → 診療科の対応（要件: 内科系 / 外科系 / 小児・女性 / 検査 / リハビリ）
export const CATEGORIES = [
  { id: 'internal', label: '内科系' },
  { id: 'surgical', label: '外科系' },
  { id: 'pediatric_women', label: '小児・女性' },
  { id: 'examination', label: '検査' },
  { id: 'rehabilitation', label: 'リハビリ' },
];

export const DEPARTMENTS_BY_CATEGORY = {
  internal: [
    { id: 'cardiology', label: '循環器内科' },
    { id: 'gastroenterology', label: '消化器内科' },
    { id: 'respiratory', label: '呼吸器内科' },
    { id: 'nephrology', label: '腎臓内科' },
    { id: 'neurology', label: '神経内科' },
  ],
  surgical: [
    { id: 'orthopedics', label: '整形外科' },
    { id: 'ophthalmology', label: '眼科' },
    { id: 'otolaryngology', label: '耳鼻咽喉科' },
    { id: 'dermatology', label: '皮膚科' },
    { id: 'urology', label: '泌尿器科' },
  ],
  pediatric_women: [
    { id: 'pediatrics', label: '小児科' },
    { id: 'obstetrics', label: '産婦人科' },
  ],
  examination: [
    { id: 'radiology', label: '画像診断・検査' },
    { id: 'lab', label: '臨床検査' },
  ],
  rehabilitation: [
    { id: 'rehab', label: 'リハビリテーション科' },
  ],
};

// 予約目的（代表4種。その他は「その他」に集約）
export const PURPOSES = [
  { id: 'first', label: '初診' },
  { id: 'follow', label: '再診' },
  { id: 'vaccine', label: '予防接種' },
  { id: 'other', label: 'その他' },
];

// 担当医（サンプル。医師ごとの勤務は簡略化し、時間枠は共通で表示）
export const DOCTORS = [
  { id: 'doc1', name: '山田 太郎' },
  { id: 'doc2', name: '佐藤 花子' },
  { id: 'doc3', name: '鈴木 一郎' },
];

/**
 * 15分刻みの予約可能時間枠（9:00〜17:00）
 * - 開始 09:00
 * - 最終枠 16:45（17:00 終了を想定）
 * @returns {string[]} 例 ["09:00", "09:15", ...]
 */
export function getTimeSlots() {
  const slots = [];
  for (let h = 9; h < 17; h++) {
    for (const m of [0, 15, 30, 45]) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}
