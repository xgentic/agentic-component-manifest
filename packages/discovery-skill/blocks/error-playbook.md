## Error playbook

Every error envelope carries a stable code. Branch on it:

| Code | Do this |
| --- | --- |
| `ACM-D-EMPTY-CORPUS` | Stop discovery gracefully: report that no ACM Manifests were found and continue the task without the loop. |
| `ACM-D-UNKNOWN-COMPONENT` | Use the envelope's `suggestions` (closest names) and re-request via a suggestion's `followUp`. Never free-form retry names. |
| `ACM-D-AMBIGUOUS-COMPONENT` | Pick the intended candidate from `suggestions` and re-request with its `followUp` (qualified by `--from`, plus `--module` for intra-package duplicates). Never pick one arbitrarily. |
| `ACM-D-BAD-MANIFEST` | An explicitly passed `--manifest` path failed admission. Fix the path or drop the flag; the rest of the corpus is unaffected. |
| `ACM-D-USAGE` | The invocation does not match the installed surface. Consult `acm capabilities --json` and recompose the call from its self-description. |
| `ACM-D-UNKNOWN` | Unclassified failure. Report the message verbatim and fall back to working without discovery. |

A zero-result search is **success** (`total: 0`), not an error — follow the
"When search misses" ladder above (broaden, then `acm component --dense`, then
proceed). Never fabricate a component.
