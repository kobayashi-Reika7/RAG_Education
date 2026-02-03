/**
 * Firebase 接続設定
 *
 * - initializeApp で Firebase アプリを初期化
 * - getFirestore で Firestore インスタンスを取得
 * - 設定値は import.meta.env から取得（.env に書いた値を参照）
 *
 * 【重要】import.meta.env で読み取れる変数は
 * VITE_ で始まるものだけです（Vite の仕様）
 */
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// .env から Firebase の設定値を取得
// 直接値を書かず、必ず import.meta.env を使う（セキュリティ・環境ごとの切り替えのため）
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase アプリを初期化（複数回呼ぶとエラーになるため、このファイルで1回だけ）
const app = initializeApp(firebaseConfig);

// Firestore インスタンスを取得し、他ファイルから import して使う
export const db = getFirestore(app);
