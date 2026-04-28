// Oracle OS v0.8 — Local Model Router
// Classifies tasks as LOCAL, HYBRID, or PREMIUM based on complexity, cost, and risk.
// LOCAL: Run on Mistral/Ollama (low-cost local inference)
// HYBRID: Use Claude with local fallback
// PREMIUM: Claude Opus/Sonnet only (complex reasoning, multi-turn, high-stakes)

// Client-side only — server-side execution via /api/oracle/local-model-router

export type InferenceMode = "LOCAL" | "HYBRID" | "PREMIUM";

interface TaskProfile {
  reasoning_depth: "trivial" | "shallow" | "moderate" | "deep";
  context_size: "small" | "medium" | "large";
  cost_sensitive: boolean;
  safety_critical: boolean;
  multi_turn: boolean;
}

interface ModelRouterStatus {
  ollama_available: boolean;
  ollama_models: string[];
  default_local_model: string;
  status: "READY" | "DEGRADED" | "OFFLINE";
}

/**
 * Get Ollama availability and loaded models
 * Client-side wrapper — calls /api/oracle/local-model-router for real data
 */
export async function getLocalModelRouterStatus(): Promise<ModelRouterStatus> {
  try {
    const res = await fetch("/api/oracle/local-model-router");
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (error) {
    console.error("Failed to fetch local model router status:", error);
    return {
      ollama_available: false,
      ollama_models: [],
      default_local_model: "mistral",
      status: "OFFLINE",
    };
  }
}

/**
 * Classify a task for inference routing
 * Returns the recommended mode: LOCAL, HYBRID, or PREMIUM
 */
export function classifyTaskForInference(profile: TaskProfile): InferenceMode {
  const { reasoning_depth, context_size, cost_sensitive, safety_critical, multi_turn } = profile;

  // Safety-critical tasks → PREMIUM (no local inference)
  if (safety_critical) return "PREMIUM";

  // Multi-turn conversations → PREMIUM (local models weak at context continuity)
  if (multi_turn) return "PREMIUM";

  // Deep reasoning → PREMIUM (local models plateau at shallow tasks)
  if (reasoning_depth === "deep") return "PREMIUM";

  // Large context → PREMIUM (local models have limited context windows)
  if (context_size === "large") return "PREMIUM";

  // Cost-sensitive + shallow reasoning → LOCAL
  if (cost_sensitive && reasoning_depth === "trivial") return "LOCAL";

  // Moderate reasoning, medium context, cost-sensitive → HYBRID
  if (cost_sensitive && reasoning_depth === "moderate" && context_size === "medium") return "HYBRID";

  // Shallow reasoning, small context → LOCAL
  if (reasoning_depth === "shallow" && context_size === "small") return "LOCAL";

  // Default: HYBRID (try local first, fallback to Claude)
  return "HYBRID";
}

/**
 * Example task profiles for common Mission Control scenarios
 */
export const TASK_PROFILES = {
  // Decompose a complex mission → PREMIUM (deep reasoning, safety-critical)
  decompose_mission: {
    reasoning_depth: "deep",
    context_size: "large",
    cost_sensitive: false,
    safety_critical: true,
    multi_turn: false,
  } as TaskProfile,

  // Classify a task (gating decision) → HYBRID (moderate reasoning, cost-sensitive)
  classify_task: {
    reasoning_depth: "moderate",
    context_size: "medium",
    cost_sensitive: true,
    safety_critical: true,
    multi_turn: false,
  } as TaskProfile,

  // Generate a summary → LOCAL (shallow reasoning, cost-sensitive)
  generate_summary: {
    reasoning_depth: "shallow",
    context_size: "small",
    cost_sensitive: true,
    safety_critical: false,
    multi_turn: false,
  } as TaskProfile,

  // Multi-turn review loop → PREMIUM (multi-turn)
  review_loop: {
    reasoning_depth: "moderate",
    context_size: "medium",
    cost_sensitive: false,
    safety_critical: true,
    multi_turn: true,
  } as TaskProfile,

  // Health check / status report → LOCAL (trivial reasoning)
  health_check: {
    reasoning_depth: "trivial",
    context_size: "small",
    cost_sensitive: true,
    safety_critical: false,
    multi_turn: false,
  } as TaskProfile,
};

/**
 * Recommend an inference mode for a named task type
 */
export function recommendMode(taskName: keyof typeof TASK_PROFILES): InferenceMode {
  const profile = TASK_PROFILES[taskName];
  return classifyTaskForInference(profile);
}
