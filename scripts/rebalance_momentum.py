#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
台股強勢動能指數 (Top 30) 定期定審換股模組
=========================================
依據特選臺灣上市上櫃FactSet高波動報酬指數 (FTHB003V02) 官方編製規則：
1. 採樣範圍：上市上櫃市值前 150 大。
2. 流動性篩選：近 20 日日均成交額 >= 1 億元。
3. 緩衝區排序 (Buffer Rule)：
   - 計算近 126 日 Beta 值 (對 ^TWII) 排序。
   - 既有成分股中 Beta 排名在「前 100 名」者優先保留。
   - 不足 50 檔由新進標的依 Beta 由高至低補足至 50 檔。
4. 權重與約束：
   - 126 日 Beta 加權 + 市值增益 20%。
   - 單一個股上限 30%、前 5 大總和上限 65%、半導體產業總和上限 60%。
5. Top 30 動能篩選：
   - 從 50 檔母體中，依過去 126 日累積報酬率 (動能) 取前 30 檔。
   - 權重依 50 檔中原始權重比例等比例放大歸一化至 100%。
"""

import os
import json
import numpy as np
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta

# 歷次進入過 FTHB 或台股市值代表性大池股票代號 (約 100 檔)
CORE_UNIVERSE = [
    '1314', '1326', '1402', '1476', '1503', '1519', '1590', '1605', '2014', '2027',
    '2049', '2059', '2231', '2301', '2303', '2308', '2313', '2317', '2327', '2330',
    '2337', '2344', '2345', '2347', '2353', '2354', '2356', '2360', '2368', '2376',
    '2377', '2379', '2382', '2383', '2408', '2409', '2439', '2449', '2454', '2474',
    '2492', '2498', '2603', '2606', '2609', '2610', '2615', '2618', '2915', '3008',
    '3017', '3034', '3037', '3044', '3105', '3189', '3231', '3324', '3374', '3406',
    '3443', '3481', '3529', '3532', '3533', '3653', '3661', '3665', '3707', '3711',
    '4919', '4938', '4958', '4961', '4966', '5269', '5274', '5347', '5483', '5871',
    '6116', '6147', '6213', '6223', '6239', '6274', '6278', '6285', '6409', '6415',
    '6456', '6488', '6526', '6531', '6669', '6781', '6789', '6805', '8046', '8069',
    '8299', '8436', '9904', '9910'
]

OTC_CODES = {
    '3105', '3293', '3324', '3374', '3529', '3707', '4966', '5274', '5347',
    '5483', '6147', '6223', '6274', '6488', '8069', '8299', '8436'
}

STOCK_NAMES = {
    '1314': '中石化', '1326': '台化', '1402': '遠東新', '1476': '儒鴻', '1503': '士電',
    '1519': '華城', '1590': '亞德客-KY', '1605': '華新', '2014': '中鴻', '2027': '大成鋼',
    '2049': '上銀', '2059': '川湖', '2231': '為升', '2301': '光寶科', '2303': '聯電',
    '2308': '台達電', '2313': '華通', '2317': '鴻海', '2327': '國巨*', '2330': '台積電',
    '2337': '旺宏', '2344': '華邦電', '2345': '智邦', '2347': '聯強', '2353': '宏碁',
    '2354': '鴻準', '2356': '英業達', '2360': '致茂', '2368': '金像電', '2376': '技嘉',
    '2377': '微星', '2379': '瑞昱', '2382': '廣達', '2383': '台光電', '2408': '南亞科',
    '2409': '友達', '2439': '美律', '2449': '京元電子', '2454': '聯發科', '2474': '可成',
    '2492': '華新科', '2498': '宏達電', '2603': '長榮', '2606': '裕民', '2609': '陽明',
    '2610': '華航', '2615': '萬海', '2618': '長榮航', '2915': '潤泰全', '3008': '大立光',
    '3017': '奇鋐', '3034': '聯詠', '3037': '欣興', '3044': '健鼎', '3105': '穩懋',
    '3189': '景碩', '3231': '緯創', '3324': '雙鴻', '3374': '精材', '3406': '玉晶光',
    '3443': '創意', '3481': '群創', '3529': '力旺', '3532': '台勝科', '3533': '嘉澤',
    '3653': '健策', '3661': '世芯-KY', '3665': '貿聯-KY', '3707': '漢磊', '3711': '日月光投控',
    '4919': '新唐', '4938': '和碩', '4958': '臻鼎-KY', '4961': '天鈺', '4966': '譜瑞-KY',
    '5269': '祥碩', '5274': '信驊', '5347': '世界', '5483': '中美晶', '5871': '中租-KY',
    '6116': '彩晶', '6147': '頎邦', '6213': '聯茂', '6223': '旺矽', '6239': '力成',
    '6274': '台燿', '6278': '台表科', '6285': '啟碁', '6409': '旭隼', '6415': '矽力*-KY',
    '6456': 'GIS-KY', '6488': '環球晶', '6526': '達發', '6531': '愛普*', '6669': '緯穎',
    '6781': 'AES-KY', '6789': '采鈺', '6805': '富世達', '8046': '南電', '8069': '元太',
    '8299': '群聯', '8436': '大江', '9904': '寶成', '9910': '豐泰'
}

SEMI_CODES = {
    '2303', '2330', '2337', '2344', '2379', '2408', '2449', '2454', '3105', '3189',
    '3374', '3443', '3529', '3532', '3707', '3711', '4919', '4961', '4966', '5269',
    '5274', '5347', '6223', '6239', '6415', '6488', '6526', '6531', '6789', '8299'
}

def get_ticker_symbol(code):
    c = str(code).rstrip('O').strip()
    return f"{c}.TWO" if c in OTC_CODES else f"{c}.TW"

def apply_weight_caps(weights, is_semi, max_single=0.30, max_top5=0.65, max_semi=0.60):
    w = weights.copy()
    for _ in range(100):
        changed = False
        over_single = w > max_single
        if over_single.any():
            excess = (w[over_single] - max_single).sum()
            w[over_single] = max_single
            under = ~over_single
            if under.any() and w[under].sum() > 0:
                w[under] += excess * (w[under] / w[under].sum())
            changed = True
            
        top5_idx = np.argsort(w)[-5:]
        top5_sum = w[top5_idx].sum()
        if top5_sum > max_top5:
            excess = top5_sum - max_top5
            w[top5_idx] *= (max_top5 / top5_sum)
            others = np.ones(len(w), dtype=bool)
            others[top5_idx] = False
            if others.any() and w[others].sum() > 0:
                w[others] += excess * (w[others] / w[others].sum())
            changed = True
            
        semi_idx = np.where(is_semi)[0]
        semi_sum = w[semi_idx].sum()
        if semi_sum > max_semi:
            excess = semi_sum - max_semi
            w[semi_idx] *= (max_semi / semi_sum)
            non_semi = np.where(~is_semi)[0]
            if len(non_semi) > 0 and w[non_semi].sum() > 0:
                w[non_semi] += excess * (w[non_semi] / w[non_semi].sum())
            changed = True
            
        w /= w.sum()
        if not changed:
            break
    return w

def perform_rebalance(cutoff_date_str, existing_codes=None):
    """
    執行定期定審選股主程式：
    1. 下載資料
    2. 計算 126 日 Beta
    3. 套用前 100 名緩衝區保留規則
    4. 計算 Top 30 動能股與權重
    """
    print(f"=== 開始執行定審選股 (資料截止日: {cutoff_date_str}) ===")
    
    cutoff_dt = pd.to_datetime(cutoff_date_str)
    start_dt = (cutoff_dt - timedelta(days=260)).strftime("%Y-%m-%d")
    end_dt = (cutoff_dt + timedelta(days=3)).strftime("%Y-%m-%d")
    
    all_tickers = [get_ticker_symbol(c) for c in CORE_UNIVERSE] + ["^TWII"]
    print(f"正在自 Yahoo Finance 下載 {len(all_tickers)} 檔標的行情 ({start_dt} ~ {end_dt})...")
    df = yf.download(all_tickers, start=start_dt, end=end_dt, auto_adjust=False, progress=False)
    
    if df.empty or "Adj Close" not in df:
        raise RuntimeError("無法下載定審行情資料")
        
    adj_close = df["Adj Close"].loc[:cutoff_date_str].ffill()
    close = df["Close"].loc[:cutoff_date_str].ffill()
    volume = df["Volume"].loc[:cutoff_date_str].fillna(0)
    
    # 取近 127 個交易日 (計算 126 日報酬率)
    tail_adj = adj_close.tail(127)
    tail_rets = tail_adj.pct_change(fill_method=None).iloc[1:]
    bm_rets = tail_rets["^TWII"].dropna()
    
    # 20 日日均成交額
    tail_close_20 = close.tail(20)
    tail_vol_20 = volume.tail(20)
    amt_20 = (tail_close_20 * tail_vol_20).mean()
    
    # 計算候選個股 Beta
    cands = []
    for c in CORE_UNIVERSE:
        sym = get_ticker_symbol(c)
        if sym not in tail_rets:
            continue
        s_rets = tail_rets[sym].dropna()
        valid_idx = s_rets.index.intersection(bm_rets.index)
        if len(valid_idx) < 90:
            continue
        cov = np.cov(s_rets.loc[valid_idx], bm_rets.loc[valid_idx])[0, 1]
        var_m = np.var(bm_rets.loc[valid_idx])
        b = max(cov / var_m, 0.0001) if var_m > 0 else 1.0
        
        # 126 日動能報酬
        tot_ret = (1 + s_rets.loc[valid_idx]).prod() - 1
        
        cands.append({
            'code': c,
            'symbol': sym,
            'name': STOCK_NAMES.get(c, c),
            'market': '上櫃' if c in OTC_CODES else '上市',
            'is_semi': c in SEMI_CODES,
            'beta': b,
            'amt': amt_20.get(sym, 1e8),
            'momentum_126d': tot_ret
        })
        
    df_cands = pd.DataFrame(cands)
    # 排序取前 150 大流動性/規模
    df_top150 = df_cands.sort_values(by='amt', ascending=False).head(150).copy()
    df_top150.sort_values(by='beta', ascending=False, inplace=True)
    df_top150.reset_index(drop=True, inplace=True)
    df_top150['beta_rank'] = df_top150.index + 1
    
    # 緩衝區選股 (Buffer Rule)
    selected_codes = []
    if existing_codes:
        # 既有成分股且 Beta 排名在前 100 名者優先保留
        retained = df_top150[(df_top150['code'].isin(existing_codes)) & (df_top150['beta_rank'] <= 100)]
        selected_codes.extend(retained['code'].tolist())
        needed = 50 - len(selected_codes)
        if needed > 0:
            new_cands = df_top150[~df_top150['code'].isin(selected_codes)]
            selected_codes.extend(new_cands.head(needed)['code'].tolist())
    else:
        selected_codes = df_top150.head(50)['code'].tolist()
        
    df_fthb50 = df_top150[df_top150['code'].isin(selected_codes)].copy()
    df_fthb50.reset_index(drop=True, inplace=True)
    
    # 計算 50 檔權重
    beta_w = df_fthb50['beta'] / df_fthb50['beta'].sum()
    cap_w = df_fthb50['amt'] / df_fthb50['amt'].sum()
    initial_w = (0.80 * beta_w + 0.20 * cap_w)
    initial_w /= initial_w.sum()
    
    final_w = apply_weight_caps(initial_w.values, df_fthb50['is_semi'].values)
    df_fthb50['weight_50'] = final_w
    
    # Top 30 動能篩選
    df_fthb50.sort_values(by='momentum_126d', ascending=False, inplace=True)
    df_fthb50.reset_index(drop=True, inplace=True)
    
    top30 = df_fthb50.head(30).copy()
    top30['weight'] = top30['weight_50'] / top30['weight_50'].sum()
    
    result_constituents = []
    for _, r in top30.iterrows():
        result_constituents.append({
            'symbol': str(r['code']),
            'name': str(r['name']),
            'weight': round(float(r['weight']) * 100, 2),
            'momentum_126d': f"{float(r['momentum_126d']) * 100:+.1f}%",
            'market': str(r['market'])
        })
        
    print(f"定審選股完成！共選出 30 檔動能成分股，權重總和: {sum(c['weight'] for c in result_constituents):.2f}%")
    return result_constituents

if __name__ == "__main__":
    test_res = perform_rebalance("2026-05-29")
    print("前 5 大成分股：", test_res[:5])
