/**
 * 工资模块建表脚本（node 直连 mysql2，替代已损坏的 typeorm:migration:run）
 *
 * 背景：memory 记载 typeorm:migration:run 因存量 reminder 表冲突已损坏，
 * 本项目新 migration 均为 CREATE TABLE IF NOT EXISTS，故参照先例用 mysql2 直连执行，
 * 不修复 typeorm 流程。本脚本覆盖 P1（rule/record/profile/outing）+
 * P2（tax_policy/slip）+ P3（insurance_policy/payroll）共 8 张表，
 * 并给 teacher_salary_profile 补齐 P2/P3 新增的 city/socialBase/socialRatios/taxSpecialDeductions 列。
 *
 * 用法：
 *   node scripts/run-salary-migrations.js
 *
 * 环境变量（与 backend/src/config/configuration.ts 一致，均有默认值）：
 *   DB_HOST / DB_PORT / DB_USERNAME / DB_PASSWORD / DB_DATABASE
 *   默认 localhost / 3306 / root / root / EduOS
 *
 * 幂等：全部 CREATE TABLE IF NOT EXISTS + ALTER 前查 information_schema，可重复执行。
 */

const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_DATABASE || 'EduOS',
  multipleStatements: true,
};

/** 建表 DDL（均幂等） */
const CREATE_TABLES = [
  // ── P1 ──
  `CREATE TABLE IF NOT EXISTS salary_rule (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS salary_record (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS teacher_salary_profile (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    teacherId BIGINT NOT NULL,
    employmentType ENUM('FULL_TIME','PART_TIME','OUTER') NOT NULL DEFAULT 'FULL_TIME',
    ruleType VARCHAR(20) NOT NULL,
    salaryConfig JSON NULL,
    allowances JSON NULL,
    deductions JSON NULL,
    city VARCHAR(50) NULL,
    socialBase DECIMAL(10,2) NULL,
    socialRatios JSON NULL,
    taxSpecialDeductions JSON NULL,
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS outing_record (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // ── P2 ──
  `CREATE TABLE IF NOT EXISTS salary_tax_policy (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS salary_slip (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  // ── P3 ──
  `CREATE TABLE IF NOT EXISTS salary_insurance_policy (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

  `CREATE TABLE IF NOT EXISTS salary_payroll (
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
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
];

/** 老库若已存在 profile 表（P1 旧结构），补齐 P2/P3 新增列（幂等：先查 information_schema） */
async function addProfileColumns(conn) {
  const cols = [
    { name: 'city', ddl: "ALTER TABLE teacher_salary_profile ADD COLUMN city VARCHAR(50) NULL AFTER deductions;" },
    { name: 'socialBase', ddl: 'ALTER TABLE teacher_salary_profile ADD COLUMN socialBase DECIMAL(10,2) NULL AFTER city;' },
    { name: 'socialRatios', ddl: 'ALTER TABLE teacher_salary_profile ADD COLUMN socialRatios JSON NULL AFTER socialBase;' },
    { name: 'taxSpecialDeductions', ddl: 'ALTER TABLE teacher_salary_profile ADD COLUMN taxSpecialDeductions JSON NULL AFTER socialRatios;' },
  ];
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'teacher_salary_profile'`,
    [config.database],
  );
  const existing = new Set(rows.map((r) => r.COLUMN_NAME));
  for (const c of cols) {
    if (!existing.has(c.name)) {
      await conn.query(c.ddl);
      console.log(`  + teacher_salary_profile.${c.name} 已新增`);
    } else {
      console.log(`  = teacher_salary_profile.${c.name} 已存在，跳过`);
    }
  }
}

/** 保持 typeorm migrations 表状态一致（幂等：IGNORE） */
async function syncMigrationsTable(conn) {
  const entries = [
    { timestamp: 1786500000000, name: 'AddSalaryConfigColumns1786500000000' },
    { timestamp: 1786500001000, name: 'CreateSalaryTablesIfNotExists1786500001000' },
    { timestamp: 1786900000000, name: 'CreateSalaryProfileAndOutingTables1786900000000' },
    { timestamp: 1787000000000, name: 'CreateSalaryTaxPolicyAndSlipTables1787000000000' },
    { timestamp: 1787100000000, name: 'CreateSalaryInsurancePolicyAndPayrollTables1787100000000' },
  ];
  for (const e of entries) {
    await conn.query(
      'INSERT IGNORE INTO migrations (timestamp, name) VALUES (?, ?)',
      [e.timestamp, e.name],
    );
  }
  console.log('  migrations 表已同步（IGNORE 幂等）');
}

async function main() {
  console.log(`连接数据库 ${config.host}:${config.port}/${config.database} ...`);
  const conn = await mysql.createConnection(config);
  try {
    console.log('建表（CREATE TABLE IF NOT EXISTS）：');
    for (const ddl of CREATE_TABLES) {
      await conn.query(ddl);
    }
    console.log('  8 张表已就绪（存在则跳过）');

    console.log('补齐 teacher_salary_profile 新列：');
    await addProfileColumns(conn);

    console.log('同步 typeorm migrations 状态：');
    await syncMigrationsTable(conn);

    const [tables] = await conn.query(
      "SHOW TABLES LIKE 'salary%'",
    );
    console.log('工资相关表：');
    for (const t of tables) {
      console.log(`  - ${t[Object.keys(t)[0]]}`);
    }
    console.log('完成 ✓');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error('脚本执行失败：', err.message);
  process.exit(1);
});
