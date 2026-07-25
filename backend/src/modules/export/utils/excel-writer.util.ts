import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';

@Injectable()
export class ExcelWriter {
  async generate(data: any[], sheetName: string): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(sheetName);

    if (data.length === 0) {
      return Buffer.from(await workbook.xlsx.writeBuffer());
    }

    // Extract column headers from the first data object
    const columns = Object.keys(data[0]);
    const headerRow = worksheet.addRow(columns);

    // Add data rows
    data.forEach((row) => {
      worksheet.addRow(columns.map((col) => row[col]));
    });

    // Style the header row: bold
    headerRow.font = { bold: true };

    // Auto-fit column widths
    columns.forEach((col, idx) => {
      const maxLen = data.reduce((max, row) => {
        const val = String(row[col] ?? '');
        return Math.max(max, val.length);
      }, col.length);
      worksheet.getColumn(idx + 1).width = Math.min(maxLen + 2, 50);
    });

    return Buffer.from(await workbook.xlsx.writeBuffer());
  }
}
