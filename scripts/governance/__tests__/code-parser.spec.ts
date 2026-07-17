import * as fs from 'fs';
import * as path from 'path';
import {
  parseTransitions,
  parseEnum,
  parseEventClass,
  parsePublishCalls,
} from '../shared/code-parser';
import { BACKEND_SRC, EVENTS_DIR } from '../shared/paths';

describe('code-parser', () => {
  // ── Transitions ──

  describe('parseTransitions', () => {
    it('should parse Lesson VALID_TRANSITIONS', () => {
      const content = fs.readFileSync(
        path.join(BACKEND_SRC, 'modules', 'teaching', 'lesson', 'lesson.service.ts'),
        'utf-8',
      );
      const result = parseTransitions(content, 'lesson.service.ts');

      expect(result).not.toBeNull();
      expect(result!.variableName).toBe('VALID_TRANSITIONS');
      expect(result!.transitions).toHaveProperty('DRAFT');
      expect(result!.transitions).toHaveProperty('TEACHING');
      expect(result!.transitions['DRAFT']).toContain('SCHEDULED');
      expect(result!.transitions['TEACHING']).toContain('FINISHED');
    });

    it('should parse Course VALID_TRANSITIONS', () => {
      const content = fs.readFileSync(
        path.join(BACKEND_SRC, 'modules', 'teaching', 'course', 'course.service.ts'),
        'utf-8',
      );
      const result = parseTransitions(content, 'course.service.ts');

      expect(result).not.toBeNull();
      expect(result!.transitions).toHaveProperty('DRAFT');
      expect(result!.transitions['DRAFT']).toContain('PUBLISHED');
    });

    it('should parse Class VALID_TRANSITIONS', () => {
      const content = fs.readFileSync(
        path.join(BACKEND_SRC, 'modules', 'teaching', 'class', 'class.service.ts'),
        'utf-8',
      );
      const result = parseTransitions(content, 'class.service.ts');

      expect(result).not.toBeNull();
      expect(result!.transitions).toHaveProperty('DRAFT');
      expect(result!.transitions).toHaveProperty('ACTIVE');
      expect(result!.transitions['COMPLETED']).toEqual([]);
    });

    it('should parse Contract VALID_TRANSITIONS', () => {
      const content = fs.readFileSync(
        path.join(BACKEND_SRC, 'modules', 'teaching', 'contract', 'contract.service.ts'),
        'utf-8',
      );
      const result = parseTransitions(content, 'contract.service.ts');

      expect(result).not.toBeNull();
      expect(result!.transitions).toHaveProperty('ACTIVE');
      expect(result!.transitions['REFUNDED']).toEqual([]);
    });

    it('should parse VALID_WORKFLOW_TRANSITIONS (attendance)', () => {
      const content = fs.readFileSync(
        path.join(
          BACKEND_SRC,
          'modules',
          'teaching',
          'lesson-attendance',
          'lesson-attendance.service.ts',
        ),
        'utf-8',
      );
      const result = parseTransitions(content, 'lesson-attendance.service.ts');

      expect(result).not.toBeNull();
      expect(result!.variableName).toBe('VALID_WORKFLOW_TRANSITIONS');
      expect(result!.transitions).toHaveProperty('PENDING');
      expect(result!.transitions).toHaveProperty('LOCKED');
    });

    it('should parse VALID_REQUEST_TRANSITIONS (change request)', () => {
      const content = fs.readFileSync(
        path.join(
          BACKEND_SRC,
          'modules',
          'teaching',
          'lesson-change-request',
          'lesson-change-request.service.ts',
        ),
        'utf-8',
      );
      const result = parseTransitions(content, 'lesson-change-request.service.ts');

      expect(result).not.toBeNull();
      expect(result!.variableName).toBe('VALID_REQUEST_TRANSITIONS');
      expect(result!.transitions).toHaveProperty('PENDING');
      expect(result!.transitions).toHaveProperty('REJECTED');
      expect(result!.transitions['REJECTED']).toEqual([]);
    });
  });

  // ── Enums ──

  describe('parseEnum', () => {
    it('should parse LessonStatus enum', () => {
      const content = fs.readFileSync(
        path.join(BACKEND_SRC, 'modules', 'teaching', 'lesson', 'enums', 'lesson-status.enum.ts'),
        'utf-8',
      );
      const result = parseEnum(content, 'lesson-status.enum.ts');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('LessonStatus');
      expect(result!.values).toContain('DRAFT');
      expect(result!.values).toContain('SCHEDULED');
      expect(result!.values).toContain('TEACHING');
      expect(result!.values).toContain('FINISHED');
      expect(result!.values).toContain('ARCHIVED');
      expect(result!.values).toContain('CANCELLED');
      expect(result!.values).toHaveLength(6);
    });

    it('should parse CourseStatus enum', () => {
      const content = fs.readFileSync(
        path.join(
          BACKEND_SRC,
          'modules',
          'teaching',
          'course',
          'enums',
          'course-status.enum.ts',
        ),
        'utf-8',
      );
      const result = parseEnum(content, 'course-status.enum.ts');

      expect(result).not.toBeNull();
      expect(result!.values).toContain('DRAFT');
      expect(result!.values).toContain('PUBLISHED');
      expect(result!.values).toContain('ARCHIVED');
    });
  });

  // ── Event Classes ──

  describe('parseEventClass', () => {
    it('should parse LessonCompletedEvent', () => {
      const content = fs.readFileSync(
        path.join(EVENTS_DIR, 'lesson', 'lesson-completed.event.ts'),
        'utf-8',
      );
      const result = parseEventClass(content, 'lesson-completed.event.ts');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('LessonCompletedEvent');
      expect(result!.fields).toContain('lessonId');
      expect(result!.fields).toContain('classCode');
      expect(result!.fields).toContain('courseCode');
      expect(result!.fields).toContain('teacherId');
    });

    it('should parse LessonFinishedEvent', () => {
      const content = fs.readFileSync(
        path.join(EVENTS_DIR, 'lesson', 'lesson-finished.event.ts'),
        'utf-8',
      );
      const result = parseEventClass(content, 'lesson-finished.event.ts');

      expect(result).not.toBeNull();
      expect(result!.name).toBe('LessonFinishedEvent');
      expect(result!.fields).toContain('confirmedBy');
      expect(result!.fields).toContain('confirmedAt');
    });

    it('should parse all 6 event classes', () => {
      const eventFiles = [
        'lesson/lesson-completed.event.ts',
        'lesson/lesson-finished.event.ts',
        'lesson/lesson-feedback-created.event.ts',
        'leave/leave-submitted.event.ts',
        'leave/leave-approved.event.ts',
        'finance/points-granted.event.ts',
      ];

      for (const file of eventFiles) {
        const content = fs.readFileSync(path.join(EVENTS_DIR, file), 'utf-8');
        const result = parseEventClass(content, file);
        expect(result).not.toBeNull();
        expect(result!.fields.length).toBeGreaterThan(0);
      }
    });
  });

  // ── Publish Calls ──

  describe('parsePublishCalls', () => {
    it('should find lesson.completed and lesson.finished publish calls', () => {
      const content = fs.readFileSync(
        path.join(BACKEND_SRC, 'modules', 'teaching', 'lesson', 'lesson.service.ts'),
        'utf-8',
      );
      const calls = parsePublishCalls(content, 'lesson.service.ts');

      expect(calls).toHaveLength(2);
      expect(calls.map((c) => c.eventName)).toContain('lesson.completed');
      expect(calls.map((c) => c.eventName)).toContain('lesson.finished');
    });

    it('should extract payload fields from publish calls', () => {
      const content = fs.readFileSync(
        path.join(BACKEND_SRC, 'modules', 'teaching', 'lesson', 'lesson.service.ts'),
        'utf-8',
      );
      const calls = parsePublishCalls(content, 'lesson.service.ts');
      const completed = calls.find((c) => c.eventName === 'lesson.completed');

      expect(completed).toBeDefined();
      expect(completed!.payloadFields).toContain('lessonId');
      expect(completed!.payloadFields).toContain('classCode');
    });
  });
});
