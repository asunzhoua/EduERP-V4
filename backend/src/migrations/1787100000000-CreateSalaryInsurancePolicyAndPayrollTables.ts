import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * P3 工资模块：五险一金政策版本表 + 发放批次 建表
 *
 * - salary_insurance_policy : 各城市五险一金政策（基数上下限 + 个人比例，城市 × 生效区间多版本）
 * - salary_payroll           : 发放批次（批量打包工资条 + 银行代发）
 *
 * 沿用 CreateSalaryProfileAndOutingTables 的建表写法：IF NOT EXISTS + BIGINT PK + DATETIME(6) 审计。
 */
export class CreateSalaryInsurancePolicyAndPayrollTables1787100000000
  implements MigrationInterface
{
  name = 'CreateSalaryInsurancePolicyAndPayrollTables1787100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_insurance_policy (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        city VARCHAR(50) NOT NULL,
        name VARCHAR(100) NOT NULL,
        effectiveFrom DATE NOT NULL,
        effectiveTo DATE NULL,
        socialBaseMin DECIMAL(10,2) NULL,
        socialBaseMax DECIMAL(10,2) NULL,
        socialBase DECIMAL(10,2) NULL,
        ratios JSON NULL,
        employerRatios JSON NULL,
        note TEXT NULL,
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX idx_insurance_policy_city (city),
        INDEX idx_insurance_policy_effectiveFrom (effectiveFrom)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS salary_payroll (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        month CHAR(7) NOT NULL,
        batchNo VARCHAR(30) NOT NULL,
        totalAmount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        status ENUM('DRAFT','CONFIRMED','PAID','CLOSED') NOT NULL DEFAULT 'DRAFT',
        detail JSON NULL,
        note TEXT NULL,
        createdBy BIGINT NOT NULL,
        createTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        updatedBy BIGINT NULL,
        updateTime DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE KEY uk_payroll_batchNo (batchNo),
        INDEX idx_payroll_month (month),
        INDEX idx_payroll_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS salary_payroll;`);
    await queryRunner.query(`DROP TABLE IF EXISTS salary_insurance_policy;`);
  }
}
