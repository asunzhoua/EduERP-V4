import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWechatSubscribeTables1786400000000 implements MigrationInterface {
  name = 'AddWechatSubscribeTables1786400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 用户订阅关系 + 配额：一个用户一个模板一条记录，授权 +1 / 发送 -1
    await queryRunner.query(`
      CREATE TABLE wechat_subscribe (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT NOT NULL,
        templateType VARCHAR(50) NOT NULL,
        templateId VARCHAR(100) NOT NULL,
        quota INT NOT NULL DEFAULT 0,
        lastSubscribedAt TIMESTAMP NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uk_wechat_subscribe_user_template (userId, templateType),
        INDEX idx_wechat_subscribe_userId (userId),
        INDEX idx_wechat_subscribe_templateType (templateType)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 订阅消息发送日志：sent / failed / skipped
    await queryRunner.query(`
      CREATE TABLE wechat_message_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        messageId VARCHAR(50) NOT NULL,
        userId BIGINT NOT NULL,
        templateType VARCHAR(50) NOT NULL,
        templateId VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL,
        data TEXT NULL,
        page VARCHAR(200) NULL,
        wechatErrcode INT NULL,
        wechatErrmsg VARCHAR(200) NULL,
        relatedEntityId BIGINT NULL,
        relatedEntityType VARCHAR(50) NULL,
        sentAt TIMESTAMP NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_wechat_message_log_userId (userId),
        INDEX idx_wechat_message_log_templateType (templateType),
        INDEX idx_wechat_message_log_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS wechat_message_log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS wechat_subscribe;`);
  }
}
