# M-EDUOS-SECURITY-HISTORY-CLEANUP-V1 证据报告

- **Mission**: M-EDUOS-SECURITY-HISTORY-CLEANUP-V1
- **执行时间**: 2026-07-31
- **仓库**: `git@github.com:asunzhoua/EduERP-V4.git`（公开仓库）
- **分支**: `master`（唯一受影响分支；`main` 与 tag `v0.2.0`/`v0.3.0` 经拓扑核验不含敏感内容，未改动）

---

## 1. 清理前风险评估

| 项目 | 详情 |
| --- | --- |
| 泄露 commit | `d7dfe70`（已推送到公开远端） |
| 泄露载体 | `PROJECT_STATE.md`、`PROJECT_PROGRESS_REPORT.md`（2 个文件 × 3 个 commit：`da6261d` 创建、`d7dfe70` 更新、`2b94494` 部分清理） |
| 泄露内容 | 内网 IP（RFC1918 段）、公网域名（DDNS）、公网 WAN IP、代理出口公网 IP、端口转发映射（外网端口/TCP → 内网 IP:端口） |
| 风险等级 | **高** — 公开仓库可被任何人检索，泄露内部网络拓扑、服务入口与外部地址绑定关系，可直接用于定向攻击探测 |
| 基线核验 | `git log --all -G` 全历史扫描确认敏感值仅存在于上述 3 个 commit；`origin/main`（独立历史线，tip `d3c3fdb`）与 tag 不含敏感内容 |
| 额外发现 | 此前"security cleanup" commit `2b94494` **不完整**：`PROJECT_PROGRESS_REPORT.md` 的 Key Findings 仍遗留 2 行公网 IP 信息（本次一并清除） |

## 2. 决策原因

1. **工具选择**：`git filter-repo` 未安装（`git: 'filter-repo' is not a git command`）→ 采用任务方案 B：`git filter-branch --tree-filter`。
2. **执行隔离**：原仓库工作树有 **464 项未提交改动**（用户本地开发状态），filter-branch 会拒绝脏工作树且存在风险 → 在**临时干净 clone** 中执行重写，原仓库仅做指针级更新（`update-ref`）+ 恢复 2 个清理文件，**完全不触碰其余未提交改动**。
3. **精确替换而非宽泛替换**：仅替换 4 个精确敏感值（内网 IP、DDNS 域名、WAN IP、代理出口 IP → `REDACTED`），**不**使用宽泛的 `192.168.*` 全局模式——避免破坏历史中合法的测试夹具假 IP（`192.168.1.1` / `192.168.1.100`，位于 login-log 单元测试，RFC1918 私有段假数据，与本机网络无任何关联），并避免不必要的全历史重写（191 commits）。
4. **范围最小化**：重写范围 `30ce35a..master`（恰好 3 个受影响 commit），不重写其余 188 个 commit。
5. **兼容用户既有清理风格**：保留"8443 端口转发已配置"类中性描述（与用户自己提交的 `2b94494` 的 HEAD 状态一致），仅移除实际敏感值。

## 3. 执行方式

### 3.1 History Rewrite（临时 clone 内）

```
git clone <本地仓库路径> <临时目录>
git filter-branch --force --tree-filter "
  if [ -f PROJECT_STATE.md ]; then sed -i 's/<LAN_IP>/REDACTED/g; s/<DDNS_DOMAIN>/REDACTED/g; s/<WAN_IP>/REDACTED/g; s/<PROXY_IP>/REDACTED/g' PROJECT_STATE.md; fi
  if [ -f PROJECT_PROGRESS_REPORT.md ]; then sed -i 's/<LAN_IP>/REDACTED/g; s/<DDNS_DOMAIN>/REDACTED/g; s/<WAN_IP>/REDACTED/g; s/<PROXY_IP>/REDACTED/g' PROJECT_PROGRESS_REPORT.md; fi
" -- 30ce35a..master
git update-ref -d refs/original/refs/heads/master
git reflog expire --expire=now --all && git gc --prune=now
```

> 注：上表 `<LAN_IP>`/`<DDNS_DOMAIN>`/`<WAN_IP>`/`<PROXY_IP>` 为脱敏占位符，实际执行使用 4 个精确敏感值（见 Mission 定义），此处不落盘原始值。

### 3.2 Commit 映射（重写后）

| 原 commit | 新 commit | 说明 |
| --- | --- | --- |
| `da6261d` | `a53b076` | 创建文档（敏感值 → REDACTED） |
| `d7dfe70` | `53108fa` | 更新文档（敏感值 → REDACTED） |
| `2b94494` | `ab48576` | 部分清理 commit 补全（遗留 2 行 → REDACTED） |

### 3.3 强制推送

```
git push --force origin master
# 输出: + 2b94494...ab48576 master -> master (forced update)
```

### 3.4 原仓库指针级同步（不触碰工作树）

```
git fetch origin
git update-ref refs/heads/master refs/remotes/origin/master
git checkout HEAD -- PROJECT_STATE.md PROJECT_PROGRESS_REPORT.md   # 仅恢复这 2 个被清理文件
git reflog expire --expire=now --all && git gc --prune=now          # 本地清除旧对象
```

