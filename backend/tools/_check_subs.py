import urllib.request, json, ssl
ssl._create_default_https_context = ssl._create_unverified_context

APP_ID = 'your-feishu-app-id'
APP_SECRET = 'your-feishu-app-secret'

# Get token
req = urllib.request.Request(
    'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
    json.dumps({'app_id': APP_ID, 'app_secret': APP_SECRET}).encode(),
    {'Content-Type': 'application/json'}
)
resp = json.loads(urllib.request.urlopen(req).read())
token = resp.get('tenant_access_token', '')
print('TOKEN:' + token[:15])

# List subscriptions
try:
    req2 = urllib.request.Request('https://open.feishu.cn/open-apis/event/v1/subscription', headers={'Authorization': 'Bearer ' + token})
    resp2 = urllib.request.urlopen(req2).read()
    print('SUBS:' + resp2.decode()[:1000])
except Exception as e:
    print('ERR_SUBS:' + str(e))
    if hasattr(e, 'read'):
        print('BODY:' + e.read().decode()[:500])
