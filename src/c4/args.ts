// Low-level helpers for parsing Mermaid C4 function-call argument lists.

export interface ParsedArgs {
  positional: string[];
  named: Record<string, string>;
}

/** Split a raw argument string on top-level commas, respecting quotes/parens. */
export function splitArgs(raw: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let cur = "";
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quote) {
      cur += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "(") depth++;
    if (c === ")") depth--;
    if (c === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  if (cur.trim().length > 0) out.push(cur.trim());
  return out;
}

/** Remove one layer of surrounding quotes and unescape common sequences. */
export function unquote(token: string): string {
  const t = token.trim();
  if (
    t.length >= 2 &&
    ((t[0] === '"' && t[t.length - 1] === '"') ||
      (t[0] === "'" && t[t.length - 1] === "'"))
  ) {
    return t.slice(1, -1).replace(/\\"/g, '"');
  }
  return t;
}

/** Split raw args into ordered positional values and named ($key=value) pairs. */
export function parseArgs(raw: string): ParsedArgs {
  const parts = splitArgs(raw);
  const positional: string[] = [];
  const named: Record<string, string> = {};
  for (const part of parts) {
    const m = /^(\$?[A-Za-z_][\w]*)\s*=\s*([\s\S]+)$/.exec(part);
    if (m && !part.startsWith('"') && !part.startsWith("'")) {
      named[m[1]] = unquote(m[2]);
    } else {
      positional.push(unquote(part));
    }
  }
  return { positional, named };
}

/** Quote a value for emission, only when it contains commas/quotes/spaces. */
export function quoteIfNeeded(value: string): string {
  if (value === "") return '""';
  if (/[",()]/.test(value) || /^\s|\s$/.test(value)) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return `"${value}"`;
}
