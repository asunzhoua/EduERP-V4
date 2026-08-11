import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { OutingRecordStatus } from '../enums/salary.enums';

/**
 * 外派课时记录
 *
 * 外派（外出）上课的课时数据源。现有 Lesson 表只承载班级课，外派无载体，
 * 故新增本表由管理员录入。结算时仅取 status=CONFIRMED 的记录计薪：
 *   每节外派课 = 1 节课时费（lessonPrice × lessonCount），生成 LESSON_FEE 记录，
 *   detail.outingId 溯源。
 *
 * @see docs/SALARY-DEEP-ANALYSIS-AND-FULLCHAIN-ROADMAP.md
 */
@Entity('outing_record')
export class OutingRecordEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── 归属 ───

  @Column({ type: 'bigint' })
  @Index()
  teacherId: number;

  // ─── 外派信息 ───

  @Column({ type: 'date' })
  @Index()
  outingDate: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string | null;

  /** 外派课时数（每节 = 1 节课时费） */
  @Column({ type: 'int', default: 1 })
  lessonCount: number;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // ─── 状态 ───

  @Column({
    type: 'enum',
    enum: OutingRecordStatus,
    default: OutingRecordStatus.PENDING,
  })
  @Index()
  status: OutingRecordStatus;

  // ─── 审计字段 ───

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn()
  updateTime: Date;
}
