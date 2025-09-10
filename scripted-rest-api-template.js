/**
 * CareIQ Scripted REST API Template
 * 
 * Standard pattern for all CareIQ server-side APIs
 * - Conditional debug logging using globalDebug system property
 * - Consistent error handling and validation
 * - Proper request data handling to avoid consumption issues
 */

(function process(request, response) {
    try {
        // ALWAYS: Check if debug logging is enabled first
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';
        
        // ALWAYS: Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;
        
        // CONDITIONAL: Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ [API_NAME] - Making Dynamic Call ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // ALWAYS: Validate required fields (customize per endpoint)
        var requiredFields = ['region', 'version', 'app', /* add endpoint-specific fields */];
        var missingFields = [];
        
        for (var i = 0; i < requiredFields.length; i++) {
            if (!requestData || !requestData[requiredFields[i]]) {
                missingFields.push(requiredFields[i]);
            }
        }
        
        if (missingFields.length > 0) {
            gs.error('CareIQ [API_NAME]: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        // ALWAYS: Build dynamic URL using app, region, version from client
        var apiUrl = 'https://' + requestData.app + '.' + requestData.region + '.careiq.cadalysapp.com/api/' + requestData.version + '/[ENDPOINT_PATH]';

        if (isDebugEnabled) {
            gs.info('Making external request to: ' + apiUrl);
        }

        // ALWAYS: Create REST request
        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setEndpoint(apiUrl);
        restMessage.setHttpMethod('[GET|POST|PUT|DELETE]');
        restMessage.setRequestHeader('Content-Type', 'application/json');
        
        // CONDITIONAL: Add headers based on endpoint needs
        // For authenticated endpoints:
        // restMessage.setRequestHeader('Authorization', 'Bearer ' + requestData.accessToken);
        
        // For token exchange:
        // restMessage.setRequestHeader('x-api-key', requestData.apikey);
        // restMessage.setRequestHeader('o-token', requestData.otoken);
        // restMessage.setRequestHeader('x-client-id', requestData.client_id);
        
        // CONDITIONAL: Set request body if needed
        // restMessage.setRequestBody(JSON.stringify(requestData.payload) || '{}');

        // ALWAYS: Execute request
        var httpResponse = restMessage.execute();
        var responseBody = httpResponse.getBody();
        var statusCode = httpResponse.getStatusCode();

        // CONDITIONAL: Log response for debugging
        if (isDebugEnabled) {
            gs.info('CareIQ API response status: ' + statusCode);
            gs.info('CareIQ API response body: ' + responseBody);
        }

        // ALWAYS: Forward response status and body
        if (statusCode === 200) {
            // Forward the actual CareIQ response
            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        } else {
            // Return error from CareIQ
            response.setStatus(statusCode);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // ALWAYS: Log errors (not conditional - errors should always be logged)
        gs.error('CareIQ [API_NAME] Error: ' + e.message + ' - Stack: ' + e.stack);
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + e.message + '"}');
    }
})(request, response);

/**
 * IMPLEMENTATION CHECKLIST:
 * 
 * 1. Replace [API_NAME] with actual API name
 * 2. Replace [ENDPOINT_PATH] with actual CareIQ endpoint path
 * 3. Replace [GET|POST|PUT|DELETE] with appropriate HTTP method
 * 4. Update requiredFields array with endpoint-specific required fields
 * 5. Add appropriate headers (auth, api keys, etc.)
 * 6. Set request body if needed for POST/PUT operations
 * 7. Add any endpoint-specific query parameters
 * 8. Test with globalDebug both true and false
 * 
 * STANDARD REQUIRED FIELDS:
 * - Token Exchange: ['region', 'version', 'apikey', 'otoken', 'client_id', 'app']
 * - Authenticated APIs: ['region', 'version', 'accessToken', 'app', ...endpoint-specific]
 */