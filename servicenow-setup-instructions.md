# ServiceNow Scripted REST API Setup Instructions

## Create the Scripted REST API

### Step 1: Create the REST API Service
1. Navigate to **System Web Services > Scripted Web Services > Scripted REST APIs**
2. Click **New**
3. Fill in the following details:
   - **Name**: `CareIQ API`
   - **API ID**: `careiq_api`
   - **API Namespace**: `x_cadal_careiq_b_0`
   - **Active**: `true`
   - **Requires authentication**: `true`
   - **Requires ACL authorization**: `true`

### Step 2: Create the REST Resource
1. In the **Resources** tab of the created API, click **New**
2. Fill in the following details:
   - **Name**: `Use Case Categories`
   - **HTTP method**: `GET`
   - **Relative path**: `/use-case-categories`
   - **Script**: Copy and paste the code from `servicenow-scripted-rest-api.js`

### Step 3: Verify the Endpoint
The complete endpoint URL will be:
```
https://your-instance.service-now.com/api/x_cadal_careiq_b_0/careiq_api/use-case-categories
```

## Required System Properties

Ensure these system properties are configured (should already exist from the token exchange setup):

- `x_1628056_careiq.careiq.platform.apikey`
- `x_1628056_careiq.careiq.platform.app`
- `x_1628056_careiq.careiq.platform.id`
- `x_1628056_careiq.careiq.platform.otoken`
- `x_1628056_careiq.careiq.platform.region`
- `x_1628056_careiq.careiq.platform.version`

## Testing the API

### Using REST API Explorer
1. Navigate to **System Web Services > REST API Explorer**
2. Select **x_cadal_careiq_b_0 - CareIQ API**
3. Select **GET /use-case-categories**
4. Add query parameter: `use_case=CM`
5. Click **Send**

### Using Postman or curl
```bash
curl -X GET \
  'https://your-instance.service-now.com/api/x_cadal_careiq_b_0/careiq_api/use-case-categories?use_case=CM' \
  -H 'Authorization: Basic <your-auth-header>' \
  -H 'Content-Type: application/json'
```

## Expected Response
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
        }
    ]
}
```

## Security Notes
- The API requires authentication (ServiceNow user credentials)
- All CareIQ credentials remain server-side and secure
- Comprehensive logging is included for debugging
- Error handling prevents sensitive information leakage

## Troubleshooting
- Check **System Logs > All** for entries with source `CareIQ_UseCaseCategories`
- Verify system properties are correctly configured
- Test the existing token-exchange endpoint first to ensure CareIQ connectivity