### 3.5 无附带改动证明（blob 哈希比对）

对旧 HEAD（`2b94494`）的两个文件 blob 应用相同 sed 变换后计算哈希，与重写后 HEAD（`ab48576`）blob 比对：

| 文件 | 旧 blob+sed 哈希 | 新 blob 哈希 | 结果 |
| --- | --- | --- | --- |
| PROJECT_STATE.md | `0ac9dd8…` | `0ac9dd8…` | ✅ 一致 |
| PROJECT_PROGRESS_REPORT.md | `f08b03b…` | `f08b03b…` | ✅ 一致 |

证明重写只做了精确替换，无行尾/内容附带变化。旧 HEAD → 新 HEAD 全量 diff 仅 `PROJECT_PROGRESS_REPORT.md` 2 行（`+2/-2`）。

## 4. 验证结果

| # | 验证项 | 命令 | 结果 |
| --- | --- | --- | --- |
| 1 | 重写后 master 历史无敏感值 | `git log -p refs/heads/master \| grep <4值>` | ✅ 0 匹配 |
| 2 | 中间 commit 无敏感值 | `git grep` on `a53b076` / `53108fa` / `HEAD` | ✅ 0 匹配 |
| 3 | 远端 master 历史无敏感值 | fetch 后 `git log -p origin/master \| grep <4值>` | ✅ 0 匹配（REMOTE_CLEAN） |
| 4 | 远端 master 指针 | `git ls-remote origin refs/heads/master` | ✅ `ab48576…` |
| 5 | 本地全 refs 扫描 | `git log -p --all \| grep <4值>` | ✅ 0 匹配（ALL_CLEAN） |
| 6 | commit message 扫描 | `git log --all --format=%B \| grep <4值>` | ✅ 0 匹配 |
| 7 | HEAD/tracked 文件 | `git grep` HEAD | ✅ 0 匹配 |
| 8 | 旧 commit 对象已清除 | `git cat-file -t 2b94494…` | ✅ fatal: could not get object info（本地已 prune） |
| 9 | 用户未提交改动保留 | `git status --short` 计数 | ✅ 464 项完整保留（仅 2 个文档文件按预期恢复） |

### 4.1 Mission 字面模式的已知残留（有意保留，非泄露）

任务验证命令 `grep -E "192\.168\.|ddns\.|60\.178\.|85\.234\."` 在重写后历史中仍命中 **4 行**，全部为历史中早已存在的**测试夹具假 IP**（非本任务泄露值、非用户网络信息，且在 HEAD 正常保留）：

- `backend/src/modules/identity/entities/identity.entity.spec.ts`：`ip: '192.168.1.1'`、`expect(log.ip).toBe('192.168.1.1')`
- JSON 夹具：`"ipAddress": "192.168.1.100"`

本任务 4 个精确敏感值（内网 IP / DDNS 域名 / WAN IP / 代理出口 IP）扫描结果为 **0 匹配**。

### 4.2 残余风险与后续建议

1. **GitHub 侧缓存**：force push 后旧 commit `2b94494`/`d7dfe70`/`da6261d` 仍可通过 SHA 从 GitHub fetch（已实测 `git fetch origin 2b94494…` 成功）。GitHub 对 unreachable commit 的缓存为已知行为，彻底清除需**联系 GitHub Support 申请 purge**（并检查是否有 fork 保留旧历史）。
2. **工作树 `miniapp/config.js`**：存在用户**未提交**的本地测试改动（baseUrl 指向内网 IP）。该值不在 HEAD、未推送；提交前需改回（或使用环境变量），否则会再次入库。
3. **仓库内未跟踪的旧证据文件**：仓库 `docs/evidence/` 下存在大量**未跟踪**的旧 Mission 报告（如 `M-EDUOS-MINIAPP-PUBLIC-8443-LOCAL-TEST-V1-FINAL.md`），内容含本次清理的敏感值。当前未入库、未推送，但建议纳入 `.gitignore` 或清理，防止日后误提交。
4. **其他协作者**：任何已 clone 该仓库的其他机器/CI 缓存仍含旧历史，需重新 clone 或 fetch + rebase。

## 5. 最终状态

| 项 | 状态 |
| --- | --- |
| `master`（远端） | ✅ `ab48576`（强制推送完成，历史无敏感值） |
| `main`（远端） | ✅ 未改动（`d3c3fdb`，经核验不含敏感内容） |
| tag `v0.2.0` / `v0.3.0` | ✅ 未改动（经核验不含敏感内容） |
| 本地 `master` | ✅ `ab48576`，与远端一致 |
| 本地 HEAD / tracked 文件 | ✅ 已清理（4 个精确敏感值 0 匹配） |
| 本地旧对象 | ✅ 已 GC prune（`cat-file` 验证不可访问） |
| 用户未提交改动 | ✅ 完整保留（464 项） |
| 任务结论 | **PASS**（含 4.2 列出的 GitHub 缓存 purge 后续项） |

---
*本报告不含任何原始敏感值（IP/域名均已脱敏），可安全存放。*
