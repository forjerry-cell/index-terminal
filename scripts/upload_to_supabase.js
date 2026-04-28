const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const url = 'https://nnoazshcucwjlccjqtkl.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDgzNzYsImV4cCI6MjA5MjI4NDM3Nn0.FE-onwhqZNBWWdUBoqD1lR-n5So9PbQ9BvjB9pWCz6g';
const sb = createClient(url, key);

async function upload() {
  const csvDir = path.join(__dirname, '..', '..', 'Index', 'supabase_csv');

  console.log('1. Uploading Constituents...');
  const twConst = parse(fs.readFileSync(path.join(csvDir, '03_tw_index_constituents.csv')), { columns: true });
  const nqConst = parse(fs.readFileSync(path.join(csvDir, '05_nq_index_constituents.csv')), { columns: true });
  
  const constituents = [...twConst, ...nqConst].map(r => ({
    index_id: r.index_id,
    symbol: r.symbol,
    name: r.name,
    weight: parseFloat(r.weight),
    date: r.date
  }));
  
  const { error: cErr } = await sb.from('index_constituents').upsert(constituents);
  if (cErr) console.error('Constituent error:', cErr);
  else console.log(`Successfully uploaded ${constituents.length} constituents.`);

  console.log('2. Uploading Performance...');
  const twPerf = parse(fs.readFileSync(path.join(csvDir, '02_tw_index_performance.csv')), { columns: true });
  const nqPerf = parse(fs.readFileSync(path.join(csvDir, '04_nq_index_performance.csv')), { columns: true });

  const performances = [...twPerf, ...nqPerf].map(r => ({
    index_id: r.index_id,
    date: r.date,
    value: parseFloat(r.value) || 0,
    change_percent: parseFloat(r.change_percent) || null,
    benchmark_value: r.benchmark_value === 'NaN' || !r.benchmark_value ? null : parseFloat(r.benchmark_value)
  }));

  // Batch upload to prevent payload size issues
  const batchSize = 1000;
  for (let i = 0; i < performances.length; i += batchSize) {
    const batch = performances.slice(i, i + batchSize);
    const { error: pErr } = await sb.from('index_performance').upsert(batch);
    if (pErr) console.error(`Performance error batch ${i}:`, pErr);
    else console.log(`Uploaded performance batch ${i} to ${i + batch.length}`);
  }
  console.log('Data upload complete!');
}

upload().catch(console.error);
