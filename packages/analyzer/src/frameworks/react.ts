/**
 * React plugin (T023, research R-07 / R-07-A). Consumes only the public plugin interface.
 *
 * Exported function components (incl. `forwardRef`/`memo`, nested and `React.`-qualified),
 * `FC`-annotated consts, and class components. Each prop → input (`?` → optional,
 * destructuring defaults → `default`); callback/`on*` props stay inputs (React has no
 * event channel). Events/slots/CSS come from the CEM JSDoc tags; imperative-handle
 * methods from `useImperativeHandle`. Identity: module + export only;
 * `paradigmClass: vdom`.
 *
 * Props types resolve across the modules the analyzer already parsed — syntactically, via
 * an index built in `collect`. No type checker and no `node_modules`, so a run stays
 * reproducible from its flags alone (R-07-A). Anything outside that reach contributes no
 * members and is recorded verbatim under `x-react.unresolvedProps` (spec 007 FR-010).
 */

import ts from "typescript";
import { cemTags, description } from "../jsdoc.js";
import type {
  AnalyzerPlugin,
  EntryDraft,
  MethodDraft,
  ModuleContext,
  SessionContext,
  SlotDraft,
} from "../plugin.js";
import {
  applyDocMetadata,
  hasModifier,
  isExportedDecl,
  isPublicMember,
  memberName,
  methodDraft,
  moduleFacet,
} from "./shared.js";

/** How deep props resolution follows references before giving up (FR-009). */
const MAX_PROPS_DEPTH = 16;

/** Variable annotations that carry the props type as their first type argument. */
const FC_ANNOTATIONS = new Set(["FC", "VFC", "FunctionComponent", "VoidFunctionComponent"]);

/** Component wrappers whose argument is the render function. */
const WRAPPERS = new Set(["forwardRef", "memo"]);

/** Base classes that make a class a React component; props are their first type argument. */
const CLASS_BASES = new Set(["Component", "PureComponent"]);

/** Utility types props resolution understands (FR-007); everything else is unresolved. */
const UTILITY_TYPES = new Set(["Partial", "Required", "Omit", "Pick"]);

interface Component {
  name: string;
  exported: boolean;
  /** True for `export default`, which takes `default` as its export facet (FR-005). */
  defaultExport: boolean;
  /** The render function whose body may register an imperative handle; absent for classes. */
  render?: ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration;
  /** The class body, for class components. */
  classDecl?: ts.ClassDeclaration;
  /** Props type node (parameter annotation, wrapper type argument, or `FC<…>` argument). */
  propsType: ts.TypeNode | undefined;
  /** Imperative handle type (`forwardRef<Handle, Props>`), for method signatures. */
  handleType: ts.TypeNode | undefined;
}

function isPascalCase(name: string): boolean {
  return /^[A-Z]/.test(name);
}

/** The rightmost name of a callee, so `React.forwardRef` matches `forwardRef` (FR-002). */
function calleeName(expr: ts.Expression): string | undefined {
  if (ts.isIdentifier(expr)) return expr.text;
  if (ts.isPropertyAccessExpression(expr) && ts.isIdentifier(expr.name)) return expr.name.text;
  return undefined;
}

/** The rightmost name of a type reference's qualified name (`React.FC` → `FC`). */
function typeRefName(name: ts.EntityName): string {
  return ts.isQualifiedName(name) ? name.right.text : name.text;
}

/**
 * Peel `memo`/`forwardRef` wrappers, nested in either order, down to the render function.
 * Type arguments come from the innermost wrapper that carries them — `memo(forwardRef<H, P>(fn))`
 * puts them on the `forwardRef` call.
 */
