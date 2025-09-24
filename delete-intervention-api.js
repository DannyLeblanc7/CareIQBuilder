(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Delete Intervention API ===');
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
        var requiredFields = ['interventionId', 'goalId'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Delete Intervention: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('=== CALLING SCRIPT INCLUDE ===');
            gs.info('interventionId: ' + requestData.interventionId);
            gs.info('goalId: ' + requestData.goalId);
            gs.info('===================================');
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_1628056_careiq.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call deleteIntervention method');
        }

        // Check if the method exists
        if (typeof careiqServices.deleteIntervention !== 'function') {
            gs.error('CareIQ Delete Intervention: deleteIntervention method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "deleteIntervention method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.deleteIntervention(requestData.goalId, requestData.interventionId);

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Delete Intervention: Invalid JSON response from CareIQ Services');
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
            // Successful response (204 No Content expected for DELETE)
            if (isDebugEnabled) {
                gs.info('=== DELETE INTERVENTION SUCCESS ===');
                gs.info('Intervention ID: ' + requestData.interventionId);
                gs.info('Goal ID: ' + requestData.goalId);
                gs.info('Response: ' + responseBody);
                gs.info('=====================================');
            }

            response.setStatus(204); // No Content for successful DELETE
            response.setHeader('Content-Type', 'application/json');
            // No body for 204 No Content
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during intervention deletion';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during intervention deletion';
        }

        gs.error('CareIQ Delete Intervention Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);