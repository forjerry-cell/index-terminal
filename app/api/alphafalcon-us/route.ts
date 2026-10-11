import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // 1. 安全驗證：比對 API 密鑰與 ADMIN_PASSWORD
    const apiSecret = request.headers.get('x-api-secret');
    const expectedSecret = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!apiSecret || apiSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Unauthorized: Invalid API secret' }, { status: 401 });
    }

    // 2. 取得 Body 內容
    const body = await request.json();
    const { scan_date, results, meta } = body;

    if (!scan_date || !results || !meta) {
      return NextResponse.json({ error: 'Bad Request: Missing required fields' }, { status: 400 });
    }

    // 3. 建立伺服器端 Supabase Client (使用後端環境變數)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // 4. 執行安全 Upsert
    const { data, error } = await supabase
      .from('alphafalcon_us_daily_results')
      .upsert({
        scan_date,
        results: typeof results === 'string' ? results : JSON.stringify(results),
        meta: typeof meta === 'string' ? meta : JSON.stringify(meta)
      }, {
        onConflict: 'scan_date'
      });

    if (error) {
      console.error('Next.js API Supabase Write Error:', error.message);
      return NextResponse.json({ error: `Database Write Error: ${error.message}` }, { status: 500 });
    }

    console.log(`[Next.js API] Successfully updated US stock results for date: ${scan_date}`);

    // 5. 寫入預測追蹤日誌（前 5 名，不可竄改、不可回填）
    // scanner 經 GitHub Actions 呼叫本 relay 時一併完成記錄，避免 scanner 端 service key 失效問題。
    // 即使此步驟失敗也不影響主流程回應。
    try {
      const list = Array.isArray(results) ? results : JSON.parse(results as unknown as string);
      const top5 = [...list]
        .sort((a: any, b: any) => Number(b?.probability ?? 0) - Number(a?.probability ?? 0))
        .slice(0, 5)
        .map((r: any) => ({
          market: 'US',
          scan_date,
          symbol: String(r?.symbol ?? '').trim(),
          name: r?.name ?? '',
          score: Math.round(Number(r?.probability ?? 0) * 100) / 100,
          trigger_type: r?.triggerType ?? '',
          entry_price: Math.round(Number(r?.currentPrice ?? 0) * 100) / 100,
        }))
        .filter((r: any) => r.symbol && r.entry_price > 0);
      if (top5.length > 0) {
        const { error: logErr } = await supabase
          .from('alphafalcon_predictions')
          .upsert(top5, { onConflict: 'market,scan_date,symbol' });
        if (logErr) {
          console.error('[Next.js API] Prediction log write failed:', logErr.message);
        } else {
          console.log(`[Next.js API] Prediction log written: ${top5.length} rows for ${scan_date}`);
        }
      }
    } catch (logEx: any) {
      console.error('[Next.js API] Prediction log exception:', logEx?.message ?? logEx);
    }

    return NextResponse.json({ success: true, message: `US stock scan results updated for ${scan_date}` });

  } catch (err: any) {
    console.error('Next.js API Server Error:', err.message);
    return NextResponse.json({ error: `Internal Server Error: ${err.message}` }, { status: 500 });
  }
}
