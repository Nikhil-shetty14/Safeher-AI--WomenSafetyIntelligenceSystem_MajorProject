import sys
import os

# Add backend directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

from app.main import app
from app.ai.llm_engine import generate_rule_based_chat_response, evaluate_keyword_and_acoustic_threat
from fastapi.routing import APIRoute

def verify_endpoints():
    print("=" * 60)
    print("VERIFYING SAFEHER AI BACKEND APIS & ROUTES")
    print("=" * 60)

    # 1. Collect all mounted routes
    mounted_routes = []
    for route in app.routes:
        if isinstance(route, APIRoute):
            for method in route.methods:
                mounted_routes.append((method, route.path))

    print(f"Total FastAPI endpoints mounted: {len(mounted_routes)}")
    
    # 2. Key API endpoints expected by Frontend App and Admin Dashboard
    expected_endpoints = [
        # Auth
        ("POST", "/api/auth/register"),
        ("POST", "/api/auth/login"),
        ("POST", "/api/auth/verify-otp"),
        ("POST", "/api/auth/resend-otp"),
        ("POST", "/api/auth/forgot-password"),
        ("POST", "/api/auth/reset-password"),
        ("GET", "/api/auth/me"),
        ("PUT", "/api/auth/me"),
        ("POST", "/api/auth/logout"),
        # SOS
        ("POST", "/api/sos/trigger"),
        ("POST", "/api/sos/trigger-voice"),
        ("POST", "/api/sos/upload-evidence"),
        ("GET", "/api/sos/my-alerts"),
        ("PATCH", "/api/sos/{alert_id}/resolve"),
        ("PATCH", "/api/sos/{alert_id}/acknowledge"),
        # Contacts
        ("GET", "/api/contacts"),
        ("POST", "/api/contacts"),
        ("PUT", "/api/contacts/{contact_id}"),
        ("DELETE", "/api/contacts/{contact_id}"),
        # AI
        ("POST", "/api/ai/analyze-text"),
        ("POST", "/api/ai/analyze-voice"),
        ("POST", "/api/ai/chat"),
        ("GET", "/api/ai/area-risk"),
        ("GET", "/api/ai/nearby-services"),
        ("GET", "/api/ai/predictions/history"),
        ("POST", "/api/ai/predict-route-safety"),
        ("POST", "/api/ai/predictive-guardian"),
        ("GET", "/api/ai/dashboard-stats"),
        # Location
        ("POST", "/api/location/update"),
        ("POST", "/api/location/sos-live"),
        ("GET", "/api/location/heatmap"),
        ("GET", "/api/location/history"),
        # Profile
        ("GET", "/api/profile/me"),
        ("PUT", "/api/profile/update"),
        ("PUT", "/api/profile/preferences/safety"),
        ("PUT", "/api/profile/preferences/notifications"),
        ("PUT", "/api/profile/preferences/security"),
        ("POST", "/api/profile/upload-photo"),
        ("GET", "/api/profile/history/summary"),
        # Complaints
        ("POST", "/api/complaints/submit"),
        ("GET", "/api/complaints/my-complaints"),
        ("GET", "/api/complaints/admin/all"),
        # Broadcasts
        ("GET", "/api/broadcast/active"),
        ("GET", "/api/broadcast/my-notifications"),
        ("POST", "/api/broadcast/{broadcast_id}/read"),
        # Admin
        ("POST", "/api/admin/login"),
        ("GET", "/api/admin/me"),
        ("GET", "/api/admin/stats"),
        ("GET", "/api/admin/live-users"),
        ("GET", "/api/admin/alerts/active"),
        ("GET", "/api/admin/alerts/recent"),
        ("GET", "/api/admin/alerts/unacknowledged-count"),
        ("GET", "/api/admin/alerts/unacknowledged"),
        ("PATCH", "/api/admin/alerts/{alert_id}/acknowledge"),
        ("GET", "/api/admin/alerts/heatmap"),
        ("GET", "/api/admin/analytics/danger-trends"),
        ("GET", "/api/admin/users"),
    ]

    all_passed = True
    for method, path in expected_endpoints:
        if (method, path) in mounted_routes:
            print(f"  [OK] {method:<6} {path}")
        else:
            print(f"  [FAIL] Missing endpoint: {method} {path}")
            all_passed = False

    # 3. Test AI Chat Safety Engine Fallback
    print("\n" + "=" * 60)
    print("TESTING AI CHAT SAFETY FALLBACK ENGINE")
    print("=" * 60)
    test_queries = [
        ("I think someone is following me", True, "critical"),
        ("Where is the nearest police station?", False, "safe"),
        ("What are some tips for traveling alone at night?", False, "safe"),
        ("How does stealth mode work?", False, "safe"),
        ("Hello, who are you?", False, "safe"),
        ("Is it safe to walk through this area?", False, "safe"),
    ]

    for q, expect_danger, expect_lvl in test_queries:
        res = generate_rule_based_chat_response(q)
        print(f"\nQuery: '{q}'")
        print(f"  Danger Detected: {res['danger_detected']} (expected: {expect_danger})")
        print(f"  Danger Level:    {res['danger_level']} (expected: {expect_lvl})")
        print(f"  Suggested Action:{res.get('suggested_action')}")
        print(f"  Reply snippet:   {res['reply'][:90]}...")
        assert res['reply'], "Reply must not be empty"
        assert res['danger_detected'] == expect_danger, f"Danger detection mismatch for '{q}'"

    # 4. Test Acoustic & Threat Analyzer
    print("\n" + "=" * 60)
    print("TESTING ACOUSTIC & KEYWORD THREAT EVALUATOR")
    print("=" * 60)
    eval_res = evaluate_keyword_and_acoustic_threat(
        "help me someone please stop",
        {"stress_score": 0.85, "detected_emotion": "fear"},
        {"latitude": 12.9716, "longitude": 77.5946}
    )
    print(f"Transcript: 'help me someone please stop'")
    print(f"  Danger Level: {eval_res.get('danger_level')}")
    print(f"  Risk Score:   {eval_res.get('risk_score')}")
    print(f"  Tactical Summary: {eval_res.get('ai_tactical_summary')}")
    assert eval_res.get('danger_level') in ['HIGH', 'CRITICAL']

    if all_passed:
        print("\n" + "=" * 60)
        print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY!")
        print("=" * 60)
    else:
        sys.exit(1)

if __name__ == "__main__":
    verify_endpoints()
