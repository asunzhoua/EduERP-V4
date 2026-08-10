import { Injectable } from '@nestjs/common';

@Injectable()
export class CsvWriter {
  generate(data: any[], columns: string[], headers?: string[]): Buffer {
    // \u8868\u5934\uff1a\u663e\u5f0f\u4f20\u5165\u4e2d\u6587 headers \u5219\u7528\u4e4b\uff0c\u5426\u5219\u56de\u9000\u82f1\u6587 columns
    const head =
      headers && headers.length === columns.length ? headers : columns;
    const header = head.join(',') + '\n';

    // Generate CSV data rows
    const rows = data
      .map((row) => columns.map((col) => this.escapeCsv(row[col])).join(','))
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
