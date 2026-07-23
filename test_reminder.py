import requests, json

BASE = 'http://localhost:3000'

# Login
r = requests.post(f'{BASE}/api/v1/auth/login', json={'username':'student1','password':'student123'})
token = r.json()['data']['accessToken']
headers = {'Authorization': f'Bearer {token}'}

# Test reminders
r2 = requests.get(f'{BASE}/api/v1/reminders', headers=headers)
print('Reminders status:', r2.status_code)
print('Reminders response:', json.dumps(r2.json(), ensure_ascii=False, indent=2)[:1000])

# Test unread count
r3 = requests.get(f'{BASE}/api/v1/reminders/unread-count', headers=headers)
print('\nUnread count status:', r3.status_code)
print('Unread count response:', json.dumps(r3.json(), ensure_ascii=False, indent=2))
