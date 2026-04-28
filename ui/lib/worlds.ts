// Oracle OS — World Theme System
// Each world has a distinct visual identity. Switching worlds changes everything.

export type WorldId = "batman" | "wakanda" | "jarvis" | "oracle";

export interface WorldTheme {
  id: WorldId;
  name: string;
  subtitle: string;
  domain: string;
  purpose: string;
  colors: {
    primary: string;
    accent: string;
    bg: string;
    bgPanel: string;
    border: string;
    text: string;
    textDim: string;
    glow: string;
  };
  gradients: {
    hero: string;
    panel: string;
  };
  modules: string[];
}

export const worlds: Record<WorldId, WorldTheme> = {
  batman: {
    id: "batman",
    name: "BATMAN",
    subtitle: "Artist Command Center",
    domain: "Nick London / London X / Vampire Sex",
    purpose: "Contacts, track stacks, pitching, EPKs, bookings, travel, contracts, W9s, music/business opportunities",
    colors: {
      primary: "#1a1a2e",
      accent: "#4a90d9",
      bg: "#0a0a14",
      bgPanel: "rgba(10, 10, 20, 0.92)",
      border: "rgba(74, 144, 217, 0.12)",
      text: "#b8c5d6",
      textDim: "rgba(184, 197, 214, 0.45)",
      glow: "rgba(74, 144, 217, 0.15)",
    },
    gradients: {
      hero: "radial-gradient(ellipse at 30% 50%, rgba(74, 144, 217, 0.06) 0%, transparent 70%)",
      panel: "linear-gradient(180deg, rgba(74, 144, 217, 0.04) 0%, transparent 100%)",
    },
    modules: [
      "Active Missions",
      "Artist Entities",
      "Track Stack",
      "Key Contacts",
      "Opportunity Alerts",
      "Manager Agent",
      "Bookings / Travel",
      "Pitch Queue",
      "Recent Signals",
    ],
  },

  wakanda: {
    id: "wakanda",
    name: "WAKANDA",
    subtitle: "Label Command HQ",
    domain: "All The Smoke",
    purpose: "Demos, releases, roster, label contacts, SoundCloud, email, campaigns, A&R, marketing",
    colors: {
      primary: "#1a0a2e",
      accent: "#8b5cf6",
      bg: "#08051a",
      bgPanel: "rgba(8, 5, 26, 0.92)",
      border: "rgba(139, 92, 246, 0.12)",
      text: "#c4b8e8",
      textDim: "rgba(196, 184, 232, 0.45)",
      glow: "rgba(139, 92, 246, 0.15)",
    },
    gradients: {
      hero: "radial-gradient(ellipse at 50% 40%, rgba(139, 92, 246, 0.06) 0%, transparent 70%)",
      panel: "linear-gradient(180deg, rgba(139, 92, 246, 0.04) 0%, transparent 100%)",
    },
    modules: [
      "All The Smoke Overview",
      "Demo Queue",
      "Release Pipeline",
      "Roster / Artists",
      "Label Contacts",
      "A&R Intelligence",
      "Campaigns",
      "Inbox / SoundCloud",
      "Ops Alerts",
    ],
  },

  jarvis: {
    id: "jarvis",
    name: "JARVIS",
    subtitle: "Engineering Intelligence Lab",
    domain: "Fractal Web Solutions",
    purpose: "Clients, websites, apps, leads, proposals, deployments, client communication, sales pipeline",
    colors: {
      primary: "#0a1a1a",
      accent: "#06d6a0",
      bg: "#040e0e",
      bgPanel: "rgba(4, 14, 14, 0.92)",
      border: "rgba(6, 214, 160, 0.12)",
      text: "#b8e8d8",
      textDim: "rgba(184, 232, 216, 0.45)",
      glow: "rgba(6, 214, 160, 0.15)",
    },
    gradients: {
      hero: "radial-gradient(ellipse at 70% 50%, rgba(6, 214, 160, 0.06) 0%, transparent 70%)",
      panel: "linear-gradient(180deg, rgba(6, 214, 160, 0.04) 0%, transparent 100%)",
    },
    modules: [
      "Client Pipeline",
      "Leads / Sales",
      "Active Builds",
      "Proposals",
      "Deliverables",
      "Deployment Status",
      "Client Communication",
      "Internal Build Agents",
      "Project Health",
    ],
  },

  oracle: {
    id: "oracle",
    name: "ORACLE",
    subtitle: "Atlas of Governed Cognition",
    domain: "Oracle OS / Fractal Memory",
    purpose: "Governance, memory, truth maintenance, self-healing, cognition, cross-domain reasoning",
    colors: {
      primary: "#030308",
      accent: "#3cb4dc",
      bg: "#030308",
      bgPanel: "rgba(8, 12, 24, 0.92)",
      border: "rgba(60, 180, 220, 0.12)",
      text: "#c8d6e5",
      textDim: "rgba(200, 214, 229, 0.45)",
      glow: "rgba(60, 180, 220, 0.15)",
    },
    gradients: {
      hero: "radial-gradient(ellipse at 50% 50%, rgba(60, 180, 220, 0.06) 0%, transparent 70%)",
      panel: "linear-gradient(180deg, rgba(60, 180, 220, 0.04) 0%, transparent 100%)",
    },
    modules: [
      "Cognitive Stack",
      "Stability Attractor",
      "Byzantine Quorum",
      "Belief Propagation",
      "Memory Surgery",
      "Observatory Cockpit",
      "Theory Navigator",
      "Swarm Consensus",
      "MPC Trajectory",
    ],
  },
};

export const worldIds: WorldId[] = ["batman", "wakanda", "jarvis", "oracle"];

export function getWorld(id: WorldId): WorldTheme {
  return worlds[id];
}
