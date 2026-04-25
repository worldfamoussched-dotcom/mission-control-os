import "@testing-library/jest-dom/vitest";
import { afterAll, beforeAll, vi } from "vitest";

// React 18 act() environment flag.
// See: https://react.dev/reference/react/act
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM doesn't implement scrollIntoView — stub it so components using it don't crash in tests.
if (typeof Element !== "undefined" && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {
    /* noop for JSDOM */
  };
}

// Filter known-noisy "not wrapped in act(...)" warnings.
// These are emitted when a component handler triggers multiple state updates
// after an awaited Promise resolves — a known React 18 + RTL false positive
// when @testing-library/react has already wrapped the user interaction in act.
// We still surface every other console.error to catch real issues.
const ACT_WARNING = /not wrapped in act\(/;
const originalError = console.error;

beforeAll(() => {
  console.error = vi.fn((...args: unknown[]) => {
    const first = args[0];
    if (typeof first === "string" && ACT_WARNING.test(first)) return;
    originalError(...args);
  });
});

afterAll(() => {
  console.error = originalError;
});
