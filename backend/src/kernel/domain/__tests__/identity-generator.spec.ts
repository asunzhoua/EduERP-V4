import { IdentityGenerator } from '../identity-generator';

describe('IdentityGenerator', () => {
  const date = new Date('2026-07-15');

  describe('courseCode()', () => {
    it('should generate course code', () => {
      const code = IdentityGenerator.courseCode(date, 1);

      expect(code).toBe('CS2026070001');
    });

    it('should pad sequence to 4 digits', () => {
      const code = IdentityGenerator.courseCode(date, 42);

      expect(code).toBe('CS2026070042');
    });
  });

  describe('classCode()', () => {
    it('should generate class code', () => {
      const code = IdentityGenerator.classCode(date, 1);

      expect(code).toBe('CL2026070001');
    });
  });

  describe('contractCode()', () => {
    it('should generate contract code', () => {
      const code = IdentityGenerator.contractCode(date, 1);

      expect(code).toBe('CT2026070001');
    });
  });

  describe('studentCode()', () => {
    it('should generate student code', () => {
      const code = IdentityGenerator.studentCode(date, 1);

      expect(code).toBe('ST2026070001');
    });
  });
});
