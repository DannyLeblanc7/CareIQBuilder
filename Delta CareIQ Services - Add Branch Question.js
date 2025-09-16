// Delta to add to CareIQ Services.js
// Add this method to the CareIQServices.prototype object

addBranchQuestion: function(answerId, questionId) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        // Build the branch question endpoint
        var endpoint = this._buildEndpoint('/builder/answer/' + answerId + '/branch-question');
        var r = this._createRESTMessage('Add Branch Question', endpoint);
        
        // Set method to POST and add payload
        r.setHttpMethod('POST');
        r.setRequestHeader('Content-Type', 'application/json');
        
        var payload = {
            question_id: questionId
        };
        
        r.setRequestBody(JSON.stringify(payload));
        
        var response = this._executeRequestWithRetry(r, 'AddBranchQuestion');
        return response.getBody();
    } catch (e) {
        this._logError('AddBranchQuestion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},