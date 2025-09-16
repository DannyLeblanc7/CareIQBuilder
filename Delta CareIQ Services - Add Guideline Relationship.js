// Delta to add to CareIQ Services.js
// Add this method to the CareIQServices.prototype object

addGuidelineRelationship: function(answerId, guidelineId) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        // Build the guideline relationship endpoint with answer_id parameter
        var endpoint = this._buildEndpoint('/builder/answer/' + answerId + '/guideline-template');
        var r = this._createRESTMessage('Add Guideline Relationship', endpoint);
        
        // Set method to POST with guideline_id payload
        r.setHttpMethod('POST');
        r.setRequestHeader('Content-Type', 'application/json');
        
        var payload = {
            "guideline_id": guidelineId
        };
        
        r.setRequestBody(JSON.stringify(payload));
        
        var response = this._executeRequestWithRetry(r, 'AddGuidelineRelationship');
        
        // For 204 No Content responses, return empty string
        var httpStatus = response.getStatusCode();
        if (httpStatus == 204) {
            return '';
        }
        
        return response.getBody();
    } catch (e) {
        this._logError('AddGuidelineRelationship - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},