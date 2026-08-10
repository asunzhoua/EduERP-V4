import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 课时变更审计表（管理端提醒/追溯）。
 * 每次课时「分配类」变更写一行：谁、何时、因何、前后值。
 */
export class AddLessonAdjustmentAudit1786337391252 implements MigrationInterface {
  name = 'AddLessonAdjustmentAudit1786337391252';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS lesson_adjustment_audit (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        contractId BIGINT NOT NULL,
        contractCode VARCHAR(20) NOT NULL,
        studentCode VARCHAR(20) NOT NULL,
        action ENUM('ADD','DELETE','SET') NOT NULL,
        beforeTotal INT NOT NULL,
        afterTotal INT NOT NULL,
        beforeRemaining INT NOT NULL,
        afterRemaining INT NOT NULL,
        delta INT NOT NULL,
        reason VARCHAR(200) NULL,
        source ENUM('ADMIN_MANUAL','IMPORT','PROMO','CONTRACT_CREATE') NOT NULL,
        operatorId BIGINT NOT NULL,
        operatorName VARCHAR(50) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_audit_contract_id (contractId),
        INDEX idx_audit_contract_code (contractCode),
        INDEX idx_audit_student_code (studentCode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lesson_adjustment_audit;`);
  }
}
