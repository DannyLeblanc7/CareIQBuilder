(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Update Goal API ===');
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
        var requiredFields = ['goalId', 'label', 'tooltip', 'alternative_wording'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null) {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Update Goal: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('=== CALLING SCRIPT INCLUDE ===');
            gs.info('goalId: ' + requestData.goalId);
            gs.info('label: ' + requestData.label);
            gs.info('tooltip: ' + requestData.tooltip);
            gs.info('alternative_wording: ' + requestData.alternative_wording);
            gs.info('required: ' + requestData.required);
            gs.info('custom_attributes: ' + JSON.stringify(requestData.custom_attributes));
            gs.info('================================');
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_cadal_careiq_e_0.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call updateGoal method');
        }

        // Check if the method exists
        if (typeof careiqServices.updateGoal !== 'function') {
            gs.error('CareIQ Update Goal: updateGoal method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "updateGoal method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.updateGoal(
            requestData.goalId,
            requestData.label,
            requestData.tooltip || '',
            requestData.alternative_wording || '',
            requestData.required || false,
            requestData.custom_attributes || {}
        );

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Handle 204 No Content response (null/empty payload is expected and indicates success)
        if (responseBody === null || responseBody === undefined || responseBody === '') {
            if (isDebugEnabled) {
                gs.info('API returned 204 No Content - this is expected for successful PATCH operations');
                gs.info('=== UPDATE GOAL SUCCESS ===');
                gs.info('Goal ID: ' + requestData.goalId);
                gs.info('==========================');
            }

            response.setStatus(204);
            response.setHeader('Content-Type', 'application/json');
            // No body for 204 No Content
            return;
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Update Goal: Invalid JSON response from CareIQ Services');
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
            // Unexpected non-empty response for PATCH
            if (isDebugEnabled) {
                gs.info('=== UPDATE GOAL SUCCESS (WITH BODY) ===');
                gs.info('Goal ID: ' + requestData.goalId);
                gs.info('Response: ' + responseBody);
                gs.info('=====================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during goal update';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during goal update';
        }

        gs.error('CareIQ Update Goal Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);