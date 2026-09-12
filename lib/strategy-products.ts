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
