(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';

        if (isDebugEnabled) {
            gs.info('=== CareIQ Answer Typeahead API ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Request body: ' + JSON.stringify(request.body));
        }

        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;

        // Get search text from request data
        var searchText = requestData ? requestData.searchText : '';

        if (!searchText || searchText.trim() === '') {
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required parameter: searchText"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Search text: ' + searchText);
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_1628056_careiq.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call builderAnswerTypeahead method');
        }

        // Check if the method exists
        if (typeof careiqServices.builderAnswerTypeahead !== 'function') {
            gs.error('CareIQ Answer Typeahead: builderAnswerTypeahead method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "builderAnswerTypeahead method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.builderAnswerTypeahead(searchText);

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Answer Typeahead: Invalid JSON response from CareIQ Services');
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
                gs.info('=== ANSWER TYPEAHEAD SUCCESS ===');
                gs.info('Search text: ' + searchText);
                gs.info('Results count: ' + (parsedResponse.results ? parsedResponse.results.length : 0));
                gs.info('Response: ' + responseBody);
                gs.info('===================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during answer typeahead search';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during answer typeahead search';
        }

        gs.error('CareIQ Answer Typeahead Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);