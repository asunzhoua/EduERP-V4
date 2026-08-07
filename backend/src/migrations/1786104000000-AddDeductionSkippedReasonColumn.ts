import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDeductionSkippedReasonColumn1786104000000 implements MigrationInterface {
  name = 'AddDeductionSkippedReasonColumn1786104000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`lesson_attendance\` ADD COLUMN \`deductionSkippedReason\` enum('NO_ACTIVE_CONTRACT','NO_SUBJECT') NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE \`lesson_attendance\` DROP COLUMN \`deductionSkippedReason\``,
    );
  }
}
