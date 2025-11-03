// Delta to add to CareIQ Services.js
// Add this method to the CareIQServices.prototype object

// BUILDER - ASSESSMENT OPERATIONS

publishAssessment: function(requestData) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the publish endpoint: /builder/guideline-template/{assessmentId}/status
        var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(requestData.assessmentId) + '/status');
        var r = this._createRESTMessage('Publish Assessment', endpoint);

        // Set method to POST
        r.setHttpMethod('POST');

        // Build payload with form data and status: "published"
        var payload = {
            "status": "published",
            "store_responses": requestData.responseLogging || "use_default",
            "effective_date": requestData.effectiveDate,
            "end_date": requestData.endDate || null,
            "review_date": requestData.reviewDate || null,
            "next_review_date": requestData.nextReviewDate || null,
            "version_name": requestData.versionName || "string"
        };

        // Set the request body
        r.setRequestBody(JSON.stringify(payload));

        var response = this._executeRequestWithRetry(r, 'PublishAssessment');

        return response.getBody();
    } catch (e) {
        this._logError('PublishAssessment - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

unpublishAssessment: function(guidelineTemplateId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the unpublish endpoint: /builder/guideline-template/{guidelineTemplateId}/status
        var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(guidelineTemplateId) + '/status');
        var r = this._createRESTMessage('Unpublish Assessment', endpoint);

        // Set method to POST
        r.setHttpMethod('POST');

        // Build payload with status: "unpublished"
        var payload = {
            "status": "unpublished"
        };

        // Set the request body
        r.setRequestBody(JSON.stringify(payload));

        var response = this._executeRequestWithRetry(r, 'UnpublishAssessment');

        return response.getBody();
    } catch (e) {
        this._logError('UnpublishAssessment - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// BUILDER - SECTION OPERATIONS

builderGetSections: function(assessmentId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the builder sections endpoint
        var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(assessmentId));
        var r = this._createRESTMessage('Get Builder Sections', endpoint);

        // Set method to GET
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetBuilderSections');

        return response.getBody();
    } catch (e) {
        this._logError('GetBuilderSections - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// BUILDER - SECTION OPERATIONS

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

builderAddQuestionToSection: function(sectionId, label, type, tooltip, alternative_wording, sort_order, custom_attributes, voice, required, available, has_quality_measures, library_id) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/section/' + encodeURIComponent(sectionId) + '/questions');
        var r = this._createRESTMessage('Add Question to Section', endpoint);
        r.setHttpMethod('POST');

        // Build request body matching the CareIQ API specification
        var requestBody = {
            tooltip: tooltip || '',
            alternative_wording: alternative_wording || '',
            sort_order: sort_order || 0,
            custom_attributes: custom_attributes || {},
            voice: voice || 'CaseManager',
            required: required || false,
            available: available || false,
            has_quality_measures: has_quality_measures || false,
            label: label,
            type: type
        };

        // Add library_id for library questions
        if (library_id) {
            requestBody.library_id = library_id;
        }

        r.setRequestBody(JSON.stringify(requestBody));

        var response = this._executeRequestWithRetry(r, 'AddQuestionToSection');
        return response.getBody();
    } catch (e) {
        this._logError('AddQuestionToSection - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderAddAnswersToQuestion: function(questionId, answers) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/question/' + encodeURIComponent(questionId) + '/answers');
        var r = this._createRESTMessage('Add Answers to Question', endpoint);
        r.setHttpMethod('POST');

        // Build request body - answers array directly as CareIQ expects
        var requestBody = answers;

        r.setRequestBody(JSON.stringify(requestBody));

        var response = this._executeRequestWithRetry(r, 'AddAnswersToQuestion');
        return response.getBody();
    } catch (e) {
        this._logError('AddAnswersToQuestion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderAnswerTypeahead: function(searchText) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/answer/typeahead?text=' + encodeURIComponent(searchText));
        var r = this._createRESTMessage('Answer Typeahead Search', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'AnswerTypeaheadSearch');
        return response.getBody();
    } catch (e) {
        this._logError('AnswerTypeaheadSearch - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderLibraryAnswerDetails: function(answerId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/library/answer/' + encodeURIComponent(answerId));
        var r = this._createRESTMessage('Get Library Answer Details', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetLibraryAnswerDetails');
        return response.getBody();
    } catch (e) {
        this._logError('GetLibraryAnswerDetails - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderGetGuidelineTemplates: function(useCase, offset, limit, contentSource, latestVersionOnly, searchValue) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the builder guideline templates endpoint with query parameters
        var endpoint = this._buildEndpoint('/builder/guideline-template?use_case=' + encodeURIComponent(useCase) +
                                          '&offset=' + encodeURIComponent(offset) +
                                          '&limit=' + encodeURIComponent(limit) +
                                          '&content_source=' + encodeURIComponent(contentSource));

        // Add optional parameters if provided
        if (latestVersionOnly) {
            endpoint += '&latest_version_only=' + encodeURIComponent(latestVersionOnly);
        }

        if (searchValue) {
            endpoint += '&search_value=' + encodeURIComponent(searchValue);
        }

        var r = this._createRESTMessage('Get Builder Guideline Templates', endpoint);

        // Set method to GET
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetBuilderGuidelineTemplates');

        return response.getBody();
    } catch (e) {
        this._logError('GetBuilderGuidelineTemplates - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

builderCreateAssessment: function(assessmentData) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the builder create assessment endpoint
        var endpoint = this._buildEndpoint('/builder/guideline-template');
        var r = this._createRESTMessage('Create Assessment', endpoint);

        // Set method to POST
        r.setHttpMethod('POST');

        // Build request body for the CareIQ API
        var requestBody = {
            title: assessmentData.title,
            use_case: assessmentData.use_case,
            content_source: assessmentData.content_source,
            version_name: assessmentData.version_name || '',
            external_id: assessmentData.external_id || '',
            custom_attributes: assessmentData.custom_attributes || {},
            tags: assessmentData.tags || [],
            effective_date: assessmentData.effective_date,
            end_date: assessmentData.end_date,
            review_date: assessmentData.review_date,
            next_review_date: assessmentData.next_review_date,
            tooltip: assessmentData.tooltip || '',
            alternative_wording: assessmentData.alternative_wording || '',
            available: assessmentData.available || false,
            policy_number: assessmentData.policy_number || '',
            use_case_category_id: assessmentData.use_case_category_id,
            quality_measures: assessmentData.quality_measures || {},
            settings: assessmentData.settings || {
                store_responses: "use_default"
            },
            usage: assessmentData.usage || 'Care Planning',
            mcg_content_enabled: assessmentData.mcg_content_enabled || false,
            select_all_enabled: assessmentData.select_all_enabled !== undefined ? assessmentData.select_all_enabled : true,
            multi_tenant_default: assessmentData.multi_tenant_default || false
        };

        r.setRequestBody(JSON.stringify(requestBody));

        var response = this._executeRequestWithRetry(r, 'CreateAssessment');

        return response.getBody();
    } catch (e) {
        this._logError('CreateAssessment - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// BUILDER - RELATIONSHIP OPERATIONS

deleteBranchQuestion: function(answerId, questionId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/answer/' + encodeURIComponent(answerId) + '/branch-question/' + encodeURIComponent(questionId));
        var r = this._createRESTMessage('Delete Branch Question', endpoint);
        r.setHttpMethod('DELETE');

        var response = this._executeRequestWithRetry(r, 'DeleteBranchQuestion');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteBranchQuestion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

deleteGuidelineRelationship: function(answerId, guidelineId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/answer/' + encodeURIComponent(answerId) + '/guideline-template/' + encodeURIComponent(guidelineId));
        var r = this._createRESTMessage('Delete Guideline Relationship', endpoint);
        r.setHttpMethod('DELETE');

        var response = this._executeRequestWithRetry(r, 'DeleteGuidelineRelationship');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteGuidelineRelationship - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

addBarrierRelationship: function(answerId, barrierName, barrierId, sortOrder, guidelineTemplateId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/barrier');
        var r = this._createRESTMessage('Add Barrier Relationship', endpoint);
        r.setHttpMethod('POST');

        // Build request body with CORRECT field names for CareIQ API
        var requestBody = {
            answer_id: answerId,
            label: barrierName,
            original_label: barrierName,
            sort_order: sortOrder || 0,
            guideline_template_id: guidelineTemplateId
        };

        // Only include library_id if we're adding an existing barrier from library
        if (barrierId && barrierId !== null && barrierId !== '') {
            requestBody.library_id = barrierId;
        }

        r.setRequestBody(JSON.stringify(requestBody));

        var response = this._executeRequestWithRetry(r, 'AddBarrierRelationship');
        return response.getBody();
    } catch (e) {
        this._logError('AddBarrierRelationship - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

deleteBarrierRelationship: function(barrierId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/barrier/' + encodeURIComponent(barrierId));
        var r = this._createRESTMessage('Delete Barrier Relationship', endpoint);
        r.setHttpMethod('DELETE');

        var response = this._executeRequestWithRetry(r, 'DeleteBarrierRelationship');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteBarrierRelationship - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

addProblemRelationship: function(answerId, problemName, problemId, sortOrder, guidelineTemplateId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/problem');
        var r = this._createRESTMessage('Add Problem Relationship', endpoint);
        r.setHttpMethod('POST');

        // Build request body with CORRECT field names for CareIQ API
        var requestBody = {
            answer_id: answerId,
            label: problemName,
            original_label: problemName,
            sort_order: sortOrder || 0,
            guideline_template_id: guidelineTemplateId
        };

        // Only include library_id if we're adding an existing problem from library
        if (problemId && problemId !== null && problemId !== '') {
            requestBody.library_id = problemId;
        }

        r.setRequestBody(JSON.stringify(requestBody));

        var response = this._executeRequestWithRetry(r, 'AddProblemRelationship');
        return response.getBody();
    } catch (e) {
        this._logError('AddProblemRelationship - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

saveProblemEdits: function(problemId, label, alternativeWording, tooltip, customAttributes, required) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/problem/' + encodeURIComponent(problemId));
        var r = this._createRESTMessage('Save Problem Edits', endpoint);
        r.setHttpMethod('PATCH');

        // Build request body matching the CareIQ API specification
        var requestBody = {
            label: label,
            tooltip: tooltip || '',
            alternative_wording: alternativeWording || '',
            custom_attributes: customAttributes || {},
            required: required || false
        };

        r.setRequestBody(JSON.stringify(requestBody));

        var response = this._executeRequestWithRetry(r, 'SaveProblemEdits');
        return response.getBody();
    } catch (e) {
        this._logError('SaveProblemEdits - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

getProblemDetails: function(problemId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/problem/' + encodeURIComponent(problemId));
        var r = this._createRESTMessage('Get Problem Details', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetProblemDetails');
        return response.getBody();
    } catch (e) {
        this._logError('GetProblemDetails - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

deleteProblemRelationship: function(problemId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/problem/' + encodeURIComponent(problemId));
        var r = this._createRESTMessage('Delete Problem Relationship', endpoint);
        r.setHttpMethod('DELETE');

        var response = this._executeRequestWithRetry(r, 'DeleteProblemRelationship');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteProblemRelationship - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

getProblemGoals: function(guidelineTemplateId, problemId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(guidelineTemplateId) + '/problem/' + encodeURIComponent(problemId) + '/goals');
        var r = this._createRESTMessage('Get Problem Goals', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetProblemGoals');
        return response.getBody();
    } catch (e) {
        this._logError('GetProblemGoals - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

addGoalToProblem: function(problemId, goalText, goalId, answerId, guidelineTemplateId, libraryId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/goal');
        var r = this._createRESTMessage('Add Goal to Problem', endpoint);
        r.setHttpMethod('POST');

        // Build request payload with CORRECT field names for CareIQ API
        var payload = {
            problem_id: problemId,  // Use snake_case like other APIs
            label: goalText,  // CareIQ API expects 'label' field for goal text
            answer_id: answerId,  // Use snake_case like other APIs
            guideline_template_id: guidelineTemplateId  // Use snake_case like other APIs
        };

        // If goalId is provided, it's linking an existing goal, otherwise creating new
        if (goalId && goalId !== null) {
            payload.goal_id = goalId;  // Link existing goal (use snake_case)
        }

        // If libraryId is provided, it's using a library goal as template
        if (libraryId && libraryId !== null) {
            payload.library_id = libraryId;  // Reference library goal by master_id
        }

        r.setRequestBody(JSON.stringify(payload));
        r.setRequestHeader('Content-Type', 'application/json');

        var response = this._executeRequestWithRetry(r, 'AddGoalToProblem');
        return response.getBody();
    } catch (e) {
        this._logError('AddGoalToProblem - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

deleteGoal: function(goalId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/goal/' + encodeURIComponent(goalId));
        var r = this._createRESTMessage('Delete Goal', endpoint);
        r.setHttpMethod('DELETE');

        var response = this._executeRequestWithRetry(r, 'DeleteGoal');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteGoal - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

deleteIntervention: function(goalId, interventionId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the delete intervention endpoint: /builder/goal/{goalId}/intervention/{interventionId}
        var endpoint = this._buildEndpoint('/builder/goal/' + encodeURIComponent(goalId) + '/intervention/' + encodeURIComponent(interventionId));
        var r = this._createRESTMessage('Delete Intervention', endpoint);
        r.setHttpMethod('DELETE');

        var response = this._executeRequestWithRetry(r, 'DeleteIntervention');
        return response.getBody();
    } catch (e) {
        this._logError('DeleteIntervention - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

getGoalDetails: function(goalId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/goal/' + encodeURIComponent(goalId));
        var r = this._createRESTMessage('Get Goal Details', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetGoalDetails');
        return response.getBody();
    } catch (e) {
        this._logError('GetGoalDetails - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

updateGoal: function(goalId, label, tooltip, alternativeWording, required, customAttributes) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/goal/' + encodeURIComponent(goalId));
        var r = this._createRESTMessage('Update Goal', endpoint);
        r.setHttpMethod('PATCH');

        // Build request payload to match CareIQ API expectations
        var payload = {
            label: label,
            tooltip: tooltip || '',
            alternative_wording: alternativeWording || '',
            required: required || false,
            custom_attributes: customAttributes || {}
        };

        r.setRequestBody(JSON.stringify(payload));
        r.setRequestHeader('Content-Type', 'application/json');

        var response = this._executeRequestWithRetry(r, 'UpdateGoal');
        return response.getBody();
    } catch (e) {
        this._logError('UpdateGoal - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// BUILDER - INTERVENTION OPERATIONS

getGoalInterventions: function(guidelineTemplateId, goalId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the goal interventions endpoint: /builder/guideline-template/{gtId}/goal/{goalId}/interventions
        var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(guidelineTemplateId) + '/goal/' + encodeURIComponent(goalId) + '/interventions');
        var r = this._createRESTMessage('Get Goal Interventions', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetGoalInterventions');
        return response.getBody();
    } catch (e) {
        this._logError('GetGoalInterventions - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

addInterventionToGoal: function(goalId, interventionText, category, guidelineTemplateId, tooltip, alternativeWording, interventionId, libraryId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the intervention creation endpoint: /builder/intervention
        var endpoint = this._buildEndpoint('/builder/intervention');
        var r = this._createRESTMessage('Add Intervention', endpoint);
        r.setHttpMethod('POST');

        // Build request payload to match CareIQ API expectations
        var payload = {
            guideline_template_id: guidelineTemplateId,
            label: interventionText,
            tooltip: tooltip || '',
            alternative_wording: alternativeWording || '',
            custom_attributes: {},
            available: false,
            required: false,
            sort_order: 0,
            category: category,
            goal_id: goalId
        };

        // Add intervention_id if linking to existing intervention (vs creating new)
        if (interventionId) {
            payload.intervention_id = interventionId;
        }

        // Add library_id if linking to library intervention
        if (libraryId) {
            payload.library_id = libraryId;
        }

        r.setRequestBody(JSON.stringify(payload));
        r.setRequestHeader('Content-Type', 'application/json');

        var response = this._executeRequestWithRetry(r, 'AddIntervention');
        return response.getBody();
    } catch (e) {
        this._logError('AddIntervention - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

getInterventionDetails: function(interventionId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/intervention/' + encodeURIComponent(interventionId));
        var r = this._createRESTMessage('Get Intervention Details', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetInterventionDetails');
        return response.getBody();
    } catch (e) {
        this._logError('GetInterventionDetails - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

updateIntervention: function(interventionId, label, tooltip, alternativeWording, category, goalId, required, customAttributes) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/intervention/' + encodeURIComponent(interventionId));
        var r = this._createRESTMessage('Update Intervention', endpoint);
        r.setHttpMethod('PATCH');

        // Build request payload to match CareIQ API expectations
        var payload = {
            label: label,
            tooltip: tooltip || '',
            alternative_wording: alternativeWording || '',
            category: category || 'assist',
            goal_id: goalId,
            required: required || false,
            custom_attributes: customAttributes || {}
        };

        r.setRequestBody(JSON.stringify(payload));
        r.setRequestHeader('Content-Type', 'application/json');

        var response = this._executeRequestWithRetry(r, 'UpdateIntervention');
        return response.getBody();
    } catch (e) {
        this._logError('UpdateIntervention - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// VERSION OPERATIONS

createVersion: function(assessmentId, versionName, effectiveDate) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the create version endpoint
        var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(assessmentId) + '/status');
        var r = this._createRESTMessage('Create Version', endpoint);

        // Set method to POST (for status endpoint)
        r.setHttpMethod('POST');

        // Set up the payload
        var payload = {
            status: "draft",
            effective_date: effectiveDate,
            version_name: versionName
        };

        this._logError('Create Version - Endpoint: ' + endpoint);
        this._logError('Create Version - Payload: ' + JSON.stringify(payload));

        r.setRequestBody(JSON.stringify(payload));
        r.setRequestHeader('Content-Type', 'application/json');

        var response = this._executeRequestWithRetry(r, 'CreateVersion');
        this._logError('Create Version - Response: ' + response.getBody());

        return response.getBody();
    } catch (e) {
        this._logError('CreateVersion - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

updateAssessment: function(requestData) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the update assessment endpoint
        var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(requestData.assessmentId));
        var r = this._createRESTMessage('Update Assessment', endpoint);

        // Set method to PATCH
        r.setHttpMethod('PATCH');

        // Set up the payload
        var payload = {};

        // Map form fields to API payload
        if (requestData.effectiveDate) payload.effective_date = requestData.effectiveDate;
        if (requestData.endDate) payload.end_date = requestData.endDate;
        if (requestData.reviewDate) payload.review_date = requestData.reviewDate;
        if (requestData.nextReviewDate) payload.next_review_date = requestData.nextReviewDate;
        if (requestData.useCaseCategory) payload.use_case_category_id = requestData.useCaseCategory;
        if (requestData.usage) payload.usage = requestData.usage;
        if (requestData.policyNumber) payload.policy_number = requestData.policyNumber;
        if (requestData.versionName) payload.version_name = requestData.versionName;
        if (requestData.contentSource) payload.content_source = requestData.contentSource;

        // Handle boolean fields
        if (requestData.allowMcgContent !== undefined) {
            payload.mcg_content_enabled = requestData.allowMcgContent;
        }

        // DEBUG: Log what we're receiving for select_all_enabled
        this._logError('Update Assessment - requestData.select_all_enabled: ' + requestData.select_all_enabled);
        this._logError('Update Assessment - requestData.selectAllEnabled: ' + requestData.selectAllEnabled);

        if (requestData.selectAllEnabled !== undefined) {
            payload.select_all_enabled = requestData.selectAllEnabled;
        } else if (requestData.select_all_enabled !== undefined) {
            payload.select_all_enabled = requestData.select_all_enabled;
        }

        // Handle response logging settings
        if (requestData.responseLogging !== undefined) {
            payload.settings = {
                store_responses: requestData.responseLogging ? "enabled" : "use_default"
            };
        }

        this._logError('Update Assessment - Endpoint: ' + endpoint);
        this._logError('Update Assessment - Payload: ' + JSON.stringify(payload));

        r.setRequestBody(JSON.stringify(payload));
        r.setRequestHeader('Content-Type', 'application/json');

        var response = this._executeRequestWithRetry(r, 'UpdateAssessment');
        this._logError('Update Assessment - Response: ' + response.getBody());

        return response.getBody();
    } catch (e) {
        this._logError('UpdateAssessment - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// BUILDER - SCORING MODEL OPERATIONS

createScoringModel: function(guidelineTemplateId, label, scoringType) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/scoring_model');
        var r = this._createRESTMessage('Create Scoring Model', endpoint);
        r.setHttpMethod('POST');

        // Build request payload to match CareIQ API expectations
        var payload = {
            guideline_template_id: guidelineTemplateId,
            label: label,
            scoring_type: scoringType
        };

        r.setRequestBody(JSON.stringify(payload));
        r.setRequestHeader('Content-Type', 'application/json');

        var response = this._executeRequestWithRetry(r, 'CreateScoringModel');
        return response.getBody();
    } catch (e) {
        this._logError('CreateScoringModel - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

getScoringModels: function(guidelineTemplateId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/guideline_template/' + encodeURIComponent(guidelineTemplateId) + '/scoring_model');
        var r = this._createRESTMessage('Get Scoring Models', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetScoringModels');
        return response.getBody();
    } catch (e) {
        this._logError('GetScoringModels - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

deleteScoringModel: function(guidelineTemplateId, modelId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/guideline_template/' + encodeURIComponent(guidelineTemplateId) + '/scoring_model/' + encodeURIComponent(modelId));
        var r = this._createRESTMessage('Delete Scoring Model', endpoint);
        r.setHttpMethod('DELETE');

        var response = this._executeRequestWithRetry(r, 'DeleteScoringModel');

        // Handle 204 No Content response
        if (response.getStatusCode() === 204) {
            return '{"success": true, "message": "Scoring model deleted successfully"}';
        }

        return response.getBody();
    } catch (e) {
        this._logError('DeleteScoringModel - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

saveScoringModelValue: function(scoringModelId, guidelineTemplateId, label, scoringType, answerId, value) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        var endpoint = this._buildEndpoint('/builder/scoring_model/' + encodeURIComponent(scoringModelId));
        var r = this._createRESTMessage('Save Scoring Model Value', endpoint);
        r.setHttpMethod('PATCH');

        // Build the payload with the single answer value
        var payload = {
            guideline_template_id: guidelineTemplateId,
            label: label,
            scoring_type: scoringType,
            values: [
                {
                    answer_id: answerId,
                    value: value
                }
            ]
        };

        r.setRequestBody(JSON.stringify(payload));
        r.setRequestHeader('Content-Type', 'application/json');

        var response = this._executeRequestWithRetry(r, 'SaveScoringModelValue');

        // Handle 204 No Content response
        if (response.getStatusCode() === 204) {
            return '{"success": true, "message": "Scoring model value saved successfully"}';
        }

        return response.getBody();
    } catch (e) {
        this._logError('SaveScoringModelValue - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// BUILDER - QUESTION BUNDLE OPERATIONS

createQuestionBundle: function(contentId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the question bundle endpoint
        var endpoint = this._buildEndpoint('/builder/library/question/bundle');
        var r = this._createRESTMessage('Create Question Bundle', endpoint);

        // Set method to POST
        r.setHttpMethod('POST');

        // Build payload
        var payload = {
            "content_id": contentId
        };

        // Set the request body
        r.setRequestBody(JSON.stringify(payload));

        var response = this._executeRequestWithRetry(r, 'CreateQuestionBundle');

        return response.getBody();
    } catch (e) {
        this._logError('CreateQuestionBundle - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

createProblemBundle: function(contentId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the problem bundle endpoint
        var endpoint = this._buildEndpoint('/builder/library/problem/bundle');
        var r = this._createRESTMessage('Create Problem Bundle', endpoint);

        // Set method to POST
        r.setHttpMethod('POST');

        // Build payload
        var payload = {
            "content_id": contentId
        };

        // Set the request body
        r.setRequestBody(JSON.stringify(payload));

        var response = this._executeRequestWithRetry(r, 'CreateProblemBundle');

        return response.getBody();
    } catch (e) {
        this._logError('CreateProblemBundle - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// BUILDER - EVIDENCE OPERATIONS

getEvidence: function(contentType, contentId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the evidence endpoint: /careflow/{contentType}/{contentId}/evidence
        // contentType can be: question, answer, problem, goal, intervention
        var endpoint = this._buildEndpoint('/careflow/' + encodeURIComponent(contentType) + '/' + encodeURIComponent(contentId) + '/evidence');
        var r = this._createRESTMessage('GET Evidence', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetEvidence');
        return response.getBody();
    } catch (e) {
        this._logError('GetEvidence - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

getQualityMeasures: function(guidelineTemplateId) {
    try {
        var config = this._getConfig();

        if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
            return '{"error": "Configuration invalid"}';
        }

        // Build the quality measures endpoint: /careflow/guideline-template/{guidelineTemplateId}/quality-measures
        var endpoint = this._buildEndpoint('/careflow/guideline-template/' + encodeURIComponent(guidelineTemplateId) + '/quality-measures');
        var r = this._createRESTMessage('GET Quality Measures', endpoint);
        r.setHttpMethod('GET');

        var response = this._executeRequestWithRetry(r, 'GetQualityMeasures');
        return response.getBody();
    } catch (e) {
        this._logError('GetQualityMeasures - Error: ' + e);
        return '{"error": "' + e.message + '"}';
    }
},

// ====================
// FIX FOR v1.0.009 - Library Question Editable Fields
// ====================
// LOCATION: In builderAddQuestionToSection method (around line 1339 in CareIQ Services.js)
// REPLACE THE LIBRARY_ID CONDITION WITH THIS:

if (library_id) {
	// Library question - include editable fields (tooltip, voice, required, alternative_wording)
	requestBody = {
		sort_order: sort_order || 0,
		library_id: library_id,
		tooltip: tooltip || '',
		voice: voice || 'CaseManager',
		required: required || false,
		alternative_wording: alternative_wording || ''
	};
	this._log('AddQuestionToSection - Using payload for library question: ' + library_id + ', required: ' + (required || false) + ', voice: ' + (voice || 'CaseManager') + ', tooltip length: ' + (tooltip ? tooltip.length : 0), false);
} else {
	// Regular question - full payload
	requestBody = {
		tooltip: tooltip || '',
		alternative_wording: alternative_wording || '',
		sort_order: sort_order || 0,
		custom_attributes: custom_attributes || {},
		voice: voice || 'CaseManager',
		required: required || false,
		available: available || false,
		has_quality_measures: has_quality_measures || false,
		label: label,
		type: type
	};
}

// REASON FOR FIX:
// The original code only sent sort_order and library_id for library questions.
// When users edited tooltip, voice, or required fields on library questions,
// these changes were not being sent to the CareIQ backend.
//
// This fix ensures that editable fields are included in the library question payload.

// ============================================================================
// COMPONENT FIX: ADD_QUESTION_TO_SECTION_API Handler (index.js line ~19066)
// ============================================================================
// ALSO FIXED in the component: The ADD_QUESTION_TO_SECTION_API action handler
// was using a "minimal payload" for library questions that only included:
//   - sectionId, sort_order, library_id, required
//
// It was STRIPPING OUT the voice, tooltip, and alternative_wording fields
// even though they were passed in from SAVE_ALL_CHANGES.
//
// FIXED by including all editable fields in the library question requestBodyData:
//   required: questionData.required || false,
//   voice: questionData.voice || 'CaseManager',
//   tooltip: questionData.tooltip || '',
//   alternative_wording: questionData.alternative_wording || ''
//
// This was the root cause of the voice/tooltip revert bug.
