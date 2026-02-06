/**
 * 予約データの Firestore 保存・取得
 * 構造: users/{uid}/reservations/{reservationId}
 * 同一ユーザーで同一 date+time の重複は不可
 * 他ユーザー含め「同じ科・同じ担当医・同じ時間」は1件のみ（重複予約不可）
 */
import {
  collection,
  collectionGroup,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase/firebase';

/**
 * 指定ユーザーの指定日・時間が既に予約済みか確認
 * @param {string} uid - ユーザーID
 * @param {string} date - YYYY-MM-DD
 * @param {string} time - 例 "09:00"
 * @returns {Promise<boolean>} 既に予約済みなら true
 */
export async function isSlotTaken(uid, date, time) {
  if (!uid) return false;
  const ref = collection(db, 'users', uid, 'reservations');
  const q = query(ref, where('date', '==', date), where('time', '==', time));
  const snap = await getDocs(q);
  return !snap.empty;
}

/**
 * 同じ科・同じ担当医・同じ日時で既に予約があるか（他ユーザー含む）
 * 変更時は自予約を除外するため excludeUid + excludeReservationId を渡す
 * @param {string} date - YYYY-MM-DD
 * @param {string} time - 例 "09:00"
 * @param {string} department - 診療科（表示名）
 * @param {string} doctor - 担当医（表示名）。空の場合はチェックしない（false を返す）
 * @param {string} [excludeUid] - 除外する uid（変更時の自予約）
 * @param {string} [excludeReservationId] - 除外する予約 ID
 * @returns {Promise<boolean>} 既に誰かが予約していれば true
 */
export async function isSlotTakenForDoctor(date, time, department, doctor, excludeUid, excludeReservationId) {
  if (!date || !time || !department) return false;
  const doctorTrim = String(doctor ?? '').trim();
  if (!doctorTrim) return false; // 担当医未選択の場合はチェックしない
  const ref = collectionGroup(db, 'reservations');
  const q = query(
    ref,
    where('date', '==', date),
    where('time', '==', time),
    where('department', '==', department),
    where('doctor', '==', doctorTrim)
  );
  const snap = await getDocs(q);
  if (snap.empty) return false;
  if (!excludeUid && !excludeReservationId) return true;
  const others = snap.docs.filter((d) => {
    const path = d.ref.path;
    const uid = path.split('/')[1];
    const id = d.id;
    return uid !== excludeUid || id !== excludeReservationId;
  });
  return others.length > 0;
}

/**
 * 予約を1件保存（users/{uid}/reservations に追加）
 * @param {string} uid - ユーザーID
 * @param {object} data - { date, time, category, department, purpose, doctor }
 * @returns {Promise<string>} 作成されたドキュメントID
 */
export async function createReservation(uid, data) {
  const ref = collection(db, 'users', uid, 'reservations');
  const payload = {
    date: String(data.date ?? ''),
    time: String(data.time ?? ''),
    category: String(data.category ?? ''),
    department: String(data.department ?? ''),
    purpose: String(data.purpose ?? ''),
    doctor: String(data.doctor ?? ''),
    createdAt: serverTimestamp(),
  };
  const docRef = await addDoc(ref, payload);
  return docRef.id;
}

/**
 * 予約を1件削除（users/{uid}/reservations/{reservationId}）
 * @param {string} uid - ユーザーID
 * @param {string} reservationId - 削除する予約ドキュメントID
 */
export async function deleteReservation(uid, reservationId) {
  if (!uid || !reservationId) return;
  const ref = doc(db, 'users', uid, 'reservations', reservationId);
  await deleteDoc(ref);
}

/**
 * 指定した担当医（診療科+表示名）の指定日の予約済み時間を取得（他ユーザー含む）
 * collectionGroup で「同じ科・同じ担当医」の予約を集約し、その日の time を返す。
 * @param {string} departmentLabel - 診療科の表示名
 * @param {string} doctorName - 担当医の表示名
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Set<string>>} 予約済みの時間の集合（例: Set(["09:00", "10:30"]））
 */
export async function getReservedTimesForDoctorAndDate(departmentLabel, doctorName, date) {
  const out = new Set();
  if (!departmentLabel?.trim() || !doctorName?.trim() || !date) return out;
  const ref = collectionGroup(db, 'reservations');
  const q = query(
    ref,
    where('date', '==', date),
    where('department', '==', departmentLabel.trim()),
    where('doctor', '==', doctorName.trim())
  );
  const snap = await getDocs(q);
  snap.docs.forEach((d) => {
    const t = d.data().time;
    if (typeof t === 'string' && t.trim()) out.add(t.trim());
  });
  return out;
}

/**
 * ユーザーの予約一覧を取得（日付・時間昇順）
 * @param {string} uid
 * @returns {Promise<Array<{id, date, time, category, department, purpose, doctor}>>}
 */
export async function getReservationsByUser(uid) {
  if (!uid) return [];
  const ref = collection(db, 'users', uid, 'reservations');
  const snap = await getDocs(ref);
  return snap.docs
    .map((d) => {
      const x = d.data();
      return {
        id: d.id,
        date: x.date ?? '',
        time: x.time ?? '',
        category: x.category ?? '',
        department: x.department ?? '',
        purpose: x.purpose ?? '',
        doctor: x.doctor ?? '',
      };
    })
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
