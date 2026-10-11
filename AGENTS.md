<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Documentation Convention（文件紀錄規範）

> **每次新增或修改 `scripts/` 下的自動化腳本時，必須同步在 `AUTOMATION_DOCUMENTATION.md` 追加或更新對應章節。**
> 這是為了讓未來的開發者或其他 AI agent 能藉由該文件快速掌握每個腳本的用途、設計、安全性與待辦事項，而不必重新追溯程式碼。

**紀錄要點：**

1. **放在哪裡**：在 `AUTOMATION_DOCUMENTATION.md` 結尾追加一節新的章節（編號延續，如 `## 19. ...`），並更新文末的摘要句。
2. **章節應包含**：
   - 背景（為何需要這個腳本）
   - 變更內容（以「檔案 | 變更」表格列出）
   - 設計與安全原則（例如 dry-run 預設、權限需求、批次上限等）
   - 環境變數對照表（變數 | 用途 | 對應 CLI 參數）
   - 用法範例
   - 注意事項／待辦（例如失效的 key、未排入排程等）
3. **交叉參照**：在相關的程式碼（`.tsx`、其他 `.py`）內用註解標註「原因見 `AUTOMATION_DOCUMENTATION.md`」，與文件互相連結。
4. **語言**：文件內文以繁體中文為主，程式碼/路徑/指令保持原文。

**既有紀錄位置一覽：**

- `AUTOMATION_DOCUMENTATION.md` —— 自動化與腳本的權威文件（每次腳本變更都要更新這裡）。
- Git commit message —— 使用 Conventional Commits（如 `feat(scripts):`、`docs(automation):`），清楚描述變更。
- 程式碼內 docstring／註解 —— 腳本頂部寫中文 docstring 說明用途與用法。