function unwrapWrapper(expr: ts.Expression): {
  fn?: ts.Expression;
  typeArgs?: ts.NodeArray<ts.TypeNode>;
} {
  let current: ts.Expression = expr;
  let typeArgs: ts.NodeArray<ts.TypeNode> | undefined;
  for (let depth = 0; depth < 8; depth++) {
    if (!ts.isCallExpression(current)) break;
    const callee = calleeName(current.expression);
    if (callee === undefined || !WRAPPERS.has(callee)) break;
    if (current.typeArguments?.length) typeArgs = current.typeArguments;
    const arg = current.arguments[0];
    if (!arg) break;
    current = arg;
  }
  return { fn: current, typeArgs };
}

/** The props type argument of an `FC<Props>` / `React.FC<Props>` variable annotation. */
function fcAnnotationProps(type: ts.TypeNode | undefined): ts.TypeNode | undefined {
  if (!type || !ts.isTypeReferenceNode(type)) return undefined;
  if (!FC_ANNOTATIONS.has(typeRefName(type.typeName))) return undefined;
  return type.typeArguments?.[0];
}

/** The props type argument of `extends Component<Props>` / `React.PureComponent<Props>`. */
function classBaseProps(node: ts.ClassDeclaration): ts.TypeNode | undefined {
  for (const clause of node.heritageClauses ?? []) {
    if (clause.token !== ts.SyntaxKind.ExtendsKeyword) continue;
    for (const base of clause.types) {
      const name = calleeName(base.expression);
      if (name !== undefined && CLASS_BASES.has(name)) return base.typeArguments?.[0];
    }
  }
  return undefined;
}

/** Recognize an exported component from a top-level statement. */
function componentOf(node: ts.Node): Component | undefined {
  if (ts.isFunctionDeclaration(node) && node.name && isPascalCase(node.name.text)) {
    return {
      name: node.name.text,
      exported: isExportedDecl(node),
      defaultExport: hasModifier(node, ts.SyntaxKind.DefaultKeyword),
      render: node,
      propsType: node.parameters[0]?.type,
      handleType: undefined,
    };
  }

  if (ts.isClassDeclaration(node) && node.name && isPascalCase(node.name.text)) {
    const propsType = classBaseProps(node);
    if (!propsType) return undefined;
    return {
      name: node.name.text,
      exported: isExportedDecl(node),
      defaultExport: hasModifier(node, ts.SyntaxKind.DefaultKeyword),
      classDecl: node,
      propsType,
      handleType: undefined,
    };
  }

  if (ts.isVariableStatement(node)) {
    const decl = node.declarationList.declarations[0];
    if (
      !decl ||
      !ts.isIdentifier(decl.name) ||
      !isPascalCase(decl.name.text) ||
      !decl.initializer
    ) {
      return undefined;
    }
    const { fn, typeArgs } = unwrapWrapper(decl.initializer);
    if (!fn || (!ts.isArrowFunction(fn) && !ts.isFunctionExpression(fn))) return undefined;
    return {
      name: decl.name.text,
      exported: isExportedDecl(node),
      defaultExport: false,
      render: fn,
      propsType: fn.parameters[0]?.type ?? typeArgs?.[1] ?? fcAnnotationProps(decl.type),
      handleType: typeArgs?.[0],
    };
  }

  return undefined;
}

// --- Cross-module props resolution (R-07-A) ---------------------------------------

/** A type declaration reachable by name within one module. */
type TypeDecl = ts.InterfaceDeclaration | ts.TypeAliasDeclaration;

/** One module's contribution to the resolution index, built during `collect`. */
interface ModuleIndex {
  module: ModuleContext;
  /** Locally declared interfaces and type aliases, by name. */
  decls: Map<string, TypeDecl>;
  /** Imported binding name → the specifier it came from. */
  imports: Map<string, string>;
}

/** A prop reached by resolution, carrying the module it was declared in. */
interface ResolvedProp {
  name: string;
  prop: ts.PropertySignature;
  /** The module whose AST `prop` belongs to — spans and `raw` text must come from it. */
  module: ModuleContext;
  /** Forced by `Partial`/`Required`; otherwise the `?` token decides. */
  optional: boolean;
}

