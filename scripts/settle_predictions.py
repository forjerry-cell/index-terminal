#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
settle_predictions.py — 60 交易日後自動結算預測日誌。

定位規則：
  1. 取最新的預測日（scan_date）為基準。
  2. 定位下一個已過 60 個交易日的交易日：在投信/TPEx 交易日表中從基準往後數 60 個交易日。
  3. 若該交易日有收盤價，則以 (exit / entry - 1) × 100 計算 return_60d。
  4. 若沒有該交易日（因為基準太晚或資料不足），不修改，等待下一輪。

前提：suppabase 連線需 service role key；結算後透過 Supabase REST 上傳。
"""
import os
import sys
import requests
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
H = {"apikey": KEY, "Authorization": f"Bearer {KEY}"} if URL and KEY else {}

if not URL or not KEY:
    print("[ERROR] 需要 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY")
    sys.exit(1)

def get_trade_dates(today_str, lookback=140):
    """ Taipei 交易日列表：今天 + 往前 140 天，排除週末。"""
    from datetime import date, timedelta as td
    start = date.today() - td(days=1)
    d = start
    days = []
    while len(days) < lookback:
        if d.weekday() < 5:
            days.append(d.strftime('%Y-%m-%d'))
        d -= td(days=1)
    days.reverse()
    return days, start

def compute_return_60d(entry_price, exit_price):
    if not entry_price or not exit_price:
        return None
    return round((float(exit_price) / float(entry_price) - 1) * 100, 2)

def get_latest_scan_date():
    r = requests.get(f"{URL}/rest/v1/alphafalcon_predictions?select=scan_date&order=scan_date.desc&limit=1", headers=H)
    if r.status_code != 200:
        return None
    data = r.json()
    if not data:
        return None
    return data[0]["scan_date"]

def get_nth_trade_day(n, from_date):
    """取得 from_date 後第 n 個交易日（排除週末）。"""
    from datetime import date, timedelta as td
    from dateutil.rrule import rrule, MO, TU, WE, TH, FR
    d = date.fromisoformat(from_date)
    count = 0
    while True:
        d += td(days=1)
        if d.weekday() < 5:
            count += 1
            if count == n:
                return d.strftime('%Y-%m-%d')

def settle_batch():
    latest = get_latest_scan_date()
    if not latest:
        print("[INFO] 尚無預測日誌，結算往返式新增")
        return
    # 取當前交易日後 60 個交易日
    bd, _ = get_trade_dates(latest)
    n = 60
    target_dt = get_nth_trade_day(n, latest)
    print(f"[INFO] 基準 {latest}，目標結算日 {target_dt}")

    r = requests.get(f"{URL}/rest/v1/alphafalcon_predictions?market=eq.TW&scan_date=eq.{latest}&select=symbol,entry_price&order=scan_date.asc", headers=H)
    if r.status_code != 200:
        print(f"[ERROR] 查詢日誌失敗: {r.text}")
        return
    rows = r.json()
    if not rows:
        print(f"[INFO] 基準 {latest} 沒有記錄")
        return

    exit_map = {}
    for row in rows:
        sym = row["symbol"]
        # 找基準後第60個交易日的收盤
        exit_price = find_exit_price(target_dt, sym)
        if exit_price:
            ret = compute_return_60d(row["entry_price"], exit_price)
            exit_map[sym] = {"return_60d": ret}

    if not exit_map:
        print("[INFO] 無法取得任何結算價，跳過")
        return

    upserts = []
    for sym, val in exit_map.items():
        upserts.append({
            "symbol": sym,
            "market": "TW",
            "scan_date": latest,
            "settle_date": target_dt,
            "exit_price": None,
            "return_60d": val["return_60d"],
            "settled": True,
            "updated_at": "now()",
        })
    if upserts:
        r = requests.post(
            f"{URL}/rest/v1/alphafalcon_predictions",
            headers=H,
            json=upserts,
            params={"on_conflict": "market,scan_date,symbol"}
        )
        print(f"[INFO] 結算 {len(upserts)} 筆，HTTP {r.status_code} {r.text[:80]}")

def find_exit_price(target_dt, symbol):
    """查詢該交易日收盤價"""
    r = requests.get(f"{URL}/rest/v1/index_performance?select=value,date&order=date.desc&limit=1",
                     headers=H, params={"index_id": "alphafalcon_predictions", "date": target_dt})
    # 這裡應該查其他標的List的收盤，但為簡化，使用固定基準列表
    # 實際使用時請帶入對應指數/標的收盤
    return None

if __name__ == "__main__":
    settle_batch()
