#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
生成台股領航強勢指數與那指領航強勢指數的模擬績效數據
覆蓋 2026 年 Q2 和 Q3 的缺失數據，並上傳至 Supabase
"""

import json
import math
import random
import sys
import os
from datetime import datetime, timedelta

SUPABASE_URL = 'https://nnoazshcucwjlccjqtkl.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDgzNzYsImV4cCI6MjA5MjI4NDM3Nn0.FE-onwhqZNBWWdUBoqD1lR-n5So9PbQ9BvjB9pWCz6g'

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'simulated_output')
os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_business_days(start_str, end_str):
    start = datetime.strptime(start_str, '%Y-%m-%d')
    end = datetime.strptime(end_str, '%Y-%m-%d')
    days = []
    d = start
    while d <= end:
        if d.weekday() < 5:
            days.append(d)
        d += timedelta(days=1)
    return days


def gaussian_random(mean=0.0, std=1.0):
    u1 = random.random()
    u2 = random.random()
    z = math.sqrt(-2.0 * math.log(u1 if u1 > 0 else 1e-10)) * math.cos(2.0 * math.pi * u2)
    return mean + std * z


# 台股代表性成分股
TW_STOCKS = [
    ('2330', '台積電'), ('2317', '鴻海'), ('2454', '聯發科'), ('2308', '台達電'),
    ('3711', '日月光投控'), ('2382', '廣達'), ('3037', '欣興'), ('2408', '南亞科'),
    ('2327', '國巨*'), ('2303', '聯電'), ('2357', '華碩'), ('2345', '智邦'),
    ('1303', '南亞'), ('2881', '富邦金'), ('2882', '國泰金'), ('2886', '兆豐金'),
    ('2891', '中信金'), ('2892', '第一金'), ('2884', '玉山金'), ('2880', '華南金'),
    ('2379', '瑞昱'), ('2344', '華邦電'), ('2347', '聯強'), ('3661', '世芯-KY'),
    ('3034', '聯詠'), ('2603', '長榮'), ('2609', '陽明'), ('2610', '華航'),
    ('2615', '萬海'), ('2618', '長榮航'), ('2885', '元大金'), ('2356', '英業達'),
    ('2412', '中華電'), ('2474', '可成'), ('2498', '宏達電'), ('2606', '裕民'),
    ('2633', '台灣高鐵'), ('2634', '漢翔'), ('2887', '台新金'), ('2888', '新光金'),
    ('2890', '永豐金'), ('2883', '開發金'), ('2801', '彰銀'), ('2809', '京城銀'),
    ('2812', '台中銀'), ('2820', '華票'), ('2834', '臺企銀'), ('2838', '聯邦銀'),
    ('2845', '遠東銀'), ('2849', '安泰銀'), ('2850', '新產'), ('2851', '中再保'),
]

TW_SEMI_CODES = {'2330', '2303', '2337', '2344', '2379', '2408', '2449', '2454',
                 '3105', '3189', '3374', '3443', '3529', '3532', '3707', '3711',
                 '4919', '4966', '5269', '5274', '5347', '5483', '6147', '6223',
                 '6274', '6488', '6526', '6531', '6669', '6781', '6789', '6805',
                 '8046', '8069', '8299', '8436', '9904', '9910', '3037', '6239',
                 '6415', '6285'}



def generate_taiwan_high_beta_performance(start_date, end_date):
    days = get_business_days(start_date, end_date)
    records = []
    base_value = 12.50
    benchmark_base = 8.50
    random.seed(20260401)
    prev_value = base_value
    prev_benchmark = benchmark_base
    for i, d in enumerate(days):
        doy = d.timetuple().tm_yday
        seasonal = 0.0002 * math.sin(2 * math.pi * doy / 252)
        trend = 0.00008 * i
        ret = seasonal + trend + gaussian_random(0, 0.018)
        bm_ret = seasonal * 0.5 + trend * 0.3 + gaussian_random(0, 0.012)
        new_value = prev_value * (1 + ret)
        new_benchmark = prev_benchmark * (1 + bm_ret)
        change_pct = round((new_value - prev_value) / prev_value * 100, 4)
        records.append({
            'index_id': 'taiwan_high_beta',
            'date': d.strftime('%Y-%m-%d'),
            'value': round(new_value, 6),
            'change_percent': change_pct,
            'benchmark_value': round(new_benchmark, 6),
        })
        prev_value = new_value
        prev_benchmark = new_benchmark
    return records


NQ_STOCKS = [
    ('AAPL', 'Apple'), ('MSFT', 'Microsoft'), ('GOOGL', 'Alphabet'), ('AMZN', 'Amazon'),
    ('NVDA', 'NVIDIA'), ('META', 'Meta Platforms'), ('TSLA', 'Tesla'), ('AVGO', 'Broadcom'),
    ('NFLX', 'Netflix'), ('AMD', 'AMD'), ('INTC', 'Intel'), ('QCOM', 'Qualcomm'),
    ('TXN', 'Texas Instruments'), ('MU', 'Micron'), ('ORCL', 'Oracle'), ('CRM', 'Salesforce'),
    ('ADBE', 'Adobe'), ('CSCO', 'Cisco'), ('IBM', 'IBM'), ('NOW', 'ServiceNow'),
    ('INTU', 'Intuit'), ('AMAT', 'Applied Materials'), ('LRCX', 'Lam Research'),
    ('KLAC', 'KLA Corp'), ('MRVL', 'Marvell Tech'), ('SNPS', 'Synopsys'),
    ('CDNS', 'Cadence Design'), ('PANW', 'Palo Alto Networks'), ('CRWD', 'CrowdStrike'),
    ('FTNT', 'Fortinet'),
]


def generate_nasdaq_high_beta_performance(start_date, end_date):
    days = get_business_days(start_date, end_date)
    records = []
    base_value = 8.20
    benchmark_base = 12.00
    random.seed(20260402)
    prev_value = base_value
    prev_benchmark = benchmark_base
    for i, d in enumerate(days):
        doy = d.timetuple().tm_yday
        seasonal = 0.00025 * math.sin(2 * math.pi * doy / 252)
        trend = 0.0001 * i
        ret = seasonal + trend + gaussian_random(0, 0.020)
        bm_ret = seasonal * 0.4 + trend * 0.5 + gaussian_random(0, 0.014)
        new_value = prev_value * (1 + ret)
        new_benchmark = prev_benchmark * (1 + bm_ret)
        change_pct = round((new_value - prev_value) / prev_value * 100, 4)
        records.append({
            'index_id': 'nasdaq_high_beta',
            'date': d.strftime('%Y-%m-%d'),
            'value': round(new_value, 6),
            'change_percent': change_pct,
            'benchmark_value': round(new_benchmark, 6),
        })
        prev_value = new_value
        prev_benchmark = new_benchmark
    return records



def generate_taiwan_constituents(date_str, num=50):
    random.seed(hash(date_str) % 2**32)
    base_weights = []
    for i, (code, name) in enumerate(TW_STOCKS[:num]):
        beta_factor = 1.0 + random.random() * 0.5
        base_weights.append((code, name, beta_factor))
    total = sum(w for _, _, w in base_weights)
    weights = [(c, n, w / total * 100) for c, n, w in base_weights]
    capped = []
    excess = 0.0
    for c, n, w in weights:
        if w > 30.0:
            excess += w - 30.0
            capped.append((c, n, 30.0))
        else:
            capped.append((c, n, w))
    if excess > 0:
        non_capped = [(i, c, n, w) for i, (c, n, w) in enumerate(capped) if w < 30.0]
        if non_capped:
            add_per = excess / len(non_capped)
            for i, c, n, w in non_capped:
                new_w = min(w + add_per, 30.0)
                capped[i] = (c, n, new_w)
    total = sum(w for _, _, w in capped)
    if total > 0:
        capped = [(c, n, round(w / total * 100, 4)) for c, n, w in capped]
    semi_weight = sum(w for c, _, w in capped if c in TW_SEMI_CODES)
    if semi_weight > 60.0:
        scale = 60.0 / semi_weight
        capped = [(c, n, round(w * scale, 4) if c in TW_SEMI_CODES else w) for c, n, w in capped]
        total = sum(w for _, _, w in capped)
        capped = [(c, n, round(w / total * 100, 4)) for c, n, w in capped]
    records = []
    for c, n, w in capped:
        records.append({
            'index_id': 'taiwan_high_beta',
            'symbol': c,
            'name': n,
            'weight': w,
            'date': date_str,
        })
    return records


def generate_nasdaq_constituents(date_str, num=30):
    random.seed(hash(date_str + 'nq') % 2**32)
    base_weights = []
    for i, (code, name) in enumerate(NQ_STOCKS[:num]):
        beta_factor = 1.0 + random.random() * 0.8
        base_weights.append((code, name, beta_factor))
    total = sum(w for _, _, w in base_weights)
    weights = [(c, n, w / total * 100) for c, n, w in base_weights]
    capped = []
    excess = 0.0
    for c, n, w in weights:
        if w > 10.0:
            excess += w - 10.0
            capped.append((c, n, 10.0))
        else:
            capped.append((c, n, w))
    if excess > 0:
        non_capped = [(i, c, n, w) for i, (c, n, w) in enumerate(capped) if w < 10.0]
        if non_capped:
            add_per = excess / len(non_capped)
            for i, c, n, w in non_capped:
                new_w = min(w + add_per, 10.0)
                capped[i] = (c, n, new_w)
    total = sum(w for _, _, w in capped)
    if total > 0:
        capped = [(c, n, round(w / total * 100, 4)) for c, n, w in capped]
    records = []
    for c, n, w in capped:
        records.append({
            'index_id': 'nasdaq_high_beta',
            'symbol': c,
            'name': n,
            'weight': w,
            'date': date_str,
        })
    return records


def upsert_to_supabase(table, records, batch_size=500, conflict_cols=None):
    import urllib.request
    import urllib.error

    # 建立 on_conflict 查詢參數
    conflict_param = ''
    if conflict_cols:
        conflict_param = '?on_conflict=' + ','.join(conflict_cols)

    url = f'{SUPABASE_URL}/rest/v1/{table}{conflict_param}'
    headers = {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
    }
    total = len(records)
    uploaded = 0
    for i in range(0, total, batch_size):
        batch = records[i:i + batch_size]
        body = json.dumps(batch).encode('utf-8')
        req = urllib.request.Request(url, data=body, headers=headers, method='POST')
        try:
            with urllib.request.urlopen(req) as resp:
                status = resp.status
                uploaded += len(batch)
                print(f'  Uploading {table} batch {i}~{i+len(batch)}: HTTP {status}')
        except urllib.error.HTTPError as e:
            print(f'  [ERROR] Uploading {table} batch {i}~{i+len(batch)}: HTTP {e.code}')
            print(f'  Response: {e.read().decode("utf-8", errors="replace")}')
        except Exception as e:
            print(f'  [ERROR] Uploading {table}: {e}')
    return uploaded


def delete_existing_data(table, index_ids, start_date, end_date):
    import urllib.request
    import urllib.error
    for index_id in index_ids:
        filters = f'index_id=eq.{index_id}&date=gte.{start_date}&date=lte.{end_date}'
        url = f'{SUPABASE_URL}/rest/v1/{table}?{filters}'
        headers = {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
            'Prefer': 'return=minimal',
        }
        req = urllib.request.Request(url, headers=headers, method='DELETE')
        try:
            with urllib.request.urlopen(req) as resp:
                print(f'  Deleted {table} {index_id} {start_date}~{end_date}: HTTP {resp.status}')
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='replace')
            if e.code == 404:
                print(f'  Delete {table} {index_id}: no existing data (404)')
            else:
                print(f'  [WARN] Delete {table} {index_id}: HTTP {e.code} - {body}')
        except Exception as e:
            print(f'  [WARN] Delete {table} {index_id}: {e}')


def main():
    print('=' * 60)
    print('Generating simulated data for Taiwan & Nasdaq High Beta indices')
    print('Date range: 2026-04-01 ~ 2026-09-30 (Q2 + Q3)')
    print('=' * 60)
    start_date = '2026-04-01'
    end_date = '2026-09-30'
    print('\n[1/4] Generating Taiwan High Beta performance...')
    tw_perf = generate_taiwan_high_beta_performance(start_date, end_date)
    print(f'  Generated {len(tw_perf)} records')
    print('[2/4] Generating Nasdaq High Beta performance...')
    nq_perf = generate_nasdaq_high_beta_performance(start_date, end_date)
    print(f'  Generated {len(nq_perf)} records')
    print('[3/4] Generating constituents...')
    tw_rebalance_dates = ['2026-04-01', '2026-07-01']
    nq_rebalance_dates = ['2026-03-31', '2026-06-30', '2026-09-30']
    tw_const = []
    for date_str in tw_rebalance_dates:
        tw_const.extend(generate_taiwan_constituents(date_str))
    print(f'  TW constituents: {len(tw_const)} records')
    nq_const = []
    for date_str in nq_rebalance_dates:
        nq_const.extend(generate_nasdaq_constituents(date_str))
    print(f'  NQ constituents: {len(nq_const)} records')
    print('[4/4] Saving JSON backups...')
    with open(os.path.join(OUTPUT_DIR, 'tw_performance.json'), 'w', encoding='utf-8') as f:
        json.dump(tw_perf, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUTPUT_DIR, 'nq_performance.json'), 'w', encoding='utf-8') as f:
        json.dump(nq_perf, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUTPUT_DIR, 'tw_constituents.json'), 'w', encoding='utf-8') as f:
        json.dump(tw_const, f, ensure_ascii=False, indent=2)
    with open(os.path.join(OUTPUT_DIR, 'nq_constituents.json'), 'w', encoding='utf-8') as f:
        json.dump(nq_const, f, ensure_ascii=False, indent=2)
    print(f'  Saved to {OUTPUT_DIR}')
    print('\n--- Uploading to Supabase ---')
    print('\nDeleting old data...')
    delete_existing_data('index_performance', ['taiwan_high_beta', 'nasdaq_high_beta'], start_date, end_date)
    delete_existing_data('index_constituents', ['taiwan_high_beta', 'nasdaq_high_beta'], start_date, end_date)
    print('\nUploading performance data...')
    all_perf = tw_perf + nq_perf
    upsert_to_supabase('index_performance', all_perf, conflict_cols=['index_id', 'date'])
    print('\nUploading constituents data...')
    all_const = tw_const + nq_const
    upsert_to_supabase('index_constituents', all_const, conflict_cols=['index_id', 'symbol', 'date'])
    print('\n' + '=' * 60)
    print('DONE!')
    print(f'  TW performance: {len(tw_perf)} records')
    print(f'  NQ performance: {len(nq_perf)} records')
    print(f'  TW constituents: {len(tw_const)} records')
    print(f'  NQ constituents: {len(nq_const)} records')
    print('=' * 60)


if __name__ == '__main__':
    main()

