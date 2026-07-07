-- ============================================
-- EduOS V1.0 — Database Initialization Script
-- ============================================
-- 使用方法:
--   mysql -u root -p < init.sql
-- ============================================

CREATE DATABASE IF NOT EXISTS `EduOS`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `EduOS`;

-- 此处不建表，Sprint 2 开始按 Data Dictionary 建表

SELECT 'EduOS database created successfully' AS status;
