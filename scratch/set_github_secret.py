#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
透過 GitHub REST API 與 PyNaCl 自動設定 GitHub Actions Secret
"""
import base64
import requests
import sys

# 安裝與載入 pynacl
try:
    from nacl import encoding, public
except ImportError:
    print("[INFO] 缺少 pynacl 套件，正在嘗試為您自動安裝...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pynacl"])
    from nacl import encoding, public

GITHUB_TOKEN = "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"
REPO = "forjerry-cell/index-terminal"
SECRET_NAME = "NEXT_PUBLIC_SUPABASE_ANON_KEY"
SECRET_VALUE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDgzNzYsImV4cCI6MjA5MjI4NDM3Nn0.FE-onwhqZNBWWdUBoqD1lR-n5So9PbQ9BvjB9pWCz6g"

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

def encrypt(public_key: str, secret_value: str) -> str:
    """使用 libsodium 加密 Secret"""
    public_key = public.PublicKey(public_key.encode("utf-8"), encoding.Base64Encoder())
    sealed_box = public.SealedBox(public_key)
    encrypted = sealed_box.encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")

def set_secret():
    # 1. 取得 Repository 的公鑰
    print("[INFO] 正在取得 GitHub Repository 公鑰...")
    url_key = f"https://api.github.com/repos/{REPO}/actions/secrets/public-key"
    r = requests.get(url_key, headers=HEADERS)
    if r.status_code != 200:
        print(f"[ERROR] 無法取得公鑰: {r.status_code} {r.text}")
        return False
        
    key_data = r.json()
    key_id = key_data["key_id"]
    public_key = key_data["key"]
    print(f"[OK] 成功取得公鑰! Key ID: {key_id}")
    
    # 2. 將 Secret 進行加密
    encrypted_value = encrypt(public_key, SECRET_VALUE)
    print("[OK] Secret 加密完成")
    
    # 3. 上傳 Secret 到 GitHub
    print(f"[INFO] 正在上傳 Secret '{SECRET_NAME}'...")
    url_secret = f"https://api.github.com/repos/{REPO}/actions/secrets/{SECRET_NAME}"
    payload = {
        "encrypted_value": encrypted_value,
        "key_id": key_id
    }
    r2 = requests.put(url_secret, headers=HEADERS, json=payload)
    if r2.status_code in [201, 204]:
        print(f"[SUCCESS] Secret '{SECRET_NAME}' 已完美設定到 GitHub 專案中！")
        return True
    else:
        print(f"[ERROR] 設定 Secret 失敗: {r2.status_code} {r2.text}")
        return False

if __name__ == "__main__":
    set_secret()
