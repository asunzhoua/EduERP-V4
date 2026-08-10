import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PointsAccount } from './points-account.entity';
import {
  PointsTransaction,
  PointsTransactionType,
} from './points-transaction.entity';
import {
  PointsProduct,
  PointsProductStatus,
} from '@modules/admin/entities/points-product.entity';
import {
  PointsExchangeRecord,
  PointsExchangeStatus,
} from '@modules/admin/entities/points-exchange-record.entity';
import { ReminderService } from '@modules/reminder/reminder.service';
import { ReminderType } from '@modules/reminder/enums/reminder-type.enum';
import { TargetType } from '@modules/reminder/enums/target-type.enum';

/** 每完成一节可扣课时课（到课/迟到/线上/线下）奖励的积分 */
export const POINTS_PER_ATTENDED_LESSON = 10;

export interface PointsRelated {
  type: string;
  id: string | number;
}

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(PointsAccount)
    private readonly accountRepo: Repository<PointsAccount>,
    @InjectRepository(PointsTransaction)
    private readonly txRepo: Repository<PointsTransaction>,
    @InjectRepository(PointsProduct)
    private readonly productRepo: Repository<PointsProduct>,
    @InjectRepository(PointsExchangeRecord)
    private readonly exchangeRepo: Repository<PointsExchangeRecord>,
    private readonly reminderService: ReminderService,
  ) {}

  // ─── 账户 ───

  private async ensureAccount(studentCode: string): Promise<PointsAccount> {
    let account = await this.accountRepo.findOne({ where: { studentCode } });
    if (!account) {
      account = this.accountRepo.create({
        studentCode,
        balance: 0,
        totalEarned: 0,
        totalSpent: 0,
      });
      account = await this.accountRepo.save(account);
    }
    return account;
  }

  /** 家长/学生端：当前积分 + 累计 + 最近流水 */
  async getSummary(studentCode: string): Promise<{
    balance: number;
    totalEarned: number;
    totalSpent: number;
    transactions: PointsTransaction[];
  }> {
    const account = await this.ensureAccount(studentCode);
    const transactions = await this.txRepo.find({
      where: { studentCode },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: 50,
    });
    return {
      balance: account.balance,
      totalEarned: account.totalEarned,
      totalSpent: account.totalSpent,
      transactions,
    };
  }

  // ─── 记账 ───

  async credit(
    studentCode: string,
    amount: number,
    description: string,
    related?: PointsRelated,
  ): Promise<PointsAccount> {
    if (amount <= 0) throw new BadRequestException('奖励积分必须为正数');
    const account = await this.ensureAccount(studentCode);
    account.balance += amount;
    account.totalEarned += amount;
    const saved = await this.accountRepo.save(account);
    await this.txRepo.save(
      this.txRepo.create({
        studentCode,
        type: PointsTransactionType.EARN,
        amount,
        balanceAfter: saved.balance,
        description,
        relatedType: related?.type ?? null,
        relatedId: related?.id != null ? String(related.id) : null,
      }),
    );
    return saved;
  }

  async debit(
    studentCode: string,
    amount: number,
    description: string,
    related?: PointsRelated,
  ): Promise<PointsAccount> {
    if (amount <= 0) throw new BadRequestException('扣减积分必须为正数');
    const account = await this.ensureAccount(studentCode);
    if (account.balance < amount) {
      throw new BadRequestException('积分不足，无法完成此操作');
    }
    account.balance -= amount;
    account.totalSpent += amount;
    const saved = await this.accountRepo.save(account);
    await this.txRepo.save(
      this.txRepo.create({
        studentCode,
        type: PointsTransactionType.SPEND,
        amount: -amount,
        balanceAfter: saved.balance,
        description,
        relatedType: related?.type ?? null,
        relatedId: related?.id != null ? String(related.id) : null,
      }),
    );
    return saved;
  }

  // ─── 积分商城（家长/学生端） ───

  /** 上架商品列表 */
  async listOnSaleProducts(): Promise<PointsProduct[]> {
    return this.productRepo.find({
      where: { status: PointsProductStatus.ON_SALE, deleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 兑换商品：校验库存与积分 → 扣积分 → 减库存 → 写兑换记录 → 推送消息。
   * 事务由调用方（controller）保证，这里顺序执行并做必要的业务校验。
   */
  async exchange(
    studentCode: string,
    studentName: string,
    productId: number,
    quantity: number,
    notifyUserId: number,
  ): Promise<PointsExchangeRecord> {
    const qty = quantity > 0 ? Math.floor(quantity) : 1;
    const product = await this.productRepo.findOne({
      where: { id: productId, deleted: false },
    });
    if (!product) throw new NotFoundException('商品不存在');
    if (product.status !== PointsProductStatus.ON_SALE) {
      throw new BadRequestException('商品已下架');
    }
    if (product.stock < qty) {
      throw new BadRequestException('库存不足');
    }

    const totalCost = product.pointsPrice * qty;
    // 先校验积分足够，再扣减
    await this.debit(studentCode, totalCost, `兑换「${product.name}」×${qty}`, {
      type: 'POINTS_PRODUCT',
      id: productId,
    });

    // 减库存
    product.stock -= qty;
    await this.productRepo.save(product);

    // 写兑换记录
    const record = await this.exchangeRepo.save(
      this.exchangeRepo.create({
        productId,
        productName: product.name,
        studentCode,
        studentName,
        pointsCost: totalCost,
        quantity: qty,
        status: PointsExchangeStatus.COMPLETED,
      }),
    );

    // 兑换成功自动推送消息
    await this.reminderService
      .createReminder({
        type: ReminderType.SYSTEM,
        title: '积分兑换成功',
        content: `您已成功兑换「${product.name}」×${qty}，消耗 ${totalCost} 积分。`,
        targetUserId: notifyUserId,
        targetType: TargetType.STUDENT,
        relatedEntityId: record.id,
        relatedEntityType: 'POINTS_EXCHANGE',
      })
      .catch((err) => undefined); // 推送失败不影响兑换主流程

    return record;
  }
}
