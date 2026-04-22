import type {
  CapabilityName,
  ModuleCapability,
  ServiceHealthSnapshot
} from "@pdp-helper/contracts-core";

export type { ModuleCapability } from "@pdp-helper/contracts-core";

export type ModuleKey = CapabilityName;

export interface ShellNavigationItem {
  readonly key: ModuleKey;
  readonly label: string;
  readonly href: string;
  readonly enabled: boolean;
}

export interface CapabilityDiscoveryPort {
  listCapabilities(): Promise<readonly ModuleCapability[]>;
  listServiceHealth(): Promise<readonly ServiceHealthSnapshot[]>;
}

export function buildNavigation(
  modules: readonly ModuleCapability[]
): ShellNavigationItem[] {
  return modules.map((module) => ({
    key: module.key,
    label: module.title,
    href: module.route,
    enabled: module.enabled
  }));
}

export function summarizeUnavailableModules(
  modules: readonly ModuleCapability[]
): string[] {
  return modules
    .filter((module) => !module.enabled)
    .map((module) =>
      module.optional
        ? `${module.title} is currently unavailable.`
        : `${module.title} is blocked because ${module.service} is unavailable.`
    );
}
