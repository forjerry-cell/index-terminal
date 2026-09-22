import requests
import collections

url = 'https://nnoazshcucwjlccjqtkl.supabase.co/rest/v1/index_constituents?index_id=eq.nasdaq_high_beta&order=date.desc,weight.desc&limit=200'
headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ub2F6c2hjdWN3amxjY2pxdGtsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MDgzNzYsImV4cCI6MjA5MjI4NDM3Nn0.FE-onwhqZNBWWdUBoqD1lR-n5So9PbQ9BvjB9pWCz6g'
}
r = requests.get(url, headers=headers)
data = r.json()

print(f"Total rows fetched: {len(data)}")
if data:
    latest_date = data[0]['date']
    print(f"Latest Date: {latest_date}")
    
    # Filter constituents on latest_date
    constituents = [c for c in data if c['date'] == latest_date]
    print(f"Number of constituents on {latest_date}: {len(constituents)}")
    
    for idx, c in enumerate(constituents):
        print(f"{idx+1}. {c['symbol']} ({c['name']}) - {c['weight']}%")
    
    symbols = [c['symbol'] for c in constituents]
    duplicates = [item for item, count in collections.Counter(symbols).items() if count > 1]
    print(f"Duplicates: {duplicates}")
