import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

/** 用户订阅关系 + 配额（授权 +1，发送 -1）。一个用户一个模板一条记录。 */
@Entity('wechat_subscribe')
@Unique(['userId', 'templateType'])
export class WechatSubscribe {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  @Index()
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  templateType: string;

  @Column({ type: 'varchar', length: 100 })
  templateId: string;

  @Column({ type: 'int', default: 0 })
  quota: number;

  @Column({ type: 'timestamp', nullable: true })
  lastSubscribedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
