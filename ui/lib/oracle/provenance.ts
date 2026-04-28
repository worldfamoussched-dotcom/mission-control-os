// Oracle OS v0.8-pre — Provenance Status
// Reads provenance audit data. Currently mock with REAL_FS planned.

export interface ProvenanceStatusResult {
  sourcesRegistered: number;
  claimsRegistered: number;
  verifiedClaims: number;
  inferredClaims: number;
  unresolvedClaims: number;
  staleClaims: number;
  pagesWithProvenance: number;
  pagesMissingProvenance: number;
  lastAudit: string;
  source: "REAL_FS" | "MOCK" | "NOT_WIRED";
}

export function getProvenanceStatusMock(): ProvenanceStatusResult {
  return {
    sourcesRegistered: 21,
    claimsRegistered: 25,
    verifiedClaims: 25,
    inferredClaims: 0,
    unresolvedClaims: 4,
    staleClaims: 0,
    pagesWithProvenance: 4,
    pagesMissingProvenance: 5,
    lastAudit: new Date().toISOString(),
    source: "MOCK",
  };
}
