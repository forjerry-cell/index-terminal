-- AlphaFalcon-US 美股飆股預測雷達 - Supabase 資料表建立腳本
-- 請在 Supabase Dashboard → SQL Editor 中執行此腳本

-- 美股每日掃描結果總表 (每天一列，含全部美股個股預測結果)
CREATE TABLE IF NOT EXISTS alphafalcon_us_daily_results (
  scan_date  date PRIMARY KEY,
  results    jsonb NOT NULL,          -- 個股預測結果陣列
  meta       jsonb,                   -- 掃描元資訊 (時間、模型AUC、掃描總檔數)
  created_at timestamptz DEFAULT now()
);

-- 開放前端匿名讀取 (只讀，不允許寫入)
ALTER TABLE alphafalcon_us_daily_results ENABLE ROW LEVEL SECURITY;

-- 刪除可能存在的同名 policy 避免報錯，重新建立
DROP POLICY IF EXISTS "Allow public read US" ON alphafalcon_us_daily_results;
CREATE POLICY "Allow public read US" ON alphafalcon_us_daily_results
  FOR SELECT USING (true);

-- 建立索引加速查詢最新日期
CREATE INDEX IF NOT EXISTS idx_alphafalcon_us_scan_date 
  ON alphafalcon_us_daily_results (scan_date DESC);

-- 確認建立成功
SELECT 'alphafalcon_us_daily_results table created successfully' AS status;
