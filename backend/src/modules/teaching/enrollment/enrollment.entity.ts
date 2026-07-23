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

  @Column({ type: 'varchar', length: 20 })
  @Index()
  contractCode: string;

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
