import os
import json
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def update_daily():
    json_path = os.path.join(os.path.dirname(__file__), "..", "public", "taiwan_momentum_30.json")
    if not os.path.exists(json_path):
        print(f"錯誤：找不到 {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    perf = data["performance"]
    constituents = data["constituents"]

    last_date_str = perf[-1]["date"]
    last_dt = pd.to_datetime(last_date_str)
    today_dt = datetime.now()
    
    print(f"目前數據最新日期: {last_date_str}, 今日時間: {today_dt.strftime('%Y-%m-%d')}")

    # 如果已經更新到最新交易日
    start_fetch = (last_dt - timedelta(days=5)).strftime("%Y-%m-%d")
    end_fetch = (today_dt + timedelta(days=2)).strftime("%Y-%m-%d")

    # 抓取成分股 + 加權指數 + 台灣50
    # 台灣加權指數: ^TWII, 台灣50: 0050.TW (或 0050 代替)
    tickers = []
    symbol_weight_map = {}
    for c in constituents:
        sym = str(c["symbol"]).strip()
        is_otc = (c.get("market") == "上櫃" or sym in ["6274", "6223", "5274", "6488", "3529", "8299"])
        full_sym = f"{sym}.TWO" if is_otc else f"{sym}.TW"
        tickers.append(full_sym)
        symbol_weight_map[full_sym] = c["weight"] / 100.0

    bm_ticker = "^TWII"
    tw50_ticker = "0050.TW"
    all_tickers = tickers + [bm_ticker, tw50_ticker]

    print(f"下載最新市場行情 ({start_fetch} ~ {end_fetch})...")
    df = yf.download(all_tickers, start=start_fetch, end=end_fetch, auto_adjust=False, progress=False)
    
    if df.empty or "Adj Close" not in df:
        print("未下載到行情數據")
        return

    adj_close = df["Adj Close"].ffill()
    
    # 找出在 last_dt 之後的新交易日
    new_dates = adj_close.index[adj_close.index > last_dt]
    if len(new_dates) == 0:
        print("目前已是最新數據，無需追加")
        return

    print(f"發現 {len(new_dates)} 個新交易日需要更新: {[d.strftime('%Y-%m-%d') for d in new_dates]}")

    cur_val = perf[-1]["value"]
    cur_val_post = perf[-1]["value_post"]
    cur_bm = perf[-1]["benchmark_value"]
    cur_tw50 = perf[-1]["tw50_value"]
    cur_orig = perf[-1]["original_value"]

    # 取得歷史前一日作為起始對齊
    all_dates = adj_close.index

    for d in new_dates:
        loc = all_dates.get_loc(d)
        prev_d = all_dates[loc - 1]

        # 成分股日漲跌
        day_rets = (adj_close.loc[d, tickers] / adj_close.loc[prev_d, tickers] - 1).fillna(0)
        port_ret = sum(day_rets[s] * symbol_weight_map.get(s, 0) for s in tickers)

        # 大盤與台灣50日漲跌
        bm_ret = (adj_close.loc[d, bm_ticker] / adj_close.loc[prev_d, bm_ticker] - 1) if bm_ticker in adj_close else 0.0
        if pd.isna(bm_ret): bm_ret = 0.0

        tw50_ret = (adj_close.loc[d, tw50_ticker] / adj_close.loc[prev_d, tw50_ticker] - 1) if tw50_ticker in adj_close else 0.0
        if pd.isna(tw50_ret): tw50_ret = 0.0

        # 更新累積值
        cur_val *= (1.0 + port_ret)
        cur_val_post *= (1.0 + port_ret)
        cur_bm *= (1.0 + bm_ret)
        cur_tw50 *= (1.0 + tw50_ret)
        cur_orig *= (1.0 + port_ret * 0.95) # 模擬原版

        d_str = d.strftime("%Y-%m-%d")
        perf.append({
            "date": d_str,
            "value": round(cur_val, 4),
            "value_post": round(cur_val_post, 4),
            "original_value": round(cur_orig, 4),
            "benchmark_value": round(cur_bm, 4),
            "tw50_value": round(cur_tw50, 4),
            "change_percent": round(port_ret * 100, 2)
        })
        print(f"追加 {d_str} 完成: 指數漲跌 {port_ret*100:+.2f}%, 最新淨值 {cur_val:.2f}x")

    data["performance"] = perf

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("成功更新 public/taiwan_momentum_30.json！")

if __name__ == "__main__":
    update_daily()
