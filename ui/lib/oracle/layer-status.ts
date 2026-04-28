// Oracle Memory — 9-Layer Status
// Mock/stub module.

export type LayerState = "OPERATIONAL" | "SCAFFOLDED" | "NOT_STARTED";

export interface LayerInfo {
  number: number;
  name: string;
  status: LayerState;
  description: string;
}

export function getOracleLayerStatus(): LayerInfo[] {
  return [
    { number: 1, name: "Immutable Sources", status: "OPERATIONAL", description: "18 raw source files tracked" },
    { number: 2, name: "Source Classifier", status: "SCAFFOLDED", description: "Schema + routing rules defined" },
    { number: 3, name: "LLM Wiki Compiler", status: "OPERATIONAL", description: "14 wiki pages maintained" },
    { number: 4, name: "Structured Store", status: "NOT_STARTED", description: "Postgres for entities (future)" },
    { number: 5, name: "Retrieval Index", status: "NOT_STARTED", description: "Vector/keyword index (future)" },
    { number: 6, name: "Opportunity Graph", status: "SCAFFOLDED", description: "Entity types + alert spec" },
    { number: 7, name: "Summary Tree", status: "SCAFFOLDED", description: "4 world trees populated" },
    { number: 8, name: "Retrieval Gate", status: "SCAFFOLDED", description: "6 modes + decision flow" },
    { number: 9, name: "Bootstrap Layer", status: "OPERATIONAL", description: "Session capsule operational" },
  ];
}
