import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSalaryConfigColumns1786500000000 implements MigrationInterface {
  name = 'AddSalaryConfigColumns1786500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── salary_rule ──
    await queryRunner.query(
      `ALTER TABLE salary_rule ADD COLUMN config json NULL AFTER multiplier;`,
    );
    await queryRunner.query(
      `ALTER TABLE salary_rule MODIFY COLUMN type ENUM('PER_LESSON','PER_DAY','PER_HEAD','TIER','PART_TIME','OUTING','MONTHLY','HOURLY') NOT NULL;`,
    );

    // ── salary_record ──
    // 状态机迁移：CONFIRMED → APPROVED
    await queryRunner.query(
      `UPDATE salary_record SET status='APPROVED' WHERE status='CONFIRMED';`,
    );
    // lessonId 改可空（BASE/DAY/BONUS/DEDUCTION 记录无课时）
    await queryRunner.query(`ALTER TABLE salary_record MODIFY COLUMN lessonId bigint NULL;`);
    // ruleVersion 修复：varchar(20) → varchar(50)，存 YYYY-MM-DD
    await queryRunner.query(`ALTER TABLE salary_record MODIFY COLUMN ruleVersion varchar(50) NOT NULL;`);
    await queryRunner.query(`ALTER TABLE salary_record MODIFY COLUMN lessonDate date NULL;`);
    await queryRunner.query(`ALTER TABLE salary_record MODIFY COLUMN duration int NULL;`);
    await queryRunner.query(
      `ALTER TABLE salary_record ADD COLUMN source varchar(20) NOT NULL DEFAULT 'LESSON_FEE' AFTER salaryRuleId;`,
    );
    await queryRunner.query(`ALTER TABLE salary_record ADD COLUMN month char(7) NULL AFTER source;`);
    await queryRunner.query(`ALTER TABLE salary_record ADD COLUMN studentCount int NULL AFTER duration;`);
    await queryRunner.query(`ALTER TABLE salary_record ADD COLUMN detail json NULL AFTER studentCount;`);
    await queryRunner.query(`ALTER TABLE salary_record ADD COLUMN needsReview tinyint NOT NULL DEFAULT 0 AFTER detail;`);
    await queryRunner.query(
      `UPDATE salary_record SET month = DATE_FORMAT(lessonDate, '%Y-%m') WHERE month IS NULL AND lessonDate IS NOT NULL;`,
    );
    await queryRunner.query(
      `ALTER TABLE salary_record MODIFY COLUMN status ENUM('PENDING','APPROVED','PAID') NOT NULL DEFAULT 'PENDING';`,
    );
    // 幂等唯一索引（lessonId 为 NULL 时 MySQL 允许多条，BASE/DAY/BONUS 靠应用层防重）
    await queryRunner.query(
      `ALTER TABLE salary_record ADD UNIQUE KEY uk_salary_record_teacher_month_source_lesson (teacherId, month, source, lessonId);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE salary_record DROP INDEX uk_salary_record_teacher_month_source_lesson;`,
    );
    await queryRunner.query(
      `ALTER TABLE salary_record MODIFY COLUMN status ENUM('PENDING','CONFIRMED','PAID') NOT NULL DEFAULT 'PENDING';`,
    );
    await queryRunner.query(`ALTER TABLE salary_record DROP COLUMN needsReview;`);
    await queryRunner.query(`ALTER TABLE salary_record DROP COLUMN detail;`);
    await queryRunner.query(`ALTER TABLE salary_record DROP COLUMN studentCount;`);
    await queryRunner.query(`ALTER TABLE salary_record DROP COLUMN month;`);
    await queryRunner.query(`ALTER TABLE salary_record DROP COLUMN source;`);
    await queryRunner.query(`ALTER TABLE salary_record MODIFY COLUMN duration int NOT NULL;`);
    await queryRunner.query(`ALTER TABLE salary_record MODIFY COLUMN lessonDate date NOT NULL;`);
    await queryRunner.query(`ALTER TABLE salary_record MODIFY COLUMN ruleVersion varchar(20) NOT NULL;`);
    await queryRunner.query(`ALTER TABLE salary_record MODIFY COLUMN lessonId bigint NOT NULL;`);
    await queryRunner.query(
      `ALTER TABLE salary_rule MODIFY COLUMN type ENUM('PER_LESSON','HOURLY','MONTHLY') NOT NULL;`,
    );
    await queryRunner.query(`ALTER TABLE salary_rule DROP COLUMN config;`);
  }
}
