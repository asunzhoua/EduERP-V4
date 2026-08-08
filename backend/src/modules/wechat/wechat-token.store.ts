import { Injectable } from '@nestjs/common';

/**
 * access_token 内存缓存（单实例接缝）。
 *
 * 生产注意：多实例部署（集群/Serverless/容器）时，每个实例会各自请求并缓存 token，
 * 可能触发微信频率限制。多实例环境应替换为集中式缓存（Redis，TTL 约 119 分钟）。
 * 本项目当前单实例，内存缓存足够，此处以独立类收口便于未来替换。
 */
@Injectable()
export class WechatTokenStore {
  private token: string | null = null;
  private expiresAt = 0;

  set(token: string, ttlSeconds: number): void {
    this.token = token;
    this.expiresAt = Date.now() + ttlSeconds * 1000;
  }

  get(): string | null {
    if (!this.token) {
      return null;
    }
    if (Date.now() >= this.expiresAt) {
      this.token = null;
      return null;
    }
    return this.token;
  }

  clear(): void {
    this.token = null;
    this.expiresAt = 0;
  }
}
