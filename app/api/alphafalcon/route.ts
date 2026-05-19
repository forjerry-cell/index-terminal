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

    // 3. 建立伺服器端 Supabase Client
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
      .from('alphafalcon_daily_results')
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

    console.log(`[Next.js API] Successfully updated TW stock results for date: ${scan_date}`);
    return NextResponse.json({ success: true, message: `TW stock scan results updated for ${scan_date}` });

  } catch (err: any) {
    console.error('Next.js API Server Error:', err.message);
    return NextResponse.json({ error: `Internal Server Error: ${err.message}` }, { status: 500 });
  }
}
