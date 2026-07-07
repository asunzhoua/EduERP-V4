import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
} from 'typeorm';
import { StudentStatus } from '../enums/student-status.enum';
import { Gender } from '../enums/gender.enum';
import { CreatedSource } from '../enums/created-source.enum';

@Entity('student')
export class Student {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 20, unique: true })
  studentCode: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'enum', enum: Gender })
  gender: Gender;

  @Column({ type: 'date' })
  birthDate: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  school: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  grade: string | null;

  @Column({ type: 'simple-json', nullable: true })
  tags: string[] | null;

  @Column({ type: 'enum', enum: StudentStatus, default: StudentStatus.ACTIVE })
  status: StudentStatus;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'bigint', nullable: true })
  mergedToStudentId: number | null;

  // --- Audit fields ---
  @Column({ type: 'bigint' })
  createdBy: number;

  @Column({ type: 'enum', enum: CreatedSource, default: CreatedSource.API })
  createdSource: CreatedSource;

  @CreateDateColumn()
  createTime: Date;

  @Column({ type: 'bigint', nullable: true })
  updatedBy: number;

  @UpdateDateColumn()
  updateTime: Date;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ type: 'boolean', default: false })
  deleted: boolean;
}
