import asyncio
import httpx
import json

BASE_URL = "http://localhost:8000/api/ai"
# We need to get a valid token or bypass auth for testing. 
# Looking at the code, it uses get_current_user. 
# We might need to login first. Let's write a script that logs in and tests endpoints.

async def test_endpoints():
    async with httpx.AsyncClient() as client:
        # Test Ollama directly to see if it's responding
        print("Testing Ollama directly...")
        try:
            resp = await client.post("http://localhost:11434/api/chat", json={
                "model": "phi3:mini",
                "messages": [{"role": "user", "content": "Hello"}],
                "stream": False
            })
            print("Ollama direct response status:", resp.status_code)
            print(resp.json())
        except Exception as e:
            print("Ollama direct test failed:", e)

if __name__ == "__main__":
    asyncio.run(test_endpoints())
