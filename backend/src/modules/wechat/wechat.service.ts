import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as https from 'https';
import { User } from '../identity/entities/user.entity';
import { WechatSubscribe } from './entities/wechat-subscribe.entity';
import { WechatMessageLog } from './entities/wechat-message-log.entity';
import { WechatTokenStore } from './wechat-token.store';
import { findOversizedField } from './constants/templates';
import { appConfig } from '@config/configuration';
import { AppLogger } from '@utils/logger';

export interface SendSubscribeInput {
  userId: number;
  templateType: string;
  data: Record<string, { value: string }>;
  page?: string;
  relatedEntityId?: number;
  relatedEntityType?: string;
}

interface SendResult {
  ok: boolean;
  errcode?: number;
  errmsg?: string;
}

/** 微信 access_token 接口响应。 */
interface WxTokenResponse {
  access_token?: string;
  errcode?: number;
  errmsg?: string;
}

/** 微信订阅消息发送接口响应。 */
interface WxSendResponse {
  errcode?: number;
  errmsg?: string;
}

/** 可重试的错误码：网络错误(-1)、token 失效(40001)、频率限制(45009/45029)。 */
const RETRYABLE_ERRCODES = [-1, 40001, 45009, 45029];
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS = [500, 1000];

@Injectable()
export class WechatService {
  private logger = new AppLogger();

  constructor(
    @InjectRepository(WechatSubscribe)
    private subscribeRepo: Repository<WechatSubscribe>,
    @InjectRepository(WechatMessageLog)
    private messageLogRepo: Repository<WechatMessageLog>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private tokenStore: WechatTokenStore,
  ) {}

  /**
   * 获取 access_token：优先返回缓存，未配置 appid/secret 或获取失败返回 null（供静默降级）。
   * 配置为懒读取（appConfig() 调用时读 process.env），便于测试注入。
   */
  async getAccessToken(): Promise<string | null> {
    const cached = this.tokenStore.get();
    if (cached) {
      return cached;
    }

    const wechatConfig = appConfig().wechat;
    if (!wechatConfig.appid || !wechatConfig.secret) {
      return null;
    }

    const token = await this.fetchAccessToken(
      wechatConfig.appid,
      wechatConfig.secret,
    );
    if (token) {
      this.tokenStore.set(token, 7200);
    }
    return token;
  }

  /**
   * 发送一条订阅消息。所有前置不满足均写 skipped 日志后静默返回，不影响业务主流程。
   */
  async sendSubscribeMessage(input: SendSubscribeInput): Promise<void> {
    const {
      userId,
      templateType,
      data,
      page,
      relatedEntityId,
      relatedEntityType,
    } = input;

    const user = await this.userRepo.findOne({
      where: { id: userId, deleted: false },
    });
    if (!user || !user.openid) {
      await this.writeLog({
        userId,
        templateType,
        templateId: '',
        status: 'skipped',
        data,
        page,
        relatedEntityId,
        relatedEntityType,
      });
      return;
    }

    const sub = await this.subscribeRepo.findOne({
      where: { userId, templateType },
    });
    const templateId = this.getTemplateId(templateType, sub);
    if (!templateId) {
      await this.writeLog({
        userId,
        templateType,
        templateId,
        status: 'skipped',
        data,
        page,
        relatedEntityId,
        relatedEntityType,
      });
      return;
    }

    if (!sub || sub.quota <= 0) {
      await this.writeLog({
        userId,
        templateType,
        templateId,
        status: 'skipped',
        data,
        page,
        relatedEntityId,
        relatedEntityType,
      });
      return;
    }

    const oversized = findOversizedField(templateType, data);
    if (oversized) {
      this.logger.error(
        `[WeChatSend] field too long: template=${templateType}, field=${oversized}`,
      );
      await this.writeLog({
        userId,
        templateType,
        templateId,
        status: 'skipped',
        data,
        page,
        relatedEntityId,
        relatedEntityType,
      });
      return;
    }

    const accessToken = await this.getAccessToken();
    if (!accessToken) {
      await this.writeLog({
        userId,
        templateType,
        templateId,
        status: 'skipped',
        data,
        page,
        relatedEntityId,
        relatedEntityType,
      });
      return;
    }

    const result = await this.sendWithRetry(
      accessToken,
      user.openid,
      templateId,
      data,
      page,
    );

    await this.writeLog({
      messageId: `MSG_${Date.now()}_${userId}_${templateType}`,
      userId,
      templateType,
      templateId,
      status: result.ok ? 'sent' : 'failed',
      data,
      page,
      relatedEntityId,
      relatedEntityType,
      wechatErrcode: result.errcode ?? null,
      wechatErrmsg: result.errmsg ?? null,
      sentAt: result.ok ? new Date() : null,
    });

    if (result.ok) {
      await this.consumeQuota(userId, templateType);
    } else {
      this.logger.error(
        `[WeChatSend] failed: userId=${userId}, template=${templateType}, errcode=${result.errcode}, errmsg=${result.errmsg}`,
      );
    }
  }

