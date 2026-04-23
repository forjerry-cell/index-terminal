'use client'
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
    const [performanceData, setPerformanceData] = useState([]);
    const [constituents, setConstituents] = useState([]);
    const [summary, setSummary] = useState([]);
    useEffect(() => {
          async function loadDashboardData() {
                  setLoading(true);
                  const { data: perf } = await supabase.from('index_performance').select('*').eq('index_id', currentIndex).order('date', { ascending: true }).limit(1000);
                  if (perf) setPerformanceData(perf);
                  const { data: consts } = await supabase.from('index_constituents').select('*').eq('index_id', currentIndex).order('weight', { ascending: false });
                  if (consts) setConstituents(consts);
                  if (perf && perf.length > 0) {
                            const last = perf[perf.length - 1];
                            const prev = perf.length > 1 ? perf[perf.length - 2] : last;
                            const change = ((last.price - prev.price) / prev.price) * 100;
                            setSummary([{ name: currentIndex === 'taiwan_high_beta' ? 'TAIWAN' : 'NASDAQ', value: last.price.toFixed(2), change: change.toFixed(2) + '%', isPositive: change >= 0 }]);
                  }
                  setLoading(false);
          }
          loadDashboardData();
    }, [currentIndex]);
    if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin" /></div>div>;
    return (
          <main className="min-h-screen bg-slate-950 text-slate-100">
                <Navbar />
                <div className="max-w-7xl mx-auto px-4 py-8">
                        <div className="bg-slate-900 p-6 mb-8 rounded-xl border border-slate-800">
                                  <h2 className="text-xl font-bold mb-6">Performance Chart</h2>h2>
                                  <div className="h-[400px]"><PerformanceChart data={performanceData} /></div>div>
                        </div>div>
                        <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                                  <table className="w-full text-left">
                                              <thead><tr className="bg-slate-950/50 text-slate-400 text-sm"><th className="px-6 py-4">Symbol</th>th><th className="px-6 py-4">Name</th>th><th className="px-6 py-4 text-right">Weight</th>th></tr>tr></thead>thead>
                                              <tbody className="divide-y divide-slate-800">
                                                {constituents.map((stock, idx) => (
                            <tr key={idx}><td className="px-6 py-4 font-mono text-blue-400">{stock.symbol}</td>td><td className="px-6 py-4">{stock.name}</td>td><td className="px-6 py-4 text-right">{stock.weight.toFixed(2)}%</td>td></tr>tr>
                          ))}
                                              </tbody>tbody>
                                  </table>table>
                        </div>div>
                </div>div>
          </main>main>
        );
}

export default function Home() {
    return <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>div>}><DashboardContent /></Suspense>Suspense>;
}
</div>