interface Resolution {
  props: ResolvedProp[];
  /** Verbatim source text of every type this resolution could not follow (FR-010). */
  unresolved: string[];
}

/** POSIX join of a module-relative specifier against the importing module's directory. */
function joinRelative(fromPath: string, specifier: string): string {
  const segments = fromPath.split("/").slice(0, -1);
  for (const part of specifier.split("/")) {
    if (part === "." || part === "") continue;
    if (part === "..") segments.pop();
    else segments.push(part);
  }
  return segments.join("/");
}

/**
 * Resolve a relative import specifier to a module the analyzer already parsed. Bare
 * specifiers resolve to nothing by design — following them into `node_modules` would make
 * output depend on an install tree (R-07-A).
 */
function resolveSpecifier(
  fromPath: string,
  specifier: string,
  known: ReadonlyMap<string, ModuleIndex>,
): ModuleIndex | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = joinRelative(fromPath, specifier);
  const stem = base.replace(/\.(js|jsx|mjs|cjs)$/, "");
  const candidates = [
    base,
    `${stem}.ts`,
    `${stem}.tsx`,
    `${stem}.d.ts`,
    `${stem}/index.ts`,
    `${stem}/index.tsx`,
    `${stem}/index.d.ts`,
  ];
  for (const candidate of candidates) {
    const hit = known.get(candidate);
    if (hit) return hit;
  }
  return undefined;
}

/** Every string-literal member of a `Pick`/`Omit` key argument (`'a' | 'b'`). */
function literalKeys(node: ts.TypeNode | undefined): string[] {
  if (!node) return [];
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) return [node.literal.text];
  if (ts.isUnionTypeNode(node)) return node.types.flatMap(literalKeys);
  return [];
}

/** The resolution index, populated by `collect` before any `analyze` runs (R-19). */
class PropsIndex {
  private readonly modules = new Map<string, ModuleIndex>();

