/** "1 finding", "3 findings": a count with its noun, never "finding(s)". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** A quote shortened for a table cell, with an ellipsis when it was cut. */
export function shorten(text: string, max = 50): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}
