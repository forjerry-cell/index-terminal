process.env.TZ = 'Asia/Taipei';

import { NextResponse } from 'next/server';
import puppeteerCore from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer';

export const maxDuration = 60;

type ScrapedRow = {
  strategyName: string;
  product: string;
  position: number;
  price: string;
  triggerTime: string;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function launchBrowser() {
  try {
    return await puppeteerCore.launch({
      args: chromium.args,
      defaultViewport: { width: 1920, height: 10800 },
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } catch {
    return await puppeteer.launch({
      headless: true,
      defaultViewport: { width: 1920, height: 10800 },
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  }
}

async function login(page: import('puppeteer').Page) {
  const username = process.env.ADMIN_CRAWLER_USER || 'fubon_jerry';
  const password = process.env.ADMIN_CRAWLER_PASS || 'Qwer1234';

  await page.setDefaultNavigationTimeout(30000);
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  });

  await page.goto('https://strategy-center-admin.fbwinner.app/', { waitUntil: 'networkidle2' });
  await page.waitForSelector('input', { timeout: 10000 });

  const inputs = await page.$$('input');
  if (inputs.length < 2) {
    throw new Error('Login form not found');
  }

  await inputs[0].type(username);
  await inputs[1].type(password);

  try {
    await page.click('button[type="submit"]');
  } catch {
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.textContent || '', btn);
      if (text.includes('Login') || text.includes('登入') || text.includes('Submit')) {
        await btn.click();
        break;
      }
    }
  }

  await page.waitForSelector('table', { timeout: 15000 });
  await sleep(1500);
}

async function scrapeData(page: import('puppeteer').Page, displayNames: string[]): Promise<ScrapedRow[]> {
  const allData = new Map<string, ScrapedRow>();
  const targetSet = new Set(displayNames);

  for (let pageNum = 1; pageNum <= 5; pageNum++) {
    const pageResults = await page.evaluate(async () => {
      const scrollContainer =
        document.querySelector('.ant-table-body') ||
        document.querySelector('.ant-table-content') ||
        document.querySelector('div[style*="overflow"]') ||
        document.querySelector('table')?.parentElement;

      const localMap = new Map<string, ScrapedRow>();

      const extract = () => {
        const headers = Array.from(document.querySelectorAll('table thead th')).map(
          (th) => th.textContent?.trim() || '',
        );

        const idxStrategyName = headers.findIndex((h) => h.includes('策略名稱'));
        const idxProduct = headers.findIndex((h) => h.includes('策略商品'));
        const idxPosition = headers.findIndex((h) => h.includes('目前部位'));
        const idxPrice = headers.findIndex((h) => h.includes('訊號價格') || h.includes('觸發價格'));
        const idxTriggerTime = headers.findIndex((h) => h.includes('觸發時間'));

        document.querySelectorAll('table tbody tr').forEach((row) => {
          const cells = Array.from(row.querySelectorAll('td'));
          if (cells.length < 5) return;

          const name =
            idxStrategyName !== -1 && cells[idxStrategyName]
              ? cells[idxStrategyName].innerText?.trim() || ''
              : cells[2]?.innerText?.trim() || '';

          if (!name || name === '-') return;

          localMap.set(name, {
            strategyName: name,
            product:
              idxProduct !== -1 && cells[idxProduct]
                ? cells[idxProduct].innerText?.trim() || ''
                : cells[5]?.innerText?.trim() || '',
            position: Number(cells[idxPosition]?.innerText?.replace(/,/g, '').trim() || '0'),
            price: cells[idxPrice]?.innerText?.trim() || '',
            triggerTime: (cells[idxTriggerTime]?.innerText || '').toString().trim(),
          });
        });
      };

      for (let step = 0; step < 3; step++) {
        extract();
        if (scrollContainer) {
          (scrollContainer as HTMLElement).scrollTop += 1500;
        }
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      return Array.from(localMap.values());
    });

    pageResults.forEach((item) => allData.set(item.strategyName, item));

    const foundCount = Array.from(allData.keys()).filter((name) => targetSet.has(name)).length;
    if (foundCount >= displayNames.length) break;

    const buttons = await page.$$('button.mantine-Pagination-control');
    let clicked = false;
    for (const btn of buttons) {
      const txt = await page.evaluate((el) => (el as HTMLElement).innerText || '', btn);
      if (txt === '>') {
        const isDisabled = await page.evaluate((el) => (el as HTMLButtonElement).disabled, btn);
        if (!isDisabled) {
          await btn.click();
          await sleep(2000);
          clicked = true;
        }
        break;
      }
    }

    if (!clicked) break;
  }

  return Array.from(allData.values()).filter((row) => targetSet.has(row.strategyName));
}

export async function POST(req: Request) {
  let browser: import('puppeteer').Browser | null = null;

  try {
    const { displayNames } = await req.json();

    if (!displayNames || !Array.isArray(displayNames) || displayNames.length === 0) {
      return NextResponse.json({ success: false, error: '請提供有效的策略名稱清單' }, { status: 400 });
    }

    browser = await launchBrowser();
    const page = await browser.newPage();
    
    // 強制設定為台灣時區，確保爬取的觸發時間為台北時間
    await page.emulateTimezone('Asia/Taipei');

    await login(page);
    const data = await scrapeData(page, displayNames);

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    console.error('Crawler Error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Crawler failed' }, { status: 500 });
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
