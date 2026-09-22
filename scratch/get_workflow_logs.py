import requests
import json
import time

GITHUB_TOKEN = "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"
REPO = "forjerry-cell/index-terminal"
WORKFLOW_FILE = "daily_sync.yml"

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

def get_logs():
    r = requests.get(
        f"https://api.github.com/repos/{REPO}/actions/runs?workflow_id={WORKFLOW_FILE}&per_page=3",
        headers=HEADERS
    )
    if r.status_code != 200:
        print(f"無法取得 Runs 列表: {r.status_code} {r.text}")
        return
        
    runs = r.json().get("workflow_runs", [])
    if not runs:
        print("沒有找到任何運行紀錄")
        return
        
    latest_run = runs[0]
    run_id = latest_run["id"]
    run_num = latest_run["run_number"]
    status = latest_run["status"]
    conclusion = latest_run["conclusion"]
    
    print(f"最新運行記錄: Run #{run_num} (ID: {run_id}) | 狀態: {status} | 結果: {conclusion}")
    
    r2 = requests.get(
        f"https://api.github.com/repos/{REPO}/actions/runs/{run_id}/jobs",
        headers=HEADERS
    )
    if r2.status_code != 200:
        print(f"無法取得 Jobs: {r2.status_code} {r2.text}")
        return
        
    jobs = r2.json().get("jobs", [])
    for job in jobs:
        print(f"\nJob: {job['name']} | 狀態: {job['status']} | 結果: {job['conclusion']}")
        print("步驟詳情:")
        for step in job.get("steps", []):
            symbol = "OK" if step["conclusion"] == "success" else ("ERR" if step["conclusion"] == "failure" else "...")
            print(f"  [{symbol}] {step['name']}: {step['status']} | {step['conclusion']}")
            
        if job['conclusion'] == 'failure':
            print(f"\n--- 撈取 Job '{job['name']}' 的詳細日誌 ---")
            r3 = requests.get(
                f"https://api.github.com/repos/{REPO}/actions/jobs/{job['id']}/logs",
                headers=HEADERS
            )
            if r3.status_code == 200:
                lines = r3.text.split('\n')
                # 印出最後 80 行
                print("\n".join(lines[-80:]))
            else:
                print(f"無法取得日誌: {r3.status_code}")

if __name__ == "__main__":
    get_logs()
