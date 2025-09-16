// Delta to add to CareIQ Services.js
// Add this method to the CareIQServices.prototype object

deleteBranchQuestion: function(answerId, questionId) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        // Build the delete branch question endpoint
        var endpoint = this._buildEndpoint('/builder/answer/' + answerId + '/branch-question/' + questionId);
        var r = this._createRESTMessage('Delete Branch Question', endpoint);
        
        // Set method to DELETE with empty body (as specified)
        r.setHttpMethod('DELETE');
        r.setRequestHeader('Content-Type', 'application/json');
        
        // Empty body as specified in requirements
        r.setRequestBody('');
        
        var response = this._executeRequestWithRetry(r, 'DeleteBranchQuestion');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteBranchQuestion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},