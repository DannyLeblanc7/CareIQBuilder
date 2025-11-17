searchAssessments: function(useCase, searchValue, admin, useCaseCategories, offset, limit) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/careflow/guideline-template');
        var r = this._createRESTMessage('Get Assessments', endpoint);

        r.setQueryParameter('use_case', useCase);
        r.setQueryParameter('search_value', searchValue);
        r.setQueryParameter('use_case_category', useCaseCategories);
        r.setQueryParameter('admin', admin);
        r.setQueryParameter('offset', offset);
        r.setQueryParameter('limit', limit);

        var response = this._executeRequestWithRetry(r, 'SearchAssessments');
        return response.getBody();
    } catch (e) {
        this._logError('SearchAssessments - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},
