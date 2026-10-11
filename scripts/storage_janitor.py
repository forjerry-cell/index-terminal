#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
storage_janitor.py — 清理 Supabase Storage bucket 中「超過保留期限」的舊檔案。

功能：
  1. 遞迴列出指定 bucket（可限定資料夾前綴）中的所有檔案。
  2. 依 created_at / updated_at / last_accessed_at 其中之一判斷檔案年齡。
  3. 將超過保留期限（--days N 天）的檔案刪除。

安全設計（重要）：
  * 預設為 dry-run：只列出「將會被刪除」的檔案，不會實際刪除。
  * 必須加上 --apply 才會真正呼叫刪除 API。
  * 批次刪除每批最多 1000 個物件（Supabase remove 上限）。

用法範例：
  # 預覽（dry-run，預設行為，不會刪除）
  python scripts/storage_janitor.py --bucket avatars --days 30

  # 實際刪除 30 天前的檔案
  python scripts/storage_janitor.py --bucket avatars --days 30 --apply

  # 只清理某子資料夾、以更新時間為準、保留 90 天
  python scripts/storage_janitor.py --bucket charts --prefix reports/2025 --days 90 --by updated_at --apply

環境變數（亦可由 ../.env 載入）：
  NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY   （必填，Storage 刪除需要 service role 權限）
  STORAGE_BUCKET               （等同 --bucket，CLI 優先）
  STORAGE_RETENTION_DAYS       （等同 --days，預設 30）
  STORAGE_PREFIX               （等同 --prefix，預設根目錄）
