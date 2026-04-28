import requests

session = requests.Session()
login_url = "https://strategy-center-admin.fbwinner.app/api/login" # Guessing URL, or we should just try to post to the main page if it's standard laravel/django
response = session.get("https://strategy-center-admin.fbwinner.app/")
print("Initial GET status:", response.status_code)
# Try to find a form or CSRF token
from bs4 import BeautifulSoup
soup = BeautifulSoup(response.text, 'html.parser')
form = soup.find('form')
if form:
    print("Found form with action:", form.get('action'))
    inputs = form.find_all('input')
    for inp in inputs:
        print("Input:", inp.get('name'), inp.get('type'), inp.get('value'))
else:
    print("No form found. Might be a SPA.")

