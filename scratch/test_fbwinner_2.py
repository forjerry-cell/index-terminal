import requests
import re

response = requests.get("https://strategy-center-admin.fbwinner.app/")
print("HTML:", response.text[:1000])

js_files = re.findall(r'src="([^"]+\.js)"', response.text)
for js in js_files:
    print("Found JS:", js)
    if not js.startswith('http'):
        js_url = "https://strategy-center-admin.fbwinner.app" + js
    else:
        js_url = js
    
    js_resp = requests.get(js_url)
    api_urls = re.findall(r'(https?://[^\s"\'\`]+api[^\s"\'\`]+)', js_resp.text)
    api_endpoints = re.findall(r'[\'"`](/api/[^\'"`]+)[\'"`]', js_resp.text)
    print("APIs found in", js, ":", list(set(api_urls + api_endpoints))[:20])

