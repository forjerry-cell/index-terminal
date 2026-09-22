$ErrorActionPreference='SilentlyContinue'
$root='D:\Downloads\Antigravity\IndexWebsite'
$s='D:\Downloads\Antigravity\IndexWebsite\scratch'
'CWD='+(Get-Location).Path | Out-File "$s\_p_cwd.txt" -Encoding utf8
'BRANCH='+(git -C $root rev-parse --abbrev-ref HEAD) | Out-File "$s\_p_branch.txt" -Encoding utf8
'STATUS:' | Out-File "$s\_p_status.txt" -Encoding utf8
git -C $root status --short | Out-File "$s\_p_status.txt" -Append -Encoding utf8
Get-ChildItem $root -Force | Select-Object Name,PSIsContainer | Out-File "$s\_p_root.txt" -Encoding utf8
Get-ChildItem "$root\app\api" -Recurse -File | Select-Object FullName | Out-File "$s\_p_api.txt" -Encoding utf8
'DONE'
