#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""封存舊 backtest section 結尾：補上 fragment + false 閉合"""
import io

P = r"D:\Downloads\Antigravity\IndexWebsite\app\alphafalcon\page.tsx"
raw = io.open(P, encoding="utf-8", newline="").read()
t = raw.replace("\r\n", "\n")

i = t.find("+363.7%")
j = t.find("</section>", i)
print("CTX=", repr(t[j:j+60]))
old = t[j:j + len("</section>\n        )}")]
new_tail = "</section>\n        )}\n        </>\n        )}"
t = t[:j] + new_tail + t[j + len(old):]
out = t.replace("\n", "\r\n")
io.open(P, "w", encoding="utf-8", newline="").write(out)
print("OK tail closed")
