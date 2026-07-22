## The two-call loop

1. **Search.** Run `acm search "<your need>" --json` with the natural-language
   need ("something that triggers an action", "date picker"). Read the ranked
   `results`: each carries the component name, a verbatim one-line description, a
   domain tag, and a runnable `followUp`.
2. **Detail.** Run the chosen result's `followUp` with `--json` appended. Read
   `data.entry`: the full spec, verbatim from the Manifest — inputs, events,
   slots, methods, CSS hooks, examples.
3. **Build** against that spec alone. Do not invent props or events from training
   data, do not scrape help text, and do not paraphrase the spec.

Branch only on the envelope's `type` and stable `code` — never on prose; wording
changes freely. Prefer `--dense` for human reads; parse only `--json`.

## When search misses

Search is literal, so widen before giving up:

1. **No good fit?** Re-run `acm search` with synonyms you generate from the task
   — a "status pill" might be a badge, chip, tag, or label. Any term can match.
2. **Empty** (`total: 0`, still success)? Its `followUps` run
   `acm component --dense` — list every component (name · tag · one-liner) and
   pick by reading. The corpus is small enough to scan whole.
3. **Still nothing?** Say no matching component exists and build without
   discovery — never fabricate one.
