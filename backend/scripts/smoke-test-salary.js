/**
 * 工资模块 + 改密 + 前端 冒烟测试（部署后主动找 BUG 用）
 *
 * 用法：
 *   BASE_URL=https://edu.257758.xyz/api/v1 \
 *   SITE_URL=https://edu.257758.xyz/admin/ \
 *   USERNAME=admin PASSWORD=Admin@2026 \
 *   node scripts/smoke-test-salary.js
 *
 * 退出码：0 = 全部通过；1 = 存在失败项
 */
const https = require('https');

const BASE = process.env.BASE_URL || 'https://edu.257758.xyz/api/v1';
const SITE = process.env.SITE_URL || 'https://edu.257758.xyz/admin/';
const USERNAME = process.env.USERNAME || 'admin';
const PASSWORD = process.env.PASSWORD || 'Admin@2026';

function request(method, url, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body === undefined ? null : JSON.stringify(body);
    const req = https.request(
      {
        method,
        hostname: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

let failures = 0;
function check(name, ok, detail) {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  [' + detail + ']' : ''}`);
}

async function api(method, path, { token, body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  return request(method, BASE + path, { headers, body });
}

async function main() {
  // 1) 登录
  const login = await api('POST', '/auth/login', {
    body: { username: USERNAME, password: PASSWORD, device: 'smoke-test' },
  });
  let token = null;
  try {
    const d = JSON.parse(login.body);
    if (login.status < 300 && d.code === 0) token = d.data.accessToken;
  } catch {
    /* 非 JSON */
  }
  check('登录获取 token', !!token, login.status + ' ' + login.body.slice(0, 120));
  if (!token) process.exit(1);

  // 2) 工资模块查询端点（含 activeOnly，回归 BUG1）
  const endpoints = [
    ['/salary/tax-policy?activeOnly=true', '个税政策 activeOnly=true'],
    ['/salary/tax-policy?activeOnly=false', '个税政策 activeOnly=false'],
    ['/salary/insurance-policy?activeOnly=true', '五险一金 activeOnly=true'],
    ['/salary/insurance-policy?activeOnly=false', '五险一金 activeOnly=false'],
    ['/salary/slips?month=2099-01', '工资条查询'],
    ['/salary/payroll', '发放批次查询'],
    ['/salary/insurance-policy/cities', '可用城市列表'],
  ];
  for (const [p, name] of endpoints) {
    const res = await api('GET', p, { token });
    let ok = res.status < 300;
    let detail = 'HTTP ' + res.status;
    try {
      const d = JSON.parse(res.body);
      ok = ok && d.code === 0;
      detail += ' code=' + d.code;
    } catch {
      ok = false;
      detail += ' 非JSON';
    }
    check(name, ok, detail);
  }

  // 3) 业务 400 具体消息透出（回归 BUG2）
  const badImport = await api('POST', '/salary/insurance-policy/import', {
    token,
    body: { city: '不存在市' },
  });
  check(
    '导入不存在城市提示具体原因',
    badImport.status === 400 && badImport.body.includes('内置种子库无'),
    badImport.status + ' ' + badImport.body.slice(0, 100),
  );

  const badPayroll = await api('POST', '/salary/payroll', {
    token,
    body: { month: '2099-01' },
  });
  check(
    '发放批次无数据提示具体原因',
    badPayroll.status === 400 && badPayroll.body.includes('无待发放工资条'),
    badPayroll.status + ' ' + badPayroll.body.slice(0, 100),
  );

  // 4) 改密：错误旧密码 → 401 原密码错误（不真正改密）
  const chpwd = await api('POST', '/auth/change-password', {
    token,
    body: { oldPassword: 'WrongPass123', newPassword: 'NewPass@2026' },
  });
  check(
    '改密错误旧密码提示',
    chpwd.status === 401 && chpwd.body.includes('原密码错误'),
    chpwd.status + ' ' + chpwd.body.slice(0, 100),
  );

  // 5) 前端页面
  const fe = await request('GET', SITE, {});
  check('前端 /admin/ 可访问', fe.status === 200, 'HTTP ' + fe.status + ' ' + fe.body.slice(0, 40));

  console.log(
    failures === 0
      ? '\n全部通过'
      : `\n${failures} 项失败，见上方 FAIL`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
