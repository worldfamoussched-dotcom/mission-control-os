// Oracle Memory Layer 6 — Opportunity Graph (GraphRAG)
// Mock/stub module. No external service calls.

export interface GraphNode {
  id: string;
  label: string;
  world: "BATMAN" | "WAKANDA" | "JARVIS" | "ORACLE";
  type: "entity" | "world" | "signal";
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  strength: number; // 0-1
}

export interface CrossDomainAlert {
  id: string;
  message: string;
  worlds: string[];
  confidence: number;
}

export interface OpportunityGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  alerts: CrossDomainAlert[];
}

export function getOpportunityGraphMock(): OpportunityGraphData {
  return {
    nodes: [
      { id: "oracle", label: "ORACLE", world: "ORACLE", type: "world" },
      { id: "batman", label: "BATMAN", world: "BATMAN", type: "world" },
      { id: "wakanda", label: "WAKANDA", world: "WAKANDA", type: "world" },
      { id: "jarvis", label: "JARVIS", world: "JARVIS", type: "world" },
      { id: "umg", label: "Universal Music", world: "BATMAN", type: "entity" },
      { id: "umg-thread", label: "UMG Label Thread", world: "WAKANDA", type: "signal" },
      { id: "caldwell", label: "Caldwell PR", world: "WAKANDA", type: "entity" },
      { id: "festival-booking", label: "Festival Contacts", world: "BATMAN", type: "entity" },
    ],
    edges: [
      { from: "oracle", to: "batman", label: "governs", strength: 1.0 },
      { from: "oracle", to: "wakanda", label: "governs", strength: 1.0 },
      { from: "oracle", to: "jarvis", label: "governs", strength: 1.0 },
      { from: "umg", to: "umg-thread", label: "cross-domain signal", strength: 0.85 },
      { from: "caldwell", to: "festival-booking", label: "shared PR network", strength: 0.72 },
    ],
    alerts: [
      {
        id: "xd1",
        message: "Universal contact in BATMAN may relate to WAKANDA label thread. Review opportunity graph?",
        worlds: ["BATMAN", "WAKANDA"],
        confidence: 0.85,
      },
      {
        id: "xd2",
        message: "Caldwell PR (ATS retainer) also works with festival booking contacts in BATMAN.",
        worlds: ["WAKANDA", "BATMAN"],
        confidence: 0.72,
      },
    ],
  };
}
