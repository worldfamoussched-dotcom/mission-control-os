// Oracle Memory — Wiki Health / Lint
// Mock/stub module.

export interface WikiHealthData {
  stalePages: number;
  orphanPages: number;
  contradictions: number;
  uncitedClaims: number;
  missingBacklinks: number;
  duplicateEntities: number;
}

export function getWikiHealthMock(): WikiHealthData {
  return {
    stalePages: 0,
    orphanPages: 0,
    contradictions: 0,
    uncitedClaims: 2,
    missingBacklinks: 1,
    duplicateEntities: 0,
  };
}
