// Delta to add to CareIQ Services.js
// Add this method to the CareIQServices.prototype object

builderGetSectionQuestions: function(gtId, sectionId) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/section/' + encodeURIComponent(sectionId));
        var r = this._createRESTMessage('Get Builder Section Questions', endpoint);
        
        var response = this._executeRequestWithRetry(r, 'GetBuilderSectionQuestions');
        return response.getBody();
    } catch (e) {
        this._logError('GetBuilderSectionQuestions - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderAddSection: function(sectionData) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/section');
        var r = this._createRESTMessage('Add Section', endpoint);
        r.setHttpMethod('POST');
        
        // Build request body for the CareIQ API
        var requestBody = {
            sort_order: sectionData.sort_order,
            gt_id: sectionData.gt_id,
            label: sectionData.label,
            parent_section_id: sectionData.parent_section_id,
            library_id: sectionData.library_id || null
        };
        
        r.setRequestBody(JSON.stringify(requestBody));
        
        var response = this._executeRequestWithRetry(r, 'AddSection');
        return response.getBody();
    } catch (e) {
        this._logError('AddSection - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderUpdateSection: function(sectionData) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/section/' + encodeURIComponent(sectionData.sectionId));
        var r = this._createRESTMessage('Update Section', endpoint);
        r.setHttpMethod('PATCH');
        
        // Build request body for the CareIQ API
        var requestBody = {
            label: sectionData.label,
            tooltip: sectionData.tooltip || '',
            alternative_wording: sectionData.alternative_wording || '',
            required: sectionData.required || false,
            custom_attributes: sectionData.custom_attributes || {},
            sort_order: sectionData.sort_order || 0
        };
        
        r.setRequestBody(JSON.stringify(requestBody));
        
        var response = this._executeRequestWithRetry(r, 'UpdateSection');
        return response.getBody();
    } catch (e) {
        this._logError('UpdateSection - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},