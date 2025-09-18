// CONSOLIDATED DELTA - All CareIQ Services Script Include Methods
// This is the single source of truth for all Script Include methods to be added to CareIQ Services.js
// Add all these methods to the CareIQServices.prototype object

// =============================================================================
// BUILDER - SECTION OPERATIONS
// =============================================================================

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

// =============================================================================
// BUILDER - QUESTION OPERATIONS
// =============================================================================

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

// =============================================================================
// BUILDER - ANSWER OPERATIONS
// =============================================================================

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

// =============================================================================
// TYPEAHEAD OPERATIONS
// =============================================================================

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

// =============================================================================
// RELATIONSHIP OPERATIONS
// =============================================================================

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