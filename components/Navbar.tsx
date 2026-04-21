'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, LogOut, Settings, LayoutDashboard, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [profile, setProfile] = useState<any>(null);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setProfile(data || user);
      }
    }
    loadProfile();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  return (
    <nav className="navbar">
      <div className="container flex items-center justify-between" style={{ height: '70px' }}>
        <div className="flex items-center gap-8">
          <div className="logo">
            <span style={{ color: 'var(--accent)', fontWeight: 800, fontSize: '1.25rem' }}>BETA</span>
            <span style={{ fontWeight: 400, marginLeft: '4px' }}>TERMINAL</span>
          </div>
          <div className="flex gap-4 nav-links">
            <a href="#" className="active">市場概覽</a>
            <a href="#">台股 High Beta</a>
            <a href="#">那指 High Beta</a>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {profile?.is_admin && (
            <button className="btn-secondary btn-sm" onClick={() => router.push('/admin')}>
              <LayoutDashboard size={16} style={{ marginRight: '8px' }} />
              管理後台
            </button>
          )}
          
          <div style={{ position: 'relative' }}>
            <button className="avatar-btn" onClick={() => setShowMenu(!showMenu)}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="avatar-img" />
              ) : (
                <div className="avatar-placeholder">{profile?.full_name?.[0] || 'U'}</div>
              )}
              <ChevronDown size={14} color="var(--text-muted)" />
            </button>

            {showMenu && (
              <div className="profile-dropdown animate-fade">
                <div className="dropdown-header">
                  <p className="user-name">{profile?.full_name || '使用者'}</p>
                  <p className="user-email">{profile?.email || 'authenticated'}</p>
                </div>
                <div className="dropdown-divider"></div>
                <button onClick={() => router.push('/profile')} className="dropdown-item">
                  <Settings size={16} /> 個人設定
                </button>
                <button onClick={handleLogout} className="dropdown-item" style={{ color: 'var(--error)' }}>
                  <LogOut size={16} /> 強制登出
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .navbar {
          background: rgba(10, 11, 13, 0.8);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--panel-border);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        .nav-links a {
          font-size: 0.9375rem;
          color: var(--text-muted);
          font-weight: 500;
        }
        .nav-links a.active {
          color: var(--foreground);
          border-bottom: 2px solid var(--accent);
          padding-bottom: 4px;
        }
        .avatar-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: var(--glass);
          padding: 4px 8px 4px 4px;
          border-radius: 30px;
          border: 1px solid var(--glass-border);
        }
        .avatar-placeholder {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, var(--accent), #818cf8);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          color: white;
        }
        .avatar-img {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
        }
        .profile-dropdown {
          position: absolute;
          right: 0;
          top: calc(100% + 12px);
          width: 240px;
          background: #16181b;
          border: 1px solid var(--panel-border);
          border-radius: 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          overflow: hidden;
        }
        .dropdown-header { padding: 1rem; }
        .user-name { font-weight: 600; margin: 0; }
        .user-email { font-size: 0.75rem; color: var(--text-muted); margin: 0; }
        .dropdown-divider { height: 1px; background: var(--panel-border); }
        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 0.75rem 1rem;
          background: none;
          color: var(--foreground);
          font-size: 0.875rem;
          text-align: left;
        }
        .dropdown-item:hover { background: var(--glass); }
        .btn-sm { padding: 0.5rem 1rem; font-size: 0.8125rem; }
      `}</style>
    </nav>
  );
}
