/**
 * 策略名稱與指定策略商品的對照表
 * 依據管理員指定之商品對應規格
 */
export const STRATEGY_PRODUCT_MAP: Record<string, string> = {
  'A04': '小型台指',
  'B01': '微型台指',
  'B02': '小型台指',
  'B03': '小型台指',
  'B05': '微型台指',
  'C02': '小型台指',
  'D01': '微型台指',
  'D06': '微型台指',
  'E041': '微型台指',
  'G01': '小型台指',
  'G02': '微型台指',
  'G021': '小型台指',
  'G041': '微型台指',
  'K02': '小型台指',
  'TWN04': '微型富台',
  'TWN05': '微型富台',
  'X01': '小型台指',
  'Y03': '小型台指',
  'Y05': '微型台指',
  'Z01': '小型台指',
};

/**
 * 根據策略名稱取得指定的策略商品
 * @param strategyName 策略名稱 (例如 A04, B01, TWN04 等)
 * @param fallback 若不在對照表中時使用的備援值
 */
export function getStrategyProduct(strategyName: string, fallback: string = ''): string {
  if (!strategyName) return fallback;
  const key = strategyName.trim();
  if (STRATEGY_PRODUCT_MAP[key]) {
    return STRATEGY_PRODUCT_MAP[key];
  }
  const upper = key.toUpperCase();
  if (STRATEGY_PRODUCT_MAP[upper]) {
    return STRATEGY_PRODUCT_MAP[upper];
  }
  return fallback || strategyName;
}

/**
 * 玩股網即時行情資料結構
 */
export interface WantgooMarketPrices {
  dayDeal: number | null; // 台指期 (日盤)
  nightDeal: number | null; // 台指期盤後 (夜盤)
  stwnDeal: number | null; // 富台指
  updatedAt?: string;
}

/**
 * 依據台北時間時段計算台指現價與各商品現價
 * 規則：
 * 1. 08:45 ~ 13:45 採用台指期日盤價格 (dayDeal)
 * 2. 15:00 ~ 隔天 05:00 採用台指期盤後價格 (nightDeal)
 * 3. 其餘時段 (休市緩衝) 保留最新可得之成交價 (nightDeal 優先，無則 dayDeal)
 * 4. 微型富台始終採用富台指現價 (stwnDeal)
 */
export function getCurrentMarketPrice(product: string, prices: WantgooMarketPrices | null | undefined): number | null {
  if (!prices) return null;

  // 取得台北時間的時與分
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const taipeiDate = new Date(utc + 8 * 3600000);
  const hour = taipeiDate.getHours();
  const minute = taipeiDate.getMinutes();
  const timeInMinutes = hour * 60 + minute;

  // 08:45 = 8 * 60 + 45 = 525 分鐘
  // 13:45 = 13 * 60 + 45 = 825 分鐘
  // 15:00 = 15 * 60 = 900 分鐘
  // 05:00 = 5 * 60 = 300 分鐘
  const isDaySession = timeInMinutes >= 525 && timeInMinutes <= 825;
  const isNightSession = timeInMinutes >= 900 || timeInMinutes <= 300;

  // 台指期 / 微台現價
  let txPrice: number | null = null;
  if (isDaySession) {
    txPrice = prices.dayDeal ?? prices.nightDeal;
  } else if (isNightSession) {
    txPrice = prices.nightDeal ?? prices.dayDeal;
  } else {
    // 休市期間優先取盤後價格，若無則取日盤價格
    txPrice = prices.nightDeal ?? prices.dayDeal;
  }

  if (product === '小型台指' || product === '微型台指' || product.includes('台指')) {
    return txPrice;
  }

  if (product === '微型富台' || product.includes('富台')) {
    return prices.stwnDeal;
  }

  return null;
}

