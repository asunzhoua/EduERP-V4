import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LessonEntity } from '../lesson.entity';

@Entity('lesson_exceptions')
@Index('idx_lesson_id', ['lessonId'])
@Index('idx_exception_type', ['exceptionType'])
@Index('idx_status', ['status'])
@Index('idx_created_by', ['createdBy'])
@Index('idx_created_at', ['createdAt'])
export class LessonExceptionEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  lessonId: number;

  @Column({ type: 'varchar', length: 32 })
  exceptionType: string; // LEAVE_SICK, LEAVE_PERSONAL, LEAVE_TRAINING, SUSPEND_SHORT, SUSPEND_LONG, MAKEUP_CLASS

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'datetime' })
  startTime: Date;

  @Column({ type: 'datetime', nullable: true })
  endTime: Date;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status: string; // PENDING, APPROVED, REJECTED, CANCELLED, EXPIRED

  @Column({ type: 'json', nullable: true })
  attachments: any;

  @Column({ type: 'bigint' })
  createdBy: number;

  @Column({ type: 'bigint', nullable: true })
  approvedBy: number;

  @Column({ type: 'datetime', nullable: true })
  approvedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rejectReason: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => LessonEntity)
  @JoinColumn({ name: 'lessonId' })
  lesson: LessonEntity;
}
