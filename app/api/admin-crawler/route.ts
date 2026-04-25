import { NextResponse } from 'next/server';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
// Import standard puppeteer for local development fallback
import puppeteer from 'puppeteer';

export const maxDuration = 60; // Set max duration for vercel hobby plan

export async function POST(req: Request) {
  try {
    const { displayNames } = await req.json();
    
    if (!displayNames || !Array.isArray(displayNames) || displayNames.length === 0) {
      return NextResponse.json({ success: false, error: '未提供有效的顯示名稱清單' }, { status: 400 });
    }

    let browser;
    try {
      // 嘗試在 Vercel 生產環境使用 sparticuz/chromium
      browser = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: { width: 1920, height: 10800 }, // 使用超大高度破解虛擬滾動 (Virtual Scrolling)
        executablePath: await chromium.executablePath(),
        headless: chromium.headless === 'new' ? true : chromium.headless,
      });
    } catch (err) {
      console.log("Fallback to local standard puppeteer...");
      // 若在本機端開發，改用標準 puppeteer
      browser = await puppeteer.launch({
        headless: true,
        defaultViewport: { width: 1920, height: 10800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }

    const page = await browser.newPage();
    
    // 增加超時時間並隱藏 navigator.webdriver 避免被防爬
    await page.setDefaultNavigationTimeout(30000);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7'
    });

    // 1. 登入
    console.log("Navigating to login...");
    await page.goto('https://strategy-center-admin.fbwinner.app/', { waitUntil: 'networkidle2' });
    
    // 尋找登入表單
    await page.waitForSelector('input', { timeout: 10000 });
    const inputs = await page.$$('input');
    
    // 假設第一個 input 是帳號，第二個是密碼 (最常見的 SPA 登入介面)
    if (inputs.length >= 2) {
      await inputs[0].type('fubon_jerry');
      await inputs[1].type('Qwer1234');
      
      // 尋找按鈕點擊
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const text = await page.evaluate(el => el.textContent, btn);
        if (text && (text.includes('Login') || text.includes('登入') || text.includes('Submit'))) {
          await btn.click();
          break;
        }
      }
      
      // 如果沒有找到文字按鈕，點擊第一個 type="submit" 的按鈕
      if (buttons.length > 0) {
        try { await page.click('button[type="submit"]'); } catch(e){}
      }
    }

    // 2. 等待登入完成並進入主頁 (等待表格出現)
    console.log("Waiting for table to load...");
    await page.waitForSelector('table', { timeout: 15000 });
    // 多等2秒確保資料渲染完畢
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 3. 深度爬取與分頁處理
    const allData = new Map();
    const targetSet = new Set(displayNames);
    
    // 限制最多爬取 5 頁，避免超時
    for (let pageNum = 1; pageNum <= 5; pageNum++) {
      console.log(`Crawling page ${pageNum}...`);
      
      const pageResults = await page.evaluate(async () => {
        const scrollContainer = document.querySelector('.ant-table-body') || 
                                document.querySelector('.ant-table-content') ||
                                document.querySelector('div[style*="overflow"]') ||
                                document.querySelector('table')?.parentElement;
        
        const localMap = new Map();
        const extract = () => {
          const headers = Array.from(document.querySelectorAll('table thead th')).map(th => th.textContent?.trim() || '');
          const idxStrategyName = headers.findIndex(h => h.includes('策略名稱'));
          const idxProduct = headers.findIndex(h => h.includes('策略商品'));
          const idxPosition = headers.findIndex(h => h.includes('目前部位'));
          const idxPrice = headers.findIndex(h => h.includes('訊號價格') || h.includes('觸發價格'));
          const idxTriggerTime = headers.findIndex(h => h.includes('觸發時間'));

          document.querySelectorAll('table tbody tr').forEach(row => {
            const cells = Array.from(row.querySelectorAll('td'));
            if (cells.length < 5) return;
            const name = idxStrategyName !== -1 && cells[idxStrategyName] ? cells[idxStrategyName].textContent?.trim() || '' : cells[2]?.textContent?.trim() || '';
            if (!name || name === '-') return;
            localMap.set(name, {
              strategyName: name,
              product: idxProduct !== -1 && cells[idxProduct] ? cells[idxProduct].textContent?.trim() || '' : cells[5]?.textContent?.trim() || '',
              position: Number(cells[idxPosition]?.textContent?.replace(/,/g, '').trim() || '0'),
              price: cells[idxPrice]?.textContent?.trim() || '',
              triggerTime: cells[idxTriggerTime]?.textContent?.trim() || ''
            });
          });
        };

        // 每頁滾動 3 次確保讀取虛擬列表
        for (let s = 0; s < 3; s++) {
          extract();
          if (scrollContainer) scrollContainer.scrollTop += 1500;
          await new Promise(r => setTimeout(r, 600));
        }
        return Array.from(localMap.values());
      });

      // 合併資料
      pageResults.forEach(item => allData.set(item.strategyName, item));
      
      // 檢查是否已經找齊所有目標
      const foundCount = Array.from(allData.keys()).filter(k => targetSet.has(k)).length;
      console.log(`Found ${foundCount}/${displayNames.length} targets so far.`);
      
      if (foundCount >= displayNames.length) break;

      // 嘗試點擊下一頁
      const buttons = await page.$$('button.mantine-Pagination-control');
      let clicked = false;
      for (const btn of buttons) {
        const txt = await page.evaluate(el => el.textContent, btn);
        if (txt === '>') {
          const isDisabled = await page.evaluate(el => el.disabled, btn);
          if (!isDisabled) {
            await btn.click();
            await new Promise(resolve => setTimeout(resolve, 2000)); // 等待換頁渲染
            clicked = true;
          }
          break;
        }
      }
      if (!clicked) break; // 沒有下一頁了
    }

    await browser.close();

    // 4. 儲存名單到資料庫進行跨裝置同步 (借用 indices 表儲存配置)
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    await supabaseAdmin.from('indices').upsert({
      id: 'system_config_strategies',
      name: '系統管理配置',
      description: displayNames.join(',')
    });

    return NextResponse.json({ success: true, data: filteredData });
    
  } catch (error: any) {
    console.error("Crawler Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
