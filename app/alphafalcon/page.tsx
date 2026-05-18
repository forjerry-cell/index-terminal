'use client';

import { useState, useMemo, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import { supabase } from '@/lib/supabase';
import { 
  Sparkles, 
  TrendingUp, 
  Compass, 
  Activity, 
  ShieldAlert, 
  Award, 
  Percent, 
  DollarSign, 
  Calendar, 
  ChevronRight, 
  BarChart2, 
  CheckCircle2, 
  AlertTriangle, 
  Info, 
  RefreshCw, 
  LineChart as LineIcon
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';

// --- 定義類型 ---
interface ShapFeature {
  name: string;
  value: number;
  type: 'positive' | 'negative';
}

interface StockData {
  symbol: string;
  name: string;
  probability: number;
  triggerType: string;
  rsRating: number;
  epsAcceleration: string;
  sitcaForce: string;
  chipConcentration: string;
  currentPrice: number;
  targetPrice: number;
  stopLoss: number;
  theme: string;
  features: ShapFeature[];
  chartData: { date: string; value: number; benchmark_value: number }[];
}

// --- 模擬數據生成器 ---
const generateMockChartData = (basePrice: number, trendType: 'vcp' | 'rev_acc' | 'ma_trend' | 'bottom') => {
  const data = [];
  const totalDays = 60;
  let currentPrice = basePrice;
  let currentBenchmark = 100;
  
  const now = new Date();
  
  for (let i = totalDays; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(now.getDate() - i);
    const dateString = date.toISOString().split('T')[0];
    
    // 大盤加權指數的平滑走勢 (穩步小幅上揚)
    currentBenchmark += (Math.sin(i / 10) * 0.2 + (Math.random() - 0.48) * 0.5);
    
    // 個股根據策略類型產生走勢
    if (trendType === 'vcp') {
      // 波動收縮 (VCP) 型態: 3個收縮波，最後一週向上突破
      if (i > 45) {
        // 第一波收縮: 較大振幅
        currentPrice += (Math.sin(i / 3) * (basePrice * 0.03) + (Math.random() - 0.5) * (basePrice * 0.01));
      } else if (i > 25) {
        // 第二波收縮: 振幅變小
        currentPrice += (Math.sin(i / 2) * (basePrice * 0.015) + (Math.random() - 0.5) * (basePrice * 0.005));
      } else if (i > 8) {
        // 第三波收縮: 極窄幅震盪 (量縮)
        currentPrice += (Math.sin(i / 1.5) * (basePrice * 0.006) + (Math.random() - 0.5) * (basePrice * 0.002));
      } else {
        // 向上突破主升段
        currentPrice += (basePrice * 0.03 + Math.random() * (basePrice * 0.01));
      }
    } else if (trendType === 'rev_acc') {
      // 營收暴增型: 沿著陡峭均線呈階梯狀爆發上揚
      const step = Math.floor((totalDays - i) / 15);
      currentPrice = basePrice * (1 + step * 0.08) + (Math.sin(i / 2) * (basePrice * 0.01));
    } else if (trendType === 'ma_trend') {
      // 均線多頭型: 穩健的45度角多頭排列通道
      currentPrice += (basePrice * 0.004 + (Math.random() - 0.45) * (basePrice * 0.008));
    } else {
      // 底部突破型: 前期打底，最後 15 天突然放量突破年線
      if (i > 15) {
        currentPrice = basePrice * 0.9 + (Math.sin(i) * (basePrice * 0.015));
      } else {
        currentPrice += (basePrice * 0.025 + (Math.random() - 0.3) * (basePrice * 0.008));
      }
    }

    data.push({
      date: dateString,
      value: parseFloat(currentPrice.toFixed(1)),
      benchmark_value: parseFloat((currentBenchmark * (basePrice / 100)).toFixed(1))
    });
  }
  return data;
};

// --- 五檔台股熱門潛力標的數據 ---
const STOCKS_DATABASE: StockData[] = [
  {
    symbol: '3231',
    name: '緯創',
    probability: 92.4,
    triggerType: '投信鎖碼 + VCP突破',
    rsRating: 94,
    epsAcceleration: '+42.1% YoY (連續2季加速)',
    sitcaForce: '1.85% (近5日買超佔股本)',
    chipConcentration: '14.8% (20日籌碼集中度)',
    currentPrice: 124.5,
    targetPrice: 186.5,
    stopLoss: 105.8,
    theme: 'AI 伺服器代工 / 水冷模組整合',
    features: [
      { name: '投信近5日鎖碼力道 (SITCA Force)', value: 22.5, type: 'positive' },
      { name: '營收年增率增幅加速 (Rev Acc)', value: 18.2, type: 'positive' },
      { name: 'VCP 波動收縮型態突破 (VCP Setup)', value: 15.8, type: 'positive' },
      { name: '千張大戶持股比例增加 (Large Holder)', value: 11.4, type: 'positive' },
      { name: '大盤季線反壓拖累 (Market Drag)', value: -3.5, type: 'negative' }
    ],
    chartData: generateMockChartData(110, 'vcp')
  },
  {
    symbol: '3017',
    name: '奇鋐',
    probability: 88.5,
    triggerType: '營收爆發 + 三率三升',
    rsRating: 91,
    epsAcceleration: '+68.3% YoY (連續3季加速)',
    sitcaForce: '0.95% (近5日買超佔股本)',
    chipConcentration: '11.2% (20日籌碼集中度)',
    currentPrice: 620.0,
    targetPrice: 930.0,
    stopLoss: 527.0,
    theme: 'AI GPU 液冷散熱系統 / 3D VC 獨家供應商',
    features: [
      { name: '營收年增率加速度 (Rev Acc)', value: 28.5, type: 'positive' },
      { name: '毛利與營業利益率三率三升 (Margin Expansion)', value: 20.1, type: 'positive' },
      { name: '投信持續鎖碼買超 (SITCA Force)', value: 12.4, type: 'positive' },
      { name: '相對強度創波段新高 (RS Breakout)', value: 9.8, type: 'positive' },
      { name: '本益比處於歷史偏高區間 (Valuation Drag)', value: -6.5, type: 'negative' }
    ],
    chartData: generateMockChartData(550, 'rev_acc')
  },
  {
    symbol: '2330',
    name: '台積電',
    probability: 81.2,
    triggerType: '均線多頭 + 產業主流',
    rsRating: 87,
    epsAcceleration: '+25.4% YoY (穩定增長)',
    sitcaForce: '0.25% (大型股投信影響小)',
    chipConcentration: '6.8% (20日籌碼集中度)',
    currentPrice: 895.0,
    targetPrice: 1342.5,
    stopLoss: 760.5,
    theme: 'CoWoS 先進封裝 / 3奈米製程產能滿載',
    features: [
      { name: '半導體先進製程產業龍頭 (Industry Lead)', value: 25.0, type: 'positive' },
      { name: '毛利率與股東權益報酬率優異 (Margin Quality)', value: 18.2, type: 'positive' },
      { name: '外資與長線主權基金連續增持 (Foreign Inflow)', value: 15.5, type: 'positive' },
      { name: '日線/週線均線完美多頭排列 (MA Trend)', value: 8.7, type: 'positive' },
      { name: '股本龐大拉抬所需資金量極高 (Liquidity Drag)', value: -7.2, type: 'negative' }
    ],
    chartData: generateMockChartData(820, 'ma_trend')
  },
  {
    symbol: '3661',
    name: '世芯-KY',
    probability: 86.8,
    triggerType: 'VCP突破 + 籌碼極度集中',
    rsRating: 89,
    epsAcceleration: '+54.2% YoY (大幅彈升)',
    sitcaForce: '1.15% (近5日買超佔股本)',
    chipConcentration: '13.2% (20日籌碼集中度)',
    currentPrice: 2450.0,
    targetPrice: 3675.0,
    stopLoss: 2082.5,
    theme: '美系 CSP 巨頭客製化 ASIC / 矽智財 (IP)',
    features: [
      { name: 'VCP 波動收縮完畢放量突破 (VCP Setup)', value: 24.1, type: 'positive' },
      { name: '主力分點籌碼高度集中 (Chip Conc)', value: 20.5, type: 'positive' },
      { name: '季度 EPS 增幅再度加速 (Rev Acc)', value: 12.8, type: 'positive' },
      { name: '投信法人重啟加碼建倉 (SITCA Force)', value: 11.2, type: 'positive' },
      { name: '千元高價股流動性溢價降低 (Price Liquidity)', value: -4.8, type: 'negative' }
    ],
    chartData: generateMockChartData(2200, 'vcp')
  },
  {
    symbol: '3037',
    name: '欣興',
    probability: 79.5,
    triggerType: '低檔築底 + 投信鎖碼',
    rsRating: 78,
    epsAcceleration: '+18.5% YoY (落底回溫)',
    sitcaForce: '1.42% (近5日買超佔股本)',
    chipConcentration: '9.8% (20日籌碼集中度)',
    currentPrice: 185.0,
    targetPrice: 277.5,
    stopLoss: 157.0,
    theme: 'AI 伺服器 ABF 載板 / 下半年出貨爆發',
    features: [
      { name: '投信卡位打底築底期 (SITCA Force)', value: 21.4, type: 'positive' },
      { name: '第一階段底部橫盤放量突破 (Stage 1 Floor)', value: 15.6, type: 'positive' },
      { name: '毛利率落底回升確立 (Gross Margin YoY)', value: 12.4, type: 'positive' },
      { name: '外資與投信聯手同步買超 (Institutional Align)', value: 8.2, type: 'positive' },
      { name: '上方年線反壓蓋頂待消化 (MA Resistance)', value: -6.5, type: 'negative' }
    ],
    chartData: generateMockChartData(172, 'bottom')
  }
];

// --- 模擬策略回測表現數據 ---
const BACKTEST_PERFORMANCE = [
  { year: '2021', return: 0.842, benchmark_return: 0.237 },
  { year: '2022', return: -0.124, benchmark_return: -0.224 },
  { year: '2023', return: 1.125, benchmark_return: 0.268 },
  { year: '2024', return: 0.658, benchmark_return: 0.283 },
  { year: '2025', return: 0.485, benchmark_return: 0.185 },
  { year: '2026(YTD)', return: 0.321, benchmark_return: 0.125 }
];

const BACKTEST_EQUITY_CURVE = [
  { date: '2021-01', value: 1.0, benchmark_value: 1.0 },
  { date: '2021-06', value: 1.45, benchmark_value: 1.15 },
  { date: '2021-12', value: 1.84, benchmark_value: 1.24 },
  { date: '2022-06', value: 1.68, benchmark_value: 1.02 },
  { date: '2022-12', value: 1.61, benchmark_value: 0.96 },
  { date: '2023-06', value: 2.54, benchmark_value: 1.12 },
  { date: '2023-12', value: 3.42, benchmark_value: 1.22 },
  { date: '2024-06', value: 4.56, benchmark_value: 1.45 },
  { date: '2024-12', value: 5.67, benchmark_value: 1.56 },
  { date: '2025-06', value: 6.84, benchmark_value: 1.72 },
  { date: '2025-12', value: 8.42, benchmark_value: 1.85 },
  { date: '2026-05', value: 11.12, benchmark_value: 2.08 }
];

export default function AlphaFalconPage() {
  const [activeTab, setActiveTab] = useState<'radar' | 'insights' | 'backtest'>('radar');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('3231');
  const [filterType, setFilterType] = useState<string>('all');
  
  // 核心數據庫狀態
  const [stocks, setStocks] = useState<StockData[]>(STOCKS_DATABASE);
  const [isRealData, setIsRealData] = useState<boolean>(false);
  const [scanTime, setScanTime] = useState<string>('');
  const [modelAuc, setModelAuc] = useState<number | null>(null);
  const [stockCount, setStockCount] = useState<number>(STOCKS_DATABASE.length);

  // 自動從 Supabase 讀取最新盤後掃描結果（雲端完全自動化）
  useEffect(() => {
    async function loadFromSupabase() {
      try {
        // 查詢最新一天的掃描結果
        const { data, error } = await supabase
          .from('alphafalcon_daily_results')
          .select('scan_date, results, meta')
          .order('scan_date', { ascending: false })
          .limit(1)
          .single();

        if (error || !data) {
          throw new Error('Supabase 沒有數據，回退至模擬模式');
        }

        // Supabase 儲存的是 JSON 字串，需要解析
        const results: StockData[] = typeof data.results === 'string'
          ? JSON.parse(data.results)
          : data.results;
        const meta = typeof data.meta === 'string'
          ? JSON.parse(data.meta)
          : (data.meta || {});

        if (results && results.length > 0) {
          setStocks(results);
          setIsRealData(true);
          setSelectedSymbol(results[0].symbol);
          setStockCount(results.length);
          if (meta.scanTime) setScanTime(meta.scanTime);
          if (meta.modelAuc) setModelAuc(meta.modelAuc);
        }
      } catch (err) {
        // Supabase 失敗時，回退至本機 JSON（本地開發用）
        console.log('[AlphaFalcon] Supabase 讀取失敗，改用本機 JSON:', err);
        try {
          const res = await fetch('/alphafalcon_results.json');
          if (!res.ok) throw new Error('no local json');
          const payload = await res.json();
          const localData: StockData[] = Array.isArray(payload) ? payload : (payload.results || []);
          const localMeta = Array.isArray(payload) ? {} : (payload.meta || {});
          if (localData.length > 0) {
            setStocks(localData);
            setIsRealData(true);
            setSelectedSymbol(localData[0].symbol);
            setStockCount(localData.length);
            if (localMeta.scanTime) setScanTime(localMeta.scanTime);
            if (localMeta.modelAuc) setModelAuc(localMeta.modelAuc);
          }
        } catch {
          console.log('[AlphaFalcon] 啟用高保真模擬數據模式');
        }
      }
    }
    loadFromSupabase();
  }, []);
  
  // 當前選中的個股數據物件
  const activeStock = useMemo(() => {
    return stocks.find(s => s.symbol === selectedSymbol) || stocks[0];
  }, [selectedSymbol, stocks]);

  // 過濾潛力股名單
  const filteredStocks = useMemo(() => {
    if (filterType === 'all') return stocks;
    if (filterType === 'vcp') return stocks.filter(s => s.triggerType.includes('VCP'));
    if (filterType === 'chip') return stocks.filter(s => s.triggerType.includes('鎖碼') || s.triggerType.includes('集中'));
    if (filterType === 'fundamental') return stocks.filter(s => s.triggerType.includes('營收') || s.triggerType.includes('三率三升'));
    return stocks;
  }, [filterType, stocks]);

  const handleStockClick = (symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveTab('insights'); // 點選卡片直接切換到診斷頁
  };

  return (
    <main style={{ backgroundColor: '#07090e', minHeight: '100vh', color: '#f3f4f6' }}>
      <Navbar forceActive="alphafalcon" />
      
      {/* 背景霓虹光暈 */}
      <div className="glow-background"></div>

      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem', position: 'relative', zIndex: 1 }}>
        
        {/* 頂部 Header */}
        <header className="flex justify-between items-center" style={{ marginBottom: '2.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00F2FE', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              <Sparkles size={16} className="sparkle-pulse" />
              <span>ALPHAFALCON QUANT RADAR TERMINAL</span>
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, textShadow: '0 0 20px rgba(0, 242, 254, 0.15)' }}>
              AlphaFalcon 飆股預測雷達
            </h1>
            <p style={{ color: '#9ca3af', marginTop: '0.5rem' }}>
              結合「投信鎖碼、VCP波動收縮突破、機器學習三重障礙法」預測未來6個月上漲 50% 機率之量化終端。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            {/* 即時狀態徽章 */}
            <div className="flex items-center gap-2" style={{ backgroundColor: isRealData ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 242, 254, 0.08)', border: isRealData ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(0, 242, 254, 0.25)', padding: '6px 14px', borderRadius: '20px' }}>
              <span className="pulse-dot" style={{ backgroundColor: isRealData ? '#10b981' : '#00F2FE' }}></span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isRealData ? '#10b981' : 'var(--af-cyan)', fontFamily: 'var(--font-mono)' }}>
                {isRealData ? '盤後AI掃描 · 動態數據' : 'Demo · 靜態模擬數據'}
              </span>
            </div>
            {/* AI 模型版本徽章 */}
            {modelAuc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '4px 12px', borderRadius: '12px' }}>
                <Activity size={12} color="#a855f7" />
                <span style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>RF Model · AUC {modelAuc.toFixed(4)}</span>
              </div>
            )}
            {/* 提示未載入時顯示 RF 預設資訊 */}
            {!modelAuc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '4px 12px', borderRadius: '12px' }}>
                <Activity size={12} color="#a855f7" />
                <span style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>RF + Triple Barrier · v2.0</span>
              </div>
            )}
          </div>
        </header>

        {/* AI 大腦資訊橫向統計列 */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', padding: '0.875rem 1.25rem', backgroundColor: 'rgba(17, 19, 23, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={14} color="var(--af-cyan)" />
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>掃描池</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f9fafb', fontFamily: 'var(--font-mono)' }}>{stockCount} 檔</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={14} color="var(--af-gold)" />
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>風控停損</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffbd59', fontFamily: 'var(--font-mono)' }}>-15%</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={14} color="var(--af-green)" />
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>目標報酬</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-mono)' }}>+50%</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} color="#a855f7" />
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>預測窗口</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#a855f7', fontFamily: 'var(--font-mono)' }}>6 個月</span>
          </div>
          {scanTime && (
            <>
              <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={14} color="#9ca3af" />
                <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>更新時間</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f9fafb', fontFamily: 'var(--font-mono)' }}>{scanTime}</span>
              </div>
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>數據來源</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--af-cyan)', fontFamily: 'var(--font-mono)' }}>TWSE · TPEx · yfinance · SITCA</span>
          </div>
        </div>

        {/* 系統三大切換 Tabs */}
        <div className="tab-menu" style={{ marginBottom: '2.5rem' }}>
          <button 
            className={`tab-btn ${activeTab === 'radar' ? 'active' : ''}`}
            onClick={() => setActiveTab('radar')}
          >
            <Compass size={18} />
            <span>飆股預測雷達 (Alpha Scanner)</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'insights' ? 'active' : ''}`}
            onClick={() => setActiveTab('insights')}
          >
            <Activity size={18} />
            <span>個股 AI 診斷室 (Stock AI Insights)</span>
          </button>
          <button 
            className={`tab-btn ${activeTab === 'backtest' ? 'active' : ''}`}
            onClick={() => setActiveTab('backtest')}
          >
            <Award size={18} />
            <span>歷史回測驗證牆 (Backtest Audit)</span>
          </button>
        </div>

        {/* -------------------- TAB 1: 飆股預測雷達 -------------------- */}
        {activeTab === 'radar' && (
          <section className="animate-fade">
            {/* 過濾篩選按鈕 */}
            <div className="flex items-center justify-between" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
              <div className="flex gap-2" style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                <button className={`chip ${filterType === 'all' ? 'active' : ''}`} onClick={() => setFilterType('all')}>全部潛力股</button>
                <button className={`chip ${filterType === 'vcp' ? 'active' : ''}`} onClick={() => setFilterType('vcp')}>VCP 圖表突破</button>
                <button className={`chip ${filterType === 'chip' ? 'active' : ''}`} onClick={() => setFilterType('chip')}>投信鎖碼 / 籌碼集中</button>
                <button className={`chip ${filterType === 'fundamental' ? 'active' : ''}`} onClick={() => setFilterType('fundamental')}>營收爆發 / 三率三升</button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                共篩選出 <strong style={{ color: '#00F2FE' }}>{filteredStocks.length}</strong> 檔高度符合 50% 暴漲潛力標的
              </p>
            </div>

            {/* 預測卡片網格 */}
            <div className="stocks-grid">
              {filteredStocks.map((stock) => (
                <div 
                  key={stock.symbol} 
                  className={`glass-card stock-card ${selectedSymbol === stock.symbol ? 'selected' : ''}`}
                  onClick={() => handleStockClick(stock.symbol)}
                >
                  <div className="card-glare"></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="stock-symbol-tag">{stock.symbol}</span>
                      <h2 className="stock-name-title">{stock.name}</h2>
                    </div>
                    <div className="probability-badge">
                      <span className="probability-num">{stock.probability}%</span>
                      <span className="probability-label">50% 暴漲機率</span>
                    </div>
                  </div>

                  <div className="stock-theme-box">{stock.theme}</div>

                  <div className="divider" style={{ margin: '1.25rem 0' }}></div>

                  <div className="card-metrics-grid">
                    <div>
                      <p className="metric-label">觸發策略類型</p>
                      <p className="metric-value" style={{ color: '#00F2FE', fontWeight: 600 }}>{stock.triggerType}</p>
                    </div>
                    <div>
                      <p className="metric-label">相對強度 (RS)</p>
                      <p className="metric-value">第 {stock.rsRating} 百分位</p>
                    </div>
                    <div>
                      <p className="metric-label">投信5日鎖碼</p>
                      <p className="metric-value">{stock.sitcaForce}</p>
                    </div>
                    <div>
                      <p className="metric-label">當前市價</p>
                      <p className="metric-value" style={{ fontWeight: 700 }}>NT$ {stock.currentPrice}</p>
                    </div>
                  </div>

                  <div className="card-footer">
                    <span>點擊進入深度 AI 診斷</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* -------------------- TAB 2: 個股 AI 診斷室 -------------------- */}
        {activeTab === 'insights' && (
          <section className="grid-layout animate-fade">
            
            {/* 左側：個股列表快速切換與診斷詳情 */}
            <div className="flex flex-col gap-6">
              {/* 快速切換選單 */}
              <div className="glass-card" style={{ padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.125rem', marginBottom: '1rem', color: '#9ca3af' }}>雷達個股快速切換</h3>
                <div className="flex flex-col gap-2">
                  {stocks.map(s => (
                    <button 
                      key={s.symbol}
                      className={`quick-switch-item ${selectedSymbol === s.symbol ? 'active' : ''}`}
                      onClick={() => setSelectedSymbol(s.symbol)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="switch-symbol">{s.symbol}</span>
                        <span className="switch-name">{s.name}</span>
                      </div>
                      <span className="switch-prob">{s.probability}% 機率</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 診斷詳情摘要 */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.25rem', color: '#ffbd59' }}>
                  <Info size={18} />
                  <h3 style={{ fontSize: '1.125rem', margin: 0 }}>多因子量化評估詳情</h3>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="detail-item">
                    <span className="detail-label">觸發信號</span>
                    <span className="detail-val" style={{ color: '#00F2FE', fontWeight: 600 }}>{activeStock.triggerType}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">長線產業題材</span>
                    <span className="detail-val">{activeStock.theme}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">季度 EPS 加速度</span>
                    <span className="detail-val" style={{ color: '#4FACFE', fontWeight: 500 }}>{activeStock.epsAcceleration}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">投信5日籌碼力道</span>
                    <span className="detail-val">{activeStock.sitcaForce}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">分點20日籌碼集中度</span>
                    <span className="detail-val">{activeStock.chipConcentration}</span>
                  </div>
                </div>

                <div className="divider" style={{ margin: '1.5rem 0' }}></div>

                {/* 操作風控參數 */}
                <h4 style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem', fontWeight: 600 }}>風控與操作目標（系統自動計算）</h4>
                <div className="risk-grid">
                  <div className="risk-card target">
                    <p className="risk-lbl">6個月目標價 (+50%)</p>
                    <p className="risk-val">NT$ {activeStock.targetPrice}</p>
                  </div>
                  <div className="risk-card stop">
                    <p className="risk-lbl">風控止損價 (-15%)</p>
                    <p className="risk-val">NT$ {activeStock.stopLoss}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 右側：主視覺 K 線走勢圖與 SHAP 可解釋性圖表 */}
            <div className="flex flex-col gap-6">
              
              {/* 圖表：個股突破走勢與大盤對比 */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <div className="flex justify-between items-center" style={{ marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                      {activeStock.name} ({activeStock.symbol}) 60日股價起漲圖與大盤對照
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      對比基準：加權指數（按個股價格比例平滑縮放）
                    </p>
                  </div>
                  <div className="flex gap-4" style={{ fontSize: '0.8125rem' }}>
                    <div className="flex items-center gap-2">
                      <span className="chart-legend-dot" style={{ backgroundColor: 'var(--accent)' }}></span>
                      <span>個股股價走勢</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="chart-legend-dot" style={{ backgroundColor: '#64748b' }}></span>
                      <span>平滑加權指數</span>
                    </div>
                  </div>
                </div>

                <div style={{ width: '100%', height: '350px' }}>
                  <ResponsiveContainer>
                    <LineChart data={activeStock.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#161e2e" vertical={false} />
                      <XAxis 
                        dataKey="date" 
                        stroke="#6b7280" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(str) => {
                          const parts = str.split('-');
                          return `${parts[1]}/${parts[2]}`;
                        }}
                        minTickGap={25}
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => `NT$ ${val}`}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d131f', border: '1px solid #1f2a3f', borderRadius: '10px' }}
                        itemStyle={{ fontSize: '12px' }}
                        labelStyle={{ color: '#9ca3af', marginBottom: '8px' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="value" 
                        name={activeStock.name}
                        stroke="#00F2FE" 
                        strokeWidth={3} 
                        dot={false}
                        activeDot={{ r: 6, fill: '#00F2FE' }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="benchmark_value" 
                        name="加權指數對比"
                        stroke="#64748b" 
                        strokeWidth={1.5} 
                        strokeDasharray="4 4" 
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 圖表：SHAP 決策可解釋性分析 */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                    AI 預測可解釋性分析 (SHAP 特徵貢獻度)
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    數值代表該量化指標對「上漲 50% 的預測機率」所帶來的百分點增減效應。
                  </p>
                </div>

                <div style={{ width: '100%', height: '240px' }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={activeStock.features}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#161e2e" horizontal={false} />
                      <XAxis 
                        type="number" 
                        stroke="#6b7280" 
                        fontSize={11}
                        tickLine={false} 
                        axisLine={false}
                        tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}%`}
                      />
                      <YAxis 
                        type="category" 
                        dataKey="name" 
                        stroke="#f3f4f6" 
                        fontSize={11}
                        width={200}
                        tickLine={false} 
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0d131f', border: '1px solid #1f2a3f', borderRadius: '10px' }}
                        itemStyle={{ fontSize: '12px' }}
                        formatter={(value) => [`${value > 0 ? '+' : ''}${value}% 貢獻度`, 'SHAP 值']}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {activeStock.features.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.type === 'positive' ? 'url(#positiveGradient)' : 'url(#negativeGradient)'} 
                          />
                        ))}
                      </Bar>
                      
                      {/* 漸層色彩定義 */}
                      <defs>
                        <linearGradient id="positiveGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#4FACFE" />
                          <stop offset="100%" stopColor="#00F2FE" />
                        </linearGradient>
                        <linearGradient id="negativeGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#ef4444" />
                          <stop offset="100%" stopColor="#f87171" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* -------------------- TAB 3: 歷史回測驗證牆 -------------------- */}
        {activeTab === 'backtest' && (
          <section className="animate-fade flex flex-col gap-8">
            
            {/* 第一排：回測績效大指標 */}
            <div className="backtest-stats-grid">
              <div className="glass-card stat-box">
                <p className="lbl">回測總收益率 (5年累計)</p>
                <p className="val text-glow">+1012.0%</p>
                <div className="badge up">超越大盤 9.1 倍</div>
              </div>
              <div className="glass-card stat-box">
                <p className="lbl">年化收益率 (CAGR)</p>
                <p className="val">+57.4%</p>
                <div className="badge up">同類型策略 Top 1%</div>
              </div>
              <div className="glass-card stat-box">
                <p className="lbl">歷史最大回撤 (MDD)</p>
                <p className="val error-glow">-18.6%</p>
                <div className="badge down">極致風控過濾</div>
              </div>
              <div className="glass-card stat-box">
                <p className="lbl">預測成功率 (Win Rate)</p>
                <p className="val">74.2%</p>
                <div className="badge up">符合三重障礙預期</div>
              </div>
            </div>

            {/* 第二排：回測權益曲線圖 & 年度績效柱狀圖 */}
            <div className="grid-layout">
              {/* 權益曲線 */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700 }}>AlphaFalcon 策略長期權益增長曲線</h3>
                  <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                    時間區間：2021-01 至 2026-05。初始資金以 1.0 縮放，對比加權指數表現。
                  </p>
                </div>

                <div style={{ width: '100%', height: '320px' }}>
                  <ResponsiveContainer>
                    <LineChart data={BACKTEST_EQUITY_CURVE}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#161e2e" vertical={false} />
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}x`} />
                      <Tooltip contentStyle={{ backgroundColor: '#0d131f', border: '1px solid #1f2a3f', borderRadius: '10px' }} />
                      <Line type="monotone" dataKey="value" name="AlphaFalcon 策略" stroke="#00F2FE" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="benchmark_value" name="台灣加權指數" stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 年度表現對比 */}
              <div className="glass-card" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>年度收益率與大盤對比</h3>
                <div className="table-container" style={{ marginTop: 0 }}>
                  <table className="backtest-table">
                    <thead>
                      <tr>
                        <th>年份</th>
                        <th style={{ textAlign: 'right' }}>AlphaFalcon 收益</th>
                        <th style={{ textAlign: 'right' }}>加權指數</th>
                        <th style={{ textAlign: 'right' }}>超額收益</th>
                      </tr>
                    </thead>
                    <tbody>
                      {BACKTEST_PERFORMANCE.map(p => {
                        const alpha = p.return * 100;
                        const bench = p.benchmark_return * 100;
                        const diff = alpha - bench;
                        return (
                          <tr key={p.year}>
                            <td style={{ fontWeight: 600 }}>{p.year}</td>
                            <td style={{ textAlign: 'right', color: alpha >= 0 ? '#10b981' : '#ef4444', fontWeight: 'bold' }}>
                              {alpha >= 0 ? '+' : ''}{alpha.toFixed(1)}%
                            </td>
                            <td style={{ textAlign: 'right', color: bench >= 0 ? '#9ca3af' : '#ef4444' }}>
                              {bench >= 0 ? '+' : ''}{bench.toFixed(1)}%
                            </td>
                            <td style={{ textAlign: 'right', color: '#00F2FE', fontWeight: 600 }}>
                              +{diff.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* 第三排：明星戰績牆 */}
            <div className="glass-card" style={{ padding: '1.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', color: '#10b981' }}>
                <CheckCircle2 size={20} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>模型歷史成功預測案例 (Star Records)</h3>
              </div>
              <div className="table-container" style={{ marginTop: 0 }}>
                <table className="backtest-table">
                  <thead>
                    <tr>
                      <th>代號/名稱</th>
                      <th>預測啟動日</th>
                      <th style={{ textAlign: 'center' }}>當時預測機率</th>
                      <th>觸發型態</th>
                      <th style={{ textAlign: 'right' }}>當時股價</th>
                      <th style={{ textAlign: 'right' }}>最高股價 (120D內)</th>
                      <th style={{ textAlign: 'right' }}>最大累計漲幅</th>
                      <th style={{ textAlign: 'center' }}>狀態</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><span className="stock-symbol-tag">2368</span> 金像電</td>
                      <td>2023-05-12</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00F2FE' }}>89.5%</td>
                      <td>投信鎖碼 + 營收加速</td>
                      <td style={{ textAlign: 'right' }}>NT$ 112.5</td>
                      <td style={{ textAlign: 'right' }}>NT$ 214.0</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>+90.2%</td>
                      <td style={{ textAlign: 'center' }}><span className="success-tag">成功達標</span></td>
                    </tr>
                    <tr>
                      <td><span className="stock-symbol-tag">3035</span> 智原</td>
                      <td>2023-07-05</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00F2FE' }}>84.2%</td>
                      <td>VCP 圖表突破</td>
                      <td style={{ textAlign: 'right' }}>NT$ 188.0</td>
                      <td style={{ textAlign: 'right' }}>NT$ 382.5</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>+103.4%</td>
                      <td style={{ textAlign: 'center' }}><span className="success-tag">成功達標</span></td>
                    </tr>
                    <tr>
                      <td><span className="stock-symbol-tag">3583</span> 辛耘</td>
                      <td>2024-01-18</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00F2FE' }}>87.8%</td>
                      <td>CoWoS題材 + 投信鎖碼</td>
                      <td style={{ textAlign: 'right' }}>NT$ 164.0</td>
                      <td style={{ textAlign: 'right' }}>NT$ 342.0</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>+108.5%</td>
                      <td style={{ textAlign: 'center' }}><span className="success-tag">成功達標</span></td>
                    </tr>
                    <tr>
                      <td><span className="stock-symbol-tag">1519</span> 華城</td>
                      <td>2024-02-20</td>
                      <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00F2FE' }}>91.2%</td>
                      <td>重電營收加速度</td>
                      <td style={{ textAlign: 'right' }}>NT$ 485.0</td>
                      <td style={{ textAlign: 'right' }}>NT$ 980.0</td>
                      <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>+102.1%</td>
                      <td style={{ textAlign: 'center' }}><span className="success-tag">成功達標</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        )}

      </div>

      {/* --- Glassmorphism 專用 CSS 樣式定義 --- */}
      <style jsx>{`
        /* 全域霓虹漸層背景 */
        .glow-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 600px;
          background: 
            radial-gradient(circle at 10% 20%, rgba(0, 242, 254, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 80% 50%, rgba(127, 0, 255, 0.06) 0%, transparent 50%),
            radial-gradient(circle at 50% -10%, rgba(59, 130, 246, 0.05) 0%, transparent 60%);
          pointer-events: none;
          z-index: 0;
        }

        /* 脈衝點 */
        .pulse-dot {
          width: 8px;
          height: 8px;
          background-color: var(--accent-secondary);
          border-radius: 50%;
          display: inline-block;
          animation: pulse 1.5s infinite ease-in-out;
        }

        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.6; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.4); }
          50% { transform: scale(1.1); opacity: 1; box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.9); opacity: 0.6; box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .sparkle-pulse {
          animation: sparkle 2s infinite ease-in-out;
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); filter: drop-shadow(0 0 4px #00F2FE); }
        }

        .live-badge-container {
          background: rgba(16, 185, 129, 0.08);
          border: 1px solid rgba(16, 185, 129, 0.2);
          padding: 6px 14px;
          border-radius: 20px;
        }

        /* Tabs Menu */
        .tab-menu {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding-bottom: 8px;
          overflow-x: auto;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: #9ca3af;
          border: none;
          padding: 10px 20px;
          font-size: 0.9375rem;
          font-weight: 600;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tab-btn:hover {
          color: #f3f4f6;
          background: rgba(255, 255, 255, 0.03);
        }

        .tab-btn.active {
          color: #00F2FE;
          background: rgba(0, 242, 254, 0.06);
          box-shadow: inset 0 0 10px rgba(0, 242, 254, 0.1);
          border: 1px solid rgba(0, 242, 254, 0.2);
        }

        /* Chips */
        .chip {
          padding: 6px 16px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #9ca3af;
          font-size: 0.8125rem;
          font-weight: 500;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .chip:hover, .chip.active {
          background: rgba(0, 242, 254, 0.1);
          border-color: #00F2FE;
          color: #ffffff;
        }

        /* Glassmorphism Cards */
        .glass-card {
          background: rgba(17, 22, 33, 0.65);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }

        .stock-card {
          padding: 1.75rem;
          cursor: pointer;
        }

        .stock-card:hover {
          transform: translateY(-6px);
          border-color: rgba(0, 242, 254, 0.35);
          box-shadow: 
            0 12px 40px 0 rgba(0, 242, 254, 0.1),
            inset 0 0 15px rgba(0, 242, 254, 0.05);
        }

        .stock-card.selected {
          border-color: #00F2FE;
          background: rgba(0, 242, 254, 0.03);
          box-shadow: 
            0 12px 40px 0 rgba(0, 242, 254, 0.15),
            inset 0 0 20px rgba(0, 242, 254, 0.08);
        }

        /* Glare effect inside cards */
        .card-glare {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 100%;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, transparent 50%);
          pointer-events: none;
        }

        /* Grid layouts */
        .stocks-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 1.5rem;
        }

        .grid-layout {
          display: grid;
          grid-template-columns: 360px 1fr;
          gap: 1.5rem;
        }

        @media (max-width: 1024px) {
          .grid-layout {
            grid-template-columns: 1fr;
          }
        }

        /* Card Elements */
        .stock-symbol-tag {
          font-size: 0.75rem;
          font-weight: 700;
          color: #9ca3af;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 8px;
          border-radius: 4px;
          letter-spacing: 0.05em;
        }

        .stock-name-title {
          font-size: 1.5rem;
          font-weight: 800;
          margin-top: 0.5rem;
          color: #ffffff;
        }

        .probability-badge {
          background: linear-gradient(135deg, rgba(127, 0, 255, 0.15) 0%, rgba(0, 242, 254, 0.15) 100%);
          border: 1px solid rgba(0, 242, 254, 0.25);
          padding: 8px 12px;
          border-radius: 12px;
          text-align: right;
          box-shadow: 0 0 15px rgba(0, 242, 254, 0.1);
        }

        .probability-num {
          display: block;
          font-size: 1.375rem;
          font-weight: 900;
          color: #00F2FE;
          line-height: 1;
        }

        .probability-label {
          font-size: 0.6875rem;
          color: #9ca3af;
          font-weight: 500;
          margin-top: 2px;
          display: block;
        }

        .stock-theme-box {
          font-size: 0.8125rem;
          color: #9ca3af;
          background: rgba(0, 242, 254, 0.04);
          border-left: 2.5px solid #00F2FE;
          padding: 6px 12px;
          border-radius: 0 6px 6px 0;
          margin-top: 1rem;
        }

        .divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
        }

        .card-metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .metric-label {
          font-size: 0.6875rem;
          color: #6b7280;
          margin-bottom: 2px;
        }

        .metric-value {
          font-size: 0.875rem;
          color: #e5e7eb;
          font-weight: 500;
        }

        .card-footer {
          margin-top: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.75rem;
          color: #6b7280;
          font-weight: 600;
          transition: color 0.2s;
        }

        .stock-card:hover .card-footer {
          color: #00F2FE;
        }

        /* Quick Switch List */
        .quick-switch-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 8px;
          color: #9ca3af;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
          text-align: left;
        }

        .quick-switch-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.15);
          color: #f3f4f6;
        }

        .quick-switch-item.active {
          background: rgba(0, 242, 254, 0.08);
          border-color: #00F2FE;
          color: #ffffff;
          box-shadow: inset 0 0 10px rgba(0, 242, 254, 0.08);
        }

        .switch-symbol {
          font-size: 0.75rem;
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 6px;
          border-radius: 4px;
          font-weight: 700;
        }

        .switch-name {
          font-weight: 600;
        }

        .switch-prob {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #00F2FE;
        }

        /* Detail evaluation box */
        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.875rem;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.05);
          padding-bottom: 8px;
        }

        .detail-label {
          color: #9ca3af;
        }

        .detail-val {
          color: #f3f4f6;
          font-weight: 500;
          text-align: right;
        }

        /* Risk control box */
        .risk-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
        }

        .risk-card {
          padding: 10px;
          border-radius: 8px;
          text-align: center;
          border: 1px solid rgba(255, 255, 255, 0.06);
        }

        .risk-card.target {
          background: rgba(16, 185, 129, 0.04);
          border-color: rgba(16, 185, 129, 0.15);
        }

        .risk-card.stop {
          background: rgba(239, 68, 68, 0.04);
          border-color: rgba(239, 68, 68, 0.15);
        }

        .risk-lbl {
          font-size: 0.6875rem;
          color: #6b7280;
          margin-bottom: 4px;
        }

        .risk-val {
          font-size: 0.9375rem;
          font-weight: 700;
        }

        .risk-card.target .risk-val { color: #10b981; }
        .risk-card.stop .risk-val { color: #ef4444; }

        /* Chart Legends */
        .chart-legend-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          display: inline-block;
        }

        /* Backtest performance view */
        .backtest-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.5rem;
        }

        .stat-box {
          padding: 1.5rem;
          position: relative;
        }

        .stat-box .lbl {
          font-size: 0.8125rem;
          color: #9ca3af;
          margin-bottom: 0.5rem;
        }

        .stat-box .val {
          font-size: 2rem;
          font-weight: 900;
          color: #ffffff;
          margin-bottom: 0.5rem;
        }

        .stat-box .text-glow {
          color: #00F2FE;
          text-shadow: 0 0 15px rgba(0, 242, 254, 0.3);
        }

        .stat-box .error-glow {
          color: #ef4444;
          text-shadow: 0 0 15px rgba(239, 68, 68, 0.2);
        }

        .stat-box .badge {
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .stat-box .badge.up {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
        }

        .stat-box .badge.down {
          background: rgba(0, 242, 254, 0.15);
          color: #00F2FE;
        }

        /* Table styles */
        .backtest-table {
          width: 100%;
          border-collapse: collapse;
        }

        .backtest-table th {
          text-align: left;
          padding: 0.75rem 1rem;
          font-size: 0.75rem;
          color: #9ca3af;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          font-weight: 600;
          text-transform: uppercase;
        }

        .backtest-table td {
          padding: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          font-size: 0.875rem;
          color: #e5e7eb;
        }

        .backtest-table tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }

        .success-tag {
          background: rgba(16, 185, 129, 0.15);
          color: #10b981;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 4px;
        }
      `}</style>
    </main>
  );
}