  add(module: ModuleContext): void {
    const decls = new Map<string, TypeDecl>();
    const imports = new Map<string, string>();
    for (const statement of module.ast.statements) {
      if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
        decls.set(statement.name.text, statement);
      }
      if (
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.importClause?.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        for (const element of statement.importClause.namedBindings.elements) {
          imports.set(element.name.text, statement.moduleSpecifier.text);
        }
      }
    }
    this.modules.set(module.path, { module, decls, imports });
  }

  private indexOf(module: ModuleContext): ModuleIndex | undefined {
    return this.modules.get(module.path);
  }

  /** Find a named type declaration, following relative imports across modules. */
  lookup(
    name: string,
    module: ModuleContext,
    seen = new Set<string>(),
  ): { decl: TypeDecl; module: ModuleContext } | undefined {
    const index = this.indexOf(module);
    if (!index) return undefined;
    const key = `${module.path}#${name}`;
    if (seen.has(key)) return undefined;
    seen.add(key);

    const local = index.decls.get(name);
    if (local) return { decl: local, module: index.module };

    const specifier = index.imports.get(name);
    if (specifier === undefined) return undefined;
    const target = resolveSpecifier(module.path, specifier, this.modules);
    return target ? this.lookup(name, target.module, seen) : undefined;
  }

  /** Resolve a props type node to its flat member list, in FR-008 order. */
  resolve(type: ts.TypeNode | undefined, module: ModuleContext): Resolution {
    const out: Resolution = { props: [], unresolved: [] };
    this.walk(type, module, 0, new Set(), out, undefined);
    return dedupe(out);
  }

  private walk(
    type: ts.TypeNode | undefined,
    module: ModuleContext,
    depth: number,
    seen: Set<string>,
    out: Resolution,
    optionalOverride: boolean | undefined,
  ): void {
    if (!type) return;
    if (depth > MAX_PROPS_DEPTH) {
      out.unresolved.push(type.getText(module.ast));
      return;
    }

    if (ts.isParenthesizedTypeNode(type)) {
      this.walk(type.type, module, depth + 1, seen, out, optionalOverride);
      return;
    }

    if (ts.isIntersectionTypeNode(type)) {
      for (const member of type.types) {
        this.walk(member, module, depth + 1, seen, out, optionalOverride);
      }
      return;
    }

    if (ts.isTypeLiteralNode(type)) {
      this.collectMembers(type.members, module, out, optionalOverride);
      return;
    }

    if (ts.isTypeReferenceNode(type)) {
      this.walkReference(type, module, depth, seen, out, optionalOverride);
      return;
    }

    out.unresolved.push(type.getText(module.ast));
  }

  private walkReference(
    type: ts.TypeReferenceNode,
    module: ModuleContext,
    depth: number,
    seen: Set<string>,
    out: Resolution,
    optionalOverride: boolean | undefined,
  ): void {
    const name = typeRefName(type.typeName);
    const target = this.lookup(name, module);

    if (!target && UTILITY_TYPES.has(name) && type.typeArguments?.length) {
      this.walkUtility(name, type, module, depth, seen, out, optionalOverride);
      return;
    }

    if (!target) {
      out.unresolved.push(type.getText(module.ast));
      return;
    }

    this.walkNamed(name, target, depth, seen, out, optionalOverride);
  }

  /**
   * An `extends` clause entry is an expression, not a type node, so it re-enters
   * resolution by name — sharing one rule set with plain type references.
   */
  private walkHeritage(
    base: ts.ExpressionWithTypeArguments,
    module: ModuleContext,
    depth: number,
    seen: Set<string>,
    out: Resolution,
    optionalOverride: boolean | undefined,
  ): void {
    const name = calleeName(base.expression);
    const target = name === undefined ? undefined : this.lookup(name, module);
    if (!target || name === undefined) {
      out.unresolved.push(base.getText(module.ast));
      return;
    }
    this.walkNamed(name, target, depth, seen, out, optionalOverride);
  }

  /** Shared tail of reference resolution once the declaration is in hand. */
  private walkNamed(
    name: string,
    target: { decl: TypeDecl; module: ModuleContext },
    depth: number,
    seen: Set<string>,
    out: Resolution,
    optionalOverride: boolean | undefined,
  ): void {
    const key = `${target.module.path}#${name}`;
    if (seen.has(key)) return;
    seen.add(key);

    if (ts.isInterfaceDeclaration(target.decl)) {
      for (const clause of target.decl.heritageClauses ?? []) {
        for (const base of clause.types) {
          this.walkHeritage(base, target.module, depth + 1, seen, out, optionalOverride);
        }
      }
      this.collectMembers(target.decl.members, target.module, out, optionalOverride);
      return;
    }
    this.walk(target.decl.type, target.module, depth + 1, seen, out, optionalOverride);
  }

  private walkUtility(
    name: string,
    type: ts.TypeReferenceNode,
    module: ModuleContext,
    depth: number,
    seen: Set<string>,
    out: Resolution,
    optionalOverride: boolean | undefined,
  ): void {
    const inner: Resolution = { props: [], unresolved: [] };
    const override = name === "Partial" ? true : name === "Required" ? false : optionalOverride;
    this.walk(type.typeArguments![0], module, depth + 1, seen, inner, override);

    const keys = new Set(literalKeys(type.typeArguments?.[1]));
    const keep =
      name === "Omit"
        ? inner.props.filter((p) => !keys.has(p.name))
        : name === "Pick"
          ? inner.props.filter((p) => keys.has(p.name))
          : inner.props;

    out.props.push(...keep);
    out.unresolved.push(...inner.unresolved);
  }

  private collectMembers(
    members: readonly ts.TypeElement[],
    module: ModuleContext,
    out: Resolution,
    optionalOverride: boolean | undefined,
  ): void {
    for (const member of members) {
      if (!ts.isPropertySignature(member) || !ts.isIdentifier(member.name)) continue;
      out.props.push({
        name: member.name.text,
        prop: member,
        module,
        optional: optionalOverride ?? member.questionToken !== undefined,
      });
    }
  }
}

