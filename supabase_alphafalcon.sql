-- AlphaFalcon 飆股預測雷達 - Supabase 資料表建立腳本
-- 請在 Supabase Dashboard → SQL Editor 中執行此腳本

-- 每日掃描結果總表 (每天一列，含全部個股預測結果)
CREATE TABLE IF NOT EXISTS alphafalcon_daily_results (
  scan_date  date PRIMARY KEY,
  results    jsonb NOT NULL,          -- 個股預測結果陣列
  meta       jsonb,                   -- 掃描元資訊 (時間、模型AUC、掃描總檔數)
  created_at timestamptz DEFAULT now()
);

-- 開放前端匿名讀取 (只讀，不允許寫入)
ALTER TABLE alphafalcon_daily_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON alphafalcon_daily_results
  FOR SELECT USING (true);

-- 建立索引加速查詢最新日期
CREATE INDEX IF NOT EXISTS idx_alphafalcon_scan_date 
  ON alphafalcon_daily_results (scan_date DESC);

-- 確認建立成功
SELECT 'alphafalcon_daily_results table created successfully' AS status;
