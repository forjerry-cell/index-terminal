/**
 * 將資料陣列下載為 UTF-8 (含 BOM) CSV 檔案（純前端，不需後端）
 * 加上 UTF-8 BOM (\uFEFF) 可確保 Windows Excel 直接開啟含中文欄位與名稱時不會出現亂碼
 * @param data 資料陣列
 * @param columns 欄位定義 [{ key, header }]
 * @param filename 下載檔名
 */
export function downloadCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string }[],
  filename: string
): void {
  if (!data || data.length === 0) return;

  const escapeCell = (value: unknown): string => {
    const str = String(value == null ? '' : value);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const header = columns.map((c) => escapeCell(c.header)).join(',');
  const rows = data
    .map((row) => columns.map((c) => escapeCell(row[c.key])).join(','))
    .join('\r\n');

  const csv = `\uFEFF${header}\r\n${rows}`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
