'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ChartProps {
  data: any[];
}

export default function PerformanceChart({ data }: ChartProps) {
  return (
    <div style={{ width: '100%', height: '320px', marginTop: '1.5rem' }}>
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#23262b" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="#6b7280" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            tickFormatter={(str) => str.split('-').slice(1).join('/')}
          />
          <YAxis 
            stroke="#6b7280" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#16181b', border: '1px solid #1f2228', borderRadius: '8px' }}
            itemStyle={{ fontSize: '12px' }}
          />
          <Legend iconType="circle" />
          <Line 
            type="monotone" 
            dataKey="value" 
            name="High Beta 指數" 
            stroke="var(--accent)" 
            strokeWidth={3} 
            dot={false}
            activeDot={{ r: 6 }}
          />
          <Line 
            type="monotone" 
            dataKey="benchmark_value" 
            name="基準指數 (Benchmark)" 
            stroke="#64748b" 
            strokeWidth={2} 
            strokeDasharray="5 5" 
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
