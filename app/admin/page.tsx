'use client';

import { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import DataUploader from '@/components/DataUploader';
import { UserPlus, Power, Activity, History, ShieldCheck, Mail, User, Database } from 'lucide-react';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);

  useEffect(() => {
    // 預留連接 Supabase 邏輯
    setUsers([
      { id: '1', full_name: '訪客 A', email: 'visitor_a@gmail.com', status: 'online', last_login: '10 分鐘前' }
    ]);
  }, []);

  return (
    <main>
      <Navbar />
      <div className="container" style={{ paddingTop: '2.5rem' }}>
        <header className="flex items-center gap-4" style={{ marginBottom: '2rem' }}>
          <ShieldCheck size={32} color="var(--accent)" />
          <div>
            <h1 style={{ marginBottom: 0 }}>系統管理中心</h1>
            <p>管理訪客權限與監控系統日誌</p>
          </div>
        </header>

        <div className="grid-admin gap-8">
          <aside className="flex flex-col gap-2">
            <button className={`nav-btn ${activeTab === 'users' ? 'active' : ''}`} onClick={() => setActiveTab('users')}>
              <User size={18} /> 用戶管理
            </button>
            <button className={`nav-btn ${activeTab === 'data' ? 'active' : ''}`} onClick={() => setActiveTab('data')}>
              <Database size={18} /> 數據維護
            </button>
            <button className={`nav-btn ${activeTab === 'logs' ? 'active' : ''}`} onClick={() => setActiveTab('logs')}>
              <History size={18} /> 登入歷史
            </button>
            <button className={`nav-btn ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>
              <UserPlus size={18} /> 創建帳號
            </button>
          </aside>

          <section className="admin-content">
            {activeTab === 'users' && (
              <div className="card animate-fade">
                <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem' }}>
                  <h3>目前用戶列表</h3>
                </div>
                <div className="table-container">
                  <table>
                    <thead><tr><th>使用者</th><th>狀態</th><th>最近活動</th><th style={{ textAlign: 'right' }}>操作</th></tr></thead>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id}>
                          <td>{u.full_name} ({u.email})</td>
                          <td><span className={`status-dot ${u.status === 'online' ? 'active' : ''}`}></span>{u.status === 'online' ? '在線' : '離線'}</td>
                          <td>{u.last_login}</td>
                          <td style={{ textAlign: 'right' }}><button className="btn-icon"><Power size={16} /> 強制登出</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'data' && (
              <div className="animate-fade">
                <DataUploader />
              </div>
            )}

            {/* 其他標籤頁內容... */}
            {activeTab === 'create' && (
              <div className="card animate-fade" style={{ maxWidth: '500px' }}>
                <h3>手動核發訪客權限</h3>
                <form className="flex flex-col gap-4">
                   <input className="input" placeholder="訪客姓名" />
                   <input className="input" type="email" placeholder="電子郵件" />
                   <input className="input" type="password" placeholder="初始密碼" />
                   <button type="submit" className="btn">確認建立</button>
                </form>
              </div>
            )}
            
            {activeTab === 'logs' && (
              <div className="card animate-fade">
                <h3>訪客登入 Log 回溯</h3>
                <div className="table-container">
                  <table>
                    <thead><tr><th>時間</th><th>使用者</th><th>動作</th></tr></thead>
                    <tbody>
                      <tr><td>2026/04/21 14:12</td><td>visitor_a@gmail.com</td><td><span className="log-tag">LOGIN</span></td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        .grid-admin { display: grid; grid-template-columns: 240px 1fr; }
        .nav-btn { display: flex; align-items: center; gap: 12px; width: 100%; padding: 1rem; background: none; color: var(--text-muted); border-radius: 8px; font-weight: 500; text-align: left; }
        .nav-btn.active { background: var(--accent); color: white; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 1rem; font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--panel-border); }
        td { padding: 1.25rem 1rem; border-bottom: 1px solid var(--panel-border); }
        .status-dot { width: 8px; height: 8px; border-radius: 50%; background: #4b5563; display: inline-block; margin-right: 8px; }
        .status-dot.active { background: var(--accent-secondary); box-shadow: 0 0 8px var(--accent-secondary); }
        .btn-icon { background: rgba(239, 68, 68, 0.1); color: var(--error); padding: 6px 12px; border-radius: 6px; font-weight: 600; }
        .log-tag { background: var(--glass); border: 1px solid var(--glass-border); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; }
      `}</style>
    </main>
  );
}
