#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
透過 Python 手動讀取 .env 並查詢 Supabase 的 alphafalcon_us_daily_results 資料表
"""
import os
import requests

def load_env():
    env_vars = {}
    if os.path.exists('.env'):
        with open('.env', 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars

def check_table():
    env = load_env()
    url = env.get('NEXT_PUBLIC_SUPABASE_URL')
    key = env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if not url or not key:
        print("[ERROR] 無法從 .env 取得 SUPABASE_URL 或 SERVICE_ROLE_KEY")
        return
        
    print(f"SUPABASE_URL: {url}")
    print(f"SERVICE_ROLE_KEY (已隱碼): {key[:15]}...{key[-15:]}")
    
    # 建立 REST API 請求
    # 注意，在 REST API 中，service_role_key 必須做為 apikey 及 Authorization: Bearer <key> 傳遞
    rest_url = f"{url.rstrip('/')}/rest/v1/alphafalcon_us_daily_results"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "count=exact"
    }
    
    print("\n--- 嘗試向 Supabase REST API 查詢 alphafalcon_us_daily_results ---")
    try:
        r = requests.get(rest_url + "?select=scan_date&limit=1", headers=headers)
        print(f"HTTP 狀態碼: {r.status_code}")
        
        if r.status_code == 200:
            print("[OK] 資料表確實存在！且連線認證成功。")
            print("返回內容:", r.json())
        elif r.status_code == 404:
            print("[FAIL] 資料表不存在！(404 Not Found)")
            print("這代表您在 Supabase 中尚未建立 'alphafalcon_us_daily_results' 資料表！")
            print("請使用 supabase_alphafalcon_us.sql 的內容在 Supabase 控制台的 SQL Editor 中執行建表！")
        else:
            print(f"[FAIL] 查詢出錯！錯誤內容: {r.text}")
    except Exception as e:
        print(f"[ERROR] 請求發送失敗: {e}")

if __name__ == "__main__":
    check_table()
