import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LessonExceptionEntity } from './lesson-exception.entity';

@Entity('lesson_exception_logs')
@Index('idx_exception_id', ['exceptionId'])
@Index('idx_operated_at', ['operatedAt'])
export class LessonExceptionLogEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  exceptionId: number;

  @Column({ type: 'varchar', length: 32 })
  fromStatus: string;

  @Column({ type: 'varchar', length: 32 })
  toStatus: string;

  @Column({ type: 'varchar', length: 16, default: 'USER' })
  operatorType: string; // SYSTEM, USER

  @Column({ type: 'bigint', nullable: true })
  operatorId: number;

  @Column({ type: 'datetime' })
  operatedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remark: string;

  @ManyToOne(() => LessonExceptionEntity)
  @JoinColumn({ name: 'exceptionId' })
  exception: LessonExceptionEntity;
}
