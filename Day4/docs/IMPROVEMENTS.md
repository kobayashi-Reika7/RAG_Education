# Day4 改善点・不足の洗い出し

`docs/README.md`（統合ドキュメント）と実装を照合し、改善点・不足・ドキュメントとのズレをまとめたものです。

**修繕済み（実施済み）**: 1.1, 1.2, 2.1（TodoList.jsx 削除）, 2.2（api.js 注釈）, 3.1（デフォルトリスト判定・getLists ソート）, 3.2, 4.1, 4.2 はすべて対応済みです。

---

## 1. ドキュメントと実装のズレ

### 1.1 Day4/README.md の記述が古い

| 箇所 | 現状の記載 | 実装の実際 |
|------|------------|------------|
| ディレクトリ「firestore.js」 | addTodo / getTodos / deleteTodo | getLists, addList, deleteList, getTasks, addTask, updateTask, deleteTask |
| ディレクトリ「components」 | TodoList.jsx のみ | ListSelector, TaskForm, TaskList, TaskItem, Counter, Timer, Memo（TodoList.jsx は未使用） |
| データの流れ | getTodos() / addTodo() / deleteTodo() | getTasks() / addTask() / updateTask() / deleteTask()、および getLists() / addList() / deleteList() |

**対応案**: Day4/README.md の「ディレクトリ構成」と「データの流れ」を現状の Firestore API（firestore.js）とコンポーネント構成に合わせて更新する。

### 1.2 バックエンド CORS のデフォルトと Day4 のポート

- **docs/README.md 7.3**: ALLOWED_ORIGINS のデフォルトとして「localhost:5173 等」と記載。
- **実装**: Day4 フロントは `vite.config.js` で port **5100**。バックエンド `main.py` のデフォルトは `http://localhost:5173` のみ。
- **影響**: Day4 フロント + Day4 バックエンドを同時に使う場合、CORS で弾かれる可能性がある。

**対応案**:
- バックエンドのデフォルトに `http://localhost:5100` を追加する、または
- docs/README.md の 7.3 に「Day4 開発時は ALLOWED_ORIGINS に `http://localhost:5100` を追加すること」と明記する。

---

## 2. 未使用・デッドコード

### 2.1 TodoList.jsx

- **場所**: `frontend/src/components/TodoList.jsx`
- **状況**: どこからも import されていない。App.jsx は `TaskList` を使用。
- **内容**: タスク一覧表示のみの旧コンポーネント（onDelete 付き）。

**対応案**: 削除するか、参考用として残す場合は docs/README.md の 3.1 に「（参考・未使用）TodoList.jsx」と注釈する。

### 2.2 api.js

- **場所**: `frontend/src/api.js`
- **状況**: どこからも import されていない。Day4 は Firestore のみで完結。
- **内容**: FastAPI バックエンド向けの getTasks / createTask / updateTask / deleteTask / getLists / createList / deleteList。

**対応案**: バックエンド連携を将来行う場合に使うため残すなら、docs/README.md の 3.1 に「（任意・バックエンド連携用）api.js」と記載する。使わない方針なら削除。

---

## 3. 仕様・挙動の改善候補

### 3.1 デフォルトリストの判定

- **ドキュメント**: 「デフォルトリストの名前は『マイリスト』」「削除不可として扱う」。
- **実装**: `defaultListId = lists[0]?.id` で「**先頭**のリスト」をデフォルトとし、その ID が currentListId のとき削除ボタンを無効にしている。
- **ギャップ**: getLists() の返却順は Firestore の取得順のため保証がない。別のリストが先頭に来ると、「削除不可」が「マイリスト」ではなくなる可能性がある。

**対応案**:
- デフォルト判定を「リスト名が `DEFAULT_LIST_NAME`（マイリスト）のもの」に変更する、または
- getLists() の返却時に「マイリスト」を先頭にソートする（名前でソートして先頭に固定）ようにする。

### 3.2 docs/README.md に SETUP_FIREBASE.md への参照がない

- Day4/README.md では「詳細は frontend/SETUP_FIREBASE.md」と案内しているが、統合 doc（docs/README.md）の「4. 起動・画面構成」には SETUP_FIREBASE.md への言及がない。

**対応案**: docs/README.md の 4.1 に「Firebase の初回設定は `frontend/SETUP_FIREBASE.md` を参照」を 1 行追加する。

---

## 4. ドキュメントの軽微な不足

### 4.1 コンポーネント一覧と Timer / Memo

- 3.2 の表では Counter までで、Timer と Memo は行として書いていない。本文では「TaskItem がタイマー・メモを持つ」とあるので意味は通じるが、一覧性のため「Timer: 経過表示・開始/停止/リセット。停止時に親経由で Firestore に time 保存」「Memo: テキストエリア。Blur 時に親経由で Firestore に memo 保存」を追記してもよい。

### 4.2 ルートの参考ファイルが docs にない

- Day4 ルートに `CURSOR_PROMPT_DAY4.md`, `STEPS_7.md`, `todo_requirements.md`, `todolist.css`, `todolist.html`, `todolist.js` がある。docs/README.md には触れていない。
- **対応案**: 残すなら「参考資料」として 3.1 の下に短く記載する。不要なら整理・削除の対象として別タスクにする。

---

## 5. 実装上の良い点（変更不要）

- **Timer**: 停止時・リセット時のみ `onTimeChange` を呼び、Firestore への書き込み頻度を抑えている。ドキュメント「停止後は Firestore に保存」と一致。
- **Memo**: onBlur で保存。入力のたびに API を叩かないため負荷は妥当。
- **firestore.js**: getLists / addList / deleteList / getTasks / addTask / updateTask / deleteTask がドキュメント 3.3 と一致。
- **データモデル**: lists（name）、todos（title, list_id, is_completed, is_favorite, due_date, memo, time, createdAt）はドキュメント 2 と一致。
- **constants/messages.js**: DEFAULT_LIST_NAME = 'マイリスト'。初回の自動作成ロジック（App.jsx）と整合。

---

## 6. 優先度メモ

| 優先度 | 項目 | 内容 |
|--------|------|------|
| 高 | 1.1 | Day4/README.md のディレクトリ・データの流れを現状に合わせる |
| 中 | 3.1 | デフォルトリストを「名前＝マイリスト」で判定するか、getLists の並びを保証する |
| 中 | 1.2 | CORS デフォルトに 5100 を入れるか、ドキュメントに注意を追記 |
| 低 | 2.1, 2.2 | TodoList.jsx / api.js の削除またはドキュメントでの注釈 |
| 低 | 3.2, 4.1, 4.2 | SETUP_FIREBASE 参照・Timer/Memo 説明・ルート参考ファイルの記載 |

以上、`docs/README.md` を基準にした Day4 の改善点・不足の洗い出しです。
