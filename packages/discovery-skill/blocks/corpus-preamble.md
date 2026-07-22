## Before you start

1. Confirm the CLI exists: run `acm capabilities --json`. If it is missing,
   report that the ACM toolchain is not installed (add the `@acm/toolchain` dev
   dependency) and continue the task without discovery — never guess component
   APIs silently.
2. The corpus is discovered per invocation from the project and its installed
   dependencies. If a discovery call returns `ACM-D-EMPTY-CORPUS`, state that no
   ACM Manifests were found and proceed without the loop — never retry-loop an
   empty corpus.
