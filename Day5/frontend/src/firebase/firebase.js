/**
 * Firebase 初期化（Authentication + Firestore）
 * 認証と予約データ保存に使用。このファイルでアプリを1回だけ初期化する
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

if (!import.meta.env.VITE_FIREBASE_PROJECT_ID) {
  console.error('[Firebase] VITE_FIREBASE_PROJECT_ID が未設定です。.env を確認し、npm run dev を再起動してください。');
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db).catch((err) => {
  if (err.code === 'failed-precondition') {
    console.warn('Firestore 永続化: 複数タブのためスキップ');
  }
});

export { auth, db };
