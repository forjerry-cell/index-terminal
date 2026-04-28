import requests
import re

js_files = [
    "/_next/static/chunks/main-c878e1b6f0e4b857.js",
    "/_next/static/chunks/pages/_app-c57d7cf251783cfd.js",
    "/_next/static/chunks/5803-a93ea497992457f5.js",
    "/_next/static/chunks/2131-122fff0cb81df923.js"
]

for js in js_files:
    js_url = "https://strategy-center-admin.fbwinner.app" + js
    js_resp = requests.get(js_url)
    endpoints = re.findall(r'[\'"`](/api/[^\'"`]+)[\'"`]', js_resp.text)
    login_apis = [e for e in endpoints if 'login' in e or 'auth' in e]
    if login_apis:
        print("Login APIs in", js, ":", login_apis)
