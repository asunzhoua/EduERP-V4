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
import { LessonExceptionEntity } from './lesson-exception.entity';
import { LessonEntity } from '../lesson.entity';

@Entity('lesson_reschedules')
@Index('idx_original_lesson', ['originalLessonId'])
@Index('idx_new_lesson', ['newLessonId'])
export class LessonRescheduleEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  exceptionId: number;

  @Column({ type: 'bigint' })
  originalLessonId: number;

  @Column({ type: 'bigint', nullable: true })
  newLessonId: number;

  @Column({ type: 'datetime' })
  originalStart: Date;

  @Column({ type: 'datetime' })
  originalEnd: Date;

  @Column({ type: 'datetime' })
  rescheduledStart: Date;

  @Column({ type: 'datetime' })
  rescheduledEnd: Date;

  @Column({ type: 'varchar', length: 32, default: 'PENDING' })
  status: string; // PENDING, CONFIRMED, COMPLETED

  @Column({ type: 'bigint' })
  operatorId: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => LessonExceptionEntity)
  @JoinColumn({ name: 'exceptionId' })
  exception: LessonExceptionEntity;

  @ManyToOne(() => LessonEntity)
  @JoinColumn({ name: 'originalLessonId' })
  originalLesson: LessonEntity;

  @ManyToOne(() => LessonEntity)
  @JoinColumn({ name: 'newLessonId' })
  newLesson: LessonEntity;
}
