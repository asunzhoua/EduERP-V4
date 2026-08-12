import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P3 工资模块：社保 + 个税 总开关 全局配置表 建表
 *
 * - salary_config : 全局单例行（id=1）配置，enabled 为社保/个税总开关，默认关闭。
 *
 * 沿用 CreateSalaryInsurancePolicyAndPayrollTables 的建表写法：IF NOT EXISTS + BIGINT PK + DATETIME(6) 审计。
 */
export class CreateSalaryConfigTable1787200000000 implements MigrationInterface {
  name = 'CreateSalaryConfigTable1787200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_config (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        enabled TINYINT NOT NULL DEFAULT 0,
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 种子行（幂等）：id=1 单例行，默认关闭
    await queryRunner.query(`
      INSERT IGNORE INTO salary_config (id, enabled, createdBy) VALUES (1, 0, 1);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS salary_config;`);
  }
}
