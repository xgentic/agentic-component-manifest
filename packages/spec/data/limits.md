# Structural Limits Registry

Normative limits (constitution X): per-field, per-collection, and per-depth — never
whole-document caps. Values live in the schema (`maxLength` / `maxItems`); nesting depth
is a Normative Spec clause (NS-LIMIT-2) enforced by the validator, since JSON Schema
cannot express recursion depth. Boundary-tested from both sides: the maximal fixture
validates inside every limit; hostile fixtures exceed them and are rejected.

| Limit | Value | Applies to | Rationale |
|---|---|---|---|
| `maxLength` names | 128 | `name`, `tagName`, css names, `export` | identifiers, generous |
| `maxLength` specifiers | 256–512 | `module`, `selector`, `path`, `syntax` | paths/selectors |
| `maxLength` prose | 8192 | `description`, example `source` | rich docs fit; injection bombs do not |
| `maxLength` notes | 2048 | semantic `notes` | annotation, not an essay |
| `maxLength` raw type | 4096 | `typeExpression.raw` | biggest observed real-world types fit |
| `maxLength` default | 1024 | `default` expressions | verbatim source snippets |
| `maxItems` modules | 256 | `modules` | monorepo-scale packages fit |
| `maxItems` collections | 256 | declarations, members per collection | DataGrid-class fits with headroom |
| `maxItems` grammar | 64 | union members, fields, parameters | structured tier stays reviewable |
| `maxItems` examples | 32 | `examples` | curated, not a gallery |
| Nesting depth | 32 | whole document (validator, `ACM-V-DEPTH`) | recursion bombs rejected |

Changing any value is a reviewable event: edit the schema (and this registry) in the
same change; the maximal and hostile fixtures must both still sit on their respective
sides of the new boundary.
