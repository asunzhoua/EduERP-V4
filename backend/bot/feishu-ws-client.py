#!/usr/bin/env python3
"""
feishu-ws-client.py — Feishu WebSocket Event Client

Connects to Feishu via long-connection WebSocket, receives events,
and forwards them to the local Bot Server HTTP endpoint.

Uses importlib to load lark_oapi's protobuf Frame without triggering
the full lark_oapi package import (which is too slow).
"""
import asyncio
import json
import logging
import os
import sys
import time
import urllib.request
import urllib.error

# Fix stdout encoding for emoji on Windows
if sys.stdout and hasattr(sys.stdout, "buffer"):
    sys.stdout = open(sys.stdout.fileno(), mode="w", encoding="utf-8",
                       buffering=1, closefd=False)

logger = logging.getLogger("WSClient")

# ══════════════════════════════════════════════════════════
# Load protobuf Frame (fast, no lark_oapi full import)
# ══════════════════════════════════════════════════════════
_FRAME = None
_GOGO_LOADED = False


def _load_frame_protobuf():
    """Load pbbp2_pb2.Frame using importlib to avoid slow lark_oapi import."""
    global _FRAME

    import types
    import importlib.util

    site_pkg = r'C:\Users\sunz\AppData\Local\QwenPaw\Lib\site-packages'
    if site_pkg not in sys.path:
        sys.path.insert(0, site_pkg)

    # Register parent namespace modules without executing __init__
    for name in ['lark_oapi', 'lark_oapi.ws', 'lark_oapi.ws.pb',
                  'lark_oapi.ws.pb.google', 'lark_oapi.ws.pb.google.protobuf']:
        if name in sys.modules:
            continue
        m = types.ModuleType(name)
        parts = name.split('.')
        base = os.path.join(site_pkg, 'lark_oapi', *parts[1:])
        m.__path__ = [base] if os.path.isdir(base) else []
        fp = os.path.join(base, '__init__.py')
        m.__file__ = fp if os.path.isfile(fp) else None
        sys.modules[name] = m

    # Load gogo_pb2 (dependency)
    global _GOGO_LOADED
    if not _GOGO_LOADED:
        gogo_path = os.path.join(site_pkg, 'lark_oapi', 'ws', 'pb', 'gogo_pb2.py')
        if os.path.exists(gogo_path):
            gogo_spec = importlib.util.spec_from_file_location('lark_oapi.ws.pb.gogo_pb2', gogo_path)
            gogo_mod = importlib.util.module_from_spec(gogo_spec)
            sys.modules['lark_oapi.ws.pb.gogo_pb2'] = gogo_mod
            gogo_spec.loader.exec_module(gogo_mod)
            _GOGO_LOADED = True

    # Load pbbp2_pb2
    pb_path = os.path.join(site_pkg, 'lark_oapi', 'ws', 'pb', 'pbbp2_pb2.py')
    spec = importlib.util.spec_from_file_location('lark_oapi.ws.pb.pbbp2_pb2', pb_path)
    pb_mod = importlib.util.module_from_spec(spec)
    sys.modules['lark_oapi.ws.pb.pbbp2_pb2'] = pb_mod
    spec.loader.exec_module(pb_mod)
    _FRAME = pb_mod.Frame


def create_frame(SeqID=0, LogID=0, service=0, method=0, headers=None,
                 payload_encoding=None, payload_type=None, payload=None):
    """Create a Feishu protobuf Frame."""
    f = _FRAME()
    f.SeqID = SeqID
    f.LogID = LogID
    f.service = service
    f.method = method
    if headers:
        for k, v in headers:
            h = f.headers.add()
            h.key = k
            h.value = v
    if payload_encoding:
        f.payload_encoding = payload_encoding
    if payload_type:
        f.payload_type = payload_type
    if payload is not None:
        f.payload = payload
    return f


def headers_to_dict(frame) -> dict:
    return {h.key: h.value for h in frame.headers}


# Frame type constants
FRAME_CONTROL = 1
FRAME_DATA = 2

# ══════════════════════════════════════════════════════════
# Configuration
# ══════════════════════════════════════════════════════════

FEISHU_APP_ID = os.environ.get("FEISHU_APP_ID", "").strip()
FEISHU_APP_SECRET = os.environ.get("FEISHU_APP_SECRET", "").strip()

