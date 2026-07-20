export interface Diagnostic {
  /** Stable rule id from the Normative Spec NS-RULES registry (e.g. ACM-V-DEPTH). */
  ruleId: string;
  /** JSON Pointer to the failing node; empty string means the whole document. */
  pointer: string;
  message: string;
}

export function renderDiagnostics(diagnostics: Diagnostic[], asJson: boolean): string {
  if (asJson) return JSON.stringify({ diagnostics }, null, 2);
  return diagnostics
    .map((d) => `${d.ruleId} at ${d.pointer === "" ? "/" : d.pointer}: ${d.message}`)
    .join("\n");
}
