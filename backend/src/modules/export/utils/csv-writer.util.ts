import { Injectable } from '@nestjs/common';

@Injectable()
export class CsvWriter {
  generate(data: any[], columns: string[]): Buffer {
    // Generate CSV header row
    const header = columns.join(',') + '\n';

    // Generate CSV data rows
    const rows = data
      .map((row) =>
        columns.map((col) => this.escapeCsv(row[col])).join(','),
      )
      .join('\n');

    // Add BOM for Chinese character support (UTF-8)
    const bom = '\ufeff';
    return Buffer.from(bom + header + rows, 'utf-8');
  }

  private escapeCsv(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // If the value contains commas, double-quotes, or newlines, escape it
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }
}
