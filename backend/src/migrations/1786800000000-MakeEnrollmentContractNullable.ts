import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * enrollment.contractCode 改为可空。
 * 家长添加孩子时可选班级，分班与合同解耦（无合同时 contractCode 为 NULL）。
 */
export class MakeEnrollmentContractNullable1786800000000 implements MigrationInterface {
  name = 'MakeEnrollmentContractNullable1786800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE enrollment MODIFY COLUMN contractCode varchar(20) NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE enrollment MODIFY COLUMN contractCode varchar(20) NOT NULL`,
    );
  }
}
