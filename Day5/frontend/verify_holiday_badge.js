/**
 * 祝日バッジ確認手順の「APIレスポンス確認」を実行するスクリプト
 * 使い方: Node で実行（バックエンド起動後）
 *   node verify_holiday_badge.js
 * またはブラウザの DevTools Console に貼り付けて実行
 */
const API_BASE = process.env.VITE_API_BASE || 'http://127.0.0.1:8002';
const DATE = '2026-02-11';
const DEPARTMENT = '循環器内科';

async function check() {
  const url = `${API_BASE}/api/slots?department=${encodeURIComponent(DEPARTMENT)}&date=${DATE}`;
  console.log('GET', url);
  try {
    const res = await fetch(url);
    const data = await res.json();
    const ok = data.is_holiday === true && data.reason === 'holiday';
    console.log(ok ? 'OK' : 'NG', 'date:', data.date, 'is_holiday:', data.is_holiday, 'reason:', data.reason);
    return ok;
  } catch (e) {
    console.error('Error', e.message);
    return false;
  }
}

check();
