import requests
import json

GITHUB_TOKEN = "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"
REPO = "forjerry-cell/index-terminal"

HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

# 取最近 5 次 daily_sync 工作流程跑的結果
r = requests.get(
    f"https://api.github.com/repos/{REPO}/actions/runs?workflow_id=daily_sync.yml&per_page=5",
    headers=HEADERS
)
if r.status_code == 200:
    runs = r.json().get("workflow_runs", [])
    print("=== 最近 5 次 daily_sync 執行記錄 ===")
    for run in runs:
        rn = run["run_number"]
        conclusion = run["conclusion"]
        status = run["status"]
        created = run["created_at"]
        event = run["event"]
        print(f"Run #{rn}: [{conclusion or status}] 觸發={event} 時間={created}")
else:
    print("無法查詢:", r.status_code)

# 也查一下 daily_sync 的失敗原因（以最後一次 failure 為目標）
print("\n=== 搜尋最後一次失敗的 daily_sync 工作流程 ===")
r2 = requests.get(
    f"https://api.github.com/repos/{REPO}/actions/runs?workflow_id=daily_sync.yml&per_page=10",
    headers=HEADERS
)
if r2.status_code == 200:
    failed_runs = [r for r in r2.json().get("workflow_runs", []) if r["conclusion"] == "failure"]
    if failed_runs:
        fr = failed_runs[0]
        run_id = fr["id"]
        print(f"最後失敗: Run #{fr['run_number']} 時間={fr['created_at']}")
        
        r3 = requests.get(
            f"https://api.github.com/repos/{REPO}/actions/runs/{run_id}/jobs",
            headers=HEADERS
        )
        if r3.status_code == 200:
            jobs = r3.json().get("jobs", [])
            for job in jobs:
                print(f"\nJob: {job['name']} 結果={job['conclusion']}")
                for step in job.get("steps", []):
                    if step.get("conclusion") == "failure":
                        print(f"  失敗步驟: {step['name']}")
                        # 撈日誌
                        r4 = requests.get(
                            f"https://api.github.com/repos/{REPO}/actions/jobs/{job['id']}/logs",
                            headers=HEADERS
                        )
                        if r4.status_code == 200:
                            lines = r4.text.split("\n")
                            for ln in lines[-50:]:
                                safe = ln.encode("ascii", errors="replace").decode("ascii")
                                print(safe)
    else:
        print("近 10 次均執行成功！")
