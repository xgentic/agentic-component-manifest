import type { ReactNode } from 'react';

/**
 * Intentionally near-empty.
 *
 * Any request to add UI here should force a real choice: discover a component from
 * `@testbed/ui` via the ACM Discovery Skill, or say explicitly that none fits. See
 * ../../../AGENTS.md.
 */
export function App(): ReactNode {
  return (
    <main>
      <h1>Demo</h1>
    </main>
  );
}
