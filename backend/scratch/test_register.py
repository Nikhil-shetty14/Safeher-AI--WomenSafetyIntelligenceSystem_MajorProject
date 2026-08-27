import requests

url = "http://localhost:8000/api/auth/register"
data = {
    "name": "Test User",
    "phone": "9876543210",
    "password": "password123"
}

response = requests.post(url, json=data)
print(response.status_code)
print(response.text)
