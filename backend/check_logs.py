import asyncio
from app.core.database import get_collection, connect_db

async def check_logs():
    await connect_db()
    
    # Get latest alert
    alerts_col = get_collection("alerts")
    latest_alert = await alerts_col.find().sort("created_at", -1).limit(1).to_list(1)
    
    if not latest_alert:
        print("No alerts found.")
        return
        
    alert = latest_alert[0]
    print(f"DEBUG: Latest Alert ID: {alert['_id']} for user {alert['user_id']}")
    print(f"DEBUG: Created at: {alert['created_at']}")
    
    # Check SMS logs
    sms_col = get_collection("sms_logs")
    sms_logs = await sms_col.find({"user_id": alert["user_id"]}).sort("timestamp", -1).to_list(10)
    print(f"\n--- SMS Logs (last 10 for user) ---")
    for log in sms_logs:
        print(f"To: {log['to_number']} | Status: {log['status']} | SID: {log['sid']}")
        if log.get('error'):
            print(f"  Error: {log['error']}")
            
    # Check Call logs
    call_col = get_collection("call_logs")
    call_logs = await call_col.find({"user_id": alert["user_id"]}).sort("timestamp", -1).to_list(10)
    print(f"\n--- Call Logs (last 10 for user) ---")
    for log in call_logs:
        print(f"To: {log['to_number']} | Status: {log['status']} | SID: {log['sid']}")
        if log.get('error'):
            print(f"  Error: {log['error']}")

if __name__ == "__main__":
    asyncio.run(check_logs())
