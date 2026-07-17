import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { TeacherRole } from '@common/enums/teacher-role.enum';

@Entity('teacher_assignment')
@Unique(['classCode', 'teacherId', 'role'])
export class TeacherAssignmentEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // ─── Foreign Keys ───

  @Column({ type: 'varchar', length: 20 })
  @Index()
  classCode: string;

  @Column({ type: 'bigint' })
  @Index()
  teacherId: number;

  // ─── Assignment Details ───

  @Column({ type: 'enum', enum: TeacherRole })
  role: TeacherRole;

  @Column({ type: 'date' })
  effectiveFrom: string;

  @Column({ type: 'date', nullable: true })
  effectiveTo: string | null;

  @Column({ type: 'bigint' })
  assignedBy: number;

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason: string | null;

  // ─── Audit Fields ───

  @CreateDateColumn()
  createTime: Date;
}
