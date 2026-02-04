# 再起動・別タブで表示件数が 0 になる現象（原因と解決策）

## 現象の要約

- **条件**: http://localhost:5100 で ToDo アプリを開いた状態で、フロントエンド（5100）とバックエンド（8000）を再起動し、Vite が新しいタブを自動で開く
- **結果**: 新しく開いたタブでは「未完了 0 件」「完了 0 件」などすべて 0 件になる
- **事実**: Firestore のデータは消えておらず、Console では確認できる（＝Firestore 側の不具合ではない）

---

## 再現条件の整理

1. 既存タブで http://localhost:5100 を開いている
2. `npm run dev`（フロント）とバックエンドを再起動
3. Vite の `server.open: true` により、**新しいタブ**が自動で開く
4. 新しいタブでは **currentListId が ''（空）** で初期化される
5. **subscribeTasks** は `listId = currentListId || defaultListId` で実行されるが、listId が '' のときは **購読しない**（早期 return）
6. タスクが一度もセットされず、Counter / TaskList は `tasks = []` のまま → **表示件数 0**

---

## 原因の技術説明

### 1. なぜ Firestore の問題ではないか

- Firestore のデータはクラウドにそのまま残っている（Console で確認可能）
- リロード（同一タブ）では消えない
- **問題は「どの listId で購読するか」がクライアント側で決まっておらず、その結果タスクを一度も取得していないこと**である
- つまり「データがない」のではなく「**表示用の listId が空のまま UI を出している**」ことが原因

### 2. 複数タブ・Vite 自動タブ・React state の関係

| 要因 | 説明 |
|------|------|
| **タブごとに React の state が初期化される** | 新しいタブ = 新しい document = 新しい React マウント。useState の初期値はそのタブで一度だけ評価される。 |
| **currentListId の初期値** | `useState(() => localStorage.getItem(STORAGE_KEY_CURRENT_LIST) \|\| '')` で **そのオリジン** の localStorage を読む。 |
| **オリジンが違うと localStorage が別** | 既存タブが `http://127.0.0.1:5100` で、Vite が `http://localhost:5100` を開く（またはその逆）だと、**別オリジン** のため localStorage は共有されず、新タブでは `currentListId` が '' になる。 |
| **Vite の自動で開く URL** | `vite.config.js` の `server.open: true` では、多くの環境で **localhost** が開く。ユーザーが手動で 127.0.0.1 を開いていた場合、新タブは localhost → 初回訪問扱いで localStorage が空の可能性がある。 |
| **defaultListId も初回は ''** | `defaultListId = lists[0]?.id ?? ''`。リストは subscribeLists の onSnapshot で遅れて届くため、**初回レンダー時は lists = []** → defaultListId = ''。 |
| **listId が '' のときタスクを購読しない** | `useEffect` 内で `const listId = currentListId \|\| defaultListId; if (!listId) return;` のため、listId が '' の間は subscribeTasks が呼ばれず、**tasks は常に []**。 |
| **8 秒タイムアウトで「読み込み完了」** | リスト／タスクのサーバースナップを待つが、listId が '' のままではタスク購読が行われない。8 秒後にタイムアウトで `listsLoaded` / `tasksSnapshotReceived` を true にすると、**listId がまだ '' のまま**でメイン UI が表示され、0 件のまま固まる。 |

### 3. 因果の流れ（簡潔）

1. 新タブでマウント → `currentListId = ''`（別オリジン or 初回で localStorage が空）
2. `lists = []` → `defaultListId = ''` → `listId = ''`
3. タスク用 `useEffect` が `if (!listId) return` で何もせず、**tasks は [] のまま**
4. リストの onSnapshot は後から届くが、**サーバースナップより先に 8 秒タイムアウト**が鳴る、あるいはリスト到着後も「有効な listId が決まった」とみなさずに UI を出してしまう
5. メイン UI 表示時点で `currentListId || defaultListId` がまだ '' → Counter / TaskList は `tasks = []` のまま → **表示件数 0**

---

## 解決策

### 解決策 A: 有効な listId が決まるまでメイン UI を出さない（推奨）

- **内容**: 「読み込み完了」とみなす条件に **「表示するリストが 1 つは決まっている」** を追加する。
- **実装**: `isLoading` を  
  `!(listsLoaded && tasksSnapshotReceived) || !(currentListId || defaultListId)`  
  のようにし、**currentListId も defaultListId も空のあいだはローディングのまま**にする。
- **効果**:
  - 新タブで listId が '' のままのときは、リストの onSnapshot でリストが届き `currentListId` または `defaultListId` がセットされるまで「読み込み中」を表示する
  - listId が決まってからタスクを購読し、タスクが入ってから（またはタイムアウトで）メイン UI に切り替えるため、**0 件のまま固まる経路を防げる**
- **注意**: リストが永遠に届かない（オフライン・エラー）場合はローディングのままになるが、その場合はデータ表示が不可能な状態なので許容する。

### 解決策 B: Vite で開く URL を localhost に固定する

- **内容**: `vite.config.js` の `server.open` を `'http://localhost:5100'` のように**文字列で指定**し、常に同じオリジンで開くようにする。
- **効果**: 既存タブも localhost で開いていれば、新タブと localStorage が共有され、currentListId が復元されやすくなる。
- **限界**: ユーザーが 127.0.0.1 で開いた場合は別オリジンなので、B だけでは不十分。A と併用する。

### 解決策 C: リスト取得後に currentListId を必ず 1 回セットする（現状でも一部実施済み）

- **内容**: subscribeLists のコールバックで、リストが 1 件以上あるときに `savedStillExists ? savedId : firstId` で `setCurrentListId` する（既存実装）。
- **効果**: サーバーからリストが届けば、localStorage が空でも `currentListId` が firstId で埋まる。
- **限界**: リストの onSnapshot が**タイムアウトより遅い**、または**キャッシュのみでサーバースナップが来ない**場合、8 秒で「読み込み完了」になり、その時点でまだ listId が '' だと 0 件のままになる。そのため **A が必須**。

### 推奨

- **必須**: **解決策 A** を入れる（有効な listId が決まるまでメイン UI を出さない）。
- **補助**: **解決策 B** で Vite の open URL を localhost に固定し、タブ間で localStorage が揃いやすくする。

---

## 修正コード例（React）

### App.jsx の変更箇所

**変更前:**

```javascript
const isLoading = !(listsLoaded && tasksSnapshotReceived);
```

**変更後:**

```javascript
// 新タブで currentListId が '' のままメイン UI を出さない（表示件数 0 を防ぐ）
const hasValidListId = !!(currentListId || defaultListId);
const isLoading =
  !(listsLoaded && tasksSnapshotReceived) || !hasValidListId;
```

これにより、リストが届いて `currentListId` または `defaultListId` がセットされるまで「読み込み中…」を出し続け、そのあとタスクを購読してからメイン UI に切り替える。

### vite.config.js（オプション）

```javascript
server: {
  port: 5100,
  strictPort: false,
  open: 'http://localhost:5100',  // 常に localhost で開く
},
```

---

## まとめ

- **原因**: 新タブで `currentListId` が ''（localStorage が別オリジン or 空）、かつ `defaultListId` もリスト到着前は ''。listId が '' のためタスクを購読せず、8 秒タイムアウトで「読み込み完了」になり、0 件のままメイン UI が表示される。
- **Firestore は正常**: データは残っており、listId が正しく決まれば取得・表示できる。
- **最も安定する対策**: 「有効な listId が決まるまでメイン UI を出さない」（上記 A）を実装する。
