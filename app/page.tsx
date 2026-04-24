'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PerformanceChart from '@/components/PerformanceChart';
import { useSearchParams } from 'next/navigation';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';

function DashboardContent() {
  const searchParams = useSearchParams();
  const currentIndex = searchParams.get('index') || 'taiwan_high_beta';
  
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [constituents, setConstituents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      // 1. 抓取圖表趨勢數據 (根據當前 INDEX)
      const { data: perf } = await supabase
        .from('index_performance')
        .select('*')
        .eq('index_id', currentIndex)
        .order('date', { ascending: false }) // 改為倒序，先抓最新的
        .limit(1000);
      
      if (perf) {
        // 將資料反轉回來，讓圖表能正常從左往右畫
        setPerformanceData([...perf].reverse());
      }

      // 2. 抓取最新成分股 (根據當前 INDEX)
      const { data: consts } = await supabase
        .from('index_constituents')
        .select('*')
        .eq('index_id', currentIndex)
        .order('date', { ascending: false })
        .order('weight', { ascending: false })
        .limit(5);
      
      if (consts) setConstituents(consts);

      // 3. 計算摘要數據
      if (perf && perf.length > 0) {
        const latest = perf[perf.length - 1];
        setSummary([
          { 
            id: currentIndex, 
            name: currentIndex.includes('taiwan') ? '台股 High Beta' : '那指 High Beta', 
            value: latest.value, 
            change: latest.change_percent, 
            trend: latest.change_percent >= 0 ? 'up' : 'down' 
          }
        ]);
      } else {
        setSummary([]);
        setPerformanceData([]);
        setConstituents([]);
      }
      
      setLoading(false);
    }
    loadDashboardData();
  }, [currentIndex]);

  if (loading) return <div className="auth-container"><Loader2 className="animate-spin" /></div>;

  return (
    <main>
      <Navbar />
      
      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}>
        <header className="flex justify-between items-center" style={{ marginBottom: '2.5rem' }}>
          <div>
            <h1 className="animate-fade">數據終端控制台</h1>
            <p className="animate-fade" style={{ animationDelay: '0.1s' }}>掌握 High Beta 策略的每日動態與歷史表現。</p>
          </div>
          <div className="flex gap-4">
            <button className="btn">上傳全成分股 CSV</button>
          </div>
        </header>

        {/* 摘要卡片區 */}
        <section className="grid-3 gap-8" style={{ marginBottom: '3rem' }}>
          {summary.length > 0 ? summary.map((idx, i) => (
            <div key={idx.id} className="card animate-fade">
              <div className="flex justify-between items-center">
                <p style={{ fontWeight: 600, color: 'var(--foreground)' }}>{idx.name}</p>
                <div className={`tag ${idx.trend}`}>
                  {idx.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(idx.change)}%
                </div>
              </div>
              <p style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--foreground)', marginTop: '0.5rem' }}>
                {idx.value.toLocaleString()}
              </p>
            </div>
          )) : (
            <div className="card">尚未上傳今日數據</div>
          )}
          
          <div className="card" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #111317 100%)' }}>
            <p style={{ fontWeight: 600, color: 'var(--foreground)' }}>系統鏈結狀態</p>
            <div className="flex items-center gap-4" style={{ marginTop: '1rem' }}>
              <div style={{ padding: '8px', background: 'rgba(16, 185, 129, 0.2)', borderRadius: '8px' }}>
                <TrendingUp size={20} color="var(--accent-secondary)" />
              </div>
              <div>
                <p style={{ color: 'var(--foreground)', fontWeight: 600 }}>數據雲端同步中</p>
                <p style={{ fontSize: '0.75rem' }}>自動化每日收盤排程已啟動</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid-2 gap-8">
          <section className="flex flex-col gap-8">
            <div className="card" style={{ minHeight: '450px' }}>
              <h3>指數與基準回測對比圖</h3>
              <PerformanceChart data={performanceData} />
              {performanceData.length > 0 && (
                <div className="text-center mt-4" style={{ color: 'var(--accent-secondary)', fontWeight: 600, fontSize: '0.875rem', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                  📡 數據已同步更新至：{performanceData[performanceData.length - 1].date}
                </div>
              )}
            </div>
          </section>

          <section className="card">
            <h3>即時成分股權重 (Top 5)</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>名稱 / 代號</th>
                    <th style={{ textAlign: 'right' }}>權重 (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {constituents.map(item => (
                    <tr key={item.symbol}>
                      <td>
                        <div className="flex flex-col">
                          <span style={{ color: 'var(--foreground)', fontWeight: 500 }}>{item.name}</span>
                          <span style={{ fontSize: '0.75rem' }}>{item.symbol}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--foreground)', fontSize: '1.125rem' }}>
                        {item.weight}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button className="btn-secondary" style={{ width: '100%', marginTop: '1.5rem' }}>查看歷史權重異動</button>
          </section>
        </div>
      </div>

      <style jsx>{`
        .grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); }
        .grid-2 { display: grid; grid-template-columns: 2fr 1fr; }
        .tag { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.8125rem; }
        .tag.up { background: rgba(16, 185, 129, 0.2); color: var(--accent-secondary); }
        .tag.down { background: rgba(239, 68, 68, 0.2); color: var(--error); }
        .table-container { margin-top: 1.5rem; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--panel-border); }
        td { padding: 1.25rem 0.75rem; border-bottom: 1px solid var(--panel-border); }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 1s linear infinite; }
      `}</style>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="auth-container"><Loader2 className="animate-spin" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
