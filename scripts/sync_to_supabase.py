import os
import yfinance as yf
import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta

# Supabase 設定 (從環境變數讀取)
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def upload_to_supabase(table, data_list):
    """使用 REST API 直接上傳，避開 SDK Bug"""
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates" # 相當於 upsert
    }
    endpoint = f"{URL}/rest/v1/{table}"
    
    # 分批上傳 (避免 Payload 太大)
    batch_size = 100
    for i in range(0, len(data_list), batch_size):
        batch = data_list[i:i+batch_size]
        res = requests.post(endpoint, headers=headers, json=batch)
        if res.status_code not in [200, 201]:
            print(f"上傳 {table} 失敗: {res.text}")
        else:
            print(f"✓ 已同步 {len(batch)} 筆數據到 {table}")

def run_sync():
    today = datetime.now().strftime("%Y-%m-%d")
    print(f"開始執行每日同步任務：{today}")
    
    # ══════════════════════════════════════════════════════
    # 台股邏輯 (簡化為同步最新一天的價格與績效)
    # ══════════════════════════════════════════════════════
    print("[台股] 獲取最新數據...")
    universe = ["2330.TW", "2317.TW", "2454.TW", "2308.TW", "2303.TW", "2382.TW", "2412.TW", "2881.TW", "2882.TW", "2886.TW", "2891.TW", "3711.TW"]
    # 獲取加權指數與成分股最新價格
    data = yf.download(universe + ["^TWII"], start=(datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d"), end=today)
    if not data.empty:
        # 此處應包含完整的 Beta 計算邏輯 (略，使用與昨日相同權重進行最新一日估算)
        # 為了演示，我們直接抓取最新一天的收盤價並更新
        latest_date = data.index[-1].strftime("%Y-%m-%d")
        perf_data = [{
            "index_id": "taiwan_high_beta",
            "date": latest_date,
            "value": 1.0, # 實際應由回測邏輯計算累計淨值
            "change_percent": 0.0,
            "benchmark_value": 1.0
        }]
        # upload_to_supabase("index_performance", perf_data)
    
    # ══════════════════════════════════════════════════════
    # 那指邏輯
    # ══════════════════════════════════════════════════════
    print("[那指] 獲取最新數據...")
    # ... 類似邏輯 ...

    print("同步任務完成！")

if __name__ == "__main__":
    if not URL or not KEY:
        print("錯誤：找不到 SUPABASE_URL 或 KEY 環境變數")
    else:
        run_sync()
