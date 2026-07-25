import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Suspend request lifecycle status.
 */
export enum SuspendRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Student suspend (停课) request submitted by parent.
 *
 * When approved, the student's enrollment status changes to SUSPEND
 * for the duration, pausing attendance and contract deduction.
 */
@Entity('suspend_request')
export class SuspendRequestEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Student Identity ───

  @Column({ type: 'varchar', length: 20 })
  @Index()
  studentCode: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  classCode: string;

  // ─── Suspend Details ───

  @Column({ type: 'date' })
  suspendFrom: string;

  @Column({ type: 'date' })
  suspendTo: string;

  @Column({ type: 'text' })
  reason: string;

  // ─── Status & Review ───

  @Column({
    type: 'enum',
    enum: SuspendRequestStatus,
    default: SuspendRequestStatus.PENDING,
  })
  @Index()
  status: SuspendRequestStatus;

  @Column({ type: 'bigint', nullable: true })
  reviewedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  // ─── Audit ───

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
