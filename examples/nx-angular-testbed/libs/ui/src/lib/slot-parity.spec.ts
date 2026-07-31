import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The ACM analyzer derives Angular slots from `@slot` JSDoc tags only — it never reads
 * `<ng-content>` out of a template (see packages/analyzer/src/frameworks/angular.ts).
 * If a component's JSDoc drifts from its template, the published manifest silently lies
 * about the component's projection surface. This test keeps the two in lockstep.
 */

const LIB_DIR = join(__dirname);
const DEFAULT_SLOT_KEY = '(default)';

function componentFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return componentFiles(path);
    if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts')) return [path];
    return [];
  });
}

function ngContentSlots(source: string): string[] {
  const matches = [...source.matchAll(/<ng-content(?:\s+select="\[([\w-]+)\]")?\s*>/g)];
  return matches.map((m) => m[1] ?? DEFAULT_SLOT_KEY);
}

function jsdocSlots(source: string): string[] {
  const matches = [...source.matchAll(/@slot(?:\s+([\w-]+))?\s*-\s*.+/g)];
  return matches.map((m) => m[1] ?? DEFAULT_SLOT_KEY);
}

describe('@slot JSDoc <-> <ng-content> parity', () => {
  const files = componentFiles(LIB_DIR).filter((f) => statSync(f).isFile());

  it('found component files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const relative = file.slice(LIB_DIR.length + 1);
    it(`${relative}: every ng-content has a matching @slot tag and vice versa`, () => {
      const source = readFileSync(file, 'utf8');
      const fromTemplate = [...new Set(ngContentSlots(source))].sort();
      const fromJsdoc = [...new Set(jsdocSlots(source))].sort();
      expect(fromJsdoc).toEqual(fromTemplate);
    });
  }
});
