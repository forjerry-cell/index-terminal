'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Upload, Loader2, AlertCircle } from 'lucide-react';

interface ScrapedData {
  strategyName: string; // 策略名稱
  displayName: string;  // 顯示名稱
  product: string;      // 策略商品
  position: number;     // 目前部位
  price: string;        // 訊號價格
  triggerTime: string;  // 觸發時間
}

export default function SystemManagementPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [detailData, setDetailData] = useState<ScrapedData[]>([]);
  const [summaryData, setSummaryData] = useState<{ product: string; totalPosition: number }[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  
  const fetchData = async (displayNames: string[]) => {
    if (!displayNames || displayNames.length === 0) return;
    
    setUploading(true);
    try {
      const response = await fetch('/api/admin-crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayNames })
      });
      
      const result = await response.json();
      
      if (result.success) {
        const data: ScrapedData[] = result.data;
        setDetailData(data);
        
        // 計算彙總資料
        const summaryMap: Record<string, number> = {};
        data.forEach(item => {
          if (!summaryMap[item.product]) summaryMap[item.product] = 0;
          summaryMap[item.product] += Number(item.position);
        });
        
        const summaryArray = Object.keys(summaryMap).map(key => ({
          product: key,
          totalPosition: summaryMap[key]
        }));
        setSummaryData(summaryArray);
        setLastUpdated(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    async function init() {
      // 1. 驗證權限
      const { data: { user } } = await supabase.auth.getUser();
      if (user && user.email === 'forjerry@gmail.com') {
        setIsAdmin(true);
        
        // 2. 嘗試從 localStorage 讀取先前上傳的名單
        const savedNames = localStorage.getItem('system_display_names');
        if (savedNames) {
          try {
            const names = JSON.parse(savedNames);
            if (Array.isArray(names) && names.length > 0) {
              fetchData(names);
            }
          } catch (e) {
            console.error('Failed to parse saved names');
          }
        }
      }
      setLoading(false);
    }
    init();

    // 3. 設定每 5 分鐘自動刷新
    const interval = setInterval(() => {
      const savedNames = localStorage.getItem('system_display_names');
      if (savedNames) {
        try {
          const names = JSON.parse(savedNames);
          if (Array.isArray(names) && names.length > 0) {
            fetchData(names);
          }
        } catch (e) {}
      }
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const displayNames = content.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'));
      
      if (displayNames.length > 0) {
        // 儲存到 localStorage
        localStorage.setItem('system_display_names', JSON.stringify(displayNames));
        // 立即抓取一次
        fetchData(displayNames);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  if (loading) {
    return <div className="auth-container"><Loader2 className="animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <main>
        <Navbar />
        <div className="container flex items-center justify-center" style={{ minHeight: '80vh' }}>
          <div className="card text-center flex-col items-center gap-4">
            <AlertCircle size={48} color="var(--error)" />
            <h2 style={{ marginTop: '1rem' }}>權限不足</h2>
            <p>本功能僅系統管理員可以使用。</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <Navbar />
      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}>
        <header className="flex justify-between items-center" style={{ marginBottom: '2.5rem' }}>
          <div>
            <h1 className="animate-fade">系統管理與部位分析</h1>
            <div className="flex items-center gap-4 animate-fade" style={{ animationDelay: '0.1s' }}>
              <p>自動爬取策略部位狀態並進行彙總統計</p>
              {lastUpdated && (
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--glass)', padding: '2px 8px', borderRadius: '4px' }}>
                  最後更新: {lastUpdated} (每 5 分鐘自動刷新)
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-4">
            <label className="btn flex items-center gap-2" style={{ cursor: 'pointer' }}>
              {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {uploading ? '爬取中...' : '上傳名單 (.txt)'}
              <input type="file" accept=".txt" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>
        </header>

        {detailData.length > 0 && (
          <div className="flex flex-col gap-8 animate-fade">
            
            {/* 彙總表格 */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>策略商品部位總計</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '400px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>策略商品</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>合計部位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontWeight: 500 }}>{row.product}</td>
                        <td style={{ padding: '12px', fontWeight: 700, color: row.totalPosition > 0 ? 'var(--accent-secondary)' : row.totalPosition < 0 ? 'var(--error)' : 'var(--foreground)' }}>
                          {row.totalPosition}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 明細表格 */}
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>部位明細資料</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>策略名稱</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>策略商品</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>目前部位</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>訊號價格</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>觸發時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent)' }}>{row.strategyName}</td>
                        <td style={{ padding: '12px' }}>{row.product}</td>
                        <td style={{ padding: '12px', fontWeight: 600, color: row.position > 0 ? 'var(--accent-secondary)' : row.position < 0 ? 'var(--error)' : 'var(--foreground)' }}>
                          {row.position}
                        </td>
                        <td style={{ padding: '12px' }}>{row.price}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{row.triggerTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  );
}
