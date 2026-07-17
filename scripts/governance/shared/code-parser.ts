/**
 * Regex-based TypeScript source parser for governance validation.
 * Parses service files, enum files, event classes, and module files.
 * No external dependencies.
 */

// ── Types ──

export interface TransitionMap {
  variableName: string;
  sourceFile: string;
  transitions: Record<string, string[]>;
}

export interface EnumDefinition {
  name: string;
  values: string[];
  sourceFile: string;
}

export interface EventClassInfo {
  name: string;
  eventName: string; // derived: class name -> event name
  fields: string[];
  sourceFile: string;
}

export interface PublishCall {
  eventName: string;
  payloadFields: string[];
  sourceFile: string;
  line: number;
}

// ── Transition Parser ──

/**
 * Parse VALID_*_TRANSITIONS from a service file.
 * Handles: VALID_TRANSITIONS, VALID_WORKFLOW_TRANSITIONS, VALID_REQUEST_TRANSITIONS
 */
export function parseTransitions(content: string, filePath: string): TransitionMap | null {
  // Match: const VALID_*_TRANSITIONS: Record<...> = {
  const regex =
    /const\s+(VALID_\w*TRANSITIONS)\s*:\s*Record<[^>]+>\s*=\s*\{([\s\S]*?)\};/;
  const match = content.match(regex);
  if (!match) return null;

  const variableName = match[1];
  const body = match[2];
  const transitions: Record<string, string[]> = {};

  // Match each line: [EnumVal.STATE]: [EnumVal.STATE, ...],
  const lineRegex = /\[(\w+)\.(\w+)\]\s*:\s*\[([^\]]*)\]/g;
  let lineMatch;
  while ((lineMatch = lineRegex.exec(body)) !== null) {
    const fromState = lineMatch[2];
    const targetsRaw = lineMatch[3];

    if (targetsRaw.trim() === '') {
      transitions[fromState] = [];
    } else {
      const targets = targetsRaw
        .split(',')
        .map((t) => {
          const stateMatch = t.trim().match(/\w+\.(\w+)/);
          return stateMatch ? stateMatch[1] : t.trim();
        })
        .filter((t) => t.length > 0);
      transitions[fromState] = targets;
    }
  }

  return Object.keys(transitions).length > 0
    ? { variableName, sourceFile: filePath, transitions }
    : null;
}

// ── Enum Parser ──

export function parseEnum(content: string, filePath: string): EnumDefinition | null {
  const regex = /export\s+enum\s+(\w+)\s*\{([\s\S]*?)\}/;
  const match = content.match(regex);
  if (!match) return null;

  const name = match[1];
  const body = match[2];
  const values: string[] = [];

  // Match: VALUE = 'VALUE' or VALUE = "VALUE"
  const valueRegex = /(\w+)\s*=\s*['"](\w+)['"]/g;
  let valueMatch;
  while ((valueMatch = valueRegex.exec(body)) !== null) {
    values.push(valueMatch[2]);
  }

  return values.length > 0 ? { name, values, sourceFile: filePath } : null;
}

// ── Event Class Parser ──

export function parseEventClass(content: string, filePath: string): EventClassInfo | null {
  // Match class name
  const classMatch = content.match(/class\s+(\w+Event)\s*\{/);
  if (!classMatch) return null;

  const name = classMatch[1];

  // Extract constructor parameter field names
  const constructorMatch = content.match(/constructor\(([\s\S]*?)\)\s*\{\}/);
  if (!constructorMatch) return null;

  const fields: string[] = [];
  const fieldRegex = /public\s+readonly\s+(\w+)/g;
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(constructorMatch[1])) !== null) {
    fields.push(fieldMatch[1]);
  }

  // Derive event name from class name: LessonCompletedEvent -> lesson.completed
  const eventName = classToEventName(name);

  return { name, eventName, fields, sourceFile: filePath };
}

// ── Publish Call Parser ──

export function parsePublishCalls(content: string, filePath: string): PublishCall[] {
  const calls: PublishCall[] = [];

  // Match: this.eventBus.publish('event.name', { ... })
  // Use a greedy approach: find each publish( call
  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const publishMatch = line.match(
      /this\.eventBus\.publish\(\s*['"]([^'"]+)['"]\s*,/,
    );
    if (publishMatch) {
      const eventName = publishMatch[1];

      // Collect the payload object (may span multiple lines)
      let payloadText = line;
      let braceDepth = 0;
      let started = false;

      for (let j = i; j < Math.min(i + 30, lines.length); j++) {
        const l = lines[j];
        for (const ch of l) {
          if (ch === '{') {
            braceDepth++;
            started = true;
          } else if (ch === '}') {
            braceDepth--;
          }
        }
        if (j > i) payloadText += '\n' + l;
        if (started && braceDepth === 0) break;
      }

      // Extract field names from payload: key: value patterns
      const payloadFields: string[] = [];
      const fieldRegex = /(\w+)\s*:/g;
      let fieldMatch;
      while ((fieldMatch = fieldRegex.exec(payloadText)) !== null) {
        const field = fieldMatch[1];
        // Skip JS keywords and object syntax
        if (field !== 'if' && field !== 'else' && field !== 'return') {
          payloadFields.push(field);
        }
      }

      calls.push({
        eventName,
        payloadFields: [...new Set(payloadFields)],
        sourceFile: filePath,
        line: i + 1,
      });
    }
    i++;
  }

  return calls;
}

// ── Helpers ──

/** Convert class name to event name: LessonCompletedEvent -> lesson.completed */
function classToEventName(className: string): string {
  // Remove "Event" suffix
  let name = className.replace(/Event$/, '');

  // Insert dot before last word if it's a verb-like suffix
  // LessonCompleted -> lesson.completed
  // LessonFinished -> lesson.finished
  // LeaveSubmitted -> leave.submitted
  // PointsGranted -> points.granted

  // Split CamelCase
  const words = name.replace(/([a-z])([A-Z])/g, '$1_$2').split('_');

  if (words.length >= 2) {
    // Last word becomes the action, rest is domain
    const domain = words.slice(0, -1).join('.').toLowerCase();
    const action = words[words.length - 1].toLowerCase();
    return `${domain}.${action}`;
  }

  return name.toLowerCase();
}
