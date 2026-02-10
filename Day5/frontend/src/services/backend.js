/**
 * バックエンド API 呼び出し
 * 認証は Firebase に一本化。空き枠・予約作成はバックエンドが判定（フロントは表示のみ）。
 */
const getBaseUrl = () => import.meta.env.VITE_API_BASE ?? 'http://localhost:8002';

function authHeaders(idToken) {
  return idToken ? { Authorization: `Bearer ${idToken}` } : {};
}

/**
 * Firebase IDトークンを使って /users/me を呼び、バックエンドへユーザー情報を同期する
 * @param {string} idToken
 * @returns {Promise<{ uid: string, email: string }>}
 */
export async function syncMe(idToken) {
  const res = await fetch(`${getBaseUrl()}/users/me`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${idToken}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail ?? 'ユーザー同期に失敗しました。');
    err.status = res.status;
    err.detail = data.detail;
    throw err;
  }
  return data;
}

/**
 * デモ用スロット生成（API 失敗時のフォールバック）。平日 09:00〜11:45 を予約可とする。
 * @param {string} dateStr - YYYY-MM-DD
 * @param {string[]} timeSlots - 時間枠リスト（getTimeSlots() と同形式）
 * @returns {Array<{ time: string, reservable: boolean }>}
 */
export function getDemoSlotsForDate(dateStr, timeSlots) {
  if (!dateStr || !Array.isArray(timeSlots)) return timeSlots.map((t) => ({ time: t, reservable: false }));
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  const dow = date.getDay(); // 0=Sun .. 6=Sat
  const isWeekday = dow >= 1 && dow <= 5;
  return timeSlots.map((t) => ({
    time: t,
    reservable: isWeekday && t >= '09:00' && t < '12:00',
  }));
}

/**
 * 診療科・日付の空き枠を取得。○×の計算はバックエンドのみ。フロントは表示だけ。
 * 失敗時はデモスロットでフォールバックし、空き状況の表示を確実にする。
 * @param {string} department - 診療科表示名（例: "循環器内科"）
 * @param {string} date - YYYY-MM-DD
 * @param {string} [idToken] - 任意（スロット取得は認証なしでも可）
 * @returns {Promise<{ slots: Array<{ time: string, reservable: boolean }>, isDemoFallback?: boolean }>}
 */
function messageForStatus(status, defaultMessage) {
  if (status === 404 || status === 502 || status === 503) {
    return 'サービスに接続できません。しばらくしてから再度お試しください。';
  }
  return defaultMessage;
}

/**
 * 診療科・日付の空き状況を取得。バックエンドが date, is_holiday, reason, slots を返す。
 * @returns {{ date?: string, isHoliday?: boolean, reason?: string | null, slots: Array<{ time: string, reservable: boolean }>, isDemoFallback: boolean }}
 */
export async function getSlots(department, date, idToken) {
  const params = new URLSearchParams({ department: department || '', date: date || '' });
  try {
    const res = await fetch(`${getBaseUrl()}/api/slots?${params}`, {
      method: 'GET',
      headers: authHeaders(idToken),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.detail ?? messageForStatus(res.status, '空き枠の取得に失敗しました。'));
    }
    // 空き状況APIは { date, is_holiday, reservable, reason, slots } を返す。祝日は is_holiday: true 必須。
    const isLegacyArray = Array.isArray(data);
    const slots = isLegacyArray ? data : (Array.isArray(data?.slots) ? data.slots : []);
    const isHoliday = isLegacyArray ? false : Boolean(data.is_holiday ?? data.isHoliday);
    return {
      date: isLegacyArray ? date : (data.date ?? date),
      isHoliday,
      reason: isLegacyArray ? null : (data.reason ?? null),
      slots,
      isDemoFallback: false,
    };
  } catch (err) {
    const baseUrl = getBaseUrl();
    if (err?.status === 404 && typeof fetch !== 'undefined') {
      try {
        const check = await fetch(`${baseUrl}/api`, { method: 'GET' });
        if (check.status === 404) {
          console.warn(
            '[Day5] バックエンドに接続できません。Day5 のバックエンド（Day5/backend/run.bat）がポート 8002 で起動しているか確認してください。'
          );
        }
      } catch (_) {}
    }
    const { getTimeSlots } = await import('../constants/masterData');
    const timeSlots = getTimeSlots();
    const slots = getDemoSlotsForDate(date, timeSlots);
    return { date, isHoliday: false, reason: null, slots, isDemoFallback: true };
  }
}

/**
 * 複数日分の空き枠を一括取得（高速版）。バックエンドで医師取得1回+予約取得1回で全日分を計算。
 * @param {string} department - 診療科表示名
 * @param {string[]} dates - YYYY-MM-DD の配列
 * @param {string} [idToken]
 * @returns {Promise<Object.<string, { slots: Array<{ time: string, reservable: boolean }>, isDemoFallback: boolean }>>}
 */
export async function getSlotsWeek(department, dates, idToken) {
  if (!department || !Array.isArray(dates) || !dates.length) return {};
  const params = new URLSearchParams({ department, dates: dates.join(',') });
  try {
    const res = await fetch(`${getBaseUrl()}/api/slots/week?${params}`, {
      method: 'GET',
      headers: authHeaders(idToken),
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) {
      throw new Error(data.detail ?? '空き枠の一括取得に失敗しました。');
    }
    const result = {};
    for (const item of (Array.isArray(data) ? data : [])) {
      const date = item.date ?? '';
      if (!date) continue;
      result[date] = {
        slots: Array.isArray(item.slots) ? item.slots : [],
        isDemoFallback: false,
      };
    }
    return result;
  } catch (err) {
    // フォールバック: 個別に取得せずデモスロットを返す
    const { getTimeSlots } = await import('../constants/masterData');
    const timeSlots = getTimeSlots();
    const result = {};
    for (const d of dates) {
      result[d] = { slots: getDemoSlotsForDate(d, timeSlots), isDemoFallback: true };
    }
    return result;
  }
}

/**
 * 予約を確定する。担当医はバックエンドで自動割当。認証必須。
 * @param {string} idToken - Firebase ID トークン（必須）
 * @param {object} body - { department, date, time }
 * @returns {Promise<{ id: string, date: string, time: string, department: string }>}
 */
export async function createReservationApi(idToken, body) {
  if (!idToken || typeof idToken !== 'string' || !idToken.trim()) {
    const err = new Error('認証情報がありません。再ログインしてください。');
    err.status = 401;
    throw err;
  }
  const url = `${getBaseUrl()}/api/reservations`;
  const payload = {
    department: body.department ?? '',
    date: body.date ?? '',
    time: body.time ?? '',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders(idToken) },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 401 時は再ログインを促す。500 時はサーバー案内。その他は汎用メッセージ
    const userMsg =
      res.status === 401
        ? 'セッションが切れました。再ログインしてください。'
        : res.status >= 500
          ? 'サーバーでエラーが発生しました。しばらくしてから再度お試しください。'
          : '予約を確定できませんでした。入力内容を確認してもう一度お試しください。';
    if (typeof console !== 'undefined' && console.error) {
      console.error('[createReservationApi]', {
        status: res.status,
        statusText: res.statusText,
        detail: data.detail,
        url,
      });
    }
    const err = new Error(userMsg);
    err.status = res.status;
    err.detail = data.detail;
    throw err;
  }
  return data;
}
