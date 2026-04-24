'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { User, Mail, Bell, Shield, Camera, Check, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    notify_email: '',
    email_subscription: false
  });

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        setFormData({
          full_name: data?.full_name || '',
          email: user.email || '',
          notify_email: data?.notify_email || user.email || '',
          email_subscription: data?.email_subscription || false
        });
      }
      setLoading(false);
    }
    getProfile();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setMessage('');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setMessage('錯誤：找不到登入資訊，請重新整理頁面。');
      setUpdating(false);
      return;
    }

    // 改用 upsert：有記錄就更新，沒有就新增
    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        full_name: formData.full_name,
        notify_email: formData.notify_email,
        email_subscription: formData.email_subscription,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });

    setUpdating(false);
    if (!error) {
      setMessage('個人資料已成功更新！');
      setTimeout(() => setMessage(''), 3000);
    } else {
      console.error('Profile update error:', error);
      setMessage(`更新失敗：${error.message}`);
    }
  };

  if (loading) return <div className="auth-container"><Loader2 className="animate-spin" /></div>;


  return (
    <main>
      <Navbar />
      <div className="container" style={{ paddingTop: '3rem', maxWidth: '800px' }}>
        <h1 style={{ marginBottom: '2rem' }}>個人帳戶設定</h1>

        <div className="grid-profile gap-8">
          <section className="card flex flex-col items-center gap-4" style={{ height: 'fit-content' }}>
            <div className="avatar-large">
              <span style={{ fontSize: '3rem' }}>{formData.full_name[0] || 'U'}</span>
              <button className="avatar-edit"><Camera size={16} /></button>
            </div>
            <div style={{ textAlign: 'center' }}>
              <h3>{formData.full_name || '您的姓名'}</h3>
              <p style={{ fontSize: '0.875rem' }}>{formData.email}</p>
            </div>
            <div className="tag authenticated">
              <Shield size={14} /> 訪客會員身份
            </div>
          </section>

          <section className="card flex-1">
            <form onSubmit={handleUpdate} className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <label className="label">帳號名稱</label>
                <div style={{ position: 'relative' }}>
                  <User size={18} className="input-icon" />
                  <input 
                    className="input with-icon" 
                    placeholder="請輸入您的帳號名稱"
                    value={formData.full_name}
                    onChange={e => setFormData({...formData, full_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="label">登入電子郵件</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} className="input-icon" />
                  <input className="input with-icon" value={formData.email || '（訪客帳號，未綁定信箱）'} disabled style={{ opacity: 0.45, cursor: 'not-allowed' }} />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>登入信箱由系統管理，無法直接修改。如需變更，請聯繫管理員。</p>
              </div>

              <div className="flex flex-col gap-2">
                <label className="label">📬 每日報告接收信箱</label>
                <div style={{ position: 'relative' }}>
                  <Bell size={18} className="input-icon" />
                  <input
                    className="input with-icon"
                    type="email"
                    placeholder="請輸入您希望接收每日收盤報告的 Email"
                    value={formData.notify_email}
                    onChange={e => setFormData({...formData, notify_email: e.target.value})}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  每日台股收盤後，系統將自動寄送指數點位與成分股異動報告至此信箱。
                </p>
              </div>

              <div className="dropdown-divider" style={{ margin: '1rem 0' }}></div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="icon-bg"><Bell size={18} color="var(--accent)" /></div>
                  <div>
                    <p style={{ fontWeight: 600, color: 'var(--foreground)', margin: 0 }}>每日收盤郵件通知</p>
                    <p style={{ fontSize: '0.75rem', margin: 0 }}>包含指數點位、漲跌幅與成分股異動</p>
                  </div>
                </div>
                <label className="switch">
                  <input 
                    type="checkbox" 
                    checked={formData.email_subscription}
                    onChange={e => setFormData({...formData, email_subscription: e.target.checked})}
                   />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="flex items-center gap-4" style={{ marginTop: '1.5rem' }}>
                <button type="submit" className="btn" disabled={updating}>
                  {updating ? '更新中...' : '儲存所有變更'}
                </button>
                {message && <span style={{ color: 'var(--accent-secondary)', fontSize: '0.875rem', fontWeight: 600 }} className="flex items-center gap-2"><Check size={16} /> {message}</span>}
              </div>
            </form>
          </section>
        </div>
      </div>

      <style jsx>{`
        .grid-profile { display: grid; grid-template-columns: 240px 1fr; }
        .avatar-large {
          width: 120px;
          height: 120px;
          background: linear-gradient(135deg, var(--accent), #818cf8);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          color: white;
          font-weight: 800;
        }
        .avatar-edit {
          position: absolute;
          bottom: 0;
          right: 0;
          background: #1f2228;
          border: 1px solid var(--panel-border);
          color: white;
          padding: 8px;
          border-radius: 50%;
        }
        .label { font-size: 0.8125rem; font-weight: 600; color: var(--text-muted); }
        .input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); }
        .input.with-icon { padding-left: 40px; }
        .icon-bg { background: rgba(59, 130, 246, 0.1); padding: 10px; border-radius: 10px; }
        .authenticated { background: rgba(59, 130, 246, 0.1); color: var(--accent); gap: 6px; }

        /* Switch Styling */
        .switch { position: relative; display: inline-block; width: 44px; height: 22px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #374151; transition: .4s; }
        .slider:before { position: absolute; content: ""; height: 16px; width: 16px; left: 3px; bottom: 3px; background-color: white; transition: .4s; }
        input:checked + .slider { background-color: var(--accent); }
        input:checked + .slider:before { transform: translateX(22px); }
        .slider.round { border-radius: 34px; }
        .slider.round:before { border-radius: 50%; }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </main>
  );
}
