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

    // 3. 爬取表格內容 (處理虛擬滾動：不斷往下捲動並收集所有出現過的列)
    const tableData = await page.evaluate(async () => {
      const scrollContainer = document.querySelector('.ant-table-body') || document.querySelector('table')?.parentElement || window;
      
      const allData = new Map(); // 用 Map 避免重複，key 為顯示名稱
      
      // 動態尋找欄位索引
      const headers = Array.from(document.querySelectorAll('table thead th')).map(th => th.textContent?.trim() || '');
      const idxDisplayName = headers.findIndex(h => h.includes('顯示名稱'));
      const idxProduct = headers.findIndex(h => h.includes('策略商品'));
      const idxPosition = headers.findIndex(h => h.includes('目前部位'));
      const idxPrice = headers.findIndex(h => h.includes('訊號價格') || h.includes('觸發價格'));
      const idxTriggerTime = headers.findIndex(h => h.includes('觸發時間'));

      const extractRows = () => {
        const rows = Array.from(document.querySelectorAll('table tbody tr'));
        rows.forEach(row => {
          const cells = Array.from(row.querySelectorAll('td'));
          const displayName = idxDisplayName !== -1 && cells[idxDisplayName] ? cells[idxDisplayName].textContent?.trim() || '' : cells[3]?.textContent?.trim() || '';
          if (!displayName) return;
          
          allData.set(displayName, {
            displayName,
            product: idxProduct !== -1 && cells[idxProduct] ? cells[idxProduct].textContent?.trim() || '' : cells[5]?.textContent?.trim() || '',
            position: idxPosition !== -1 && cells[idxPosition] ? Number(cells[idxPosition].textContent?.trim() || '0') : Number(cells[7]?.textContent?.trim() || '0'),
            price: idxPrice !== -1 && cells[idxPrice] ? cells[idxPrice].textContent?.trim() || '' : cells[8]?.textContent?.trim() || '',
            triggerTime: idxTriggerTime !== -1 && cells[idxTriggerTime] ? cells[idxTriggerTime].textContent?.trim() || '' : cells[9]?.textContent?.trim() || ''
          });
        });
      };

      // 執行捲動 10 次，確保到底
      for (let i = 0; i < 10; i++) {
        extractRows();
        if (scrollContainer.scrollTo) {
          scrollContainer.scrollTo(0, scrollContainer.scrollHeight || 99999);
        } else {
          scrollContainer.scrollTop = 99999;
        }
        await new Promise(r => setTimeout(r, 500)); // 等待新資料渲染
      }
      
      return Array.from(allData.values());
    });

    await browser.close();

    // 4. 過濾出有在 displayNames 清單中的資料
    const filteredData = tableData.filter(row => displayNames.includes(row.displayName));

    return NextResponse.json({ success: true, data: filteredData });
    
  } catch (error: any) {
    console.error("Crawler Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
