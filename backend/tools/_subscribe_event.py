import urllib.request
import json
import ssl

ssl._create_default_https_context = ssl._create_unverified_context

APP_ID = 'your-feishu-app-id'
APP_SECRET = 'your-feishu-app-secret'

# 1. Get tenant_access_token
req1 = urllib.request.Request(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    json.dumps({'app_id': APP_ID, 'app_secret': APP_SECRET}).encode(),
    {'Content-Type': 'application/json'}
)
resp1 = json.loads(urllib.request.urlopen(req1).read())
token = resp1.get('tenant_access_token', '')
if not token:
    print(f"Token error: {resp1}")
    exit(1)
print(f"Token: {token[:15]}...")

# 2. List currently subscribed events first
req_list = urllib.request.Request(
    'https://open.feishu.cn/open-apis/event/v1/events/im.message.receive_v1/app/subscription',
    headers={'Authorization': f'Bearer {token}'}
)
try:
    resp_list = json.loads(urllib.request.urlopen(req_list).read())
    print(f"Current subscription: {json.dumps(resp_list, indent=2, ensure_ascii=False)[:500]}")
except Exception as e:
    print(f"List error (may be normal): {e}")

# 3. Subscribe to im.message.receive_v1
req2 = urllib.request.Request(
    'https://open.feishu.cn/open-apis/event/v1/events/im.message.receive_v1/subscribe',
    data=b'',
    method='POST',
    headers={'Authorization': f'Bearer {token}'}
)
try:
    resp2 = json.loads(urllib.request.urlopen(req2).read())
    print(f"\nSubscribe response: {json.dumps(resp2, indent=2, ensure_ascii=False)[:1000]}")
except Exception as e:
    print(f"Subscribe error: {e}")
    # Try reading the error body
    if hasattr(e, 'read'):
        print(f"Error body: {e.read().decode()[:500]}")
