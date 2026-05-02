import { Resend } from 'resend';
import { supabase } from '@/lib/supabase';
import { NextResponse } from 'next/server';

const RESEND_KEY = process.env.RESEND_API_KEY || 're_dWBAYs26_EihDSQjyKXpaKhfpSh7BnDVn';
const resend = new Resend(RESEND_KEY);

export async function POST(req: Request) {
  // 無須身份驗證：此 API 僅發送公開指數數據給已訂閱的會員

  try {
    // 2. 抓取最新數據（最後一個交易日，兩個指數）
    const { data: performance } = await supabase
      .from('index_performance')
      .select('*')
      .in('index_id', ['taiwan_high_beta', 'nasdaq_high_beta'])
      .order('date', { ascending: false })
      .limit(4);

    const latestDate = performance?.[0]?.date || new Date().toISOString().split('T')[0];

    // 每個 index_id 只取最新一筆
    const latestPerf = ['taiwan_high_beta', 'nasdaq_high_beta'].map(id =>
      performance?.find(p => p.index_id === id)
    ).filter(Boolean);

    const { data: constituents } = await supabase
      .from('index_constituents')
      .select('*')
      .order('date', { ascending: false })
      .order('weight', { ascending: false })
      .limit(20);

    // 3. 抓取訂閱名單（有填 notification_email 的用戶即視為開啟通知）
    const { data: subscribers } = await supabase
      .from('profiles')
      .select('full_name, notification_email')
      .not('notification_email', 'is', null);

    const validSubscribers = subscribers?.filter(sub => sub.notification_email && sub.notification_email.trim() !== '') || [];

    if (validSubscribers.length === 0) {
      return NextResponse.json({ success: true, message: '目前沒有訂閱者', count: 0 });
    }

    // 4. 生成漂亮的 HTML 報告
    const buildHtml = (name: string) => `
      <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: auto; background: #0d0f14; color: #e2e8f0; border: 1px solid #1f2228; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #0d0f14 100%); padding: 32px;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.75rem; font-weight: 900; color: white;">INNOVATION</span>
            <span style="color: #93c5fd; font-size: 1rem;">TERMINAL</span>
          </div>
          <p style="color: #93c5fd; margin: 8px 0 0; font-size: 0.875rem;">${latestDate} 每日收盤報告</p>
        </div>
        <div style="padding: 32px;">
          <p style="margin-top: 0;">親愛的 <strong>${name || '會員'}</strong>，</p>
          <p style="color: #94a3b8; font-size: 0.875rem;">以下是今日領航強勢指數的最新表現。</p>

          <h2 style="color: #60a5fa; font-size: 1rem; border-bottom: 1px solid #1f2228; padding-bottom: 10px; margin-top: 24px;">📈 指數表現</h2>
          ${latestPerf.map((p: any) => `
            <div style="background: #1a1d24; border-radius: 8px; padding: 16px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600; font-size: 0.9rem;">${p.index_id.includes('taiwan') ? '🇹🇼 台股領航強勢指數' : '🇺🇸 那指領航強勢指數'}</span>
                <div style="text-align: right;">
                  <div style="font-size: 1.25rem; font-weight: 800;">${p.value?.toFixed(2)}</div>
                  <div style="color: ${(p.change_percent || 0) >= 0 ? '#10b981' : '#ef4444'}; font-size: 0.8rem;">
                    ${(p.change_percent || 0) >= 0 ? '▲' : '▼'} ${Math.abs(p.change_percent || 0).toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          `).join('')}

          <h2 style="color: #60a5fa; font-size: 1rem; border-bottom: 1px solid #1f2228; padding-bottom: 10px; margin-top: 24px;">⚖️ 成分股 Top 10</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
            <thead>
              <tr style="background: #1a1d24; color: #94a3b8;">
                <th style="padding: 10px 12px; text-align: left;">名稱</th>
                <th style="padding: 10px 12px; text-align: left;">代號</th>
                <th style="padding: 10px 12px; text-align: right;">權重</th>
              </tr>
            </thead>
            <tbody>
              ${constituents?.slice(0, 10).map((c: any) => `
                <tr style="border-bottom: 1px solid #1f2228;">
                  <td style="padding: 10px 12px;">${c.name}</td>
                  <td style="padding: 10px 12px; color: #60a5fa;">${c.symbol}</td>
                  <td style="padding: 10px 12px; text-align: right; font-weight: bold;">${(c.weight * 100).toFixed(2)}%</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div style="margin-top: 32px; text-align: center;">
            <a href="https://index-terminal.vercel.app" style="background: #3b82f6; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
              🔗 前往平台查看完整圖表
            </a>
          </div>

          <p style="font-size: 11px; color: #4b5563; margin-top: 32px; text-align: center;">
            此郵件由 INNOVATION Terminal 自動發送 · 如需取消訂閱，請至個人設定頁關閉通知開關
          </p>
        </div>
      </div>
    `;

    // 5. 批次發送給所有訂閱者
    const results = await Promise.allSettled(
      validSubscribers.map((sub: any) =>
        resend.emails.send({
          from: 'INNOVATION Terminal <onboarding@resend.dev>',
          to: sub.notification_email,
          subject: `📊 領航強勢指數日報 · ${latestDate}`,
          html: buildHtml(sub.full_name || ''),
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({ success: true, sent, failed, date: latestDate });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
