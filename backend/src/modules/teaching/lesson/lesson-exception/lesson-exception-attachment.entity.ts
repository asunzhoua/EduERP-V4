import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { LessonExceptionEntity } from './lesson-exception.entity';

@Entity('lesson_exception_attachments')
@Index('idx_exception_id', ['exceptionId'])
export class LessonExceptionAttachmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  exceptionId: number;

  @Column({ type: 'varchar', length: 16 })
  fileType: string; // IMAGE, PDF, OTHER

  @Column({ type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({ type: 'varchar', length: 255 })
  originalName: string;

  @Column({ type: 'datetime' })
  uploadedAt: Date;

  @Column({ type: 'bigint' })
  uploadedBy: number;

  @ManyToOne(() => LessonExceptionEntity)
  @JoinColumn({ name: 'exceptionId' })
  exception: LessonExceptionEntity;
}
