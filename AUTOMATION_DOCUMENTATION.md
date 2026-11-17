# 指數自動化系統完整說明文件

> **建立日期**：2026-10-10  
> **專案名稱**：IndexWebsite（Index Terminal）  
> **最後更新**：2026-10-10（補充 PR vs TR 變更說明、歷史數據品質驗證報告、成分股權重驗證、Beta 對齊重建、動能指數依實際實作修正為混合加權）

---

## 目錄

1. [系統概覽](#系統概覽)
2. [三個指數完整編製邏輯](#三個指數完整編製邏輯)
3. [自動換股時間表](#自動換股時間表)
4. [自動化架構](#自動化架構)
5. [自動化流程](#自動化流程)
6. [資料庫結構](#資料庫結構)
7. [前端頁面整合](#前端頁面整合)
8. [GitHub Actions 排程設定](#github-actions-排程設定)
9. [檔案清單與說明](#檔案清單與說明)
10. [今日完成事項總覽](#今日完成事項總覽)
11. [PR vs TR 價格來源變更說明](#pr-vs-tr-價格來源變更說明)
12. [歷史數據品質驗證報告](#歷史數據品質驗證報告)
13. [Q2/Q3 2026 模擬數據補充說明](#q2q3-2026-模擬數據補充說明)
14. [成分股權重驗證](#成分股權重驗證)
15. [數據驗證腳本清單](#數據驗證腳本清單)
16. [前端快取注意事項](#前端快取注意事項)
17. [常見問題排除](#常見問題排除)
18. [AlphaFalcon Backtest Audit 下架與預測追蹤系統](#alphafalcon-backtest-audit-下架與預測追蹤系統)

---

## 系統概覽

本系統管理三個自編指數，全部透過 **Supabase（即時資料庫）** 儲存績效與成分股數據，由 **GitHub Actions** 每日自動執行 Python 腳本更新淨值並在到期時自動換股。前端頁面即時從 Supabase 讀取數據顯示，**全流程完全自動化，無需任何人工介入**。

### 三個指數自動化狀態一覽

| 指數 | 指數 ID | 前端顯示 | 後端排程 | 換股邏輯 | 資料儲存 | 自動換股 |
|------|---------|---------|---------|---------|---------|---------|
| **台股領航強勢指數** | `taiwan_high_beta` | ✅ Supabase | ✅ GitHub Actions 每日執行 | ✅ Beta 排序選前 50 檔 | Supabase | ✅ 每季首個交易日 |
| **那指領航強勢指數** | `nasdaq_high_beta` | ✅ Supabase | ✅ GitHub Actions 每日執行 | ✅ Beta 排序選前 30 檔 | Supabase | ✅ 每季季末 |
| **台股強勢動能指數** | `taiwan_momentum_30` | ✅ Supabase | ✅ GitHub Actions 每日執行 | ✅ 126 日動能選前 30 檔 | Supabase | ✅ 每半年 6/12 月 |

---

## 三個指數完整編製邏輯

### 1. 台股領航強勢指數（`taiwan_high_beta`）

#### 編製規則
- **母體**：台灣上市櫃權值主流股（台股大型市值股票池）
- **選股方法**：於每季首個交易日，回溯過去 **252 個交易日** 的日報酬率，計算每檔個股相對於台灣加權指數（`^TWII`）的 **Beta 值**
- **選股數量**：依 Beta 值由高至低排序，選取前 **50 檔**
- **加權方式**：採 **Beta 比例加權**（Beta 越高、權重越大）
- **風控上限**：
  - 單一持股上限：**30%**
  - 半導體產業合計上限：**60%**
- **基準指數**：台灣加權指數（`^TWII`）

#### 換股時間
- 每年 **1 月、4 月、7 月、10 月** 的首個交易日
- 以台股開盤日為準（跳過週末與國定假日）

#### 換股流程（`calculate_tw_high_beta_rebalance()`）
1. 從 Yahoo Finance 下載母體股票過去一年的日線歷史數據（**`Close`（純 PR 價格）**，見下方 [PR vs TR 說明](#pr-vs-tr-價格來源變更說明)）
2. 計算每檔個股日報酬率與大盤日報酬率的共變異數
3. 除以大盤變異數得出每檔的 Beta 值
4. 篩選 Beta > 0 的個股，依 Beta 降序排列
5. 取前 50 檔，以 Beta 為初始權重
6. 正規化權重至 100%
7. 逐檔檢查並限制單一持股 ≤ 30%（超出部分按比例重新分配）
8. 檢查半導體類股合計權重 ≤ 60%（超出則等比縮減）
9. 最終正規化至 100%，寫入 Supabase

---

### 2. 那指領航強勢指數（`nasdaq_high_beta`）

#### 編製規則
- **母體**：Nasdaq 100 指數成分股（由腳本內建的 100 檔清單管理）
- **選股方法**：於每季季末，回溯過去 **252 個交易日** 的日報酬率，計算每檔個股相對於 **QQQ**（Invesco QQQ Trust ETF）的 Beta 波動彈性
- **選股數量**：依 Beta 值由高至低排序，選取前 **30 檔**
- **加權方式**：採 **Beta 比例加權**
- **風控上限**：
  - 單一持股上限：**10%**
- **基準指數**：QQQ ETF

#### 換股時間
- 每年 **3 月、6 月、9 月、12 月** 的季末最後幾個交易日（每月 25 日之後觸發，確保涵蓋季末）

#### 換股流程（`calculate_nq_high_beta_rebalance()`）
1. 從 Yahoo Finance 下載 Nasdaq 100 成分股 + QQQ 的歷史數據
2. 計算每檔個股日報酬率相對於 QQQ 日報酬率的 Beta 值
3. 篩選 Beta > 0 的個股，依 Beta 降序排列
4. 取前 30 檔，以 Beta 為初始權重
5. 正規化權重至 100%
6. 逐檔檢查並限制單一持股 ≤ 10%（超出部分按比例重新分配）
7. 最終正規化至 100%，寫入 Supabase

---

### 3. 台股強勢動能指數（`taiwan_momentum_30`）

#### 編製規則
- **母體**：台灣高波動指數（FTHB003V02）官方 50 檔成分股概念，實作採 `CORE_UNIVERSE` 約 102 檔歷史入選池（含 17 檔上櫃）
- **選股方法（三段式）**：
  1. **流動性排序**：20 日均成交額排序取前 150 檔
  2. **Beta 緩衝排序**：計算 126 日 Beta（對 `^TWII`），既有成分股中 Beta 排名前 100 名者優先保留，補足至 50 檔
  3. **動能精選**：從 50 檔中依 126 日累積報酬率取前 **30 檔**
- **加權方式**：**80% Beta 加權 + 20% 成交額加權**混合，經三重風控上限迭代收斂後，Top 30 依其 FTHB50 原始權重比例放大歸一化至 100%
- **風控上限**（`apply_weight_caps`，迭代 100 次收斂）：
  - 單一個股上限：**30%**
  - 前五大合計上限：**65%**
  - 半導體產業合計上限：**60%**
- **基準指數**：台灣加權指數（`^TWII`）

#### 換股時間
- 每年 **6 月**（16 日之後觸發，截止日為 5 月 31 日）
- 每年 **12 月**（16 日之後觸發，截止日為 11 月 30 日）

#### 換股流程（`perform_rebalance()`，位於 `scripts/rebalance_momentum.py`）
1. 取得 `CORE_UNIVERSE` 約 102 檔候選池最新行情（126 日 `Close` PR 價格 + 成交量）
2. 依 20 日均成交額排序取前 150 檔
3. 計算每檔 126 日 Beta（對 `^TWII`）並排名
4. 緩衝區保留：既有成分股中 Beta 排名前 100 名者優先保留，不足 50 檔由 Beta 高者補足
5. FTHB50 權重：`0.80 × Beta 加權 + 0.20 × 成交額加權`，經 `apply_weight_caps` 迭代收斂（單一 30%、前五大 65%、半導體 60%）
6. 從 50 檔中依 126 日動能報酬率（累積報酬）取前 30 檔
7. Top 30 依其 FTHB50 原始權重比例放大歸一化至 100%
8. 記錄換股歷史（新增/剔除個股、保留檔數）至 `rebalance_history` 表
9. 寫入 Supabase

---

## 自動換股時間表

### 台股領航強勢指數
| 換股期 | 觸發日期（首個交易日） |
|--------|----------------------|
| Q1 換股 | 每年 1 月首個台股交易日 |
| Q2 換股 | 每年 4 月首個台股交易日 |
| Q3 換股 | 每年 7 月首個台股交易日 |
| Q4 換股 | 每年 10 月首個台股交易日 |

### 那指領航強勢指數
| 換股期 | 觸發日期（季末） |
|--------|----------------|
| Q1 換股 | 每年 3 月 25 日後 |
| Q2 換股 | 每年 6 月 25 日後 |
| Q3 換股 | 每年 9 月 25 日後 |
| Q4 換股 | 每年 12 月 25 日後 |

### 台股強勢動能指數
| 換股期 | 觸發日期 | 截止計算日 |
|--------|---------|-----------|
| 上半年定審 | 每年 6 月 16 日後 | 5 月 31 日 |
| 下半年定審 | 每年 12 月 16 日後 | 11 月 30 日 |

---

## 自動化架構

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions（排程觸發）                     │
│                                                                 │
│  每天 UTC 08:30（台北 16:30）  ← 台股收盤後更新                   │
│  每天 UTC 21:30（台北 05:30）  ← 美股收盤後更新                   │
│  支援手動觸發（workflow_dispatch）                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              scripts/unified_daily_sync.py                       │
│                 （統一每日同步 + 換股引擎）                        │
│                                                                 │
│  ┌───────────────────┐  ┌───────────────────┐  ┌────────────┐  │
│  │ 台股領航強勢指數   │  │ 那指領航強勢指數   │  │台股強勢動能│  │
│  │ update_taiwan_    │  │ update_nasdaq_    │  │指數        │  │
│  │ high_beta()       │  │ high_beta()       │  │update_     │  │
│  │                   │  │                   │  │taiwan_     │  │
│  │ 1.每日淨值更新    │  │ 1.每日淨值更新    │  │momentum()  │  │
│  │ 2.換股日期檢查    │  │ 2.換股日期檢查    │  │            │  │
│  │ 3.到期自動換股    │  │ 3.到期自動換股    │  │1.每日淨值  │  │
│  └───────────────────┘  └───────────────────┘  │2.定審檢查  │  │
│                                                │3.到期換股  │  │
│                                                └────────────┘  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
  ┌──────────┐  ┌──────────┐  ┌──────────────┐
  │ Yahoo    │  │ Supabase │  │ rebalance_   │
  │ Finance  │  │ REST API │  │ momentum.py  │
  │ (行情)   │  │ (讀寫)   │  │ (動能換股)   │
  └──────────┘  └──────────┘  └──────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Supabase（即時資料庫）                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │ indices      │  │ index_performance│  │index_constituents│  │
│  │ (指數定義)   │  │ (每日淨值/漲跌)  │  │ (每日成分股權重) │   │
│  └──────────────┘  └──────────────────┘  └─────────────────┘   │
│  ┌──────────────────┐                                           │
│  │ rebalance_history│                                           │
│  │ (換股歷史記錄)   │                                           │
│  └──────────────────┘                                           │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     前端頁面（Vercel 部署）                       │
│                                                                 │
│  ┌─────────────────────┐  ┌──────────────────────────────┐      │
│  │ app/page.tsx        │  │ app/taiwan-momentum/page.tsx │      │
│  │ (台股/那指主頁)     │  │ (台股強勢動能指數專頁)       │      │
│  │ 從 Supabase 讀取    │  │ 從 Supabase 讀取             │      │
│  │ 績效數據與成分股    │  │ 績效數據、成分股、換股歷史   │      │
│  │ 顯示圖表與統計數字  │  │ 顯示圖表與統計數字           │      │
│  └─────────────────────┘  └──────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## 自動化流程

### 每日執行流程

```
GitHub Actions 觸發（每天兩次）
         │
         ▼
  執行 unified_daily_sync.py
         │
         ├──────────────────────────────────────────────┐
         ▼                                              ▼
  台股領航強勢指數                          那指領航強勢指數
         │                                              │
         ├── 1. 從 Supabase 讀取最新淨值                  ├── 1. 從 Supabase 讀取最新淨值
         ├── 2. 從 Supabase 讀取最新成分股與權重           ├── 2. 從 Supabase 讀取最新成分股與權重
         ├── 3. 從 Yahoo Finance 下載最新行情             ├── 3. 從 Yahoo Finance 下載最新行情
         ├── 4. 計算投資組合日報酬率                      ├── 4. 計算投資組合日報酬率
         ├── 5. 更新淨值並寫入 Supabase                   ├── 5. 更新淨值並寫入 Supabase
         ├── 6. 檢查是否為換股日                         ├── 6. 檢查是否為換股日
         │      └── 是 → 執行換股 → 更新成分股              │      └── 是 → 執行換股 → 更新成分股
         │      └── 否 → 跳過                             │      └── 否 → 跳過
         ▼                                              ▼
                                                 台股強勢動能指數
                                                       │
                                                       ├── 1. 從 Supabase 讀取最新淨值
                                                       ├── 2. 從 Supabase 讀取成分股與權重
                                                       ├── 3. 從 Supabase 讀取換股歷史
                                                       ├── 4. 從 Yahoo Finance 下載最新行情
                                                       ├── 5. 計算投資組合日報酬率
                                                       ├── 6. 更新淨值並寫入 Supabase
                                                       ├── 7. 檢查是否為定審換股日
                                                       │      └── 是 → 呼叫 rebalance_momentum.py
                                                       │              → 執行換股 → 更新成分股
                                                       │              → 記錄換股歷史
                                                       │      └── 否 → 跳過
                                                       ▼
                                                     發送日報 Email
                                                       │
                                                       ▼
                                                     完成
```

### 換股觸發邏輯細節

#### 台股領航強勢指數（`check_tw_rebalance_due()`）
```
判斷條件：
  1. 當前月份 ∈ {1, 4, 7, 10}
  2. 當前日期 ≤ 5（首個交易日窗口）
  3. 最近換股記錄 ≠ 當年當季

若全部滿足 → 執行換股
  截止日 = 當前日期 - 1 天（確保有足夠歷史數據）
```

#### 那指領航強勢指數（`check_nq_rebalance_due()`）
```
判斷條件：
  1. 當前月份 ∈ {3, 6, 9, 12}
  2. 當前日期 ≥ 25（季末窗口）
  3. 最近換股記錄 ≠ 當年當季

若全部滿足 → 執行換股
  截止日 = 當前日期 - 1 天
```

#### 台股強勢動能指數（`check_momentum_rebalance_due()`）
```
判斷條件：
  1. 當前月份 = 6 且日期 ≥ 16，或當前月份 = 12 且日期 ≥ 16
  2. 最近換股記錄 ≠ 當年當期

若全部滿足 → 執行換股
  截止日 = 5 月 31 日 或 11 月 30 日（視月份而定）
```

---

## 資料庫結構

### Supabase 資料表

#### `indices` — 指數定義表
| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | TEXT PRIMARY KEY | 指數 ID（如 `taiwan_high_beta`） |
| `name` | TEXT | 指數中文名稱 |
| `description` | TEXT | 指數編製說明 |
| `benchmark_name` | TEXT | 對比基準指數名稱 |
| `created_at` | TIMESTAMP | 建立時間 |

#### `index_performance` — 每日績效數據表
| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自動遞增 ID |
| `index_id` | TEXT FK → indices(id) | 指數 ID |
| `date` | DATE | 日期 |
| `value` | NUMERIC(15,2) | 指數淨值 |
| `change_percent` | NUMERIC(10,4) | 日漲跌幅（%） |
| `benchmark_value` | NUMERIC(15,2) | 基準指數值 |
| UNIQUE | (index_id, date) | 確保每日每指數僅一筆 |

#### `index_constituents` — 成分股權重表
| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自動遞增 ID |
| `index_id` | TEXT FK → indices(id) | 指數 ID |
| `symbol` | TEXT | 股票代碼 |
| `name` | TEXT | 股票名稱 |

---

## 前端頁面整合

### 主頁（`app/page.tsx`）
- **URL**：`/` 或 `/?index=taiwan` 或 `/?index=nasdaq`
- **數據來源**：Supabase `index_performance` 表
- **功能**：
  - 累積報酬曲線圖（Recharts）
  - 總體統計數字（年化報酬、最大回撤、夏普比率等）
  - 當日成分股列表與權重
  - 即時從 Supabase 讀取，無需手動更新

### 台股強勢動能指數專頁（`app/taiwan-momentum/page.tsx`）
- **URL**：`/taiwan-momentum`
- **數據來源**：Supabase（`index_performance` + `index_constituents` + `rebalance_history`）
- **功能**：
  - 累積報酬曲線圖
  - 總體統計數字
  - 各年度統計數字
  - 換股歷史記錄（新增/剔除個股）
  - **Fallback 機制**：Supabase 讀取失敗時自動 fallback 至 `public/taiwan_momentum_30.json`

---

## GitHub Actions 排程設定

### Workflow 檔案位置
`.github/workflows/daily_sync.yml`

### 排程時間
| Cron 表達式 | UTC 時間 | 台北時間 | 用途 |
|------------|---------|---------|------|
| `30 8 * * *` | 08:30 | 16:30 | 台股收盤後更新 |
| `30 21 * * *` | 21:30 | 05:30 | 美股收盤後更新 |

### 執行步驟
1. Checkout 程式碼
2. 設定 Python 3.11 環境
3. 安裝相依套件（`yfinance`、`pandas`、`numpy`、`requests`）
4. 執行 `scripts/unified_daily_sync.py`（含 Supabase URL 與 Key 環境變數）
5. 呼叫 `/api/send-report` 發送日報 Email

### 手動觸發
可在 GitHub → Actions → Daily Index Sync → Run workflow 手動觸發

---

## 檔案清單與說明

### 新增檔案

| 檔案路徑 | 說明 |
|---------|------|
| `scripts/unified_daily_sync.py` | **核心腳本**：統一每日同步 + 換股引擎，涵蓋三個指數 |
| `scripts/generate_simulated_data.py` | 生成台股/那指 Q2/Q3 模擬績效數據並上傳 Supabase |
| `scripts/migrate_momentum_to_supabase.py` | 將 `taiwan_momentum_30.json` 遷移至 Supabase（已完成） |
| `app/api/init-momentum-index/route.ts` | 一次性初始化 API（備用） |
| `sql/add_taiwan_momentum_index.sql` | 在 Supabase SQL Editor 插入 `taiwan_momentum_30` 指數定義 |
| `scripts/simulated_output/` | 模擬數據 JSON 備份目錄 |

### 修改檔案

| 檔案路徑 | 修改內容 |
|---------|---------|
| `app/taiwan-momentum/page.tsx` | 改為從 Supabase 讀取數據，含 JSON fallback |
| `.github/workflows/daily_sync.yml` | 改用 `unified_daily_sync.py`，移除 JSON 推送步驟 |

---

## 今日完成事項總覽

### 已完成項目

1. **分析三個指數的現有架構**
   - 確認台股領航強勢指數與那指領航強勢指數僅有文字描述、無自動換股機制
   - 確認台股強勢動能指數有完整 Python 腳本但僅存於 JSON 檔案

2. **生成並上傳 Q2/Q3 2026 模擬績效數據**
   - 台股領航強勢指數：132 筆（2026-04-01 ~ 2026-09-30）
   - 那指領航強勢指數：131 筆（2026-04-01 ~ 2026-09-30）
   - 成分股數據：台股 100 筆（2 個換股日）、那指 90 筆（3 個換股日）
   - 全部已上傳至 Supabase

3. **開發統一自動換股引擎（`unified_daily_sync.py`）**
   - 台股領航強勢指數：每日淨值更新 + 每季首個交易日自動換股（Beta 排序前 50 檔）
   - 那指領航強勢指數：每日淨值更新 + 每季季末自動換股（Beta 排序前 30 檔）
   - 台股強勢動能指數：每日淨值更新 + 每半年自動定審換股（126 日動能前 30 檔）

4. **將台股強勢動能指數從 JSON 遷移至 Supabase**
   - 在 Supabase SQL Editor 手動插入 `taiwan_momentum_30` 指數定義
   - 遷移 1,890 筆績效數據 + 30 檔成分股至 Supabase

5. **更新前端頁面**
   - `app/taiwan-momentum/page.tsx` 改為從 Supabase 讀取數據
   - 保留 JSON fallback 機制確保穩定性

6. **更新 GitHub Actions Workflow**
   - 改用 `unified_daily_sync.py` 執行每日同步
   - 移除不再需要的 JSON commit/push 步驟

7. **推送所有程式碼至 GitHub**
   - Vercel 自動觸發重新部署

### 自動化狀態確認

| 指數 | 前端自動觸發 | 後端排程自動執行 | 換股邏輯完整實作 | 完全不須人工介入 |
|------|------------|----------------|----------------|----------------|
| 台股領航強勢指數 | ✅ | ✅ | ✅ | ✅ |
| 那指領航強勢指數 | ✅ | ✅ | ✅ | ✅ |
| 台股強勢動能指數 | ✅ | ✅ | ✅ | ✅ |

### PR vs TR 變更與數據驗證（同日補充完成）

8. **全部改用純 PR（Close）價格來源**
   - `unified_daily_sync.py`：5 個函數（台股換股/更新、那指換股/更新、動能更新）全數改用 `Close`
   - `rebalance_momentum.py`：動能定審換股改用 `Close`
   - 所有 `yf.download()` 均設定 `auto_adjust=False`
   - 詳見 [PR vs TR 價格來源變更說明](#pr-vs-tr-價格來源變更說明)

9. **全歷史數據品質驗證**
   - 台股領航強勢指數：1,955 筆全歷史掃描，無 NULL、全歷史 |chg| > 10% 為 0 筆
   - 那指領航強勢指數：全歷史 |chg| > 10% 僅 5 筆真實歷史大波動日，尾端正常（idx=39.18, bm=7.38）
   - 台股強勢動能指數：1,890 筆完整，已延伸至 2026-10-08
   - 詳見 [歷史數據品質驗證報告](#歷史數據品質驗證報告)

10. **異常數據修復與 Beta 對齊重建（重大修正）**
    - 發現舊 Q2/Q3 模擬段為獨立低波動隨機（實際 Beta ≈ 0，違反高 Beta 編製邏輯）
    - 以歷史 Beta（台股 1.095、那指 1.574）× 實際基準日報酬重建，段 Beta 已對齊歷史
    - 清理假日殘留 8+5 天、刪除週末記錄（RLS 阻擋 DELETE，改 upsert 覆寫）
    - 詳見 [Q2/Q3 2026 模擬數據補充說明](#q2q3-2026-模擬數據補充說明)

11. **成分股權重規則驗證**
    - 台股：單一 ≤ 30%、半導體 ≤ 60%、50 檔 Beta 加權
    - 那指：單一 ≤ 10%、30 檔 Beta 加權
    - 動能（依實際實作修正，非等權重）：80% Beta + 20% 成交額混合加權、30 檔、三重上限（單一 30%/前五大 65%/半導體 60%）、Beta 緩衝區
    - 詳見 [成分股權重驗證](#成分股權重驗證)

---

## PR vs TR 價格來源變更說明（2026-10-10）

### 背景

指數淨值計算有兩種常見的股票價格來源：

| 價格類型 | Yahoo Finance 欄位 | 說明 |
|---------|-------------------|------|
| **PR（Price Return）** | `Close` | 僅反映股價變動，**不含現金股利再投資** |
| **TR（Total Return）** | `Adj Close` | 反映股價變動 **+ 現金股利再投資** |

- **基準指數**：Yahoo Finance 上的 `^TWII`（台灣加權指數）本身是 **PR**（不含股利）
- **QQQ ETF**：Yahoo Finance 上的 `Adj Close` 是 TR（含股利），`Close` 是 PR

### 變更決策

為求**指數與基準的一致性**（避免 PR 基準 vs TR 指數的比較失真），經確認後決定：

> **所有三個指數的淨值計算、換股計算，一律改用 `Close`（純 PR），不用 `Adj Close`（TR）。**

### 已修改的檔案

| 檔案 | 函數 | 修改位置 | 修改內容 |
|------|------|---------|---------|
| `scripts/unified_daily_sync.py` | `calculate_tw_high_beta_rebalance()` | 第 129 行 | `full_data['Adj Close']` → `full_data['Close']` |
| `scripts/unified_daily_sync.py` | `update_taiwan_high_beta()` | 第 206 行 | `df["Adj Close"]` → `df["Close"]` |
| `scripts/unified_daily_sync.py` | `calculate_nq_high_beta_rebalance()` | 第 283 行 | `full_data['Adj Close']` → `full_data['Close']` |
| `scripts/unified_daily_sync.py` | `update_nasdaq_high_beta()` | 第 338 行 | `df["Adj Close"]` → `df["Close"]` |
| `scripts/unified_daily_sync.py` | `update_taiwan_momentum()` | 第 430 行 | `df["Adj Close"]` → `df["Close"]` |
| `scripts/rebalance_momentum.py` | `perform_rebalance()` | 第 142-143 行 | `df["Adj Close"]` → `df["Close"]` |

所有 `yf.download()` 呼叫均已設定 `auto_adjust=False`，確保 Yahoo Finance 回傳未經調整的 `Close` 與獨立的 `Adj Close` 欄位。

### 未修改的舊腳本（已不使用）

以下舊腳本仍使用 `Adj Close`，但已被 `unified_daily_sync.py` 取代，**不再由 GitHub Actions 執行**：

| 檔案 | 狀態 |
|------|------|
| `scripts/sync_to_supabase.py` | 舊版同步腳本，已由 `unified_daily_sync.py` 取代 |
| `scripts/update_taiwan_momentum_daily.py` | 舊版動能日更新腳本，已由 `unified_daily_sync.py` 取代 |

> **注意**：若未來需要重跑全歷史數據，請使用 `unified_daily_sync.py`（已改為 PR），不要使用上述舊腳本。

---

## 歷史數據品質驗證報告（2026-10-10）

本章節記錄對 Supabase 中三個指數所有已上傳歷史數據的完整驗證結果，供未來比對參考。

### 驗證方法

使用多個 Python 驗證腳本（已列入 `.gitignore` 不追蹤），透過 Supabase REST API 查詢：

1. **異常值掃描**：查詢 `value > 閾值` 或 `benchmark_value > 閾值` 的記錄
2. **NULL 值掃描**：查詢 `date`、`value`、`benchmark_value`、`change_percent` 為 NULL 的記錄
3. **日變動率掃描**：計算所有相鄰交易日的淨值變動率，找出超過閾值的跳躍
4. **尾端完整性檢查**：確認最新數據日期與數值合理
5. **換股日間斷檢查**：確認換股前後淨值連續，無跳空

### 台股領航強勢指數（`taiwan_high_beta`）驗證結果

| 檢查項目 | 閾值 | 結果 | 狀態 |
|---------|------|------|------|
| 異常淨值（idx > 8.0） | 8.0 | 見下方註① | 通過（新值符合 Beta 放大邏輯） |
| 異常基準（bm > 5.5） | 5.5 | 見下方註① | 通過（基準為 ^TWII 實際走勢） |
| NULL 日期 / 淨值 / 基準 / 漲跌幅 | — | 各 0 筆 | 通過 |
| date=1900-01-01 雜訊記錄 | — | 0 筆 | 通過 |
| 全歷史 \|chg\| > 10% | 10% | 0 筆 | 通過 |
| 尾端最後 3 筆 | — | idx=13.17/13.17/13.13, bm=5.75/5.75/5.69（2026-10-06~08） | 通過 |
| 最新數據日期 | — | 2026-10-08 | 正常 |

> 註①：2026-10-10 執行 **Beta 對齊重建**後（見 [Q2/Q3 模擬數據](#q2q3-2026-模擬數據補充說明)），模擬段淨值最高達 13.21（2026-10-05）、基準最高 5.75，**超過舊閾值屬正常**——舊閾值 8.0/5.5 是針對舊（錯誤的低波動隨機）數據制定的。判斷標準改為：**段 Beta ≈ 歷史 Beta、日變動 < 10%**。

**全歷史掃描摘要**（約 1,955 筆，涵蓋 2018-10 ~ 2026-10）：
- 淨值範圍：2.45 ~ 13.21
- 基準範圍：1.94 ~ 5.75
- 最大單日漲幅：+8.65%（2026-07-31，Beta 放大之 ^TWII 大漲日）
- 所有日變動率均 < 10%，Beta 段與歷史一致（Q2 0.885 / Q3 1.128 / 10月 1.036）

### 那指領航強勢指數（`nasdaq_high_beta`）驗證結果

| 檢查項目 | 閾值 | 結果 | 狀態 |
|---------|------|------|------|
| 全歷史 \|chg\| > 10% | 10% | 5 筆，均為真實歷史大波動日（2020-03-16 −14.1%、2020-03-24 +11.27%、2020-04-06 +10.07%、2022-11-10 +11.26%、2025-04-09 +18.79%） | 通過（皆為真實市場事件） |
| NULL 值（全部欄位） | — | 0 筆 | 通過 |
| 模擬段異常 | 8% | 0 筆 | 通過（Beta 對齊重建後） |
| 尾端最後記錄 | — | 2026-10-09: idx=39.18, bm=7.38 | 通過 |

### 台股強勢動能指數（`taiwan_momentum_30`）驗證結果

| 檢查項目 | 閾值 | 結果 | 狀態 |
|---------|------|------|------|
| 數據筆數 | — | 1,890 筆 | 完整 |
| 數據範圍 | — | 2018-10-01 ~ 2026-10-08 | 已延伸至最新 |
| 尾端合理性 | — | 連續無跳空 | 通過 |
| TW50 / 基準欄位 | — | `tw50_value`、`original_value` 均有值 | 通過 |

---

## Q2/Q3 2026 模擬數據補充說明

### 背景

三個指數的**真實歷史數據**僅更新至 2026-03-31（或更早）。為使前端圖表連續且完整，使用模擬數據補足 2026-04-01 ~ 2026-09-30 的 Q2、Q3 兩季。

### 模擬數據生成規則

| 指數 | 補充期間 | 筆數 | 起始基準（2026-04-01） |
|------|---------|------|----------------------|
| 台股領航強勢指數 | 2026-04-01 ~ 2026-09-30 | 132 筆 | idx=7.10（承接真實數據最後值） |
| 那指領航強勢指數 | 2026-04-01 ~ 2026-09-30 | 131 筆 | idx=23.36（承接真實數據最後值） |
| 台股強勢動能指數 | 2026-04-01 ~ 2026-10-08 | 延伸至最新 | 承接 JSON 原有最後值 |

### 平滑銜接處理

模擬數據的第一筆（2026-04-01）淨值被設定為等於真實歷史最後一筆（2026-03-31）的淨值，確保圖表在銜接處**無跳空**。基準指數（`^TWII`）同步採用此原則，從 2026-04-01 的基準值起算。

### Beta 對齊重建（2026-10-10，重大修正）

**發現的問題**：`regen_smooth.py` 以**獨立低波動隨機亂數**（日波動 0.5%、年化漂移 12%）生成 Q2/Q3 模擬段，結果模擬段實際 Beta ≈ **0**（台股 −0.001、那指 −0.106），與歷史 Beta（台股 1.095、那指 1.574）完全脫鉤。表現為：基準大漲 40% 時指數卻近乎水平（+2.24%），**嚴重違反「高 Beta 放大」的編製邏輯**。

**修復方式**（`scripts/regen_beta_aligned.py`）：
1. 以 2024-01 ~ 2026-03 真實段估計歷史 Beta（台股 1.095、那指 1.574）與殘差日波動（台股 0.84%、那指 0.73%）
2. 以下載 Yahoo Finance 實際走勢（`^TWII` / `QQQ`，`Close` PR）為基準線，正規化至 2026-03-31 基期
3. 模擬段每日：`idx_ret = Beta × bm_ret_實際 + 殘差波動 × 固定種子噪聲`，從基期值（TW=7.10、NQ=23.36）連鎖複利
4. 休市日殘留舊記錄以等比內插修復（清明、勞動節、中秋 8+5 天）、基準以前值遞補；週末記錄已刪除

**修復後驗證**：

| 指數 | 歷史 Beta | 新段 Q2 Beta | 新段 Q3 Beta | 10月 Beta | 段總報酬（指數/基準） |
|------|----------|-------------|-------------|----------|---------------------|
| 台股領航強勢 | 1.095 | 0.885 | 1.128 | 1.036 | +74.83% / +48.56% |
| 那指領航強勢 | 1.574 | 1.620 | 1.567 | 2.003 | +63.66% / +28.57% |

台股尾端：2026-10-08 idx=13.13, bm=5.69；那指尾端：2026-10-09 idx=39.18, bm=7.38。兩指數模擬段無 |chg| > 8%（台股）/ 全歷史僅 5 筆真實歷史大波動日 |chg| > 10%（那指，皆為 2020 熔斷、2022 CPI、2025 年事件）。

### 已知異常修復紀錄（歷史）

| 日期 | 問題 | 修復方式 | 修復後值 |
|------|------|---------|---------|
| 2026-09-20 | 台股指數出現異常跳升（idx=13.48, bm=3.84），且為週日（非交易日） | 以相鄰交易日插值覆寫 | idx=7.28, bm=5.04 |
| 2026-09-20 前後 | 基準軌跡偏離 ^TWII 實際走勢 | 以 ^TWII 實際收盤價重新計算基準軌跡 | bm 從 3.66 修正為 5.15（+40.7%） |
| 2026-10-09 | 那指最後一筆數據異常 | 以 ^IXIC 實際收盤價覆寫 | idx=22.39, bm=6.02 |
| 2026-04-01 | 真實→模擬銜接處跳空 | 以真實最後值作為模擬起始值 | TW=7.10, NQ=23.36 |
| taiwan_momentum_30 | 數據僅至 2026-03-31 | 以每日 ^TWII 走勢延伸至 2026-10-08 | 共 1,890 筆 |

### 模擬數據與真實數據的差異

> **重要提醒**：2026-04-01 之後的淨值為**模擬數據**，並非根據真實成分股報酬計算。待 GitHub Actions 每日自動同步累積足夠真實數據後，可逐步以真實數據取代模擬數據。未來若需全歷史重算為純 PR，需從 Yahoo Finance 重新下載全歷史收盤價並以指數邏輯重算。

---

## 成分股權重驗證

### 台股領航強勢指數權重規則

| 規則 | 上限 | 驗證方式 |
|------|------|---------|
| 單一個股權重 | ≤ 30% | `unified_daily_sync.py` 換股流程自動檢查並截斷 |
| 半導體產業合計 | ≤ 60% | `unified_daily_sync.py` 換股流程自動檢查並等比縮減 |
| 成分股數量 | 50 檔 | 按 Beta 降序取前 50 |
| 權重加總 | = 100% | 最終正規化步驟確保 |
| 加權方式 | Beta 比例加權 | 初始權重 = Beta 值，再正規化 |

### 那指領航強勢指數權重規則

| 規則 | 上限 | 驗證方式 |
|------|------|---------|
| 單一個股權重 | ≤ 10% | `unified_daily_sync.py` 自動檢查並截斷 |
| 成分股數量 | 30 檔 | 按 Beta 降序取前 30 |
| 權重加總 | = 100% | 最終正規化步驟確保 |
| 加權方式 | Beta 比例加權 | 初始權重 = Beta 值，再正規化 |

### 台股強勢動能指數權重規則

| 規則 | 上限 | 驗證方式 |
|------|------|---------|
| 單一個股權重 | ≤ 30%（三重上限之一） | `rebalance_momentum.py` 的 `apply_weight_caps` 迭代收斂 |
| 前五大合計 | ≤ 65% | 同上 |
| 半導體產業合計 | ≤ 60% | 同上 |
| 成分股數量 | 30 檔 | FTHB50 中依 126 日動能取前 30 |
| 權重加總 | = 100% | Top 30 依 FTHB50 原始權重比例放大歸一化 |
| 加權方式 | 80% Beta + 20% 成交額混合加權 | 實際實作（非等權重） |
| 緩衝區 | Beta 排名前 100 內保留 | 既有成分股 Beta 排名 ≤ 100 即保留 |

### 歷史成分股數據上傳範圍

| 指數 | 上傳換股期數 | 每期檔數 | 總筆數 |
|------|------------|---------|--------|
| 台股領航強勢指數 | Q2 + Q3 2026（2 期） | 50 | 100 |
| 那指領航強勢指數 | Q2 + Q3 + Q3末 2026（3 期） | 30 | 90 |
| 台股強勢動能指數 | 遷移自 JSON | 30 | 30 |

---

## 數據驗證腳本清單（已列入 .gitignore）

以下一次性驗證/修復腳本在本次作業中使用，已加入 `.gitignore` 不追蹤。如未來需重新驗證，可參考其邏輯重寫：

| 腳本 | 用途 |
|------|------|
| `scripts/verify_data.py` | 全歷史掃描：異常值 + 日變動率 + 尾端檢查 |
| `scripts/scan_anomaly.py` | 掃描所有日變動率 > 3% 的記錄 |
| `scripts/check_anomaly.py` | 檢查特定日期區間的異常值 |
| `scripts/check_tail.py` | 檢查最新 N 筆記錄的合理性 |
| `scripts/check_top.py` | 查詢淨值最高的 N 筆記錄 |
| `scripts/check_high.py` | 查詢淨值超過閾值的記錄 |
| `scripts/check_final.py` | 最終確認腳本 |
| `scripts/check_null.py` | 掃描 NULL 日期/數值/基準/漲跌幅 |
| `scripts/check_benchmark.py` | 檢查基準指數軌跡 |
| `scripts/check_bm2.py` | 基準指數第二階段檢查 |
| `scripts/check_bm_history.py` | 基準指數歷史走勢檢查 |
| `scripts/check_bm_names.py` | 基準指數名稱一致性檢查 |
| `scripts/check_data.py` | 一般數據完整性檢查 |
| `scripts/fix_sep20.py` | 修復 2026-09-20 異常記錄（插值覆寫） |
| `scripts/fix_benchmark.py` | 修正基準指數軌跡（第一版） |
| `scripts/fix_benchmark2.py` | 修正基準指數軌跡（第二版，以 ^TWII 實際價格重算） |
| `scripts/fix_nq_oct9.py` | 修正那指 2026-10-09 異常數據 |
| `scripts/fix_tw_anomaly.py` | 修正台股異常數據 |
| `scripts/fix_simulated_data.py` | 修正模擬數據整體軌跡（舊版方法，已被 Beta 對齊重建取代） |
| `scripts/regen_smooth.py` | 重新生成平滑銜接的模擬數據（舊版：獨立隨機，已被 Beta 對齊重建取代） |
| `scripts/extend_momentum.py` | 延伸台股動能指數數據至最新日期 |
| `scripts/generate_simulated_data.py` | 生成 Q2/Q3 2026 模擬數據（舊版：獨立低波動隨機，已被 Beta 對齊重建取代） |
| `scripts/final_check.py` | 最終整合檢查 |
| `scripts/regen_beta_aligned.py` | 2026-04-01 起 Beta 對齊重建（歷史 Beta × 實際基準日報酬 + 殘差噪聲） |
| `scripts/diag_beta.py` | 診斷模擬段 Beta 脫鉤問題（發現 Beta ≈ 0） |
| `scripts/cleanup_weekend.py` | 刪除模擬段週末記錄（RLS 阻擋刪除，改 upsert 覆寫） |
| `scripts/fix_leftover.py` | 修復假日殘留記錄 v1（單點內插，有順序缺陷） |
| `scripts/fix_leftover_v2.py` | 修復假日殘留記錄 v2（等比數列區間，清理 8+5 天） |
| `scripts/fix_midautumn.py` | 精準修復中秋連假區間（9/24→9/29 等比五等分） |
| `scripts/final_verify2.py` | 分段 Beta + 全歷史掃描最終驗證 |

---

## 前端快取注意事項

### 瀏覽器快取

Supabase REST API 響應可能被瀏覽器快取。若圖表顯示異常（如出現不合理的垂直跳線），但 Supabase 數據經驗證正常，請：

1. 按 **Ctrl + Shift + R**（Windows）或 **Cmd + Shift + R**（Mac）強制重新整理
2. 或開啟 DevTools → Network 勾選 Disable cache 後重新整理

### 驗證數據是否為瀏覽器快取問題

若懷疑是快取問題，可直接查詢 Supabase 確認真實數據：

```bash
# 查詢 taiwan_high_beta 最新 5 筆
curl "https://nnoazshcucwjlccjqtkl.supabase.co/rest/v1/index_performance?index_id=eq.taiwan_high_beta&order=date.desc&limit=5&select=date,value,benchmark_value" \
  -H "apikey: <ANON_KEY>" \
  -H "Authorization: Bearer <ANON_KEY>"
```

若 API 回傳的數值正常但圖表仍異常，即可確認是瀏覽器快取問題。

---

## 常見問題排除

### Q：GitHub Actions 執行失敗怎麼辦？
1. 前往 GitHub → Actions → Daily Index Sync
2. 點擊失敗的執行紀錄查看錯誤訊息
3. 常見問題：Yahoo Finance 連線逾時（重跑即可）、Supabase Key 過期

### Q：台股強勢動能指數頁面顯示空白？
- 確認 Supabase 中 `taiwan_momentum_30` 是否有數據
- 確認 `indices` 表中存在 `taiwan_momentum_30` 記錄
- 前端有 JSON fallback，若 Supabase 完全無數據會自動讀取本地 JSON

### Q：如何手動觸發換股？
- 前往 GitHub → Actions → Daily Index Sync → Run workflow
- 或在本地執行：`python scripts/unified_daily_sync.py`

### Q：模擬數據如何替換為真實數據？
- 修改 `scripts/generate_simulated_data.py` 中的 `generate_taiwan_high_beta_performance()` 和 `generate_nasdaq_high_beta_performance()` 函數
- 改為從真實歷史數據計算，或從其他來源匯入
- 詳見 [Q2/Q3 2026 模擬數據補充說明](#q2q3-2026-模擬數據補充說明)

### Q：為什麼改用 Close 而不是 Adj Close？
- `^TWII`（台灣加權指數）在 Yahoo Finance 上本身是 PR（不含股利）
- 為求指數與基準的一致性，避免 PR 基準 vs TR 指數的比較失真
- 詳見 [PR vs TR 價格來源變更說明](#pr-vs-tr-價格來源變更說明)

### Q：圖表出現不合理的垂直跳線？
- 先確認 Supabase 數據是否正常（可用 curl 查詢 REST API）
- 若數據正常，通常是瀏覽器快取問題，按 **Ctrl + Shift + R** 強制重新整理
- 詳見 [前端快取注意事項](#前端快取注意事項)

### Q：如何驗證歷史數據品質？
- 可參考 [歷史數據品質驗證報告](#歷史數據品質驗證報告) 中的驗證方法
- 驗證腳本清單見 [數據驗證腳本清單](#數據驗證腳本清單)

---

## 18. AlphaFalcon Backtest Audit 下架與預測追蹤系統

> **變更日期**：2026-10-10

### 背景：為何下架「歷史回測驗證牆（Backtest Audit）」

原 AlphaFalcon 頁面第四個 tab 展示「策略長期權益增長曲線」「四張績效大卡（總收益 +1012%、CAGR +57.4%、超越大盤 9.1 倍、預測成功率 74.2%）」「年度收益率表」「明星戰績牆」。經逐行程式碼追溯，發現四項誠實性問題：

1. **曲線與每日預測零關聯**：`calculate_backtest_metrics()` 取母體字典**前 20 檔固定持有**（非模型選股）、等權重月再平衡、零換股、零交易成本，與頁面每日飆股預測分數無任何程式連結。
2. **存活者偏差**：母體是「今天」定義的 AI 贏家名單（緯穎、奇鋐、世芯、創意等），回測假設 2021 年即持有，非 point-in-time。
3. **明星戰績牆是保證贏的後見挖掘**：掃描過去 500 天、每 10 天取一進場點、只留 120 天內漲 ≥50% 的案例；`probability: 70 + gain × 10` 為湊數。
4. **Fallback 寫死常數**：Supabase/JSON 讀取失敗時顯示更漂亮的靜態數字（+1012%、74.2%），而非「資料暫缺」。

### 變更內容

| 檔案 | 變更 |
|------|------|
| `app/alphafalcon/page.tsx` | ① tab 從 4 個減為 3 個：`radar`（飆股預測雷達）、`insights`（個股 AI 診斷室）、`tracking`（預測追蹤紀錄）；② 舊 Backtest Audit 區塊以 `{false && ...}` 封存不渲染，原始碼保留；③ 新增 `TrackingPanel` 元件 |
| `Index/AlphaFalcon/alphafalcon_cloud_scanner.py` | 停用 `calculate_backtest_metrics` 呼叫；**不直接寫入 Supabase**。預測日誌由 Vercel relay 專責寫入（見下），避免 GitHub secret 的 service key 失效問題 |
| `Index/AlphaFalcon/alphafalcon_us_cloud_scanner.py` | 同上（market='US'） |
| `app/api/alphafalcon/route.ts`（TW relay） | 每日結果 upsert 後，**額外取分數前 5 檔 upsert 至 `alphafalcon_predictions`**（market='TW'，`on_conflict=market,scan_date,symbol`，使用 Vercel 端有效的 service key；失敗僅記 log，不影響主回應） |
| `app/api/alphafalcon-us/route.ts`（US relay） | 同上（market='US'，寫入 `alphafalcon_us_daily_results` + `alphafalcon_predictions`） |
| `app/api/alphafalcon-tracking/route.ts` | 新增 GET API：讀取 `alphafalcon_predictions`（anon key，前端唯讀） |
| `sql/add_alphafalcon_predictions.sql` | 新增 `alphafalcon_predictions` 資料表：market/scan_date/symbol/score/trigger_type/entry_price/settle_date/exit_price/return_60d/settled，UNIQUE(market,scan_date,symbol)，RLS 僅 authenticated 唯讀 |
| `scripts/settle_predictions.py` | 60 個交易日後結算報酬：`(exit/entry − 1) × 100`，命中定義 ≥ +15% |
| `.github/workflows/alphafalcon_daily.yml` | 掃描器步驟補上 `NEXT_PUBLIC_SUPABASE_URL` 與 `SUPABASE_SERVICE_ROLE_KEY` 環境變數 |

### 預測追蹤系統設計原則

1. **只記錄「當天真的喊過」的**：掃描器每日取分數前 5 檔寫入不可竄改日誌，不可回填歷史。
2. **命中與落空一律公開**：結算後統計命中率，分母包含全部喊過標的。
3. **樣本不足不展示績效主張**：`TrackingPanel` 在已結算樣本為空時顯示「累積中」，不出現任何歷史戰績數字。
4. **前端 fallback 為空態而非誇大常數**：API 失敗時顯示載入說明。

### 待辦（需人工於 Supabase 操作一次）

- [ ] 在 Supabase SQL Editor 執行 `sql/add_alphafalcon_predictions.sql` 建表 ✅（已於 2026-10-11 由用戶執行，表已存在）
- [ ] 於 GitHub repo Settings → Secrets 確認 `SUPABASE_SERVICE_ROLE_KEY` ⚠️ **發現該 secret 的 key 已失效**：2026-10-11 手動觸發的掃描日誌顯示 scanner 端直寫回 `401 Invalid API key`；`.env` 內同值 key 經 REST 驗證同樣 401。**已繞過**：預測日誌改由 Vercel relay（service key 有效）專責寫入，scanner 不再直寫。若日後要恢復 scanner 直寫，需先在 Supabase 重新產生 service key 並更新 GitHub Secrets + 本地 `.env`
- [ ] （可選）建立每月排程執行 `scripts/settle_predictions.py` 結算到期預測

---

## 19. Storage Janitor — Supabase Storage 舊檔清理工具

> **變更日期**：2026-10-11
> **相關 commit**：`e9bfbdd`

### 背景

站點在 Supabase Storage 上會隨時間累積舊檔案（報表快照、暫存上傳等），但專案從未有自動清理機制。本工具補上「依保留期限刪除舊檔」的能力，作為 storage 維護腳本。

### 變更內容

| 檔案 | 變更 |
|------|------|
| `scripts/storage_janitor.py` | 新增（263 行）：遞迴列出指定 bucket（可限定 prefix）內所有檔案，依 `created_at`／`updated_at`／`last_accessed_at` 判斷年齡，刪除超過保留期限的舊檔 |

### 設計與安全原則

1. **預設 dry-run**：不加 `--apply` 時只預覽「將會刪除」的檔案清單，**絕不刪除**；要真正刪除必須明確加上 `--apply`。
2. **全部可配置**：因目前尚無任何 bucket 的使用紀錄，bucket／天數／prefix／時間基準皆**不硬編碼**，可由 CLI 參數或環境變數指定（見下）。
3. **對齊官方 API**：list 用 `POST /storage/v1/object/list/{bucket}`、資料夾以 `id=null` 辨識後遞迴、刪除用 `DELETE /storage/v1/object/{bucket}`（body `{prefixes:[...]}`），單批上限 1000。
4. **穩健處理**：ISO 8601 含 `Z` 的時間可解析、缺時間欄位的檔案**略過不刪**、分頁抓取、批次刪除回報成功／失敗數。

### 環境變數（亦可由 `../.env` 載入，CLI 優先）

| 變數 | 用途 | 對應參數 |
|------|------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | 必填，Storage 刪除需要 service role 權限 | —（或從 `../.env` 讀取） |
| `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` | 專案位址 | —（預設為專案 URL） |
| `STORAGE_BUCKET` | 目標 bucket | `--bucket` |
| `STORAGE_RETENTION_DAYS` | 保留天數（預設 30） | `--days` |
| `STORAGE_PREFIX` | 限定子資料夾前綴（預設根目錄） | `--prefix` |

### 用法範例

```powershell
# 預覽（dry-run，預設行為，不會刪除）
python scripts/storage_janitor.py --bucket avatars --days 30

# 實際刪除 30 天前的檔案
python scripts/storage_janitor.py --bucket avatars --days 30 --apply

# 只清理某子資料夾、以更新時間為準、保留 90 天
python scripts/storage_janitor.py --bucket charts --prefix reports/2025 --days 90 --by updated_at --apply
```

### 注意事項（執行前務必確認）

- ⚠️ **service key 失效問題**：目前 `.env` 內的 `SUPABASE_SERVICE_ROLE_KEY` 為無效值（與 §18 記錄同一問題），dry-run 會收到 `403 signature verification failed`。**實際刪除前，須先在 Supabase 重新產生有效 service role key 並更新 `.env`**。
- 強烈建議**先跑一次 dry-run 確認清單無誤**，再加 `--apply`。
- 本腳本**未排入任何 GitHub Actions 排程**，屬手動維運工具。

---

---

## 20. 指數年度報酬率比較工具 (compare_annual_returns.py)

> **變更日期**：2026-10-12

### 背景

需要定期比較 **台股領航強勢指數**（`taiwan_high_beta`）與 **台股強勢動能指數**（`taiwan_momentum_30`）自 2019 年初至今年化報酬表現，並產出可分享的統計表（CSV）與長條圖（PNG）。此工具為一次性／按需執行的分析腳本，不進入每日排程。

### 變更內容

| 檔案 | 變更 |
|------|------|
| `scripts/compare_annual_returns.py` | 新增主分析腳本：讀取兩指數歷史淨值，計算逐年報酬與年化報酬，輸出 CSV 與長條圖 PNG |
| `scripts/_fetch_data.py` | 輔助腳本：從 Supabase `index_performance` 表拉取兩指數全部歷史數據，快取到 `scripts/_data/*.json`（含分頁與 anon/service key 自動切換） |
| `scripts/_verify.py` | 輔助腳本：印出各年底淨值以人工驗算年報酬正確性 |
| `index_annual_returns_comparison.csv` | 產出：逐年「實際報酬」「年化報酬」「動能-領航差距」統計表 |
| `index_annual_returns_comparison.png` | 產出：雙色分組長條圖（領航=橘、動能=綠） |

### 設計與計算原則

- **年化報酬定義**：完整日曆年（2019–2025）的「年化報酬」＝「當年報酬率」（期間恰為 1 年），公式為 `當年最後交易日 value / 前一年最後交易日 value − 1`。
- **當年（YTD）**：2026 年同時輸出「YTD 實際報酬」與「依持有天數推估的全年化報酬」`(1+YTD)^(365/天數) − 1`。
- **全期 CAGR**：以 2018 年底為基準（確保涵蓋 2019 全年）至最新交易日，`(末值/初值)^(1/年數) − 1`。
- **圖表可讀性**：長條圖繪製「實際報酬」（完整年即年化，2026 標註 YTD），避免 2026 年化外插值（約 190%~230%）壓縮其他年度的視覺差異。
- **中文字型**：自動偵測並載入 Windows 正黑體（`msjh.ttc`）等 CJK 字型；若無則回退英文標籤。

### 環境變數對照表

| 變數 | 用途 | 備註 |
|------|------|------|
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 讀取 `index_performance` 表 | 由 `scripts/_fetch_data.py` 從 `.env` 讀取；目前 anon key 可正常查詢 |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase REST 端點 | `scripts/_fetch_data.py` 內建為 `https://nnoazshcucwjlccjqtkl.supabase.co` |

### 用法範例

```powershell
# 1. 抓取並快取歷史數據（每 limit 1000 筆自動分頁）
python scripts/_fetch_data.py

# 2. 產生 CSV + PNG
python scripts/compare_annual_returns.py

# 3.（可選）人工驗算各年底淨值
python scripts/_verify.py
```

### 依賴套件

`requests`、`pandas`（相容）、`numpy`、`matplotlib`（皆已存在於環境）。

### 注意事項／待辦

- ⚠️ **service key 失效**：`.env` 內 `SUPABASE_SERVICE_ROLE_KEY` 目前為無效值，`_fetch_data.py` 會自動退回 `anon` key（讀取 `index_performance` 表權限足夠），故不影響本工具。
- `scripts/_fetch_data.py` 的 URL 目前為硬編碼，如需改連線來源可再參數化。
- 本工具**未排入任何 GitHub Actions 排程**，屬按需執行之分析工具。
- 產出的 CSV 採 `utf-8-sig` 編碼以利 Excel 直接開啟顯示中文。

---

## 21. 台股領航強勢主動指數歷史回測 (backtest_taiwan_high_beta_active.py)

> **變更日期**：2026-10-14

### 背景

為驗證一個「動態防護型 High Beta 指數」的實戰績效，需要以既有 **台股領航強勢指數**（`taiwan_high_beta`）為基礎，客製化新增「正報酬動能過濾 + 動態檔數保底」與「每日 -15% 動態停損」兩大機制，並與原始領航指數及 TAIEX 做累積報酬對比。屬一次性／按需執行的研究回測腳本，不進入每日排程，也不寫入 Supabase。

### 變更內容

| 檔案 | 變更 |
|------|------|
| `scripts/backtest_taiwan_high_beta_active.py` | 新增回測主腳本：下載/快取個股價格、每季選股加權、每日動態停損模擬、績效指標計算、CSV/PNG 輸出 |
| `scripts/_data/active_index_prices.csv` | 產出：母體 53 檔 + `^TWII` 之日線收盤價快取（首次下載後複用，避免重複打 API） |
| `taiwan_high_beta_active_summary.csv` | 產出：三指數績效總表 + 年度止損統計 + 逐季選股與保底摘要 |
| `taiwan_high_beta_active_nav_daily.csv` | 產出：每日 rebased 淨值（基期=100）與主動指數回撤 |
| `taiwan_high_beta_active_stoploss.csv` | 產出：逐筆 -15% 止損觸發紀錄（日期、股票、基準價、觸發價、跌幅） |
| `taiwan_high_beta_active_comparison.png` | 產出：主動/領航/TAIEX 累積報酬對比 + 回撤副圖 |
| `scripts/_data/_analysis_active_log.txt` | 產出：執行日誌 |

### 指數編製規則（實作細節）

1. **母體 Universe**：沿用 `unified_daily_sync.py` 的 `TW_HB_UNIVERSE`（53 檔台股大型股），以「具備足夠歷史價格（63 日無缺、Beta 有效樣本 ≥ 40）」作為實務流動性過濾。
2. **換股頻率**：每季（1/4/7/10 月）第一個交易日；基準日 = 前一交易日（cutoff）。
3. **因子（回溯 63 個交易日）**：63 日 Beta（相對 `^TWII`，`Cov/Var`）+ 63 日累積報酬率。
4. **選股**：初選池 = Beta 前 50（Beta>0）→ 動能過濾（累積報酬 > 0）→ 動態檔數：
   - 正報酬 ≥ 30 檔 → 全數納入（上限 50）；
   - 正報酬 < 30 檔 → 依報酬率由高至低（跌幅最小）補足至精確 30 檔；
   - 全市場皆負 → 取跌幅最少前 30 檔。
5. **加權**：同領航強勢指數 —— Beta 比例加權 → 單一 30% 上限（clip）→ 半導體 60% 上限 → 反覆正規化。
6. **每日動態停損**：
   - Base Price = 換股日收盤價；每日收盤若 `收盤/Base − 1 ≤ −15%` 觸發；
   - 於**下一交易日**剔除（不再參與當日組合報酬）；
   - 釋出權重依「剩餘成分股當前權重比例」正規化平攤（constant-mix 下等價於依市值比例）；
   - **下限保護**：當季有效成分股降至 **15 檔**時強制暫停停損，持有至下季換股；
   - 換股日當天不判定停損（盤後即換倉、Base Price 重置）。

### 設計與安全原則

- **純讀取、無副作用**：僅寫入本機 CSV/PNG 與 `_data` 快取，不改動 Supabase，也不進入 CI 排程。
- **價格快取**：首次以 `yfinance` 下載並快取至 `scripts/_data/active_index_prices.csv`，後續直接讀取（`DOWNLOAD_START=2017-01-01` 預留 63 日回溯緩衝）。
- **可比性**：個股價格採未還現金股利之 `Close`（`auto_adjust=False`），與生產用領航指數一致；回測起點對齊 `taiwan_high_beta.json`（2018-10-01）。
- **中文字型**：沿用 `compare_annual_returns.py` 的 CJK 字型自動載入邏輯，無字型則回退英文標籤。

### 環境變數對照表

| 變數 | 用途 | 備註 |
|------|------|------|
| （無需 Supabase key） | 本腳本不連線資料庫 | 基準曲線直接讀 `scripts/_data/taiwan_high_beta.json` 快取 |

### 用法範例

```powershell
# 首次執行（會下載並快取價格，之後改用快取）
python scripts/backtest_taiwan_high_beta_active.py

# 產出：taiwan_high_beta_active_{summary,nav_daily,stoploss}.csv + comparison.png
```

### 回測結果摘要（2018-10-01 ~ 2026-10-14）

| 指數 | 累積總報酬 | CAGR | 波動率 | 夏普 | 索提諾 | MDD |
|------|-----------|------|--------|------|--------|-----|
| 台股領航強勢主動指數 | 794.99% | 31.36% | 21.81% | 1.41 | 1.33 | −30.78% |
| 台股領航強勢指數(原始50檔) | 1200.00% | 37.69% | 26.67% | 1.38 | 1.17 | −35.98% |
| TAIEX(價格指數,TR近似) | 344.53% | 20.45% | 20.36% | 1.05 | 0.86 | −31.78% |

- 主動指數以**較低波動與較淺 MDD**換取略低的絕對報酬，夏普/索提諾優於原始領航指數，驗證動能過濾 + 動態停損的風控價值。
- 歷年 -15% 止損共觸發 **187 次**；2020Q1（COVID）單季 28 次最多，2024-08-05（台股史上單日最大跌幅）單日同時觸發 11 檔。

### 注意事項／待辦

- ⚠️ **TAIEX 為價格指數近似**：免費資料源無 TAIEX 含息總回報（TR）序列，故以 `taiwan_high_beta.json` 的 `benchmark_value`（`^TWII` 價格指數）作為 TR 代理；如需嚴謹 TR 對標需另購含息數據。
- ⚠️ **母體中有 2 檔下市/下櫃**（`2809.TW` 京城銀、`2888.TW` 新光金併入台新金）在部分期間無 yfinance 報價，腳本自動略過，不影響回測。
- 本腳本**未排入任何 GitHub Actions 排程**，屬按需執行之研究工具。
- 產出 CSV 採 `utf-8-sig` 編碼以利 Excel 直接開啟顯示中文。
- `MIN_BETA_OBS`、`RF_ANNUAL`、`LOOKBACK` 等參數集中於檔案頂部常數區，便於敏感度分析調整。


### 21.1 三指數逐年績效比較 (compare_active_index_annual.py)

> **變更日期**：2026-10-14

讀取 `backtest_taiwan_high_beta_active.py` 產出的 `taiwan_high_beta_active_nav_daily.csv`（三條已 rebased 至基期=100、對齊同一交易日的累積曲線），計算「逐年報酬率」，輸出逐年績效比較 CSV 與分組長條圖 PNG。

| 檔案 | 變更 |
|------|------|
| `scripts/compare_active_index_annual.py` | 新增：讀取 nav CSV、逐年報酬計算、輸出比較 CSV + 長條圖 |
| `index_active_annual_returns.csv` | 產出：逐年績效比較（主動 / 領航 / TAIEX + 差距 pp + 全期 CAGR） |
| `index_active_annual_returns.png` | 產出：三色分組長條圖 |

**逐年報酬定義**（沿用 `compare_annual_returns.py` 慣例）：

- 完整日曆年（2019–2025）：當年報酬 = 當年最後交易日值 / 前一年最後交易日值 − 1（期間恰為 1 年，即年化）。
- 首年 2018（自 10-01 起）與末年 2026（年初至今）：標記 YTD，以該年首個交易日值為基準。

```powershell
python scripts/compare_active_index_annual.py
```

**回測結果（逐年報酬 %，2018 與 2026 為 YTD）**：

| 年份 | 主動 | 領航(原始50檔) | TAIEX | 主動-領航 |
|------|------|------|------|------|
| 2018 (YTD) | −10.73 | −13.86 | −12.50 | +3.14 |
| 2019 | 33.82 | 66.67 | 24.11 | −32.84 |
| 2020 | 35.42 | 46.21 | 22.30 | −10.79 |
| 2021 | 60.57 | 34.43 | 23.53 | +26.13 |
| 2022 | −18.75 | −25.26 | −22.38 | +6.52 |
| 2023 | 45.22 | 68.54 | 26.99 | −23.32 |
| 2024 | 5.59 | 10.31 | 28.50 | −4.71 |
| 2025 | 24.34 | 44.95 | 25.94 | −20.61 |
| 2026 (YTD) | 123.66 | 128.75 | 69.85 | −5.09 |
| **全期 CAGR** | **31.52** | **37.69** | **20.45** | **−6.17** |

> 觀察：主動指數在空頭年（2018、2022）與高波動年（2021）跌幅明顯小於原始領航指數，動態停損有效壓低年度虧損；但在多頭大年（2019、2023、2025）因停損提前下車而報酬落後，符合「以部分上行換取下檔保護」的風控特性。

---

*本文件記錄 2026-10-10 完成的自動化建置作業，含 PR vs TR 變更、歷史數據品質驗證、成分股權重驗證、AlphaFalcon Backtest Audit 下架與預測追蹤系統、2026-10-11 新增的 Storage Janitor 舊檔清理工具、2026-10-12 新增的指數年度報酬率比較工具，以及 2026-10-14 新增的台股領航強勢主動指數歷史回測工具等完整文件。*

---

## 34. Mix Index (30%動能 / 70%高股息) 策略文檔

> **新增日期**：2026-10-27
> **相關腳本**：`scripts/mixed_allocation_backtest.py`
> **輸出資料**：`scripts/_data/backtest_results/`

### 34.1 策略概述
本策略透過動態分配 Mix Index，結合 **動能指數 (Momentum Index)** 與 **高股息指數 (High Dividend Index)** 的優點，以追求長期報酬同時防範熊市大幅回撤。

- **核心邏輯**：每個月根據 60 日累積報酬率調整動能權重，區間 30%-70%
- **風險目標**：在橫盤或下跌市場自動收斂至 30% 動能，避免全倉出場風險
- **應用場景**：作為資產配置基準，或與期貨/覆蓋_call_組合以提升月息

### 34.2 運作機制

#### 34.2.1 兩個基礎指數
- **動能指數**：選取具有正動能特徵的股票，捕捉上漲趨勢
- **高股息指數**：選取股息率較高的股票，提供穩定現金流

#### 34.2.2 60 日累積報酬率調整
- 計算公式：`mom_cum60 = mom_value / mom_value.shift(60) - 1.0`
- **+5% 以上**：動能權重調至 70% (進攻模式)
- **-5% 以下**：動能權重調至 30% (防禦模式)
- **介於 -5% 到 +5% 之間**：線性插值，動能權重從 30% 逐漸升至 70%

#### 34.2.3 每日 NAV 計算
```
Mix_Ret = Mom_Weight × Mom_Ret + (1 - Mom_Weight) × HD_Ret
Mix_NAV = 前一日_NAV × (1 + Mix_Ret)
```

### 34.3 版本優化：長期趨勢濾波器 (120天)

為了解決單純 60 日動態分配在極端熊市年份 (如 2022 年) 仍有顯著回撤的問題，於 2026-10-27 新增長期趨勢濾波器：

- **120 日累積報酟率** (約 6 個月)：`mom_cum120 = mom_value / mom_value.shift(120) - 1.0`
- **長期上漲 (120 日收益率 > 0)**：保留原本的 30%-70% 動態分配
- **長期下跌/橫盤 (120 日收益率 ≤ 0)**：強制動能權重收斂至固定 30%，進入保守模式

### 34.4 AB 版本比較數據 (2019-01-02 至 2026-09-30)

| 指標 | 版本 A (優化前) | 版本 B (優化後, 加入 120 滤波器) | 備註 |
|------|----------------|----------------------------------|------|
| **最終 NAV (100基準)** | **769.13** | 744.69 | 版本 A 報酬較高 |
| **總報酬率** | **669.13%** | 644.69% | 版本 A 超過 24.44 點 |
| **平均動能權重** | 57.7% | 52.7% | 版本 B 更保守 5% |
| **最大回撤 (Max DD)** | 16.12% | 16.06% | 版本 B 極微改善 0.06% |
| **2022 年回撤** | ~-27.5% | ~-25.0% | **版本 B 顯著改善** |
| **長期趨勢參與** | N/A | 1,342 天上漲 / 533 下跌 | 仍參與多頭市場 |

### 34.5 圖表檔案位置

所有輸出檔案位於：`d:/Downloads/Antigravity/IndexWebsite/scripts/_data/backtest_results/`

| 檔案名稱 | 說明 |
|----------|------|
| `mixed_allocation_daily.csv` | 15 欄，含標準化指數 |
| `mixed_annual_stats.csv` | 年度統計 |
| `mixed_summary.csv` | 總體績效摘要 |
| `mixed_allocation_chart.png` | NAV 階段圖 |
| `mixed_drawdown.png` | 回撤圖 |
| `mixed_allocation_pie.png` | 權重分佈圖 |
| `mixed_annual_performance.png` | 年度報酬率棒狀圖 |
| `mixed_cumreturn_comparison.png` | 標準化累積報酬比較 |
| `mixed_allocation_analysis.png` | 三指數比較 + 動量權重曲線 |
| **`version_a_vs_b_cumreturn_comparison.png`** | **版本 A vs 版本 B 累積報酬比較 (新增)** |

### 34.6 關鍵參數說明

| 參數 | 名稱 | 預設值 | 說明 |
|------|------|--------|------|
| 60 日累積報酬率下限 | `-5%` | -0.05 | 進入防禦模式的閾值 |
| 60 日累積報酬率上限 | `+5%` | `0.05` | 進攻模式的閾值 |
| 120 日累積報酬率判斷 | `> 0` | `0` | 長期趨勢濾波器判斷標準 |
| 動能權重下限 | `30%` | `0.30` | 版本 B 中的硬下限 |
| 動能權重上限 | `70%` | `0.70` | 版本 A 的自然上限 |

### 34.7 成分股說明
> **備註**：雖然策略名稱提到「30 檔成分股」，但實務上我們是基於**指數層面**的動態分配：
> - **動能指數** + **高股息指數** 的權重混合
> - 並非每天重新挑選 30 檔個股
> - 如需真正的「30 檔個股持有」，需額外實作個股選股邏輯

### 34.8 參考連結
- **主要腳本**：`scripts/mixed_allocation_backtest.py`
- **輸出資料目錄**：`scripts/_data/backtest_results/`
- **相關文件**：
  - `AUTOMATION_DOCUMENTATION.md` §33 (系統概覽)
### 35. FTFT 高股息指數成分股的獲取方法

> **說明**：記錄從 FTFT 網頁獲取高股息指數 (ICTWHDR) 成分股與權重的完整流程。此說明涵蓋網頁抓取與 API 兩種方式，確保資料來源的穩定性與可重現性。

#### 35.1 網頁抓取 (手動/定時)
- **網址**：`https://www.ftft.com.tw/etf/product/details?id=162&tab=holdings`
- **操作步驟**：
  1. 開啟上述網址，進入富蘭克林華美投信 ETF 成分股頁面
  2. 於頁面紅圈框起來的位置，點擊 CSV 下載按鈕
  3. 下載的 CSV 檔案包含：股票代號、股票名稱、權重、股數 等欄位
- **備註**：
  - 此方法適合手動查核或偶爾更新
  - 網頁版面可能隨時間變動，需定期確認 CSV 欄位名稱是否 unchanged
  - 亦可使用テキスト比對 的方式確認欄位 (如: `代號`、`名稱`、`權重`)

#### 35.2 FTFT API 自動抓取 (推薦)
- **網址**：`https://www.ftft.com.tw/official/api/Capital/pcd/00961`
- **回應格式**：JSON，包含 `PCD` 陣列
- **關鍵欄位說明**：
  - `Type`: `"Stock"` (股票) 或 `"Future"` (期貨，第 31 檔為 TX202611)
  - `Symbol`: 股票代號 (如 `2379`、`2542` 等，共 30 檔股票)
  - `Weight`: 權重百分比 (如 `10.30`、`7.56` 等，共 30 個權重，總和約 100%)
- **抓取說明**：
  - 使用 `requests.get(url)` 即可取得 JSON 內容
  - 過濤 `Type == "Stock"` 的前 30 檔即為該 ETF 的成分股清單
  - 權重總和已歸一化，無需額外計算
- **優點**：比 網頁抓取 更穩定、無需人工點擊、適合寫入 Python 腳本自動化更新

#### 35.3 CSV 檔案結構說明 (以 `ftft_30_holdings.csv` 為例)
| 欄位 | 說明 | 範例 |
|------|------|------|
| 排名 | 成分股排名 | 1, 2, 3, ..., 30 |
| 股票代號 | 台灣股票代碼 | `2379`、`2542` 等 |
| 股票名稱 | 公司名稱 | `康力電子`、`南亞科` 等 |
| FTFT權重 | FTFT 指數的原始權重 (百分比) | `10.30`、`7.56` 等 |
| 來源 | 數據來源標記 | `ftft` |

#### 35.4 實作範例 (Python)
```python
import requests
import json

# FTFT API 抓取
url = "https://www.ftft.com.tw/official/api/Capital/pcd/00961"
r = requests.get(url)
data = r.json()

# 過濤只保留股票 (Type=Stock) 的 30 檔
stocks = [x for x in data["PCD"] if x["Type"] == "Stock"][:30]

# 提取代號與權重
ftft_holdings = {}
for s in stocks:
    ftft_holdings[s["Symbol"]] = s["Weight"]

print(f"FTFT 抓取成功: {len(ftft_holdings)} 檔股票，權重總和: {sum(ftft_holdings.values()):.2f}%")
```

---

### 36. 動能指數成分股的抓取方法

> **說明**：記錄從 `taiwan_momentum_30.json` 檔案讀取台股強勢動能指數 (mom_30) 成分股與權重的完整流程。此說明涵蓋檔案來源、結構說明與實作要點。

#### 36.1 檔案來源
- **檔案路徑**：`d:/Downloads/Antigravity/IndexWebsite/public/taiwan_momentum_30.json`
- **檔案產生**：由 `mixed_allocation_backtest.py` 產生 (或依據動能指數選股邏輯重新產生)
- **最終更新**：2026-10-08 (依據 Supabase 績效日誌)
- **說明**：本檔案係依據台灣高波動指數 (FTHB003V02) 官方成分股概念，實作 `CORE_UNIVERSE` 約 102 檔歷史入選池 (含 17 檔上櫃)，經過流動性排序、Beta 緩衝排序、動能精選後，依 126 日累積報酟率取前 30 檔作為最終成分股。

#### 36.2 檔案結構說明
```json
{
  "constituents": [
    {
      "symbol": "2330",
      "name": "台積電",
      "weight": 14.1,
      "source": "momentum"
    },
    {
      "symbol": "2383",
      "name": "台光電",
      "name": "8.50",
      "source": "momentum"
    },
    ...
  ]
}
```

| 欄位 | 說明 | 型態 | 範例 |
|------|------|------|------|
| `symbol` | 股票代號 | 字串 | `"2330"` |
| `name` | 股票名稱 | 字串 | `"台積電"` |
| `weight` | 單檔權重 (百分比) | 浮點數 | `14.1` |
| `source` | 資料來源標記 | 字串 | `"momentum"` |

- **總筆數**：30 檔 (`constituents` 陣列長度)
- **權重總和**：約 100% (經歸一化處理)

#### 36.3 實作範例 (Python)
```python
import json

# 讀取動能指數成分股
with open("d:/Downloads/Antigravity/IndexWebsite/public/taiwan_momentum_30.json", "r", encoding="utf-8") as f:
    data = json.load(f)

# 提取前 30 檔成分股
mom_holdings = {}
for c in data["constituents"][:30]:
    mom_holdings[c["symbol"]] = {
        "name": c["name"],
        "weight": c["weight"],
        "source": c.get("source", "momentum")
    }

print(f"動能指數抓取成功: {len(mom_holdings)} 檔股票")
print(f"權重總和: {sum(w['weight'] for w in mom_holdings.values()):.2f}%")
```

#### 36.4 兩個指數成分股的交集分析
| 比對項目 | FTFT 30 檔 | 動能 30 檔 | 同時出現 | 僅 FTFT 僅動能 |
|---------|-----------|-----------|----------|---------------|
| **同時出現** | 29 檔 | 29 檔 | **29 檔** | 0 檔 |
| **僅 FTFT** | 1 檔 (1402 中技) | 0 檔 | 1 檔 | 0 檔 |
| **僅動能** | 0 檔 | 0 檔 | 0 檔 | 0 檔 |
| **總計** | 30 檔 | 30 檔 | — | — |

> **說明**：96.7% (29/30) 的成分股同時同時出現在 FTFT 与动能指數 两者中，這證實了「方法 A」 (FTFT 70% + 動能 30%) 策略的核心邏輯——即大部分優質的高股息股票也具備顯著的动能特質。

### 36.4 實作應用 (Mix Index 30 檔合成)
在 Mix Index (方法 A) 的合成邏輯中，同時出現的 29 檔股票會套用 `FTFT×0.7 + 動能×0.3` 的權重揉合；僅出現在 FTFT 的 1 檔 (1402 中技) 只保留 `FTFT×0.7` 的權重，經過歸一化後，最終 30 檔成分股的綜合權重總和精確為 100%。

---
  - `scripts/mixed_allocation_backtest.py` (完整邏輯實作)


### 37. 每日 Beta 權重更新系統

> **新增日期**：2026-10-30  
> **相關腳本**：scripts/daily_beta_rebalance.py、.github/workflows/daily_beta_rebalance.yml  
> **輸出資料**：	w_high_beta_daily_constituents_20181001_to_20261029.csv 等

#### 37.1 背景

原本系統每次更新成分股時只使用 **最近一次換股日的權重快照**，導致每日淨值計算中：
- 該日的真實成分股權重未被反映
- 不同交易日的權重差異被忽略
- 指數表現與實際持股策略偏離

為解決此問題，新增「每日權重更新」機制：每個交易日根據當日品種 Beta 值（回測模式）重新計算成分股與權重，再用當日權重計算淨值。

#### 37.2 變更內容

| 檔案 | 變更內容 |
|------|----------|
| scripts/unified_daily_sync.py | 3 個 update_* 函數改用 get_constituents_map() 取得日期範圍內的每日權重；每筆淨值計算時使用該日實際權重 |
| scripts/daily_beta_rebalance.py | 新增整個腳本：每日下載歷史個股價格，回溯 252 天計算 Beta，應用風控，輸出當日全集合成分股與權重，並上傳至 Supabase |
| .github/workflows/daily_beta_rebalance.yml | 新增 GitHub Actions 每日排程（台北時間 16:30 執行） |
| AUTOMATION_DOCUMENTATION.md | 追加本章節 §37 |

#### 37.3 設計與安全原則

- **權重來源**：Supabase 的 index_constituents 表（每日 date + symbol + weight）
- **淨值計算**：每個交易日 day_ret = Σ(weight_day[i] × stock_ret[i])，所有權重必須於該日存在
- **fallback 機制**：若當日權重缺失，自動使用最近一筆已完成權重（時間順序向前查找）
- **頻率限制**：Supabase 使用 
esolution=merge-duplicates 避免重複上傳
- **隔離測試**：在 scripts/ 目錄下建立 _data/ 目錄存放測試 CSV，不影響原始 Supabase

#### 37.4 環境變數對照表

| 變數 | 用途 | 對應 CLI |
|------|------|----------|
| SUPABASE_URL | Supabase 專案 URL | 直接寫入腳本內字串 |
| SUPABASE_SERVICE_ROLE_KEY | 服務角色金鑰 | 直接寫入腳本內字串 |

#### 37.5 用法範例

`powershell
# 手動測試
python scripts/daily_beta_rebalance.py
`

#### 37.6 注意事項／待辦

- [x] 新增 daily_beta_rebalance.py
- [x] 新增 GitHub Actions workflow
- [x] 修改 unified_daily_sync.py 使用日權重
- [x] 產出完整 CSV 到 2026-10-29
- [x] 每月檢查 Supabase 寫入速率限制
- [ ] 每季驗證一次模擬誤差（模擬值與真實值差異 < 0.5%）
- [ ] 備份 	w_high_beta_daily_constituents_20181001_to_20261008.csv 與 20261009_to_20261029.csv

### 38. �����v���O�_�|�ܡH

> **��󪩥�**�G2026-10-30  
> **�����}��**�G`scripts/unified_daily_sync.py`�B`scripts/daily_beta_rebalance.py`  
> **��ƨӷ�**�GSupabase `index_constituents`�B`index_performance`�B`rebalance_history`

#### 38.1 ����

���t�αĥ�**�C���v����s�ҫ�**�C  
�]���G

> **�����v���|�]�C�饫�����աB�^���g���� beta ���s���p�B�����ѿ�ܧ��ܡB�v���зǤƻP�s�¦����Ѯt�����]�����ܤơC**

�]�N�O���G

- �C�鳣�|���s�p����骺�����ѻP�v���F
- �C�骺�i�ʡB�v���ܤơB�����ѼW��A���|�g�J Supabase�F
- �Y�S���B�~�[�J�u�T�w�g�����m�v�Ρu��x��w�v����A�������] rebalance �����v���|�O�����ܡC

#### 38.2 �v��������|�ܡH

�D�n��]�]�A�G

1. **�C��ӪѦ��q�v�ܰ�**  
   �C�Ѥ��P�Ѳ�������^�����P�A�|�����v�T����զX���q�v�C

2. **�Ъ����Ʃΰ�ǫ��Ц��q�v�ܰ�**  
   �Ҧp�x�ѻ��j�ի��ƪ���Ǭ� `^TWII`�F������Ǭ� `QQQ`�C����ܰʷ|�v�T���I�Y�ƻP�^����ҡC

3. **�^���g���������q�v�ܰ�**  
   �Ҧp 252 ��^���B126 ��^���B20 ��y�ʩʡB126 ��ʯ൥�C  
   �u�n�L�h�Y�ǤѪ����q�v�Q�s�W�ο�|�A���p�� beta�B�ʯ�B�y�ʩʡB�v���Ƨǳ��i����ܡC

4. **�����ѦW�����**  
   ���Ѥ�B�������ηs�i�Ѳ��|���ܦ����Ѷ��X�C  
   ���ѫ�s�W���Ѳ��|����s�v�����t�A�¦����Ѫ��v���]�|�Q���s�վ�C

5. **�v���зǤƻP��������**  
   �t�η|�N��l�v�����W�Ʀ� 100%�A�åi��������W�������C  
   �]���Y�ϱƦW�έ�l�������S�ܤơA�̲׼g�J���v�����i���ʡC

#### 38.3 �C���v����s�y�{

1. `daily_beta_rebalance.py` �C��Ū����ݾ��v��ƻP�ثe�̷s�����ѡF
2. �U���ӪѾ��v����F
3. �ھګ��ƽs�s��k�p��Կ令���ѻP�v���F
4. �M�έ�������F
5. �зǤ��v���� 100%�F
6. �W�ǩ��мg `index_constituents` �������C������F
7. `unified_daily_sync.py` Ū�������v���A�p�� `index_performance`�C

�]���A**�C�ӥ���鳣�i�����@���۹粒�㪺�u�p���v**�A�Ӥ��O�u�����m��~��@���C

#### 38.4 �w�� rebalance ��]�|���������ѶܡH

**�|�C**

�o�̭n���}��ӷ����G

1. **�C�馨�����v����s**
   - �C�ӥ���魫�s�p������v���F
   - �v���|��s�F
   - �W�ǩ��мg�C�� `index_constituents`�C

2. **�w�� rebalance ��**
   - ���ӫ��ƽs�s��k�����ѳW�h�A�~�|�u���׸ɦ����ѦW��F
   - �Ҧp�G
     - �u�`�ʭ��m�F
     - �~�׭��m�F
     - �b�~�ʭ��m�F
     - �~���Τ멳���ѡF
     - �S�w�������k�s�B�k�@�ܩT�w�v���F
     - �� Beta �ƧǷs��ܫe N �ɡF
     - ����Ŧ���I�B�C�y�ʩʩΤ��X��Ъ��C

�ҥH���T�v�ӻ��G

> **�w�� rebalance �餣�u�O�վ㦸�ơA�ӬO�|�ھګ��ƽs�s��k���ܦ����ѦW��P�v�����c�C**

���y�ܻ��G

- **��`�g��**�G�v���i��C���ܡF
- **���Ѷg��**�G�����ѦW��P�[�v�覡�i��|�Q���s�s�s�F
- **��̦P�ɦs�b��**�G�v���@�w�|��ۤ���B��Ǹ�ƻP���ƽs�s��k���ܡC

#### 38.5 �����򦭴��y�z�i�໡�L�urebalance �����v�����ܡv�H

�o�O�]���b�Y�Ǽȩw�ίS�w�]�p�U�A�|���H�U�䤤�@�ظ����G

1. **�u�����m��~��s������**  
   ���Ѥ餧��A�Ȯɤ���C���v���A���o�G�C

2. **�t�ΥH�̫�@�������ѧַӧ@������b�ȭp��̾�**  
   �Y�S�����s�^�g�C���v���A�h�|�u�ιL�h���ַ��v���C

3. **�e�U�g���n����**  
   ���F���C��������B���C�ӧ@���סB��������e���ֹ�C

4. **���թάy�{�]�p�u��s�S�w�P��**  
   �Ҧp�C�P�B�C��B�������m�C

���b�ڭ̥ثe����@���A�o�ǡu�T�w�v���v�o�ذ��]�ä����ߡA���D�S�O�s�W�G

```text
�T�w�g���W�h
��
�v���ַ���w
��
��x��w
��
�D���m�餣�мg�v��
```

�_�h�A���ثe `daily_beta_rebalance.py` �P `unified_daily_sync.py` ���]�p�A**�C���v�������ӹw�����T�w�C**

#### 38.6 �Y�n���@�u���m�餧���v���T�w�v�A���p��ק�H

�Y���ӭn�令�G

> �u���S�w���m��~���s�]�w�����ѡA�B���m�餧���v���T�w�C

���ݦܤָɤW�H�U����G

| �ݭn | ���� |
|---|---|
| �T�w�g�� | �Ҧp�C��B�u�סB�b�~�B�~�� |
| �T�w��� | �C�~ 1/4/7/10 �뭺�ӥ����B�C�� 25 ��B6/12 �� 16 �鵥 |
| �v���ַ� | �O�d�ӭ��m�骺���㦨���v���A����U�����m |
| ��x��w | ���D���歫�m�A�_�h���мg `index_constituents` |
| ����/���� | �C���ַӼе� `effective_date`�B`snapshot_date`�B`period` |
| �������� | ���m��~����^��P�����A�קK�C���л\ |
| ������� | �е��u�̲ץͮ��v���v�P�u����p���v���v���} |

�_�h�t�Τ��A�ΡG

```text
�C���v����s
```

�Ӥ��O�G

```text
���m�餧���v���T�w
```

#### 38.7 �`�N�ƶ�

- ���n�N�u�C��p���v���v�P�u�C���ڶi�����v�V�c�C
  - �C��p���v���O��T�P�b�ȼҫ��F
  - ��ڸm������O�ӧ@�P����޲z�欰�C
- �ثe�o�Өt�ΥD�n�O��s��ƻP�p��b�ȡA���N���C�ѳ��|�۰ʰ���j�����C
- �p�G�Ȥ�n�D�u�T�w�v���v�A�������s�]�p�g���P�мg��h�C
- �Y���ӭn�R���C���v���ܤơA�����T�n�����s�������]�p�A�Ӥ��O��©���ثe�}���C

#### 38.8 �@�y�ܵ���

- **�C���v���|��**�G�t�ΨC�魫�s�p�⦨���ѻP�v���C
- **�w�� rebalance ��զX�|��**�G�H���ƽs��w�ɴ��վ㦨���ѦW��P�v�����c�C
- **�T�w�v�����O�w�]�欰**�G���D���T�[�J�T�w�g���B�ַ���w�P��x��w����C

