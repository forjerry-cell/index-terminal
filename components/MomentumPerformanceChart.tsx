'use client';

import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface MomentumChartProps {
  data: any[];
}

type TimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'MAX';

export default function MomentumPerformanceChart({ data }: MomentumChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('MAX');
  const [includePostFee, setIncludePostFee] = useState<boolean>(true);
  const [showOriginal, setShowOriginal] = useState<boolean>(true);
  const [showTW50, setShowTW50] = useState<boolean>(true);
  const [showTAIEX, setShowTAIEX] = useState<boolean>(true);

  const filteredData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (timeRange === 'MAX') return data;

    const latestDate = new Date(data[data.length - 1].date);
    const cutoffDate = new Date(latestDate);

    switch (timeRange) {
      case '1M': cutoffDate.setMonth(cutoffDate.getMonth() - 1); break;
      case '3M': cutoffDate.setMonth(cutoffDate.getMonth() - 3); break;
      case '6M': cutoffDate.setMonth(cutoffDate.getMonth() - 6); break;
      case '1Y': cutoffDate.setFullYear(cutoffDate.getFullYear() - 1); break;
      case '3Y': cutoffDate.setFullYear(cutoffDate.getFullYear() - 3); break;
    }

    const cutoffTime = cutoffDate.getTime();
    const subset = data.filter((d: any) => new Date(d.date).getTime() >= cutoffTime);
    if (subset.length === 0) return data;

    const baseVal = subset[0].value;
    const baseValPost = subset[0].value_post;
    const baseOrig = subset[0].original_value;
    const baseBM = subset[0].benchmark_value;
    const baseTW50 = subset[0].tw50_value;

    return subset.map((d: any) => ({
      ...d,
      norm_value: Number((d.value / baseVal).toFixed(4)),
      norm_value_post: Number((d.value_post / baseValPost).toFixed(4)),
      norm_orig: Number((d.original_value / baseOrig).toFixed(4)),
      norm_bm: Number((d.benchmark_value / baseBM).toFixed(4)),
      norm_tw50: Number((d.tw50_value / baseTW50).toFixed(4)),
    }));
  }, [data, timeRange]);

  const ranges: TimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', 'MAX'];

  return (
    <div className="flex flex-col w-full">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-4">
          <label style={{ fontSize: '0.8125rem', color: '#f43f5e', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 600 }}>
            <input type="checkbox" checked={includePostFee} onChange={(e) => setIncludePostFee(e.target.checked)} />
            顯示扣費後 (Top 30)
          </label>
          <label style={{ fontSize: '0.8125rem', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
            <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} />
            原版 FTHB (50檔)
          </label>
          <label style={{ fontSize: '0.8125rem', color: '#2dd4bf', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
            <input type="checkbox" checked={showTW50} onChange={(e) => setShowTW50(e.target.checked)} />
            台灣50 (TR)
          </label>
          <label style={{ fontSize: '0.8125rem', color: '#9ca3af', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 500 }}>
            <input type="checkbox" checked={showTAIEX} onChange={(e) => setShowTAIEX(e.target.checked)} />
            加權指數 (TR)
          </label>
        </div>

        <div className="flex gap-2">
          {ranges.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '4px 12px',
                fontSize: '0.75rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: timeRange === range ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
                color: timeRange === range ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: '420px' }}>
        <ResponsiveContainer>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#23262b" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(str: string) => {
                const parts = str.split('-');
                return timeRange === '1M' || timeRange === '3M' ? `${parts[1]}/${parts[2]}` : `${parts[0]}/${parts[1]}`;
              }}
              minTickGap={35}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(val: number) => `${val.toFixed(2)}x`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#16181b', border: '1px solid #1f2228', borderRadius: '8px' }}
              itemStyle={{ fontSize: '12px' }}
              labelStyle={{ color: '#9ca3af', marginBottom: '8px' }}
              formatter={(value: any, name: any) => [`${Number(value).toFixed(2)}x (${((Number(value) - 1) * 100).toFixed(1)}%)`, name]}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '14px' }} />

            <Line
              type="monotone"
              dataKey={timeRange === 'MAX' ? 'value' : 'norm_value'}
              name="台股強勢動能指數 (Top 30 精選)"
              stroke="#e11d48"
              strokeWidth={3}
              dot={false}
              activeDot={{ r: 6, fill: '#e11d48' }}
            />

            {includePostFee && (
              <Line
                type="monotone"
                dataKey={timeRange === 'MAX' ? 'value_post' : 'norm_value_post'}
                name="台股強勢動能指數 (扣費後)"
                stroke="#fb7185"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />
            )}

            {showOriginal && (
              <Line
                type="monotone"
                dataKey={timeRange === 'MAX' ? 'original_value' : 'norm_orig'}
                name="原版 FTHB003V02 (50檔被動)"
                stroke="#6366f1"
                strokeWidth={2}
                strokeDasharray="6 6"
                dot={false}
              />
            )}

            {showTW50 && (
              <Line
                type="monotone"
                dataKey={timeRange === 'MAX' ? 'tw50_value' : 'norm_tw50'}
                name="台灣50 TW50 (TR)"
                stroke="#14b8a6"
                strokeWidth={1.8}
                strokeDasharray="3 3"
                dot={false}
              />
            )}

            {showTAIEX && (
              <Line
                type="monotone"
                dataKey={timeRange === 'MAX' ? 'benchmark_value' : 'norm_bm'}
                name="加權指數 TAIEX (TR)"
                stroke="#9ca3af"
                strokeWidth={1.6}
                strokeDasharray="2 2"
                dot={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
