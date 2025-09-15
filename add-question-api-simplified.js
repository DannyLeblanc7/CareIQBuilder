(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';
        
        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;
        
        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Add Question (Simplified) - Using Script Include ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields 
        var requiredFields = ['label', 'type', 'guideline_template_id', 'section_id', 'sort_order'];
        var missingFields = [];
        
        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }
        
        if (missingFields.length > 0) {
            gs.error('CareIQ Add Question: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Calling CareIQServices.builderAddQuestion with data: ' + JSON.stringify(requestData));
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_1628056_careiq.CareIQServices();
        
        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call builderAddQuestion method');
        }
        
        var responseBody = careiqServices.builderAddQuestion(requestData);
        
        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Parse response to check for errors
        if (!responseBody || responseBody.trim() === '') {
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Empty response from CareIQ Services"}');
            return;
        }
        
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
            // Log the question UUID for debugging
            if (isDebugEnabled && parsedResponse && parsedResponse.id) {
                gs.info('=== QUESTION CREATED SUCCESSFULLY ===');
                gs.info('New Question UUID: ' + parsedResponse.id);
                gs.info('=====================================');
            }
            
            // Return success response
            response.setStatus(201);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred while adding question';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred while adding question';
        }
        
        gs.error('CareIQ Add Question Script Error: ' + errorMsg);
        
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);