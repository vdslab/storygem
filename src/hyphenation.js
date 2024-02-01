import { hyphenateSync as hyphenate } from "hyphen/en";

export function hyphenatedLines(text) {
  const result = [];
  const parts = hyphenate(text, { hyphenChar: " " }).split(" ");
  const m = parts.length - 1;
  for (let x = 1; x < 1 << m; ++x) {
    let lines = [];
    let line = parts[0];
    for (let i = 0; i < m; ++i) {
      if ((x & (1 << i)) > 0) {
        lines.push(line + "-");
        line = parts[i + 1];
      } else {
        line += parts[i + 1];
      }
    }
    lines.push(line);
    result.push(lines);
  }
  return result;
}
