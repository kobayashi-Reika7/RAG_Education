/**
 * 予約メニュー画面（ログイン後の最初の画面）
 * 「予約する」「予約確認」の2択で迷いを防ぐ。ログアウト可能。
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../components/Breadcrumb';
import { logout } from '../services/auth';
import appHero from '../assets/app-hero.svg';

const MENU_TITLE = 'ご予約メニュー';
const MENU_LEAD = 'かんたん予約、またはご予約内容の確認ができます。';

function MenuPage() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="page page-menu">
      <Breadcrumb
        items={[
          { label: 'Top', to: '/' },
          { label: 'メニュー' },
        ]}
      />

      <header className="menu-header">
        <div className="menu-hero">
          <img src={appHero} alt="" className="menu-hero-img app-hero-img" width="160" height="80" />
        </div>
        <h1 className="page-title menu-title">{MENU_TITLE}</h1>
        <p className="menu-lead">{MENU_LEAD}</p>
      </header>

      <div className="menu-buttons">
        <button
          type="button"
          className="menu-btn menu-btn-primary"
          onClick={() => navigate('/reserve/form')}
        >
          <span className="menu-btn-icon" aria-hidden>📅</span>
          <span className="menu-btn-text">予約する</span>
          <span className="menu-btn-sub">診療科・日時を選んで新規予約</span>
        </button>
        <button
          type="button"
          className="menu-btn menu-btn-secondary"
          onClick={() => navigate('/reservations')}
        >
          <span className="menu-btn-icon" aria-hidden>📋</span>
          <span className="menu-btn-text">予約を確認する</span>
          <span className="menu-btn-sub">ご予約一覧の確認・キャンセル</span>
        </button>
      </div>
      <div className="menu-logout">
        <button type="button" className="btn btn-text" onClick={handleLogout}>
          ログアウト
        </button>
      </div>
    </div>
  );
}

export default MenuPage;
