import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Leave request type — reason category for student absence.
 */
export enum LeaveType {
  SICK = 'SICK',
  PERSONAL = 'PERSONAL',
}

/**
 * Leave request lifecycle status.
 */
export enum LeaveRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

/**
 * Student leave request submitted by parent/student.
 *
 * One leave request = one student = one date (single-day leave).
 * Multi-day leave: submit separate requests per day.
 */
@Entity('leave_request')
export class LeaveRequestEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Student Identity ───

  @Column({ type: 'varchar', length: 20 })
  @Index()
  studentCode: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  classCode: string;

  // ─── Leave Details ───

  @Column({ type: 'enum', enum: LeaveType })
  leaveType: LeaveType;

  @Column({ type: 'date' })
  leaveDate: string;

  @Column({ type: 'text' })
  reason: string;

  // ─── Status & Review ───

  @Column({
    type: 'enum',
    enum: LeaveRequestStatus,
    default: LeaveRequestStatus.PENDING,
  })
  @Index()
  status: LeaveRequestStatus;

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
