'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import Navbar from '@/components/Navbar';
import { Upload, Loader2, AlertCircle, Shield } from 'lucide-react';

interface ScrapedData {
  strategyName: string;
  product: string;
  position: number;
  price: string;
  triggerTime: string;
}

interface SummaryData {
  product: string;
  totalPosition: number;
}

interface CloudSyncPayload {
  strategy_list?: string;
  strategy_data?: ScrapedData[];
  strategy_summary?: SummaryData[];
  strategy_last_updated?: string;
}

const LOCAL_STORAGE_KEYS = {
  names: 'system_display_names',
  detail: 'system_detail_data',
  summary: 'system_summary_data',
  updatedAt: 'system_last_updated',
} as const;

const ADMIN_EMAIL = 'forjerry@gmail.com';

function parseNames(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

function computeSummary(data: ScrapedData[]): SummaryData[] {
  const summaryMap: Record<string, number> = {};
  data.forEach((item) => {
    if (!summaryMap[item.product]) summaryMap[item.product] = 0;
    summaryMap[item.product] += Number(item.position || 0);
  });

  return Object.keys(summaryMap).map((product) => ({
    product,
    totalPosition: summaryMap[product],
  }));
}

function saveCacheToLocal(names: string[], detail: ScrapedData[], summary: SummaryData[], lastUpdated: string) {
  localStorage.setItem(LOCAL_STORAGE_KEYS.names, JSON.stringify(names));
  localStorage.setItem(LOCAL_STORAGE_KEYS.detail, JSON.stringify(detail));
  localStorage.setItem(LOCAL_STORAGE_KEYS.summary, JSON.stringify(summary));
  localStorage.setItem(LOCAL_STORAGE_KEYS.updatedAt, lastUpdated);
}

async function callSystemCacheApi(method: 'GET' | 'POST', payload?: CloudSyncPayload) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('No active session');

  if (method === 'GET') {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) throw new Error(error?.message || 'failed to load user metadata');
    const metadata = user.user_metadata || {};
    return {
      strategy_list: typeof metadata.strategy_list === 'string' ? metadata.strategy_list : '',
      strategy_data: Array.isArray(metadata.strategy_data) ? metadata.strategy_data : [],
      strategy_summary: Array.isArray(metadata.strategy_summary) ? metadata.strategy_summary : [],
      strategy_last_updated: typeof metadata.strategy_last_updated === 'string' ? metadata.strategy_last_updated : '',
    };
  }

  const { data, error } = await supabase.auth.updateUser({ data: payload || {} });
  if (error) throw new Error(error.message);
  const metadata = data.user?.user_metadata || {};
  return {
    strategy_list: typeof metadata.strategy_list === 'string' ? metadata.strategy_list : '',
    strategy_data: Array.isArray(metadata.strategy_data) ? metadata.strategy_data : [],
    strategy_summary: Array.isArray(metadata.strategy_summary) ? metadata.strategy_summary : [],
    strategy_last_updated: typeof metadata.strategy_last_updated === 'string' ? metadata.strategy_last_updated : '',
  };
}

