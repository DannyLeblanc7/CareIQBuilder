(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';
        
        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;
        
        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Answer Reorder - Making Dynamic Call ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Received requestData: ' + JSON.stringify(requestData));
        }

        // Validate required fields
        var requiredFields = ['region', 'version', 'accessToken', 'app', 'sectionId', 'answerChanges'];
        var missingFields = [];
        
        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }
        
        if (missingFields.length > 0) {
            gs.error('CareIQ Answer Reorder: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        // Build dynamic URL for answer reorder endpoint
        var reorderUrl = 'https://' + requestData.app + '.' + requestData.region + '.careiq.cadalysapp.com/api/' + requestData.version + 
                        '/builder/section/' + encodeURIComponent(requestData.sectionId) + '/answers/reorder';

        if (isDebugEnabled) {
            gs.info('Making external request to: ' + reorderUrl);
        }

        var restMessage = new sn_ws.RESTMessageV2();
        restMessage.setEndpoint(reorderUrl);
        restMessage.setHttpMethod('PUT');
        restMessage.setRequestHeader('Content-Type', 'application/json');
        restMessage.setRequestHeader('Authorization', 'Bearer ' + requestData.accessToken);
        
        // Build request body with answer reorder data
        var requestBody = {
            questions: []
        };
        
        // Convert answerChanges to the format expected by the API
        for (var questionId in requestData.answerChanges) {
            if (requestData.answerChanges.hasOwnProperty(questionId)) {
                var questionAnswerChanges = requestData.answerChanges[questionId];
                var questionEntry = {
                    question_id: questionId,
                    answers: []
                };
                
                for (var answerId in questionAnswerChanges) {
                    if (questionAnswerChanges.hasOwnProperty(answerId)) {
                        var answerChange = questionAnswerChanges[answerId];
                        questionEntry.answers.push({
                            id: answerId,
                            sort_order: answerChange.newSortOrder
                        });
                    }
                }
                
                if (questionEntry.answers.length > 0) {
                    requestBody.questions.push(questionEntry);
                }
            }
        }
        
        restMessage.setRequestBody(JSON.stringify(requestBody));

        if (isDebugEnabled) {
            gs.info('Request body: ' + JSON.stringify(requestBody));
        }

        var httpResponse = restMessage.execute();
        var responseBody = httpResponse.getBody();
        var statusCode = httpResponse.getStatusCode();

        if (isDebugEnabled) {
            gs.info('CareIQ API response status: ' + statusCode);
            gs.info('CareIQ API response body: ' + responseBody);
        }

        if (statusCode === 200) {
            // Forward the actual CareIQ response
            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        } else {
            // Return error from CareIQ
            response.setStatus(statusCode);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling - avoid accessing potentially restricted properties
        var errorMsg = 'Unexpected server error occurred';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            // If even toString fails, use generic message
            errorMsg = 'Server error occurred';
        }
        
        gs.error('CareIQ Answer Reorder Error: ' + errorMsg);
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);