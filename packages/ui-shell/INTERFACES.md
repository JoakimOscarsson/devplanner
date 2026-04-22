# UI Shell Package Interfaces

## Public Exports
- `ModuleKey`
- `ModuleCapability`
- `ShellNavigationItem`
- `ServiceHealthSnapshot`
- `CapabilityDiscoveryPort`
- `ShellModuleRegistry`

## Integration Rules
- Consumers hydrate module availability through `CapabilityDiscoveryPort`.
- Capabilities should be descriptive enough to hide or disable optional UI surfaces when services are unavailable.
- This package must not encode graph/planner/recommendation business logic beyond availability metadata.
