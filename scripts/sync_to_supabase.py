import os
import yfinance as yf
import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta

# Supabase 設定
URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def upload_to_supabase(table, data_list):
    """使用 REST API 直接上傳 (Upsert)"""
    if not data_list:
        return
    
    # 根據 table 決定 conflict 欄位
    on_conflict = "index_id,date"
    if table == "index_constituents":
        on_conflict = "index_id,symbol,date"
        
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    # Supabase/PostgREST upsert 需要在 URL 指定 on_conflict
    endpoint = f"{URL}/rest/v1/{table}?on_conflict={on_conflict}"
    
    batch_size = 100
    for i in range(0, len(data_list), batch_size):
        batch = data_list[i:i+batch_size]
        res = requests.post(endpoint, headers=headers, json=batch)
        if res.status_code not in [200, 201, 204]:
            print(f"上傳 {table} 失敗: {res.text}")
        else:
            print(f"Successfully synced {len(batch)} rows to {table}")

def calculate_taiwan_high_beta(start_date, end_date):
    print("--- [台股] 計算領航強勢指數 ---")
    name_map = {
        "2330.TW": "台積電", "2317.TW": "鴻海", "2454.TW": "聯發科", "2308.TW": "台達電", "2303.TW": "聯電",
        "2382.TW": "廣達", "2412.TW": "中華電", "2881.TW": "富邦金", "2882.TW": "國泰金", "2886.TW": "兆豐金",
        "3008.TW": "大立光", "2891.TW": "中信金", "3711.TW": "日月光投控", "2357.TW": "華碩", "2885.TW": "元大金",
        "2892.TW": "第一金", "2327.TW": "國巨", "3231.TW": "緯創", "1101.TW": "台泥", "2603.TW": "長榮",
        "2609.TW": "陽明", "2408.TW": "南亞科", "2409.TW": "友達", "3481.TW": "群創", "2337.TW": "旺宏",
        "2344.TW": "華邦電", "2884.TW": "玉山金", "5880.TW": "合庫金", "2379.TW": "瑞昱", "3034.TW": "聯詠",
        "2449.TW": "京元電子", "2301.TW": "光寶科", "6669.TW": "緯穎", "2313.TW": "華通", "3017.TW": "奇鋐",
        "3035.TW": "智原", "5269.TW": "祥碩", "2618.TW": "長榮航", "1216.TW": "統一", "1402.TW": "遠東新",
        "6488.TWO": "環球晶", "8069.TWO": "元太", "3293.TWO": "鈊象", "3529.TWO": "力旺", "2360.TW": "致茂",
        "2345.TW": "智邦", "2377.TW": "微星", "2352.TW": "佳世達", "4938.TW": "和碩", "6415.TW": "矽力*-KY",
        "3661.TW": "世芯-KY", "5274.TW": "信驊", "3406.TW": "玉晶光", "2105.TW": "正新", "2207.TW": "和泰車",
        "1513.TW": "中興電", "1519.TW": "華城", "3653.TW": "健策", "4958.TW": "臻鼎-KY", "8299.TW": "群聯",
        "2801.TW": "彰銀", "1301.TW": "台塑", "1303.TW": "南亞", "2002.TW": "中鋼", "2912.TW": "統一超",
        "5904.TW": "寶雅", "9921.TW": "巨大", "9910.TW": "豐泰", "1503.TW": "士電", "2610.TW": "華航",
        "2615.TW": "萬海", "2376.TW": "技嘉", "2356.TW": "英業達", "2324.TW": "仁寶", "2353.TW": "宏碁",
        "2401.TW": "凌陽", "2474.TW": "可成", "4966.TWO": "譜瑞-KY", "3105.TWO": "穩懋", "6223.TWO": "旺矽",
        "6147.TWO": "頎邦", "3264.TWO": "欣銓", "5483.TWO": "中美晶", "6274.TWO": "台燿", "6213.TW": "聯茂",
        "2368.TW": "金像電", "3037.TW": "欣興", "8046.TW": "南電", "3044.TW": "健鼎", "2383.TW": "台光電",
        "3443.TW": "創意", "2404.TW": "漢唐", "3376.TW": "新日興", "6176.TW": "瑞儀", "2354.TW": "鴻準",
        "4919.TW": "新唐", "2439.TW": "美律", "3532.TW": "台勝科", "3042.TW": "晶技", "2458.TW": "義隆",
        "3005.TW": "神基", "3702.TW": "大聯大", "3701.TW": "大眾控", "2347.TW": "聯強", "2633.TW": "台灣高鐵",
        "2880.TW": "華南金", "2883.TW": "開發金", "2887.TW": "台新金", "2888.TW": "新光金", "2889.TW": "國票金",
        "2890.TW": "永豐金", "5871.TW": "中租-KY", "5876.TW": "上海商銀", "9904.TW": "寶成", "9945.TW": "潤泰新"
    }
    universe = list(name_map.keys())
    bm_ticker = "^TWII"
    
    # 下載數據
    fetch_start = "2025-01-01"
    print(f"下載數據中... {fetch_start} to {end_date}")
    full_data = yf.download(universe + [bm_ticker], start=fetch_start, end=end_date, progress=False, auto_adjust=False)
    
    if isinstance(full_data.columns, pd.MultiIndex):
        adj_close = full_data['Adj Close'].fillna(method='ffill')
        price_close = full_data['Close'].fillna(method='ffill')
        volume = full_data['Volume'].fillna(0)
    else:
        # 單一股票情況 (理論上不會發生)
        adj_close = full_data[['Adj Close']].fillna(method='ffill')
        price_close = full_data[['Close']].fillna(method='ffill')
        volume = full_data[['Volume']].fillna(0)
    
    if bm_ticker not in adj_close.columns:
        print(f"錯誤：找不到基準指數 {bm_ticker} 的數據")
        return
        
    bm_p = adj_close[bm_ticker]
    available_universe = [t for t in universe if t in adj_close.columns]
    stock_adj_rets = adj_close[available_universe].pct_change()
    
    # 計算 Beta 與選股 (簡化邏輯：使用最新一季的配置)
    # 在 4/28，我們處於 Q2 (4月、5月、6月)，上次再平衡是 4/1
    rb_dates = [d for d in adj_close.index if d.month in [1, 4, 7, 10] and d.day <= 7]
    # 找出最後一個再平衡日
    last_rb = [d for d in rb_dates if d <= pd.to_datetime(end_date)][-1]
    print(f"最後再平衡日: {last_rb.date()}")
    
    # 計算該日的 Beta 排名
    hist_lookback = last_rb - timedelta(days=365)
    hist_data = adj_close.loc[hist_lookback:last_rb].pct_change().dropna()
    m_rets = hist_data[bm_ticker]
    v_m = np.var(m_rets)
    
    betas = {}
    for t in universe:
        if t in hist_data.columns and len(hist_data[t].dropna()) > 200:
            cov = np.cov(hist_data[t], m_rets)[0,1]
            betas[t] = cov / v_m if v_m != 0 else 0
            
    # 排序並選出前 50
    eligible = [t for t in betas if betas[t] > 0]
    holdings = sorted(eligible, key=lambda x: betas[x], reverse=True)[:50]
    
    # 權重 (簡化：等權重或按 Beta 比例，此處採 Beta 比例並限制 30%)
    w = pd.Series({t: betas[t] for t in holdings})
    w /= w.sum()
    w = w.clip(upper=0.30); w /= w.sum()
    
    # 計算從 2026-01-01 開始的累積報酬 (為了對接歷史數據)
    calc_start = "2026-01-01"
    period_dates = adj_close.loc[calc_start:].index
    
    # 獲取歷史基準值 (2026-04-24 的數據)
    # 從 DB 獲取太複雜，我們假設我們知道 2026-01-01 的值或直接覆蓋近期數據
    # 這裡採取的策略是：計算最新的日變動，並上傳
    
    results = []
    # 只需要更新最近幾天
    update_dates = period_dates[period_dates >= pd.to_datetime(start_date)]
    
    # 我們需要知道 start_date 前一天的 value
    # 為了簡單，我們直接計算整個 2026 年的累計值，然後與 DB 對齊
    # 根據之前的查詢，2026-04-24 的 value 是 9.62, benchmark 是 4.5
    
    # 模擬 2026 年以來的表現
    port_val = 1.0
    bm_val = 1.0
    
    # 找到 2026-04-24 的索引位置來計算縮放係數
    anchor_date = "2026-04-24"
    anchor_port_val = 9.62
    anchor_bm_val = 4.5
    
    # 先計算所有日期的回報
    daily_rets = (stock_adj_rets[holdings] * w).sum(axis=1)
    bm_daily_rets = bm_p.pct_change().fillna(0)
    
    # 以 anchor_date 為基準回推或前推
    # 我們要計算 update_dates 的值
    for d in update_dates:
        # 計算相對於 anchor_date 的倍數
        # 這裡為了精確，我們直接用累積回報比值
        mask_anchor_to_d = (daily_rets.index > pd.to_datetime(anchor_date)) & (daily_rets.index <= d)
        bm_mask_anchor_to_d = (bm_daily_rets.index > pd.to_datetime(anchor_date)) & (bm_daily_rets.index <= d)
        
        rel_port = (1 + daily_rets[mask_anchor_to_d]).prod()
        rel_bm = (1 + bm_daily_rets[bm_mask_anchor_to_d]).prod()
        
        results.append({
            "index_id": "taiwan_high_beta",
            "date": d.strftime("%Y-%m-%d"),
            "value": round(anchor_port_val * rel_port, 2),
            "change_percent": round(daily_rets[d] * 100, 4),
            "benchmark_value": round(anchor_bm_val * rel_bm, 2)
        })
    
    upload_to_supabase("index_performance", results)
    
    # 同時更新成分股
    const_data = []
    for t in holdings:
        const_data.append({
            "index_id": "taiwan_high_beta",
            "symbol": t,
            "name": name_map.get(t, t),
            "weight": round(w[t] * 100, 4),
            "date": update_dates[-1].strftime("%Y-%m-%d") if not update_dates.empty else datetime.now().strftime("%Y-%m-%d")
        })
    upload_to_supabase("index_constituents", const_data)