# Fallback: read from Windows registry if env vars not available
if not FEISHU_APP_ID or not FEISHU_APP_SECRET:
    try:
        import subprocess
        result = subprocess.run(
            ["reg", "query", "HKCU\\Environment"],
            capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            parts = line.strip().split()
            if len(parts) >= 3:
                if "FEISHU_APP_ID" in parts[0]:
                    FEISHU_APP_ID = parts[-1].strip()
                elif "FEISHU_APP_SECRET" in parts[0]:
                    FEISHU_APP_SECRET = parts[-1].strip()
    except Exception:
        pass

BOT_SERVER_URL = os.environ.get("WS_FORWARD_URL", "http://127.0.0.1:8888/webhook/event")
FEISHU_DOMAIN = "https://open.feishu.cn"

# ══════════════════════════════════════════════════════════
# Token Helpers
# ══════════════════════════════════════════════════════════

def get_tenant_token() -> str:
    """Get Feishu tenant_access_token."""
    url = f"{FEISHU_DOMAIN}/open-apis/auth/v3/tenant_access_token/internal"
    body = json.dumps({"app_id": FEISHU_APP_ID, "app_secret": FEISHU_APP_SECRET}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    token = data.get("tenant_access_token")
    if not token:
        raise RuntimeError(f"Token API failed: {data.get('msg', 'unknown')}")
    return token


def forward_event(event_body: dict) -> None:
    """Forward Feishu event to bot server via HTTP POST."""
    try:
        payload = json.dumps(event_body, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            BOT_SERVER_URL,
            data=payload,
            headers={"Content-Type": "application/json; charset=utf-8"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            resp.read()
        logger.debug("Event forwarded OK")
    except Exception as exc:
        logger.error(f"Forward failed: {exc}")


def send_noop_response() -> None:
    """Send a quick request to bot server to unblock waiting."""
    # Just a lightweight GET to / to keep things alive
    try:
        req = urllib.request.Request(BOT_SERVER_URL + "?noop=1")
        with urllib.request.urlopen(req, timeout=5) as resp:
            resp.read()
    except Exception:
        pass


# ══════════════════════════════════════════════════════════
# WebSocket Client
# ══════════════════════════════════════════════════════════

async def get_ws_endpoint() -> str:
    """Get WS endpoint from Feishu API (POST /callback/ws/endpoint).

    Uses AppID + AppSecret directly (not bearer token).
    """
    url = f"{FEISHU_DOMAIN}/callback/ws/endpoint"
    body = json.dumps({"AppID": FEISHU_APP_ID, "AppSecret": FEISHU_APP_SECRET}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        logger.error(f"WS endpoint API: HTTP {e.code} {body[:200]}")
        return ""
    except Exception as exc:
        logger.error(f"WS endpoint request failed: {exc}")
        return ""

    if data.get("code") != 0:
        logger.error(f"WS endpoint error ({data.get('code','?')}): {data.get('msg', '')[:200]}")
        return ""
    data_body = data.get("data", {})
    ws_url = data_body.get("URL", "")
    if not ws_url:
        logger.error(f"WS endpoint: code=0 but empty URL. Full: {json.dumps(data, ensure_ascii=False)[:300]}")
        return ""
    logger.info(f"WS endpoint obtained (len={len(ws_url)})")
    return ws_url


async def ws_client_main():
    """Main WebSocket client coroutine."""
    logger.info("WS Client starting (importlib approach)...")

    # Load protobuf
    t0 = time.time()
    _load_frame_protobuf()
    logger.info(f"Protobuf loaded ({time.time()-t0:.2f}s)")

    # Get WS endpoint (POST /callback/ws/endpoint, uses AppID+AppSecret)
    endpoint = await get_ws_endpoint()
    if not endpoint:
        logger.error("Cannot get WS endpoint. Check credentials.")
        return

    import websockets
    retry_delay = 5
    max_retries = 10

    for attempt in range(max_retries):
        try:
            logger.info(f"Connecting to Feishu WS (attempt {attempt+1}/{max_retries})...")
            async with websockets.connect(
                endpoint,
                ping_interval=30,
                ping_timeout=10,
                max_size=2**20,  # 1MB max frame
            ) as ws:
                logger.info("WebSocket connected!")
                logger.info("Sending auth frame...")

                # No auth frame needed - authentication is handled via URL
                # parameters (access_key, ticket) obtained from the endpoint API.
                logger.info("Connected! Starting message receive loop...")

                # Main loop
                seq = 0
                while True:
                    try:
                        raw = await asyncio.wait_for(ws.recv(), timeout=70)
                    except asyncio.TimeoutError:
                        # Send ping
                        seq += 1
                        ping_frame = create_frame(
                            SeqID=seq, LogID=0, service=0, method=FRAME_CONTROL,
                            headers=[("type", "ping")],
                        )
                        try:
                            await ws.send(ping_frame.SerializeToString())
                            logger.debug("Ping sent")
                        except Exception:
                            logger.warning("Ping send failed, connection lost")
                            break
                        continue

                    frame = _FRAME()
                    frame.ParseFromString(raw)
                    hdrs = headers_to_dict(frame)

                    if frame.method == FRAME_CONTROL:
                        msg_type = hdrs.get("type", "")
                        if msg_type == "pong":
                            logger.debug("Pong received")
                        else:
                            logger.debug(f"Control frame: type={msg_type}")

                    elif frame.method == FRAME_DATA:
                        if frame.payload:
                            try:
                                event_data = json.loads(frame.payload.decode("utf-8"))
                                event_type = event_data.get("event_type",
                                                            event_data.get("header", {}).get("event_type", "?"))
                                logger.info(f"Received event: {event_type}")
                                forward_event(event_data)
                            except json.JSONDecodeError:
                                logger.error(f"Payload not JSON: {frame.payload[:100]}")

            logger.warning("Connection closed")
            break

        except asyncio.CancelledError:
            logger.info("Cancelled")
            break
        except websockets.exceptions.InvalidStatus as exc:
            logger.error(f"WS handshake failed (HTTP {exc.response.status_code if hasattr(exc,'response') else '?'}): check permissions")
            logger.error(f"Headers: {dict(exc.response.headers) if hasattr(exc,'response') else 'N/A'}")
            return
        except Exception as exc:
            logger.error(f"WS error (attempt {attempt+1}): {type(exc).__name__}: {exc}")
            if attempt < max_retries - 1:
                wait = retry_delay
                logger.info(f"Retrying in {wait}s...")
                await asyncio.sleep(wait)
                retry_delay = min(retry_delay * 1.5, 60)
            else:
                logger.error("Max retries exhausted")
                raise

    logger.info("WS Client exiting")


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [WSClient] %(levelname)s %(message)s",
        stream=sys.stdout,
    )
    logger.info(f"Forward URL: {BOT_SERVER_URL}")

    try:
        asyncio.run(ws_client_main())
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as exc:
        logger.error(f"Fatal error: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
