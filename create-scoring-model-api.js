(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Create Scoring Model API ===');
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
        var requiredFields = ['guideline_template_id', 'label', 'scoring_type'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Create Scoring Model: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('=== CALLING SCRIPT INCLUDE ===');
            gs.info('guideline_template_id: ' + requestData.guideline_template_id);
            gs.info('label: ' + requestData.label);
            gs.info('scoring_type: ' + requestData.scoring_type);
            gs.info('================================');
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_cadal_careiq_e_0.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call createScoringModel method');
        }

        // Check if the method exists
        if (typeof careiqServices.createScoringModel !== 'function') {
            gs.error('CareIQ Create Scoring Model: createScoringModel method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "createScoringModel method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.createScoringModel(
            requestData.guideline_template_id,
            requestData.label,
            requestData.scoring_type
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
            gs.error('CareIQ Create Scoring Model: Invalid JSON response from CareIQ Services');
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
                    guideline_template_id: requestData.guideline_template_id,
                    label: requestData.label,
                    scoring_type: requestData.scoring_type
                }
            };

            if (isDebugEnabled) {
                gs.info('=== CREATE SCORING MODEL SUCCESS ===');
                gs.info('Guideline Template ID: ' + requestData.guideline_template_id);
                gs.info('Label: ' + requestData.label);
                gs.info('Scoring Type: ' + requestData.scoring_type);
                gs.info('New Scoring Model ID: ' + (parsedResponse.id || 'N/A'));
                gs.info('Response: ' + JSON.stringify(enhancedResponse));
                gs.info('=====================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(JSON.stringify(enhancedResponse));
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during scoring model creation';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during scoring model creation';
        }

        gs.error('CareIQ Create Scoring Model Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);