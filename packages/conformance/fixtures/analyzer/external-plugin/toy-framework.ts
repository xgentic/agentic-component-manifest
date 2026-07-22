/**
 * SC-005 demonstration: a *complete external framework* taught to the analyzer purely
 * through the public plugin contract. This file imports the analyzer only through its
 * published entry point (`@xgentic/acm-analyzer` → `plugin.ts`) and touches nothing internal —
 * no `context`, `emit`, `type-mapping`, or framework code. Everything it produces goes
 * through the `SessionContext` seam every built-in framework also uses, proving the core
 * carries zero framework knowledge (the Prime Directive). Registered from a settings
 * file as `plugins: [toyWidgetPlugin()]` with `framework` unset.
 *
 * The toy "Widget" framework: a component is an exported `function …Widget(props: {…})`.
 * Each object-type property becomes an input; the leading doc-comment becomes a verbatim
 * description; a namespaced `x-toy` marker demonstrates Tier-3 enrichment.
 *
 * The relative import path mirrors how the conformance harness reaches every workspace
 * package; the specifier still resolves to `exports["."]`, the single public entry.
 */

import ts from "typescript";
import type {
  AnalyzerPlugin,
  ModuleContext,
  SessionContext,
  Span,
} from "../../../../analyzer/src/plugin.js";

/** The verbatim, trimmed inner text of the last leading `/** … *\/` block, as a Span. */
function docSpan(fullStart: number, module: ModuleContext, ctx: SessionContext): Span | undefined {
  const ranges = ts.getLeadingCommentRanges(module.text, fullStart);
  if (!ranges) return undefined;
  const range = [...ranges]
    .reverse()
    .find(
      (r) =>
        r.kind === ts.SyntaxKind.MultiLineCommentTrivia &&
        module.text.slice(r.pos, r.pos + 3) === "/**",
    );
  if (!range) return undefined;
  let start = range.pos + 3; // past "/**"
  let end = range.end - 2; // before "*/"
  while (start < end && /\s/.test(module.text[start]!)) start++;
  while (end > start && /\s/.test(module.text[end - 1]!)) end--;
  return start < end ? ctx.span(module, start, end) : undefined;
}

/** An exported `function <Name>Widget(...)` — the toy framework's sole component shape. */
function widgetDeclaration(node: ts.Node): ts.FunctionDeclaration | undefined {
  if (!ts.isFunctionDeclaration(node) || !node.name) return undefined;
  const exported = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  return exported && node.name.text.endsWith("Widget") ? node : undefined;
}

export function toyWidgetPlugin(): AnalyzerPlugin {
  return {
    name: "toy-widgets",

    analyze(node, module, ctx) {
      const fn = widgetDeclaration(node);
      if (!fn) return;

      const moduleFacet = ctx.packageName;
      if (moduleFacet === undefined) {
        ctx.addDiagnostic({
          code: "ACM-A-TOY",
          severity: "error",
          file: module.path,
          message: `cannot resolve a module identity for "${fn.name!.text}" (no package name)`,
        });
        return;
      }

      const entry = ctx.createEntry(module, {
        name: fn.name!.text,
        paradigmClass: "vdom",
        identity: { module: moduleFacet, export: fn.name!.text },
      });

      const doc = docSpan(fn.pos, module, ctx);
      if (doc) entry.describe(doc);

      const propsType = fn.parameters[0]?.type;
      if (propsType && ts.isTypeLiteralNode(propsType)) {
        for (const member of propsType.members) {
          if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
          entry.addInput({
            name: member.name.text,
            description: docSpan(member.pos, module, ctx),
            type: ctx.types.map(member.type, module),
          });
        }
      }

      // Tier-3 enrichment under a namespaced key: valid, survives validation untouched.
      entry.set("x-toy", { framework: "toy-widgets" });
    },
  };
}
