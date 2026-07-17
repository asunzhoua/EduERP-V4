import * as fs from 'fs';
import {
  parseEventCatalog,
  parseEventSchema,
  parseStateMachineCatalog,
  parseHandbookReferences,
  parseADRMetadata,
  parseFrictionLog,
} from '../shared/markdown-parser';
import {
  EVENT_CATALOG,
  EVENT_SCHEMA,
  SM_CATALOG,
  ARCH_HANDBOOK,
  DECISION_LOG_DIR,
  FRICTION_LOG,
} from '../shared/paths';
import * as path from 'path';

describe('markdown-parser', () => {
  describe('parseEventCatalog', () => {
    const content = fs.readFileSync(EVENT_CATALOG, 'utf-8');
    const events = parseEventCatalog(content);

    it('should extract all 24 events', () => {
      expect(events).toHaveLength(24);
    });

    it('should identify CURRENT events', () => {
      const current = events.filter((e) => e.status === 'CURRENT');
      expect(current.map((e) => e.name)).toEqual(
        expect.arrayContaining(['lesson.completed', 'lesson.finished']),
      );
    });

    it('should extract owner for each event', () => {
      const lessonCompleted = events.find((e) => e.name === 'lesson.completed');
      expect(lessonCompleted?.owner).toContain('Teaching');
    });

    it('should extract trigger descriptions', () => {
      const lessonCompleted = events.find((e) => e.name === 'lesson.completed');
      expect(lessonCompleted?.trigger).toBeTruthy();
    });

    it('should extract payload field names', () => {
      const lessonCompleted = events.find((e) => e.name === 'lesson.completed');
      expect(lessonCompleted?.payload).toContain('lessonId');
      expect(lessonCompleted?.payload).toContain('classCode');
    });

    it('should have unique event names', () => {
      const names = events.map((e) => e.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });

  describe('parseEventSchema', () => {
    const content = fs.readFileSync(EVENT_SCHEMA, 'utf-8');
    const schemas = parseEventSchema(content);

    it('should extract schemas for all events', () => {
      expect(schemas.length).toBeGreaterThanOrEqual(2);
    });

    it('should parse lesson.completed schema fields', () => {
      const lessonCompleted = schemas.find((s) => s.name === 'lesson.completed');
      expect(lessonCompleted).toBeDefined();
      expect(lessonCompleted?.owner).toContain('Teaching');
      expect(lessonCompleted?.fields.length).toBeGreaterThan(0);
    });

    it('should parse field names and types', () => {
      const lessonCompleted = schemas.find((s) => s.name === 'lesson.completed');
      expect(lessonCompleted?.fields.some((f) => f.name === 'lessonId')).toBe(true);
    });
  });

  describe('parseStateMachineCatalog', () => {
    const content = fs.readFileSync(SM_CATALOG, 'utf-8');
    const machines = parseStateMachineCatalog(content);

    it('should extract state machines', () => {
      expect(machines.length).toBeGreaterThanOrEqual(5);
    });

    it('should find transitions for Lesson Status', () => {
      const lesson = machines.find((m) => m.name.includes('Lesson'));
      expect(lesson).toBeDefined();
      expect(lesson!.transitions.length).toBeGreaterThan(0);
    });

    it('should have UPPERCASE state names in transitions', () => {
      for (const machine of machines) {
        for (const t of machine.transitions) {
          expect(t.from).toMatch(/^[A-Z]/);
          expect(t.to).toMatch(/^[A-Z]/);
        }
      }
    });
  });

  describe('parseHandbookReferences', () => {
    const content = fs.readFileSync(ARCH_HANDBOOK, 'utf-8');
    const chapters = parseHandbookReferences(content);

    it('should find chapters with references', () => {
      expect(chapters.length).toBeGreaterThan(0);
    });

    it('should extract markdown link targets', () => {
      const allRefs = chapters.flatMap((c) => c.references);
      expect(allRefs.length).toBeGreaterThan(0);
      // All references should be relative paths
      expect(allRefs.every((r) => !r.startsWith('http'))).toBe(true);
    });
  });

  describe('parseADRMetadata', () => {
    const adrFile = path.join(DECISION_LOG_DIR, 'ADR-010-Attendance-Event-Ownership.md');
    const content = fs.readFileSync(adrFile, 'utf-8');
    const meta = parseADRMetadata(content, 'ADR-010-Attendance-Event-Ownership.md');

    it('should extract ADR ID', () => {
      expect(meta.id).toBe('ADR-010');
    });

    it('should extract status', () => {
      expect(meta.status).toBeTruthy();
    });

    it('should extract date', () => {
      expect(meta.date).toBeTruthy();
    });
  });

  describe('parseFrictionLog', () => {
    const content = fs.readFileSync(FRICTION_LOG, 'utf-8');
    const entries = parseFrictionLog(content);

    it('should extract all 7 friction entries', () => {
      expect(entries).toHaveLength(7);
    });

    it('should extract priorities', () => {
      const p1 = entries.filter((e) => e.priority === 'P1');
      expect(p1.length).toBe(3);
    });

    it('should have IDs in order', () => {
      expect(entries[0].id).toBe('GF-001');
      expect(entries[6].id).toBe('GF-007');
    });
  });
});
