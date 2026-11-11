import { translateText } from './translateText';

const DISK_KEY = 'hookup:line-tr:v1';
const memory = new Map<string, string>();

function pairKey(source: string, target: string, text: string): string {
  return `${source}|${target}|${text}`;
}

function readDisk(key: string): string | null {
  try {
    const raw = localStorage.getItem(DISK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed[key] === 'string' ? parsed[key] : null;
  } catch {
    return null;
  }
}

function writeDisk(key: string, value: string): void {
  try {
    const raw = localStorage.getItem(DISK_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    const keys = Object.keys(parsed);
    if (keys.length > 400) {
      for (const old of keys.slice(0, keys.length - 320)) delete parsed[old];
    }
    parsed[key] = value;
    localStorage.setItem(DISK_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore quota */
  }
}

function shield(text: string): { safe: string; tokens: string[] } {
  const tokens: string[] = [];
  const safe = text.replace(/\{[a-zA-Z0-9_]+\}/g, (token) => {
    const id = tokens.length;
    tokens.push(token);
    return `⟦${id}⟧`;
  });
  return { safe, tokens };
}

function restore(text: string, tokens: string[]): string {
  return text.replace(/⟦\s*(\d+)\s*⟧|\[\[\s*(\d+)\s*\]\]/g, (_, a, b) => {
    const id = Number(a ?? b);
    return tokens[id] ?? '';
  });
}

export async function localizeLine(text: string, targetLang: string, sourceLang = 'en'): Promise<string> {
  const target = (targetLang || 'en').toLowerCase().split('-')[0] || 'en';
  const source = (sourceLang || 'en').toLowerCase().split('-')[0] || 'en';
  if (!text.trim() || target === source) return text;
  const key = pairKey(source, target, text);
  const hit = memory.get(key) || readDisk(key);
  if (hit) {
    memory.set(key, hit);
    return hit;
  }
  const { safe, tokens } = shield(text);
  let out = restore(await translateText(safe, target, source), tokens);
  if (tokens.length && tokens.some((token) => !out.includes(token))) {
    out = await translateText(text, target, source);
  }
  memory.set(key, out);
  writeDisk(key, out);
  return out;
}

const BREAK = '\n⟦BR⟧\n';

export async function localizeLines(lines: string[], targetLang: string, sourceLang = 'en'): Promise<string[]> {
  const target = (targetLang || 'en').toLowerCase().split('-')[0] || 'en';
  const source = (sourceLang || 'en').toLowerCase().split('-')[0] || 'en';
  if (target === source) return lines;
  const out: string[] = [];
  let chunk: string[] = [];
  let size = 0;
  const flush = async () => {
    if (!chunk.length) return;
    const current = chunk;
    chunk = [];
    size = 0;
    try {
      const joined = await localizeLine(current.join(BREAK), target, source);
      const parts = joined.split(/\n?\s*⟦\s*BR\s*⟧\s*\n?/);
      if (parts.length === current.length) {
        out.push(...parts.map((part) => part.trim()));
        return;
      }
    } catch {
      /* fall through to one line at a time */
    }
    for (const line of current) {
      try {
        out.push(await localizeLine(line, target, source));
      } catch {
        out.push(line);
      }
    }
  };
  for (const line of lines) {
    if (size + line.length + BREAK.length > 380 && chunk.length) await flush();
    chunk.push(line);
    size += line.length + BREAK.length;
  }
  await flush();
  return out;
}
