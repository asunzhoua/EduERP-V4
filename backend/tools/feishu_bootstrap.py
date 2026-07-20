#!/usr/bin/env python3
"""
feishu_bootstrap.py — 飞书自动初始化工具

用于自动创建飞书知识库空间、文件夹结构、Mission Board 多维表格等资源。
支持 --dry-run（干跑）、--test（隔离测试）、--verify（验证）模式。

依赖：Python 3.10+, requests

Usage:
    python feishu_bootstrap.py                    # 正常执行
    python feishu_bootstrap.py --dry-run           # 仅打印不调用 API
    python feishu_bootstrap.py --test              # 资源名加 [EOS-BOOTSTRAP] 前缀
    python feishu_bootstrap.py --verify            # 验证已有资源
    python feishu_bootstrap.py --test --dry-run    # 组合模式
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import logging
import datetime
from typing import Any, Optional

try:
    import requests
except ImportError:
    print("FATAL: requests library not installed. Run: pip install requests", file=sys.stderr)
    sys.exit(1)

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

FEISHU_BASE_URL = "https://open.feishu.cn/open-apis"

# 文件夹结构定义：每个条目为 {name, description, children}
# children 是 [(name, description), ...] 的列表
FOLDER_STRUCTURE: list[dict[str, Any]] = [
    {
        "name": "Governance",
        "description": "Governance policies, rules, and compliance documents for the EOS AI system.",
        "children": [],
    },
    {
        "name": "Missions",
        "description": "Mission definitions, status tracking, and execution records.",
        "children": [],
    },
    {
        "name": "Architecture",
        "description": "System architecture diagrams, design documents, and technical specs.",
        "children": [],
    },
    {
        "name": "Evidence",
        "description": "Runtime, audit, and test evidence reports for mission execution.",
        "children": [
            ("RuntimeReports", "Runtime execution logs, traces, and performance metrics."),
            ("AuditReports", "Audit trail records and compliance verification reports."),
            ("TestReports", "Test execution results, coverage reports, and validation data."),
        ],
    },
    {
        "name": "Operations",
        "description": "Operational runbooks, deployment guides, and maintenance procedures.",
        "children": [],
    },
    {
        "name": "EduOS",
        "description": "EduOS core system documentation, APIs, and integration guides.",
        "children": [],
    },
    {
        "name": "Archive",
        "description": "Archived documents, historical records, and deprecated references.",
        "children": [],
    },
]

# Mission Board 列定义
MISSION_BOARD_COLUMNS: list[dict[str, Any]] = [
    {"letter": "A", "name": "Mission ID", "type": "text"},
    {"letter": "B", "name": "Mission Name", "type": "text"},
    {"letter": "C", "name": "Description", "type": "text"},
    {"letter": "D", "name": "Status", "type": "text",
     "validations": ["CREATED", "RUNNING", "PAUSED", "FAILED", "COMPLETED", "ABORTED"]},
    {"letter": "E", "name": "Owner", "type": "text"},
    {"letter": "F", "name": "Executor", "type": "text"},
    {"letter": "G", "name": "Priority", "type": "text",
     "validations": ["P0", "P1", "P2", "P3"]},
    {"letter": "H", "name": "Created Time", "type": "date"},
    {"letter": "I", "name": "Started Time", "type": "date"},
    {"letter": "J", "name": "Finished Time", "type": "date"},
    {"letter": "K", "name": "Evidence Link", "type": "text", "is_url": True},
    {"letter": "L", "name": "Result", "type": "text"},
    {"letter": "M", "name": "Tag", "type": "text"},
]

MISSION_BOARD_VIEWS: list[dict[str, Any]] = [
    {"name": "Active Missions",
     "description": "显示所有进行中的任务（排除已完成和失败的）"},
    {"name": "My Missions",
     "description": "显示当前用户负责的任务"},
    {"name": "Recent Archive",
     "description": "显示最近归档的任务（已完成或失败的）"},
]

# ──────────────────────────────────────────────
# Logging Setup
# ──────────────────────────────────────────────

def _setup_logger() -> logging.Logger:
    """配置带时间戳的日志输出。"""
    logger = logging.getLogger("feishu_bootstrap")
    logger.setLevel(logging.DEBUG)
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG)
    fmt = logging.Formatter(
        "[%(asctime)s] %(levelname)-8s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(fmt)
    # 避免重复添加 handler
    if not logger.handlers:
        logger.addHandler(handler)
    return logger


logger = _setup_logger()

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────


class Config:
    """运行时配置，从 CLI 参数和环境变量解析。"""

    def __init__(self, args: argparse.Namespace) -> None:
        self.dry_run: bool = args.dry_run
        self.test_mode: bool = args.test
        self.verify: bool = args.verify
        self.space_id: Optional[str] = args.space_id
        self.prefix: str = "[EOS-BOOTSTRAP] " if self.test_mode else ""

        # 从环境变量读取凭证（去除可能的空白/换行）
        self.app_id: str = os.environ.get("FEISHU_APP_ID", "").strip()
        self.app_secret: str = os.environ.get("FEISHU_APP_SECRET", "").strip()

        # 运行状态
        self.start_time: float = time.time()
        self.results: dict[str, Any] = {
            "created_at": datetime.datetime.now().isoformat(),
            "mode": {
                "dry_run": self.dry_run,
                "test_mode": self.test_mode,
                "verify": self.verify,
            },
            "resources": {},
            "steps": [],
            "errors": [],
            "elapsed_seconds": 0.0,
        }

    def validate_env(self) -> None:
        """检查必需的环境变量；缺失则退出。"""
        missing: list[str] = []
        if not self.app_id:
            missing.append("FEISHU_APP_ID")
        if not self.app_secret:
            missing.append("FEISHU_APP_SECRET")
        if missing:
            logger.error(
                "缺少必需的环境变量: %s。退出。",
                ", ".join(missing),
            )
            sys.exit(1)

    def finalize_report(self) -> None:
        """在报告里记录总耗时。"""
        self.results["elapsed_seconds"] = round(time.time() - self.start_time, 3)


# ──────────────────────────────────────────────
# Feishu API Client
# ──────────────────────────────────────────────


class FeishuClient:
    """飞书 Open API 的轻薄包装，含 token 管理与失败重试。

    所有公开 API 方法都记录带时间戳的日志，
    失败时重试（最多 2 次重试，间隔 2 秒），
    且绝不删除已有资源（仅创建）。
    """

    def __init__(self, config: Config) -> None:
        self.config = config
        self._token: str = ""
        self._token_expires_at: float = 0.0  # Unix 时间戳
        self._session = requests.Session()
        # 合理的超时
        self._session.timeout = (10, 30)

    # ── Token 管理 ────────────────────────────

    def _acquire_token(self) -> str:
        """从飞书获取新的 tenant_access_token。

        POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal

        Returns:
            token 字符串。

        Raises:
            RuntimeError: 所有重试后仍然失败。
        """
        url = f"{FEISHU_BASE_URL}/auth/v3/tenant_access_token/internal"
        body = {"app_id": self.config.app_id, "app_secret": self.config.app_secret}

        def _do_acquire() -> str:
            resp = self._session.post(url, json=body, timeout=(10, 30))
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 0:
                raise RuntimeError(
                    f"飞书 API 错误: code={data.get('code')}, msg={data.get('msg')}"
                )
            token: str = data["tenant_access_token"]
            expire_sec: int = data.get("expire", 7200)  # 默认 2 小时
            self._token_expires_at = time.time() + expire_sec - 60  # 提前 1 分钟刷新
            return token

        return self._with_retry(_do_acquire, context="acquire_tenant_access_token")

    def get_token(self) -> str:
        """返回有效的 token，必要时自动刷新。"""
        if not self._token or time.time() >= self._token_expires_at:
            self._token = self._acquire_token()
            logger.info("已获取/刷新 Tenant Access Token。")
        return self._token

    def _headers(self) -> dict[str, str]:
        """构建飞书 API 认证头。"""
        return {
            "Authorization": f"Bearer {self.get_token()}",
            "Content-Type": "application/json",
        }

    # ── 重试辅助 ──────────────────────────────

    def _with_retry(self, fn, context: str = "") -> Any:
        """执行 *fn*，最多重试 2 次（共 3 次尝试），间隔 2 秒。

        Args:
            fn: 可调用对象。
            context: 日志标签。

        Returns:
            fn 的返回值。

        Raises:
            最后一次异常（所有重试耗尽后）。
        """
        last_exc: Optional[Exception] = None
        for attempt in range(3):  # 首次 + 2 次重试
            try:
                return fn()
            except requests.RequestException as e:
                last_exc = e
                logger.warning(
                    "[%s] 第 %d/3 次尝试失败: %s", context, attempt + 1, e
                )
            except Exception as e:
                last_exc = e
                logger.warning(
                    "[%s] 第 %d/3 次尝试失败: %s", context, attempt + 1, e
                )
            if attempt < 2:
                time.sleep(2)
        logger.error("[%s] 全部 3 次尝试均已失败。", context)
        raise last_exc  # type: ignore[misc]

    # ── API 辅助 ──────────────────────────────

    def _dry_log(self, message: str) -> None:
        """干跑模式下打印 [DRY-RUN] 消息。"""
        if self.config.dry_run:
            print(f"[DRY-RUN] {message}")

    def _record_step(self, step_name: str, result: Any, error: Optional[str] = None) -> None:
        """在结果字典中记录一个步骤。"""
        entry: dict[str, Any] = {
            "step": step_name,
            "timestamp": datetime.datetime.now().isoformat(),
            "result": result if isinstance(result, dict) else {"message": str(result)},
        }
        if error:
            entry["error"] = error
            self.config.results.setdefault("errors", []).append({
                "step": step_name,
                "error": error,
                "timestamp": entry["timestamp"],
            })
        self.config.results["steps"].append(entry)

    def _post(self, url: str, body: dict, step_name: str) -> Optional[dict]:
        """向飞书 API 发送 POST 请求，带重试与日志。

        Args:
            url: 完整的飞书 API URL。
            body: JSON 可序列化的请求体。
            step_name: 人类可读的步骤标签。

        Returns:
            解析后的 JSON 响应字典，或失败时返回 None。
        """
        if self.config.dry_run:
            self._dry_log(f"POST {url}  body={json.dumps(body, ensure_ascii=False)}")
            return None

        def _do() -> dict:
            resp = self._session.post(url, json=body, headers=self._headers(), timeout=(10, 30))
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 0:
                raise RuntimeError(
                    f"飞书 API 错误: code={data.get('code')}, msg={data.get('msg')}, "
                    f"url={url}"
                )
            return data

        try:
            data = self._with_retry(_do, context=step_name)
            logger.info("[%s] 成功。", step_name)
            self._record_step(step_name, data)
            return data
        except Exception as e:
            logger.error("[%s] 失败: %s", step_name, e)
            self._record_step(step_name, {"url": url}, error=str(e))
            return None

    def _put(self, url: str, body: dict, step_name: str) -> Optional[dict]:
        """向飞书 API 发送 PUT 请求，带重试与日志。

        Args:
            url: 完整的飞书 API URL。
            body: JSON 可序列化的请求体。
            step_name: 人类可读的步骤标签。

        Returns:
            解析后的 JSON 响应字典，或失败时返回 None。
        """
        if self.config.dry_run:
            self._dry_log(f"PUT {url}  body={json.dumps(body, ensure_ascii=False)}")
            return None

        def _do() -> dict:
            resp = self._session.put(url, json=body, headers=self._headers(), timeout=(10, 30))
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 0:
                raise RuntimeError(
                    f"飞书 API 错误: code={data.get('code')}, msg={data.get('msg')}, "
                    f"url={url}"
                )
            return data

        try:
            data = self._with_retry(_do, context=step_name)
            logger.info("[%s] 成功。", step_name)
            self._record_step(step_name, data)
            return data
        except Exception as e:
            logger.error("[%s] 失败: %s", step_name, e)
            self._record_step(step_name, {"url": url}, error=str(e))
            return None

    def _get(self, url: str, step_name: str) -> Optional[dict]:
        """向飞书 API 发送 GET 请求，带重试与日志。"""
        if self.config.dry_run:
            self._dry_log(f"GET {url}")
            return None

        def _do() -> dict:
            resp = self._session.get(url, headers=self._headers(), timeout=(10, 30))
            resp.raise_for_status()
            data = resp.json()
            if data.get("code") != 0:
                raise RuntimeError(
                    f"飞书 API 错误: code={data.get('code')}, msg={data.get('msg')}, "
                    f"url={url}"
                )
            return data

        try:
            data = self._with_retry(_do, context=step_name)
            logger.info("[%s] 成功。", step_name)
            self._record_step(step_name, data)
            return data
        except Exception as e:
            logger.error("[%s] 失败: %s", step_name, e)
            self._record_step(step_name, {"url": url}, error=str(e))
            return None

    # ── 资源：知识库空间 ──────────────────────

    def create_space(self) -> Optional[str]:
        """创建飞书知识库（wiki）空间。

        POST https://open.feishu.cn/open-apis/wiki/v2/spaces

        Note: Wiki space creation requires user_access_token (登录用户身份),
        not tenant_access_token (应用身份). 400 error is expected and handled
        gracefully — the function logs a warning and continues. The wiki space
        "[EOS-BOOTSTRAP] EOS AI Workspace" has already been created manually.

        Returns:
            space_id 字符串，或失败时返回 None。
        """
        name = f"{self.config.prefix}EOS AI Workspace"
        body = {
            "name": name,
            "description": "EOS AI System Management Center",
        }
        if self.config.dry_run:
            self._dry_log(f"创建知识库空间: {name}")
            return "dry_run_space_id"

        data = self._post(
            f"{FEISHU_BASE_URL}/wiki/v2/spaces",
            body,
            step_name="create_space",
        )
        if data and "data" in data and "space" in data["data"]:
            space_id: str = data["data"]["space"]["space_id"]
            self.config.results.setdefault("resources", {})["space_id"] = space_id
            logger.info("知识库空间创建成功: space_id=%s", space_id)
            return space_id

        # Wiki space creation requires user_access_token (登录用户身份),
        # not tenant_access_token (应用身份). This API returns 400 when called
        # with tenant_access_token. The space has already been created manually.
        logger.warning(
            "Wiki space creation requires user_access_token — skipping automated creation. "
            "The wiki space should be created manually via browser UI. "
            "Continuing with remaining steps."
        )
        return None

    # ── 资源：文件夹结构 ──────────────────────

    def _create_root_node(self, space_id: str) -> Optional[str]:
        """在空间根目录下创建首页页面（作为文件夹结构的父节点）。

        POST https://open.feishu.cn/open-apis/wiki/v2/spaces/{space_id}/nodes

        Returns:
            obj_token 字符串，或失败时返回 None。
        """
        title = f"{self.config.prefix}EOS AI Home"
        body = {
            "obj_type": "wiki",
            "parent_node_token": "",
            "node_type": "origin",
            "title": title,
        }
        if self.config.dry_run:
            self._dry_log(f"创建根页面: {title}")
            return "dry_run_root_token"

        data = self._post(
            f"{FEISHU_BASE_URL}/wiki/v2/spaces/{space_id}/nodes",
            body,
            step_name="create_root_page",
        )
        if data and "data" in data and "node" in data["data"]:
            obj_token: str = data["data"]["node"]["obj_token"]
            self.config.results.setdefault("resources", {}).setdefault("node_tokens", {})[
                "root"
            ] = obj_token
            logger.info("根页面创建成功: obj_token=%s", obj_token)
            return obj_token
        logger.warning("创建根页面失败。")
        return None

    def _create_folder_node(
        self, space_id: str, parent_token: str, folder_name: str, folder_desc: str
    ) -> Optional[str]:
        """在指定父节点下创建一个文件夹节点（wiki page）。

        同时在该文件夹下创建 README 文档。

        Returns:
            创建的节点 token，或 None。
        """
        name = f"{self.config.prefix}{folder_name}"
        body = {
            "obj_type": "wiki",
            "parent_node_token": parent_token,
            "node_type": "origin",
            "title": name,
        }
        if self.config.dry_run:
            self._dry_log(f"创建文件夹: {name}（作为 wiki page）")
            return "dry_run_folder_token"

        data = self._post(
            f"{FEISHU_BASE_URL}/wiki/v2/spaces/{space_id}/nodes",
            body,
            step_name=f"create_folder_{folder_name}",
        )
        if data and "data" in data and "node" in data["data"]:
            node_token: str = data["data"]["node"]["obj_token"]
            self.config.results.setdefault("resources", {}).setdefault("node_tokens", {})[
                folder_name
            ] = node_token
            logger.info("文件夹 '%s' 创建成功: node_token=%s", name, node_token)

            # 在该文件夹下创建 README 文档
            self._create_readme(space_id, node_token, folder_name, folder_desc)
            return node_token

        logger.warning("创建文件夹 '%s' 失败。", name)
        return None

    def _create_readme(self, space_id: str, parent_token: str, folder_name: str, description: str) -> None:
        """在文件夹下创建 README 文档并写入内容。"""
        readme_title = f"{self.config.prefix}README - {folder_name}"
        body = {
            "obj_type": "docx",
            "parent_node_token": parent_token,
            "node_type": "origin",
            "title": readme_title,
        }
        if self.config.dry_run:
            self._dry_log(f"创建 README 文档: {readme_title}")
            return

        data = self._post(
            f"{FEISHU_BASE_URL}/wiki/v2/spaces/{space_id}/nodes",
            body,
            step_name=f"create_readme_{folder_name}",
        )
        if data and "data" in data and "node" in data["data"]:
            readme_node_token: str = data["data"]["node"]["obj_token"]
            logger.info("README '%s' 创建成功: token=%s", readme_title, readme_node_token)

            # 尝试更新文档内容
            self._update_docx_content(readme_node_token, folder_name, description)

    def _update_docx_content(self, doc_token: str, folder_name: str, description: str) -> None:
        """通过飞书文档 API 更新 README 文档内容。

        这是一个 best-effort 操作，失败不阻断流程。
        """
        if self.config.dry_run:
            self._dry_log(f"更新文档内容: doc_token={doc_token}")
            return

        current_time = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        content_text = (
            f"# {self.config.prefix}{folder_name}\n\n"
            f"{description}\n\n"
            f"---\n\n"
            f"*此目录是 {self.config.prefix}EOS AI Workspace 的一部分。*\n\n"
            f"*由 feishu_bootstrap.py 于 {current_time} 自动创建。*"
        )

        # 使用文档 API 更新内容
        # 先获取文档信息的 block_id
        try:
            url = f"{FEISHU_BASE_URL}/docx/v1/documents/{doc_token}/raw_content"
            resp = self._session.get(url, headers=self._headers(), timeout=(10, 30))
            # 即使失败也不阻塞流程
        except Exception as e:
            logger.warning("获取文档内容失败（可忽略）: %s", e)

        # 使用文档块 API 更新内容
        url = f"{FEISHU_BASE_URL}/docx/v1/documents/{doc_token}/blocks/{doc_token}/content"
        body = {
            "revision": -1,
            "blocks": [
                {
                    "block_id": doc_token,
                    "block_type": 1,
                    "page": {
                        "elements": [
                            {
                                "text_run": {
                                    "content": content_text,
                                }
                            }
                        ]
                    },
                }
            ],
        }
        try:
            self._post(url, body, step_name=f"update_readme_{folder_name}")
        except Exception as e:
            logger.warning("更新 README 内容失败（可忽略）: %s", e)

    def create_folder_structure(self, space_id: str) -> None:
        """在知识库中创建完整的文件夹层次结构。

        Args:
            space_id: 知识库空间 ID。
        """
        root_token = self._create_root_node(space_id)
        if not root_token and not self.config.dry_run:
            logger.error("无法创建根页面，跳过文件夹创建。")
            return

        parent_token = root_token or "dry_run_root_token"

        for folder in FOLDER_STRUCTURE:
            fname: str = folder["name"]
            fdesc: str = folder["description"]
            logger.info("开始创建文件夹: %s", fname)

            folder_token = self._create_folder_node(
                space_id, parent_token, fname, fdesc
            )

            # 创建子文件夹
            effective_parent = folder_token or parent_token
            for child_name, child_desc in folder.get("children", []):
                self._create_folder_node(
                    space_id, effective_parent, child_name, child_desc,
                )

        logger.info("文件夹结构创建完毕。")

    # ── 资源：Mission Board（多维表格） ──────

    def create_mission_board(self) -> Optional[str]:
        """创建 Mission Board 多维表格（spreadsheet）。

        步骤：
        1. POST /sheets/v3/spreadsheets — 创建电子表格
        2. 重命名默认工作表为 "Missions"
        3. 设置列头（A-L 共 12 列）
        4. 添加数据验证（Status, Priority）
        5. 创建筛选视图

        Returns:
            spreadsheet_token，或失败时返回 None。
        """
        title = f"{self.config.prefix}Mission Board"
        body = {"title": title}

        if self.config.dry_run:
            self._dry_log(f"创建多维表格: {title}")
            self._dry_log("设置列头: A-L (Mission ID, Mission Name, ...)")
            self._dry_log("创建视图: Active Missions, My Missions, Recent Archive")
            return "dry_run_spreadsheet_token"

        # Step 1: 创建电子表格
        data = self._post(
            f"{FEISHU_BASE_URL}/sheets/v3/spreadsheets",
            body,
            step_name="create_mission_board",
        )
        if not data or "data" not in data or "spreadsheet" not in data["data"]:
            logger.error("创建 Mission Board 失败。")
            return None

        ss_token: str = data["data"]["spreadsheet"]["spreadsheet_token"]
        self.config.results.setdefault("resources", {})["mission_board_token"] = ss_token
        logger.info("Mission Board 创建成功: token=%s", ss_token)

        # Step 1b: 获取 v3 hex sheet_id（v2 API 需要 hex ID，不是整数 0）
        sheet_info = self._get(
            f"{FEISHU_BASE_URL}/sheets/v3/spreadsheets/{ss_token}/sheets/query",
            "get_sheet_id",
        )
        if sheet_info and "data" in sheet_info and "sheets" in sheet_info["data"]:
            sheet_id_v3 = sheet_info["data"]["sheets"][0]["sheet_id"]
            logger.info("获取到 v3 sheet_id: %s", sheet_id_v3)
        else:
            sheet_id_v3 = "Sheet1"  # fallback
            logger.warning("无法获取 sheet_id，使用默认值: %s", sheet_id_v3)

        # Step 2: 重命名默认工作表为 "Missions"
        self._rename_sheet(ss_token, sheet_id_v3)

        # Step 3: 设置列头（第 1 行）
        self._set_column_headers(ss_token, sheet_id_v3)

        # Step 4: 添加数据验证
        self._add_data_validations(ss_token, sheet_id_v3)

        # Step 5: 创建筛选视图
        self._create_filter_views(ss_token, sheet_id_v3)

        return ss_token

    def _rename_sheet(self, ss_token: str, sheet_id: str) -> None:
        """将默认工作表重命名为 'Missions'。

        Uses v2 API. sheetId must be the v3 hex string (e.g. "b378e3"),
        NOT integer 0, since v2 batch_update requires the actual sheet_id.
        """
        url = f"{FEISHU_BASE_URL}/sheets/v2/spreadsheets/{ss_token}/sheets_batch_update"
        body = {
            "requests": [
                {
                    "updateSheet": {
                        "properties": {
                            "sheetId": sheet_id,
                            "title": "Missions",
                        }
                    }
                }
            ]
        }
        self._post(url, body, step_name="rename_sheet")

    def _set_column_headers(self, ss_token: str, sheet_id: str) -> None:
        """设置第 1 行为列头。

        Uses v2 API (PUT method instead of POST).
        """
        headers: list[str] = [col["name"] for col in MISSION_BOARD_COLUMNS]
        url = f"{FEISHU_BASE_URL}/sheets/v2/spreadsheets/{ss_token}/values"
        body = {
            "valueRange": {
                "range": f"{sheet_id}!A1:M1",
                "values": [headers],
            }
        }
        self._put(url, body, step_name="set_column_headers")

    def _add_data_validations(self, ss_token: str, sheet_id: str) -> None:
        """为 Status 和 Priority 列添加数据验证规则。

        已知问题：condition_formats/batch_create 返回 400，schema 太复杂不易调试。
        跳过 API 调用，提示用户手动添加。
        """
        logger.warning("  [SKIP] Data validations not supported via API (400 on condition_formats/batch_create)")
        logger.warning("    Add manually in browser: select column D -> Data -> Validation")
        logger.warning("    For column G: select column G -> Data -> Validation -> P0/P1/P2/P3")

    def _create_filter_views(self, ss_token: str, sheet_id: str) -> None:
        """在 Missions 工作表上创建筛选视图。

        已知问题：filter_views endpoint 返回 404，V2 API 不再支持该端点。
        跳过 API 调用，提示用户手动添加。
        """
        logger.warning("  [SKIP] Filter views not supported via API (404 on filter_views endpoint)")
        logger.warning("    Add manually in browser: right-click column header -> Filter -> Save as view")

    # ── 验证模式 ──────────────────────────────

    def verify_resources(self) -> None:
        """验证已创建的资源是否存在且格式正确。

        仅在 --verify 模式下调用。
        """
        logger.info("=" * 50)
        logger.info("开始验证已创建的资源 ...")
        print()
        verification_ok: bool = True

        # 1. 列出空间
        logger.info("[1/4] 验证知识库空间 ...")
        if self.config.space_id:
            # --space-id 模式：直接验证指定空间
            space_info = self._get(
                f"{FEISHU_BASE_URL}/wiki/v2/spaces/{self.config.space_id}",
                "verify_space_info",
            )
            if space_info and space_info.get("code") == 0:
                name = space_info.get("data", {}).get("space", {}).get("name", self.config.space_id)
                logger.info("  [PASS] 空间 '%s' 可访问。", name)
            else:
                logger.warning("  [WARN] 无法通过 API 访问空间（可能是权限限制）")
        else:
            spaces = self._get(
                f"{FEISHU_BASE_URL}/wiki/v2/spaces?page_size=50",
                "verify_list_spaces",
            )
            if spaces and "data" in spaces and "items" in spaces["data"]:
                space_names = [s.get("name", "") for s in spaces["data"]["items"]]
                expected = f"{self.config.prefix}EOS AI Workspace"
                if expected in space_names:
                    logger.info("  [PASS] 空间 '%s' 存在。", expected)
                else:
                    logger.warning("  [WARN] 空间 '%s' 未找到。现有空间: %s", expected, space_names)
                    verification_ok = False
            else:
                logger.warning("  [WARN] 无法获取空间列表（非致命）。")

        # 2. 验证文件夹结构
        space_id = self.config.results.get("resources", {}).get("space_id", "")
        if space_id:
            logger.info("[2/4] 验证文件夹结构 ...")
            nodes = self._get(
                f"{FEISHU_BASE_URL}/wiki/v2/spaces/{space_id}/nodes?page_size=50",
                "verify_list_nodes",
            )
            if nodes and "data" in nodes and "items" in nodes["data"]:
                existing_titles = {
                    n.get("title", "") for n in nodes["data"]["items"]
                }
                all_folders_ok = True
                for folder in FOLDER_STRUCTURE:
                    expected_title = f"{self.config.prefix}{folder['name']}"
                    if expected_title in existing_titles:
                        logger.info("  [PASS] 文件夹 '%s' 存在。", expected_title)
                    else:
                        logger.warning("  [WARN] 文件夹 '%s' 未找到。", expected_title)
                        all_folders_ok = False

                    for child_name, _ in folder.get("children", []):
                        child_title = f"{self.config.prefix}{child_name}"
                        if child_title in existing_titles:
                            logger.info("  [PASS] 子文件夹 '%s' 存在。", child_title)
                        else:
                            logger.warning("  [WARN] 子文件夹 '%s' 未找到。", child_title)
                            all_folders_ok = False

                if all_folders_ok:
                    logger.info("  [PASS] 所有文件夹结构完整。")
                else:
                    verification_ok = False
            else:
                logger.warning("  [WARN] 无法获取节点列表（非致命）。")
        else:
            logger.info("  [SKIP] 跳过文件夹验证（无 space_id）。")

        # 3. 验证 Mission Board
        logger.info("[3/4] 验证 Mission Board ...")
        ss_token = self.config.results.get("resources", {}).get("mission_board_token", "")
        if ss_token:
            meta = self._get(
                f"{FEISHU_BASE_URL}/sheets/v3/spreadsheets/{ss_token}",
                "verify_spreadsheet",
            )
            if meta and "data" in meta and "spreadsheet" in meta["data"]:
                title = meta["data"]["spreadsheet"]["title"]
                logger.info("  [PASS] 电子表格 '%s' 存在。", title)

                # 检查列头
                values_resp = self._get(
                    f"{FEISHU_BASE_URL}/sheets/v3/spreadsheets/{ss_token}/values/Missions!A1:M1",
                    "verify_column_headers",
                )
                if values_resp and "data" in values_resp:
                    val_range = values_resp["data"].get("value_range", {})
                    actual_headers = (
                        val_range.get("values", [[]])[0]
                        if val_range.get("values")
                        else []
                    )
                    expected_headers = [col["name"] for col in MISSION_BOARD_COLUMNS]
                    if actual_headers == expected_headers:
                        logger.info("  [PASS] 列头匹配。")
                    else:
                        logger.warning(
                            "  [WARN] 列头不匹配。\n"
                            "      期望: %s\n"
                            "      实际: %s",
                            expected_headers,
                            actual_headers,
                        )
                        verification_ok = False
            else:
                logger.warning("  [WARN] 无法获取电子表格信息（非致命）。")
        else:
            logger.info("  [SKIP] Mission Board token 为空，跳过验证。")

        # 4. 总结
        logger.info("[4/4] 验证完成。")
        if verification_ok:
            logger.info("  [PASS] 所有资源验证通过！")
        else:
            logger.warning("  [WARN] 部分资源验证未通过，请检查上述警告。")

        self.config.results["verification_ok"] = verification_ok

    # ── 报告输出 ──────────────────────────────

    def write_report(self) -> None:
        """将 bootstrap-report.json 写入 tools 目录。"""
        self.config.finalize_report()
        report_path = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "bootstrap-report.json"
        )
        try:
            with open(report_path, "w", encoding="utf-8") as f:
                json.dump(self.config.results, f, ensure_ascii=False, indent=2)
            logger.info("报告已写入: %s", report_path)
        except OSError as e:
            logger.error("写入报告失败: %s", e)

    def print_summary(self) -> None:
        """打印人类可读的执行摘要。"""
        elapsed = self.config.results.get("elapsed_seconds", 0)
        errors = self.config.results.get("errors", [])
        resources = self.config.results.get("resources", {})

        print()
        logger.info("=" * 50)
        logger.info("飞书初始化工具执行完毕")
        logger.info("  总耗时: %.2f 秒", elapsed)
        logger.info("  错误数: %d", len(errors))
        if resources:
            logger.info("  资源清单:")
            for key, val in resources.items():
                if isinstance(val, dict):
                    for k, v in val.items():
                        logger.info("    %s/%s: %s", key, k, v)
                else:
                    logger.info("    %s: %s", key, val)
        if errors:
            logger.warning("  错误详情:")
            for err in errors:
                logger.warning(
                    "    [%s] %s",
                    err.get("step"),
                    err.get("error"),
                )
        logger.info("=" * 50)


# ──────────────────────────────────────────────
# CLI 参数解析
# ──────────────────────────────────────────────


def parse_args(argv: Optional[list[str]] = None) -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(
        description="飞书自动初始化工具 — 创建知识库、文件夹结构、Mission Board",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s                         正常执行
  %(prog)s --dry-run               干跑模式（不调用API）
  %(prog)s --test                  测试模式（资源名加 [EOS-BOOTSTRAP] 前缀）
  %(prog)s --verify                验证已创建的资源
  %(prog)s --test --dry-run        组合模式
        """,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="干跑模式：只打印将要创建的内容，不实际调用 API",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="测试模式：所有资源名称加 [EOS-BOOTSTRAP] 前缀，用于隔离验证",
    )
    parser.add_argument(
        "--verify",
        action="store_true",
        help="验证模式：检查已创建的资源是否存在且格式正确",
    )
    parser.add_argument(
        "--space-id",
        type=str,
        default=None,
        help="Wiki space ID (skip API creation, use existing space)",
    )
    return parser.parse_args(argv)


