import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Liest `.dev.vars` wie Wrangler (KEY=value, Kommentare mit #).
 * BOM wird entfernt (häufig unter Windows).
 */
export function loadDevVars(cwd = process.cwd()) {
  const filePath = join(cwd, '.dev.vars');
  if (!existsSync(filePath)) return {};
  let content = readFileSync(filePath, 'utf8');
  content = content.replace(/^\uFEFF/, '');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return env;
}

/** Shell-/CI-Werte haben Vorrang; nur fehlende oder leere Keys setzen. */
export function applyDevVarsToProcessEnv(vars) {
  for (const [key, value] of Object.entries(vars)) {
    if (typeof value !== 'string' || value === '') continue;
    const cur = process.env[key];
    if (cur === undefined || cur === '') {
      process.env[key] = value;
    }
  }
}
