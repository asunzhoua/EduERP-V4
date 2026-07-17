import {
  generate,
  getAvailableGenerators,
  generateAggregate,
  generateValueObject,
  generateEntity,
  generateRepository,
  generateUseCase,
  generateEvent,
} from '../eos';

describe('Developer SDK (eos-cli)', () => {
  describe('getAvailableGenerators()', () => {
    it('should return all generator types', () => {
      const generators = getAvailableGenerators();

      expect(generators).toContain('aggregate');
      expect(generators).toContain('value-object');
      expect(generators).toContain('entity');
      expect(generators).toContain('repository');
      expect(generators).toContain('use-case');
      expect(generators).toContain('event');
      expect(generators).toHaveLength(6);
    });
  });

  describe('generate()', () => {
    it('should generate aggregate skeleton', () => {
      const result = generate('aggregate', { name: 'Student', module: 'student' });

      expect(result).toContain('StudentAggregate');
      expect(result).toContain('StudentId');
      expect(result).toContain('AggregateRoot');
      expect(result).toContain('validateInvariants');
    });

    it('should generate value object skeleton', () => {
      const result = generate('value-object', { name: 'Email', module: 'student' });

      expect(result).toContain('class Email');
      expect(result).toContain('ValueObject');
      expect(result).toContain('static create');
    });

    it('should generate entity skeleton', () => {
      const result = generate('entity', { name: 'Enrollment', module: 'student' });

      expect(result).toContain('class Enrollment');
      expect(result).toContain('BaseEntity');
    });

    it('should generate repository skeleton', () => {
      const result = generate('repository', { name: 'Student', module: 'student' });

      expect(result).toContain('StudentRepository');
      expect(result).toContain('RepositoryBase');
    });

    it('should generate use case skeleton', () => {
      const result = generate('use-case', { name: 'EnrollStudent', module: 'student' });

      expect(result).toContain('EnrollStudentCommand');
      expect(result).toContain('EnrollStudentHandler');
      expect(result).toContain('ICommandHandler');
    });

    it('should generate event skeleton', () => {
      const result = generate('event', { name: 'StudentEnrolled', module: 'student' });

      expect(result).toContain('StudentEnrolledEvent');
      expect(result).toContain('DomainEventBase');
      expect(result).toContain('student.studentenrolled');
    });

    it('should throw for unknown generator type', () => {
      expect(() => generate('unknown' as any, { name: 'Test', module: 'test' })).toThrow(
        'Unknown generator type: unknown',
      );
    });
  });

  describe('Individual generators', () => {
    it('generateAggregate should produce valid TypeScript', () => {
      const code = generateAggregate('Course', 'teaching');

      expect(code).toContain('export class CourseAggregate');
      expect(code).toContain('export class CourseId');
      expect(code).toContain('extends AggregateRoot');
      expect(code).toContain('extends NumberId');
    });

    it('generateEvent should set correct eventType', () => {
      const code = generateEvent('LessonCompleted', 'teaching');

      expect(code).toContain("eventType = 'teaching.lessoncompleted'");
    });

    it('generateUseCase should include command and handler', () => {
      const code = generateUseCase('StartLesson', 'teaching');

      expect(code).toContain('StartLessonCommand');
      expect(code).toContain('StartLessonHandler');
      expect(code).toContain('implements ICommandHandler');
      expect(code).toContain('Result<void>');
    });
  });
});
