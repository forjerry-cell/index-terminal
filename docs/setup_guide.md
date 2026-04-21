# 環境建置指南：高 Beta 指數平台

為了讓網站能夠自動運行並提供會員服務，我們需要使用以下四個核心平台。請按照順序協助我完成註冊，完成後請告訴我，我將協助您進行串接。

---

## 1. 核心雲端服務清單

| 平台 | 用途 | 註冊連結 | 狀態 |
| :--- | :--- | :--- | :--- |
| **GitHub** | 代碼託管與「自動化大腦」(Actions) | [點我註冊](https://github.com/signup) | [ ] 未完成 |
| **Vercel** | 網站伺服器與前端託管 | [點我註冊](https://vercel.com/signup) | [ ] 未完成 |
| **Supabase** | 資料庫、會員系統與圖片雲端空間 | [點我註冊](https://supabase.com/dashboard/sign-up) | [ ] 未完成 |
| **Resend** | 自動寄送每日報表郵件 API | [點我註冊](https://resend.com/signup) | [ ] 未完成 |

---

## 2. 註冊後需要獲取的關鍵資訊 (Secrets)

註冊完畢後，請**暫時不要關閉網頁**，我們需要以下資訊來設定自動化系統（我會引導您在哪裡找到它們）：

1.  **Supabase**:
    *   `Project URL` (專案網址)
    *   `Anon Key` (前端訪問金鑰)
    *   `Service Role Key` (後端資料寫入金鑰 - **最重要，請務必保密**)
2.  **Resend**:
    *   `API Key` (郵件發送特使金鑰)

---

## 3. 本地專案初始化預告

當您回報帳號準備就緒後，我將在您的電腦中執行以下動作：
1.  使用 `npx create-next-app` 初始化網站代碼。
2.  建立 `scripts/` 資料夾，將您原本的 Python 回測程式轉化為「雲端同步版」。
3.  建立 `.github/workflows/` 資料夾，設定每天台美股收盤後的自動排程。

---

> [!IMPORTANT]
> **安全提醒**：請務必不要直接在對話中貼出您的「Service Role Key」或「Resend API Key」。我會引導您將它們安全地貼在 `.env` 檔案中，這樣既能讓程式讀取，又不會外洩。

> [!TIP]
> 建議您可以先註冊 GitHub 與 Vercel，因為這兩者通常是一鍵連動的，最為快速。
