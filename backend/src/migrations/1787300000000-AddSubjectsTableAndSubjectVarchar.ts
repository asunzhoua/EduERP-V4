import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 动态学科目录：
 * 1) 新建 subjects 表（默认 31 条 + 教师自定义，软删）
 * 2) course.subject / contract.subject 由 enum 列改 varchar(32)，容纳自定义学科 code
 */
export class AddSubjectsTableAndSubjectVarchar1787300000000 implements MigrationInterface {
  name = 'AddSubjectsTableAndSubjectVarchar1787300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(32) NOT NULL,
        name VARCHAR(32) NOT NULL,
        category VARCHAR(32) NOT NULL,
        isDefault TINYINT(1) NOT NULL DEFAULT 0,
        sortOrder INT NOT NULL DEFAULT 0,
        createdBy BIGINT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        version INT NOT NULL DEFAULT 1,
        deletedAt DATETIME NULL,
        UNIQUE KEY UQ_subjects_code (code),
        KEY idx_subjects_category (category),
        KEY idx_subjects_deletedAt (deletedAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(
      `ALTER TABLE course MODIFY subject VARCHAR(32) NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE contract MODIFY subject VARCHAR(32) NOT NULL;`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS subjects;`);
    // 恢复 enum 列（最佳努力；存量自定义 code 在恢复时会被 MySQL 拒绝，仅用于回滚场景）
    await queryRunner.query(
      `ALTER TABLE course MODIFY subject ENUM('MATH','ENGLISH','CHINESE','PHYSICS','CHEMISTRY','ART','MUSIC','DANCE','SPORTS','CODING','OTHER') NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE contract MODIFY subject ENUM('MATH','ENGLISH','CHINESE','PHYSICS','CHEMISTRY','ART','MUSIC','DANCE','SPORTS','CODING','OTHER') NOT NULL;`,
    );
  }
}
