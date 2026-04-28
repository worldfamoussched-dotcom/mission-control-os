// Oracle OS — Mock Data for v0.1
// All data is placeholder. Marks where real APIs/websockets connect later.

export const mockOracleHealth = {
  status: "HEALTHY" as const,
  integrity: { matched: 21, total: 21 },
  evals: { passed: 12, total: 12 },
  stability: { vx: 0.124, dv: -0.037 },
  memory: { nodes: 91, edges: 89, communities: 19, coherence: 0.81 },
  contradictions: 3,
  repairsQueued: 1,
  activeHypotheses: 14,
  verifications: 32,
};

export const mockBatmanMissions = [
  { id: "m1", title: "Soul Stew EP Campaign", status: "active", entity: "Vampire Sex", priority: "high", updated: "2026-04-25" },
  { id: "m2", title: "Space X Beatport Push", status: "active", entity: "London X", priority: "medium", updated: "2026-04-26" },
  { id: "m3", title: "Bob Marley Production Delivery", status: "pending", entity: "London X", priority: "critical", updated: "2026-04-20" },
  { id: "m4", title: "ADE 2026 Application", status: "queued", entity: "Vampire Sex", priority: "medium", updated: "2026-04-18" },
];

export const mockBatmanContacts = [
  { name: "Universal Music Group", role: "Label", entity: "London X", lastContact: "2026-04-10" },
  { name: "Witty Tunes", role: "Label", entity: "Vampire Sex", lastContact: "2026-03-16" },
  { name: "Hotboxx", role: "Collaborator / Label Partner", entity: "London X", lastContact: "2026-04-24" },
  { name: "Caldwell PR", role: "PR Firm", entity: "All The Smoke", lastContact: "2026-04-22" },
];

export const mockWakandaReleases = [
  { title: "Demo: Night Frequency", artist: "Unknown", status: "review", submitted: "2026-04-25" },
  { title: "Demo: Basement Ritual", artist: "nSJ", status: "approved", submitted: "2026-04-20" },
  { title: "Ooh Ohh", artist: "London X ft. Damelo", status: "scheduled", releaseDate: "2026-07-01" },
  { title: "Party Sober", artist: "London X ft. Damelo", status: "scheduled", releaseDate: "2026-08-01" },
];

export const mockJarvisClients = [
  { name: "Client A", project: "Artist Portfolio Site", status: "in_progress", health: 92 },
  { name: "Client B", project: "Booking Platform MVP", status: "proposal", health: 0 },
  { name: "Internal", project: "VS Website", status: "not_started", health: 0 },
  { name: "Internal", project: "London X Website", status: "not_started", health: 0 },
];

// Cross-domain opportunity alert — Oracle detects connection
export const mockCrossDomainAlerts = [
  {
    id: "xd1",
    type: "cross-domain" as const,
    message: "Universal contact in BATMAN may relate to WAKANDA label thread. Review opportunity graph?",
    worlds: ["batman", "wakanda"] as const,
    timestamp: "2026-04-26T14:30:00Z",
  },
  {
    id: "xd2",
    type: "cross-domain" as const,
    message: "Caldwell PR (ATS retainer) also works with festival booking contacts in BATMAN. Leverage?",
    worlds: ["wakanda", "batman"] as const,
    timestamp: "2026-04-26T11:00:00Z",
  },
];

export const mockSystemEvents = [
  { time: "14:32:01", type: "monitor", message: "Hash integrity check passed (21/21)" },
  { time: "14:31:45", type: "repair", message: "Stale hash updated: current-state.md" },
  { time: "14:30:12", type: "learn", message: "Hebbian weight updated: [VS] <-> [BUILDS]" },
  { time: "14:29:58", type: "gate", message: "Scope Gate check: PASS" },
  { time: "14:28:30", type: "monitor", message: "MAPE-K cycle complete" },
  { time: "14:27:15", type: "learn", message: "Co-occurrence logged: task <-> context" },
];

export const mockActiveMissions = 4;
export const mockBridgeStatus = "connected" as const;
