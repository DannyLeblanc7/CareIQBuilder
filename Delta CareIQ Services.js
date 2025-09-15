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

builderGetAnswerRelationships: function(answerId) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/answer/' + encodeURIComponent(answerId) + '/relationships');
        var r = this._createRESTMessage('Get Answer Relationships', endpoint);
        
        var response = this._executeRequestWithRetry(r, 'GetAnswerRelationships');
        return response.getBody();
    } catch (e) {
        this._logError('GetAnswerRelationships - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderDeleteSection: function(sectionId) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/section/' + encodeURIComponent(sectionId));
        var r = this._createRESTMessage('Delete Section', endpoint);
        r.setHttpMethod('DELETE');
        
        var response = this._executeRequestWithRetry(r, 'DeleteSection');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteSection - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderAddQuestion: function(questionData) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/question');
        var r = this._createRESTMessage('Add Question', endpoint);
        r.setHttpMethod('POST');
        
        // Build request body for the CareIQ API
        var requestBody = {
            label: questionData.label,
            type: questionData.type,
            tooltip: questionData.tooltip || '',
            alternative_wording: questionData.alternative_wording || '',
            answers: questionData.answers || [],
            guideline_template_id: questionData.guideline_template_id,
            section_id: questionData.section_id,
            sort_order: questionData.sort_order || 1,
            custom_attributes: questionData.custom_attributes || {},
            voice: questionData.voice || 'CaseManager',
            required: questionData.required || false,
            available: questionData.available || false
        };
        
        r.setRequestBody(JSON.stringify(requestBody));
        
        var response = this._executeRequestWithRetry(r, 'AddQuestion');
        return response.getBody();
    } catch (e) {
        this._logError('AddQuestion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderAddAnswer: function(answerData) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/answer');
        var r = this._createRESTMessage('Add Answer', endpoint);
        r.setHttpMethod('POST');
        
        // Build request body for the CareIQ API
        var requestBody = {
            label: answerData.label,
            tooltip: answerData.tooltip || '',
            alternative_wording: answerData.alternative_wording || 'string',
            secondary_input_type: answerData.secondary_input_type || null,
            mutually_exclusive: answerData.mutually_exclusive || false,
            custom_attributes: answerData.custom_attributes || {},
            required: answerData.required || false,
            sort_order: answerData.sort_order || 1,
            question_id: answerData.question_id,
            guideline_template_id: answerData.guideline_template_id
        };
        
        r.setRequestBody(JSON.stringify(requestBody));
        
        var response = this._executeRequestWithRetry(r, 'AddAnswer');
        return response.getBody();
    } catch (e) {
        this._logError('AddAnswer - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderDeleteAnswer: function(answerId) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/answer/' + encodeURIComponent(answerId));
        var r = this._createRESTMessage('Delete Answer', endpoint);
        r.setHttpMethod('DELETE');
        
        var response = this._executeRequestWithRetry(r, 'DeleteAnswer');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteAnswer - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderDeleteQuestion: function(questionId) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/question/' + encodeURIComponent(questionId));
        var r = this._createRESTMessage('Delete Question', endpoint);
        r.setHttpMethod('DELETE');
        
        var response = this._executeRequestWithRetry(r, 'DeleteQuestion');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteQuestion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderUpdateQuestion: function(questionId, questionData) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/question/' + encodeURIComponent(questionId));
        var r = this._createRESTMessage('Update Question', endpoint);
        r.setHttpMethod('PATCH');
        
        // Build request body for the CareIQ API
        var requestBody = {
            label: questionData.label,
            tooltip: questionData.tooltip || '',
            alternative_wording: questionData.alternative_wording || 'string',
            required: questionData.required || false,
            custom_attributes: questionData.custom_attributes || {},
            sort_order: questionData.sort_order || 0,
            voice: questionData.voice || 'Patient',
            type: questionData.type
        };
        
        r.setRequestBody(JSON.stringify(requestBody));
        
        var response = this._executeRequestWithRetry(r, 'UpdateQuestion');
        return response.getBody();
    } catch (e) {
        this._logError('UpdateQuestion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderUpdateAnswer: function(answerId, answerData) {
    try {
        var config = this._getConfig();
        
        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }
        
        var endpoint = this._buildEndpoint('/builder/answer/' + encodeURIComponent(answerId));
        var r = this._createRESTMessage('Update Answer', endpoint);
        r.setHttpMethod('PATCH');
        
        // Build request body for the CareIQ API
        var requestBody = {
            label: answerData.label,
            tooltip: answerData.tooltip || '',
            alternative_wording: answerData.alternative_wording || 'string',
            required: answerData.required || false,
            custom_attributes: answerData.custom_attributes || {},
            sort_order: answerData.sort_order || 0,
            secondary_input_type: answerData.secondary_input_type || null,
            mutually_exclusive: answerData.mutually_exclusive || false
        };
        
        r.setRequestBody(JSON.stringify(requestBody));
        
        var response = this._executeRequestWithRetry(r, 'UpdateAnswer');
        return response.getBody();
    } catch (e) {
        this._logError('UpdateAnswer - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},