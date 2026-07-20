# 飞书初始化工具文档

> **源文件:** `backend/tools/feishu_bootstrap.py`
> **功能:** 自动创建飞书知识库空间、文件夹结构、Mission Board（多维表格）等资源

---

## 1. 前置条件

### 1.1 飞书开发者后台创建应用

1. 访问 [飞书开放平台](https://open.feishu.cn/app) 并登录。
2. 点击「创建应用」，填写应用名称与描述。
3. 创建成功后获取 **App ID** 与 **App Secret**。

### 1.2 获取 App ID / App Secret

在应用详情页的「凭证与基础信息」中查看：

- **App ID:** `cli_xxxxxxxxxxxxxxxx`
- **App Secret:** 点击「显示」获取

### 1.3 配置 API 权限

在「权限管理」中添加所需 API 权限（参见[第 2 节](#2-权限检查清单)），并通过管理员权限审批。

---

## 2. 权限检查清单

> **注意：** 以下权限以飞书开放平台实际列表为准，请在应用「权限管理」中逐一添加。

| 权限代码 | 权限说明 | 是否需要管理员审批 |
|---|---|---|
| `wiki:space:read` | 读取知识库空间信息 | ✅ |
| `wiki:space:write` | 创建/修改知识库空间 | ✅ |
| `wiki:node:read` | 读取知识库节点/页面信息 | ✅ |
| `wiki:node:write` | 创建/修改知识库节点/页面 | ✅ |
| `sheets:spreadsheet:read` | 读取电子表格内容 | ✅ |
| `sheets:spreadsheet:write` | 创建/修改电子表格 | ✅ |
| `docs:document:read` | 读取文档内容 | ✅ |
| `docs:document:write` | 创建/修改文档 | ✅ |
| `auth:tenant_access_token:read` | 获取 tenant_access_token（必需） | ✅ |

配置路径：飞书开发者后台 → 应用 → **权限管理** → 搜索上述权限 → 批量添加 → **发布版本** → 提交管理员审批。

---

## 3. 安装步骤

工具依赖 `requests` 库，安装方法如下：

```bash
cd /d "C:\Users\sunz\Desktop\AI\EduERP-V4\EduERP-V4"
pip install requests
```

如需验证安装：

```bash
python -c "import requests; print('requests OK:', requests.__version__)"
```

---

## 4. 使用方法

### 4.1 设置环境变量

```bash
set FEISHU_APP_ID=your_app_id
set FEISHU_APP_SECRET=your_app_secret
```

> 生产环境中建议通过 `.env` 文件或 CI/CD Secrets 管理凭证。

### 4.2 运行模式

#### 正常执行

```bash
python backend/tools/feishu_bootstrap.py
```

完整创建：知识库空间 → 文件夹结构 → Mission Board。

#### 干跑模式（推荐先试运行）

```bash
python backend/tools/feishu_bootstrap.py --dry-run
```

只打印将要执行的 API 调用，不实际发送请求。日志中每行以 `[DRY-RUN]` 标记。

#### 测试模式（资源名加 `[EOS-BOOTSTRAP]` 前缀）

```bash
python backend/tools/feishu_bootstrap.py --test
```

所有资源名称自动添加 `[EOS-BOOTSTRAP]` 前缀，与生产资源隔离，验证完成后可直接删除对应测试空间。

#### 验证模式（检查已创建资源）

```bash
python backend/tools/feishu_bootstrap.py --verify
```

检查已创建资源是否存在且格式正确，验证内容包括：

1. 知识库空间是否存在
2. 文件夹结构是否完整
3. Mission Board 是否存在、列头是否匹配

#### 组合使用

```bash
# 测试模式下干跑
python backend/tools/feishu_bootstrap.py --test --dry-run
```

---

## 5. 输出说明

### 5.1 控制台日志

日志格式示例：

```
[2026-07-18 12:00:00] INFO    配置加载完成。dry_run=False, test_mode=False, verify=False
[2026-07-18 12:00:01] INFO    [create_space] 成功。
[2026-07-18 12:00:01] INFO    知识库空间创建成功: space_id=xxxxxxxxxx
[2026-07-18 12:00:02] INFO    [create_root_page] 成功。
[2026-07-18 12:00:02] INFO    开始创建文件夹: Governance
...
[2026-07-18 12:00:10] INFO    [create_mission_board] 成功。
[2026-07-18 12:00:10] INFO    报告已写入: bootstrap-report.json
```

### 5.2 bootstrap-report.json

运行完后在同级 `tools/` 目录生成 `bootstrap-report.json`，字段解释如下：

| 字段 | 类型 | 说明 |
|---|---|---|
| `created_at` | string | 报告生成时间，格式 `YYYY-MM-DD HH:MM:SS` |
| `mode` | string | 运行模式描述（`dry_run` / `test` / `normal` 等） |
| `resources` | object | 创建的资源 ID 集合 |
| `resources.space_id` | string | 知识库空间 ID |
| `resources.mission_board_token` | string | 多维表格（电子表格）token |
| `resources.node_tokens` | object | 所有知识库节点 token，key 为文件夹名 |
| `steps` | array | 每一步 API 调用的详细信息 |
| `steps[].step_name` | string | 步骤名称 |
| `steps[].status` | string | `success` 或 `error` |
| `steps[].timestamp` | string | 调用时间戳 |
| `steps[].error` | string | 错误信息（仅失败时） |
| `errors` | array | 错误列表汇总 |
| `elapsed_seconds` | number | 总耗时（秒） |

`bootstrap-report.json` 示例：

```json
{
  "created_at": "2026-07-18 12:00:10",
  "mode": "normal",
  "dry_run": false,
  "test_mode": false,
  "resources": {
    "space_id": "xxxxxxxxxx",
    "mission_board_token": "xxxxxxxxxx",
    "node_tokens": {
      "root": "xxxxx",
      "Governance": "xxxxx",
      "Missions": "xxxxx",
      "Architecture": "xxxxx",
      "Evidence": "xxxxx",
      "Operations": "xxxxx",
      "EduOS": "xxxxx",
      "Archive": "xxxxx"
    }
  },
  "steps": [ ... ],
  "errors": [],
  "elapsed_seconds": 12.34
}
```

---

## 6. 常见错误处理

### 6.1 401 Unauthorized

**可能原因：** App ID 或 App Secret 错误。

**解决：**
1. 检查环境变量 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 是否正确设置
2. 确认应用状态为「已启用」
3. 在飞书开发者后台重新生成 Secret

### 6.2 权限不足

**可能原因：** 飞书开发者后台未配置对应 API 权限，或权限未审批通过。

**解决：**
1. 对照[第 2 节](#2-权限检查清单)检查权限是否已添加
2. 确认已「发布版本」并提交管理员审批
3. 审批通过后等待 1-2 分钟生效

### 6.3 超时

**可能原因：** 网络连接问题（飞书 API 超时为 30s）。

**解决：**
- 工具已内置重试机制（自动重试 3 次），通常无需手动干预
- 如持续超时，检查网络连接是否正常，ping `open.feishu.cn` 确认可达
- 如需调整超时，可修改源码中 `timeout=(10, 30)` 参数
- 也可使用 `--dry-run` 模式先验证流程

### 6.4 其它常见错误

| 错误场景 | 错误信息 | 建议操作 |
|---|---|---|
| requests 未安装 | `FATAL: requests library not installed` | `pip install requests` |
| 环境变量未设置 | `FEISHU_APP_ID 或 FEISHU_APP_SECRET 未设置` | 按第 4.1 节设置环境变量 |
| 飞书 API 返回错误码 | `飞书 API 错误: code=xxxxx, msg=...` | 查阅飞书 API 错误码文档 |
| 空间已存在 | 名称冲突 | 使用 `--test` 模式或更换空间名称 |

---

## 7. 回滚方案

### 7.1 测试空间（`--test` 模式）

测试模式下所有资源名称带有 `[EOS-BOOTSTRAP]` 前缀，与生产资源完全隔离。回滚方式：

1. **直接删除飞书知识库空间**（最彻底）
2. 或在飞书开放平台手动删除测试电子表格和测试节点

### 7.2 生产空间

按以下顺序逐层回滚：

```
1. 删除 Mission Board（电子表格）
   └─ 在飞书「知识库」中找到对应电子表格 → 删除
   
2. 删除文件夹结构
   └─ 删除根节点下的所有子页面和 README 文档 → 删除根页面
   
3. 删除知识库空间
   └─ 空间设置 → 更多 → 删除空间
```

> **注意：** 删除知识库空间不可逆，操作前请确认数据已备份。当前工具不提供自动回滚功能，需手动在飞书界面操作。

---

## 8. Bootstrap Isolation 说明

`--test` 参数专为首次验证设计，关键行为如下：

| 行为 | 说明 |
|---|---|
| 资源名称前缀 | 所有资源名自动添加 `[EOS-BOOTSTRAP] ` 前缀 |
| 隔离性 | 与生产资源完全隔离，互不干扰 |
| 适用场景 | 首次接入飞书时的流程验证 |
| 验证完成后 | 直接删除对应测试空间即可清理所有资源 |
| 组合使用 | 可与 `--dry-run` 同时使用 |