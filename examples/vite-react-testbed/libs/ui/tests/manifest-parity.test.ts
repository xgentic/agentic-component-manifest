import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The committed `agentic-component-manifest.json` is what an agent discovers — if it
 * drifts from the source, the published spec silently lies about the library. Running the
 * analyzer here would require it to be installed, so instead this test checks the two
 * invariants that drift shows up in first:
 *
 *  - every `@slot <name>` tag in a component's JSDoc is a named slot in the Manifest;
 *  - every component with a `children` prop has the default (unnamed) slot.
 *
 * Regenerate with `pnpm --filter @testbed/ui acm:generate` when this fails.
 */

const ROOT = join(import.meta.dirname, '..');
const LIB_DIR = join(ROOT, 'src', 'lib');

interface Declaration {
  name: string;
  inputs?: Array<{ name: string }>;
  slots?: Array<{ name?: string }>;
}

const manifest = JSON.parse(
  readFileSync(join(ROOT, 'agentic-component-manifest.json'), 'utf8'),
) as { modules: Array<{ declarations?: Declaration[] }> };
const declarations = manifest.modules.flatMap((m) => m.declarations ?? []);

const sources = readdirSync(LIB_DIR)
  .filter((name) => name.endsWith('.tsx'))
  .map((name) => ({ name, text: readFileSync(join(LIB_DIR, name), 'utf8') }));

/** Component names exported from a module — `export function X` or `export const X = …`. */
function exportedComponents(text: string): string[] {
  return [
    ...[...text.matchAll(/export function ([A-Z]\w*)/g)].map((m) => m[1]!),
    ...[...text.matchAll(/export const ([A-Z]\w*)\s*=/g)].map((m) => m[1]!),
  ];
}

function jsdocSlots(text: string): string[] {
  return [...text.matchAll(/@slot\s+([\w-]+)\s*-/g)].map((m) => m[1]!);
}

describe('committed Manifest tracks the source', () => {
  it('found component sources and a Manifest to check', () => {
    expect(sources.length).toBeGreaterThan(0);
    expect(declarations.length).toBeGreaterThan(0);
  });

  for (const source of sources) {
    for (const component of exportedComponents(source.text)) {
      const declaration = declarations.find((d) => d.name === component);

      it(`${component} is in the Manifest`, () => {
        expect(declaration).toBeDefined();
      });

      it(`${component}: every @slot tag is a named slot`, () => {
        const declared = jsdocSlots(source.text).sort();
        const inManifest = (declaration?.slots ?? [])
          .map((s) => s.name)
          .filter((name): name is string => name !== undefined)
          .sort();
        expect(inManifest).toEqual(declared);
      });

      it(`${component}: a children prop means a default slot`, () => {
        const takesChildren = (declaration?.inputs ?? []).some((i) => i.name === 'children');
        const hasDefaultSlot = (declaration?.slots ?? []).some((s) => s.name === undefined);
        expect(hasDefaultSlot).toBe(takesChildren);
      });
    }
  }
});
