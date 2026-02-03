# 環境変数 (.env) の使い方

## 1. .env ファイルの記述例

プロジェクト直下（`frontend/` 直下）に `.env` を置きます。

```env
VITE_FIREBASE_API_KEY=AIzaSyxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

各値は [Firebase Console](https://console.firebase.google.com/) → プロジェクト設定 → 一般 → アプリ で確認できます。

---

## 2. import.meta.env での読み取り方法

Vite では、**VITE_** で始まる環境変数だけがクライアント（ブラウザ）に公開されます。

```javascript
// 正しい: VITE_ プレフィックス付き
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;

// 間違い: VITE_ がないと undefined
const secret = import.meta.env.SECRET_KEY;  // → undefined
```

### 使用例（firebase.js 内）

```javascript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  // ...
};
```

### 注意点

- `.env` を変更したら **`npm run dev` を再起動**すること（ビルド時に読み込まれるため）
- `import.meta.env` はコード内で直接参照する（変数に代入してから使う場合は、ビルド時に静的に解決される点に注意）

---

## 3. .gitignore に .env を追加する理由と書き方

### 理由

| 理由 | 説明 |
|------|------|
| API キー漏洩 | `.env` には Firebase API キーなど秘密情報が含まれる |
| リポジトリ公開時 | GitHub 等に push すると、誰でもキーを閲覧できてしまう |
| 不正利用 | 漏れたキーで Firebase が悪用される可能性がある |

### .gitignore の書き方

```gitignore
# 環境変数ファイル（API キー等が含まれるため Git に含めない）
.env
.env.local
.env.*.local
```

- **`.env`**: 本番・開発用の実際の設定（含めない）
- **`.env.example`**: 変数名だけのテンプレート（含めて OK、値は空で push）

### 運用

1. `.env.example` をリポジトリに含める（値は空またはダミー）
2. 開発者は `cp .env.example .env` でコピーし、自分の環境で値を入れる
3. `.env` は Git にコミットしない

---

## 4. onSnapshot で await が不要な理由

`getDocs` は Promise を返すので `await` が必要ですが、`onSnapshot` は異なります。

| 関数 | 戻り値 | await の要否 |
|------|--------|--------------|
| getDocs | Promise | 必要（`const snap = await getDocs(q)`） |
| onSnapshot | unsubscribe 関数 | 不要 |

### なぜか

- **onSnapshot** は「リスナーを登録する」関数
- Promise を返さない（同期的に unsubscribe 関数を返す）
- データ変更時は、第2引数のコールバックが非同期で呼ばれる
- `await` する対象（Promise）が存在しないため、`await` は不要

### 正しい使い方

```javascript
// onSnapshot: await しない。戻り値の unsubscribe を cleanup で使う
const unsubscribe = onSnapshot(q, (snapshot) => {
  // データが変わるたびにここが呼ばれる
  const data = snapshot.docs.map(...);
  setTodos(data);
});

// useEffect の cleanup で監視を解除
return () => unsubscribe();
```
