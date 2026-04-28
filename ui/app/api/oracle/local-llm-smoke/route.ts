// Oracle OS v0.8 — Local LLM Smoke Test API
// Tests Ollama inference on localhost:11434
// Safe, read-only, no side effects. No credentials. No external APIs.

import { NextResponse } from "next/server";
import { execSync } from "child_process";

interface SmokeTestResult {
  success: boolean;
  model: string;
  prompt: string;
  response: string;
  latency_ms: number;
  timestamp: string;
  error?: string;
}

function safeExec(cmd: string, timeoutMs = 10000): string | null {
  try {
    return execSync(cmd, { timeout: timeoutMs, encoding: "utf-8" }).trim();
  } catch {
    return null;
  }
}

export async function GET() {
  const startTime = Date.now();

  // 1. Check Ollama availability
  const ollama_check = safeExec("ollama list", 3000);
  if (!ollama_check) {
    return NextResponse.json({
      success: false,
      model: "unknown",
      prompt: "N/A",
      response: "",
      latency_ms: 0,
      timestamp: new Date().toISOString(),
      error: "Ollama not running or not in PATH",
    } as SmokeTestResult);
  }

  // 2. Extract first available model (prioritize mistral)
  const lines = ollama_check.split("\n").slice(1);
  let model = "mistral";
  let found = false;

  for (const line of lines) {
    const m = line.split(/\s+/)[0];
    if (m.includes("mistral")) {
      model = m;
      found = true;
      break;
    }
  }

  // If no mistral, use first available
  if (!found && lines.length > 0) {
    model = lines[0].split(/\s+/)[0];
  }

  // 3. Run a simple prompt
  const prompt = "What is the capital of France? Answer in one sentence.";
  const curlCmd = `curl -s http://localhost:11434/api/generate -d '{"model":"${model}","prompt":"${prompt}","stream":false}' 2>&1`;

  const response_raw = safeExec(curlCmd, 10000);

  if (!response_raw) {
    return NextResponse.json({
      success: false,
      model,
      prompt,
      response: "",
      latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: "Ollama curl request failed or timed out",
    } as SmokeTestResult);
  }

  // 4. Parse Ollama response
  try {
    const json = JSON.parse(response_raw);
    const response_text = json.response || "";
    const latency = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      model,
      prompt,
      response: response_text.slice(0, 200), // Truncate for API response
      latency_ms: latency,
      timestamp: new Date().toISOString(),
    } as SmokeTestResult);
  } catch {
    return NextResponse.json({
      success: false,
      model,
      prompt,
      response: response_raw.slice(0, 200),
      latency_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      error: "Failed to parse Ollama response",
    } as SmokeTestResult);
  }
}
