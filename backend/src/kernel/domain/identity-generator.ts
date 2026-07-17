/**
 * IdentityGenerator — Generates business identifiers.
 *
 * Framework-independent. Zero NestJS imports.
 * Generates codes like CS2026070001, CL2026070001, etc.
 */

export class IdentityGenerator {
  /**
   * Generate a course code: CS + YYYYMM + 4-digit sequence
   */
  static courseCode(date: Date, sequence: number): string {
    const yyyymm = this.formatDate(date);
    const seq = sequence.toString().padStart(4, '0');
    return `CS${yyyymm}${seq}`;
  }

  /**
   * Generate a class code: CL + YYYYMM + 4-digit sequence
   */
  static classCode(date: Date, sequence: number): string {
    const yyyymm = this.formatDate(date);
    const seq = sequence.toString().padStart(4, '0');
    return `CL${yyyymm}${seq}`;
  }

  /**
   * Generate a contract code: CT + YYYYMM + 4-digit sequence
   */
  static contractCode(date: Date, sequence: number): string {
    const yyyymm = this.formatDate(date);
    const seq = sequence.toString().padStart(4, '0');
    return `CT${yyyymm}${seq}`;
  }

  /**
   * Generate a student code: ST + YYYYMM + 4-digit sequence
   */
  static studentCode(date: Date, sequence: number): string {
    const yyyymm = this.formatDate(date);
    const seq = sequence.toString().padStart(4, '0');
    return `ST${yyyymm}${seq}`;
  }

  /**
   * Format date as YYYYMM.
   */
  private static formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}${month}`;
  }
}
