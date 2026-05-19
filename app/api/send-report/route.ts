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

    // 抓取成分股資訊
    const { data: constituents } = await supabase
      .from('index_constituents')
      .select('*')
      .in('index_id', ['taiwan_high_beta', 'nasdaq_high_beta'])
      .eq('date', latestDate)
      .order('weight', { ascending: false });

    const twConstituents = constituents?.filter(c => c.index_id === 'taiwan_high_beta').slice(0, 5) || [];
    const usConstituents = constituents?.filter(c => c.index_id === 'nasdaq_high_beta').slice(0, 5) || [];

    // 抓取 AlphaFalcon 台股最新結果
    const { data: alphaTw } = await supabase
      .from('alphafalcon_daily_results')
      .select('results')
      .order('scan_date', { ascending: false })
      .limit(1)
      .single();
    let twTopStocks: any[] = [];
    if (alphaTw && alphaTw.results) {
      const twResults = typeof alphaTw.results === 'string' ? JSON.parse(alphaTw.results) : alphaTw.results;
      twTopStocks = twResults.slice(0, 3);
    }

    // 抓取 AlphaFalcon 美股最新結果
    const { data: alphaUs } = await supabase
      .from('alphafalcon_us_daily_results')
      .select('results')
      .order('scan_date', { ascending: false })
      .limit(1)
      .single();
    let usTopStocks: any[] = [];
    if (alphaUs && alphaUs.results) {
      const usResults = typeof alphaUs.results === 'string' ? JSON.parse(alphaUs.results) : alphaUs.results;
      usTopStocks = usResults.slice(0, 3);
    }

    // 2b. 抓取訂閱名單
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
          <p style="color: #93c5fd; margin: 8px 0 0; font-size: 0.875rem;">${latestDate} 每日市場監控報告</p>
        </div>
        <div style="padding: 32px;">
          <p style="margin-top: 0;">親愛的 <strong>${name || '會員'}</strong>，</p>
          <p style="color: #94a3b8; font-size: 0.875rem;">為您統整今日領航強勢指數表現、成分股權重，以及 AlphaFalcon 雙市場飆股 AI 預測結果。</p>

          <h2 style="color: #60a5fa; font-size: 1rem; border-bottom: 1px solid #1f2228; padding-bottom: 10px; margin-top: 24px;">📈 領航指數總覽與成分股 (Top 5)</h2>
          ${latestPerf.map((p: any) => {
            const isTw = p.index_id.includes('taiwan');
            const constList = isTw ? twConstituents : usConstituents;
            return `
            <div style="background: #1a1d24; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <span style="font-weight: 600; font-size: 0.9rem;">${isTw ? '🇹🇼 台股領航強勢指數' : '🇺🇸 那指領航強勢指數'}</span>
                <div style="text-align: right;">
                  <span style="font-size: 1.1rem; font-weight: 800;">${p.value?.toFixed(2)}</span>
                  <span style="color: ${(p.change_percent || 0) >= 0 ? '#10b981' : '#ef4444'}; font-size: 0.8rem; margin-left: 8px;">
                    ${(p.change_percent || 0) >= 0 ? '▲' : '▼'} ${Math.abs(p.change_percent || 0).toFixed(2)}%
                  </span>
                </div>
              </div>
              <div style="font-size: 0.8rem; color: #94a3b8;">
                <strong>核心成分股：</strong>
                ${constList.length > 0 
                  ? constList.map(c => `${c.name} (${c.symbol}) ${c.weight}%`).join('、') 
                  : '成分股資料尚未更新'}
              </div>
            </div>
            `;
          }).join('')}

          <h2 style="color: #00F2FE; font-size: 1rem; border-bottom: 1px solid #1f2228; padding-bottom: 10px; margin-top: 32px;">🦅 AlphaFalcon AI 飆股雷達 (Top 3 預測)</h2>
          
          <h3 style="color: #e2e8f0; font-size: 0.9rem; margin-top: 16px;">🇹🇼 台股強勢主升段標的</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 16px;">
            <tr style="border-bottom: 1px solid #333; color: #9ca3af; text-align: left;">
              <th style="padding: 8px 4px;">代號名稱</th>
              <th style="padding: 8px 4px;">AI 勝率</th>
              <th style="padding: 8px 4px;">觸發策略</th>
            </tr>
            ${twTopStocks.map(stock => `
            <tr style="border-bottom: 1px solid #1f2228;">
              <td style="padding: 8px 4px;"><strong>${stock.symbol}</strong> ${stock.name}</td>
              <td style="padding: 8px 4px; color: #00F2FE; font-weight: bold;">${stock.probability}%</td>
              <td style="padding: 8px 4px;">${stock.triggerType}</td>
            </tr>
            `).join('')}
          </table>

          <h3 style="color: #e2e8f0; font-size: 0.9rem; margin-top: 16px;">🇺🇸 美股科技巨頭與高爆發標的</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; margin-bottom: 16px;">
            <tr style="border-bottom: 1px solid #333; color: #9ca3af; text-align: left;">
              <th style="padding: 8px 4px;">代號名稱</th>
              <th style="padding: 8px 4px;">AI 勝率</th>
              <th style="padding: 8px 4px;">觸發策略</th>
            </tr>
            ${usTopStocks.map(stock => `
            <tr style="border-bottom: 1px solid #1f2228;">
              <td style="padding: 8px 4px;"><strong>${stock.symbol}</strong> ${stock.name}</td>
              <td style="padding: 8px 4px; color: #00F2FE; font-weight: bold;">${stock.probability}%</td>
              <td style="padding: 8px 4px;">${stock.triggerType}</td>
            </tr>
            `).join('')}
          </table>

          <div style="margin-top: 32px; text-align: center;">
            <a href="https://index-terminal.vercel.app/alphafalcon" style="background: #00F2FE; color: #0d0f14; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 0.9rem;">
              🔗 登入終端查看完整深度診斷報告
            </a>
          </div>

          <p style="font-size: 11px; color: #4b5563; margin-top: 40px; text-align: center;">
            此郵件由 INNOVATION Terminal 每日排程自動發送 · 數據僅供量化研究參考
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
          subject: `📊 領航強勢指數與 AI 飆股日報 · ${latestDate}`,
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
