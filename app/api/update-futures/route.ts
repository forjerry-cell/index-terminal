import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// 初始化 Supabase Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// 這裡配合你 Vercel 後台設定的變數名稱 API_SECRET_KEY
const apiSecret = process.env.API_SECRET_KEY || 'my_custom_secret_key_123';

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { secret, session, tx_price, sgx_price, updated_at } = body;

    // 1. 驗證 API 金鑰
    if (secret !== apiSecret) {
      return NextResponse.json({ error: 'Unauthorized: Invalid secret' }, { status: 401 });
    }

    // 2. 將行情數據寫入 Supabase (更新 ID 為 1 的最新紀錄)
    const { data, error } = await supabase
      .from('futures_prices')
      .upsert([
        {
          id: 1,
          session: session,
          tx_price: tx_price,
          sgx_price: sgx_price,
          updated_at: updated_at || new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('Supabase 寫入失敗:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}