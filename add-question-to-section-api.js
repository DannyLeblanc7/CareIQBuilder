(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Add Question to Section API ===');
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

        // Validate required fields based on whether this is a library question or not
        var isLibraryQuestion = requestData.library_id && requestData.library_id !== null && requestData.library_id !== '';
        var requiredFields;

        if (isLibraryQuestion) {
            // Library questions only need sectionId, sort_order, and library_id
            requiredFields = ['sectionId', 'sort_order', 'library_id'];
        } else {
            // Regular questions need full fields
            requiredFields = ['sectionId', 'label', 'type', 'sort_order'];
        }

        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Add Question to Section: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Calling CareIQServices.addQuestionToSection with data:');
            gs.info('- sectionId: ' + requestData.sectionId);
            gs.info('- isLibraryQuestion: ' + isLibraryQuestion);
            if (isLibraryQuestion) {
                gs.info('- library_id: ' + requestData.library_id);
            } else {
                gs.info('- label: ' + requestData.label);
                gs.info('- type: ' + requestData.type);
            }
            gs.info('- sort_order: ' + requestData.sort_order);
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_1628056_careiq.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call addQuestionToSection method');
        }

        // Check if the method exists
        if (typeof careiqServices.builderAddQuestionToSection !== 'function') {
            gs.error('CareIQ Add Question to Section: builderAddQuestionToSection method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "builderAddQuestionToSection method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.builderAddQuestionToSection(
            requestData.sectionId,
            requestData.label || null,  // Null for library questions
            requestData.type || null,   // Null for library questions
            requestData.tooltip || '',
            requestData.alternative_wording || '',
            requestData.sort_order,
            requestData.custom_attributes || {},
            requestData.voice || 'CaseManager',
            requestData.required || false,
            requestData.available || false,
            requestData.has_quality_measures || false,
            requestData.library_id || null  // Pass library_id for library questions
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
            gs.error('CareIQ Add Question to Section: Invalid JSON response from CareIQ Services');
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
                gs.info('=== ADD QUESTION TO SECTION SUCCESS ===');
                gs.info('Section ID: ' + requestData.sectionId);
                gs.info('Question Label: ' + requestData.label);
                gs.info('Response: ' + responseBody);
                gs.info('=====================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during question addition to section';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during question addition to section';
        }

        gs.error('CareIQ Add Question to Section Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);