(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';

        // Stash request data at the start to avoid consumption issues
        var requestData = request.body.data;

        // Log the request for debugging
        if (isDebugEnabled) {
            gs.info('=== CareIQ Create Assessment API ===');
            gs.info('Request method: ' + request.httpMethod);
            gs.info('Raw request.body: ' + JSON.stringify(request.body));
            gs.info('Extracted requestData: ' + JSON.stringify(requestData));
            gs.info('RequestData type: ' + typeof requestData);
            gs.info('RequestData is null: ' + (requestData === null));
            gs.info('RequestData is undefined: ' + (requestData === undefined));
        }

        // Validate required fields
        var requiredFields = ['title', 'use_case', 'content_source'];
        var missingFields = [];

        for (var i = 0; i < requiredFields.length; i++) {
            if (requestData[requiredFields[i]] === undefined || requestData[requiredFields[i]] === null || requestData[requiredFields[i]] === '') {
                missingFields.push(requiredFields[i]);
            }
        }

        // use_case_category_id is required to be present but can have any value
        if (requestData['use_case_category_id'] === undefined) {
            missingFields.push('use_case_category_id');
        }

        if (missingFields.length > 0) {
            gs.error('CareIQ Create Assessment: Missing required fields: ' + missingFields.join(', '));
            response.setStatus(400);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "Missing required fields: ' + missingFields.join(', ') + '"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('Calling CareIQServices.builderCreateAssessment');
        }

        // Create Script Include instance and call the method
        var careiqServices = new x_cadal_careiq_e_0.CareIQServices();

        if (isDebugEnabled) {
            gs.info('CareIQServices instance created successfully');
        }

        // Check if the method exists
        if (typeof careiqServices.builderCreateAssessment !== 'function') {
            gs.error('CareIQ Create Assessment: builderCreateAssessment method not found in CareIQServices');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "builderCreateAssessment method not found in CareIQServices"}');
            return;
        }

        if (isDebugEnabled) {
            gs.info('builderCreateAssessment method found, type: ' + typeof careiqServices.builderCreateAssessment);
            gs.info('CareIQServices instance methods: ' + Object.getOwnPropertyNames(careiqServices));
        }

        // Build assessment data for the Script Include
        var assessmentData = {
            title: requestData.title,
            use_case: requestData.use_case,
            content_source: requestData.content_source,
            version_name: requestData.version_name,
            external_id: requestData.external_id || '',
            custom_attributes: requestData.custom_attributes || {},
            tags: requestData.tags || [],
            effective_date: requestData.effective_date,
            end_date: requestData.end_date,
            review_date: requestData.review_date,
            next_review_date: requestData.next_review_date,
            tooltip: requestData.tooltip || '',
            alternative_wording: requestData.alternative_wording || '',
            available: requestData.available || false,
            policy_number: requestData.policy_number || '',
            use_case_category_id: requestData.use_case_category_id,
            quality_measures: requestData.quality_measures || {},
            settings: requestData.settings || {
                store_responses: "use_default"
            },
            usage: requestData.usage || 'Care Planning',
            mcg_content_enabled: requestData.mcg_content_enabled || false,
            select_all_enabled: requestData.select_all_enabled !== undefined ? requestData.select_all_enabled : true,
            multi_tenant_default: requestData.multi_tenant_default || false
        };

        if (isDebugEnabled) {
            gs.info('About to call builderCreateAssessment with data: ' + JSON.stringify(assessmentData));
        }

        var responseBody = careiqServices.builderCreateAssessment(assessmentData);

        if (isDebugEnabled) {
            gs.info('CareIQServices response received: ' + responseBody);
            gs.info('Response type: ' + typeof responseBody);
            gs.info('Response length: ' + (responseBody ? responseBody.length : 'null/undefined'));
        }

        // CRITICAL DEBUG: Check if we actually got a response
        if (!responseBody) {
            gs.error('CRITICAL: CareIQServices.builderCreateAssessment returned null/undefined');
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString('{"error": "No response from CareIQ Services"}');
            return;
        }

        // Additional debug - check if response is actually valid JSON
        if (responseBody) {
            try {
                var testParse = JSON.parse(responseBody);
                if (isDebugEnabled) {
                    gs.info('Response parsed successfully. Contains id: ' + (testParse.id ? 'YES' : 'NO'));
                }
            } catch (parseTestError) {
                gs.error('Response is not valid JSON: ' + parseTestError);
                gs.error('Raw response: ' + responseBody);
            }
        } else {
            gs.error('CRITICAL: responseBody is empty or null');
        }

        // Parse response to check for errors
        var parsedResponse;
        try {
            parsedResponse = JSON.parse(responseBody);
        } catch (parseError) {
            gs.error('CareIQ Create Assessment: Invalid JSON response from CareIQ Services');
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
        } else if (parsedResponse && parsedResponse.detail && Array.isArray(parsedResponse.detail)) {
            // Check if detail array contains validation errors
            var hasErrors = false;
            for (var i = 0; i < parsedResponse.detail.length; i++) {
                var detail = parsedResponse.detail[i];
                if (detail && (detail.type === 'uuid_parsing' || detail.type === 'validation_error')) {
                    hasErrors = true;
                    break;
                }
            }

            if (hasErrors) {
                gs.error('CareIQ Create Assessment: Validation errors in detail array: ' + JSON.stringify(parsedResponse.detail));
                response.setStatus(400);
                response.setHeader('Content-Type', 'application/json');
                // Convert detail array to error message
                var errorMessage = 'Validation errors: ';
                for (var j = 0; j < parsedResponse.detail.length; j++) {
                    if (parsedResponse.detail[j] && parsedResponse.detail[j].msg) {
                        errorMessage += parsedResponse.detail[j].msg + '; ';
                    }
                }
                response.getStreamWriter().writeString('{"error": "' + errorMessage + '"}');
            } else {
                // Successful response
                response.setStatus(200);
                response.setHeader('Content-Type', 'application/json');
                response.getStreamWriter().writeString(responseBody);
            }
        } else {
            // Successful response
            response.setStatus(200);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(responseBody);
        }

    } catch (e) {
        // Safe error handling for ServiceNow
        var errorMsg = 'Unexpected server error occurred while creating assessment';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred while creating assessment';
        }

        gs.error('CareIQ Create Assessment Script Error: ' + errorMsg);

        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);