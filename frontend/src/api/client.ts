import type { Case } from "../types/case";

const API_BASE = "/api";
const REQUEST_TIMEOUT_MS = 2000;

/**
 * Fetch JSON with a timeout.
 * Abort the request if the server takes too long.
 */
async function fetchWithTimeout(
  url: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Fetch and validate a case file from a URL.
 */
async function fetchCase(url: string): Promise<Case> {
  const response = await fetchWithTimeout(url);

  if (!response.ok) {
    throw new Error(`Failed to load case from ${url}: ${response.status}`);
  }

  return (await response.json()) as Case;
}

/**
 * Load the investigation case.
 *
 * Priority:
 * 1. FastAPI backend
 * 2. Real exported case.json
 * 3. Sample case for development and offline use
 */
export async function loadCase(): Promise<Case> {
  const sources = [
    `${API_BASE}/case`,
    "/case.json",
    "/case.sample.json",
  ];

  const errors: string[] = [];

  for (const source of sources) {
    try {
      const investigationCase = await fetchCase(source);

      console.info(`Investigation case loaded from ${source}`);
      return investigationCase;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      errors.push(`${source}: ${message}`);
      console.warn(`Could not load case from ${source}`, error);
    }
  }

  throw new Error(
    `Unable to load the investigation case.\n${errors.join("\n")}`,
  );
}

/**
 * Upload the four raw investigation files to the backend.
 */
export interface CaseUploadFiles {
  people: File;
  logs: File;
  locations: File;
  statements: File;
}

export async function uploadCase(files: CaseUploadFiles): Promise<Case> {
  const formData = new FormData();

  formData.append("people", files.people);
  formData.append("logs", files.logs);
  formData.append("locations", files.locations);
  formData.append("statements", files.statements);

  const response = await fetch(`${API_BASE}/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      `Case upload failed (${response.status}): ${message}`,
    );
  }

  return (await response.json()) as Case;
}

/**
 * Configuration accepted by the backend.
 */
export interface RuleConfig {
  CONSPIRATOR_COUNT: number;
  SEVERITY: Record<string, number>;
  MIN_MEETING_MINUTES: number;
}

/**
 * Update investigation rules and return the rebuilt case.
 */
export async function updateConfig(config: RuleConfig): Promise<Case> {
  const response = await fetch(`${API_BASE}/config`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const message = await response.text();

    throw new Error(
      `Configuration update failed (${response.status}): ${message}`,
    );
  }

  return (await response.json()) as Case;
}

/**
 * Check whether the backend is reachable.
 */
export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetchWithTimeout(`${API_BASE}/health`);
    return response.ok;
  } catch {
    return false;
  }
}
