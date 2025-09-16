// Delta to add to CareIQ Services.js
// Add this method to the CareIQServices.prototype object

getGuidelineTypeahead: function(searchText) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        // Build the guideline typeahead endpoint with query parameter
        var endpoint = this._buildEndpoint('/builder/guideline-template/typeahead?text=' + encodeURIComponent(searchText));
        var r = this._createRESTMessage('Guideline Typeahead', endpoint);
        
        // Set method to GET (no request body)
        r.setHttpMethod('GET');
        r.setRequestHeader('Content-Type', 'application/json');
        
        var response = this._executeRequestWithRetry(r, 'GuidelineTypeahead');
        return response.getBody();
    } catch (e) {
        this._logError('GuidelineTypeahead - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},