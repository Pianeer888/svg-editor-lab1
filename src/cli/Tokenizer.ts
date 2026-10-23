export class Tokenizer {
  static parse(line: string): string[] {
    const tokens: string[] = [];
    let current = '';
    let quoted = false;
    let active = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { quoted = !quoted; active = true; }
      else if (/\s/.test(ch ?? '') && !quoted) {
        if (active) { tokens.push(current); current = ''; active = false; }
      } else { current += ch; active = true; }
    }
    if (quoted) throw new Error('unterminated quoted string');
    if (active) tokens.push(current);
    return tokens;
  }
}
