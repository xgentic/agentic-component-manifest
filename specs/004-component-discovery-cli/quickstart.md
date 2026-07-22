# Quickstart: Component Discovery CLI — validation guide

End-to-end scenarios proving the feature works. All commands run from the repo
root against the checked-in corpus fixture
(`packages/conformance/fixtures/discovery-corpus`), which contains packages
advertising the witness manifests via all three NS-DISC branches, a hostile
injection manifest, a broken advertisement, and a manifest-less package.

## Prerequisites

```sh
pnpm install
CORPUS=packages/conformance/fixtures/discovery-corpus
```

## 1. Search finds and ranks components (US1)

```sh
pnpm acm search button --project "$CORPUS"
```

**Expect**: ranked results with `[component]` domain tags, verbatim one-line
descriptions, and runnable follow-up commands; `Button`-named components above
components that merely mention "button" in prose; exit 0.

```sh
pnpm acm search buttn --project "$CORPUS"          # fuzzy: typo still finds Button
pnpm acm search nonexistentquery --project "$CORPUS"; echo "exit=$?"
```

**Expect**: typo query lists the intended component in the top results; the
no-match query prints an explicitly empty result set with **exit=0**.

```sh
pnpm acm search button --project "$CORPUS" --limit 1 --detail full
```

**Expect**: one result carrying source package, match reason(s), and score.

## 2. Component detail, list, suggestions, disambiguation (US2)

```sh
pnpm acm component --project "$CORPUS"                       # brief corpus listing
pnpm acm component --project "$CORPUS" --detail compact      # + verbatim one-liners
pnpm acm component AcmeButton --project "$CORPUS"; echo "exit=$?"
```

**Expect**: the bare name is ambiguous in this corpus → candidate list with
qualified follow-ups (never a silent pick), `ACM-D-AMBIGUOUS-COMPONENT`, exit 1.

```sh
pnpm acm component AcmeButton --from @acme/lit-buttons --project "$CORPUS"
pnpm acm component Buttn --project "$CORPUS"; echo "exit=$?"
```

**Expect**: the `--from` invocation prints full detail — every populated section
of the Manifest entry, text verbatim; the typo fails with closest-name
suggestions and exit 1.

## 3. Typed envelopes and stable codes (US3)

```sh
pnpm acm search button --project "$CORPUS" --json | head -1
pnpm acm component Buttn --project "$CORPUS" --json; echo "exit=$?"
pnpm acm search x --project /tmp/definitely-empty --json; echo "exit=$?"
```

**Expect**: stdout is exactly one parseable envelope per run —
`{"type":"search",…}`; then `{"error":…,"code":"ACM-D-UNKNOWN-COMPONENT","suggestions":[…]}`
exit 1; then `"code":"ACM-D-EMPTY-CORPUS"` exit 1. Corpus skip diagnostics (from
`broken-pkg`) appear on **stderr only** ([contracts/envelope.md](./contracts/envelope.md)).

## 4. Capability manifest (US4)

```sh
pnpm acm capabilities --json
```

**Expect**: a `"type":"capabilities"` envelope enumerating **every** `acm` command
with arguments, options (types/choices/defaults), `json` support, response types,
and examples, plus the `errorCodes` registry
([contracts/capability-manifest.md](./contracts/capability-manifest.md)). Any
invocation composed from it must be accepted.

## 5. Programmatic parity (US5)

Covered mechanically by `packages/conformance/tests/discovery-surface.test.ts`:
per operation, the API result deep-equals the spawned CLI's `--json` stdout,
including one forced failure per error code
([contracts/api.md](./contracts/api.md)).

## 6. Hostile inertness and determinism (FR-011, FR-012)

```sh
pnpm acm search injection --project "$CORPUS" | cat -v | grep -F '^[' && echo "LEAK" || echo "inert"   # expect: inert
pnpm acm component AcmeButton --from @acme/lit-buttons --project "$CORPUS" --dense
pnpm acm search button --project "$CORPUS" --json > /tmp/a.json
pnpm acm search button --project "$CORPUS" --json > /tmp/b.json
diff /tmp/a.json /tmp/b.json && echo identical
```

**Expect**: no raw escape bytes in human output from the hostile package (text
surfaced inertly); dense detail renders the Agent View projection at least 40%
smaller than `--detail full`; repeated runs are byte-identical.

## 7. Gates

```sh
pnpm test        # full conformance suite, incl. discovery-*.test.ts
pnpm test:seeded # seeded proofs: undescribed command, sanitization removed, parity break — each must FAIL the gate
pnpm lint && pnpm format
```

**Done when**: all suites green; goldens for search/list/detail/capability
committed; seeded proofs demonstrably fail when their seed is applied.
