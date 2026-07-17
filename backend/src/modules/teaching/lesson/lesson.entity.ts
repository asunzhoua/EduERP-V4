import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { LessonStatus } from './enums/lesson-status.enum';

@Entity('lesson')
@Unique(['classCode', 'lessonNumber'])
export class LessonEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Business Identity ───

  @Column({ type: 'varchar', length: 20 })
  @Index()
  classCode: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  courseCode: string;

  @Column({ type: 'int' })
  lessonNumber: number;

  // ─── Status ───

  @Column({ type: 'enum', enum: LessonStatus, default: LessonStatus.DRAFT })
  @Index()
  status: LessonStatus;

  // ─── Schedule ───

  @Column({ type: 'date' })
  scheduledDate: string;

  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  // ─── Teacher ───

  @Column({ type: 'bigint' })
  teacherId: number;

  // ─── Actual Times (filled during lifecycle) ───

  @Column({ type: 'timestamp', nullable: true })
  actualStartTime: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  actualEndTime: Date | null;

  // ─── Notes & Cancellation ───

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'text', nullable: true })
  cancelledReason: string | null;

  // ─── Makeup ───

  @Column({ type: 'boolean', default: false })
  isMakeup: boolean;

  @Column({ type: 'bigint', nullable: true })
  originLessonId: number | null;

  // ─── ChangeRequest Link ───

  @Column({ type: 'bigint', nullable: true })
  changeRequestId: number | null;

  // ─── Confirmation ───

  @Column({ type: 'bigint', nullable: true })
  confirmedBy: number | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  // ─── Audit ───

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createdAt: Date;
}
