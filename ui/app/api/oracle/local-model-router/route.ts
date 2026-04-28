// Oracle OS v0.8 — Local Model Router API
// Server-side endpoint to check Ollama availability and loaded models

import { NextResponse } from "next/server";
import { execSync } from "child_process";

interface ModelRouterStatus {
  ollama_available: boolean;
  ollama_models: string[];
  default_local_model: string;
  status: "READY" | "DEGRADED" | "OFFLINE";
}

export async function GET() {
  try {
    const output = execSync("ollama list", { encoding: "utf-8", timeout: 3000 });
    const lines = output.split("\n").slice(1); // Skip header
    const models = lines
      .filter((line) => line.trim())
      .map((line) => line.split(/\s+/)[0]);

    const hasMistral = models.some((m) => m.includes("mistral"));

    const result: ModelRouterStatus = {
      ollama_available: true,
      ollama_models: models,
      default_local_model: hasMistral ? "mistral" : models[0] || "mistral",
      status: models.length > 0 ? "READY" : "DEGRADED",
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({
      ollama_available: false,
      ollama_models: [],
      default_local_model: "mistral",
      status: "OFFLINE",
    } as ModelRouterStatus);
  }
}
