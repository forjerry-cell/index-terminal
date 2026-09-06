#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
台股強勢動能指數 (Top 30) 每日自動同步與定期定審換股引擎
======================================================
1. 每日自動抓取台股最新行情，計算成分股報酬、大盤加權指數、台灣50表現並追加每日淨值。
2. 每年 6 月與 12 月中旬 (定審生效日窗口)，自動觸發 FTHB003V02 官方編製演算法定審：
   - 採樣上市櫃市值前 150 大。
   - 流動性檢驗 (20 日均量達標)。
   - 依 126 日 Beta 由高至低排序。
   - 緩衝區機制：既有成分股前 100 名優先保留，不足 50 檔由未選取者依序補足。
   - 權重配置：126 日 Beta 加權 + 市值線性增益 20%，套用 30% 單一上限、65% 前五大上限、60% 半導體上限。
   - 精選 Top 30 動能股 (前 126 日累積報酬領先者)，等比例歸一化至 100%。
   - 自動更新 constituents 並在 rebalance_history 中記載換股審核紀錄。
"""

import os
import sys
import json
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# 引入定審模組
sys.path.append(os.path.dirname(__file__))
from rebalance_momentum import perform_rebalance, get_ticker_symbol

def check_rebalance_due(date_dt, last_rebalance_term):
    """
    判斷指定日期是否為定審換股生效窗口
    每年 6 月與 12 月，且日期在 16 日以上
    """
    year = date_dt.year
    month = date_dt.month
    day = date_dt.day
    
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

def update_daily():
    json_path = os.path.join(os.path.dirname(__file__), "..", "public", "taiwan_momentum_30.json")
    if not os.path.exists(json_path):
        print(f"錯誤：找不到 {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    perf = data["performance"]
    constituents = data["constituents"]
    rebalance_history = data.get("rebalance_history", [])
    last_rebalance_term = data.get("last_rebalance_term", "2026-06") # 起始基期為 2026-06

    last_date_str = perf[-1]["date"]
    last_dt = pd.to_datetime(last_date_str)
    today_dt = datetime.now()
    
    print(f"目前數據最新日期: {last_date_str}, 今日時間: {today_dt.strftime('%Y-%m-%d')}")

    # 下載市場行情
    start_fetch = (last_dt - timedelta(days=5)).strftime("%Y-%m-%d")
    end_fetch = (today_dt + timedelta(days=2)).strftime("%Y-%m-%d")

    tickers = []
    symbol_weight_map = {}
    for c in constituents:
        sym = str(c["symbol"]).strip()
        full_sym = get_ticker_symbol(sym)
        tickers.append(full_sym)
        symbol_weight_map[full_sym] = c["weight"] / 100.0

    bm_ticker = "^TWII"
    tw50_ticker = "0050.TW"
    all_tickers = list(set(tickers + [bm_ticker, tw50_ticker]))

    print(f"下載最新市場行情 ({start_fetch} ~ {end_fetch})...")
    df = yf.download(all_tickers, start=start_fetch, end=end_fetch, auto_adjust=False, progress=False)
    
    if df.empty or "Adj Close" not in df:
        print("未下載到行情數據")
        return

    adj_close = df["Adj Close"].ffill()
    new_dates = adj_close.index[adj_close.index > last_dt]
    
    if len(new_dates) == 0:
        print("目前行情已是最新，檢查是否需要定審換股...")
        is_due, term, cutoff = check_rebalance_due(today_dt, last_rebalance_term)
        if is_due:
            print(f"到達定審換股窗口 ({term})，資料截止日 {cutoff}，開始換股...")
            existing_codes = set([str(c["symbol"]).strip() for c in constituents])
            new_constituents = perform_rebalance(cutoff, existing_codes=existing_codes)
            
            # 記錄換股日誌
            old_set = existing_codes
            new_set = set([c["symbol"] for c in new_constituents])
            rebalance_history.append({
                "term": term,
                "effective_date": today_dt.strftime("%Y-%m-%d"),
                "retained_count": len(old_set & new_set),
                "added_stocks": sorted(list(new_set - old_set)),
                "removed_stocks": sorted(list(old_set - new_set))
            })
            
            data["constituents"] = new_constituents
            data["last_rebalance_term"] = term
            data["rebalance_history"] = rebalance_history
            with open(json_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"定審換股完成並已儲存！({term})")
        else:
            print("目前非定審窗口，無需換股。")
        return

    print(f"發現 {len(new_dates)} 個新交易日需要更新: {[d.strftime('%Y-%m-%d') for d in new_dates]}")

    cur_val = perf[-1]["value"]
    cur_val_post = perf[-1]["value_post"]
    cur_bm = perf[-1]["benchmark_value"]
    cur_tw50 = perf[-1]["tw50_value"]
    cur_orig = perf[-1]["original_value"]

    all_dates = adj_close.index

    for d in new_dates:
        # 1. 檢查當天是否觸發定審換股
        is_due, term, cutoff = check_rebalance_due(d, last_rebalance_term)
        if is_due:
            print(f"\n★ 交易日 {d.strftime('%Y-%m-%d')} 觸發定審換股 ({term})！")
            existing_codes = set([str(c["symbol"]).strip() for c in constituents])
            try:
                new_constituents = perform_rebalance(cutoff, existing_codes=existing_codes)
                old_set = existing_codes
                new_set = set([c["symbol"] for c in new_constituents])
                rebalance_history.append({
                    "term": term,
                    "effective_date": d.strftime("%Y-%m-%d"),
                    "retained_count": len(old_set & new_set),
                    "added_stocks": sorted(list(new_set - old_set)),
                    "removed_stocks": sorted(list(old_set - new_set))
                })
                constituents = new_constituents
                last_rebalance_term = term
                
                # 重新構建持股與權重映射
                tickers = []
                symbol_weight_map = {}
                for c in constituents:
                    sym = str(c["symbol"]).strip()
                    full_sym = get_ticker_symbol(sym)
                    tickers.append(full_sym)
                    symbol_weight_map[full_sym] = c["weight"] / 100.0
                print(f"★ 成功切換至新一期成分股，新一期包含 {len(constituents)} 檔股票！\n")
            except Exception as e:
                print(f"定審換股執行異常: {e}，維持原持股組合。")

        # 2. 正常計算當日日報酬率
        loc = all_dates.get_loc(d)
        prev_d = all_dates[loc - 1]

        day_rets = (adj_close.loc[d, tickers] / adj_close.loc[prev_d, tickers] - 1).fillna(0)
        port_ret = sum(day_rets[s] * symbol_weight_map.get(s, 0) for s in tickers if s in day_rets)

        bm_ret = (adj_close.loc[d, bm_ticker] / adj_close.loc[prev_d, bm_ticker] - 1) if bm_ticker in adj_close else 0.0
        if pd.isna(bm_ret): bm_ret = 0.0

        tw50_ret = (adj_close.loc[d, tw50_ticker] / adj_close.loc[prev_d, tw50_ticker] - 1) if tw50_ticker in adj_close else 0.0
        if pd.isna(tw50_ret): tw50_ret = 0.0

        cur_val *= (1.0 + port_ret)
        cur_val_post *= (1.0 + port_ret)
        cur_bm *= (1.0 + bm_ret)
        cur_tw50 *= (1.0 + tw50_ret)
        cur_orig *= (1.0 + port_ret * 0.95)

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
    data["constituents"] = constituents
    data["last_rebalance_term"] = last_rebalance_term
    data["rebalance_history"] = rebalance_history

    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print("成功更新 public/taiwan_momentum_30.json！")

if __name__ == "__main__":
    update_daily()
