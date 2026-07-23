"""
E-1.1 Student Flow Validation Script
M-2026-07-25-EOS-MINIAPP-END-TO-END-VALIDATION-LONG-RUNNING-V1
Phase 1 Batch 1.1
"""
import requests
import json
import time
import sys

BASE_URL = "http://localhost:3000"
results = []

def log_step(name, api, method, status, response_data, checks=None):
    entry = {
        "step": name,
        "api": f"{method} {api}",
        "http_status": status,
        "response": response_data,
        "checks": checks or []
    }
    results.append(entry)
    print(f"\n{'='*60}")
    print(f"[{name}] {method} {api}")
    print(f"Status: {status}")
    print(f"Response: {json.dumps(response_data, ensure_ascii=False, indent=2)[:500]}")
    if checks:
        for c in checks:
            print(f"  Check: {c['name']} -> {'PASS' if c['pass'] else 'FAIL'}")

def main():
    print("=" * 60)
    print("E-1.1 Student Flow Validation")
    print(f"Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Base URL: {BASE_URL}")
    print("=" * 60)

    # Step 1: Login
    print("\n[Step 1] Login...")
    try:
        r = requests.post(f"{BASE_URL}/api/v1/auth/login",
                         json={"username": "student1", "password": "student123"},
                         timeout=5)
        login_data = r.json()
        if login_data.get("code") == 0 and login_data.get("data", {}).get("accessToken"):
            token = login_data["data"]["accessToken"]
            user_info = login_data["data"]["user"]
            log_step("1-Login", "/api/v1/auth/login", "POST", r.status_code,
                    {"code": login_data["code"], "user": user_info},
                    [{"name": "has accessToken", "pass": True},
                     {"name": "user.name = 李小华", "pass": user_info.get("name") == "李小华"},
                     {"name": "user.role = Student", "pass": user_info.get("role") == "Student"}])
        else:
            log_step("1-Login", "/api/v1/auth/login", "POST", r.status_code, login_data,
                    [{"name": "login success", "pass": False}])
            print("LOGIN FAILED. Cannot continue.")
            sys.exit(1)
    except Exception as e:
        print(f"Login error: {e}")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}

    # Step 2: students/self
    print("\n[Step 2] Student self info...")
    r = requests.get(f"{BASE_URL}/api/v1/students/self", headers=headers, timeout=5)
    data = r.json()
    checks = []
    if data.get("code") == 0 and data.get("data"):
        s = data["data"]
        checks = [
            {"name": "has name", "pass": bool(s.get("name"))},
            {"name": "has studentId", "pass": bool(s.get("studentId"))},
            {"name": "has phone/mobile", "pass": bool(s.get("phone") or s.get("mobile"))},
        ]
    else:
        checks = [{"name": "API returns data", "pass": False}]
    log_step("2-StudentSelf", "/api/v1/students/self", "GET", r.status_code, data, checks)

    # Step 3: courses
    print("\n[Step 3] Courses...")
    r = requests.get(f"{BASE_URL}/api/v1/students/self/courses", headers=headers, timeout=5)
    data = r.json()
    checks = []
    if data.get("code") == 0:
        courses = data.get("data", [])
        checks = [
            {"name": "returns array", "pass": isinstance(courses, list)},
            {"name": "has courses", "pass": len(courses) > 0 if isinstance(courses, list) else False},
        ]
        if isinstance(courses, list) and len(courses) > 0:
            c = courses[0]
            checks.append({"name": "course has name", "pass": bool(c.get("name") or c.get("courseName"))})
    else:
        checks = [{"name": "API exists and returns data", "pass": False}]
    log_step("3-Courses", "/api/v1/students/self/courses", "GET", r.status_code, data, checks)

    # Step 4: classes
    print("\n[Step 4] Classes...")
    r = requests.get(f"{BASE_URL}/api/v1/students/self/classes", headers=headers, timeout=5)
    data = r.json()
    checks = []
    if data.get("code") == 0:
        classes = data.get("data", [])
        checks = [
            {"name": "returns array", "pass": isinstance(classes, list)},
            {"name": "has classes", "pass": len(classes) > 0 if isinstance(classes, list) else False},
        ]
    else:
        checks = [{"name": "API exists and returns data", "pass": False}]
    log_step("4-Classes", "/api/v1/students/self/classes", "GET", r.status_code, data, checks)

    # Step 5: lessons
    print("\n[Step 5] Lessons...")
    r = requests.get(f"{BASE_URL}/api/v1/students/self/lessons", headers=headers, timeout=5)
    data = r.json()
    checks = []
    if data.get("code") == 0:
        lessons = data.get("data", [])
        if isinstance(lessons, dict):
            lessons_list = lessons.get("items", lessons.get("list", lessons.get("records", [])))
        elif isinstance(lessons, list):
            lessons_list = lessons
        else:
            lessons_list = []
        checks = [
            {"name": "returns data", "pass": True},
            {"name": "has lessons", "pass": len(lessons_list) > 0},
        ]
    else:
        checks = [{"name": "API exists and returns data", "pass": False}]
    log_step("5-Lessons", "/api/v1/students/self/lessons", "GET", r.status_code, data, checks)

    # Step 6: attendance
    print("\n[Step 6] Attendance...")
    r = requests.get(f"{BASE_URL}/api/v1/students/self/attendance", headers=headers, timeout=5)
    data = r.json()
    checks = []
    if data.get("code") == 0:
        attendance = data.get("data", [])
        checks = [{"name": "returns data", "pass": True}]
        if isinstance(attendance, list):
            checks.append({"name": "has records", "pass": len(attendance) > 0})
        elif isinstance(attendance, dict):
            items = attendance.get("items", attendance.get("list", attendance.get("records", [])))
            checks.append({"name": "has records", "pass": len(items) > 0})
    else:
        checks = [{"name": "API exists and returns data", "pass": False}]
    log_step("6-Attendance", "/api/v1/students/self/attendance", "GET", r.status_code, data, checks)

    # Step 7: contracts (personal center)
    print("\n[Step 7] Contracts...")
    r = requests.get(f"{BASE_URL}/api/v1/students/self/contracts", headers=headers, timeout=5)
    data = r.json()
    checks = []
    if data.get("code") == 0:
        checks = [{"name": "returns data", "pass": True}]
    else:
        checks = [{"name": "API exists and returns data", "pass": False}]
    log_step("7-Contracts", "/api/v1/students/self/contracts", "GET", r.status_code, data, checks)

    # Step 8: reminders
    print("\n[Step 8] Reminders...")
    r = requests.get(f"{BASE_URL}/api/v1/reminders", headers=headers, timeout=5)
    data = r.json()
    checks = []
    if data.get("code") == 0:
        reminders = data.get("data", [])
        checks = [{"name": "returns data", "pass": True}]
        if isinstance(reminders, list):
            checks.append({"name": "has reminders", "pass": len(reminders) > 0})
        elif isinstance(reminders, dict):
            items = reminders.get("items", reminders.get("list", reminders.get("records", [])))
            checks.append({"name": "has reminders", "pass": len(items) > 0})
    else:
        checks = [{"name": "API exists and returns data", "pass": False}]
    log_step("8-Reminders", "/api/v1/reminders", "GET", r.status_code, data, checks)

    # Summary
    print("\n" + "=" * 60)
    print("VALIDATION SUMMARY")
    print("=" * 60)
    total = len(results)
    passed = sum(1 for r in results if all(c["pass"] for c in r.get("checks", [])))
    failed = total - passed
    print(f"Total Steps: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    
    issues = []
    for r in results:
        for c in r.get("checks", []):
            if not c["pass"]:
                issues.append(f"{r['step']}: {c['name']}")
    
    if issues:
        print(f"\nFailed Checks:")
        for i in issues:
            print(f"  - {i}")
    
    # Save full results
    with open("validation_results.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\nFull results saved to validation_results.json")

if __name__ == "__main__":
    main()
