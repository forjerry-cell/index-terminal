from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        def handle_response(response):
            if "api" in response.url:
                print(f"API CALL: {response.url} - Status: {response.status}")
                if response.status == 200 and "application/json" in response.headers.get("content-type", ""):
                    try:
                        print("BODY:", response.json())
                    except:
                        pass

        page.on("response", handle_response)
        
        print("Navigating to strategy center...")
        page.goto("https://strategy-center-admin.fbwinner.app/")
        time.sleep(2)
        
        print("Filling login form...")
        # Try to find common login fields
        page.fill('input[type="text"]', "fubon_jerry")
        page.fill('input[type="password"]', "Qwer1234")
        
        print("Clicking submit...")
        page.click('button[type="submit"], button:has-text("Login"), button:has-text("登入")')
        
        time.sleep(5)
        browser.close()

if __name__ == "__main__":
    run()
