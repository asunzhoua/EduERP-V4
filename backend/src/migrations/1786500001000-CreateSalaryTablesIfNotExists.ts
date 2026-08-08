import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSalaryTablesIfNotExists1786500001000 implements MigrationInterface {
  name = 'CreateSalaryTablesIfNotExists1786500001000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_rule (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        type ENUM('PER_LESSON','PER_DAY','PER_HEAD','TIER','PART_TIME','OUTING','MONTHLY','HOURLY') NOT NULL,
        baseAmount DECIMAL(10,2) NOT NULL,
        multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
        config JSON NULL,
        courseType VARCHAR(50) NULL,
        teacherLevel VARCHAR(50) NULL,
        isActive TINYINT NOT NULL DEFAULT 1,
        note TEXT NULL,
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_salary_rule_type (type),
        INDEX idx_salary_rule_isActive (isActive)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_record (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        teacherId BIGINT NOT NULL,
        lessonId BIGINT NULL,
        attendanceId BIGINT NULL,
        salaryRuleId BIGINT NOT NULL,
        source VARCHAR(20) NOT NULL DEFAULT 'LESSON_FEE',
        month CHAR(7) NOT NULL,
        ruleVersion VARCHAR(50) NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        lessonDate DATE NULL,
        duration INT NULL,
        studentCount INT NULL,
        detail JSON NULL,
        needsReview TINYINT NOT NULL DEFAULT 0,
        status ENUM('PENDING','APPROVED','PAID') NOT NULL DEFAULT 'PENDING',
        notes TEXT NULL,
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_salary_record_teacherId (teacherId),
        INDEX idx_salary_record_lessonId (lessonId),
        INDEX idx_salary_record_source (source),
        INDEX idx_salary_record_month (month),
        INDEX idx_salary_record_status (status),
        INDEX idx_salary_record_needsReview (needsReview),
        UNIQUE KEY uk_salary_record_teacher_month_source_lesson (teacherId, month, source, lessonId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS salary_record;`);
    await queryRunner.query(`DROP TABLE IF EXISTS salary_rule;`);
  }
}
