/**
 * ToDo アプリ（React + Firestore リアルタイム連携）
 *
 * - useState で todos と input を管理
 * - useEffect で subscribeTodos を呼び出し、onSnapshot でリアルタイム監視
 * - return された unsubscribe を cleanup に設定（メモリリーク防止）
 * - フォーム送信で addTodoToDB を実行
 * - リロード不要で即座に画面が更新される
 */
import { useState, useEffect } from 'react';
import { subscribeTodos, addTodoToDB } from './services/firestore.js';
import './App.css';

function App() {
  // ToDo 一覧を state で管理
  const [todos, setTodos] = useState([]);

  // 入力中のタイトル
  const [inputTitle, setInputTitle] = useState('');

  // エラー表示用
  const [error, setError] = useState(null);

  /**
   * subscribeTodos で Firestore をリアルタイム監視
   * データが変わると callback が呼ばれ、setTodos で state を更新
   * return で unsubscribe を実行 → コンポーネント unmount 時に監視を解除
   */
  useEffect(() => {
    const unsubscribe = subscribeTodos((data) => {
      setTodos(data);
    });

    // cleanup: コンポーネントが unmount されたときに監視を解除
    // これを忘れると、別の画面に遷移した後もリスナーが残りメモリリークの原因になる
    return () => {
      unsubscribe();
    };
  }, []);

  /**
   * フォーム送信: addTodoToDB で追加
   * 追加後は subscribeTodos が自動で検知して setTodos が呼ばれるため、
   * 手動で再取得する必要がない（リロード不要で即座に反映）
   */
  async function handleSubmit(e) {
    e.preventDefault();

    const title = inputTitle.trim();
    if (!title) return;

    try {
      setError(null);
      await addTodoToDB(title);
      setInputTitle('');
      // subscribeTodos が自動で検知するため、fetchTodos のような再取得は不要
    } catch (err) {
      console.error('ToDo 追加エラー:', err);
      setError('追加に失敗しました');
    }
  }

  return (
    <div className="app">
      <h1>ToDoアプリ</h1>

      {/* 追加フォーム */}
      <form onSubmit={handleSubmit} className="todo-form">
        <input
          type="text"
          value={inputTitle}
          onChange={(e) => setInputTitle(e.target.value)}
          placeholder="タスクを入力"
          maxLength={200}
        />
        <button type="submit">追加</button>
      </form>

      {/* エラー表示 */}
      {error && <p className="error">{error}</p>}

      {/* ToDo 一覧（新しい順で表示・リアルタイム更新） */}
      <ul className="todo-list">
        {todos.map((todo) => (
          <li key={todo.id}>{todo.title}</li>
        ))}
      </ul>

      {todos.length === 0 && (
        <p className="empty">ToDo がありません。追加してください。</p>
      )}
    </div>
  );
}

export default App;
