import requests
import time

print("Waiting 90s for Vercel to deploy...")
time.sleep(90)

r = requests.post(
    'https://index-terminal.vercel.app/api/send-report',
    headers={'Content-Type': 'application/json'},
    json={}
)
print('Status:', r.status_code)
print('Response:', r.text)
