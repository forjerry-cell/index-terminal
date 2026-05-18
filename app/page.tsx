'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PerformanceChart from '@/components/PerformanceChart';
import { useSearchParams } from 'next/navigation';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Loader2 } from 'lucide-react';

function DashboardContent() {
  const searchParams = useSearchParams();
  const indexParam = searchParams.get('index');
  
  // 映射短網址參數到資料庫 ID
  const currentIndex = indexParam === 'taiwan' ? 'taiwan_high_beta' 
                     : indexParam === 'nasdaq' ? 'nasdaq_high_beta'
                     : indexParam || 'taiwan_high_beta';
  
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [constituents, setConstituents] = useState<any[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    async function loadDashboardData() {
      setLoading(true);
      // 1. 抓取圖表趨勢數據 (根據當前 INDEX)
      const { data: perf } = await supabase
        .from('index_performance')
        .select('*')
        .eq('index_id', currentIndex)
        .order('date', { ascending: false })
        .limit(3000)
        .neq('date', '1900-01-01'); // 加上這行強制避開快取
      
      if (perf) {
        // perf 為倒序（最新→最舊），取 perf[0] 為最新一筆
        const latest = perf[0];
        // 反轉成正序供圖表使用（最舊→最新）
        setPerformanceData([...perf].reverse());

        if (latest) {
          setSummary([
            {
              id: currentIndex,
              name: currentIndex.includes('taiwan') ? '台股領航強勢指數' : '那指領航強勢指數',
              value: latest.value,
              change: latest.change_percent,
              trend: latest.change_percent >= 0 ? 'up' : 'down',
              latestDate: latest.date,
            }
          ]);

          // --- 動態計算所有統計數據 ---
          const ascendingData = [...perf].reverse();
          const tr = latest.value - 1;
          const days = ascendingData.length;
          const cagr = Math.pow(latest.value, 252 / days) - 1;

          let peak = -Infinity;
          let mdd = 0;
          let returns: number[] = [];
          
          const annualMap: Record<string, { start: number, end: number }> = {};

          ascendingData.forEach((row, idx) => {
            if (row.value > peak) peak = row.value;
            const dd = (peak - row.value) / peak;
            if (dd > mdd) mdd = dd;

            if (idx > 0) {
              const prev = ascendingData[idx - 1];
              const r = (row.value - prev.value) / prev.value;
              returns.push(r);
            }

            const year = row.date.substring(0, 4);
            if (!annualMap[year]) annualMap[year] = { start: row.value, end: row.value };
            else annualMap[year].end = row.value;
          });

          const avgRet = returns.reduce((a, b) => a + b, 0) / returns.length;
          const variance = returns.reduce((a, b) => a + Math.pow(b - avgRet, 2), 0) / returns.length;
          const stdDev = Math.sqrt(variance);
          const sharpe = (avgRet / stdDev) * Math.sqrt(252);

          const annualStats = Object.keys(annualMap).map(year => ({
            year,
            return: (annualMap[year].end / annualMap[year].start) - 1
          })).sort((a, b) => Number(b.year) - Number(a.year)); // 最新年份在最前

          setStats({
            totalReturn: tr,
            cagr: cagr,
            mdd: -mdd,
            sharpe: sharpe,
            annualStats
          });
        }
      } else {
        setSummary([]);
        setPerformanceData([]);
        setConstituents([]);
      }

      // 2. 抓取最新成分股 (根據當前 INDEX)
      const { data: consts } = await supabase
        .from('index_constituents')
        .select('*')
        .eq('index_id', currentIndex)
        .order('date', { ascending: false })
        .order('weight', { ascending: false })
        .limit(100);
      
      if (consts) setConstituents(consts);
      
      setLoading(false);
    }
    loadDashboardData();
  }, [currentIndex]);

  if (loading) return <div className="auth-container"><Loader2 className="animate-spin" /></div>;

  return (
    <main>
      <Navbar forceActive={currentIndex.includes('nasdaq') ? 'nasdaq' : 'taiwan'} />
      
      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}>
        <header className="flex justify-between items-center" style={{ marginBottom: '2.5rem' }}>
          <div>
            <h1 className="animate-fade">數據終端控制台</h1>
            <p className="animate-fade" style={{ animationDelay: '0.1s' }}>掌握獨特創新策略的每日動態與歷史表現。</p>
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
              <PerformanceChart 
                data={performanceData} 
                indexName={currentIndex.includes('taiwan') ? '台股領航強勢指數' : '那指領航強勢指數'}
                benchmarkName={currentIndex.includes('taiwan') ? '台灣加權指數' : '那指100指數'}
              />
              {performanceData.length > 0 && (
                <div className="text-center mt-4" style={{ color: 'var(--accent-secondary)', fontWeight: 600, fontSize: '0.875rem', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                  📡 數據已同步更新至：{performanceData[performanceData.length - 1].date}
                </div>
              )}
            </div>

            {/* 統計數據區塊 (動態計算) */}
            {stats && (
              <div className="card animate-fade" style={{ animationDelay: '0.3s' }}>
                <h3 style={{ marginBottom: '1.5rem' }}>策略績效指標 (回測至今)</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ padding: '1.25rem', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>總報酬率</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stats.totalReturn >= 0 ? 'var(--accent)' : 'var(--error)' }}>
                      {(stats.totalReturn * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>年化報酬率 (CAGR)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stats.cagr >= 0 ? 'var(--accent)' : 'var(--error)' }}>
                      {(stats.cagr * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>最大回撤 (MDD)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--error)' }}>
                      {(stats.mdd * 100).toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ padding: '1.25rem', backgroundColor: 'var(--background)', borderRadius: '12px', border: '1px solid var(--panel-border)' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>夏普值 (Sharpe)</div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--foreground)' }}>
                      {stats.sharpe.toFixed(2)}
                    </div>
                  </div>
                </div>

                <h4 style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-muted)' }}>各年度表現</h4>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  {stats.annualStats.map((yr: any) => (
                    <div key={yr.year} style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--background)', borderRadius: '8px', border: '1px solid var(--panel-border)', minWidth: '80px', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{yr.year}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: yr.return >= 0 ? 'var(--accent)' : 'var(--error)', marginTop: '2px' }}>
                        {(yr.return * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="card">
            <h3>即時成分股權重 (全部)</h3>
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
                        {(item.weight).toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* AlphaFalcon AI 量化選股預覽區塊 */}
        <section style={{ marginTop: '3rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(0, 242, 254, 0.04) 0%, rgba(168, 85, 247, 0.04) 50%, rgba(17, 19, 23, 0.9) 100%)',
            border: '1px solid rgba(0, 242, 254, 0.15)',
            borderRadius: '16px',
            padding: '2.5rem',
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* 背景光暈裝飾 */}
            <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '240px', height: '240px', background: 'radial-gradient(circle, rgba(0, 242, 254, 0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: '-40px', left: '30%', width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(168, 85, 247, 0.05) 0%, transparent 70%)', pointerEvents: 'none' }} />
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem', position: 'relative', zIndex: 1 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.75rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#00F2FE', boxShadow: '0 0 8px rgba(0,242,254,0.6)', animation: 'pulse 2s ease-in-out infinite' }} />
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#00F2FE', letterSpacing: '0.1em' }}>ALPHAFALCON QUANT ENGINE · AI POWERED</span>
                </div>
                <h2 style={{ fontSize: '1.625rem', fontWeight: 800, color: '#f9fafb', margin: 0, marginBottom: '0.5rem' }}>
                  飆股預測雷達
                </h2>
                <p style={{ color: '#9ca3af', maxWidth: '480px', margin: 0 }}>
                  結合投信鎖碼、VCP波動收縮突破與機器學習三重障礙法（RF · AUC 0.78），每日盤後自動掃描全市場，計算個股未來 6 個月上漲 50% 的量化機率。
                </p>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                  {[
                    { label: '風控停損', value: '-15%', color: '#f43f5e' },
                    { label: '目標報酬', value: '+50%', color: '#10b981' },
                    { label: '預測窗口', value: '6 個月', color: '#a855f7' },
                    { label: '模型精度', value: 'AUC 0.78', color: '#00F2FE' }
                  ].map(item => (
                    <div key={item.label} style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{item.label}：</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: item.color }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <a href="/alphafalcon" style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '0.875rem 1.75rem',
                background: 'linear-gradient(135deg, rgba(0,242,254,0.15) 0%, rgba(168,85,247,0.15) 100%)',
                border: '1px solid rgba(0,242,254,0.3)',
                borderRadius: '12px', color: '#00F2FE', fontWeight: 700,
                fontSize: '0.9375rem', textDecoration: 'none',
                transition: 'all 0.2s ease', whiteSpace: 'nowrap'
              }}>
                <TrendingUp size={18} />
                進入 AI 預測終端
              </a>
            </div>
          </div>
        </section>
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
