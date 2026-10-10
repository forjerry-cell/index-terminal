#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
將 public/taiwan_momentum_30.json 的現有數據遷移至 Supabase
注意：執行前請先在 Supabase SQL Editor 執行 sql/add_taiwan_momentum_index.sql
"""

import os
import sys
import json
import requests
from datetime import datetime

URL = "https://nnoazshcucwjlccjqtkl.supabase.co"
# 使用 anon key（已驗證可寫入 index_performance / index_constituents）
KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDgzNzYsImV4cCI6MjA5MjI4NDM3Nn0.FE-onwhqZNBWWdUBoqD1lR-n5So9PbQ9BvjB9pWCz6g"


def upload_batch(table, data_list, on_conflict):
    if not data_list:
        return
    headers = {
        "apikey": KEY,
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates"
    }
    endpoint = f"{URL}/rest/v1/{table}?on_conflict={on_conflict}"
    batch_size = 200
    for i in range(0, len(data_list), batch_size):
        batch = data_list[i:i + batch_size]
        res = requests.post(endpoint, headers=headers, json=batch)
        if res.status_code in [200, 201, 204]:
            print(f"  OK: {len(batch)} rows -> {table}")
        else:
            print(f"  FAIL: {res.status_code} {res.text[:300]}")


def main():
    print("NOTE: Ensure 'taiwan_momentum_30' exists in indices table first!")
    print("Run sql/add_taiwan_momentum_index.sql in Supabase SQL Editor if needed.\n")

    json_path = os.path.join(os.path.dirname(__file__), "..", "public", "taiwan_momentum_30.json")
    if not os.path.exists(json_path):
        print(f"ERROR: {json_path} not found")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    perf = data.get("performance", [])
    constituents = data.get("constituents", [])
    rebalance_history = data.get("rebalance_history", [])
    print(f"Loaded: performance={len(perf)}, constituents={len(constituents)}, history={len(rebalance_history)}")

    # 轉換績效數據
    print("\nMigrating performance...")
    perf_rows = []
    for row in perf:
        perf_rows.append({
            "index_id": "taiwan_momentum_30",
            "date": row["date"],
            "value": row["value"],
            "change_percent": row.get("change_percent", 0),
            "benchmark_value": row.get("benchmark_value"),
        })
    upload_batch("index_performance", perf_rows, "index_id,date")

    # 轉換成分股
    print("\nMigrating constituents...")
    const_rows = []
    today = datetime.now().strftime("%Y-%m-%d")
    for c in constituents:
        const_rows.append({
            "index_id": "taiwan_momentum_30",
            "symbol": str(c["symbol"]).strip(),
            "name": c.get("name", str(c["symbol"]).strip()),
            "weight": c.get("weight", 0),
            "date": c.get("date", today),
        })
    upload_batch("index_constituents", const_rows, "index_id,symbol,date")

    # 轉換換股歷史
    if rebalance_history:
        print("\nMigrating rebalance_history...")
        hist_rows = []
        for h in rebalance_history:
            hist_rows.append({
                "index_id": "taiwan_momentum_30",
                "term": h.get("term", ""),
                "effective_date": h.get("effective_date", today),
                "retained_count": h.get("retained_count", 0),
                "added_stocks": h.get("added_stocks", []),
                "removed_stocks": h.get("removed_stocks", []),
            })
        upload_batch("rebalance_history", hist_rows, "index_id,term")

    print("\nMigration complete!")


if __name__ == "__main__":
    main()


