'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Upload, FileText, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import Papa from 'papaparse';

export default function DataUploader() {
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

  // 處理歷史數據上傳 (Date, Value, BenchmarkValue)
  const handlePerformanceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data, errors } = results;
        if (errors.length > 0) {
          setStatus({ type: 'error', msg: 'CSV 格式錯誤' });
          setUploading(false);
          return;
        }

        // 格式轉換與寫入 (Index ID 預設為 tw_high_beta 範例)
        const formattedData = data.map((row: any) => ({
          index_id: 'taiwan_high_beta',
          date: row.Date,
          value: parseFloat(row.Value),
          benchmark_value: parseFloat(row.Benchmark),
          change_percent: parseFloat(row.Change)
        }));

        const { error } = await supabase.from('index_performance').upsert(formattedData);
        
        setUploading(false);
        if (error) setStatus({ type: 'error', msg: error.message });
        else setStatus({ type: 'success', msg: '歷史數據更新成功！' });
      }
    });
  };

  // 處理今日成分股上傳 (Symbol, Name, Weight)
  const handleConstituentsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    Papa.parse(file, {
      header: true,
      complete: async (results) => {
        const today = new Date().toISOString().split('T')[0];
        const formattedData = results.data.map((row: any) => ({
          index_id: 'taiwan_high_beta',
          symbol: row.Symbol,
          name: row.Name,
          weight: parseFloat(row.Weight),
          date: today
        }));

        const { error } = await supabase.from('index_constituents').upsert(formattedData);
        setUploading(false);
        if (error) setStatus({ type: 'error', msg: error.message });
        else setStatus({ type: 'success', msg: '今日成分股更新成功！' });
      }
    });
  };

  const triggerEmailDispatch = async () => {
     alert('郵件派送指令已發送至後端... (串接 Resend)');
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid-2 gap-6">
        <div className="upload-box card">
          <FileText size={40} color="var(--accent)" />
          <h4>更新指數表現 (Performance)</h4>
          <p>請上傳包含 Date, Value, Benchmark, Change 欄位的 CSV 檔案。</p>
          <input type="file" accept=".csv" onChange={handlePerformanceUpload} hidden id="perf-upload" />
          <label htmlFor="perf-upload" className="btn btn-secondary" style={{ marginTop: '1rem' }}>選擇檔案</label>
        </div>

        <div className="upload-box card">
          <CheckCircle2 size={40} color="var(--accent-secondary)" />
          <h4>更新最新成分股 (Weights)</h4>
          <p>請上傳當日最新的 Symbol, Name, Weight 權重明細。</p>
          <input type="file" accept=".csv" onChange={handleConstituentsUpload} hidden id="const-upload" />
          <label htmlFor="const-upload" className="btn btn-secondary" style={{ marginTop: '1rem' }}>選擇檔案</label>
        </div>
      </div>

      <div className="card flex items-center justify-between" style={{ border: '1px dashed var(--accent)' }}>
        <div>
          <h4 className="flex items-center gap-2"><Send size={20} /> 報表通報測試</h4>
          <p>立即發送今日收盤報表至已訂閱的會員信箱。</p>
        </div>
        <button className="btn" onClick={triggerEmailDispatch}>立即發送</button>
      </div>

      {status && (
        <div className={`tag ${status.type}`} style={{ padding: '1rem', justifyContent: 'center' }}>
          {status.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          {status.msg}
        </div>
      )}

      <style jsx>{`
        .upload-box { text-align: center; padding: 2.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
        .success { background: rgba(16, 185, 129, 0.1); color: var(--accent-secondary); }
        .error { background: rgba(239, 68, 68, 0.1); color: var(--error); }
      `}</style>
    </div>
  );
}
