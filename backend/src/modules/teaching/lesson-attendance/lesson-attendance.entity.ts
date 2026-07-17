import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { AttendanceStatus } from './enums/attendance-status.enum';
import { AttendanceWorkflowState } from './enums/attendance-workflow-state.enum';
import { AttendanceSource } from './enums/attendance-source.enum';

/**
 * One record per student per lesson.
 *
 * Two-dimensional state design:
 *   - workflowState: lifecycle process (PENDING → CHECKED_IN → CONFIRMED → LOCKED)
 *   - status: what happened to the student (PRESENT, ABSENT, LATE, etc.)
 *
 * See: docs/DomainModel/AttendanceDomainModel.md
 * See: docs/StateMachine/AttendanceStateMachine.md
 */
@Entity('lesson_attendance')
@Unique(['lessonId', 'studentCode'])
export class LessonAttendanceEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  @Index()
  lessonId: number;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  studentCode: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  classCode: string;

  @Column({ type: 'bigint' })
  teacherId: number;

  @Column({
    type: 'enum',
    enum: AttendanceWorkflowState,
    default: AttendanceWorkflowState.PENDING,
  })
  @Index()
  workflowState: AttendanceWorkflowState;

  @Column({
    type: 'enum',
    enum: AttendanceStatus,
    nullable: true,
  })
  status: AttendanceStatus | null;

  @Column({ type: 'timestamp', nullable: true })
  checkInTime: Date | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'bigint' })
  operator: number;

  @Column({
    type: 'enum',
    enum: AttendanceSource,
    default: AttendanceSource.API,
  })
  source: AttendanceSource;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
