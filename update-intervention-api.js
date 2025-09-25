(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Update Intervention API ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Raw request.body: ' + JSON.stringify(request.body));
            gs.info('request.body type: ' + typeof request.body);
            if (request.body) {
                gs.info('request.body keys: ' + Object.keys(request.body).join(', '));
            }
        }

        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;

        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('Received requestData: ' + JSON.stringify(requestData));
            gs.info('requestData type: ' + typeof requestData);
            if (requestData) {
                gs.info('requestData keys: ' + Object.keys(requestData).join(', '));
            }
        }

        // Validate required fields
        var requiredFields = ['interventionId', 'label', 'goal_id'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Update Intervention: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('=== CALLING SCRIPT INCLUDE ===');
            gs.info('interventionId: ' + requestData.interventionId);
            gs.info('label: ' + requestData.label);
            gs.info('tooltip: ' + requestData.tooltip);
            gs.info('alternative_wording: ' + requestData.alternative_wording);
            gs.info('category: ' + requestData.category);
            gs.info('goal_id: ' + requestData.goal_id);
            gs.info('================================');
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_1628056_careiq.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call updateIntervention method');
        }

        // Check if the method exists
        if (typeof careiqServices.updateIntervention !== 'function') {
            gs.error('CareIQ Update Intervention: updateIntervention method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "updateIntervention method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.updateIntervention(
            requestData.interventionId,
            requestData.label,
            requestData.tooltip || '',
            requestData.alternative_wording || '',
            requestData.category || 'assist',
            requestData.goal_id,
            requestData.required || false,
            requestData.custom_attributes || {}
        );

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
            gs.info('Response length: ' + (responseBody ? responseBody.length : 'null'));
            if (responseBody) {
                gs.info('First 500 chars of response: ' + responseBody.substring(0, 500));
            }
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Update Intervention: Invalid JSON response from CareIQ Services');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Invalid JSON response from CareIQ Services"}');
            return;
        }

        if (parsedResponse && parsedResponse.error) {
            // Return error from CareIQ Services
            if (isDebugEnabled) {
                gs.info('Error response from CareIQ Services: ' + responseBody);
            }
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        } else {
            // Successful response - enhance with original request data
            var enhancedResponse = {
                ...parsedResponse,
                // Include original request data for client use
                originalRequest: {
                    interventionId: requestData.interventionId,
                    label: requestData.label,
                    goal_id: requestData.goal_id
                }
            };

            if (isDebugEnabled) {
                gs.info('=== UPDATE INTERVENTION SUCCESS ===');
                gs.info('Intervention ID: ' + requestData.interventionId);
                gs.info('Label: ' + requestData.label);
                gs.info('Goal ID: ' + requestData.goal_id);
                gs.info('Response: ' + JSON.stringify(enhancedResponse));
                gs.info('===================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(JSON.stringify(enhancedResponse));
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during intervention update';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during intervention update';
        }

        gs.error('CareIQ Update Intervention Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);