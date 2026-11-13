import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export type ToolMode = "readonly" | "full";

/**
 * Tools that carry readOnlyHint but still have an outward-facing effect,
 * so they stay out of read-only mode.
 */
const READONLY_EXCLUDED = new Set<string>([
  "get_document_public_url", // hands out a public link to a document
]);

export function resolveToolMode(value: string | undefined): ToolMode {
  const mode = (value ?? "readonly").trim().toLowerCase();
  if (mode === "full") return "full";
  if (mode === "readonly" || mode === "") return "readonly";
  throw new Error(
    `Invalid BILLINGO_MCP_MODE "${value}". Use "readonly" (default) or "full".`,
  );
}

/**
 * Enforces the tool mode at registration time: in read-only mode, tools that
 * are not explicitly annotated readOnlyHint: true are never registered, so the
 * client cannot see or call them. Must be called before register*Tools().
 * Returns the names of the skipped tools.
 */
export function applyToolPolicy(server: McpServer, mode: ToolMode): string[] {
  const skipped: string[] = [];
  if (mode === "full") return skipped;

  const original = server.tool.bind(server) as (...args: unknown[]) => unknown;
  (server as unknown as { tool: (...args: unknown[]) => unknown }).tool = (
    ...args: unknown[]
  ) => {
    const name = String(args[0]);
    const readOnly = args.some(
      (a) =>
        typeof a === "object" &&
        a !== null &&
        (a as { readOnlyHint?: unknown }).readOnlyHint === true,
    );
    if (!readOnly || READONLY_EXCLUDED.has(name)) {
      skipped.push(name);
      return undefined;
    }
    return original(...args);
  };
  return skipped;
}