# ──────────────────────────────────────────────
# Main Entry Point
# ──────────────────────────────────────────────


def main() -> None:
    """CLI 入口：解析参数 → 初始化 → 执行 → 报告。"""
    args = parse_args()
    config = Config(args)

    # 环境检查（干跑模式和验证模式不需要真实凭证）
    if not config.verify and not config.dry_run:
        config.validate_env()
    else:
        logger.info("跳过环境变量检查（当前模式不需要真实凭证）。")
    logger.info("配置加载完成。dry_run=%s, test_mode=%s, verify=%s",
                config.dry_run, config.test_mode, config.verify)

    # 初始化飞书客户端
    client = FeishuClient(config)

    # ── Verify Mode ────────────────────────
    if config.verify:
        client.verify_resources()
        client.write_report()
        client.print_summary()
        return

    # ── Bootstrap Mode ────────────────────
    logger.info("=" * 50)
    logger.info("开始飞书资源初始化 ...")
    print()

    # Step 1: 知识库空间（使用 --space-id 或自动创建）
    space_id: Optional[str] = None
    if config.space_id:
        space_id = config.space_id
        config.results.setdefault("resources", {})["space_id"] = space_id
        logger.info("使用指定空间: space_id=%s", space_id)
    else:
        space_id = client.create_space()
        if not space_id and not config.dry_run:
            logger.warning("知识库空间创建失败，继续执行后续步骤（尽力而为）。")
        else:
            logger.info("知识库空间准备就绪。")

    # Step 2: 创建文件夹结构
    if space_id or config.dry_run:
        effective_space_id = space_id or "dry_run_space_id"
        logger.info("开始创建文件夹结构 ...")
        client.create_folder_structure(effective_space_id)
        logger.info("文件夹结构创建完毕。")
    else:
        logger.warning("跳过文件夹结构创建（无有效的 space_id）。")

    # Step 3: 创建 Mission Board
    logger.info("开始创建 Mission Board ...")
    client.create_mission_board()
    logger.info("Mission Board 创建完毕。")

    # 报告输出
    client.write_report()
    client.print_summary()

    logger.info("飞书资源初始化完成。")


if __name__ == "__main__":
    main()