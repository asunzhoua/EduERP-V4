import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuthedRequest } from '@common/types/authed-request';
import { OperationLogsService } from './operation-logs.service';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** 从 URL 提取模块名：/api/v1/students/:id → students */
function resolveModule(path: string): string | null {
  const parts = path.split('/').filter(Boolean);
  // 去掉 api/v1 前缀
  const idx = parts.findIndex((p) => p === 'v1');
  const rest = idx >= 0 ? parts.slice(idx + 1) : parts;
  if (rest.length === 0) return null;
  return rest[0];
}

function resolveAction(method: string): string {
  switch (method) {
    case 'POST':
      return 'CREATE';
    case 'PUT':
    case 'PATCH':
      return 'UPDATE';
    case 'DELETE':
      return 'DELETE';
    default:
      return method;
  }
}

/**
 * 全局操作日志拦截器：
 * - 仅记录已认证用户的写操作（POST/PUT/PATCH/DELETE）
 * - 跳过公开路由（无 req.user，如登录）
 * - 异步写入，失败静默，不影响主流程
 * - 记录：时间/人员/角色/动作/模块/资源/详情/IP
 */
@Injectable()
export class OperationLogInterceptor implements NestInterceptor {
  constructor(private readonly logsService: OperationLogsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const method: string = req.method || '';
    const user = req.user as
      { sub: number; username?: string; role?: string } | undefined;

    if (MUTATING_METHODS.has(method.toUpperCase()) && user?.sub) {
      const path: string = req.originalUrl || req.url || '';
      const params = req.params || {};
      const resourceId =
        params.id !== undefined
          ? String(params.id)
          : params.code !== undefined
            ? String(params.code)
            : undefined;
      const body = (req.body || {}) as Record<string, unknown>;
      let detail: string | null = null;
      try {
        const safeBody = { ...body };
        delete safeBody.password;
        const json = JSON.stringify(safeBody);
        detail = json.length > 500 ? `${json.slice(0, 500)}…` : json;
      } catch {
        detail = null;
      }

      void this.logsService
        .write({
          userId: Number(user.sub),
          username: user.username || String(user.sub),
          role: user.role || '',
          method: method.toUpperCase(),
          path,
          action: resolveAction(method.toUpperCase()),
          module: resolveModule(path),
          resourceId,
          detail,
          ip: req.ip,
        })
        .catch(() => undefined);
    }

    return next.handle();
  }
}
