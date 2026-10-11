import io
P = r"D:\Downloads\Antigravity\IndexWebsite\Index\AlphaFalcon\alphafalcon_cloud_scanner.py"
t = io.open(P, encoding="utf-8").read()
start = "    # ── 新增：本地保存為靜態 JSON 檔案 (供 Jamstack 高可用性架構優先讀取) ──"
end = "    # 下方區塊為歷史留存，僅用於靜態JSON輸出，請勿刪除"
i = t.find(start)
j = t.find(end)
seg = t[j+1:].lstrip("\n")
print("seg:", repr(seg[:100]))
print(seg)