import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P2 工资模块：个税政策版本表 + 工资条 建表
 *
 * - salary_tax_policy : 个税政策版本（起征点 + 7 档税率表，版本化 + 生效区间）
 * - salary_slip        : 工资条（teacherId + month 唯一，detail 存政策快照）
 *
 * 沿用 CreateSalaryProfileAndOutingTables 的建表写法：IF NOT EXISTS + BIGINT PK + DATETIME(6) 审计。
 */
export class CreateSalaryTaxPolicyAndSlipTables1787000000000
  implements MigrationInterface
{
  name = 'CreateSalaryTaxPolicyAndSlipTables1787000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_tax_policy (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        effectiveFrom DATE NOT NULL,
        effectiveTo DATE NULL,
        taxThreshold DECIMAL(10,2) NOT NULL DEFAULT 5000.00,
        brackets JSON NULL,
        note TEXT NULL,
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_tax_policy_effectiveFrom (effectiveFrom),
        INDEX idx_tax_policy_effectiveTo (effectiveTo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_slip (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        teacherId BIGINT NOT NULL,
        month CHAR(7) NOT NULL,
        grossAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        socialAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        taxAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        netAmount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        detail JSON NULL,
        status ENUM('PENDING','APPROVED','PAID') NOT NULL DEFAULT 'PENDING',
        needsReview TINYINT NOT NULL DEFAULT 0,
        notes TEXT NULL,
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uk_salary_slip_teacher_month (teacherId, month),
        INDEX idx_salary_slip_month (month),
        INDEX idx_salary_slip_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS salary_slip;`);
    await queryRunner.query(`DROP TABLE IF EXISTS salary_tax_policy;`);
  }
}
