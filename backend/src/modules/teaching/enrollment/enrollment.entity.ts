import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { EnrollmentStatus } from '@common/enums/enrollment-status.enum';

@Entity('enrollment')
@Unique(['classCode', 'studentCode'])
export class EnrollmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Bridge Identity ───

  @Column({ type: 'varchar', length: 20 })
  @Index()
  classCode: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  studentCode: string;

  // ─── Financial Link ───

  // 家长添加孩子可选班级时无合同，contractCode 可为空（分班与合同解耦）
  @Column({ type: 'varchar', length: 20, nullable: true })
  @Index()
  contractCode: string | null;

  // ─── Status ───

  @Column({
    type: 'enum',
    enum: EnrollmentStatus,
    default: EnrollmentStatus.ACTIVE,
  })
  @Index()
  status: EnrollmentStatus;

  // ─── Withdrawal ───

  @Column({ type: 'text', nullable: true })
  withdrawReason: string | null;

  // ─── Audit ───

  @Column({ type: 'bigint' })
  enrolledBy: number;

  @CreateDateColumn()
  enrolledAt: Date;
}
