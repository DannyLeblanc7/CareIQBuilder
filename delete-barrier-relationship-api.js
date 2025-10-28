(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';

        // Log raw request body for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Delete Barrier Relationship API ===');
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
        var requiredFields = ['barrierId'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Delete Barrier Relationship: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('=== CALLING SCRIPT INCLUDE ===');
            gs.info('barrierId: ' + requestData.barrierId);
            gs.info('================================');
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_cadal_careiq_e_0.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
            gs.info('About to call deleteBarrierRelationship method');
        }

        // Check if the method exists
        if (typeof careiqServices.deleteBarrierRelationship !== 'function') {
            gs.error('CareIQ Delete Barrier Relationship: deleteBarrierRelationship method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "deleteBarrierRelationship method not found in CareIQServices"}');
            return;
        }

        var responseBody = careiqServices.deleteBarrierRelationship(requestData.barrierId);

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            // For DELETE with 204 No Content, response might be empty
            if (!responseBody || responseBody.trim() === '') {
                // Success - empty response for DELETE
                response.setStatus(200);
                response.setHeader('Content-Type', 'application/json');
                response.getStreamWriter().writeString('{"success": true, "message": "Barrier relationship deleted successfully"}');
                return;
            }
            gs.error('CareIQ Delete Barrier Relationship: Invalid JSON response from CareIQ Services');
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
                gs.info('=== BARRIER RELATIONSHIP DELETE SUCCESS ===');
                gs.info('Barrier ID: ' + requestData.barrierId);
                gs.info('Response: ' + responseBody);
                gs.info('===========================================');
            }

            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"success": true, "message": "Barrier relationship deleted successfully"}');
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred during barrier relationship deletion';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred during barrier relationship deletion';
        }

        gs.error('CareIQ Delete Barrier Relationship Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);