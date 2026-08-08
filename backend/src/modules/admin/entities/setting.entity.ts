import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('setting')
export class Setting {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 100, unique: true, name: 'setting_key' })
  key: string;

  @Column({ type: 'text', nullable: true, name: 'setting_value' })
  value: string | null;

  @Column({ type: 'varchar', length: 50, default: 'system' })
  @Index()
  category: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  description: string | null;

  @Column({ type: 'bigint', nullable: true, name: 'updatedBy' })
  updatedBy: number | null;

  @CreateDateColumn({ name: 'createTime' })
  createTime: Date;

  @UpdateDateColumn({ name: 'updateTime' })
  updateTime: Date;
}
