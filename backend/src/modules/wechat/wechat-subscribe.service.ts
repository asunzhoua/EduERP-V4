import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../identity/entities/user.entity';
import { WechatSubscribe } from './entities/wechat-subscribe.entity';
import { WECHAT_TEMPLATES } from './constants/templates';
import { appConfig } from '@config/configuration';

export interface RecordSubscriptionInput {
  templateId: string;
  templateType: string;
  status: string;
}

export interface WechatTemplateView {
  templateId: string;
  templateType: string;
  templateName: string;
  templateTitle: string;
  fields: string[];
  fieldDescriptions: Record<string, string>;
}

@Injectable()
export class WechatSubscribeService {
  constructor(
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(WechatSubscribe)
    private subscribeRepo: Repository<WechatSubscribe>,
  ) {}

  /** 返回内置 5 模板定义，templateId 从配置取（未配置返回空串占位）。 */
  getTemplates(): WechatTemplateView[] {
    const templates: Record<string, string> =
      appConfig().wechat.subscribeTemplates || {};
    return WECHAT_TEMPLATES.map((t) => ({
      templateId: templates[t.templateType] || '',
      templateType: t.templateType,
      templateName: t.name,
      templateTitle: t.title,
      fields: t.fields,
      fieldDescriptions: t.fieldDescriptions,
    }));
  }

  /**
   * 记录订阅授权：仅 accept 计入（存在 quota+1 / 不存在插入 quota=1），
   * reject/ban 忽略。必须已绑定 openid 才允许记录。
   */
  async recordSubscription(
    userId: number,
    subscriptions: RecordSubscriptionInput[],
  ): Promise<{ recorded: number }> {
    const user = await this.userRepo.findOne({
      where: { id: userId, deleted: false },
    });
    if (!user || !user.openid) {
      throw new BadRequestException('未绑定微信，无法订阅消息');
    }

    let recorded = 0;
    for (const sub of subscriptions) {
      if (sub.status !== 'accept') {
        continue;
      }

      const existing = await this.subscribeRepo.findOne({
        where: { userId, templateType: sub.templateType },
      });

      if (existing) {
        existing.templateId = sub.templateId;
        existing.quota += 1;
        existing.lastSubscribedAt = new Date();
        await this.subscribeRepo.save(existing);
      } else {
        await this.subscribeRepo.save(
          this.subscribeRepo.create({
            userId,
            templateType: sub.templateType,
            templateId: sub.templateId,
            quota: 1,
            lastSubscribedAt: new Date(),
          }),
        );
      }
      recorded += 1;
    }

    return { recorded };
  }

  /** 当前用户已订阅的列表（含模板名/配额/最近授权时间）。 */
  async getMySubscriptions(userId: number): Promise<
    Array<{
      templateType: string;
      templateName: string;
      quota: number;
      lastSubscribedAt: Date | null;
    }>
  > {
    const rows = await this.subscribeRepo.find({ where: { userId } });
    const nameByType = new Map(
      WECHAT_TEMPLATES.map((t) => [t.templateType, t.name]),
    );

    return rows.map((row) => ({
      templateType: row.templateType,
      templateName: nameByType.get(row.templateType) || row.templateType,
      quota: row.quota,
      lastSubscribedAt: row.lastSubscribedAt,
    }));
  }
}
