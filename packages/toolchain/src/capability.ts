import { readToolchainPackageJson } from "./paths.js";
import {
  GLOBAL_OPTIONS,
  REGISTRY,
  type ArgumentSpec,
  type CommandSpec,
  type GlobalOptionSpec,
  type OptionSpec,
} from "./registry.js";
import { ERROR_CODES, type ResponseType } from "./envelope.js";

/**
 * The capability manifest: the CLI's structured self-description, projected
 * purely from the command registry (spec 004 FR-008, contracts/capability-manifest.md).
 * Because the same registry drives argv parsing and dispatch, an undescribed
 * command or option is structurally impossible.
 */

export interface CapabilityCommand {
  name: string;
  description: string;
  arguments: ArgumentSpec[];
  options: OptionSpec[];
  json: boolean;
  responseTypes: ResponseType[];
  examples: string[];
}

export interface CapabilityManifest {
  /** Capability-manifest shape version; additive bumps only. */
  apiVersion: 1;
  name: string;
  version: string;
  description: string;
  globalOptions: GlobalOptionSpec[];
  commands: CapabilityCommand[];
  jsonSupported: string[];
  responseTypes: Record<string, ResponseType[]>;
  errorCodes: Array<{ code: string; description: string }>;
}

/**
 * The residual hand-declared facts the derivation cannot guarantee, checked by
 * the capability drift gate: descriptions, examples, and response types must
 * be present for every registry entry (and for every option).
 */
export function checkRegistryCompleteness(registry: CommandSpec[]): string[] {
  const problems: string[] = [];
  for (const command of registry) {
    if (command.description.trim() === "") problems.push(`${command.name}: empty description`);
    if (command.examples.length === 0) problems.push(`${command.name}: no examples`);
    if (command.jsonSupported && command.responseTypes.length === 0)
      problems.push(`${command.name}: jsonSupported but no responseTypes`);
    if (!command.jsonSupported && command.responseTypes.length > 0)
      problems.push(`${command.name}: responseTypes declared without jsonSupported`);
    for (const argument of command.arguments)
      if (argument.description.trim() === "")
        problems.push(`${command.name} <${argument.name}>: empty description`);
    for (const option of command.options)
      if (option.description.trim() === "")
        problems.push(`${command.name} ${option.flag}: empty description`);
  }
  return problems;
}

function projectCommand(spec: CommandSpec): CapabilityCommand {
  return {
    name: spec.name,
    description: spec.description,
    arguments: spec.arguments,
    options: spec.options,
    json: spec.jsonSupported,
    responseTypes: spec.responseTypes,
    examples: spec.examples,
  };
}

export function buildCapabilityManifest(): CapabilityManifest {
  const packageJson = readToolchainPackageJson();
  const jsonSupported = REGISTRY.filter((c) => c.jsonSupported).map((c) => c.name);
  return {
    apiVersion: 1,
    name: "acm",
    version: packageJson.version ?? "0.0.0",
    description: packageJson.description ?? "",
    globalOptions: GLOBAL_OPTIONS,
    commands: REGISTRY.map(projectCommand),
    jsonSupported,
    responseTypes: Object.fromEntries(
      REGISTRY.filter((c) => c.jsonSupported).map((c) => [c.name, c.responseTypes]),
    ),
    errorCodes: Object.entries(ERROR_CODES).map(([code, { description }]) => ({
      code,
      description,
    })),
  };
}
