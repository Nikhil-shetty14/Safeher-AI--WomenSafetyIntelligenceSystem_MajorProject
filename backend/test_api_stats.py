import requests
import os
from dotenv import load_dotenv

def test_admin_stats():
    load_dotenv()
    base_url = "http://10.126.101.100:8000"
    
    print(f"Logging in...")
    login_res = requests.post(
        f"{base_url}/api/auth/login",
        json={"email": "admin@safeher.ai", "password": "admin123"}
    )
    
    if login_res.status_code != 200:
        print(f"Login failed: {login_res.status_code} - {login_res.text}")
        return

    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get stats
    print("Fetching stats...")
    stats_res = requests.get(f"{base_url}/api/admin/stats", headers=headers)
    print(f"Stats Status: {stats_res.status_code}")
    
    # 3. Get recent alerts
    print("Fetching recent alerts...")
    alerts_res = requests.get(f"{base_url}/api/admin/alerts/recent?limit=5", headers=headers)
    print(f"Alerts Status: {alerts_res.status_code}")
    print(f"Alerts Response: {alerts_res.text}")

if __name__ == "__main__":
    test_admin_stats()
