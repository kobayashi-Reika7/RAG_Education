/**
 * App: Firestore を唯一のデータソースとする ToDo
 * 変更理由: useState だけで完結させず、useEffect で getTasks() を1回だけ実行し取得データを state に反映。
 * タスク追加・更新・削除時は Firestore に保存してから getTasks() で再取得し state を更新。
 * ダミーデータ・初期配列の push のみの処理は削除。React は「表示と操作」のみ担当。
 */
import React, { useState, useEffect } from 'react';

const STORAGE_KEY_CURRENT_LIST = 'day4_currentListId';
import {
  getLists,
  getTasks,
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
  const [listsLoaded, setListsLoaded] = useState(false);

  const defaultListId = lists.find((l) => l.name === DEFAULT_LIST_NAME)?.id ?? lists[0]?.id ?? '';
  const listId = currentListId || defaultListId;
  const isLoading = !listsLoaded || lists.length === 0;

  useEffect(() => {
    if (!currentListId) return;
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_LIST, currentListId);
    } catch {}
  }, [currentListId]);

  useEffect(() => {
    const onStorage = (e) => {
      if (e.key !== STORAGE_KEY_CURRENT_LIST || e.newValue == null) return;
      setCurrentListId(e.newValue);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // リストを1回だけ Firestore から取得（唯一のデータソース。依存 [] で二重読込防止）
  useEffect(() => {
    setError(null);
    getLists()
      .then((listData) => {
        if (!Array.isArray(listData)) return [];
        if (listData.length === 0) {
          return addList(DEFAULT_LIST_NAME).then(() => getLists());
        }
        return listData;
      })
      .then((listData) => {
        if (!listData || listData.length === 0) return;
        setLists(listData);
        const firstId = listData[0]?.id ?? '';
        const savedId = (() => {
          try {
            return localStorage.getItem(STORAGE_KEY_CURRENT_LIST) || '';
          } catch {
            return '';
          }
        })();
        const savedStillExists = savedId && listData.some((l) => l.id === savedId);
        setCurrentListId(savedStillExists ? savedId : firstId);
      })
      .then(() => setListsLoaded(true))
      .catch((e) => {
        setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_LISTS_FETCH + ': ' + e.message);
        setListsLoaded(true);
      });
  }, []);

  // タスクを listId が決まったとき1回だけ Firestore から取得（二重読込防止: 依存は listId のみ）
  useEffect(() => {
    if (!listId) return;
    setError(null);
    getTasks(listId)
      .then((taskList) => setTasks(sortTasksByCreatedAt(taskList)))
      .catch((e) => {
        setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_TASKS_FETCH + ': ' + e.message);
      });
  }, [listId]);

  const refreshTasks = () => {
    if (!listId) return;
    getTasks(listId)
      .then((taskList) => setTasks(sortTasksByCreatedAt(taskList)))
      .catch((e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_TASKS_FETCH + ': ' + e.message));
  };

  const handleAddTask = (title) => {
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
    })
      .then(() => refreshTasks())
      .catch((e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_TASKS_ADD + ': ' + e.message));
  };

  const handleUpdateTask = (id, data) => {
    setError(null);
    updateTask(id, data)
      .then(() => refreshTasks())
      .catch((e) => setError(ERROR_TASKS_UPDATE + ': ' + e.message));
  };

  const handleDeleteTask = (id) => {
    setError(null);
    deleteTask(id)
      .then(() => refreshTasks())
      .catch((e) => setError(ERROR_TASKS_DELETE + ': ' + e.message));
  };

  const handleAddList = () => {
    const name = window.prompt(PROMPT_NEW_LIST_NAME);
    if (!name?.trim()) return;
    setError(null);
    addList(name.trim())
      .then((created) => {
        setCurrentListId(created.id);
        return getLists().then(setLists);
      })
      .catch((e) => setError(ERROR_LISTS_ADD + ': ' + e.message));
  };

  const handleDeleteList = () => {
    if (currentListId === defaultListId) {
      window.alert(ALERT_CANNOT_DELETE_DEFAULT_LIST);
      return;
    }
    if (!window.confirm(CONFIRM_DELETE_LIST)) return;
    setError(null);
    const prevDefaultId = defaultListId;
    setCurrentListId(prevDefaultId);
    try {
      localStorage.setItem(STORAGE_KEY_CURRENT_LIST, prevDefaultId);
    } catch {}
    deleteList(currentListId, prevDefaultId)
      .then(() => getLists().then(setLists))
      .catch((e) => setError(ERROR_LISTS_DELETE + ': ' + e.message));
  };

  const counts = computeCounts(tasks);

  if (isLoading) {
    return (
      <div className="app-container">
        <h1>ToDoアプリ</h1>
        {error && <p className="app-error">{error}</p>}
        <p className="app-loading">読み込み中…</p>
      </div>
    );
  }

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
