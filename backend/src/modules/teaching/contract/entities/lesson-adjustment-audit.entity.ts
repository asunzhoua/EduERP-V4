import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import {
  LessonAdjustmentAction,
  LessonAdjustmentSource,
} from '../enums/lesson-adjustment.enums';

/**
 * 课时变更审计（管理端提醒/追溯）。
 * 每次课时「分配类」变更写一行：谁、何时、因何、前后值。
 * 数据源：手动调整 adjustLessons / 合同创建 / 课时批量导入 / 优惠活动。
 */
@Entity('lesson_adjustment_audit')
export class LessonAdjustmentAudit {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  @Index()
  contractId: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  contractCode: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  studentCode: string;

  @Column({ type: 'enum', enum: LessonAdjustmentAction })
  action: LessonAdjustmentAction;

  @Column({ type: 'int' })
  beforeTotal: number;

  @Column({ type: 'int' })
  afterTotal: number;

  @Column({ type: 'int' })
  beforeRemaining: number;

  @Column({ type: 'int' })
  afterRemaining: number;

  /** 变更量（剩余课时的增减，正=增 负=减） */
  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null;

  @Column({ type: 'enum', enum: LessonAdjustmentSource })
  source: LessonAdjustmentSource;

  @Column({ type: 'bigint' })
  operatorId: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  operatorName: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
