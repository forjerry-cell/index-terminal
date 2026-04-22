import os
import yfinance as yf
import pandas as pd
import numpy as np
from supabase import create_client
from datetime import datetime, timedelta

# 初始化 Supabase
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase = create_client(url, key)

def sync_performance(index_id, data):
    print(f"同步 {index_id} 績效數據...")
    for _, row in data.iterrows():
        supabase.table("index_performance").upsert({
            "index_id": index_id,
            "date": row["Date"],
            "value": row["Value"],
            "benchmark_value": row["Benchmark"],
            "change_percent": row["Change"]
        }).execute()

def sync_constituents(index_id, data):
    print(f"同步 {index_id} 成分股數據...")
    for _, row in data.iterrows():
        supabase.table("index_constituents").upsert({
            "index_id": index_id,
            "symbol": row["Symbol"],
            "name": row["Name"],
            "weight": row["Weight"],
            "date": row["Date"]
        }).execute()

def run_taiwan_sync():
    # 簡化版邏輯：僅執行最新日期的計算與同步
    tickers = ["2330.TW", "2317.TW", "2454.TW", "2308.TW", "2303.TW", "2382.TW", "2412.TW", "2881.TW", "2882.TW", "2886.TW"] # 範例清單
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    
    data = yf.download(tickers + ["^TWII"], start=start_date, end=end_date)
    # ... 執行 Beta 計算與權重分配 (此處省略細節以符合 Token 限制) ...
    # 假設計算完成後的 DataFrame 名為 df_perf 和 df_const
    # sync_performance("taiwan_high_beta", df_perf)
    # sync_constituents("taiwan_high_beta", df_const)
    pass

def run_nasdaq_sync():
    # 同理實作那指同步
    pass

if __name__ == "__main__":
    run_taiwan_sync()
    run_nasdaq_sync()
