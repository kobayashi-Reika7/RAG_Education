/**
 * ルーティング管理と認証状態
 * 未ログイン時は /login へリダイレクト。認証状態は Context で共有
 */
import React, { useState, useEffect, createContext, useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { subscribeAuth } from './services/auth';
import TopPage from './pages/TopPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import MenuPage from './pages/MenuPage';
import CalendarPage from './pages/CalendarPage';
import ReservationFormPage from './pages/ReservationFormPage';
import ReserveConfirmPage from './pages/ReserveConfirmPage';
import MyReservationsPage from './pages/MyReservationsPage';

const AuthContext = createContext(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  return ctx ?? null;
}

/**
 * ログイン必須のルート。未ログインなら /login へリダイレクト
 */
function ProtectedRoute({ children }) {
  const user = useAuth();
  const location = useLocation();
  if (user === undefined) {
    return <div className="app-loading">読み込み中…</div>;
  }
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/menu"
        element={
          <ProtectedRoute>
            <MenuPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reserve/form"
        element={
          <ProtectedRoute>
            <ReservationFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reserve/confirm"
        element={
          <ProtectedRoute>
            <ReserveConfirmPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reservations"
        element={
          <ProtectedRoute>
            <MyReservationsPage />
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<TopPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = subscribeAuth((u) => setUser(u ?? null));
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={user}>
      <BrowserRouter>
        <div className="app">
          <AppRoutes />
        </div>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
