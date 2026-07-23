import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ReminderType } from '../enums/reminder-type.enum';
import { ReminderStatus } from '../enums/reminder-status.enum';
import { TargetType } from '../enums/target-type.enum';

@Entity('reminder')
export class Reminder {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'enum', enum: ReminderType })
  type: ReminderType;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'bigint' })
  @Index()
  targetUserId: number;

  @Column({ type: 'enum', enum: TargetType })
  targetType: TargetType;

  @Column({ type: 'enum', enum: ReminderStatus, default: ReminderStatus.PENDING })
  @Index()
  status: ReminderStatus;

  @Column({ type: 'bigint', nullable: true })
  relatedEntityId: number | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  relatedEntityType: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;
}