export default function SystemManagementPage() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

  const [strategyNames, setStrategyNames] = useState<string[]>([]);
  const [detailData, setDetailData] = useState<ScrapedData[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const isFetchingRef = useRef(false);

  const syncToCloud = async (payload: CloudSyncPayload) => {
    setSyncStatus('syncing');
    try {
      await callSystemCacheApi('POST', payload);
      setSyncStatus('synced');
      return true;
    } catch (error) {
      console.error('Cloud sync error:', error);
      setSyncStatus('error');
      return false;
    }
  };

  const fetchData = async (names: string[], options?: { silent?: boolean }) => {
    if (!names || names.length === 0 || isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (!options?.silent) setUploading(true);

    try {
      const response = await fetch('/api/admin-crawler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayNames: names }),
      });

      const result = await response.json();
      if (!result.success || !Array.isArray(result.data)) {
        throw new Error(result.error || 'Crawler failed');
      }

      const data: ScrapedData[] = result.data;
      const summary = computeSummary(data);
      const updatedAt = new Date().toLocaleString('zh-TW', { hour12: false });

      setDetailData(data);
      setSummaryData(summary);
      setLastUpdated(updatedAt);
      saveCacheToLocal(names, data, summary, updatedAt);

      await syncToCloud({
        strategy_list: names.join(','),
        strategy_data: data,
        strategy_summary: summary,
        strategy_last_updated: updatedAt,
      });
    } catch (err) {
      console.error('Fetch error:', err);
      setSyncStatus('error');
    } finally {
      isFetchingRef.current = false;
      if (!options?.silent) setUploading(false);
    }
  };

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || user.email !== ADMIN_EMAIL) {
        setLoading(false);
        return;
      }

      setIsAdmin(true);

      let names: string[] = [];

      const localNamesRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.names);
      if (localNamesRaw) {
        try {
          names = JSON.parse(localNamesRaw);
        } catch {
          names = [];
        }
      }

      const localDetailRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.detail);
      const localSummaryRaw = localStorage.getItem(LOCAL_STORAGE_KEYS.summary);
      const localUpdatedAt = localStorage.getItem(LOCAL_STORAGE_KEYS.updatedAt) || '';

      if (localDetailRaw && localSummaryRaw) {
        try {
          setDetailData(JSON.parse(localDetailRaw));
          setSummaryData(JSON.parse(localSummaryRaw));
          setLastUpdated(localUpdatedAt);
        } catch {
          // Ignore malformed local cache
        }
      }

      try {
        const cloud = await callSystemCacheApi('GET');
        const cloudNames = parseNames(cloud.strategy_list);
        const cloudDetail = Array.isArray(cloud.strategy_data) ? cloud.strategy_data : [];
        const cloudSummary = Array.isArray(cloud.strategy_summary) ? cloud.strategy_summary : [];
        const cloudUpdatedAt = typeof cloud.strategy_last_updated === 'string' ? cloud.strategy_last_updated : '';

        if (cloudNames.length > 0) {
          names = cloudNames;
          localStorage.setItem(LOCAL_STORAGE_KEYS.names, JSON.stringify(cloudNames));
        }

        if (cloudDetail.length > 0) {
          const finalSummary = cloudSummary.length > 0 ? cloudSummary : computeSummary(cloudDetail);
          setDetailData(cloudDetail);
          setSummaryData(finalSummary);
          setLastUpdated(cloudUpdatedAt || localUpdatedAt);

          localStorage.setItem(LOCAL_STORAGE_KEYS.detail, JSON.stringify(cloudDetail));
          localStorage.setItem(LOCAL_STORAGE_KEYS.summary, JSON.stringify(finalSummary));
          if (cloudUpdatedAt) {
            localStorage.setItem(LOCAL_STORAGE_KEYS.updatedAt, cloudUpdatedAt);
          }
        }
      } catch (error) {
        console.error('Load cloud cache error:', error);
      }

      setStrategyNames(names);
      setLoading(false);

      if (names.length > 0) {
        fetchData(names, { silent: false });
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (strategyNames.length === 0) return;

    const interval = setInterval(() => {
      fetchData(strategyNames, { silent: true });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [strategyNames]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const displayNames = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));

      if (displayNames.length === 0) return;

      setStrategyNames(displayNames);
      localStorage.setItem(LOCAL_STORAGE_KEYS.names, JSON.stringify(displayNames));

      // 先保存名單到雲端，再開始爬蟲，確保跨裝置至少可看到設定名單。
      await syncToCloud({ strategy_list: displayNames.join(',') });
      await fetchData(displayNames);
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  if (loading) {
    return (
      <div className="auth-container">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <main>
        <Navbar forceActive="system" />
        <div className="container flex items-center justify-center" style={{ minHeight: '80vh' }}>
          <div className="card text-center flex-col items-center gap-4">
            <AlertCircle size={48} color="var(--error)" />
            <h2 style={{ marginTop: '1rem' }}>權限不足</h2>
            <p>本功能僅系統管理員可以使用。</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main>
      <Navbar forceActive="system" />
      <div className="container" style={{ paddingTop: '2.5rem', paddingBottom: '5rem' }}>
        <header className="flex justify-between items-center" style={{ marginBottom: '2.5rem' }}>
          <div>
            <h1 className="animate-fade">系統管理與部位分析</h1>
            <div className="flex items-center gap-4 animate-fade" style={{ animationDelay: '0.1s' }}>
              <p>自動爬取策略部位狀態並進行彙總統計</p>
              {lastUpdated && (
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    background: 'var(--glass)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                  }}
                >
                  最後更新: {lastUpdated} (每 5 分鐘自動刷新)
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-4 items-center">
            {syncStatus !== 'idle' && (
              <div
                className="flex items-center gap-1"
                style={{
                  fontSize: '0.8rem',
                  color:
                    syncStatus === 'synced'
                      ? 'var(--accent-secondary)'
                      : syncStatus === 'error'
                        ? 'var(--error)'
                        : 'var(--text-muted)',
                }}
              >
                {syncStatus === 'syncing' ? <Loader2 className="animate-spin" size={14} /> : <Shield size={14} />}
                {syncStatus === 'synced' ? '雲端已同步' : syncStatus === 'error' ? '同步失敗' : '同步中...'}
              </div>
            )}
            <label className="btn flex items-center gap-2" style={{ cursor: 'pointer' }}>
              {uploading ? <Loader2 className="animate-spin" size={18} /> : <Upload size={18} />}
              {uploading ? '爬取中...' : '上傳名單 (.txt)'}
              <input type="file" accept=".txt" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
            </label>
          </div>
        </header>

        {detailData.length > 0 && (
          <div className="flex flex-col gap-8 animate-fade">
            <div className="card">
              <h3 style={{ marginBottom: '1rem', color: 'var(--accent)' }}>策略商品部位總計</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: '400px', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>策略商品</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>合計部位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontWeight: 500 }}>{row.product}</td>
                        <td
                          style={{
                            padding: '12px',
                            fontWeight: 700,
                            color:
                              row.totalPosition > 0
                                ? 'var(--accent-secondary)'
                                : row.totalPosition < 0
                                  ? 'var(--error)'
                                  : 'var(--foreground)',
                          }}
                        >
                          {row.totalPosition}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>部位明細資料</h3>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}
                >
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--panel-border)' }}>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>策略名稱</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>策略商品</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>目前部位</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>訊號價格</th>
                      <th style={{ padding: '12px', color: 'var(--text-muted)' }}>觸發時間</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: 'var(--accent)' }}>{row.strategyName}</td>
                        <td style={{ padding: '12px' }}>{row.product}</td>
                        <td
                          style={{
                            padding: '12px',
                            fontWeight: 600,
                            color: row.position > 0 ? 'var(--accent-secondary)' : row.position < 0 ? 'var(--error)' : 'var(--foreground)',
                          }}
                        >
                          {row.position}
                        </td>
                        <td style={{ padding: '12px' }}>{row.price}</td>
                        <td style={{ padding: '12px', color: 'var(--text-muted)' }}>{row.triggerTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
