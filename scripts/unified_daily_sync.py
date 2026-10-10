#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
統一每日同步引擎 - 同時處理三個指數
1. 台股領航強勢指數 (taiwan_high_beta) - 每季首個交易日自動換股
2. 那指領航強勢指數 (nasdaq_high_beta) - 每季季末自動換股
3. 台股強勢動能指數 (taiwan_momentum_30) - 每半年 6/12 月自動換股
"""

import os
import sys
import json
import math
import requests
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

URL = os.environ.get("SUPABASE_URL", "https://nnoazshcucwjlccjqtkl.supabase.co")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
if not KEY:
    env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                    KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
                    break
if not KEY:
    KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDgzNzYsImV4cCI6MjA5MjI4NDM3Nn0.FE-onwhqZNBWWdUBoqD1lR-n5So9PbQ9BvjB9pWCz6g"



def upload_to_supabase(table, data_list, on_conflict=None):
    if not data_list:
        return
    if on_conflict is None:
        on_conflict = "index_id,date"
    if table == "index_constituents":
        on_conflict = "index_id,symbol,date"
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    endpoint = f"{URL}/rest/v1/{table}?on_conflict={on_conflict}"
    batch_size = 100
    for i in range(0, len(data_list), batch_size):
        batch = data_list[i:i + batch_size]
        try:
            res = requests.post(endpoint, headers=headers, json=batch)
            if res.status_code not in [200, 201, 204]:
                print(f"  [WARN] Upload {table} batch {i}: {res.status_code} {res.text[:200]}")
            else:
                print(f"  OK: {len(batch)} rows -> {table}")
        except Exception as e:
            print(f"  [ERROR] Upload {table}: {e}")


def fetch_supabase(table, params):
    headers = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    url = f"{URL}/rest/v1/{table}?{params}"
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            return res.json()
    except Exception as e:
        print(f"  [ERROR] Fetch {table}: {e}")
    return []


def get_latest_value(index_id):
    rows = fetch_supabase("index_performance",
        f"index_id=eq.{index_id}&select=date,value,benchmark_value&order=date.desc&limit=1")
    return rows[0] if rows else None

# ============================================================
# 台股領航強勢指數 - 每季首個交易日換股
# ============================================================

TW_HB_UNIVERSE = {
    "2330.TW": "台積電", "2317.TW": "鴻海", "2454.TW": "聯發科", "2308.TW": "台達電",
    "3711.TW": "日月光投控", "2382.TW": "廣達", "3037.TW": "欣興", "2408.TW": "南亞科",
    "2327.TW": "國巨", "2303.TW": "聯電", "2357.TW": "華碩", "2345.TW": "智邦",
    "2881.TW": "富邦金", "2882.TW": "國泰金", "2886.TW": "兆豐金", "2891.TW": "中信金",
    "2892.TW": "第一金", "2884.TW": "玉山金", "2880.TW": "華南金", "2379.TW": "瑞昱",
    "2344.TW": "華邦電", "2347.TW": "聯強", "3661.TW": "世芯-KY", "3034.TW": "聯詠",
    "2603.TW": "長榮", "2609.TW": "陽明", "2610.TW": "華航", "2615.TW": "萬海",
    "2618.TW": "長榮航", "2885.TW": "元大金", "2356.TW": "英業達", "2412.TW": "中華電",
    "2474.TW": "可成", "2498.TW": "宏達電", "2606.TW": "裕民", "2633.TW": "台灣高鐵",
    "2634.TW": "漢翔", "2887.TW": "台新金", "2888.TW": "新光金", "2890.TW": "永豐金",
    "2883.TW": "開發金", "2801.TW": "彰銀", "2809.TW": "京城銀", "2812.TW": "台中銀",
    "2820.TW": "華票", "2834.TW": "臺企銀", "2838.TW": "聯邦銀", "2845.TW": "遠東銀",
    "2849.TW": "安泰銀", "2850.TW": "新產", "2851.TW": "中再保", "2852.TW": "第一保",
    "2855.TW": "統一證",
}
TW_SEMI_CODES = {"2330", "2303", "2337", "2344", "2379", "2408", "2449", "2454",
    "3105", "3189", "3374", "3443", "3529", "3532", "3707", "3711", "4919", "4966",
    "5269", "5274", "5347", "5483", "6147", "6223", "6274", "6488", "6526", "6531",
    "6669", "6781", "6789", "6805", "8046", "8069", "8299", "8436", "9904", "9910",
    "3037", "6239", "6415", "6285"}


def check_tw_rebalance_due(today_dt, last_rebalance_date):
    """每季 (1,4,7,10月) 首個交易日"""
    month = today_dt.month
    day = today_dt.day
    if month in [1, 4, 7, 10] and day <= 7:
        current_term = f"{today_dt.year}-{month:02d}"
        if last_rebalance_date is None or not last_rebalance_date.startswith(current_term):
            return True, current_term
    return False, None


def calculate_tw_high_beta_rebalance(cutoff_date):
    """執行台股領航強勢指數換股：252日 Beta 排序選前50，30%/半導體60%上限"""
    tickers = list(TW_HB_UNIVERSE.keys())
    bm_ticker = "^TWII"
    fetch_start = (pd.to_datetime(cutoff_date) - timedelta(days=365)).strftime("%Y-%m-%d")
    fetch_end = (pd.to_datetime(cutoff_date) + timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"  下載台股歷史數據 ({fetch_start} ~ {cutoff_date})...")
    full_data = yf.download(tickers + [bm_ticker], start=fetch_start, end=fetch_end,
                            progress=False, auto_adjust=False)
    if full_data.empty:
        return None, None
    adj_close = full_data['Adj Close'].ffill()
    if bm_ticker not in adj_close.columns:
        return None, None
    bm_p = adj_close[bm_ticker]
    stock_rets = adj_close[tickers].pct_change()
    betas = {}
    for t in tickers:
        if t in stock_rets.columns:
            pair = stock_rets[[t, bm_ticker]].dropna()
            if len(pair) > 200:
                cov = np.cov(pair[t], pair[bm_ticker])[0, 1]
                v_m = np.var(pair[bm_ticker])
                betas[t] = cov / v_m if v_m != 0 else 0
    eligible = [t for t in betas if betas[t] > 0]
    holdings = sorted(eligible, key=lambda x: betas[x], reverse=True)[:50]
    w = pd.Series({t: betas[t] for t in holdings})
    w /= w.sum()
    w = w.clip(upper=0.30)
    w /= w.sum()
    semi_weight = sum(w[t] for t in holdings if t.replace('.TW', '').replace('.TWO', '') in TW_SEMI_CODES)
    if semi_weight > 0.60:
        scale = 0.60 / semi_weight
        for t in holdings:
            if t.replace('.TW', '').replace('.TWO', '') in TW_SEMI_CODES:
                w[t] *= scale
        w /= w.sum()
    const_data = []
    for t in holdings:
        symbol = t.replace('.TW', '').replace('.TWO', '')
        const_data.append({
            "index_id": "taiwan_high_beta",
            "symbol": symbol,
            "name": TW_HB_UNIVERSE.get(t, symbol),
            "weight": round(w[t] * 100, 4),
            "date": cutoff_date,
        })
    return holdings, const_data



def get_latest_constituents(index_id):
    rows = fetch_supabase("index_constituents",
        f"index_id=eq.{index_id}&select=symbol,name,weight,date&order=date.desc&limit=100")
    if rows:
        latest_date = rows[0]["date"]
        return [r for r in rows if r["date"] == latest_date], latest_date


def update_taiwan_high_beta(today_dt):
    """更新台股領航強勢指數：每日淨值 + 換股檢查"""
    print("\n--- [台股領航強勢指數] ---")
    latest = get_latest_value("taiwan_high_beta")
    if not latest:
        print("  無現有數據，跳過")
        return
    last_date = latest["date"]
    last_dt = pd.to_datetime(last_date)
    constituents, const_date = get_latest_constituents("taiwan_high_beta")
    if not constituents:
        print("  無成分股數據，跳過")
        return
    tickers = []
    weights = {}
    for c in constituents:
        sym = c["symbol"].strip()
        full = sym + ".TW" if not sym.endswith((".TW", ".TWO")) else sym
        tickers.append(full)
        weights[full] = c["weight"] / 100.0
    bm_ticker = "^TWII"
    all_tickers = list(set(tickers + [bm_ticker]))
    start_fetch = (last_dt - timedelta(days=5)).strftime("%Y-%m-%d")
    end_fetch = (today_dt + timedelta(days=2)).strftime("%Y-%m-%d")
    print(f"  下載行情 ({start_fetch} ~ {end_fetch})...")
    df = yf.download(all_tickers, start=start_fetch, end=end_fetch, auto_adjust=False, progress=False)
    if df.empty or "Adj Close" not in df:
        print("  未下載到數據")
        return
    adj_close = df["Adj Close"].ffill()
    new_dates = adj_close.index[adj_close.index > last_dt]
    if len(new_dates) == 0:
        print("  行情已是最新")
    else:
        print(f"  更新 {len(new_dates)} 個新交易日")
        cur_val = latest["value"]
        cur_bm = latest.get("benchmark_value", 1.0)
        perf_data = []
        for d in new_dates:
            loc = adj_close.index.get_loc(d)
            prev_d = adj_close.index[loc - 1]
            day_rets = (adj_close.loc[d, tickers] / adj_close.loc[prev_d, tickers] - 1).fillna(0)
            port_ret = sum(day_rets[s] * weights.get(s, 0) for s in tickers if s in day_rets)
            bm_ret = (adj_close.loc[d, bm_ticker] / adj_close.loc[prev_d, bm_ticker] - 1) if bm_ticker in adj_close else 0.0
            if pd.isna(bm_ret): bm_ret = 0.0
            cur_val *= (1.0 + port_ret)
            cur_bm *= (1.0 + bm_ret)
            perf_data.append({
                "index_id": "taiwan_high_beta",
                "date": d.strftime("%Y-%m-%d"),
                "value": round(cur_val, 4),
                "change_percent": round(port_ret * 100, 4),
                "benchmark_value": round(cur_bm, 4),
            })
            print(f"    {d.strftime('%Y-%m-%d')}: {port_ret*100:+.2f}% -> {cur_val:.2f}")
        upload_to_supabase("index_performance", perf_data)
    is_due, term = check_tw_rebalance_due(today_dt, const_date)
    if is_due:
        cutoff = (today_dt - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"  * 觸發換股 ({term})，截止日 {cutoff}")
        holdings, const_data = calculate_tw_high_beta_rebalance(cutoff)
        if const_data:
            upload_to_supabase("index_constituents", const_data)
            print(f"  * 已更新成分股 ({len(const_data)} 檔)")



# ============================================================
# 那指領航強勢指數 - 每季季末換股
# ============================================================

NQ_UNIVERSE = [
    "NVDA", "AAPL", "GOOGL", "MSFT", "AMZN", "AVGO", "META", "TSLA", "NFLX", "AMD",
    "INTC", "QCOM", "TXN", "MU", "ORCL", "CRM", "ADBE", "CSCO", "IBM", "NOW",
    "INTU", "AMAT", "LRCX", "KLAC", "MRVL", "SNPS", "CDNS", "PANW", "CRWD", "FTNT",
    "GOOG", "COST", "ASML", "PLTR", "WMT", "TMUS", "LIN", "PEP", "AMGN", "GILD",
    "ISRG", "ADI", "SHOP", "ARM", "HON", "PDD", "BKNG", "APP", "VRTX", "CEG",
    "CMCSA", "SBUX", "ADP", "MELI", "STX", "ORLY", "REGN", "MDLZ", "CSX", "ABNB",
    "AEP", "MNST", "ROST", "CTAS", "WBD", "DASH", "BKR", "PCAR", "FANG", "FAST",
    "EA", "EXC", "ADSK", "XEL", "MPWR", "NXPI", "FER", "IDXX", "MSTR", "PYPL",
    "DDOG", "TRI", "ODFL", "ROP", "KDP", "TTWO", "PAYX", "AXON", "WDAY", "MCHP",
    "CPRT", "GEHC", "CHTR", "CTSH", "KHC", "VRSK", "DXCM", "ZS", "TEAM", "CSGP",
]


def check_nq_rebalance_due(today_dt, last_rebalance_date):
    """每季季末 (3,6,9,12月) 最後 5 個交易日"""
    month = today_dt.month
    day = today_dt.day
    if month in [3, 6, 9, 12] and day >= 25:
        current_term = f"{today_dt.year}-{month:02d}"
        if last_rebalance_date is None or not last_rebalance_date.startswith(current_term):
            return True, current_term
    return False, None


def calculate_nq_high_beta_rebalance(cutoff_date):
    """執行那指領航強勢指數換股：252日 Beta 排序選前30，個股10%上限"""
    bm_ticker = "QQQ"
    fetch_start = (pd.to_datetime(cutoff_date) - timedelta(days=365)).strftime("%Y-%m-%d")
    fetch_end = (pd.to_datetime(cutoff_date) + timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"  下載那指數據 ({fetch_start} ~ {cutoff_date})...")
    full_data = yf.download(NQ_UNIVERSE + [bm_ticker], start=fetch_start, end=fetch_end,
                            progress=False, auto_adjust=False)
    if full_data.empty:
        return None, None
    adj_close = full_data['Adj Close'].ffill()
    if bm_ticker not in adj_close.columns:
        return None, None
    bm_p = adj_close[bm_ticker]
    stock_rets = adj_close[NQ_UNIVERSE].pct_change()
    betas = {}
    for t in NQ_UNIVERSE:
        if t in stock_rets.columns:
            pair = stock_rets[[t, bm_ticker]].dropna()
            if len(pair) > 200:
                cov = np.cov(pair[t], pair[bm_ticker])[0, 1]
                v_m = np.var(pair[bm_ticker])
                betas[t] = cov / v_m if v_m != 0 else 0
    eligible = [t for t in betas if betas[t] > 0]
    holdings = sorted(eligible, key=lambda x: betas[x], reverse=True)[:30]
    w = pd.Series({t: betas[t] for t in holdings})
    w /= w.sum()
    w = w.clip(upper=0.10)
    w /= w.sum()
    const_data = []
    for t in holdings:
        const_data.append({
            "index_id": "nasdaq_high_beta",
            "symbol": t,
            "name": t,
            "weight": round(w[t] * 100, 4),
            "date": cutoff_date,
        })
    return holdings, const_data


def update_nasdaq_high_beta(today_dt):
    """更新那指領航強勢指數：每日淨值 + 換股檢查"""
    print("\n--- [那指領航強勢指數] ---")
    latest = get_latest_value("nasdaq_high_beta")
    if not latest:
        print("  無現有數據，跳過")
        return
    last_date = latest["date"]
    last_dt = pd.to_datetime(last_date)
    constituents, const_date = get_latest_constituents("nasdaq_high_beta")
    if not constituents:
        print("  無成分股數據，跳過")
        return
    tickers = [c["symbol"].strip() for c in constituents]
    weights = {c["symbol"].strip(): c["weight"] / 100.0 for c in constituents}
    bm_ticker = "QQQ"
    all_tickers = list(set(tickers + [bm_ticker]))
    start_fetch = (last_dt - timedelta(days=5)).strftime("%Y-%m-%d")
    end_fetch = (today_dt + timedelta(days=2)).strftime("%Y-%m-%d")
    print(f"  下載行情 ({start_fetch} ~ {end_fetch})...")
    df = yf.download(all_tickers, start=start_fetch, end=end_fetch, auto_adjust=False, progress=False)
    if df.empty or "Adj Close" not in df:
        print("  未下載到數據")
        return
    adj_close = df["Adj Close"].ffill()
    new_dates = adj_close.index[adj_close.index > last_dt]
    if len(new_dates) == 0:
        print("  行情已是最新")
    else:
        print(f"  更新 {len(new_dates)} 個新交易日")
        cur_val = latest["value"]
        cur_bm = latest.get("benchmark_value", 1.0)
        perf_data = []
        for d in new_dates:
            loc = adj_close.index.get_loc(d)
            prev_d = adj_close.index[loc - 1]
            day_rets = (adj_close.loc[d, tickers] / adj_close.loc[prev_d, tickers] - 1).fillna(0)
            port_ret = sum(day_rets[s] * weights.get(s, 0) for s in tickers if s in day_rets)
            bm_ret = (adj_close.loc[d, bm_ticker] / adj_close.loc[prev_d, bm_ticker] - 1) if bm_ticker in adj_close else 0.0
            if pd.isna(bm_ret): bm_ret = 0.0
            cur_val *= (1.0 + port_ret)
            cur_bm *= (1.0 + bm_ret)
            perf_data.append({
                "index_id": "nasdaq_high_beta",
                "date": d.strftime("%Y-%m-%d"),
                "value": round(cur_val, 4),
                "change_percent": round(port_ret * 100, 4),
                "benchmark_value": round(cur_bm, 4),
            })
            print(f"    {d.strftime('%Y-%m-%d')}: {port_ret*100:+.2f}% -> {cur_val:.2f}")
        upload_to_supabase("index_performance", perf_data)
    is_due, term = check_nq_rebalance_due(today_dt, const_date)
    if is_due:
        cutoff = (today_dt - timedelta(days=1)).strftime("%Y-%m-%d")
        print(f"  * 觸發換股 ({term})，截止日 {cutoff}")
        holdings, const_data = calculate_nq_high_beta_rebalance(cutoff)
        if const_data:
            upload_to_supabase("index_constituents", const_data)
            print(f"  * 已更新成分股 ({len(const_data)} 檔)")



# ============================================================
# 台股強勢動能指數 - 每半年 6/12 月換股，Supabase 儲存
# ============================================================

def check_momentum_rebalance_due(today_dt, last_rebalance_term):
    """每年 6 月與 12 月，16 日之後"""
    year = today_dt.year
    month = today_dt.month
    day = today_dt.day
    if month == 6 and day >= 16:
        term = f"{year}-06"
        cutoff = f"{year}-05-31"
        if last_rebalance_term != term:
            return True, term, cutoff
    elif month == 12 and day >= 16:
        term = f"{year}-12"
        cutoff = f"{year}-11-30"
        if last_rebalance_term != term:
            return True, term, cutoff
    return False, None, None


def update_taiwan_momentum(today_dt):
    """更新台股強勢動能指數 - 從 Supabase 讀寫"""
    print("\n--- [Taiwan Momentum 30] ---")
    latest = get_latest_value("taiwan_momentum_30")
    if not latest:
        print("  No existing data, skip")
        return
    last_date = latest["date"]
    last_dt = pd.to_datetime(last_date)
    constituents, const_date = get_latest_constituents("taiwan_momentum_30")
    if not constituents:
        print("  No constituents, skip")
        return
    history = fetch_supabase("rebalance_history",
        f"index_id=eq.taiwan_momentum_30&select=term&order=term.desc&limit=1")
    last_rebalance_term = history[0]["term"] if history else "2026-06"
    tickers = []
    weights = {}
    for c in constituents:
        sym = str(c["symbol"]).strip()
        full = sym + ".TW" if not sym.endswith((".TW", ".TWO")) else sym
        tickers.append(full)
        weights[full] = c["weight"] / 100.0
    bm_ticker = "^TWII"
    all_tickers = list(set(tickers + [bm_ticker]))
    start_fetch = (last_dt - timedelta(days=5)).strftime("%Y-%m-%d")
    end_fetch = (today_dt + timedelta(days=2)).strftime("%Y-%m-%d")
    print(f"  Fetching quotes ({start_fetch} ~ {end_fetch})...")
    df = yf.download(all_tickers, start=start_fetch, end=end_fetch, auto_adjust=False, progress=False)
    if df.empty or "Adj Close" not in df:
        print("  No data downloaded")
        return
    adj_close = df["Adj Close"].ffill()
    new_dates = adj_close.index[adj_close.index > last_dt]
    if len(new_dates) == 0:
        print("  Quotes already up to date")
    else:
        print(f"  Updating {len(new_dates)} new trading days")
        cur_val = latest["value"]
        cur_bm = latest.get("benchmark_value", 1.0)
        perf_data = []
        for d in new_dates:
            loc = adj_close.index.get_loc(d)
            prev_d = adj_close.index[loc - 1]
            day_rets = (adj_close.loc[d, tickers] / adj_close.loc[prev_d, tickers] - 1).fillna(0)
            port_ret = sum(day_rets[s] * weights.get(s, 0) for s in tickers if s in day_rets)
            bm_ret = (adj_close.loc[d, bm_ticker] / adj_close.loc[prev_d, bm_ticker] - 1) if bm_ticker in adj_close else 0.0
            if pd.isna(bm_ret): bm_ret = 0.0
            cur_val *= (1.0 + port_ret)
            cur_bm *= (1.0 + bm_ret)
            perf_data.append({
                "index_id": "taiwan_momentum_30",
                "date": d.strftime("%Y-%m-%d"),
                "value": round(cur_val, 4),
                "change_percent": round(port_ret * 100, 4),
                "benchmark_value": round(cur_bm, 4),
            })
            print(f"    {d.strftime('%Y-%m-%d')}: {port_ret*100:+.2f}% -> {cur_val:.2f}")
        upload_to_supabase("index_performance", perf_data)
    is_due, term, cutoff = check_momentum_rebalance_due(today_dt, last_rebalance_term)
    if is_due:
        print(f"  * Rebalance due ({term}), cutoff {cutoff}")
        try:
            sys.path.append(os.path.dirname(__file__))
            from rebalance_momentum import perform_rebalance, get_ticker_symbol
            existing_codes = set(str(c["symbol"]).strip() for c in constituents)
            new_constituents = perform_rebalance(cutoff, existing_codes=existing_codes)
            if new_constituents:
                const_data = []
                for c in new_constituents:
                    const_data.append({
                        "index_id": "taiwan_momentum_30",
                        "symbol": str(c["symbol"]).strip(),
                        "name": c.get("name", str(c["symbol"]).strip()),
                        "weight": round(c["weight"], 4),
                        "date": today_dt.strftime("%Y-%m-%d"),
                    })
                upload_to_supabase("index_constituents", const_data)
                old_set = existing_codes
                new_set = set(str(c["symbol"]).strip() for c in new_constituents)
                headers = {
                    "apikey": KEY,
                    "Authorization": f"Bearer {KEY}",
                    "Content-Type": "application/json",
                    "Prefer": "resolution=merge-duplicates",
                }
                history_data = [{
                    "index_id": "taiwan_momentum_30",
                    "term": term,
                    "effective_date": today_dt.strftime("%Y-%m-%d"),
                    "retained_count": len(old_set & new_set),
                    "added_stocks": sorted(list(new_set - old_set)),
                    "removed_stocks": sorted(list(old_set - new_set)),
                }]
                try:
                    requests.post(f"{URL}/rest/v1/rebalance_history",
                                  headers=headers, json=history_data)
                except Exception:
                    pass
                print(f"  * Updated constituents ({len(const_data)} stocks)")
        except ImportError:
            print("  [WARN] rebalance_momentum module not found, skip")
        except Exception as e:
            print(f"  [WARN] Rebalance error: {e}")


def run_all():
    today_dt = datetime.now()
    print("=" * 60)
    print(f"Unified Daily Sync - {today_dt.strftime('%Y-%m-%d %H:%M')}")
    print("=" * 60)
    update_taiwan_high_beta(today_dt)
    update_nasdaq_high_beta(today_dt)
    update_taiwan_momentum(today_dt)
    print("\n" + "=" * 60)
    print("All sync tasks completed!")
    print("=" * 60)


if __name__ == "__main__":
    run_all()

