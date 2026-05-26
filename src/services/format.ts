import { CHARACTER_LIMIT, ResponseFormat } from "../constants.js";
import type { QueryRunResult } from "./db.js";

export interface ToolTextResponse {
  [x: string]: unknown;
  content: { type: "text"; text: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

export function textResponse(text: string, structured?: Record<string, unknown>): ToolTextResponse {
  return {
    content: [{ type: "text", text }],
    ...(structured ? { structuredContent: structured } : {}),
  };
}

export function errorResponse(message: string): ToolTextResponse {
  return {
    content: [{ type: "text", text: `Error: ${message}` }],
    isError: true,
  };
}

export function handlePgError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const pgErr = err as { code?: string; message?: string; detail?: string; hint?: string; position?: string };
    const parts: string[] = [];
    if (pgErr.code) parts.push(`[${pgErr.code}]`);
    if (pgErr.message) parts.push(pgErr.message);
    if (pgErr.detail) parts.push(`Detail: ${pgErr.detail}`);
    if (pgErr.hint) parts.push(`Hint: ${pgErr.hint}`);
    return parts.join(" ");
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export function truncateForLimit<T>(rows: T[], baseLength: number, render: (slice: T[]) => string): {
  rendered: string;
  truncated: boolean;
  shownCount: number;
} {
  let slice = rows;
  let rendered = render(slice);
  let truncated = false;
  while (baseLength + rendered.length > CHARACTER_LIMIT && slice.length > 1) {
    truncated = true;
    slice = slice.slice(0, Math.max(1, Math.floor(slice.length / 2)));
    rendered = render(slice);
  }
  return { rendered, truncated, shownCount: slice.length };
}

export function formatQueryResult(
  result: QueryRunResult,
  format: ResponseFormat,
): ToolTextResponse {
  const structured = {
    command: result.command,
    row_count: result.rowCount,
    duration_ms: result.durationMs,
    fields: result.fields,
    rows: result.rows,
  } satisfies Record<string, unknown>;

  if (format === ResponseFormat.JSON) {
    let text = JSON.stringify(structured, null, 2);
    if (text.length > CHARACTER_LIMIT) {
      const half = Math.max(1, Math.floor(result.rows.length / 2));
      const trimmed = {
        ...structured,
        rows: result.rows.slice(0, half),
        truncated: true,
        truncation_message: `Response truncated from ${result.rows.length} to ${half} rows. Add a LIMIT clause or filter to reduce results.`,
      };
      text = JSON.stringify(trimmed, null, 2);
    }
    return textResponse(text, structured);
  }

  const headerLines = [
    `# Query Result`,
    ``,
    `- **Command**: ${result.command || "(none)"}`,
    `- **Rows**: ${result.rowCount ?? result.rows.length}`,
    `- **Duration**: ${result.durationMs} ms`,
    ``,
  ];

  if (!result.rows.length) {
    return textResponse(
      [...headerLines, "_(no rows returned)_"].join("\n"),
      structured,
    );
  }

  const columns = Object.keys(result.rows[0] as Record<string, unknown>);
  const renderTable = (slice: Record<string, unknown>[]) => {
    const header = `| ${columns.join(" | ")} |`;
    const sep = `| ${columns.map(() => "---").join(" | ")} |`;
    const body = slice
      .map(
        (row) =>
          `| ${columns
            .map((c) => formatCell(row[c]))
            .join(" | ")} |`,
      )
      .join("\n");
    return [header, sep, body].join("\n");
  };

  const headerText = headerLines.join("\n");
  const { rendered, truncated, shownCount } = truncateForLimit(
    result.rows as Record<string, unknown>[],
    headerText.length,
    renderTable,
  );

  const footer = truncated
    ? `\n\n_Showing ${shownCount} of ${result.rows.length} rows — response was truncated. Add a LIMIT clause or filter to reduce results._`
    : "";

  return textResponse(headerText + rendered + footer, structured);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "string") return escapeMarkdownCell(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    try {
      return escapeMarkdownCell(JSON.stringify(value));
    } catch {
      return "[object]";
    }
  }
  return escapeMarkdownCell(String(value));
}

function escapeMarkdownCell(value: string): string {
  // Replace pipes, newlines so the markdown table renders cleanly.
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ⏎ ");
}