"""

import os
import sys
import argparse
from datetime import datetime, timezone, timedelta

import requests

DEFAULT_URL = "https://nnoazshcucwjlccjqtkl.supabase.co"
LIST_PAGE = 100          # Supabase list 每頁上限建議 100
DELETE_BATCH = 1000      # Supabase remove 單批上限 1000
PREVIEW_CAP = 50         # dry-run 時最多印出幾筆範例


def load_url() -> str:
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or os.environ.get("SUPABASE_URL") or DEFAULT_URL
    return url.rstrip("/")


def load_key() -> str:
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not key:
        env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                        key = line.split("=", 1)[1].strip().strip('"').strip("'")
                        break
    return key


def make_headers(key: str) -> dict:
    return {"apikey": key, "Authorization": f"Bearer {key}"}


def join_prefix(prefix: str, name: str) -> str:
    return f"{prefix}/{name}" if prefix else name


def list_one_level(url: str, headers: dict, bucket: str, prefix: str) -> list:
    """分頁列出單一層級的項目（檔案與資料夾）。"""
    items = []
    offset = 0
    while True:
        body = {
            "limit": LIST_PAGE,
            "offset": offset,
            "prefix": prefix,
            "sortBy": {"column": "name", "order": "asc"},
        }
        r = requests.post(
            f"{url}/storage/v1/object/list/{bucket}",
            headers=headers,
            json=body,
            timeout=30,
        )
        if r.status_code != 200:
            raise RuntimeError(f"list 失敗 (prefix={prefix!r}) HTTP {r.status_code}: {r.text[:200]}")
        batch = r.json()
        if not isinstance(batch, list) or not batch:
            break
        items.extend(batch)
        if len(batch) < LIST_PAGE:
            break
        offset += LIST_PAGE
    return items


def walk_files(url: str, headers: dict, bucket: str, prefix: str, out: list) -> None:
    """遞迴走訪所有檔案；資料夾以 id 為 null 辨識並向下遞迴。"""
    for item in list_one_level(url, headers, bucket, prefix):
        name = item.get("name")
        if not name:
            continue
        full = join_prefix(prefix, name)
        if item.get("id") is None:
            walk_files(url, headers, bucket, full, out)  # 資料夾 → 遞迴
        else:
            item["_fullpath"] = full
            out.append(item)


def parse_ts(value) -> datetime:
    """穩健解析 ISO 8601 時間字串，統一轉為 UTC aware datetime。"""
    if not value or not isinstance(value, str):
        return None
    s = value.strip()
    if s.endswith("Z"):
        s = s[:-1] + "+00:00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="清理 Supabase Storage bucket 中超過保留期限的舊檔案（預設 dry-run）。"
    )
    parser.add_argument("--bucket", default=os.environ.get("STORAGE_BUCKET", ""),
                        help="目標 bucket 名稱（或環境變數 STORAGE_BUCKET）")
    parser.add_argument("--days", type=int,
                        default=int(os.environ.get("STORAGE_RETENTION_DAYS", "30")),
                        help="保留期限天數，超過即刪除（預設 30，或環境變數 STORAGE_RETENTION_DAYS）")
    parser.add_argument("--prefix", default=os.environ.get("STORAGE_PREFIX", ""),
                        help="限定清理的資料夾前綴，空白代表整個 bucket（或環境變數 STORAGE_PREFIX）")
    parser.add_argument("--by", choices=["created_at", "updated_at", "last_accessed_at"],
                        default="created_at",
                        help="以哪個時間欄位判斷年齡（預設 created_at）")
    parser.add_argument("--apply", action="store_true",
                        help="實際執行刪除；未加上則僅為 dry-run 預覽")
    args = parser.parse_args()

    if not args.bucket:
        print("[ERROR] 必須提供 --bucket（或環境變數 STORAGE_BUCKET）")
        return 1
    if args.days < 0:
        print("[ERROR] --days 不可為負數")
        return 1

    url = load_url()
    key = load_key()
    if not key:
        print("[ERROR] 需要 SUPABASE_SERVICE_ROLE_KEY（環境變數或 ../.env）")
        return 1
    headers = make_headers(key)

    prefix = args.prefix.strip().strip("/")
    cutoff = datetime.now(timezone.utc) - timedelta(days=args.days)
    mode = "APPLY（將實際刪除）" if args.apply else "DRY-RUN（僅預覽，不會刪除）"

    print("=" * 60)
    print("Supabase Storage Janitor")
    print(f"  URL      : {url}")
    print(f"  Bucket   : {args.bucket}")
    print(f"  Prefix   : {prefix or '(根目錄)'}")
    print(f"  保留期限 : {args.days} 天（截止時間 {cutoff.isoformat()}，UTC）")
    print(f"  判斷欄位 : {args.by}")
    print(f"  模式     : {mode}")
    print("=" * 60)

    # 1) 遞迴收集所有檔案
    try:
        files = []
        walk_files(url, headers, args.bucket, prefix, files)
    except (requests.RequestException, RuntimeError) as e:
        print(f"[ERROR] 列出檔案時發生錯誤: {e}")
        return 1

    print(f"[INFO] 掃描完成：共 {len(files)} 個檔案")

    # 2) 依時間欄位挑出超過期限者
    old, skipped = [], 0
    size_by_path = {}
    for f in files:
        md = f.get("metadata") or {}
        if isinstance(md.get("size"), (int, float)):
            size_by_path[f["_fullpath"]] = int(md["size"])
        ts = parse_ts(f.get(args.by))
        if ts is None:
            skipped += 1
            continue
        if ts < cutoff:
            old.append((f["_fullpath"], ts))

    if skipped:
        print(f"[WARN] {skipped} 個檔案缺少可用的 {args.by} 時間，已略過（不刪除）")

    total_bytes = sum(size_by_path.get(p, 0) for p, _ in old)
    print(f"[INFO] 符合刪除條件（早於 {cutoff.date()}）：{len(old)} 個檔案，"
          f"合計約 {total_bytes / 1024:.1f} KB")

    if not old:
        print("[DONE] 沒有需要清理的檔案。")
        return 0

    old.sort(key=lambda x: x[1])
    for fpath, ts in old[:PREVIEW_CAP]:
        print(f"  - {fpath}  ({args.by}={ts.isoformat()})")
    if len(old) > PREVIEW_CAP:
        print(f"  ... 另外 {len(old) - PREVIEW_CAP} 個（略）")

    # 3) dry-run 或實際刪除
    if not args.apply:
        print("=" * 60)
        print("[DRY-RUN] 以上為將被刪除的檔案預覽。確認無誤後加上 --apply 執行實際刪除。")
        return 0

    print("=" * 60)
    print(f"[APPLY] 開始刪除 {len(old)} 個檔案 ...")
    prefixes = [p for p, _ in old]
    deleted, failed = 0, 0
    for i in range(0, len(prefixes), DELETE_BATCH):
        chunk = prefixes[i:i + DELETE_BATCH]
        try:
            code, text = delete_batch(url, headers, args.bucket, chunk)
        except requests.RequestException as e:
            print(f"[ERROR] 批次刪除失敗（第 {i} 筆起）: {e}")
            failed += len(chunk)
            continue
        if code in (200, 204):
            deleted += len(chunk)
            print(f"  [OK] 批次 {i // DELETE_BATCH + 1}: 已刪除 {len(chunk)} 個 (HTTP {code})")
        else:
            failed += len(chunk)
            print(f"  [FAIL] 批次 {i // DELETE_BATCH + 1}: HTTP {code} {text}")

    print("=" * 60)
    print(f"[DONE] 刪除完成：成功 {deleted} 個，失敗 {failed} 個。")
    return 0 if failed == 0 else 2


if __name__ == "__main__":
    sys.exit(main())



def delete_batch(url: str, headers: dict, bucket: str, prefixes: list) -> tuple:
    """刪除一批物件，回傳 (HTTP 狀態碼, 回應文字)。"""
    r = requests.delete(
        f"{url}/storage/v1/object/{bucket}",
        headers=headers,
        json={"prefixes": prefixes},
        timeout=60,
    )
    return r.status_code, r.text[:200]
