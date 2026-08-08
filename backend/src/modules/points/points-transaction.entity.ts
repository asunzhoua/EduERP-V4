import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/** 积分流水类型 */
export enum PointsTransactionType {
  EARN = 'EARN', // 收入（课程完成/管理员奖励）
  SPEND = 'SPEND', // 支出（商城兑换）
  ADJUST = 'ADJUST', // 管理员调整（扣减）
}

/**
 * 积分流水账本。amount 为有符号数：EARN 为正，SPEND/ADJUST 为负。
 * balanceAfter 为该笔发生后的账户余额。
 */
@Entity('points_transaction')
export class PointsTransaction {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  studentCode: string;

  @Column({ type: 'varchar', length: 20 })
  type: PointsTransactionType;

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int', name: 'balanceAfter' })
  balanceAfter: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true, name: 'relatedType' })
  relatedType: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'relatedId' })
  relatedId: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;
}
