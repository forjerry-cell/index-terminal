import os
from supabase import create_client
import pandas as pd

URL = os.environ.get("SUPABASE_URL")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

def check_db():
    supabase = create_client(URL, KEY)
    
    print("--- Taiwan Index Last Dates ---")
    res = supabase.table("index_performance").select("date").eq("index_id", "taiwan_high_beta").order("date", desc=True).limit(5).execute()
    print(pd.DataFrame(res.data))
    
    print("\n--- Nasdaq Index Last Dates ---")
    res = supabase.table("index_performance").select("date").eq("index_id", "nasdaq_high_beta").order("date", desc=True).limit(5).execute()
    print(pd.DataFrame(res.data))

if __name__ == "__main__":
    if not URL or not KEY:
        print("Missing URL/KEY")
    else:
        check_db()
