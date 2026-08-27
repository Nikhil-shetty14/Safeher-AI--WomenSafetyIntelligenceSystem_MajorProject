import sys
import os

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from fastapi.testclient import TestClient
from app.main import app
import time

def test_register_flow():
    with TestClient(app) as client:
        register_data = {
            "name": "Test User",
            "password": "testpassword",
            "phone": f"+919{int(time.time()) % 100000000}"
        }
        print("Testing /api/auth/register...")
        res = client.post("/api/auth/register", json=register_data)
        print("Register Response:", res.status_code, res.text)
        
        if res.status_code != 200:
            print("Registration failed")
            return
        
        session_id = res.json()["session_id"]
        
        verify_data = {
            "session_id": session_id,
            "code": "123456"
        }
        print("Testing /api/auth/verify-otp...")
        res2 = client.post("/api/auth/verify-otp", json=verify_data)
        print("Verify OTP Response:", res2.status_code, res2.text)

if __name__ == "__main__":
    test_register_flow()
