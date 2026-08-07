import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeductedContractIdColumn1786096800000 implements MigrationInterface {
  name = 'AddDeductedContractIdColumn1786096800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`lesson_attendance\` ADD COLUMN \`deductedContractId\` bigint NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`lesson_attendance\` DROP COLUMN \`deductedContractId\``,
    );
  }
}
