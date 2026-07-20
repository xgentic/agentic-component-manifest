# Custom "ACM Canonical JSON" profile instead of RFC 8785

Principle V requires byte-identical canonical output, and the off-the-shelf answer is
RFC 8785 (JCS). We deliberately define our own profile instead: schema-declared key
order for specified fields, RFC 8785 scalar rules (ES6 number serialization, minimal
string escaping, UTF-8), pretty-printed 2-space/LF layout with a single trailing
newline, lexicographic ordering for arbitrary-key maps and `x-*` keys (after declared
keys), arrays in semantic source order. Pure JCS was rejected because it mandates
minified single-line output and lexicographic key order, which defeats diff
review — and "regenerate and diff" is this project's constitutional review mechanism.
We reuse JCS's hard, solved scalar-serialization core and accept the cost of owning a
reference canonicalizer.

## Consequences

- Producers must emit through the reference canonicalizer or match it byte-for-byte;
  consumers never canonicalize, they only validate.
- The profile is defined normatively in the Normative Spec and checked by the
  determinism gate (regenerate-and-diff).
