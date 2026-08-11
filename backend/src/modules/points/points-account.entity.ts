import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * 学生积分账户（一学生一行）。
 * 积分来源：课程完成（自动奖励）、管理员奖励。禁止前端直接修改。
 */
@Entity('points_account')
export class PointsAccount {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  studentCode: string;

  @Column({ type: 'int', default: 0 })
  balance: number;

  @Column({ type: 'int', default: 0, name: 'totalEarned' })
  totalEarned: number;

  @Column({ type: 'int', default: 0, name: 'totalSpent' })
  totalSpent: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;
}
