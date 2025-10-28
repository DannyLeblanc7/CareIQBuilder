(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';
        
        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;
        
        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Update Question (Simplified) - Using Script Include ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields 
        var requiredFields = ['questionId', 'label', 'type'];
        var missingFields = [];
        
        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }
        
        if (missingFields.length > 0) {
            gs.error('CareIQ Update Question: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Calling CareIQServices.builderUpdateQuestion with questionId: ' + requestData.questionId);
            gs.info('Question data: ' + JSON.stringify({
                label: requestData.label,
                tooltip: requestData.tooltip,
                type: requestData.type,
                required: requestData.required,
                voice: requestData.voice
            }));
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_cadal_careiq_e_0.CareIQServices();
        
        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call builderUpdateQuestion method');
        }
        
        var responseBody = careiqServices.builderUpdateQuestion(requestData.questionId, {
            label: requestData.label,
            tooltip: requestData.tooltip || '',
            alternative_wording: requestData.alternative_wording || 'string',
            required: requestData.required || false,
            custom_attributes: requestData.custom_attributes || {},
            sort_order: requestData.sort_order || 0,
            voice: requestData.voice || 'Patient',
            type: requestData.type
        });
        
        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Parse response to check for errors (even though PATCH returns 204 No Content)
        if (!responseBody || responseBody.trim() === '') {
            // Empty response is expected for successful PATCH (204 No Content)
            if (isDebugEnabled) {
                gs.info('=== QUESTION UPDATED SUCCESSFULLY ===');
                gs.info('Updated Question ID: ' + requestData.questionId);
                gs.info('=====================================');
            }
            
            // Return 204 No Content for successful update
            response.setStatus(204);
            return;
        }
        
        // If there's a response body, check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Invalid JSON response from CareIQ Services"}');
            return;
        }
        
        if (parsedResponse && parsedResponse.error) {
            // Return error from CareIQ Services
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        } else {
            // Successful update
            if (isDebugEnabled) {
                gs.info('=== QUESTION UPDATED SUCCESSFULLY ===');
                gs.info('Updated Question ID: ' + requestData.questionId);
                gs.info('=====================================');
            }
            
            response.setStatus(204);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred while updating question';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred while updating question';
        }
        
        gs.error('CareIQ Update Question Script Error: ' + errorMsg);
        
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);