# Recommendation Service Interfaces

## HTTP routes
- `GET /health`
- `GET /v1/providers/health`
- `GET /v1/recommendations`
- `POST /v1/recommendations/runs`
- `POST /v1/recommendations/:recommendationId/accept`
- `POST /v1/recommendations/:recommendationId/deny`

## Shared conventions
- Uses id prefixes from `@pdp-helper/contracts-core.ID_PREFIXES`
- Uses recommendation event subjects from `@pdp-helper/contracts-recommendation.RECOMMENDATION_EVENT_SUBJECTS`
- Recommendation decisions are recorded first and applied downstream asynchronously
