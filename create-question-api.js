(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';
        
        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;
        
        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Create Question - Making Dynamic Call ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields
        var requiredFields = ['region', 'version', 'accessToken', 'app', 'label', 'type', 'guideline_template_id', 'section_id', 'sort_order'];
        var missingFields = [];
        
        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }
        
        if (missingFields.length > 0) {
            gs.error('CareIQ Create Question: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        // Build dynamic URL for create question endpoint
        var createQuestionUrl = 'https://' + requestData.app + '.' + requestData.region + '.careiq.cadalysapp.com/api/' + requestData.version + '/builder/question';

        if (isDebugEnabled) {
            gs.info('Making external request to: ' + createQuestionUrl);
        }

        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setEndpoint(createQuestionUrl);
        restMessage.setHttpMethod('POST');
        restMessage.setRequestHeader('Content-Type', 'application/json');
        restMessage.setRequestHeader('Authorization', 'Bearer ' + requestData.accessToken);
        
        // Build request body for question creation
        var requestBody = {
            label: requestData.label,
            type: requestData.type,
            tooltip: requestData.tooltip || '',
            alternative_wording: requestData.alternative_wording || '',
            answers: requestData.answers || [],
            guideline_template_id: requestData.guideline_template_id,
            section_id: requestData.section_id,
            sort_order: requestData.sort_order,
            custom_attributes: requestData.custom_attributes || {},
            voice: requestData.voice || 'CaseManager',
            required: requestData.required || false,
            available: requestData.available || false
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
        
        gs.error('CareIQ Create Question Error: ' + errorMsg);
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);