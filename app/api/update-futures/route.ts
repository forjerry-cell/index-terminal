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
    // 接受新格式 (dayDeal/nightDeal/stwnDeal) 以及舊格式 (tx_price/sgx_price) 向下相容
    const {
      secret,
      session,
      dayDeal,
      nightDeal,
      stwnDeal,
      updatedAt,
      // 舊格式向下相容
      tx_price,
      sgx_price,
      updated_at,
    } = body;

    // 1. 驗證 API 金鑰
    if (secret !== apiSecret) {
      return NextResponse.json({ error: 'Unauthorized: Invalid secret' }, { status: 401 });
    }

    // 2. 整合新舊欄位，優先使用新格式
    const finalDayDeal = dayDeal ?? (session === '日盤' ? tx_price : null) ?? null;
    const finalNightDeal = nightDeal ?? (session === '夜盤' ? tx_price : null) ?? null;
    const finalStwnDeal = stwnDeal ?? sgx_price ?? null;
    const finalUpdatedAt = updatedAt || updated_at || new Date().toISOString();

    // 3. 嘗試使用新欄位名稱寫入 Supabase
    //    若表格尚未 migrate（仍為舊欄位），改用舊欄位寫入作為備援
    let writeError: any = null;

    const { data: newData, error: newError } = await supabase
      .from('futures_prices')
      .upsert([
        {
          id: 1,
          session: session,
          day_deal: finalDayDeal,
          night_deal: finalNightDeal,
          stwn_deal: finalStwnDeal,
          updated_at: finalUpdatedAt,
        },
      ]);

    if (newError) {
      console.warn('新欄位寫入失敗，嘗試舊欄位格式:', newError.message);
      // 備援：用舊欄位寫入（相容未 migrate 的表格）
      const { data: oldData, error: oldError } = await supabase
        .from('futures_prices')
        .upsert([
          {
            id: 1,
            session: session,
            tx_price: tx_price ?? finalDayDeal ?? finalNightDeal,
            sgx_price: sgx_price ?? finalStwnDeal,
            updated_at: finalUpdatedAt,
          },
        ]);
      writeError = oldError;
    }

    if (writeError) {
      console.error('Supabase 寫入失敗:', writeError);
      return NextResponse.json({ error: writeError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}