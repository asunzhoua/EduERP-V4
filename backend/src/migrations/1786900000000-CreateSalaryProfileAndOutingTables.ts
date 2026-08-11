import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P1 工资模块：教师薪资档案 + 外派课时记录 建表
 *
 * - teacher_salary_profile : G8 教师个性化薪资档案（档案优先结算）
 * - outing_record           : 外派（外出）课时数据源，仅 CONFIRMED 计薪
 *
 * 参考 CreateSalaryTablesIfNotExists 的建表写法：IF NOT EXISTS + BIGINT PK + DATETIME(6) 审计。
 */
export class CreateSalaryProfileAndOutingTables1786900000000 implements MigrationInterface {
  name = 'CreateSalaryProfileAndOutingTables1786900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS teacher_salary_profile (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        teacherId BIGINT NOT NULL,
        employmentType ENUM('FULL_TIME','PART_TIME','OUTER') NOT NULL DEFAULT 'FULL_TIME',
        ruleType VARCHAR(20) NOT NULL,
        salaryConfig JSON NULL,
        allowances JSON NULL,
        deductions JSON NULL,
        effectiveFrom DATE NULL,
        effectiveTo DATE NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        note TEXT NULL,
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uk_salary_profile_teacherId (teacherId),
        INDEX idx_salary_profile_ruleType (ruleType),
        INDEX idx_salary_profile_isActive (isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS outing_record (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        teacherId BIGINT NOT NULL,
        outingDate DATE NOT NULL,
        location VARCHAR(100) NULL,
        lessonCount INT NOT NULL DEFAULT 1,
        note TEXT NULL,
        status ENUM('PENDING','CONFIRMED') NOT NULL DEFAULT 'PENDING',
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_outing_record_teacherId (teacherId),
        INDEX idx_outing_record_outingDate (outingDate),
        INDEX idx_outing_record_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS outing_record;`);
    await queryRunner.query(`DROP TABLE IF EXISTS teacher_salary_profile;`);
  }
}
