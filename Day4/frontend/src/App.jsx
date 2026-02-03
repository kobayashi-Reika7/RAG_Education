/**
 * App: 全体の状態保持と Firestore 連携
 * VERIFICATION.md の確認項目（タスク追加・完了・編集・リスト・リロード等）に沿った構成
 */
import React, { useState, useEffect } from 'react';
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
  const [currentListId, setCurrentListId] = useState('');
  const [error, setError] = useState(null);

  const defaultListId = lists.find((l) => l.name === DEFAULT_LIST_NAME)?.id ?? lists[0]?.id ?? '';

  // 初回 + リアルタイム: onSnapshot でリスト・タスクを監視
  // リストを先に反映してからタスクを表示（currentListId 確定でフィルタが正しく動く）
  useEffect(() => {
    setError(null);
    let unsubTasks = null;
    const unsubLists = subscribeLists(
      (listData) => {
        if (!Array.isArray(listData)) listData = [];
        const hasDefaultList = listData.some((l) => l.name === DEFAULT_LIST_NAME);
        if (listData.length === 0 || !hasDefaultList) {
          addList(DEFAULT_LIST_NAME)
            .then((created) => {
              const defaultEntry = { id: created.id, name: created.name };
              const next = listData.length === 0 ? [defaultEntry] : [defaultEntry, ...listData];
              setLists(next);
              setCurrentListId(next[0]?.id ?? '');
              const firstId = next[0]?.id ?? '';
              if (unsubTasks) unsubTasks();
              unsubTasks = subscribeTasks(
                firstId,
                (taskList) => {
                  setError(null);
                  setTasks(sortTasksByCreatedAt(taskList));
                },
                (e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_TASKS_FETCH + ': ' + e.message)
              );
            })
            .catch((e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_LISTS_ADD + ': ' + e.message));
          return;
        }
        setLists(listData);
        const firstId = listData[0]?.id ?? '';
        setCurrentListId((prev) => prev || firstId);
        // リスト確定後にタスク監視を開始（defaultListId を渡して list_id 欠損時を補う）
        if (unsubTasks) unsubTasks();
        unsubTasks = subscribeTasks(
          firstId,
          (taskList) => {
            setError(null);
            setTasks(sortTasksByCreatedAt(taskList));
          },
          (e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_TASKS_FETCH + ': ' + e.message)
        );
      },
      (e) => setError(e?.code === 'permission-denied' ? ERROR_FIRESTORE_RULES : ERROR_LISTS_FETCH + ': ' + e.message)
    );
    return () => {
      unsubLists();
      if (unsubTasks) unsubTasks();
    };
  }, []);

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
    deleteList(currentListId, defaultListId)
      .then(() => setCurrentListId(defaultListId))
      .catch((e) => setError(ERROR_LISTS_DELETE + ': ' + e.message));
    // onSnapshot が変更を検知して自動で setLists / setTasks するため loadLists / loadTasks 不要
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
