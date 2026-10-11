-- AlphaFalcon 預測追蹤日誌（Prediction Log）
-- 設計原則：掃描器每次執行寫入當日分數前 5 檔（不可竄改、不可回填）；
-- 結算腳本於 60 個交易日後填入報酬；命中定義為 60 日報酬 >= +15%。
-- 在累積足夠樣本前，前端不展示任何歷史績效主張。
CREATE TABLE IF NOT EXISTS alphafalcon_predictions (
  id BIGSERIAL PRIMARY KEY,
  market TEXT NOT NULL DEFAULT 'TW',          -- 'TW' | 'US'
  scan_date DATE NOT NULL,                     -- 預測日（掃描執行日）
  symbol TEXT NOT NULL,                        -- 不含 .TW/.TWO 後綴
  name TEXT NOT NULL,
  score NUMERIC(6,2) NOT NULL,                 -- 當時模型分數
  trigger_type TEXT,                           -- 當時觸發型態
  entry_price NUMERIC(12,2) NOT NULL,          -- 預測日收盤價（PR, Close）
  settle_date DATE,                            -- 結算日（約 60 交易日後）
  exit_price NUMERIC(12,2),                    -- 結算日收盤價
  return_60d NUMERIC(8,3),                     -- 60 日累積報酬 %
  settled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (market, scan_date, symbol)
);
ALTER TABLE alphafalcon_predictions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Predictions viewable by authenticated users." ON alphafalcon_predictions;
DROP POLICY IF EXISTS "Predictions viewable by anon." ON alphafalcon_predictions;
CREATE POLICY "Predictions viewable by authenticated users."
  ON alphafalcon_predictions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Predictions viewable by anon."
  ON alphafalcon_predictions FOR SELECT TO anon USING (true);
-- 寫入僅允許 service_role（掃描器/結算腳本使用 service key，繞過 RLS）;
-- 匿名 key 僅可讀，供前端展示。