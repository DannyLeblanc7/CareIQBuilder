(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';
        
        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;
        
        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Update Section - Making Dynamic Call ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields
        var requiredFields = ['region', 'version', 'accessToken', 'app', 'sectionId', 'label'];
        var missingFields = [];
        
        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }
        
        if (missingFields.length > 0) {
            gs.error('CareIQ Update Section: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        // Build dynamic URL using app, region, version and sectionId from client
        var updateSectionUrl = 'https://' + requestData.app + '.' + requestData.region + '.careiq.cadalysapp.com/api/' + requestData.version + 
                              '/builder/section/' + encodeURIComponent(requestData.sectionId);

        if (isDebugEnabled) {
            gs.info('Making external request to: ' + updateSectionUrl);
        }

        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setEndpoint(updateSectionUrl);
        restMessage.setHttpMethod('PATCH');
        restMessage.setRequestHeader('Content-Type', 'application/json');
        restMessage.setRequestHeader('Authorization', 'Bearer ' + requestData.accessToken);
        
        // Build request body for the CareIQ API
        var requestBody = {
            label: requestData.label,
            tooltip: requestData.tooltip || '',
            alternative_wording: requestData.alternative_wording || '',
            required: requestData.required || false,
            custom_attributes: requestData.custom_attributes || {},
            sort_order: requestData.sort_order || 0
        };
        
        restMessage.setRequestBody(JSON.stringify(requestBody));

        if (isDebugEnabled) {
            gs.info('Request body: ' + JSON.stringify(requestBody));
        }

        var httpResponse = restMessage.execute();
        var responseBody = httpResponse.getBody();
        var statusCode = httpResponse.getStatusCode();

        if (isDebugEnabled) {
            gs.info('CareIQ API response status: ' + statusCode);
            gs.info('CareIQ API response body: ' + responseBody);
        }

        if (statusCode === 200 || statusCode === 204) {
            // Forward the actual CareIQ response
            response.setStatus(statusCode);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        } else {
            // Return error from CareIQ
            response.setStatus(statusCode);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred while updating section';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred while updating section';
        }
        
        gs.error('CareIQ Update Section Script Error: ' + errorMsg);
        
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);