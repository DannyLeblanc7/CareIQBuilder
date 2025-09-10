(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';
        
        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;
        
        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Guideline Templates - Making Dynamic Call ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields
        var requiredFields = ['region', 'version', 'accessToken', 'app', 'useCase', 'offset', 'limit', 'contentSource'];
        var missingFields = [];
        
        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }
        
        if (missingFields.length > 0) {
            gs.error('CareIQ Guideline Templates: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        // Build dynamic URL using app, region and version from client
        var templatesUrl = 'https://' + requestData.app + '.' + requestData.region + '.careiq.cadalysapp.com/api/' + requestData.version + 
                          '/builder/guideline-template?use_case=' + encodeURIComponent(requestData.useCase) + 
                          '&offset=' + encodeURIComponent(requestData.offset) + 
                          '&limit=' + encodeURIComponent(requestData.limit) + 
                          '&content_source=' + encodeURIComponent(requestData.contentSource);
        
        // Add optional parameters if provided
        if (requestData.latestVersionOnly) {
            templatesUrl += '&latest_version_only=' + encodeURIComponent(requestData.latestVersionOnly);
        }
        
        if (requestData.searchValue) {
            templatesUrl += '&search_value=' + encodeURIComponent(requestData.searchValue);
        }

        if (isDebugEnabled) {
            gs.info('Making external request to: ' + templatesUrl);
        }

        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setEndpoint(templatesUrl);
        restMessage.setHttpMethod('GET');
        restMessage.setRequestHeader('Content-Type', 'application/json');
        restMessage.setRequestHeader('Authorization', 'Bearer ' + requestData.accessToken);

        var httpResponse = restMessage.execute();
        var responseBody = httpResponse.getBody();
        var statusCode = httpResponse.getStatusCode();

        if (isDebugEnabled) {
            gs.info('CareIQ API response status: ' + statusCode);
            gs.info('CareIQ API response body: ' + responseBody);
        }

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
        // Safe error handling - avoid accessing potentially restricted properties
        var errorMsg = 'Unexpected server error occurred';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            // If even toString fails, use generic message
            errorMsg = 'Server error occurred';
        }
        
        gs.error('CareIQ Guideline Templates Error: ' + errorMsg);
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);