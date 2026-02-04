/**
 * App: 全体の状態保持と Firestore 連携
 * VERIFICATION.md の確認項目（タスク追加・完了・編集・リスト・リロード等）に沿った構成
 * currentListId は localStorage に保存し、複数タブ間で共有する
 */
import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY_CURRENT_LIST = 'day4_currentListId';
import {
  subscribeLists,
  subscribeTasks,
  addTask,
  updateTask,
  deleteTask,
  addList,
  deleteList,
} from './services/firestore';
import { computeCounts, sortTasksByCreatedAt } from './utils/taskUtils';
import {
  DEFAULT_LIST_NAME,
  PROMPT_NEW_LIST_NAME,
  ALERT_CANNOT_DELETE_DEFAULT_LIST,
  CONFIRM_DELETE_LIST,
  ERROR_LIST_NOT_READY,
  ERROR_TASKS_FETCH,
  ERROR_TASKS_ADD,
  ERROR_TASKS_UPDATE,
  ERROR_TASKS_DELETE,
  ERROR_LISTS_FETCH,
  ERROR_LISTS_ADD,
  ERROR_LISTS_DELETE,
  ERROR_FIRESTORE_RULES,
} from './constants/messages';
import Counter from './components/Counter';
import ListSelector from './components/ListSelector';
import TaskForm from './components/TaskForm';
import TaskList from './components/TaskList';

function App() {
  const [tasks, setTasks] = useState([]);
  const [lists, setLists] = useState([]);
  const [currentListId, setCurrentListId] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_CURRENT_LIST) || '';
    } catch {
      return '';
    }
  });
  const [error, setError] = useState(null);
  // このセッションで削除したリストID（onSnapshot の古いデータでプルダウンに戻るのを防ぐ）
  const deletedListIdsRef = useRef(new Set());

  const defaultListId = lists.find((l) => l.name === DEFAULT_LIST_NAME)?.id ?? lists[0]?.id ?? '';

  // currentListId を localStorage に保存（タブ間共有のため）
  useEffect(() => {
    if (!currentListId) return;
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_LIST, currentListId);
    } catch {
      // プライベートモード等で書き込めない場合は無視
    }
  }, [currentListId]);

  // 他タブで currentListId が変更されたらこのタブも同期する
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY_CURRENT_LIST || e.newValue == null) return;
      setCurrentListId(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 初回 + リアルタイム: onSnapshot でリストを監視
  useEffect(() => {
    setError(null);
    const unsubLists = subscribeLists(
      (listData) => {
        if (!Array.isArray(listData)) listData = [];
        const hasDefaultList = listData.some((l) => l.name === DEFAULT_LIST_NAME);
        if (listData.length === 0 || !hasDefaultList) {
          addList(DEFAULT_LIST_NAME)
            .then((created) => {
              const defaultEntry = { id: created.id, name: created.name };
              const raw = listData.length === 0 ? [defaultEntry] : [defaultEntry, ...listData];
              const next = raw.filter((l) => !deletedListIdsRef.current.has(l.id));
              setLists(next);
              const firstId = next[0]?.id ?? '';
              setCurrentListId(firstId);
            })
            .catch((e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_LISTS_ADD + ': ' + e.message));
          return;
        }
        const filtered = listData.filter((l) => !deletedListIdsRef.current.has(l.id));
        setLists(filtered);
        const firstId = filtered[0]?.id ?? '';
        const savedId = (() => {
          try {
            return localStorage.getItem(STORAGE_KEY_CURRENT_LIST) || '';
          } catch {
            return '';
          }
        })();
        const savedStillExists = savedId && filtered.some((l) => l.id === savedId);
        setCurrentListId(savedStillExists ? savedId : firstId);
      },
      (e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_LISTS_FETCH + ': ' + e.message)
    );
    return () => unsubLists();
  }, []);

  // タブ（リスト）切り替え時も即時連携: currentListId または defaultListId が決まり次第タスクを購読
  useEffect(() => {
    const listId = currentListId || defaultListId;
    if (!listId) return;
    setError(null);
    const unsubTasks = subscribeTasks(
      listId,
      (taskList) => {
        setError(null);
        setTasks(sortTasksByCreatedAt(taskList));
      },
      (e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_TASKS_FETCH + ': ' + e.message)
    );
    return () => unsubTasks();
  }, [currentListId, defaultListId]);

  const handleAddTask = (title) => {
    const listId = currentListId || defaultListId;
    if (!listId) {
      setError(ERROR_LIST_NOT_READY);
      return;
    }
    setError(null);
    addTask({
      title,
      list_id: listId,
      is_completed: false,
      is_favorite: false,
      due_date: null,
      memo: '',
      time: 0,
    }).catch((e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_TASKS_ADD + ': ' + e.message));
    // onSnapshot が変更を検知して自動で setTasks するため loadTasks 不要
  };

  const handleUpdateTask = (id, data) => {
    setError(null);
    updateTask(id, data).catch((e) => setError(ERROR_TASKS_UPDATE + ': ' + e.message));
    // onSnapshot が変更を検知して自動で setTasks するため loadTasks 不要
  };

  const handleDeleteTask = (id) => {
    setError(null);
    deleteTask(id).catch((e) => setError(ERROR_TASKS_DELETE + ': ' + e.message));
    // onSnapshot が変更を検知して自動で setTasks するため loadTasks 不要
  };

  const handleAddList = () => {
    const name = window.prompt(PROMPT_NEW_LIST_NAME);
    if (!name?.trim()) return;
    setError(null);
    addList(name.trim())
      .then((created) => setCurrentListId(created.id))
      .catch((e) => setError(ERROR_LISTS_ADD + ': ' + e.message));
    // onSnapshot が変更を検知して自動で setLists するため loadLists 不要
  };

  const handleDeleteList = () => {
    if (currentListId === defaultListId) {
      window.alert(ALERT_CANNOT_DELETE_DEFAULT_LIST);
      return;
    }
    if (!window.confirm(CONFIRM_DELETE_LIST)) return;
    setError(null);
    const deletedId = currentListId;
    // 楽観的更新: 先にプルダウンと選択を更新し、後で Firestore 削除（onSnapshot の遅延で戻るのを防ぐ）
    deletedListIdsRef.current.add(deletedId);
    setCurrentListId(defaultListId);
    setLists((prev) => prev.filter((l) => l.id !== deletedId));
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_LIST, defaultListId);
    } catch {
      // 保存失敗時は無視
    }
    deleteList(deletedId, defaultListId).catch((e) =>
      setError(ERROR_LISTS_DELETE + ': ' + e.message)
    );
  };

  const counts = computeCounts(tasks);

  return (
    <div className="app-container">
      <h1>ToDoアプリ</h1>
      {error && <p className="app-error">{error}</p>}
      <Counter counts={counts} />
      <ListSelector
        lists={lists}
        currentListId={currentListId}
        defaultListId={defaultListId}
        onSelect={setCurrentListId}
        onAdd={handleAddList}
        onDelete={handleDeleteList}
      />
      <TaskForm onAdd={handleAddTask} disabled={!currentListId} />
      <TaskList
        tasks={tasks}
        currentListId={currentListId}
        onUpdate={handleUpdateTask}
        onDelete={handleDeleteTask}
      />
    </div>
  );
}

export default App;
