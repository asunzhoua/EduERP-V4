import { ImportService, ImportColumn } from './import.service';
import * as XLSX from 'xlsx';

jest.mock('xlsx');

describe('ImportService', () => {
  let service: ImportService;

  beforeEach(() => {
    service = new ImportService();
    jest.clearAllMocks();
  });

  // ─── parseBuffer ────────────────────────────────────────────

  describe('parseBuffer', () => {
    it('should parse a valid XLSX buffer into row objects', () => {
      const rows = [
        { 姓名: '张三', 年龄: '20' },
        { 姓名: '李四', 年龄: '22' },
      ];
      (XLSX.read as jest.Mock).mockReturnValue({
        SheetNames: ['Sheet1'],
        Sheets: { Sheet1: {} },
      });
      (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(rows);

      const result = service.parseBuffer(Buffer.from('fake'), 'test.xlsx');

      expect(result).toEqual(rows);
      expect(XLSX.read).toHaveBeenCalledWith(Buffer.from('fake'), { type: 'buffer' });
      expect(XLSX.utils.sheet_to_json).toHaveBeenCalledWith({}, { defval: '' });
    });

    it('should throw when the workbook has no sheets', () => {
      (XLSX.read as jest.Mock).mockReturnValue({
        SheetNames: [],
        Sheets: {},
      });

      expect(() => service.parseBuffer(Buffer.from('fake'), 'empty.xlsx')).toThrow(
        'Excel 文件中没有工作表',
      );
    });

    it('should throw when SheetNames contains only undefined/empty', () => {
      (XLSX.read as jest.Mock).mockReturnValue({
        SheetNames: [undefined],
        Sheets: {},
      });

      expect(() => service.parseBuffer(Buffer.from('fake'), 'bad.xlsx')).toThrow(
        'Excel 文件中没有工作表',
      );
    });
  });

  // ─── validateRows ───────────────────────────────────────────

  describe('validateRows', () => {
    const columns: ImportColumn[] = [
      { header: '姓名', required: true },
      { header: '年龄', required: true },
    ];

    it('should pass validation when all required fields are present', () => {
      const rows = [
        { 姓名: '张三', 年龄: '20' },
        { 姓名: '李四', 年龄: '22' },
      ];

      const { validRows, report } = service.validateRows(rows, columns, 'students.xlsx');

      expect(validRows).toHaveLength(2);
      expect(report.total).toBe(2);
      expect(report.success).toBe(2);
      expect(report.failure).toBe(0);
      expect(report.fileName).toBe('students.xlsx');
      expect(report.details.every((d) => d.success)).toBe(true);
    });

    it('should report errors when required fields are missing', () => {
      const rows = [
        { 姓名: '', 年龄: '20' },
        { 姓名: '李四', 年龄: '' },
      ];

      const { validRows, report } = service.validateRows(rows, columns, 'test.xlsx');

      expect(validRows).toHaveLength(0);
      expect(report.total).toBe(2);
      expect(report.success).toBe(0);
      expect(report.failure).toBe(2);

      expect(report.details[0].errors).toContain('"姓名" 不能为空');
      expect(report.details[1].errors).toContain('"年龄" 不能为空');
    });

    it('should run custom validate functions and collect errors', () => {
      const columnsWithValidate: ImportColumn[] = [
        { header: '邮箱', required: true, validate: (v) => (v.includes('@') ? null : '邮箱格式错误') },
      ];
      const rows = [
        { 邮箱: 'bad-email' },
        { 邮箱: 'ok@test.com' },
      ];

      const { validRows, report } = service.validateRows(rows, columnsWithValidate, 'users.xlsx');

      expect(report.details[0].errors).toContain('邮箱格式错误');
      expect(report.details[0].success).toBe(false);
      expect(report.details[1].success).toBe(true);
      expect(validRows).toHaveLength(1);
      expect(validRows[0]['邮箱']).toBe('ok@test.com');
    });

    it('should handle an empty rows array gracefully', () => {
      const { validRows, report } = service.validateRows([], columns, 'empty.xlsx');

      expect(validRows).toHaveLength(0);
      expect(report.total).toBe(0);
      expect(report.success).toBe(0);
      expect(report.failure).toBe(0);
      expect(report.details).toHaveLength(0);
      expect(report.fileName).toBe('empty.xlsx');
    });

    it('should normalize headers (trim + lowercase) before matching', () => {
      const rows = [{ ' 姓名 ': '王五', '年龄': '25' }];

      const { validRows, report } = service.validateRows(rows, columns, 'norm.xlsx');

      expect(validRows).toHaveLength(1);
      expect(report.success).toBe(1);
    });

    it('should not run validate when the value is empty', () => {
      const validator: ImportColumn[] = [
        { header: '电话', validate: jest.fn().mockReturnValue(null) },
      ];
      const rows = [{ 电话: '' }];

      service.validateRows(rows, validator, 'v.xlsx');

      // validate should NOT be called because value is empty
      expect(validator[0].validate).not.toHaveBeenCalled();
    });

    it('should report row numbers starting from 2 (1-indexed header offset)', () => {
      const rows = [{ 姓名: '' }];

      const { report } = service.validateRows(rows, columns, 'r.xlsx');

      expect(report.details[0].row).toBe(2);
    });
  });
});
