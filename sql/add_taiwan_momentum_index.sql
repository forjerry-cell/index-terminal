-- 為台股強勢動能指數新增 indices 定義
-- 請在 Supabase SQL Editor 中執行此腳本

INSERT INTO indices (id, name, description, benchmark_name)
VALUES ('taiwan_momentum_30', '台股強勢動能指數', '每半年定期再平衡，以台灣高波動指數官方50檔成分股為母體，依126日動能取前30檔滿倉持有', '加權指數')
ON CONFLICT (id) DO NOTHING;
