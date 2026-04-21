'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Lock, Mail, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError('帳號或密碼錯誤，請聯繫管理員。');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card animate-fade">
        <div className="flex flex-col items-center gap-4" style={{ marginBottom: '2rem' }}>
          <div style={{ backgroundColor: 'var(--accent)', padding: '1rem', borderRadius: '50%' }}>
            <Lock size={24} color="white" />
          </div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>會員登入</h1>
          <p style={{ fontSize: '0.875rem', textAlign: 'center' }}>
            這是封閉式系統，若無帳號請聯繫管理員。
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4">
            <div style={{ position: 'relative' }}>
              <Mail size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="email"
                placeholder="電子郵件"
                className="input"
                style={{ paddingLeft: '40px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div style={{ position: 'relative' }}>
              <Lock size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="password"
                placeholder="密碼"
                className="input"
                style={{ paddingLeft: '40px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && <p style={{ color: 'var(--error)', fontSize: '0.875rem' }}>{error}</p>}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                '立即進入終端'
              )}
            </button>
            <button 
              type="button" 
              className="btn" 
              style={{ border: '1px solid var(--accent)' }}
              disabled={loading}
              onClick={async () => {
                setLoading(true);
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) {
                  alert('申請失敗: ' + error.message);
                } else {
                  // 自動執行開通權限 API
                  await fetch('/api/setup-admin');
                  alert('帳號申請成功並已開通管理員權限！請直接點擊登入。');
                }
                setLoading(false);
              }}
            >
              申請帳號
            </button>
          </div>
        </form>
      </div>

      <style jsx global>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