  private getTemplateId(
    templateType: string,
    sub?: WechatSubscribe | null,
  ): string {
    if (sub && sub.templateId) {
      return sub.templateId;
    }
    const templates: Record<string, string> =
      appConfig().wechat.subscribeTemplates || {};
    return templates[templateType] || '';
  }

  private fetchAccessToken(
    appid: string,
    secret: string,
  ): Promise<string | null> {
    const url = new URL('https://api.weixin.qq.com/cgi-bin/token');
    url.searchParams.set('grant_type', 'client_credential');
    url.searchParams.set('appid', appid);
    url.searchParams.set('secret', secret);

    return new Promise((resolve) => {
      https
        .get(url.toString(), (res) => {
          let data = '';
          res.on('data', (chunk: string) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const result = JSON.parse(data) as WxTokenResponse;
              if (result.access_token) {
                resolve(result.access_token);
              } else {
                this.logger.error(
                  `[WeChatToken] get token failed: ${result.errmsg} (code=${result.errcode})`,
                );
                resolve(null);
              }
            } catch {
              this.logger.error(
                '[WeChatToken] get token response parse failed',
              );
              resolve(null);
            }
          });
        })
        .on('error', (err) => {
          this.logger.error(
            `[WeChatToken] HTTP request failed: ${err.message}`,
          );
          resolve(null);
        });
    });
  }

  private async sendWithRetry(
    accessToken: string,
    openid: string,
    templateId: string,
    data: Record<string, { value: string }>,
    page?: string,
  ): Promise<SendResult> {
    let result: SendResult = { ok: false, errcode: -1, errmsg: 'unreachable' };
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      result = await this.httpSend(accessToken, openid, templateId, data, page);
      if (result.ok || !this.isRetryable(result.errcode)) {
        return result;
      }
      if (attempt < RETRY_DELAYS.length) {
        await this.delay(RETRY_DELAYS[attempt]);
      }
    }
    return result;
  }

  private isRetryable(errcode?: number): boolean {
    if (errcode === undefined) {
      return true;
    }
    return RETRYABLE_ERRCODES.includes(errcode);
  }

  private httpSend(
    accessToken: string,
    openid: string,
    templateId: string,
    data: Record<string, { value: string }>,
    page?: string,
  ): Promise<SendResult> {
    const url = new URL(
      'https://api.weixin.qq.com/cgi-bin/message/subscribe/send',
    );
    url.searchParams.set('access_token', accessToken);

    const body = JSON.stringify({
      touser: openid,
      template_id: templateId,
      page: page || undefined,
      data,
    });

    return new Promise((resolve) => {
      const req = https.request(
        url.toString(),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          let responseData = '';
          res.on('data', (chunk: string) => {
            responseData += chunk;
          });
          res.on('end', () => {
            try {
              const result = JSON.parse(responseData) as WxSendResponse;
              if (result.errcode === 0) {
                resolve({ ok: true, errcode: 0, errmsg: result.errmsg });
              } else {
                resolve({
                  ok: false,
                  errcode: result.errcode,
                  errmsg: result.errmsg,
                });
              }
            } catch {
              resolve({ ok: false, errcode: -2, errmsg: 'parse-error' });
            }
          });
        },
      );
      req.on('error', (err) => {
        resolve({ ok: false, errcode: -1, errmsg: err.message });
      });
      req.write(body);
      req.end();
    });
  }

  /** 原子扣减配额：quota = quota - 1 WHERE quota > 0，避免并发超发。 */
  private async consumeQuota(
    userId: number,
    templateType: string,
  ): Promise<void> {
    await this.subscribeRepo
      .createQueryBuilder()
      .update(WechatSubscribe)
      .set({ quota: () => 'quota - 1' })
      .where(
        'userId = :userId AND templateType = :templateType AND quota > 0',
        {
          userId,
          templateType,
        },
      )
      .execute();
  }

  private async writeLog(entry: Partial<WechatMessageLog>): Promise<void> {
    try {
      const log = this.messageLogRepo.create({
        messageId:
          entry.messageId ||
          `MSG_${Date.now()}_${entry.userId || 0}_${entry.templateType || 'unknown'}`,
        userId: entry.userId,
        templateType: entry.templateType,
        templateId: entry.templateId || '',
        status: entry.status,
        data: entry.data || null,
        page: entry.page || null,
        wechatErrcode: entry.wechatErrcode ?? null,
        wechatErrmsg: entry.wechatErrmsg ?? null,
        relatedEntityId: entry.relatedEntityId ?? null,
        relatedEntityType: entry.relatedEntityType ?? null,
        sentAt: entry.sentAt ?? null,
      } as WechatMessageLog);
      await this.messageLogRepo.save(log);
    } catch (error) {
      this.logger.error(
        `Failed to write wechat message log: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
