/**
 * Firestore doctors コレクションの取得
 * doctors/{doctorId}: { name, department, schedules: { mon, tue, wed, thu, fri } }
 * schedules は 30分刻みの時間配列（例: ["09:00", "09:30"]）、空配列は勤務なし
 */
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/firebase';

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * 診療科（表示名）に紐づく医師一覧を取得
 * @param {string} departmentLabel - 診療科の表示名（例: "循環器内科"）
 * @returns {Promise<Array<{id, name, department, schedules}>>}
 */
export async function getDoctorsByDepartment(departmentLabel) {
  if (!departmentLabel?.trim()) return [];
  const ref = collection(db, 'doctors');
  const q = query(ref, where('department', '==', String(departmentLabel).trim()));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const x = d.data();
    const schedules = x.schedules ?? {};
    const normalized = {};
    WEEKDAY_KEYS.forEach((key) => {
      const arr = schedules[key];
      normalized[key] = Array.isArray(arr) ? [...arr] : [];
    });
    return {
      id: d.id,
      name: x.name ?? '',
      department: x.department ?? '',
      schedules: normalized,
    };
  });
}

/**
 * 担当医1件を取得（スケジュール含む）
 * @param {string} doctorId
 * @returns {Promise<{id, name, department, schedules}|null>}
 */
export async function getDoctorById(doctorId) {
  if (!doctorId) return null;
  const ref = doc(db, 'doctors', doctorId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const x = snap.data();
  const schedules = x.schedules ?? {};
  const normalized = {};
  WEEKDAY_KEYS.forEach((key) => {
    const arr = schedules[key];
    normalized[key] = Array.isArray(arr) ? [...arr] : [];
  });
  return {
    id: snap.id,
    name: x.name ?? '',
    department: x.department ?? '',
    schedules: normalized,
  };
}
