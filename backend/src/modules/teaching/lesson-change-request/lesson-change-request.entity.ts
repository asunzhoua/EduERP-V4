import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ChangeRequestType } from '@common/enums/change-request-type.enum';
import { ChangeRequestStatus } from './enums/change-request-status.enum';

/**
 * Formal application for lesson changes.
 *
 * NOT a direct lesson edit. It is a governance mechanism:
 *   Teacher/Admin → Request → Approve → Execute → Audit
 *
 * See: docs/DomainModel/AttendanceDomainModel.md
 * See: docs/BusinessRules/LessonChangeRequestRules.md
 */
@Entity('lesson_change_request')
export class LessonChangeRequestEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  @Index()
  lessonId: number;

  @Column({ type: 'enum', enum: ChangeRequestType })
  @Index()
  requestType: ChangeRequestType;

  @Column({ type: 'bigint' })
  requestedBy: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({
    type: 'enum',
    enum: ChangeRequestStatus,
    default: ChangeRequestStatus.PENDING,
  })
  @Index()
  status: ChangeRequestStatus;

  @Column({ type: 'bigint', nullable: true })
  approvedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  approvedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  executedAt: Date | null;

  @Column({ type: 'bigint', nullable: true })
  executedBy: number | null;

  // ─── RESCHEDULE fields ───

  @Column({ type: 'date', nullable: true })
  previousDate: string | null;

  @Column({ type: 'date', nullable: true })
  newDate: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  previousStartTime: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  newStartTime: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  previousEndTime: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  newEndTime: string | null;

  // ─── TEACHER_CHANGE fields ───

  @Column({ type: 'bigint', nullable: true })
  previousTeacherId: number | null;

  @Column({ type: 'bigint', nullable: true })
  newTeacherId: number | null;

  @CreateDateColumn()
  createdAt: Date;
}