/**
 * Collapse duplicate prop names: the most-derived declaration (the last one reached, since
 * bases are walked before own members) wins, at the first occurrence's position (FR-008).
 * Unresolved entries are deduplicated verbatim, preserving first-seen order.
 */
function dedupe(resolution: Resolution): Resolution {
  const positions = new Map<string, number>();
  const props: ResolvedProp[] = [];
  for (const prop of resolution.props) {
    const at = positions.get(prop.name);
    if (at === undefined) {
      positions.set(prop.name, props.length);
      props.push(prop);
    } else {
      props[at] = prop;
    }
  }
  return { props, unresolved: [...new Set(resolution.unresolved)] };
}

// --- Member extraction ------------------------------------------------------------

/**
 * Map destructured prop defaults (`{ variant = 'primary' }`) → verbatim default text,
 * keyed by the public prop name so a renamed binding (`{ density: d = 'x' }`) still
 * attributes its default to `density` (FR-011).
 */
function destructuringDefaults(
  render: Component["render"],
  module: ModuleContext,
): Map<string, string> {
  const defaults = new Map<string, string>();
  const param = render?.parameters[0];
  if (param && ts.isObjectBindingPattern(param.name)) {
    for (const el of param.name.elements) {
      if (!el.initializer) continue;
      const key = el.propertyName ?? el.name;
      if (ts.isIdentifier(key)) defaults.set(key.text, el.initializer.getText(module.ast));
    }
  }
  return defaults;
}

/** Signatures declared on a resolved imperative-handle interface, by method name. */
function handleSignatures(
  handleType: ts.TypeNode | undefined,
  module: ModuleContext,
  index: PropsIndex,
): Map<string, { node: ts.MethodSignature; module: ModuleContext }> {
  const out = new Map<string, { node: ts.MethodSignature; module: ModuleContext }>();
  if (!handleType || !ts.isTypeReferenceNode(handleType)) return out;
  const target = index.lookup(typeRefName(handleType.typeName), module);
  if (!target || !ts.isInterfaceDeclaration(target.decl)) return out;
  for (const member of target.decl.members) {
    if (ts.isMethodSignature(member) && ts.isIdentifier(member.name)) {
      out.set(member.name.text, { node: member, module: target.module });
    }
  }
  return out;
}

/** A method draft from a `useImperativeHandle` object-literal member. */
function handleMethod(
  member: ts.ObjectLiteralElementLike,
  module: ModuleContext,
  ctx: SessionContext,
  signatures: ReturnType<typeof handleSignatures>,
): MethodDraft | undefined {
  const name = member.name && ts.isIdentifier(member.name) ? member.name.text : undefined;
  if (name === undefined) return undefined;

  const fn = ts.isMethodDeclaration(member)
    ? member
    : ts.isPropertyAssignment(member) &&
        (ts.isArrowFunction(member.initializer) || ts.isFunctionExpression(member.initializer))
      ? member.initializer
      : undefined;
  if (!fn) return undefined;

  // The handle interface is the better source of signatures — an arrow-function handle
  // rarely annotates its parameters — but the object literal decides which methods exist.
  const signature = signatures.get(name);
  const source = signature ? signature.node : fn;
  const sourceModule = signature ? signature.module : module;

  const parameters = source.parameters
    .filter((p) => ts.isIdentifier(p.name))
    .map((p) => ({
      name: (p.name as ts.Identifier).text,
      description: undefined,
      type: ctx.types.map(p.type, sourceModule),
    }));

  return {
    name,
    description:
      description(member, module) ?? (signature && description(signature.node, signature.module)),
    parameters: parameters.length ? parameters : undefined,
    return: ctx.types.map(source.type, sourceModule),
  };
}

