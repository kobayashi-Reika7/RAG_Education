/**
 * 予約入力フォーム画面（医療系UI/UX設計に準拠）
 * フロー: 大分類 → 診療科 → 予約目的 → 担当医×時間枠（○×）で時間のみ選択。担当医は自動割当。
 * 確認ボタンは条件をすべて満たすまで無効・画面下部固定。エラーは即時表示。
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import Breadcrumb from '../components/Breadcrumb';
import { SelectField } from '../components/InputForm';
import {
  CATEGORIES,
  DEPARTMENTS_BY_CATEGORY,
  PURPOSES,
} from '../constants/masterData';
import { getTimeSlots } from '../constants/masterData';
import { getSlotsWeek } from '../services/backend';

function isValidYmd(dateStr) {
  return typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

function parseYmdLocal(dateStr) {
  // YYYY-MM-DD をローカル日付として扱う（タイムゾーンのズレで前日/翌日にならない設計）
  if (!isValidYmd(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function formatYmdLocal(dateObj) {
  if (!(dateObj instanceof Date)) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(dateObj, days) {
  const d = new Date(dateObj);
  d.setDate(d.getDate() + days);
  return d;
}

function startOfWeekMonday(dateObj) {
  // 月曜始まり（表示要件: 〜（月）〜（日））
  const d = new Date(dateObj);
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatJpWeekRange(startDate, endDate) {
  const sY = startDate.getFullYear();
  const sM = startDate.getMonth() + 1;
  const sD = startDate.getDate();
  const eY = endDate.getFullYear();
  const eM = endDate.getMonth() + 1;
  const eD = endDate.getDate();
  // 年が跨ぐ時だけ年を両方出す（見やすさ優先）
  if (sY !== eY) return `${sY}年${sM}月${sD}日（月）〜${eY}年${eM}月${eD}日（日）`;
  return `${sY}年${sM}月${sD}日（月）〜${eM}月${eD}日（日）`;
}

function isPastDateYmd(dateStr, todayYmd) {
  if (!isValidYmd(dateStr) || !isValidYmd(todayYmd)) return false;
  return dateStr < todayYmd;
}

function isPastTimeSlot(dateStr, timeStr) {
  // 過去時間はすべて ×（要件）
  const date = parseYmdLocal(dateStr);
  if (!date) return false;
  const m = String(timeStr || '').match(/^(\d{2}):(\d{2})$/);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const slot = new Date(date);
  slot.setHours(hh, mm, 0, 0);
  return slot.getTime() < Date.now();
}

/** 予約データからフォーム用の category/department/purpose/time を返す（担当医は自動割当のため初期値不要） */
function getInitialIdsFromReservation(editingReservation) {
  if (!editingReservation) return {};
  const r = editingReservation;
  let category = '';
  let department = '';
  for (const c of CATEGORIES) {
    const depts = DEPARTMENTS_BY_CATEGORY[c.id] ?? [];
    const found = depts.find((d) => d.label === r.department);
    if (found) {
      category = c.id;
      department = found.id;
      break;
    }
  }
  const purpose = PURPOSES.find((p) => p.label === r.purpose)?.id ?? '';
  const time = (r.time || '').trim() || '';
  return { category, department, purpose, time };
}

const STATUS_SYMBOL = { available: '○', unavailable: '×' };
const DOW_LABELS = [
  { key: 'mon', label: '月' },
  { key: 'tue', label: '火' },
  { key: 'wed', label: '水' },
  { key: 'thu', label: '木' },
  { key: 'fri', label: '金' },
  { key: 'sat', label: '土' },
  { key: 'sun', label: '日' },
];

function ReserveFormPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuth();
  const initialSelectedDate = location.state?.selectedDate ?? '';
  const editingReservation = location.state?.editingReservation ?? null;
  const editingReservationId = location.state?.editingReservationId ?? null;
  const isEditing = !!location.state?.isEditing;

  const initialIds = useMemo(
    () => getInitialIdsFromReservation(editingReservation),
    [editingReservation]
  );

  const [category, setCategory] = useState(initialIds.category || '');
  const [department, setDepartment] = useState(initialIds.department || '');
  const [purpose, setPurpose] = useState(initialIds.purpose || '');
  const [viewDate, setViewDate] = useState(() => {
    const today = formatYmdLocal(new Date());
    if (isValidYmd(initialSelectedDate) && !isPastDateYmd(initialSelectedDate, today)) return initialSelectedDate;
    return today;
  });
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const base = parseYmdLocal(isValidYmd(initialSelectedDate) ? initialSelectedDate : formatYmdLocal(new Date())) ?? new Date();
    return formatYmdLocal(startOfWeekMonday(base));
  });
  const [gridState, setGridState] = useState({ status: 'idle', data: null, error: '' });
  const [submitError, setSubmitError] = useState('');
  // 週内全日付の空き枠キャッシュ: { [ymd]: { timeSlots, slots, isDemoFallback } }
  const weekSlotsCacheRef = useRef({});
  const [weekFetchStatus, setWeekFetchStatus] = useState('idle'); // idle | loading | done

  const departments = category ? (DEPARTMENTS_BY_CATEGORY[category] ?? []) : [];
  const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label ?? '';
  const departmentLabel = departments.find((d) => d.id === department)?.label ?? '';
  const purposeLabel = PURPOSES.find((p) => p.id === purpose)?.label ?? '';
  const todayYmd = useMemo(() => formatYmdLocal(new Date()), []);

  const weekStart = useMemo(() => parseYmdLocal(weekStartDate), [weekStartDate]);
  const weekEnd = useMemo(() => (weekStart ? addDays(weekStart, 6) : null), [weekStart]);
  const weekRangeLabel = useMemo(
    () => (weekStart && weekEnd ? formatJpWeekRange(weekStart, weekEnd) : ''),
    [weekStart, weekEnd]
  );
  const minWeekStartYmd = useMemo(() => formatYmdLocal(startOfWeekMonday(new Date())), []);
  const canGoPrevWeek = Boolean(weekStartDate && weekStartDate > minWeekStartYmd);

  const weekDates = useMemo(() => {
    if (!weekStart) return [];
    return DOW_LABELS.map((dow, idx) => {
      const d = addDays(weekStart, idx);
      const ymd = formatYmdLocal(d);
      return { ...dow, ymd, md: `${d.getMonth() + 1}/${d.getDate()}` };
    });
  }, [weekStart]);

  useEffect(() => {
    if (!category) setDepartment('');
  }, [category]);

  // 週切り替え: state 初期化 → 日付更新 → 空き状況再取得は useEffect 側で実行
  const handlePrevWeek = () => {
    if (!weekStart) return;
    if (!canGoPrevWeek) return;
    const nextStart = addDays(weekStart, -7);
    const nextStartYmd = formatYmdLocal(nextStart);
    if (nextStartYmd < minWeekStartYmd) return;
    setWeekStartDate(nextStartYmd);
    setGridState({ status: 'idle', data: null, error: '' });
    setSubmitError('');
    // 過去日を避けて選択（誤操作防止）
    const nextView = nextStartYmd < todayYmd ? todayYmd : nextStartYmd;
    setViewDate(nextView);
  };

  const handleNextWeek = () => {
    if (!weekStart) return;
    const nextStart = addDays(weekStart, 7);
    const nextStartYmd = formatYmdLocal(nextStart);
    setWeekStartDate(nextStartYmd);
    setGridState({ status: 'idle', data: null, error: '' });
    setSubmitError('');
    setViewDate(nextStartYmd);
  };

  const handlePrev5Days = () => {
    if (!weekStart) return;
    if (!canGoPrevWeek) return;
    const nextStart = addDays(weekStart, -5);
    let nextStartYmd = formatYmdLocal(nextStart);
    if (nextStartYmd < minWeekStartYmd) nextStartYmd = minWeekStartYmd;
    setWeekStartDate(nextStartYmd);
    setGridState({ status: 'idle', data: null, error: '' });
    setSubmitError('');
    const nextView = nextStartYmd < todayYmd ? todayYmd : nextStartYmd;
    setViewDate(nextView);
  };

  const handleNext5Days = () => {
    if (!weekStart) return;
    const nextStart = addDays(weekStart, 5);
    const nextStartYmd = formatYmdLocal(nextStart);
    setWeekStartDate(nextStartYmd);
    setGridState({ status: 'idle', data: null, error: '' });
    setSubmitError('');
    setViewDate(nextStartYmd);
  };

  const handleSelectDateInWeek = (ymd) => {
    if (!isValidYmd(ymd)) return;
    if (isPastDateYmd(ymd, todayYmd)) return;
    setViewDate(ymd);
    setSubmitError('');
    // キャッシュがあれば gridState は useEffect で即反映される（再取得しない）
  };

  // 週全体の空き枠を1回のAPIリクエストで一括取得しキャッシュ
  useEffect(() => {
    if (!departmentLabel || !weekDates.length) {
      weekSlotsCacheRef.current = {};
      setWeekFetchStatus('idle');
      setGridState({ status: 'idle', data: null, error: '' });
      return;
    }
    let cancelled = false;
    weekSlotsCacheRef.current = {};
    setWeekFetchStatus('loading');
    const datesToFetch = weekDates
      .map((d) => d.ymd)
      .filter((ymd) => !isPastDateYmd(ymd, todayYmd));
    if (!datesToFetch.length) {
      setWeekFetchStatus('done');
      setGridState({ status: 'idle', data: null, error: '' });
      return;
    }
    // 1回のリクエストで週全体を取得（バックエンドは Firestore 2クエリで計算）
    getSlotsWeek(departmentLabel, datesToFetch)
      .then((result) => {
        if (cancelled) return;
        const cache = {};
        const ts = getTimeSlots();
        for (const [ymd, data] of Object.entries(result)) {
          cache[ymd] = { timeSlots: ts, slots: data.slots ?? [], isDemoFallback: data.isDemoFallback ?? false };
        }
        weekSlotsCacheRef.current = cache;
        setWeekFetchStatus('done');
      })
      .catch(() => {
        if (cancelled) return;
        setWeekFetchStatus('done');
      });
    return () => { cancelled = true; };
  }, [weekStartDate, departmentLabel, todayYmd, weekDates]);

  // 選択中の日付が変わったら、キャッシュからグリッドを即反映（API呼び出しなし）
  useEffect(() => {
    if (!viewDate || !departmentLabel) {
      setGridState({ status: 'idle', data: null, error: '' });
      return;
    }
    if (isPastDateYmd(viewDate, todayYmd)) {
      setGridState({ status: 'idle', data: null, error: '' });
      return;
    }
    const cached = weekSlotsCacheRef.current[viewDate];
    if (cached) {
      setGridState({ status: 'success', data: cached, error: '' });
    } else if (weekFetchStatus === 'loading') {
      setGridState({ status: 'loading', data: null, error: '' });
    } else {
      setGridState({ status: 'error', data: null, error: '空き状況を取得できませんでした。' });
    }
  }, [viewDate, departmentLabel, todayYmd, weekFetchStatus]);

  const goToConfirm = (timeSlot) => {
    if (!viewDate || !category || !department || !purpose || !timeSlot) return;
    if (gridState.status !== 'success') return;
    if (isPastTimeSlot(viewDate, timeSlot)) return;
    const slots = gridState.data?.slots;
    const s = Array.isArray(slots) ? slots.find((x) => x.time === timeSlot) : null;
    if (!s?.reservable) return;
    setSubmitError('');
    navigate('/reserve/confirm', {
      state: {
        selectedDate: viewDate,
        category: categoryLabel,
        department: departmentLabel,
        purpose: purposeLabel,
        time: timeSlot,
        isEditing: isEditing || undefined,
        editingReservationId: editingReservationId || undefined,
      },
    });
  };

  const handleSlotClick = (t) => {
    if (gridState.status !== 'success') return;
    if (!category || !department || !purpose) return;
    if (isPastTimeSlot(viewDate, t)) return;
    const slots = gridState.data?.slots;
    const s = Array.isArray(slots) ? slots.find((x) => x.time === t) : null;
    if (!s?.reservable) return;
    goToConfirm(t);
  };

  const hasAnyReservable = useMemo(() => {
    if (gridState.status !== 'success' || !Array.isArray(gridState.data?.slots)) return false;
    return gridState.data.slots.some(
      (s) => s.reservable === true && !isPastTimeSlot(viewDate, s.time)
    );
  }, [gridState, viewDate]);

  if (!initialSelectedDate && !viewDate) {
    return (
      <div className="page page-reserve-form">
        <Breadcrumb
          items={[
            { label: 'Top', to: '/' },
            { label: 'メニュー', to: '/menu' },
            { label: '日付選択', to: '/calendar' },
            { label: '診察予約' },
          ]}
        />
        <p className="page-error">日付が選択されていません。</p>
        <div className="btn-wrap-center">
          <button
            type="button"
            className="btn btn-secondary btn-nav"
            onClick={() => navigate('/calendar', { state: isEditing ? { isEditing, editingReservationId, editingReservation } : undefined })}
          >
            カレンダーに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-reserve-form page-reserve-form-medical">
      <Breadcrumb
        items={[
          { label: 'Top', to: '/' },
          { label: 'メニュー', to: '/menu' },
          {
            label: '日付選択',
            to: '/calendar',
            onClick: () => navigate('/calendar', { state: isEditing ? { isEditing, editingReservationId, editingReservation } : undefined }),
          },
          { label: '診察予約' },
        ]}
      />
      <h1 className="page-title">予約内容の入力</h1>
      <p className="page-lead form-step-lead">予約日: <strong>{viewDate}</strong></p>

      {submitError && <p className="page-error" role="alert">{submitError}</p>}

      <form className="reserve-form" id="reserve-form" onSubmit={(e) => e.preventDefault()}>
        <section className="form-step">
          <h2 className="form-step-title">1. 大分類を選んでください</h2>
          <div className="choice-buttons">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`choice-btn ${category === c.id ? 'choice-btn-selected' : ''}`}
                onClick={() => setCategory(c.id)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        <section className="form-step">
          <h2 className="form-step-title">2. 診療科を選んでください</h2>
          <SelectField
            label="診療科"
            value={department}
            options={departments}
            onChange={setDepartment}
            placeholder={category ? '選択してください' : '先に大分類を選んでください'}
            disabled={!category}
          />
        </section>

        <section className="form-step">
          <h2 className="form-step-title">3. 予約目的を選んでください</h2>
          <div className="choice-buttons choice-buttons-wrap">
            {PURPOSES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`choice-btn ${purpose === p.id ? 'choice-btn-selected' : ''}`}
                onClick={() => setPurpose(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section className="form-step form-step-grid">
          <h2 className="form-step-title">4. 時間を選んでください（○予約可 ×不可）</h2>
          {!departmentLabel ? (
            <p className="form-step-optional" role="status">2. で診療科を選択すると、空き枠が表示されます。</p>
          ) : (
            <>
              {/* 週切り替えナビゲーション（○×テーブル直上） */}
              <div className="week-nav" aria-label="週切り替え">
                <button
                  type="button"
                  className="week-nav-btn"
                  onClick={handlePrevWeek}
                  disabled={!canGoPrevWeek}
                  aria-disabled={!canGoPrevWeek}
                >
                  ＜ 前週
                </button>
                <button
                  type="button"
                  className="week-nav-btn"
                  onClick={handlePrev5Days}
                  disabled={!canGoPrevWeek}
                  aria-disabled={!canGoPrevWeek}
                  title="5日戻る"
                >
                  前の5日
                </button>
                <div className="week-nav-range" aria-live="polite">
                  {weekRangeLabel}
                </div>
                <button
                  type="button"
                  className="week-nav-btn"
                  onClick={handleNext5Days}
                  title="5日進む"
                >
                  次の5日
                </button>
                <button
                  type="button"
                  className="week-nav-btn"
                  onClick={handleNextWeek}
                >
                  翌週 ＞
                </button>
              </div>

              <div className="week-day-tabs" role="tablist" aria-label="週内の日付">
                {weekDates.map((d) => {
                  const disabled = isPastDateYmd(d.ymd, todayYmd);
                  const selected = viewDate === d.ymd;
                  return (
                    <button
                      key={d.ymd}
                      type="button"
                      className={`week-day-tab ${selected ? 'week-day-tab-selected' : ''}`}
                      onClick={() => handleSelectDateInWeek(d.ymd)}
                      disabled={disabled}
                      aria-disabled={disabled}
                      aria-selected={selected}
                      role="tab"
                      title={disabled ? '過去日は予約できません' : `${d.ymd} を表示`}
                    >
                      <span className="week-day-dow">{d.label}</span>
                      <span className="week-day-md">{d.md}</span>
                    </button>
                  );
                })}
              </div>

              {isPastDateYmd(viewDate, todayYmd) ? (
                <p className="form-step-empty" role="status">過去の日付は予約できません。別の日をお選びください。</p>
              ) : gridState.status === 'loading' ? (
                <p className="form-step-loading" role="status">空き枠を読み込み中…</p>
              ) : gridState.status === 'error' ? (
                <div className="form-step-empty form-step-error-wrap" role="alert">
                  <p className="form-step-error-message">
                    取得に失敗しました。通信状況をご確認のうえ、しばらくしてから再度お試しください。
                  </p>
                  <div className="form-step-troubleshoot" aria-label="取得ができないときの対処法">
                    <p className="form-step-troubleshoot-title">お試しください</p>
                    <ul className="form-step-troubleshoot-list">
                      <li>日付や診療科を切り替えて、もう一度読み込みを試す</li>
                      <li>通信環境（Wi-Fi・回線）をご確認ください</li>
                    </ul>
                  </div>
                </div>
              ) : gridState.status !== 'success' ? (
                <p className="form-step-optional" role="status">日付・診療科を選択すると、空き枠が表示されます。</p>
              ) : !Array.isArray(gridState.data?.slots) ? (
                <p className="form-step-empty" role="status">空き状況の形式が不正です。</p>
              ) : (
                <div className="doctor-time-grid-wrap">
                  <table className="doctor-time-grid doctor-time-grid-single" role="grid" aria-label="時間枠 空き状況（診療科目単位）">
                    <thead>
                      <tr>
                        <th scope="col" className="grid-th-time-label">時間</th>
                        {(gridState.data.timeSlots || []).map((t) => (
                          <th key={t} scope="col" className="grid-th-time">{t}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="grid-td-time-label">○予約可 ×不可</td>
                        {(gridState.data.timeSlots || []).map((t) => {
                          const slot = gridState.data.slots.find((s) => s.time === t);
                          const reservable = slot?.reservable === true;
                          const past = isPastTimeSlot(viewDate, t);
                          const status = past ? 'unavailable' : (reservable ? 'available' : 'unavailable');
                          const clickable = status === 'available';
                          return (
                            <td key={t} className="grid-td-slot">
                              <button
                                type="button"
                                className={`grid-slot-btn grid-slot-${status}`}
                                disabled={!clickable}
                                onClick={() => clickable && handleSlotClick(t)}
                                aria-label={`${t} ${status === 'available' ? '予約可能' : '予約不可'}`}
                                title={past ? '過去の時間は予約できません' : (status === 'available' ? '予約可能' : '予約不可')}
                              >
                                {STATUS_SYMBOL[status]}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {gridState.status === 'success' && gridState.data?.isDemoFallback && (
                <div className="form-step-demo-fallback" role="status">
                  <p className="form-step-optional page-muted">
                    現在、空き状況は仮の表示です。予約を確定するには、しばらくしてから再度お試しください。
                  </p>
                </div>
              )}
              {gridState.status === 'success' && Array.isArray(gridState.data?.slots) && !hasAnyReservable && !isPastDateYmd(viewDate, todayYmd) && (
                <p className="form-step-empty form-step-no-slots" role="status">
                  この日・この診療科では予約可能な枠がありません。別の日や診療科をお選びください。
                </p>
              )}
            </>
          )}
        </section>

        <div className="form-submit-wrap">
          <button
            type="button"
            className="btn btn-secondary btn-nav"
            onClick={() => navigate('/calendar', { state: isEditing ? { isEditing, editingReservationId, editingReservation } : undefined })}
          >
            カレンダーに戻る
          </button>
        </div>
      </form>
    </div>
  );
}

export default ReserveFormPage;
