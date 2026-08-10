import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelWriter {
  async generate(
    data: Array<Record<string, string | number | boolean | null | undefined>>,
    sheetName: string,
    columns?: string[],
    headers?: string[],
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (data.length === 0) {
      return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    // 列顺序：显式传入 columns 用之，否则取首行对象的 key
    const cols = columns && columns.length > 0 ? columns : Object.keys(data[0]);
    // 表头：显式传入中文 headers 则用之，否则回退列 key
    const head = headers && headers.length === cols.length ? headers : cols;
    const headerRow = worksheet.addRow(head);

    // Add data rows（按 columns key 取值，保证顺序一致）
    data.forEach((row) => {
      worksheet.addRow(cols.map((col) => row[col]));
    });

    // Style the header row: bold
    headerRow.font = { bold: true };

    // Auto-fit column widths
    cols.forEach((col, idx) => {
      const maxLen = data.reduce((max, row) => {
        const val = String(row[col] ?? '');
        return Math.max(max, val.length);
      }, col.length);
      worksheet.getColumn(idx + 1).width = Math.min(maxLen + 2, 50);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
