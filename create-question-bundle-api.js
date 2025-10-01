(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Create Question Bundle API ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Raw request.body: ' + JSON.stringify(request.body));
        }

        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;

        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields
        if (!requestData.contentId) {
            gs.error('CareIQ Create Question Bundle: Missing required field: contentId');
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required field: contentId"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Calling CareIQServices.createQuestionBundle with contentId: ' + requestData.contentId);
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_1628056_careiq.CareIQServices();

        // Check if the method exists
        if (typeof careiqServices.createQuestionBundle !== 'function') {
            gs.error('CareIQ Create Question Bundle: createQuestionBundle method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "createQuestionBundle method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.createQuestionBundle(requestData.contentId);

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Create Question Bundle: Invalid JSON response from CareIQ Services');
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
            // Successful response
            if (isDebugEnabled) {
                gs.info('=== CREATE QUESTION BUNDLE SUCCESS ===');
                gs.info('Content ID: ' + requestData.contentId);
                gs.info('Response: ' + responseBody);
                gs.info('=====================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during question bundle creation';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during question bundle creation';
        }

        gs.error('CareIQ Create Question Bundle Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);
