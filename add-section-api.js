(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';
        
        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;
        
        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Add Section - Making Dynamic Call ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields
        var requiredFields = ['region', 'version', 'accessToken', 'app', 'sort_order', 'gt_id', 'label', 'parent_section_id'];
        var missingFields = [];
        
        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }
        
        if (missingFields.length > 0) {
            gs.error('CareIQ Add Section: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        // Build dynamic URL using app, region, version from client
        var addSectionUrl = 'https://' + requestData.app + '.' + requestData.region + '.careiq.cadalysapp.com/api/' + requestData.version + 
                           '/builder/section';

        if (isDebugEnabled) {
            gs.info('Making external request to: ' + addSectionUrl);
        }

        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setEndpoint(addSectionUrl);
        restMessage.setHttpMethod('POST');
        restMessage.setRequestHeader('Content-Type', 'application/json');
        restMessage.setRequestHeader('Authorization', 'Bearer ' + requestData.accessToken);
        
        // Build request body for the CareIQ API
        var requestBody = {
            sort_order: requestData.sort_order,
            gt_id: requestData.gt_id,
            label: requestData.label,
            parent_section_id: requestData.parent_section_id,
            library_id: requestData.library_id || null
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

        if (statusCode === 200 || statusCode === 201) {
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
        var errorMsg = 'Unexpected server error occurred while adding section';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred while adding section';
        }
        
        gs.error('CareIQ Add Section Script Error: ' + errorMsg);
        
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);