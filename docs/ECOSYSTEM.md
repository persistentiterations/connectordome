# Open ecosystem

ConnectorDome is independently useful and has no required BonAcqui ecosystem dependency. Its versioned interfaces are open under Apache-2.0 so third parties can create adapters, validators, reasoning modules, and monitors without permission.

| Project | Relationship | Status here |
| --- | --- | --- |
| [Fractalish](https://fractalish.com) | Research lineage and possible receipt consumer | Context only; no runtime dependency |
| SymLan | Possible symbolic adapter | Planned concept; no public integration link or functioning adapter |
| [ExoMCP](https://github.com/BonAcqui-LLC/exomcp) | Possible MCP-facing adapter | Separate public project; no functioning integration |
| [Anti-Illogical](https://github.com/persistentiterations/anti-illogical) | Possible independent validator/reasoning extension | Separate public project; no functioning integration |

“Possible” means interface compatibility can be explored. It does not mean these systems are validated, bundled, mutually dependent, or required to use ConnectorDome.

## Third-party extension interface

Metadata uses [`schemas/extension.v0.1alpha1.schema.json`](../schemas/extension.v0.1alpha1.schema.json). Runtime objects additionally implement `handle(context)`. Supported kinds are `adapter`, `validator`, `reasoning`, and `monitor`. `registerExtensions()` rejects unknown versions/kinds and never grants execution authority.

Contributions should include a declared license, fixtures, deterministic tests, explicit provenance/evidence mode, and no secrets or phone-home behavior. See [`CONTRIBUTING.md`](../CONTRIBUTING.md).

SPDX-License-Identifier: Apache-2.0
