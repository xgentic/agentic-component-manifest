## Error codes

| Code | Meaning |
| --- | --- |
| `ACM-D-EMPTY-CORPUS` | no ACM Manifests were discovered in the assembled corpus |
| `ACM-D-UNKNOWN-COMPONENT` | the requested name matches no component in the corpus |
| `ACM-D-AMBIGUOUS-COMPONENT` | the requested name matches more than one component; qualify with --from (and --module for intra-package duplicates) |
| `ACM-D-BAD-MANIFEST` | an explicitly provided manifest path failed admission (missing, unparseable, invalid, or over the structural limits) |
| `ACM-D-USAGE` | invalid invocation: unknown command or option, unsupported enum value, or malformed number |
| `ACM-D-UNKNOWN` | unclassified failure; no more specific code applies |
