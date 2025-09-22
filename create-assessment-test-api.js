(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';

        if (isDebugEnabled) {
            gs.info('=== CareIQ Create Assessment TEST API ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Raw request.body: ' + JSON.stringify(request.body));
        }

        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;

        if (isDebugEnabled) {
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // For testing - just return a mock response to see if the flow works
        var mockResponse = {
            id: 'test-' + Date.now(),
            title: requestData.title || 'Test Assessment',
            status: 'draft'
        };

        if (isDebugEnabled) {
            gs.info('Returning mock response: ' + JSON.stringify(mockResponse));
        }

        response.setStatus(200);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString(JSON.stringify(mockResponse));

    } catch (e) {
        var errorMsg = 'Unexpected server error occurred in test API';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred in test API';
        }

        gs.error('CareIQ Create Assessment Test Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);