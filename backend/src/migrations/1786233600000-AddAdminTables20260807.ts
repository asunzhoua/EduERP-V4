import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminTables202608071786233600000 implements MigrationInterface {
  name = 'AddAdminTables202608071786233600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 系统设置：键值存储，按分类分组（校区信息/课程设置/工资规则/课时规则/消息模板/系统参数）
    await queryRunner.query(`
      CREATE TABLE setting (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) NOT NULL,
        setting_value TEXT NULL,
        category VARCHAR(50) NOT NULL DEFAULT 'system',
        description VARCHAR(200) NULL,
        updatedBy BIGINT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uk_setting_key (setting_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 统一操作日志：时间/人员/操作/模块/资源/详情
    await queryRunner.query(`
      CREATE TABLE operation_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        userId BIGINT NOT NULL,
        username VARCHAR(50) NOT NULL,
        role VARCHAR(20) NOT NULL,
        method VARCHAR(10) NOT NULL,
        path VARCHAR(255) NOT NULL,
        action VARCHAR(50) NOT NULL,
        module VARCHAR(50) NULL,
        resourceId VARCHAR(255) NULL,
        detail TEXT NULL,
        ip VARCHAR(50) NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_operation_log_userId (userId),
        INDEX idx_operation_log_createdAt (createdAt)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 积分商城商品：上下架 + 库存
    await queryRunner.query(`
      CREATE TABLE points_product (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        description TEXT NULL,
        coverImage VARCHAR(255) NULL,
        pointsPrice INT NOT NULL DEFAULT 0,
        stock INT NOT NULL DEFAULT 0,
        status ENUM('ON_SALE','OFF_SALE') NOT NULL DEFAULT 'OFF_SALE',
        createdBy BIGINT NOT NULL,
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        deleted TINYINT NOT NULL DEFAULT 0,
        INDEX idx_points_product_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 积分兑换记录
    await queryRunner.query(`
      CREATE TABLE points_exchange_record (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        productId BIGINT NOT NULL,
        productName VARCHAR(100) NOT NULL,
        studentCode VARCHAR(20) NOT NULL,
        studentName VARCHAR(50) NOT NULL,
        pointsCost INT NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        status ENUM('PENDING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
        createdAt DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX idx_points_exchange_student (studentCode),
        INDEX idx_points_exchange_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS points_exchange_record;`);
    await queryRunner.query(`DROP TABLE IF EXISTS points_product;`);
    await queryRunner.query(`DROP TABLE IF EXISTS operation_log;`);
    await queryRunner.query(`DROP TABLE IF EXISTS setting;`);
  }
}
