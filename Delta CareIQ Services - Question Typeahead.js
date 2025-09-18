// Delta to add to CareIQ Services.js
// Add these methods to the CareIQServices.prototype object

getQuestionTypeahead: function(searchText) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the question typeahead endpoint
        var endpoint = this._buildEndpoint('/builder/question/typeahead?text=' + encodeURIComponent(searchText));
        var r = this._createRESTMessage('Question Typeahead', endpoint);

        // Set method to GET (no payload for typeahead search)
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'QuestionTypeahead');
        return response.getBody();
    } catch (e) {
        this._logError('QuestionTypeahead - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

getLibraryQuestion: function(questionId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the library question endpoint
        var endpoint = this._buildEndpoint('/library/question/' + questionId);
        var r = this._createRESTMessage('Get Library Question', endpoint);

        // Set method to GET
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetLibraryQuestion');
        return response.getBody();
    } catch (e) {
        this._logError('GetLibraryQuestion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},