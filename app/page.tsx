'use client';

import { useState, useEffect, Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import PerformanceChart from '@/components/PerformanceChart';
import { useSearchParams } from 'next/navigation';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Loader2, ShieldCheck, Flame, Layers } from 'lucide-react';

function DashboardContent() {
  const searchParams = useSearchParams();
  const indexParam = searchParams.get('index');
  
  // 映射短網址參數到資料庫 ID
  const currentIndex = indexParam === 'taiwan' ? 'taiwan_high_beta' 
                     : indexParam === 'nasdaq' ? 'nasdaq_high_beta'
                     : indexParam || 'taiwan_high_beta';
  
  const isNasdaq = currentIndex.includes('nasdaq');
  const indexName = isNasdaq ? '那指領航強勢指數' : '台股領航強勢指數';
  const benchmarkName = isNasdaq ? '那斯達克 100 指數' : '台灣加權指數';
  const benchmarkShortName = isNasdaq ? '那指 100' : '加權指數';

  const indexDesc = isNasdaq 
    ? '以美國那斯達克 100 指數 (Nasdaq 100) 成分股為母體，每季回顧科技權值股過去一年相對於 QQQ 的波動彈性（Beta），精選爆發力最強的前 30 檔科技巨頭與高成長先鋒，並嚴格執行單一持股 10% 上限。在美股科技長牛格局中極大化超額成長回報。'
    : '以台灣上市櫃權值主流股為母體，每季回顧過去一年日報酬波動（Beta），精選全市場相對於大盤進攻動能最強的前 50 檔成分股，採 Beta 加權並配置個股 30% 與半導體產業 60% 權重上限。專為捕捉台股多頭主升段高彈性 Alpha 設計。';

  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [constituents, setConstituents] = useState<any[]>([]);
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
        .neq('date', '1900-01-01');
      
      if (perf && perf.length > 0) {
        const latest = perf[0];
        const ascendingData = [...perf].reverse();
        setPerformanceData(ascendingData);

        // --- 動態計算所有統計數據 ---
        const tr = latest.value - 1;
        const days = ascendingData.length;
        const cagr = Math.pow(latest.value, 252 / days) - 1;

        // 基準回報與 CAGR
        const oldest = ascendingData[0];
        const bmLatest = latest.benchmark_value || 1.0;
        const bmOldest = oldest ? (oldest.benchmark_value || 1.0) : 1.0;
        const trBM = bmOldest > 0 ? (bmLatest / bmOldest - 1) : 0;
        const cagrBM = bmOldest > 0 ? (Math.pow(bmLatest / bmOldest, 252 / days) - 1) : 0;

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
        })).sort((a, b) => Number(b.year) - Number(a.year));

        setStats({
          latestValue: latest.value,
          latestChange: latest.change_percent,
          latestDate: latest.date,
          startDate: oldest ? oldest.date : '起點',
          totalReturn: tr,
          totalReturnBM: trBM,
          cagr: cagr,
          cagrBM: cagrBM,
          mdd: -mdd,
          sharpe: sharpe,
          annualStats
        });
      } else {
        setPerformanceData([]);
        setStats(null);
      }

      // 2. 抓取最新成分股 (根據當前 INDEX 且只拿最新一天的資料)
      const { data: latestDateRow } = await supabase
        .from('index_constituents')
        .select('date')
        .eq('index_id', currentIndex)
        .order('date', { ascending: false })
        .limit(1);

      if (latestDateRow && latestDateRow.length > 0) {
        const { data: consts } = await supabase
          .from('index_constituents')
          .select('*')
          .eq('index_id', currentIndex)
          .eq('date', latestDateRow[0].date)
          .order('weight', { ascending: false });
        
        if (consts) setConstituents(consts);
      } else {
        setConstituents([]);
      }
      
      setLoading(false);
    }
    loadDashboardData();
  }, [currentIndex, isNasdaq]);

  if (loading) return <div className="auth-container"><Loader2 className="animate-spin" /></div>;

  return (
    <main>
      <Navbar forceActive={isNasdaq ? 'nasdaq' : 'taiwan'} />
      
      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}>
        {/* 標頭介紹 (比照台股強勢動能指數) */}
        <header className="flex justify-between items-center" style={{ marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span className="tag" style={{
                background: isNasdaq ? 'rgba(6, 182, 212, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                color: isNasdaq ? '#22d3ee' : '#818cf8',
                border: isNasdaq ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(99, 102, 241, 0.3)'
              }}>
                <Flame size={14} /> {isNasdaq ? '那指科技先鋒板塊 · 30 檔旗艦' : '核心權值高彈性板塊 · 50 檔旗艦'}
              </span>
              <span className="tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-secondary)' }}>
                <ShieldCheck size={14} /> {isNasdaq ? '科技長牛成長 · 每季定期調整' : '經典 Buy & Hold · 每季定期調整'}
              </span>
            </div>
            <h1 className="animate-fade">{indexName}</h1>
            <p className="animate-fade" style={{ animationDelay: '0.1s', color: 'var(--text-muted)', maxWidth: '750px', fontSize: '0.9375rem', marginTop: '0.35rem' }}>
              {indexDesc}
            </p>
          </div>
        </header>

        {/* 頂部四張關鍵指標卡片 */}
        {stats && (
          <section className="grid-4 gap-6" style={{ marginBottom: '2.5rem' }}>
            <div className="card animate-fade">
              <div className="flex justify-between items-center">
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>最新累積淨值</span>
                <div className={`tag ${stats.latestChange >= 0 ? 'up' : 'down'}`}>
                  {stats.latestChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                  {Math.abs(stats.latestChange)}%
                </div>
              </div>
              <div style={{ fontSize: '2.25rem', fontWeight: 800, color: isNasdaq ? '#22d3ee' : '#818cf8', marginTop: '0.5rem' }}>
                {stats.latestValue.toFixed(2)}x
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                起點 {stats.startDate} = 1.00x
              </p>
            </div>

            <div className="card animate-fade" style={{ animationDelay: '0.05s' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>累積總報酬率</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)', marginTop: '0.5rem' }}>
                +{(stats.totalReturn * 100).toFixed(1)}%
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                基準 ({benchmarkShortName})：+{(stats.totalReturnBM * 100).toFixed(1)}%
              </p>
            </div>

            <div className="card animate-fade" style={{ animationDelay: '0.1s' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>年化複合成長率 (CAGR)</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.5rem' }}>
                {(stats.cagr * 100).toFixed(2)}%
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                基準 ({benchmarkShortName})：{(stats.cagrBM * 100).toFixed(2)}%
              </p>
            </div>

            <div className="card animate-fade" style={{ animationDelay: '0.15s' }}>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>風險風報比 (MDD / Sharpe)</span>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--foreground)', marginTop: '0.5rem' }}>
                {(stats.mdd * 100).toFixed(1)}%
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--accent-secondary)', marginTop: '0.25rem' }}>
                夏普比率 Sharpe: {stats.sharpe.toFixed(2)}
              </p>
            </div>
          </section>
        )}

        {/* 策略核心邏輯說明條 */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{
            background: isNasdaq
              ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(99, 102, 241, 0.04) 100%)'
              : 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(59, 130, 246, 0.04) 100%)',
            border: isNasdaq
              ? '1px solid rgba(6, 182, 212, 0.25)'
              : '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '14px',
            padding: '1.5rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{
                padding: '12px',
                background: isNasdaq ? 'rgba(6, 182, 212, 0.2)' : 'rgba(99, 102, 241, 0.2)',
                borderRadius: '10px',
                color: isNasdaq ? '#22d3ee' : '#818cf8'
              }}>
                <Layers size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--foreground)', fontWeight: 700 }}>
                  {isNasdaq ? '那指科技先鋒篩選機制 (Nasdaq Top 30 High Beta)' : '高波動進攻加權機制 (High Beta Weighting 50)'}
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem', maxWidth: '800px' }}>
                  {isNasdaq 
                    ? '於每季季末自 Nasdaq 100 成分股中，回溯過去 252 日相對於 QQQ 之 Beta 波動彈性，挑選進攻爆發力最強的前 30 檔科技與新興產業龍頭，採 Beta 加權並限制個股上限 10% 分散單一風險。'
                    : '於每季（1月、4月、7月、10月）首個交易日回溯過去 252 日報酬，依相對加權指數之 Beta 值排序選取前 50 檔，採 Beta 比例加權並嚴格執行單一持股 30% 與半導體 60% 風控上限。'}
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8125rem' }}>
                {isNasdaq ? '成分股規模: 精選科技 30 檔' : '選股機制: 市場 Beta 前 50 檔'}
              </div>
              <div style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8125rem' }}>
                {isNasdaq ? '風控上限: 單一持股 10%' : '再平衡頻率: 每季定審 (1/4/7/10月)'}
              </div>
            </div>
          </div>
        </section>

        {/* 主要圖表與成分股對比 */}
        <div className="grid-2 gap-8">
          <section className="flex flex-col gap-8">
            <div className="card" style={{ minHeight: '450px' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>指數長期走勢多維度對比 (2016 - 至今)</h3>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>支援切換時間區間與基準線</span>
                </div>
              </div>
              <PerformanceChart 
                data={performanceData} 
                indexName={indexName}
                benchmarkName={benchmarkName}
              />
              {performanceData.length > 0 && (
                <div className="text-center mt-4" style={{ color: 'var(--accent-secondary)', fontWeight: 600, fontSize: '0.875rem', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                  📡 數據已同步更新至：{performanceData[performanceData.length - 1].date}
                </div>
              )}
            </div>

            {/* 逐年表現卡片 */}
            {stats && (
              <div className="card animate-fade">
                <h3 style={{ marginBottom: '1.25rem' }}>逐年表現與牛熊市防禦度 (Annual Returns)</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem' }}>
                  {stats.annualStats.map((yr: any) => (
                    <div key={yr.year} style={{ padding: '0.75rem', backgroundColor: 'var(--background)', borderRadius: '10px', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{yr.year}</div>
                      <div style={{ fontWeight: 700, fontSize: '1rem', color: yr.return >= 0 ? (isNasdaq ? '#22d3ee' : '#818cf8') : 'var(--error)', marginTop: '4px' }}>
                        {(yr.return * 100).toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* 即時成分股權重清單 (無卷軸一頁式展開，去除 .TW / .TWO) */}
          <section className="card">
            <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>即時成分股明細</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  依最新審核權重排序 · 滿倉 100.0%
                </p>
              </div>
              <span className="tag" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--foreground)' }}>
                {constituents.length} 檔標的
              </span>
            </div>

            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>名稱 / 代號</th>
                    <th style={{ textAlign: 'right' }}>權重 (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {constituents.map((item, idx) => {
                    const cleanSymbol = String(item.symbol || '').replace(/\.TW|\.TWO/g, '');
                    return (
                      <tr key={item.symbol}>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                          {idx + 1}
                        </td>
                        <td>
                          <div className="flex flex-col">
                            <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{item.name}</span>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cleanSymbol}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: isNasdaq ? '#22d3ee' : '#818cf8', fontSize: '1.0625rem' }}>
                          {(item.weight).toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
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
        .grid-4 { display: grid; grid-template-columns: repeat(4, 1fr); }
        .grid-2 { display: grid; grid-template-columns: 2fr 1.2fr; }
        .tag { display: flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-weight: 600; font-size: 0.8125rem; }
        .tag.up { background: rgba(16, 185, 129, 0.2); color: var(--accent-secondary); }
        .tag.down { background: rgba(239, 68, 68, 0.2); color: var(--error); }
        .table-container { margin-top: 1rem; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; padding: 0.75rem; font-size: 0.75rem; color: var(--text-muted); border-bottom: 1px solid var(--panel-border); }
        td { padding: 0.875rem 0.75rem; border-bottom: 1px solid var(--panel-border); }
        @media (max-width: 1024px) {
          .grid-4 { grid-template-columns: repeat(2, 1fr); }
          .grid-2 { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .grid-4 { grid-template-columns: 1fr; }
        }
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