def calculate_nasdaq_high_beta(start_date, end_date):
    print("--- [那指] 計算領航強勢指數 ---")
    tickers = [
        "NVDA", "AAPL", "GOOGL", "GOOG", "MSFT", "AMZN", "AVGO", "META", "TSLA", "WMT",
        "ASML", "COST", "NFLX", "MU", "PLTR", "AMD", "CSCO", "AMAT", "LRCX", "TMUS",
        "LIN", "PEP", "INTC", "AMGN", "KLAC", "TXN", "GILD", "ISRG", "ADI", "SHOP",
        "ARM", "HON", "PDD", "QCOM", "BKNG", "APP", "PANW", "INTU", "VRTX", "CEG",
        "CMCSA", "SBUX", "ADBE", "CRWD", "WDC", "MAR", "ADP", "MELI", "STX", "ORLY",
        "REGN", "MRVL", "CDNS", "MDLZ", "CSX", "ABNB", "SNPS", "AEP", "MNST", "ROST",
        "CTAS", "WBD", "DASH", "BKR", "PCAR", "FTNT", "FANG", "FAST", "EA", "EXC",
        "ADSK", "XEL", "MPWR", "NXPI", "FER", "IDXX", "MSTR", "ALNY", "CCEP", "PYPL",
        "DDOG", "TRI", "ODFL", "ROP", "KDP", "TTWO", "PAYX", "AXON", "WDAY", "INSM",
        "MCHP", "CPRT", "GEHC", "CHTR", "CTSH", "KHC", "VRSK", "DXCM", "ZS", "TEAM", "CSGP"
    ]
    bm_ticker = "QQQ"
    
    fetch_start = "2025-01-01"
    print(f"下載數據中... {fetch_start} to {end_date}")
    full_data = yf.download(tickers + [bm_ticker], start=fetch_start, end=end_date, progress=False, auto_adjust=False)
    
    if isinstance(full_data.columns, pd.MultiIndex):
        adj_close = full_data['Adj Close'].fillna(method='ffill')
        price_close = full_data['Close'].fillna(method='ffill')
    else:
        adj_close = full_data[['Adj Close']].fillna(method='ffill')
    
    if bm_ticker not in adj_close.columns:
        print(f"錯誤：找不到基準指數 {bm_ticker} 的數據")
        return

    bm_p = adj_close[bm_ticker]
    available_tickers = [t for t in tickers if t in adj_close.columns]
    stock_adj_rets = adj_close[available_tickers].pct_change()
    
    # 最後再平衡日 (季度末)
    last_rb = adj_close.index[adj_close.index <= pd.to_datetime(end_date)][adj_close.index.to_period('Q') != adj_close.index.to_period('Q').shift(-1)][-2] # 上個季末
    # 實際上 NQ 腳本用 QE。4/28 處於 Q2，上次是 3/31
    last_rb = pd.to_datetime("2026-03-31")
    if last_rb > adj_close.index[-1]: last_rb = adj_close.index[-20] # 安全回退
    
    hist_lookback = last_rb - timedelta(days=365)
    hist_data = adj_close.loc[hist_lookback:last_rb].pct_change().dropna()
    m_rets = hist_data[bm_ticker]
    v_m = np.var(m_rets)
    
    betas = {}
    for t in tickers:
        if t in hist_data.columns and len(hist_data[t].dropna()) > 200:
            cov = np.cov(hist_data[t], m_rets)[0,1]
            betas[t] = cov / v_m if v_m != 0 else 0
            
    top_30 = sorted(betas.items(), key=lambda x: x[1], reverse=True)[:30]
    holdings = [t for t, b in top_30]
    
    w = pd.Series({t: b for t, b in top_30})
    w /= w.sum()
    # 上限 10%
    w = w.clip(upper=0.10); w /= w.sum()
    
    period_dates = adj_close.loc["2026-01-01":].index
    anchor_date = "2026-04-23"
    anchor_port_val = 29.3
    anchor_bm_val = 6.4
    
    daily_rets = (stock_adj_rets[holdings] * w).sum(axis=1)
    bm_daily_rets = bm_p.pct_change().fillna(0)
    
    results = []
    update_dates = period_dates[period_dates >= pd.to_datetime(start_date)]
    
    for d in update_dates:
        mask_anchor_to_d = (daily_rets.index > pd.to_datetime(anchor_date)) & (daily_rets.index <= d)
        bm_mask_anchor_to_d = (bm_daily_rets.index > pd.to_datetime(anchor_date)) & (bm_daily_rets.index <= d)
        
        rel_port = (1 + daily_rets[mask_anchor_to_d]).prod()
        rel_bm = (1 + bm_daily_rets[bm_mask_anchor_to_d]).prod()
        
        results.append({
            "index_id": "nasdaq_high_beta",
            "date": d.strftime("%Y-%m-%d"),
            "value": round(anchor_port_val * rel_port, 2),
            "change_percent": round(daily_rets[d] * 100, 4),
            "benchmark_value": round(anchor_bm_val * rel_bm, 2)
        })
    
    upload_to_supabase("index_performance", results)
    
    # 更新成分股
    const_data = []
    for t in holdings:
        const_data.append({
            "index_id": "nasdaq_high_beta",
            "symbol": t,
            "name": t, # NQ 暫時用代碼
            "weight": round(w[t] * 100, 4),
            "date": update_dates[-1].strftime("%Y-%m-%d") if not update_dates.empty else datetime.now().strftime("%Y-%m-%d")
        })
    upload_to_supabase("index_constituents", const_data)

def run_sync():
    # 我們從 2026-04-24 開始更新，覆蓋到今天
    # yfinance 的 end 是 exclusive，所以要設為明天
    sync_from = "2026-04-24"
    today_dt = datetime.now()
    tomorrow = (today_dt + timedelta(days=1)).strftime("%Y-%m-%d")
    today_str = today_dt.strftime("%Y-%m-%d")
    
    print(f"啟動同步任務: {sync_from} -> {today_str} (下載至 {tomorrow})")
    
    calculate_taiwan_high_beta(sync_from, tomorrow)
    calculate_nasdaq_high_beta(sync_from, tomorrow)
    
    print("同步任務完成！")

if __name__ == "__main__":
    if not URL or not KEY:
        print("錯誤：找不到 SUPABASE_URL 或 KEY 環境變數")
    else:
        run_sync()
