import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/** 微信订阅消息发送日志（sent / failed / skipped）。 */
@Entity('wechat_message_log')
export class WechatMessageLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50 })
  messageId: string;

  @Column({ type: 'bigint' })
  @Index()
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  templateType: string;

  @Column({ type: 'varchar', length: 100 })
  templateId: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  status: string;

  @Column({ type: 'simple-json', nullable: true })
  data: Record<string, unknown> | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  page: string | null;

  @Column({ type: 'int', nullable: true })
  wechatErrcode: number | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  wechatErrmsg: string | null;

  @Column({ type: 'bigint', nullable: true })
  relatedEntityId: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relatedEntityType: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sentAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
