(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Delete Guideline Relationship API ===');
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
        var requiredFields = ['answerId', 'guidelineId'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Delete Guideline Relationship: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Calling CareIQServices.deleteGuidelineRelationship with answerId: ' + requestData.answerId + ', guidelineId: ' + requestData.guidelineId);
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_1628056_careiq.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call deleteGuidelineRelationship method');
        }

        // Check if the method exists
        if (typeof careiqServices.deleteGuidelineRelationship !== 'function') {
            gs.error('CareIQ Delete Guideline Relationship: deleteGuidelineRelationship method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "deleteGuidelineRelationship method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.deleteGuidelineRelationship(requestData.answerId, requestData.guidelineId);

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Parse response to check for errors - handle null/empty responses from DELETE endpoints
        var parsedResponse;
        if (responseBody === null || responseBody === undefined || responseBody === '') {
            // DELETE endpoints return empty body - this is normal, not an error
            parsedResponse = null;
        } else {
            try {
                parsedResponse = JSON.parse(responseBody);
            } catch (parseError) {
                gs.error('CareIQ Delete Guideline Relationship: Invalid JSON response from CareIQ Services');
                response.setStatus(500);
                response.setHeader('Content-Type', 'application/json');
                response.getStreamWriter().writeString('{"error": "Invalid JSON response from CareIQ Services"}');
                return;
            }
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
            // Successful response - handle null/empty responses from DELETE endpoints
            var enhancedResponse;

            if (responseBody === null || responseBody === undefined || responseBody === '') {
                // DELETE endpoints often return empty bodies - create success response
                enhancedResponse = {
                    success: true,
                    message: 'Guideline relationship deleted successfully',
                    originalRequest: {
                        answerId: requestData.answerId,
                        guidelineId: requestData.guidelineId,
                        guidelineName: requestData.guidelineName
                    }
                };
            } else {
                // Try to parse existing response and enhance it
                try {
                    var originalResponse = JSON.parse(responseBody);
                    enhancedResponse = {
                        ...originalResponse,
                        // Include original request data for client use
                        originalRequest: {
                            answerId: requestData.answerId,
                            guidelineId: requestData.guidelineId,
                            guidelineName: requestData.guidelineName
                        }
                    };
                } catch (enhanceError) {
                    // If parsing fails, create success response with original data
                    enhancedResponse = {
                        success: true,
                        message: 'Guideline relationship deleted successfully',
                        originalRequest: {
                            answerId: requestData.answerId,
                            guidelineId: requestData.guidelineId,
                            guidelineName: requestData.guidelineName
                        }
                    };
                }
            }

            if (isDebugEnabled) {
                gs.info('=== DELETE GUIDELINE RELATIONSHIP SUCCESS ===');
                gs.info('Answer ID: ' + requestData.answerId);
                gs.info('Guideline ID: ' + requestData.guidelineId);
                gs.info('Enhanced response: ' + JSON.stringify(enhancedResponse));
                gs.info('==========================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(JSON.stringify(enhancedResponse));
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during guideline relationship deletion';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during guideline relationship deletion';
        }

        gs.error('CareIQ Delete Guideline Relationship Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);