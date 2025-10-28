(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Add Problem Relationship API ===');
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
        var requiredFields = ['answerId', 'problemName', 'guidelineTemplateId'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Add Problem Relationship: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('=== CALLING SCRIPT INCLUDE ===');
            gs.info('answerId: ' + requestData.answerId);
            gs.info('problemName: ' + requestData.problemName);
            gs.info('problemId: ' + requestData.problemId);
            gs.info('sortOrder: ' + requestData.sortOrder);
            gs.info('guidelineTemplateId: ' + requestData.guidelineTemplateId);
            gs.info('================================');
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_cadal_careiq_e_0.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call addProblemRelationship method');
        }

        // Check if the method exists
        if (typeof careiqServices.addProblemRelationship !== 'function') {
            gs.error('CareIQ Add Problem Relationship: addProblemRelationship method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "addProblemRelationship method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.addProblemRelationship(
            requestData.answerId,
            requestData.problemName,
            requestData.problemId || null,  // Explicitly pass null for new problems
            requestData.sortOrder,
            requestData.guidelineTemplateId
        );

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Add Problem Relationship: Invalid JSON response from CareIQ Services');
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
                    answerId: requestData.answerId,
                    problemName: requestData.problemName,
                    problemId: requestData.problemId,
                    sortOrder: requestData.sortOrder
                }
            };

            if (isDebugEnabled) {
                gs.info('=== ADD PROBLEM RELATIONSHIP SUCCESS ===');
                gs.info('Answer ID: ' + requestData.answerId);
                gs.info('Problem Name: ' + requestData.problemName);
                gs.info('Enhanced response: ' + JSON.stringify(enhancedResponse));
                gs.info('=========================================');
            }

            response.setStatus(201);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(JSON.stringify(enhancedResponse));
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during problem relationship addition';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during problem relationship addition';
        }

        gs.error('CareIQ Add Problem Relationship Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);