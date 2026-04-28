/**
 * 補丁腳本：直接將台股 4/22、4/23、4/24 及那指 4/21、4/22、4/23、4/24 的缺失資料插入 Supabase
 * 使用 service_role key 繞過 RLS
 */
const https = require('https');

const SUPABASE_URL = 'nnoazshcucwjlccjqtkl.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDgzNzYsImV4cCI6MjA5MjI4NDM3Nn0.FE-onwhqZNBWWdUBoqD1lR-n5So9PbQ9BvjB9pWCz6g';

// 從 CSV 確認的最新資料（補丁數據）
const MISSING_DATA = [
  // 台股 High Beta
  { index_id: 'taiwan_high_beta', date: '2026-04-22', value: 9.446696, change_percent: 0.914,  benchmark_value: 4.375195 },
  { index_id: 'taiwan_high_beta', date: '2026-04-23', value: 9.273118, change_percent: -1.8374, benchmark_value: 4.356215 },
  { index_id: 'taiwan_high_beta', date: '2026-04-24', value: 9.618965, change_percent: 3.7296,  benchmark_value: 4.49693  },
  // 那指 High Beta
  { index_id: 'nasdaq_high_beta', date: '2026-04-21', value: null, change_percent: null, benchmark_value: null },
  { index_id: 'nasdaq_high_beta', date: '2026-04-22', value: null, change_percent: null, benchmark_value: null },
  { index_id: 'nasdaq_high_beta', date: '2026-04-23', value: null, change_percent: null, benchmark_value: null },
  { index_id: 'nasdaq_high_beta', date: '2026-04-24', value: null, change_percent: null, benchmark_value: null },
];

function upsertRows(rows) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(rows);
    const options = {
      hostname: SUPABASE_URL,
      path: '/rest/v1/index_performance',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
        'Prefer': 'resolution=merge-duplicates,return=minimal'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode} | Body: ${data || '(empty - success)'}`);
        resolve({ status: res.statusCode, data });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 先讀取那指 CSV 取得正確數值
const fs = require('fs');
const path = require('path');

const nqCsvPath = path.join(__dirname, '../../Index/supabase_csv/04_nq_index_performance.csv');
const twCsvPath = path.join(__dirname, '../../Index/supabase_csv/02_tw_index_performance.csv');

function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
  return lines.slice(1).map(line => {
    const [index_id, date, value, change_percent, benchmark_value] = line.split(',');
    return {
      index_id: index_id?.trim(),
      date: date?.trim(),
      value: parseFloat(value),
      change_percent: parseFloat(change_percent),
      benchmark_value: parseFloat(benchmark_value)
    };
  }).filter(r => r.index_id && r.date);
}

async function main() {
  console.log('=== 開始補丁上傳 ===');

  // 讀取台股 CSV
  console.log('\n[1] 讀取台股 CSV...');
  const twData = parseCsv(twCsvPath);
  const twMissing = twData.filter(r => ['2026-04-22','2026-04-23','2026-04-24'].includes(r.date));
  console.log('台股補丁資料：', JSON.stringify(twMissing));

  // 讀取那指 CSV
  console.log('\n[2] 讀取那指 CSV...');
  const nqData = parseCsv(nqCsvPath);
  const nqMissing = nqData.filter(r => ['2026-04-21','2026-04-22','2026-04-23','2026-04-24'].includes(r.date));
  console.log('那指補丁資料：', JSON.stringify(nqMissing));

  // 合併上傳
  const allMissing = [...twMissing, ...nqMissing];
  if (allMissing.length === 0) {
    console.log('\n❌ 找不到缺失資料！請確認 CSV 路徑正確。');
    return;
  }

  console.log(`\n[3] 準備上傳 ${allMissing.length} 筆補丁資料...`);
  const result = await upsertRows(allMissing);
  
  if (result.status === 201 || result.status === 200) {
    console.log('\n✅ 補丁上傳成功！');
  } else {
    console.log('\n❌ 上傳失敗，狀態碼：', result.status);
  }
}

main().catch(console.error);
