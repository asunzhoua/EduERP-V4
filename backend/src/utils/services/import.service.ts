import { Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ImportColumn {
  header: string;
  required?: boolean;
  validate?: (value: string, row: number) => string | null; // returns error message or null
}

export interface ImportRowResult {
  row: number;
  success: boolean;
  errors: string[];
  data: Record<string, string>;
}

export interface ImportReport {
  total: number;
  success: number;
  failure: number;
  details: ImportRowResult[];
  fileName: string;
}

export class ImportService {
  /**
   * Parse a buffer (xlsx or csv) into an array of row objects.
   */
  parseBuffer(buffer: Buffer, fileName: string): Record<string, string>[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Excel 文件中没有工作表');
    }
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
    return rows;
  }

  /**
   * Validate rows against a column schema and produce an ImportReport.
   */
  validateRows(
    rows: Record<string, string>[],
    columns: ImportColumn[],
    fileName: string,
  ): { validRows: Record<string, string>[]; report: ImportReport } {
    const details: ImportRowResult[] = [];
    const validRows: Record<string, string>[] = [];

    // Normalize headers: lowercase and trim
    const normalizedRows = rows.map((row) => {
      const normalized: Record<string, string> = {};
      for (const key of Object.keys(row)) {
        normalized[key.trim().toLowerCase()] = (row[key] || '').trim();
      }
      return normalized;
    });

    for (let i = 0; i < normalizedRows.length; i++) {
      const row = normalizedRows[i];
      const rowNum = i + 2; // +2 because row 1 is header, and we're 0-indexed
      const errors: string[] = [];

      for (const col of columns) {
        const value = row[col.header.toLowerCase()] || '';

        if (col.required && !value) {
          errors.push(`"${col.header}" 不能为空`);
        }

        if (col.validate && value) {
          const error = col.validate(value, rowNum);
          if (error) {
            errors.push(error);
          }
        }

        // Store the normalized value
        row[col.header.toLowerCase()] = value;
      }

      const result: ImportRowResult = {
        row: rowNum,
        success: errors.length === 0,
        errors,
        data: { ...row },
      };
      details.push(result);

      if (result.success) {
        validRows.push(row);
      }
    }

    const report: ImportReport = {
      total: rows.length,
      success: validRows.length,
      failure: rows.length - validRows.length,
      details,
      fileName,
    };

    return { validRows, report };
  }
}