/** Extract methods from `useImperativeHandle(ref, () => ({ … }))`, in source order. */
function imperativeMethods(
  render: Component["render"],
  module: ModuleContext,
  ctx: SessionContext,
  entry: EntryDraft,
  signatures: ReturnType<typeof handleSignatures>,
): void {
  if (!render) return;
  const visit = (n: ts.Node): void => {
    if (
      ts.isCallExpression(n) &&
      calleeName(n.expression) === "useImperativeHandle" &&
      n.arguments[1]
    ) {
      const factory = n.arguments[1];
      const body = ts.isArrowFunction(factory) ? factory.body : undefined;
      const obj =
        body && ts.isParenthesizedExpression(body) && ts.isObjectLiteralExpression(body.expression)
          ? body.expression
          : body && ts.isObjectLiteralExpression(body)
            ? body
            : undefined;
      if (obj) {
        for (const member of obj.properties) {
          const method = handleMethod(member, module, ctx, signatures);
          if (method) entry.addMethod(method);
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(render);
}

/** Public methods declared on a class component. */
function classMethods(
  node: ts.ClassDeclaration,
  module: ModuleContext,
  ctx: SessionContext,
  entry: EntryDraft,
): void {
  for (const member of node.members) {
    if (!ts.isMethodDeclaration(member) || !isPublicMember(member)) continue;
    const name = memberName(member);
    // React's own lifecycle is framework plumbing, not the component's public API.
    if (name === undefined || name === "render" || name.startsWith("component")) continue;
    entry.addMethod(methodDraft(member, name, module, ctx));
  }
}

function analyzeComponent(
  comp: Component,
  node: ts.Node,
  module: ModuleContext,
  ctx: SessionContext,
  index: PropsIndex,
): void {
  const mod = moduleFacet(comp.exported, ctx);
  if (!mod) return; // module + export identity is the only identity React has
  const entry = ctx.createEntry(module, {
    name: comp.name,
    paradigmClass: "vdom",
    identity: { module: mod, export: comp.defaultExport ? "default" : comp.name },
  });

  const desc = description(node, module);
  if (desc) entry.describe(desc);
  applyDocMetadata(entry, node, module, ctx);

  const resolution = index.resolve(comp.propsType, module);
  const defaults = destructuringDefaults(comp.render, module);
  let hasChildren = false;
  for (const prop of resolution.props) {
    if (prop.name === "children") hasChildren = true;
    entry.addInput({
      name: prop.name,
      description: description(prop.prop, prop.module),
      type: ctx.types.map(prop.prop.type, prop.module),
      default: defaults.get(prop.name),
      required: prop.optional ? undefined : true,
    });
  }

  if (comp.classDecl) classMethods(comp.classDecl, module, ctx, entry);
  else {
    imperativeMethods(
      comp.render,
      module,
      ctx,
      entry,
      handleSignatures(comp.handleType, module, index),
    );
  }

  const tags = cemTags(node, module, ctx.types);
  for (const event of tags.events) entry.addEvent(event);

  // A `children` prop is the content channel as well as a prop, so it yields the default
  // slot too — unless an authored `@slot` already declared one, which wins (R-20).
  const slots: SlotDraft[] = [...tags.slots];
  if (hasChildren && !slots.some((s) => s.name === undefined)) slots.unshift({});
  for (const slot of slots) entry.addSlot(slot);

  for (const prop of tags.cssProperties) entry.addCssProperty(prop);
  for (const part of tags.cssParts) entry.addCssPart(part);

  // Everything resolution could not follow, named verbatim rather than guessed (FR-010).
  if (resolution.unresolved.length) {
    entry.set("x-react", { unresolvedProps: resolution.unresolved });
  }
}

export function reactPlugin(): AnalyzerPlugin {
  const index = new PropsIndex();
  return {
    name: "react",
    collect(module) {
      index.add(module);
    },
    analyze(node, module, ctx) {
      const comp = componentOf(node);
      if (comp) analyzeComponent(comp, node, module, ctx, index);
    },
  };
}
