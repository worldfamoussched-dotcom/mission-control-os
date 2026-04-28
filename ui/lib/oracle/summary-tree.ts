// Oracle Memory Layer 7 — Summary Tree (RAPTOR)
// Mock/stub module.

export interface SummaryLevel {
  name: string;
  count: number;
  description: string;
}

export interface SummaryTreeData {
  levels: SummaryLevel[];
  worldTrees: { world: string; entities: number; lastUpdated: string }[];
}

export function getSummaryTreeMock(): SummaryTreeData {
  return {
    levels: [
      { name: "Raw Sources", count: 18, description: "Immutable source files" },
      { name: "Entity Summaries", count: 12, description: "Per-entity compiled pages" },
      { name: "Domain Summaries", count: 6, description: "Per-domain synthesis" },
      { name: "Bootstrap Capsules", count: 4, description: "Session-loading context" },
    ],
    worldTrees: [
      { world: "BATMAN", entities: 5, lastUpdated: "2026-04-27" },
      { world: "WAKANDA", entities: 3, lastUpdated: "2026-04-27" },
      { world: "JARVIS", entities: 2, lastUpdated: "2026-04-27" },
      { world: "ORACLE", entities: 4, lastUpdated: "2026-04-27" },
    ],
  };
}
