import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { CourseStatus } from './enums/course-status.enum';
import { Subject } from '@common/enums/subject.enum';
import { CourseType } from './enums/course-type.enum';

@Entity('course')
export class CourseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Business Identity ───

  @Column({ type: 'varchar', length: 20, unique: true })
  @Index()
  courseCode: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: Subject })
  subject: Subject;

  @Column({ type: 'enum', enum: CourseType })
  type: CourseType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  // ─── Content Metrics ───

  @Column({ type: 'decimal', precision: 6, scale: 1 })
  totalHours: number;

  @Column({ type: 'int' })
  totalLessons: number;

  @Column({ type: 'int' })
  defaultDuration: number;

  // ─── Catalog Metadata ───

  @Column({ type: 'enum', enum: CourseStatus, default: CourseStatus.DRAFT })
  @Index()
  status: CourseStatus;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[] | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  coverImage: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // ─── Audit Fields ───

  @Column({ type: 'bigint' })
  createdBy: number;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number | null;

  @UpdateDateColumn()
  updateTime: Date;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;
}
