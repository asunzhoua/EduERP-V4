/**
 * Self Governance Engine — Shared Types
 *
 * Unified data formats for .governance/ directory.
 * All governance data flows through these types.
 */

// ── Issue Engine Types ──────────────────────────────────────────

export type IssuePriority = 'P1' | 'P2' | 'P3';
export type IssueStatus = 'open' | 'investigating' | 'planned' | 'resolved' | 'verified' | 'closed';
export type IssueCategory = 'bug' | 'quality' | 'security' | 'performance' | 'documentation' | 'governance' | 'architecture';

export interface Issue {
  id: string;                    // ISS-NNN
  title: string;
  priority: IssuePriority;
  status: IssueStatus;
  category: IssueCategory;
  description: string;
  location: string;              // file:line or area
  discoveredAt: string;          // ISO timestamp
  discoveredBy: string;          // scanner or human
  rule?: string;                 // which rule/gate triggered
  relatedIssues?: string[];      // other ISS-NNN IDs
  history: IssueEvent[];
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
}

export interface IssueEvent {
  timestamp: string;
  action: string;
  from?: string;
  to?: string;
  note?: string;
}

// ── Debt Engine Types ──────────────────────────────────────────

export type DebtSeverity = 'critical' | 'high' | 'medium' | 'low';
export type DebtCategory = 'code' | 'architecture' | 'documentation' | 'test' | 'config' | 'tooling';
export type DebtStatus = 'identified' | 'acknowledged' | 'planned' | 'in-progress' | 'resolved' | 'wont-fix';

export interface DebtItem {
  id: string;                    // DEBT-NNN
  title: string;
  severity: DebtSeverity;
  category: DebtCategory;
  status: DebtStatus;
  description: string;
  location: string;              // file path or area
  owner?: string;                // responsible team/person
  reason: string;                // why this is debt
  impact: string;                // what happens if not addressed
  estimatedCost: string;         // effort to fix (hours/complexity)
  suggestedSprint?: string;      // when to fix
  discoveredAt: string;
  history: DebtEvent[];
}

export interface DebtEvent {
  timestamp: string;
  action: string;
  note?: string;
}

// ── Decision Types ─────────────────────────────────────────────

export type DecisionStatus = 'accepted' | 'deprecated' | 'superseded' | 'needs-review';
export type DecisionVerdict = 'valid' | 'needs-review' | 'deprecated';

export interface DecisionRecord {
  id: string;                    // ADR-NNN or DEC-NNN
  title: string;
  status: DecisionStatus;
  verdict: DecisionVerdict;
  reviewedAt: string;
  reason: string;                // why this verdict
  evidence?: string;             // what confirms/challenges the decision
  supersededBy?: string;         // if superseded, which ADR
}

// ── Evolution Types ────────────────────────────────────────────

export type EvolutionType = 'simplification' | 'extraction' | 'consolidation' | 'removal' | 'metric';

export interface EvolutionEntry {
  id: string;                    // EVO-NNN
  type: EvolutionType;
  title: string;
  description: string;
  impact: string;
  before?: string;               // state before
  after?: string;                // state after
  filesChanged: number;
  linesChanged: number;
  timestamp: string;
}

// ── Repository Snapshot ────────────────────────────────────────

export interface RepoSnapshot {
  timestamp: string;
  metrics: {
    backendTsFiles: number;
    backendSpecFiles: number;
    backendTsLines: number;
    cliTsFiles: number;
    cliTsLines: number;
    governanceTsFiles: number;
    governanceTsLines: number;
    docsMdFiles: number;
    templateFiles: number;
    testSuites: number;
    testCases: number;
    modules: number;
    emptyDirs: number;
    healthScore: number;
    duplicateFunctions: number;
    duplicateFiles: number;
  };
}

// ── Mission Types ──────────────────────────────────────────────

export interface MissionSuggestion {
  id: string;
  title: string;
  reason: string;
  objectives: string[];
  priority: 'high' | 'medium' | 'low';
  estimatedEffort: string;
  basedOn: string[];             // what data this was generated from
}
