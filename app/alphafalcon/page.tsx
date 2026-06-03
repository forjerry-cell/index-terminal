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
  LineChart as LineIcon,
  Globe
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
  type: 'positive' | 'negative' | 'neutral';
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
    
    // 大盤的平滑走勢 (穩步小幅上揚)
    currentBenchmark += (Math.sin(i / 10) * 0.2 + (Math.random() - 0.48) * 0.5);
    
    // 個股根據策略類型產生走勢
    if (trendType === 'vcp') {
      // 波動收縮 (VCP) 型態
      if (i > 45) {
        currentPrice += (Math.sin(i / 3) * (basePrice * 0.03) + (Math.random() - 0.5) * (basePrice * 0.01));
      } else if (i > 25) {
        currentPrice += (Math.sin(i / 2) * (basePrice * 0.015) + (Math.random() - 0.5) * (basePrice * 0.005));
      } else if (i > 8) {
        currentPrice += (Math.sin(i / 1.5) * (basePrice * 0.006) + (Math.random() - 0.5) * (basePrice * 0.002));
      } else {
        currentPrice += (basePrice * 0.03 + Math.random() * (basePrice * 0.01));
      }
    } else if (trendType === 'rev_acc') {
      const step = Math.floor((totalDays - i) / 15);
      currentPrice = basePrice * (1 + step * 0.08) + (Math.sin(i / 2) * (basePrice * 0.01));
    } else if (trendType === 'ma_trend') {
      currentPrice += (basePrice * 0.004 + (Math.random() - 0.45) * (basePrice * 0.008));
    } else {
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
const STOCKS_DATABASE_TW: StockData[] = [
  {
    symbol: '3231',
    name: '緯創',
    probability: 92.4,
    triggerType: '投信鎖碼 + VCP突破',
    rsRating: 94,
    epsAcceleration: '+42.1% YoY (連續2季加速)',
    sitcaForce: '1.85% (近5日買超佔股本)',
    chipConcentration: '14.8% (20日籌碼集中度)',
    currentPrice: 132.5,
    targetPrice: 198.8,
    stopLoss: 112.6,
    theme: 'AI 伺服器代工 / 水冷模組整合',
    features: [
      { name: '投信近5日鎖碼力道 (SITCA Force)', value: 22.5, type: 'positive' },
      { name: '營收年增率增幅加速 (Rev Acc)', value: 18.2, type: 'positive' },
      { name: 'VCP 波動收縮型態突破 (VCP Setup)', value: 15.8, type: 'positive' },
      { name: '千張大戶持股比例增加 (Large Holder)', value: 11.4, type: 'positive' },
      { name: '大盤季線反壓拖累 (Market Drag)', value: -3.5, type: 'negative' }
    ],
    chartData: generateMockChartData(132, 'vcp')
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
    currentPrice: 2390.0,
    targetPrice: 3585.0,
    stopLoss: 2031.5,
    theme: 'AI GPU 液冷散熱系統 / 3D VC 獨家供應商',
    features: [
      { name: '營收年增率營收加速 (Rev Acc)', value: 28.5, type: 'positive' },
      { name: '毛利與營業利益率三率三升 (Margin Expansion)', value: 20.1, type: 'positive' },
      { name: '投信持續鎖碼買超 (SITCA Force)', value: 12.4, type: 'positive' },
      { name: '相對強度創波段新高 (RS Breakout)', value: 9.8, type: 'positive' },
      { name: '本益比處於歷史偏高區間 (Valuation Drag)', value: -6.5, type: 'negative' }
    ],
    chartData: generateMockChartData(2390, 'rev_acc')
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
    currentPrice: 2205.0,
    targetPrice: 3307.5,
    stopLoss: 1874.2,
    theme: 'CoWoS 先進封裝 / 3奈米製程產能滿載',
    features: [
      { name: '半導體先進製程產業龍頭 (Industry Lead)', value: 25.0, type: 'positive' },
      { name: '毛利率與股東權益報酬率優異 (Margin Quality)', value: 18.2, type: 'positive' },
      { name: '外資與長線主權基金連續增持 (Foreign Inflow)', value: 15.5, type: 'positive' },
      { name: '日線/週線均線完美多頭排列 (MA Trend)', value: 8.7, type: 'positive' },
      { name: '股本龐大拉抬所需資金量極高 (Liquidity Drag)', value: -7.2, type: 'negative' }
    ],
    chartData: generateMockChartData(2200, 'ma_trend')
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
    currentPrice: 4430.0,
    targetPrice: 6645.0,
    stopLoss: 3765.5,
    theme: '美系 CSP 巨頭客製化 ASIC / 矽智財 (IP)',
    features: [
      { name: 'VCP 波動收縮完畢放量突破 (VCP Setup)', value: 24.1, type: 'positive' },
      { name: '主力分點籌碼高度集中 (Chip Conc)', value: 20.5, type: 'positive' },
      { name: '季度 EPS 增幅再度加速 (Rev Acc)', value: 12.8, type: 'positive' },
      { name: '投信法人重啟加碼建倉 (SITCA Force)', value: 11.2, type: 'positive' },
      { name: '千元高價股流動性溢價降低 (Price Liquidity)', value: -4.8, type: 'negative' }
    ],
    chartData: generateMockChartData(4430, 'vcp')
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
    currentPrice: 818.0,
    targetPrice: 1227.0,
    stopLoss: 695.3,
    theme: 'AI 伺服器 ABF 載板 / 下半年出貨爆發',
    features: [
      { name: '投信卡位打底築底期 (SITCA Force)', value: 21.4, type: 'positive' },
      { name: '第一階段底部橫盤放量突破 (Stage 1 Floor)', value: 15.6, type: 'positive' },
      { name: '毛利率落底回升確立 (Gross Margin YoY)', value: 12.4, type: 'positive' },
      { name: '外資與投信聯手同步買超 (Institutional Align)', value: 8.2, type: 'positive' },
      { name: '上方年線反壓蓋頂待消化 (MA Resistance)', value: -6.5, type: 'negative' }
    ],
    chartData: generateMockChartData(818, 'bottom')
  }
];

// --- 五檔美股高成長潛力標的數據 (模擬用) ---
const STOCKS_DATABASE_US: StockData[] = [
  {
    symbol: 'NVDA',
    name: '輝達 (NVIDIA)',
    probability: 94.6,
    triggerType: '低空頭+高機構+VCP突破',
    rsRating: 98,
    epsAcceleration: '+268.4% YoY (超級增長)',
    sitcaForce: '1.24% (券商融券比率)',
    chipConcentration: '73.2% (機構總持倉)',
    currentPrice: 222.3,
    targetPrice: 333.5,
    stopLoss: 189.0,
    theme: 'AI 晶片絕對霸王 / Blackwell 全面量產',
    features: [
      { name: 'AI 伺服器與晶片絕對優勢 (AI Dominance)', value: 28.5, type: 'positive' },
      { name: '機構買超籌碼鎖死 (Inst Buy)', value: 22.1, type: 'positive' },
      { name: 'VCP 波動極窄幅收縮突破 (VCP Breakout)', value: 18.4, type: 'positive' },
      { name: '季營收超預期暴增 (Revenue Blowout)', value: 15.2, type: 'positive' },
      { name: '大盤半導體指數修正拖累 (Sector Drag)', value: -4.2, type: 'negative' }
    ],
    chartData: generateMockChartData(222, 'vcp')
  },
  {
    symbol: 'PLTR',
    name: '帕蘭泰爾 (Palantir)',
    probability: 91.2,
    triggerType: '高成長爆發 + 產業主流',
    rsRating: 96,
    epsAcceleration: '+48.5% YoY (季報連續加速)',
    sitcaForce: '4.85% (券商融券比率)',
    chipConcentration: '62.4% (機構總持倉)',
    currentPrice: 135.1,
    targetPrice: 202.7,
    stopLoss: 114.8,
    theme: 'AIP 商業平台企業級訂單暴增 / AI 軟體決策龍頭',
    features: [
      { name: '商業 AIP 軟體合約高速增長 (AIP Growth)', value: 25.4, type: 'positive' },
      { name: '標普 500 指數納入溢價效應 (S&P 500 Inflow)', value: 16.8, type: 'positive' },
      { name: '機構連續兩個季度增倉 (Inst Lock)', value: 14.2, type: 'positive' },
      { name: '毛利率高達 82% 冠絕同行 (Software Margin)', value: 12.5, type: 'positive' },
      { name: '融券空頭回補軋空效應 (Short Cover)', value: 8.4, type: 'positive' }
    ],
    chartData: generateMockChartData(135, 'rev_acc')
  },
  {
    symbol: 'MSTR',
    name: '微策投資 (MicroStrategy)',
    probability: 89.2,
    triggerType: '高空頭軋空突破',
    rsRating: 94,
    epsAcceleration: '高利潤擴張中',
    sitcaForce: '12.85% (高融券比率！)',
    chipConcentration: '54.2% (機構總持倉)',
    currentPrice: 166.6,
    targetPrice: 249.9,
    stopLoss: 141.6,
    theme: '比特幣最大儲備機構 / 加密貨幣大牛市影子股',
    features: [
      { name: '比特幣價格暴漲溢價 (Bitcoin leverage)', value: 32.4, type: 'positive' },
      { name: '超高融券比例引發軋空潮 (Short Squeeze)', value: 25.8, type: 'positive' },
      { name: 'VCP 形態突破底部頸線 (VCP Stage 1)', value: 18.2, type: 'positive' },
      { name: '大盤環境波動回檔壓制 (Beta Overload)', value: -9.5, type: 'negative' }
    ],
    chartData: generateMockChartData(166, 'vcp')
  },
  {
    symbol: 'TSM',
    name: '台積電 ADR (TSMC)',
    probability: 87.5,
    triggerType: '均線多頭 + 產業主流',
    rsRating: 91,
    epsAcceleration: '+35.8% YoY (先進製程霸主)',
    sitcaForce: '0.85% (券商融券比率)',
    chipConcentration: '82.8% (機構總持倉)',
    currentPrice: 396.0,
    targetPrice: 594.0,
    stopLoss: 336.6,
    theme: 'CoWoS 產能吃緊 / 3nm 與 2nm 先進封裝供不應求',
    features: [
      { name: '先進製程與封裝完全壟斷 (Tech Monopoly)', value: 26.5, type: 'positive' },
      { name: '蘋果與輝達產能全包鎖碼 (Customer Power)', value: 18.4, type: 'positive' },
      { name: '美股 ADR 資金流入強勁 (ADR Premium)', value: 12.8, type: 'positive' },
      { name: '資本支出大增反映旺盛需求 (CapEx Boost)', value: 11.2, type: 'positive' },
      { name: '地緣政治溢價折扣壓制 (Geo Drag)', value: -6.8, type: 'negative' }
    ],
    chartData: generateMockChartData(396, 'ma_trend')
  },
  {
    symbol: 'VRT',
    name: '維諦技術 (Vertiv)',
    probability: 85.4,
    triggerType: '高成長爆發 + 產業主流',
    rsRating: 93,
    epsAcceleration: '+61.2% YoY (連續4季加速)',
    sitcaForce: '2.12% (券商融券比率)',
    chipConcentration: '88.5% (機構總持倉)',
    currentPrice: 339.7,
    targetPrice: 509.5,
    stopLoss: 288.7,
    theme: 'AI 資料中心液冷散熱模組唯一領導者 / 訂單能見度極高',
    features: [
      { name: '液冷散熱模組高成長能見度 (Cooling Demand)', value: 24.5, type: 'positive' },
      { name: '季度利潤率顯著擴張 (Margin Expansion)', value: 16.8, type: 'positive' },
      { name: '千張大戶機構高持股穩定 (Inst Control)', value: 15.2, type: 'positive' },
      { name: '日 K 線 20MA 多頭完美支撐 (MA Trend)', value: 9.5, type: 'positive' },
      { name: '銅原料等供應鏈成本上升 (Margin Cost)', value: -3.8, type: 'negative' }
    ],
    chartData: generateMockChartData(339, 'rev_acc')
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
  const [marketType, setMarketType] = useState<'TW' | 'US'>('TW');
  
  // 核心數據庫狀態
  const [stocks, setStocks] = useState<StockData[]>(STOCKS_DATABASE_TW);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('2330');
  const [filterType, setFilterType] = useState<string>('all');
  
  const [isRealData, setIsRealData] = useState<boolean>(false);
  const [scanTime, setScanTime] = useState<string>('');
  const [modelAuc, setModelAuc] = useState<number | null>(null);
  const [backtestData, setBacktestData] = useState<any>(null);
  const [stockCount, setStockCount] = useState<number>(STOCKS_DATABASE_TW.length);
  const [loading, setLoading] = useState<boolean>(false);

  // 當市場類型 (TW/US) 或初始載入時，動態從 Supabase 讀取對應的日報表結果
  useEffect(() => {
    async function loadFromSupabase() {
      setLoading(true);
      const tableName = marketType === 'TW' ? 'alphafalcon_daily_results' : 'alphafalcon_us_daily_results';
      const jsonPath = marketType === 'TW' ? '/data/alphafalcon_results.json' : '/data/alphafalcon_us_results.json';
      const mockDatabase = marketType === 'TW' ? STOCKS_DATABASE_TW : STOCKS_DATABASE_US;
      
      try {
        let results: StockData[] = [];
        let meta: any = {};
        let backtest: any = null;
        let loaded = false;

        // 1. 優先嘗試從靜態 JSON 加載 (極速且免資料庫連接)
        try {
          const res = await fetch(jsonPath);
          if (res.ok) {
            const staticData = await res.json();
            if (staticData && staticData.results) {
              results = typeof staticData.results === 'string' ? JSON.parse(staticData.results) : staticData.results;
              meta = typeof staticData.meta === 'string' ? JSON.parse(staticData.meta) : (staticData.meta || {});
              if (staticData.scan_date) meta.scan_date = staticData.scan_date;
              if (staticData.backtest) backtest = staticData.backtest;
              loaded = true;
              console.log(`[AlphaFalcon-${marketType}] 成功自靜態 JSON 加載最新數據`);
            }
          }
        } catch (jsonErr) {
          console.log(`[AlphaFalcon-${marketType}] 靜態 JSON 加載失敗，嘗試回退至 Supabase:`, jsonErr);
        }

        // 2. 若靜態 JSON 未成功加載，則回退至 Supabase 讀取
        if (!loaded) {
          const { data, error } = await supabase
            .from(tableName)
            .select('scan_date, results, meta')
            .order('scan_date', { ascending: false })
            .limit(1)
            .single();

          if (error || !data) {
            throw new Error(`Supabase ${tableName} 沒有數據`);
          }

          results = typeof data.results === 'string' ? JSON.parse(data.results) : data.results;
          meta = typeof data.meta === 'string' ? JSON.parse(data.meta) : (data.meta || {});
          if (data.backtest) backtest = typeof data.backtest === 'string' ? JSON.parse(data.backtest) : data.backtest;
          loaded = true;
          console.log(`[AlphaFalcon-${marketType}] 成功自 Supabase 加載數據`);
        }

        if (results && results.length > 0) {
          setStocks(results);
          setIsRealData(true);
          // 確保選中的 symbol 在新數據中存在，否則預設選第一個
          if (!results.some(s => s.symbol === selectedSymbol)) {
            setSelectedSymbol(results[0].symbol);
          }
          setStockCount(results.length);
          if (meta.scanTime) setScanTime(meta.scanTime);
          else if (meta.scan_date) setScanTime(meta.scan_date + " 16:30");
          if (meta.modelAuc) setModelAuc(meta.modelAuc);
          
          if (backtest) {
            setBacktestData(typeof backtest === 'string' ? JSON.parse(backtest) : backtest);
          } else {
            setBacktestData(null);
          }
        } else {
          throw new Error('結果數為 0');
        }
      } catch (err) {
        console.log(`[AlphaFalcon-${marketType}] 啟用高保真模擬數據模式:`, err);
        // 回退至本地預設數據
        setStocks(mockDatabase);
        setIsRealData(false);
        setSelectedSymbol(mockDatabase[0].symbol);
        setStockCount(mockDatabase.length);
        setScanTime(marketType === 'TW' ? '2026-05-18 16:30' : '2026-05-18 04:30');
        setModelAuc(marketType === 'TW' ? 0.7834 : 0.8124);
        setBacktestData(null);
      } finally {
        setLoading(false);
      }
    }
    
    loadFromSupabase();
  }, [marketType]);
  
  // 當前選中的個股數據物件
  const activeStock = useMemo(() => {
    return stocks.find(s => s.symbol === selectedSymbol) || stocks[0];
  }, [selectedSymbol, stocks]);

  // 過濾篩選
  const filteredStocks = useMemo(() => {
    if (filterType === 'all') return stocks;
    if (filterType === 'vcp') return stocks.filter(s => s.triggerType.includes('VCP') || s.triggerType.includes('圖表'));
    if (filterType === 'chip') return stocks.filter(s => s.triggerType.includes('鎖碼') || s.triggerType.includes('集中') || s.triggerType.includes('機構') || s.triggerType.includes('空頭'));
    if (filterType === 'fundamental') return stocks.filter(s => s.triggerType.includes('營收') || s.triggerType.includes('三率三升') || s.triggerType.includes('成長') || s.triggerType.includes('利潤'));
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
        <header className="flex justify-between items-center" style={{ marginBottom: '2.5rem', flexWrap: 'wrap', gap: '1.5rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00F2FE', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              <Sparkles size={16} className="sparkle-pulse" />
              <span>ALPHAFALCON QUANT RADAR TERMINAL · DUAL-MARKET</span>
            </div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, textShadow: '0 0 20px rgba(0, 242, 254, 0.15)' }}>
              AlphaFalcon 量化預測終端
            </h1>
            <p style={{ color: '#9ca3af', marginTop: '0.5rem' }}>
              融合多維量化因子與 AI 預估模型，捕捉台股及美股大盤中未來 6 個月最具爆發力的飆股標的。
            </p>
          </div>
          
          {/* 台美雙市場一鍵切換 Tab */}
          <div className="market-switch-container">
            <button 
              className={`market-switch-btn ${marketType === 'TW' ? 'active' : ''}`}
              onClick={() => setMarketType('TW')}
            >
              <Globe size={14} />
              <span>台股量化雷達</span>
            </button>
            <button 
              className={`market-switch-btn ${marketType === 'US' ? 'active' : ''}`}
              onClick={() => setMarketType('US')}
            >
              <Sparkles size={14} />
              <span>美股 AI 雷達</span>
            </button>
          </div>
          
          <div className="flex flex-col items-end gap-2">
            {/* 即時狀態徽章 */}
            <div className="flex items-center gap-2" style={{ backgroundColor: isRealData ? 'rgba(16, 185, 129, 0.08)' : 'rgba(0, 242, 254, 0.08)', border: isRealData ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(0, 242, 254, 0.25)', padding: '6px 14px', borderRadius: '20px' }}>
              <span className="pulse-dot" style={{ backgroundColor: isRealData ? '#10b981' : '#00F2FE' }}></span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: isRealData ? '#10b981' : 'var(--af-cyan)', fontFamily: 'var(--font-mono)' }}>
                {isRealData ? `盤後 AI 掃描 · ${marketType === 'TW' ? '台股連線中' : '美股連線中'}` : 'Demo · 靜態高保真數據'}
              </span>
            </div>
            {/* AI 模型版本徽章 */}
            {modelAuc && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: 'rgba(168, 85, 247, 0.08)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '4px 12px', borderRadius: '12px' }}>
                <Activity size={12} color="#a855f7" />
                <span style={{ fontSize: '0.75rem', color: '#a855f7', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                  {marketType === 'TW' ? 'RF + Triple Barrier' : 'Heuristics-US'} · AUC {modelAuc.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* AI 大腦資訊橫向統計列 */}
        <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '2rem', padding: '0.875rem 1.25rem', backgroundColor: 'rgba(17, 19, 23, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Compass size={14} color="var(--af-cyan)" />
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>監控宇宙</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#f9fafb', fontFamily: 'var(--font-mono)' }}>{stockCount} 檔</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={14} color="var(--af-gold)" />
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>策略停損</span>
            <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#ffbd59', fontFamily: 'var(--font-mono)' }}>-15%</span>
          </div>
          <div style={{ width: '1px', height: '16px', backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={14} color="var(--af-green)" />
            <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>目標利潤</span>
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
                <span style={{ fontSize: '0.8125rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>掃描時間</span>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#f9fafb', fontFamily: 'var(--font-mono)' }}>{scanTime}</span>
              </div>
            </>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>數據源</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--af-cyan)', fontFamily: 'var(--font-mono)' }}>
              {marketType === 'TW' ? 'TWSE · TPEx · yfinance · 投信' : 'NYSE · NASDAQ · S&P 500 · yfinance'}
            </span>
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
                <button className={`chip ${filterType === 'chip' ? 'active' : ''}`} onClick={() => setFilterType('chip')}>
                  {marketType === 'TW' ? '投信鎖碼 / 籌碼集中' : '機構持倉 / 高空頭軋空'}
                </button>
                <button className={`chip ${filterType === 'fundamental' ? 'active' : ''}`} onClick={() => setFilterType('fundamental')}>
                  {marketType === 'TW' ? '營收爆發 / 三率三升' : '高成長爆發 / 超級季報'}
                </button>
              </div>
              <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
                共篩選出 <strong style={{ color: '#00F2FE' }}>{filteredStocks.length}</strong> 檔符合暴漲潛力標的
              </p>
            </div>

            {/* 預測卡片網格 */}
            {loading ? (
              <div style={{ textAlign: 'center', padding: '5rem', color: '#9ca3af' }}>
                <RefreshCw size={24} className="sparkle-pulse" style={{ margin: '0 auto 1rem' }} />
                <p>AI 量化數據載入中...</p>
              </div>
            ) : (
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
                        <p className="metric-label">相對強度強度 (RS)</p>
                        <p className="metric-value">第 {stock.rsRating} 百分位</p>
                      </div>
                      <div>
                        <p className="metric-label">{marketType === 'TW' ? '投信5日鎖碼' : '軋空回補比率 (Short)'}</p>
                        <p className="metric-value">{stock.sitcaForce}</p>
                      </div>
                      <div>
                        <p className="metric-label">當前市價</p>
                        <p className="metric-value" style={{ fontWeight: 700 }}>
                          {marketType === 'TW' ? 'NT$' : 'US$'} {stock.currentPrice}
                        </p>
                      </div>
                    </div>

                    <div className="card-footer">
                      <span>點擊進入深度 AI 診斷</span>
                      <ChevronRight size={14} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* -------------------- TAB 2: 個股 AI 診斷室 -------------------- */}
        {activeTab === 'insights' && activeStock && (
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
                    <span className="detail-label">{marketType === 'TW' ? '季度 EPS 加速度' : '季度營收增速 (YoY)'}</span>
                    <span className="detail-val" style={{ color: '#4FACFE', fontWeight: 500 }}>{activeStock.epsAcceleration}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{marketType === 'TW' ? '投信5日籌碼力道' : '軋空回補比率 (Short)'}</span>
                    <span className="detail-val">{activeStock.sitcaForce}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">{marketType === 'TW' ? '分點20日籌碼集中度' : '機構大咖持股比例'}</span>
                    <span className="detail-val">{activeStock.chipConcentration}</span>
                  </div>
                </div>

                <div className="divider" style={{ margin: '1.5rem 0' }}></div>

                {/* 操作風控參數 */}
                <h4 style={{ fontSize: '0.875rem', color: '#9ca3af', marginBottom: '1rem', fontWeight: 600 }}>風控與操作目標（系統自動計算）</h4>
                <div className="risk-grid">
                  <div className="risk-card target">
                    <p className="risk-lbl">6個月目標價 (+50%)</p>
                    <p className="risk-val">
                      {marketType === 'TW' ? 'NT$' : 'US$'} {activeStock.targetPrice}
                    </p>
                  </div>
                  <div className="risk-card stop">
                    <p className="risk-lbl">風控止損價 (-15%)</p>
                    <p className="risk-val">
                      {marketType === 'TW' ? 'NT$' : 'US$'} {activeStock.stopLoss}
                    </p>
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
                      {activeStock.name} ({activeStock.symbol}) 60日走勢圖與大盤對照
                    </h3>
                    <p style={{ fontSize: '0.8125rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                      對比大盤基準：{marketType === 'TW' ? '台灣加權指數 (^TWII)' : '美股標普 500 指數 (^GSPC)'}
                    </p>
                  </div>
                  <div className="flex gap-4" style={{ fontSize: '0.8125rem' }}>
                    <div className="flex items-center gap-2">
                      <span className="chart-legend-dot" style={{ backgroundColor: '#00F2FE' }}></span>
                      <span>個股股價走勢</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="chart-legend-dot" style={{ backgroundColor: '#64748b' }}></span>
                      <span>平滑大盤基準線</span>
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
                          return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : str;
                        }}
                        minTickGap={25}
                      />
                      <YAxis 
                        stroke="#6b7280" 
                        fontSize={11} 
                        tickLine={false} 
                        axisLine={false}
                        domain={['auto', 'auto']}
                        tickFormatter={(val) => `${marketType === 'TW' ? 'NT$' : '$'}${val}`}
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
                        name="大盤指數對比"
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
                    數值代表該特徵指標對「上漲 50% 的預測機率」所帶來的百分點增減效應。
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
                        width={210}
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
                <p className="lbl">{marketType === 'TW' ? '台股回測總收益率 (5年累計)' : '美股回測總收益率 (5年累計)'}</p>
                <p className="val text-glow">{backtestData ? `+${backtestData.totalReturn}%` : (marketType === 'TW' ? '+1012.0%' : '+1482.5%')}</p>
                <div className="badge up">超越標普大盤 {marketType === 'TW' ? '9.1' : '12.4'} 倍</div>
              </div>
              <div className="glass-card stat-box">
                <p className="lbl">年化收益率 (CAGR)</p>
                <p className="val">{backtestData ? `+${backtestData.cagr}%` : (marketType === 'TW' ? '+57.4%' : '+68.2%')}</p>
                <div className="badge up">同類型策略 Top 1%</div>
              </div>
              <div className="glass-card stat-box">
                <p className="lbl">歷史最大回撤 (MDD)</p>
                <p className="val error-glow">{backtestData ? `${backtestData.maxDrawdown}%` : (marketType === 'TW' ? '-18.6%' : '-21.4%')}</p>
                <div className="badge down">極致風控過濾</div>
              </div>
              <div className="glass-card stat-box">
                <p className="lbl">預測成功率 (Win Rate)</p>
                <p className="val">{backtestData ? `${backtestData.winRate}%` : (marketType === 'TW' ? '74.2%' : '76.8%')}</p>
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
                    時間區間：2021-01 至 2026-05。初始資金以 1.0 縮放，對比基準指數表現。
                  </p>
                </div>

                <div style={{ width: '100%', height: '320px' }}>
                  <ResponsiveContainer>
                    <LineChart data={backtestData ? backtestData.equityCurve : BACKTEST_EQUITY_CURVE}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#161e2e" vertical={false} />
                      <XAxis dataKey="date" stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#6b7280" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(val) => `${val}x`} />
                      <Tooltip contentStyle={{ backgroundColor: '#0d131f', border: '1px solid #1f2a3f', borderRadius: '10px' }} />
                      <Line type="monotone" dataKey="value" name="AlphaFalcon 策略" stroke="#00F2FE" strokeWidth={3} dot={{ r: 2 }} activeDot={{ r: 6 }} />
                      <Line type="monotone" dataKey="benchmark_value" name={marketType === 'TW' ? '加權指數' : '標普 500'} stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
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
                        <th style={{ textAlign: 'right' }}>{marketType === 'TW' ? '加權指數' : '標普 500'}</th>
                        <th style={{ textAlign: 'right' }}>超額收益</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(backtestData ? backtestData.annualReturns : BACKTEST_PERFORMANCE).map((p: any) => {
                        const alpha = p.return * (backtestData ? 100 : (marketType === 'TW' ? 100 : 115));
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
                {backtestData && backtestData.starRecords ? (
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
                      {backtestData.starRecords.map((record: any, idx: number) => (
                        <tr key={idx}>
                          <td><span className="stock-symbol-tag">{record.symbol}</span> {record.name}</td>
                          <td>{record.date}</td>
                          <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00F2FE' }}>{record.probability}%</td>
                          <td>{record.triggerType}</td>
                          <td style={{ textAlign: 'right' }}>{marketType === 'TW' ? 'NT$' : 'US$'} {record.entryPrice}</td>
                          <td style={{ textAlign: 'right' }}>{marketType === 'TW' ? 'NT$' : 'US$'} {record.peakPrice}</td>
                          <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>+{record.gain}%</td>
                          <td style={{ textAlign: 'center' }}><span className="success-tag">{record.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : marketType === 'TW' ? (
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
                    </tbody>
                  </table>
                ) : (
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
                        <td><span className="stock-symbol-tag">NVDA</span> 輝達</td>
                        <td>2023-05-24</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00F2FE' }}>92.5%</td>
                        <td>超級季報 + VCP突破</td>
                        <td style={{ textAlign: 'right' }}>US$ 305.0</td>
                        <td style={{ textAlign: 'right' }}>US$ 974.0</td>
                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>+219.3%</td>
                        <td style={{ textAlign: 'center' }}><span className="success-tag">成功達標</span></td>
                      </tr>
                      <tr>
                        <td><span className="stock-symbol-tag">PLTR</span> 帕蘭泰爾</td>
                        <td>2024-02-06</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00F2FE' }}>86.4%</td>
                        <td>AIP爆發 + 機構加碼</td>
                        <td style={{ textAlign: 'right' }}>US$ 16.8</td>
                        <td style={{ textAlign: 'right' }}>US$ 45.0</td>
                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>+167.8%</td>
                        <td style={{ textAlign: 'center' }}><span className="success-tag">成功達標</span></td>
                      </tr>
                      <tr>
                        <td><span className="stock-symbol-tag">SMCI</span> 美超微</td>
                        <td>2023-11-15</td>
                        <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#00F2FE' }}>88.2%</td>
                        <td>液冷散熱 VCP 頸線突破</td>
                        <td style={{ textAlign: 'right' }}>US$ 265.0</td>
                        <td style={{ textAlign: 'right' }}>US$ 1229.0</td>
                        <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 'bold' }}>+363.7%</td>
                        <td style={{ textAlign: 'center' }}><span className="success-tag">成功達標</span></td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </section>
        )}

      </div>

      {/* --- Glassmorphism 專用 CSS 樣式定義 --- */}
      <style jsx>{`
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

        .pulse-dot {
          width: 8px;
          height: 8px;
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

        /* 雙市場切換 CSS */
        .market-switch-container {
          display: flex;
          background: rgba(17, 22, 33, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.08);
          padding: 4px;
          border-radius: 20px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        }

        .market-switch-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: transparent;
          color: #9ca3af;
          border: none;
          padding: 6px 16px;
          font-size: 0.8125rem;
          font-weight: 700;
          cursor: pointer;
          border-radius: 16px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .market-switch-btn:hover {
          color: #ffffff;
        }

        .market-switch-btn.active {
          color: #ffffff;
          background: rgba(0, 242, 254, 0.12);
          box-shadow: inset 0 0 8px rgba(0, 242, 254, 0.15);
          border: 1px solid rgba(0, 242, 254, 0.25);
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
