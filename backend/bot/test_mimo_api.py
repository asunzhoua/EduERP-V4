import requests, json

# Get fresh token
r = requests.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', json={'app_id':'your-feishu-app-id','app_secret':'your-feishu-app-secret'}, timeout=10)
t = r.json().get('tenant_access_token')
headers = {'Authorization': 'Bearer ' + t}

# 1. Get bot info
r = requests.get('https://open.feishu.cn/open-apis/bot/v3/info', headers=headers, timeout=10)
print('=== Bot Info ===')
d = r.json()
print(json.dumps(d, ensure_ascii=False, indent=2)[:500])

# 2. Check if bot can access the group
r = requests.get('https://open.feishu.cn/open-apis/im/v1/chats/oc_6e919481fd56e839c5c8e9d1ba71b25b', headers=headers, timeout=10)
print('\n=== Group Access ===')
d = r.json()
print('code:', d.get('code'), 'msg:', d.get('msg'))

# 3. Get group members
r = requests.get('https://open.feishu.cn/open-apis/im/v1/chats/oc_6e919481fd56e839c5c8e9d1ba71b25b/members?page_size=50', headers=headers, timeout=10)
print('\n=== Group Members ===')
d = r.json()
print('code:', d.get('code'))
if d.get('code') == 0:
    items = d.get('data', {}).get('items', [])
    for m in items:
        print(f"  {m.get('member_id_type')} = {m.get('member_id')} name={m.get('name')} type={m.get('member_type')}")
else:
    print('error:', d.get('msg'))
