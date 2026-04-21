import { Resend } from 'resend';
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  // 1. 驗證權限 (可以檢查 Admin Session 或 Cron Token)
  const { secret } = await req.json();
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(0, 10)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 2. 抓取今日數據
    const today = new Date().toISOString().split('T')[0];
    const { data: performance } = await supabase
      .from('index_performance')
      .select('*')
      .eq('date', today);

    const { data: constituents } = await supabase
      .from('index_constituents')
      .select('*')
      .eq('date', today)
      .order('weight', { ascending: false });

    // 3. 抓取訂閱名單
    const { data: subscribers } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('email_subscription', true);

    // 4. 取得用戶 Email (從 Auth Table) - 這裡簡化邏輯
    // 實際上在生產環境會串接 profiles 的 email 欄位或 auth.admin api

    // 5. 生成 HTML (範例)
    const emailHtml = `
      <div style="font-family: sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 20px;">
        <h2 style="color: #3b82f6;">High Beta 指數收盤報表 (${today})</h2>
        <p>親愛的會員，這是今日的市場表現摘要。</p>
        <hr/>
        <div style="margin-bottom: 30px;">
          <h3>指數表現</h3>
          ${performance?.map(p => `
            <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8fafc;">
              <span><b>${p.index_id.toUpperCase()}</b></span>
              <span style="color: ${p.change_percent >= 0 ? '#10b981' : '#ef4444'}">
                ${p.value} (${p.change_percent >= 0 ? '+' : ''}${p.change_percent}%)
              </span>
            </div>
          `).join('')}
        </div>
        <div>
          <h3>成分股權重 (Top 10)</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead><tr style="text-align: left; background: #eee;"><th>名稱</th><th>代號</th><th>權重</th></tr></thead>
            <tbody>
              ${constituents?.slice(0, 10).map(c => `
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">${c.name}</td><td>${c.symbol}</td><td>${c.weight}%</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <p style="font-size: 12px; color: #666; margin-top: 40px;">此郵件由自動系統發出，請勿直接回覆。</p>
      </div>
    `;

    // 6. 批次發送 (Resend)
    await resend.emails.send({
      from: 'Index Terminal <onboarding@resend.dev>', // 正式上線需綁定您的網域
      to: 'forjerry.cell@gmail.com', // 測試用，正式時改為 subscribers 遍歷
      subject: `今日指數報表 - ${today}`,
      html: emailHtml,
    });

    return NextResponse.json({ success: true, count: subscribers?.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
