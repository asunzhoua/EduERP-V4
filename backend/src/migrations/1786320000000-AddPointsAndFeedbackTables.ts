import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPointsAndFeedbackTables20260808178632000000
  implements MigrationInterface
{
  name = 'AddPointsAndFeedbackTables20260808178632000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 学生积分账户（一学生一行）
    await queryRunner.query(`
      CREATE TABLE points_account (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        studentCode VARCHAR(20) NOT NULL,
        balance INT NOT NULL DEFAULT 0,
        totalEarned INT NOT NULL DEFAULT 0,
        totalSpent INT NOT NULL DEFAULT 0,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uk_points_account_student (studentCode),
        INDEX idx_points_account_student (studentCode)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 积分流水账本
    await queryRunner.query(`
      CREATE TABLE points_transaction (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        studentCode VARCHAR(20) NOT NULL,
        type VARCHAR(20) NOT NULL,
        amount INT NOT NULL,
        balanceAfter INT NOT NULL,
        description VARCHAR(255) NULL,
        relatedType VARCHAR(30) NULL,
        relatedId VARCHAR(50) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_points_transaction_student (studentCode),
        INDEX idx_points_transaction_created (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 课程反馈（教师填写，家长只读）
    await queryRunner.query(`
      CREATE TABLE lesson_feedback (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        lessonId BIGINT NOT NULL,
        studentCode VARCHAR(20) NOT NULL,
        teacherId BIGINT NOT NULL,
        content TEXT NULL,
        performance TEXT NULL,
        homework TEXT NULL,
        suggestion TEXT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE KEY uk_lesson_feedback (lessonId, studentCode),
        INDEX idx_lesson_feedback_student (studentCode),
        INDEX idx_lesson_feedback_lesson (lessonId),
        INDEX idx_lesson_feedback_teacher (teacherId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS lesson_feedback;`);
    await queryRunner.query(`DROP TABLE IF EXISTS points_transaction;`);
    await queryRunner.query(`DROP TABLE IF EXISTS points_account;`);
  }
}
