import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('login_log')
export class LoginLog {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'bigint' })
  userId: number;

  @Column({ type: 'varchar', length: 50 })
  username: string;

  @Column({ type: 'varchar', length: 50 })
  action: string; // 'LOGIN' | 'LOGOUT' | 'REFRESH' | 'LOGIN_FAILED'

  @Column({ type: 'varchar', length: 50, nullable: true })
  role: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  ip: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  device: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  detail: string;

  @Column({ type: 'tinyint', default: 1 })
  success: boolean;

  @CreateDateColumn()
  createTime: Date;
}
