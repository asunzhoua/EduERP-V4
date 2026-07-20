import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';
import { ClassStatus } from './enums/class-status.enum';

@Entity('class')
export class ClassEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Business Identity ───

  @Column({ type: 'varchar', length: 20, unique: true })
  classCode: string;

  @Column({ type: 'varchar', length: 20 })
  @Index()
  courseCode: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'enum', enum: ClassStatus, default: ClassStatus.DRAFT })
  @Index()
  status: ClassStatus;

  // ─── Schedule (Embedded per DEC-005-03) ───

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'int' })
  totalLessons: number;

  @Column({ type: 'int', default: 60 })
  defaultDuration: number;

  @Column({ type: 'simple-json' })
  dayOfWeek: number[];

  @Column({ type: 'varchar', length: 5 })
  startTime: string;

  @Column({ type: 'varchar', length: 5 })
  endTime: string;

  // ─── Capacity ───

  @Column({ type: 'int', default: 20 })
  maxStudents: number;

  // ─── Optional Fields ───

  @Column({ type: 'varchar', length: 100, nullable: true })
  room: string | null;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[] | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  // ─── Cancellation ───

  @Column({ type: 'text', nullable: true })
  cancelledReason: string | null;

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
  @Index()
  deleted: boolean;
}
