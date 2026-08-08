import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('operation_log')
export class OperationLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint', name: 'userId' })
  @Index()
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  username: string;

  @Column({ type: 'varchar', length: 20 })
  role: string;

  @Column({ type: 'varchar', length: 10 })
  method: string;

  @Column({ type: 'varchar', length: 255 })
  path: string;

  /** 操作类型：CREATE / UPDATE / DELETE / LOGIN / IMPORT ... */
  @Column({ type: 'varchar', length: 50 })
  action: string;

  /** 所属模块：student / teacher / class / course / contract / enrollment / lesson / leave / salary / settings / points ... */
  @Column({ type: 'varchar', length: 50, nullable: true })
  module: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'resourceId' })
  resourceId: string | null;

  /** 操作详情（如修改前后摘要、原因等） */
  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  @Index()
  createdAt: Date;
}
