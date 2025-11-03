(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';

        if (isDebugEnabled) {
            gs.info('=== CareIQ Get Assessments API ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Raw request.body: ' + JSON.stringify(request.body));
        }

        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;

        if (isDebugEnabled) {
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields (contentSource is now optional, replaced by excludeMcg)
        var requiredFields = ['useCase', 'offset', 'limit'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Get Assessments: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Calling CareIQServices.builderGetGuidelineTemplates');
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_cadal_careiq_e_0.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
        }

        // Check if the method exists
        if (typeof careiqServices.builderGetGuidelineTemplates !== 'function') {
            gs.error('CareIQ Get Assessments: builderGetGuidelineTemplates method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "builderGetGuidelineTemplates method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.builderGetGuidelineTemplates(
            requestData.useCase,
            requestData.offset,
            requestData.limit,
            requestData.latestVersionOnly,
            requestData.searchValue
        );

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Get Assessments: Invalid JSON response from CareIQ Services');
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
            // Successful response
            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during get assessments';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during get assessments';
        }

        gs.error('CareIQ Get Assessments Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);