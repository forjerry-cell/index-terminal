'use client';

import { useState, useEffect, useMemo } from 'react';
import Navbar from '@/components/Navbar';
import MomentumPerformanceChart from '@/components/MomentumPerformanceChart';
import { TrendingUp, ArrowUpRight, ArrowDownRight, Loader2, ShieldCheck, Flame, Layers, Award } from 'lucide-react';

export default function TaiwanMomentumPage() {
  const [loading, setLoading] = useState(true);
  const [indexData, setIndexData] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch('/taiwan_momentum_30.json');
        const json = await res.json();
        setIndexData(json);
      } catch (err) {
        console.error('Failed to load taiwan_momentum_30.json', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const stats = useMemo(() => {
    if (!indexData || !indexData.performance || indexData.performance.length === 0) return null;
    const perf = indexData.performance;
    const latest = perf[perf.length - 1];

    const tr = latest.value - 1;
    const trPost = latest.value_post - 1;
    const trOrig = latest.original_value - 1;
    const trBM = latest.benchmark_value - 1;
    const trTW50 = latest.tw50_value - 1;

    const days = perf.length;
    const cagr = Math.pow(latest.value, 252 / days) - 1;
    const cagrPost = Math.pow(latest.value_post, 252 / days) - 1;

    let peak = -Infinity;
    let mdd = 0;
    let returns: number[] = [];
    const annualMap: Record<string, { start: number; end: number }> = {};

    perf.forEach((row: any, idx: number) => {
      if (row.value > peak) peak = row.value;
      const dd = (peak - row.value) / peak;
      if (dd > mdd) mdd = dd;

      if (idx > 0) {
        const prev = perf[idx - 1];
        returns.push((row.value - prev.value) / prev.value);
      }

      const year = row.date.substring(0, 4);
      if (!annualMap[year]) annualMap[year] = { start: row.value, end: row.value };
      else annualMap[year].end = row.value;
    });

    const avgRet = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgRet, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpe = (avgRet / stdDev) * Math.sqrt(252);

    const annualStats = Object.keys(annualMap)
      .map((year) => ({
        year,
        return: annualMap[year].end / annualMap[year].start - 1,
      }))
      .sort((a, b) => Number(b.year) - Number(a.year));

    return {
      totalReturn: tr,
      totalReturnPost: trPost,
      totalReturnOrig: trOrig,
      totalReturnBM: trBM,
      totalReturnTW50: trTW50,
      cagr,
      cagrPost,
      mdd: -mdd,
      sharpe,
      latestDate: latest.date,
      latestValue: latest.value,
      latestChange: latest.change_percent,
      annualStats,
    };
  }, [indexData]);

  if (loading) return <div className="auth-container"><Loader2 className="animate-spin" /></div>;
  if (!indexData) return <div className="auth-container">數據載入失敗</div>;

  const { index_info, constituents, performance } = indexData;

  return (
    <main>
      <Navbar forceActive="momentum" />

      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}>
        {/* 標頭介紹 */}
        <header className="flex justify-between items-center" style={{ marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '0.5rem' }}>
              <span className="tag" style={{ background: 'rgba(225, 29, 72, 0.15)', color: '#f43f5e', border: '1px solid rgba(225, 29, 72, 0.3)' }}>
                <Flame size={14} /> 精選動能強勢板塊 · 30 檔旗艦
              </span>
              <span className="tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-secondary)' }}>
                <ShieldCheck size={14} /> 經典 Buy & Hold · 半年定期調整
              </span>
            </div>
            <h1 className="animate-fade">{index_info.name}</h1>
            <p className="animate-fade" style={{ animationDelay: '0.1s', color: 'var(--text-muted)', maxWidth: '750px', fontSize: '0.9375rem', marginTop: '0.35rem' }}>
              {index_info.description}
            </p>
          </div>
        </header>

        {/* 頂部四張關鍵指標卡片 */}
        <section className="grid-4 gap-6" style={{ marginBottom: '2.5rem' }}>
          <div className="card animate-fade">
            <div className="flex justify-between items-center">
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>最新累積淨值</span>
              <div className={`tag ${stats.latestChange >= 0 ? 'up' : 'down'}`}>
                {stats.latestChange >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {Math.abs(stats.latestChange)}%
              </div>
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#e11d48', marginTop: '0.5rem' }}>
              {stats.latestValue.toFixed(2)}x
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              起點 2018/12/18 = 1.00x
            </p>
          </div>

          <div className="card animate-fade" style={{ animationDelay: '0.05s' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>累積總報酬 (未扣費 / 扣費後)</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--accent)', marginTop: '0.5rem' }}>
              +{(stats.totalReturn * 100).toFixed(1)}%
            </div>
            <p style={{ fontSize: '0.8125rem', color: '#fb7185', marginTop: '0.25rem' }}>
              法人扣費後：+{(stats.totalReturnPost * 100).toFixed(1)}%
            </p>
          </div>

          <div className="card animate-fade" style={{ animationDelay: '0.1s' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>年化複合成長率 (CAGR)</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#10b981', marginTop: '0.5rem' }}>
              {(stats.cagr * 100).toFixed(2)}%
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              原版 FTHB (50檔)：35.26%
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

        {/* 策略核心邏輯說明條 */}
        <section style={{ marginBottom: '2.5rem' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(225, 29, 72, 0.08) 0%, rgba(99, 102, 241, 0.06) 100%)',
            border: '1px solid rgba(225, 29, 72, 0.25)',
            borderRadius: '14px',
            padding: '1.5rem 2rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '1.25rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ padding: '12px', background: 'rgba(225, 29, 72, 0.2)', borderRadius: '10px', color: '#f43f5e' }}>
                <Layers size={24} />
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.0625rem', color: 'var(--foreground)', fontWeight: 700 }}>
                  動能汰弱與精選機制 (Top 30 Selection)
                </h4>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  於每期 (6月、12月) 官方 50 檔成分股中，回算過去 126 個交易日動能，剔除落後 20 檔，將資金等比例重配置給前 30 檔強勢股滿倉持有。
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8125rem' }}>
                超額 Alpha: <strong style={{ color: '#f43f5e' }}>+318.6%</strong> vs 原版
              </div>
              <div style={{ padding: '6px 14px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', fontSize: '0.8125rem' }}>
                成分股規模: <strong>精準 30 檔</strong>
              </div>
            </div>
          </div>
        </section>

        {/* 核心圖表與持股區塊 */}
        <div className="grid-2 gap-8">
          <section className="flex flex-col gap-8">
            <div className="card" style={{ minHeight: '480px' }}>
              <div className="flex justify-between items-center" style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0 }}>指數長期走勢多維度對比 (2018 - 至今)</h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>支援切換時間區間與基準線</span>
              </div>
              <MomentumPerformanceChart data={performance} />
              <div className="text-center mt-4" style={{ color: 'var(--accent-secondary)', fontWeight: 600, fontSize: '0.875rem', borderTop: '1px solid var(--panel-border)', paddingTop: '1rem' }}>
                📡 歷史回測驗證區間已同步至最新數據：{stats.latestDate}
              </div>
            </div>

            {/* 逐年報酬率卡片 */}
            <div className="card animate-fade">
              <h3 style={{ marginBottom: '1.25rem' }}>逐年表現與牛熊市防禦度 (Annual Returns)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '0.75rem' }}>
                {stats.annualStats.map((yr: any) => (
                  <div key={yr.year} style={{ padding: '0.75rem', backgroundColor: 'var(--background)', borderRadius: '10px', border: '1px solid var(--panel-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{yr.year}</div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: yr.return >= 0 ? '#f43f5e' : 'var(--error)', marginTop: '4px' }}>
                      {(yr.return * 100).toFixed(1)}%
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* 最新 30 檔成分股表 */}
          <section className="card">
            <div className="flex justify-between items-center" style={{ marginBottom: '0.5rem' }}>
              <div>
                <h3 style={{ margin: 0 }}>即時成分股明細 (Top 30 精選)</h3>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  依動能強化權重排序 · 滿倉 100.0%
                </p>
              </div>
              <span className="tag" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--foreground)' }}>
                30 檔標的
              </span>
            </div>

            <div className="table-container" style={{ maxHeight: '680px', overflowY: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}>#</th>
                    <th>名稱 / 代號</th>
                    <th style={{ textAlign: 'right' }}>126日動能</th>
                    <th style={{ textAlign: 'right' }}>權重 (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {constituents.map((item: any, idx: number) => (
                    <tr key={item.symbol}>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600 }}>
                        {idx + 1}
                      </td>
                      <td>
                        <div className="flex flex-col">
                          <span style={{ color: 'var(--foreground)', fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.symbol}</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.875rem', color: '#10b981', fontWeight: 600 }}>
                        {item.momentum_126d}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#f43f5e', fontSize: '1.0625rem' }}>
                        {item.weight.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
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
      `}</style>
    </main>
  );
}
