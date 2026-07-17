/**
 * Regex-based markdown parser for governance documents.
 * No external dependencies. Relies on consistent markdown formatting.
 */

// ── Types ──

export interface ParsedEvent {
  name: string;
  status: string;
  owner: string;
  trigger: string;
  payload: string[];
}

export interface SchemaField {
  name: string;
  type: string;
  required: boolean;
}

export interface ParsedEventSchema {
  name: string;
  status: string;
  owner: string;
  fields: SchemaField[];
}

export interface Transition {
  from: string;
  to: string;
}

export interface ParsedStateMachine {
  name: string;
  transitions: Transition[];
  terminalStates: string[];
}

export interface HandbookChapter {
  title: string;
  references: string[];
}

export interface ADRMetadata {
  id: string;
  title: string;
  status: string;
  date: string;
  related: string;
}

export interface FrictionEntry {
  id: string;
  priority: string;
  problem: string;
  automationCandidate: string;
}

// ── EventCatalog Parser ──

export function parseEventCatalog(content: string): ParsedEvent[] {
  const events: ParsedEvent[] = [];
  // Split on H3 sections that start with backtick-quoted event names
  const sections = content.split(/^### `/m);

  for (const section of sections) {
    // Match event name with or without backtick wrapping (ts-jest may strip backticks)
    const nameMatch = section.match(/^`?([a-z][a-z0-9.]*(?:\.[a-z][a-z0-9.]*)*)`?/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    // Skip non-event H3s (like "### Current Event Chain")
    if (!name.includes('.')) continue;

    const owner = extractField(section, 'Publisher') || extractField(section, 'Owner') || '';
    const status = extractField(section, 'Status') || '';
    const trigger = extractField(section, 'Trigger') || '';

    // Extract payload field names from backtick-quoted list
    const payloadStr = extractField(section, 'Payload') || '';
    const payload = extractBacktickList(payloadStr);

    events.push({ name, status, owner, trigger, payload });
  }

  return events;
}

// ── EventSchema Parser ──

export function parseEventSchema(content: string): ParsedEventSchema[] {
  const schemas: ParsedEventSchema[] = [];
  const sections = content.split(/^### `/m);

  for (const section of sections) {
    // Match event name with or without backtick wrapping (ts-jest may strip backticks)
    const nameMatch = section.match(/^`?([a-z][a-z0-9.]*(?:\.[a-z][a-z0-9.]*)*)`?/);
    if (!nameMatch) continue;

    const name = nameMatch[1];
    if (!name.includes('.')) continue;

    const owner = extractField(section, 'Owner') || '';
    const status = extractField(section, 'Status') || '';

    // Extract field definitions from the field table
    const fields: SchemaField[] = [];
    const tableRegex = /^\|\s*`(\w+)`\s*\|\s*([^|]+)\|\s*(Yes|No)\s*\|/gm;
    let match;
    while ((match = tableRegex.exec(section)) !== null) {
      fields.push({
        name: match[1],
        type: match[2].trim(),
        required: match[3] === 'Yes',
      });
    }

    schemas.push({ name, status, owner, fields });
  }

  return schemas;
}

// ── StateMachineCatalog Parser ──

export function parseStateMachineCatalog(content: string): ParsedStateMachine[] {
  const machines: ParsedStateMachine[] = [];
  // Split on H2 sections like "## 1. Student Status" or "## 5. Lesson Status"
  const sections = content.split(/^## \d+\.\s+/m);

  for (const section of sections) {
    const nameMatch = section.match(/^(\S[\s\S]*?)(?:\n|$)/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    // Skip non-entity sections
    if (
      name.includes('Quick Reference') ||
      name.includes('How State Machines') ||
      name.includes('Validation Rules')
    )
      continue;

    // Extract transition rows from tables with "From" and "To" columns
    const transitions: Transition[] = [];
    const terminalStates: string[] = [];

    const lines = section.split('\n');
    for (const line of lines) {
      if (!line.startsWith('|')) continue;

      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c) => c.length > 0);

      // Skip header/separator rows
      if (cells.length < 2) continue;
      if (cells[0] === '---' || cells[0] === 'From' || cells[0] === '#') continue;

      // Find "From" and "To" columns by header
      // The transition tables always have From as first data column, To as second
      const fromIdx = 0;
      const toIdx = 1;

      if (cells.length > toIdx) {
        const from = cells[fromIdx];
        const to = cells[toIdx];

        // Valid state names are UPPERCASE with underscores
        if (/^[A-Z][A-Z_]+$/.test(from) && /^[A-Z][A-Z_]+$/.test(to)) {
          transitions.push({ from, to });
        }
        // Check for terminal states (From = STATE, To = -- or — or empty)
        if (/^[A-Z][A-Z_]+$/.test(from) && (to === '--' || to === '—' || to === '' || to === 'None')) {
          if (!terminalStates.includes(from)) {
            terminalStates.push(from);
          }
        }
      }
    }

    if (transitions.length > 0 || terminalStates.length > 0) {
      machines.push({ name, transitions, terminalStates });
    }
  }

  return machines;
}

// ── ArchitectureHandbook Parser ──

export function parseHandbookReferences(content: string): HandbookChapter[] {
  const chapters: HandbookChapter[] = [];
  const sections = content.split(/^## /m);

  for (const section of sections) {
    const titleMatch = section.match(/^([^\n]+)/);
    if (!titleMatch) continue;
    const title = titleMatch[1].trim();

    // Extract markdown links from **Reference**: lines
    const references: string[] = [];
    const refLines = section.match(/\*\*Reference\*\*:.*$/gm) || [];
    for (const refLine of refLines) {
      const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
      let linkMatch;
      while ((linkMatch = linkRegex.exec(refLine)) !== null) {
        references.push(linkMatch[2]);
      }
    }

    if (references.length > 0) {
      chapters.push({ title, references });
    }
  }

  return chapters;
}

// ── ADR Metadata Parser ──

export function parseADRMetadata(content: string, fileName: string): ADRMetadata {
  const idMatch = fileName.match(/(ADR-\d+|DEC-\d+)/);
  const id = idMatch ? idMatch[1] : fileName;

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/^ADR-\d+:\s*/, '').replace(/^DEC-\d+:\s*/, '') : '';

  const status = extractBlockquoteField(content, 'Status') || '';
  const date = extractBlockquoteField(content, 'Date') || '';
  const related = extractBlockquoteField(content, 'Related') || '';

  return { id, title, status, date, related };
}

// ── Friction Log Parser ──

export function parseFrictionLog(content: string): FrictionEntry[] {
  const entries: FrictionEntry[] = [];
  const sections = content.split(/^## (GF-\d+)/m);

  for (let i = 1; i < sections.length; i += 2) {
    const id = sections[i];
    const body = sections[i + 1] || '';

    entries.push({
      id,
      priority: extractField(body, 'Priority') || '',
      problem: extractField(body, 'Problem') || '',
      automationCandidate: extractField(body, 'Automation Candidate') || '',
    });
  }

  return entries;
}

// ── Internal Helpers ──

/** Extract a field value from a markdown table row: | **Key** | value | */
function extractField(content: string, key: string): string | null {
  const regex = new RegExp(`\\|\\s*\\*\\*${key}\\*\\*\\s*\\|\\s*(.+?)\\s*\\|`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/** Extract a blockquote field: > **Key**: value */
function extractBlockquoteField(content: string, key: string): string | null {
  const regex = new RegExp(`>\\s*\\*\\*${key}\\*\\*:\\s*([^\\n]+)$`, 'im');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/** Extract backtick-quoted items from a comma-separated list: `a`, `b`, `c` */
function extractBacktickList(text: string): string[] {
  const items: string[] = [];
  const regex = /`([^`]+)`/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    items.push(match[1]);
  }
  return items;
}
