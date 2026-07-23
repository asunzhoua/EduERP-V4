import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReminderTable20260724 implements MigrationInterface {
  name = 'AddReminderTable20260724';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE reminder (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        type ENUM('CLASS_REMINDER','ATTENDANCE_REMINDER','CONTRACT_EXPIRY','MISSION_STALL','SYSTEM') NOT NULL,
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        targetUserId BIGINT NOT NULL,
        targetType ENUM('STUDENT','TEACHER','ADMIN') NOT NULL,
        status ENUM('PENDING','READ','DISMISSED') NOT NULL DEFAULT 'PENDING',
        relatedEntityId BIGINT NULL,
        relatedEntityType VARCHAR(50) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        readAt DATETIME(6) NULL,
        INDEX idx_reminder_targetUserId (targetUserId),
        INDEX idx_reminder_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS reminder;`);
  }
}
