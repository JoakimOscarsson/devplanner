# Runtime Node Architecture

- `@pdp-helper/runtime-node` is the shared Node.js service scaffold for PDP Helper services.
- It owns HTTP routing helpers, JSON/body parsing, correlation metadata, common error responses, and proxy helpers.
- It must stay free of domain knowledge and may depend only on `contracts-core` plus low-level runtime libraries.
