# 🚀 高 Beta 指數平台佈署指南

恭喜！您的專案代碼已準備就緒。請依照下列步驟將網站正式上線。

## 1. 推送到 GitHub
在您的 `D:\Downloads\Antigravity\IndexWebsite` 目錄執行：

```powershell
git init
git remote add origin https://github.com/forjerry-cell/index-terminal.git
git add .
git commit -m "feat: Initial release of Index Terminal"
git branch -M main
git push -u origin main
```

## 2. 佈署到 Vercel
1. 登入 [Vercel](https://vercel.com/) (帳號: `forjerry-4353`)。
2. 點擊 **"Add New"** > **"Project"**。
3. 匯入剛剛建立的 `index-terminal` 儲存庫。
4. 在 **Environment Variables** 區塊，將 `.env` 檔案中的內容填入。
5. 點擊 **"Deploy"**。

## 3. 設定每日自動化郵件 (GitHub Actions)
在 GitHub 儲存庫中建立 `.github/workflows/daily_report.yml`：

```yaml
name: Daily Report Dispatch
on:
  schedule:
    - cron: '0 9 * * *' # 台灣時間 17:00
jobs:
  ping_api:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Email API
        run: |
          curl -X POST https://your-site.vercel.app/api/send-report \
          -H "Content-Type: application/json" \
          -d "{\"secret\": \"sb_secret_9n\"}"
```
