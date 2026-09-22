-- =====================================================
-- futures_prices 表格遷移腳本
-- 將舊欄位 (tx_price, sgx_price) 改為新欄位 (day_deal, night_deal, stwn_deal)
-- 請在 Supabase SQL Editor 中執行此腳本
-- =====================================================

-- 若 futures_prices 表格不存在，建立新表格
CREATE TABLE IF NOT EXISTS futures_prices (
  id INTEGER PRIMARY KEY,
  session TEXT,
  day_deal NUMERIC,
  night_deal NUMERIC,
  stwn_deal NUMERIC,
  updated_at TEXT
);

-- 若表格已存在但用舊欄位，執行以下 ALTER TABLE 補充新欄位
-- (若欄位已存在，下方語句會被 IF NOT EXISTS 保護而跳過)
DO $$
BEGIN
  -- 新增 day_deal 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'futures_prices' AND column_name = 'day_deal'
  ) THEN
    ALTER TABLE futures_prices ADD COLUMN day_deal NUMERIC;
  END IF;

  -- 新增 night_deal 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'futures_prices' AND column_name = 'night_deal'
  ) THEN
    ALTER TABLE futures_prices ADD COLUMN night_deal NUMERIC;
  END IF;

  -- 新增 stwn_deal 欄位
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'futures_prices' AND column_name = 'stwn_deal'
  ) THEN
    ALTER TABLE futures_prices ADD COLUMN stwn_deal NUMERIC;
  END IF;

  -- 若舊欄位存在，將資料遷移至新欄位
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'futures_prices' AND column_name = 'tx_price'
  ) THEN
    UPDATE futures_prices SET day_deal = tx_price WHERE day_deal IS NULL AND tx_price IS NOT NULL;
    UPDATE futures_prices SET night_deal = tx_price WHERE night_deal IS NULL AND tx_price IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'futures_prices' AND column_name = 'sgx_price'
  ) THEN
    UPDATE futures_prices SET stwn_deal = sgx_price WHERE stwn_deal IS NULL AND sgx_price IS NOT NULL;
  END IF;
END $$;

-- 確保有一筆 id=1 的預設紀錄（避免首次讀取時返回空值）
INSERT INTO futures_prices (id, session, day_deal, night_deal, stwn_deal, updated_at)
VALUES (1, '休市', NULL, NULL, NULL, NOW()::TEXT)
ON CONFLICT (id) DO NOTHING;

-- 開放 service role 讀寫權限（若有 RLS）
ALTER TABLE futures_prices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 讀取 Policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'futures_prices' AND policyname = 'Allow service role to read futures_prices'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow service role to read futures_prices" ON futures_prices FOR SELECT USING (true)';
  END IF;

  -- 寫入 Policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'futures_prices' AND policyname = 'Allow service role to upsert futures_prices'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow service role to upsert futures_prices" ON futures_prices FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;
