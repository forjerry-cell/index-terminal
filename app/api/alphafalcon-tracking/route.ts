import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 預測追蹤讀取 API：僅讀取 alphafalcon_predictions 日誌，不做任何績效推斷。
// 命中率由前端按「已結算」樣本計算；樣本為空時前端顯示「累積中」。
export async function GET(req: NextRequest) {
  const market = req.nextUrl.searchParams.get('market') === 'US' ? 'US' : 'TW';
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    return NextResponse.json({ predictions: [], summary: null, error: 'supabase env missing' }, { status: 500 });
  }
  const sb = createClient(url, key);
  const { data, error } = await sb
    .from('alphafalcon_predictions')
    .select('scan_date,symbol,name,score,trigger_type,entry_price,settle_date,exit_price,return_60d,settled')
    .eq('market', market)
    .order('scan_date', { ascending: false })
    .limit(500);
  if (error) {
    return NextResponse.json({ predictions: [], summary: null, error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    predictions: data || [],
    summary: { note: '60 交易日結算 · 命中定義 ≥+15% · 含全部喊過標的（命中與落空）' },
  });
}
