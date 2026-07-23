import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  VersionColumn,
  Index,
} from 'typeorm';

export enum UserStatus {
  ACTIVE = 1,
  INACTIVE = 0,
  DISABLED = -1,
}

export enum UserRole {
  SUPER_ADMIN = 'SuperAdmin',
  ADMIN = 'Admin',
  TEACHER = 'Teacher',
  PARENT = 'Parent',
}

@Entity('user')
export class User {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 50, unique: true })
  username: string;

  @Column({ type: 'varchar', length: 255, select: false })
  password: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  mobile: string;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  openid: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  unionid: string;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @Column({ type: 'varchar', length: 50 })
  @Index()
  role: string;

  @Column({ type: 'tinyint', default: UserStatus.ACTIVE })
  @Index()
  status: UserStatus;

  @Column({ type: 'bigint', default: 0 })
  campusId: number;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt: Date;

  @Column({ type: 'varchar', length: 255, nullable: true })
  refreshToken: string;

  @Column({ type: 'timestamp', nullable: true })
  refreshTokenExpiresAt: Date;

  @CreateDateColumn()
  createTime: Date;

  @UpdateDateColumn()
  updateTime: Date;

  @VersionColumn({ default: 1 })
  version: number;

  @Column({ type: 'tinyint', default: 0 })
  deleted: boolean;
}
