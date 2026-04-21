-- 1. 會員個人資料表 (擴充 Supabase Auth)
CREATE TABLE profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  email_subscription BOOLEAN DEFAULT FALSE,
  is_admin BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 指數基本資訊表
CREATE TABLE indices (
  id TEXT PRIMARY KEY, -- 如 'tw_high_beta', 'nasdaq_high_beta'
  name TEXT NOT NULL,
  description TEXT,
  benchmark_name TEXT, -- 對比指數名稱
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. 指數每日數據 (收盤值、漲跌、圖表用)
CREATE TABLE index_performance (
  id BIGSERIAL PRIMARY KEY,
  index_id TEXT REFERENCES indices(id),
  date DATE NOT NULL,
  value NUMERIC(15, 2) NOT NULL,
  change_percent NUMERIC(10, 4),
  benchmark_value NUMERIC(15, 2), -- 基準指數值，用於回測對比圖
  UNIQUE(index_id, date)
);

-- 4. 指數成分股明細 (當日權重)
CREATE TABLE index_constituents (
  id BIGSERIAL PRIMARY KEY,
  index_id TEXT REFERENCES indices(id),
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  weight NUMERIC(10, 4) NOT NULL,
  date DATE NOT NULL,
  UNIQUE(index_id, symbol, date)
);

-- 5. 系統操作日誌 (訪客登入 Log)
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL, -- e.g., 'LOGIN', 'LOGOUT'
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 開啟 RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE indices ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE index_constituents ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- 權限設定 (訪客可讀指數數據，僅能改自己 Profile)
CREATE POLICY "Public indices are viewable by everyone." ON indices FOR SELECT USING (true);
CREATE POLICY "Performance data viewable by authenticated users." ON index_performance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Constituents viewable by authenticated users." ON index_constituents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can View/Update own profile." ON profiles USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all logs." ON audit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- 自動同步 Auth.users 到 Profiles 的函數
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, is_admin)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', (new.email = 'admin@example.com')); -- 邏輯：admin@... 自動設為管理員
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
