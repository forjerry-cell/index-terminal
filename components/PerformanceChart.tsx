'use client';

import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartProps {
  data: any[];
}

type TimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'MAX';

export default function PerformanceChart({ data }: ChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('MAX');

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
    return data.filter(d => new Date(d.date).getTime() >= cutoffTime);
  }, [data, timeRange]);

  const ranges: TimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', 'MAX'];

  return (
    <div className="flex flex-col w-full">
      <div className="flex justify-end gap-2 mb-4">
        {ranges.map(range => (
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
              backgroundColor: timeRange === range ? 'var(--accent)' : 'transparent',
              color: timeRange === range ? '#fff' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            {range}
          </button>
        ))}
      </div>
      <div style={{ width: '100%', height: '350px' }}>
        <ResponsiveContainer>
          <LineChart data={filteredData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#23262b" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#6b7280" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              tickFormatter={(str) => {
                const parts = str.split('-');
                return timeRange === '1M' || timeRange === '3M' ? `${parts[1]}/${parts[2]}` : `${parts[0]}/${parts[1]}`;
              }}
              minTickGap={30}
            />
            <YAxis 
              stroke="#6b7280" 
              fontSize={12} 
              tickLine={false} 
              axisLine={false}
              domain={['auto', 'auto']}
              tickFormatter={(val) => val.toFixed(2)}
            />
            <Tooltip 
              contentStyle={{ backgroundColor: '#16181b', border: '1px solid #1f2228', borderRadius: '8px' }}
              itemStyle={{ fontSize: '12px' }}
              labelStyle={{ color: '#9ca3af', marginBottom: '8px' }}
            />
            <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px' }} />
            <Line 
              type="monotone" 
              dataKey="value" 
              name="High Beta 指數" 
              stroke="var(--accent)" 
              strokeWidth={3} 
              dot={false}
              activeDot={{ r: 6, fill: 'var(--accent)' }}
            />
            <Line 
              type="monotone" 
              dataKey="benchmark_value" 
              name="基準指數 (Benchmark)" 
              stroke="#64748b" 
              strokeWidth={2} 
              strokeDasharray="5 5" 
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
