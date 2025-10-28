(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';

        if (isDebugEnabled) {
            gs.info('=== CareIQ Library Answer Details API ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Request body: ' + JSON.stringify(request.body));
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
        if (!requestData || !requestData.answerId) {
            gs.error('CareIQ Library Answer Details: Missing required field: answerId');
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required field: answerId"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Answer ID: ' + requestData.answerId);
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_cadal_careiq_e_0.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call builderLibraryAnswerDetails method');
        }

        // Check if the method exists
        if (typeof careiqServices.builderLibraryAnswerDetails !== 'function') {
            gs.error('CareIQ Library Answer Details: builderLibraryAnswerDetails method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "builderLibraryAnswerDetails method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.builderLibraryAnswerDetails(requestData.answerId);

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Library Answer Details: Invalid JSON response from CareIQ Services');
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
                gs.info('=== LIBRARY ANSWER DETAILS SUCCESS ===');
                gs.info('Answer ID: ' + requestData.answerId);
                gs.info('Answer Label: ' + (parsedResponse.label || 'N/A'));
                gs.info('Response: ' + responseBody);
                gs.info('========================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during library answer details fetch';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during library answer details fetch';
        }

        gs.error('CareIQ Library Answer Details Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);