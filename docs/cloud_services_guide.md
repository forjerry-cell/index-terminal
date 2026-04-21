# 雲端平台服務註冊與金鑰獲取教學

本指南將引導您完成四個免費平台的註冊。這些平台共同支撐起您的「自動化指數發佈系統」。

---

## 1. 第一站：GitHub (您的代碼倉庫)
**用途：** 存放網站程式碼，並在每天收盤後自動啟動計算。

1.  前往 [GitHub Signup](https://github.com/signup)。
2.  輸入您的 Email 並設定密碼、帳號名稱。
3.  **註冊完畢後**，請告訴我您的 **GitHub 帳號名稱 (Username)**。
4.  **獲取資訊：** 您只需要記得帳號密碼即可。

---

## 2. 第二站：Vercel (您的網站管家)
**用途：** 讓您的網站能被全世界看到。

1.  前往 [Vercel Signup](https://vercel.com/signup)。
2.  點擊 **"Continue with GitHub"**，這會直接連動您的 GitHub 帳號。
3.  授權通過後即完成註冊（選擇 "Hobby" 個人方案）。
4.  **獲取資訊：** 無需額外獲取金鑰，但我之後會教您如何將它與 GitHub Repository 連結。

---

## 3. 第三站：Supabase (您的數據庫與圖床)
**用途：** 儲存股市數據、指數圖片、會員帳號資料。

1.  前往 [Supabase Dashboard](https://supabase.com/dashboard/sign-up)。
2.  點擊 **"Continue with GitHub"** 快速註冊。
3.  點擊 **"New Project"**。
    *   **Name**: 隨便取名（例如 `high-beta-index`）。
    *   **Database Password**: **請務必記住這組密碼**（最好寫下來）。
    *   **Region**: 選擇離您最近的（例如 `Northeast Asia (Tokyo)` 或 `Southeast Asia (Singapore)`）。
4.  **獲取關鍵資訊 (Secrets)：**
    *   點擊左側齒輪選單 `Project Settings` -> `API`。
    *   在頁面中尋找這兩個欄位並複製下來：
        *   **Project URL**: (網址格式)
        *   **anon public**: (這是一長串金鑰)
        *   **service_role secret**: (這是一長串「不可外流」的金鑰，點擊 Reveal 才能看到)

---

## 4. 第四站：Resend (您的專業郵差)
**用途：** 每天自動將指數日報寄到會員信箱。

1.  前往 [Resend Signup](https://resend.com/signup)。
2.  註冊並完成 Email 驗證。
3.  點擊左側選單的 **"API Keys"**。
4.  點擊 **"Create API Key"**。
    *   **Name**: 隨便取名（例如 `website-mailer`）。
    *   **Permission**: 選擇 `Full Access`。
5.  **獲取關鍵資訊 (Secrets)：**
    *   產出後的金鑰（以 `re_` 開頭）**請立刻複製並找地方存起來**，它只會出現這一次。

---

## 5. 您需要準備好的關鍵資料清單

當您完成以上註冊後，請彙整以下名稱給我（**不要直接貼金鑰內容，告訴我有拿到即可**）：

1. [ ] GitHub 帳號名稱
2. [ ] Supabase Project URL (網址)
3. [ ] 是否已取得 Supabase 的 `anon` 與 `service_role` 金鑰？
4. [ ] 是否已取得 Resend 的 `API Key`？

---

> [!CAUTION]
> **安全守則：** 所有的 API Key (金鑰) 就像是您保險箱的備份鑰匙。在我們後續建置程式碼時，我會教您將它們放在電腦的隱藏設定檔中，切記**絕對不要**把這些金鑰貼在公開的留言版或 GitHub 公開代碼中。
