// Delta to add to CareIQ Services.js
// Add this method to the CareIQServices.prototype object

builderGenericTypeahead: function(contentType, searchText) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        // Validate content type
        var validTypes = ['section', 'question', 'answer'];
        if (validTypes.indexOf(contentType) === -1) {
            return '{"error": "Invalid content type: ' + contentType + '"}';
        }
        
        // Build the typeahead endpoint with content type and search text
        var endpoint = this._buildEndpoint('/builder/' + contentType + '/typeahead?text=' + encodeURIComponent(searchText));
        var r = this._createRESTMessage('Generic Typeahead Search', endpoint);
        
        var response = this._executeRequestWithRetry(r, 'GenericTypeahead_' + contentType);
        return response.getBody();
    } catch (e) {
        this._logError('GenericTypeahead (' + contentType + ') - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},