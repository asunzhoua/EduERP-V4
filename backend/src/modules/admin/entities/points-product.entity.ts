import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum PointsProductStatus {
  ON_SALE = 'ON_SALE',
  OFF_SALE = 'OFF_SALE',
}

export const PointsProductStatusLabels: Record<PointsProductStatus, string> = {
  [PointsProductStatus.ON_SALE]: '上架',
  [PointsProductStatus.OFF_SALE]: '下架',
};

@Entity('points_product')
export class PointsProduct {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true, name: 'coverImage' })
  coverImage: string | null;

  @Column({ type: 'int', default: 0, name: 'pointsPrice' })
  pointsPrice: number;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({
    type: 'enum',
    enum: PointsProductStatus,
    default: PointsProductStatus.OFF_SALE,
  })
  @Index()
  status: PointsProductStatus;

  @Column({ type: 'bigint', name: 'createdBy' })
  createdBy: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt: Date;

  @Column({ type: 'tinyint', default: 0 })
  deleted: boolean;
}
