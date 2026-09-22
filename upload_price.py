import datetime
import os
import time
import pytz
import requests

# ==========================================
# 1. 在這裡設定你的 txt 檔案路徑與網站 API
# ==========================================
# 請確保這裡的路徑與 MultiCharts PowerLanguage 寫出的路徑一模一樣
TX_FILE_PATH = r"C:\FuturesData\tx_price.txt"  # 台指期 txt 路徑
SGX_FILE_PATH = r"C:\FuturesData\sgx_price.txt"  # 富時台指 txt 路徑

# 你的網站 API 網址與自訂安全金鑰
WEBSITE_API_URL = "WEBSITE_API_URL = "https://index-terminal.vercel.app/api/update-futures"   # 換成你的網站 API 網址
API_SECRET_KEY = "my_custom_secret_key_123"  # 需與網站 .env 設定的 KEY 一致


def get_session_status():
    """自動判斷台灣時間日夜盤"""
    tz = pytz.timezone("Asia/Taipei")
    now = datetime.datetime.now(tz)
    current_time = now.time()

    t_day_start = datetime.time(8, 45)
    t_day_end = datetime.time(13, 45)
    t_night_start = datetime.time(15, 0)
    t_night_end = datetime.time(5, 0)

    if t_day_start <= current_time <= t_day_end:
        return "日盤"
    elif current_time >= t_night_start or current_time < t_night_end:
        return "夜盤"
    else:
        return "休市"


def read_price(file_path):
    """讀取本機 txt 檔案內的第一個數字"""
    if not os.path.exists(file_path):
        return None
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read().strip()
            if content:
                price = content.split(",")[0]
                return float(price)
    except Exception as e:
        print(f"讀取檔案 [{file_path}] 失敗: {e}")
    return None


def main():
    print("=== MultiCharts 報價自動上傳服務已啟動 ===")
    print(f"台指期路徑: {TX_FILE_PATH}")
    print(f"富時台指路徑: {SGX_FILE_PATH}")

    while True:
        tx_price = read_price(TX_FILE_PATH)
        sgx_price = read_price(SGX_FILE_PATH)
        session = get_session_status()

        if tx_price is not None or sgx_price is not None:
            payload = {
                "secret": API_SECRET_KEY,
                "session": session,
                "tx_price": tx_price,
                "sgx_price": sgx_price,
                "updated_at": datetime.datetime.now().strftime(
                    "%Y-%m-%d %H:%M:%S"
                ),
            }
            try:
                res = requests.post(WEBSITE_API_URL, json=payload, timeout=5)
                if res.status_code == 200:
                    print(
                        f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 成功同步至網站 -> 台指: {tx_price} ({session}) | 富時: {sgx_price}"
                    )
                else:
                    print(
                        f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 上傳失敗，網站回應狀態碼: {res.status_code}"
                    )
            except Exception as e:
                print(
                    f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 無法連線至網站: {e}"
                )
        else:
            print(
                f"[{datetime.datetime.now().strftime('%H:%M:%S')}] 尚未在指定路徑讀取到 txt 報價數字，請確認 MC 是否已匯出檔案。"
            )

        # 每 5 分鐘 (300 秒) 自動執行一次
        time.sleep(300)


if __name__ == "__main__":
    main()