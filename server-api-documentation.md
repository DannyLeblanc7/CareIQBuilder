# ServiceNow Server-Side APIs Required

This document describes the ServiceNow Scripted REST APIs that need to be created to support the CareIQ Builder component.

## API Endpoint: Use Case Categories

**Path:** `/api/x_cadal_careiq_b_0/careiq_api/use-case-categories`
**Method:** GET
**Query Parameters:** 
- `use_case` (string) - The use case type (e.g., "CM")

### Implementation Details

This endpoint should be created as a ServiceNow Scripted REST API resource that:

1. Retrieves CareIQ configuration from system properties:
   - `x_1628056_careiq.careiq.platform.region`
   - `x_1628056_careiq.careiq.platform.version`
   - `x_1628056_careiq.careiq.platform.apikey`
   - `x_1628056_careiq.careiq.platform.otoken`
   - `x_1628056_careiq.careiq.platform.id`

2. Exchanges credentials for access token (similar to existing token-exchange endpoint)

3. Makes server-side HTTP request to CareIQ platform:
   - **URL:** `https://app.{region}.careiq.cadalysapp.com/api/{version}/builder/use-case-category`
   - **Method:** GET
   - **Headers:** 
     - `Authorization: Bearer {access_token}`
     - `Content-Type: application/json`
   - **Query Parameters:** `use_case={use_case}`

4. Returns the response from CareIQ platform

### Expected Response Format

```json
{
    "use_case_categories": [
        {
            "id": "fe201aa1-21d1-44bf-ae92-f8c59b349024",
            "name": "Chronic Care",
            "use_case": "CM",
            "product_id": "6da5eefb-835b-43c5-838b-99a176fc6a93"
        },
        {
            "id": "3a0a7deb-dba3-44e3-bd85-0a891d1a7920",
            "name": "Transitions of Care",
            "use_case": "CM",
            "product_id": "1a7da75d-3177-42da-93ec-e4b8330001ff"
        },
        {
            "id": "82e1e70b-e0e5-4139-8bdc-9b451a86d06f",
            "name": "Disease Management",
            "use_case": "CM",
            "product_id": null
        }
    ]
}
```

### Error Handling

The API should handle errors gracefully and return appropriate HTTP status codes:
- 400 for missing/invalid parameters
- 401 for authentication failures
- 500 for server errors
- Forward any CareIQ platform error messages to the client

## Notes

- This endpoint mirrors the existing `/api/x_cadal_careiq_b_0/careiq_api/token-exchange` pattern
- All CareIQ platform communication should happen server-side for security
- The client-side component will call this ServiceNow API instead of directly calling CareIQ