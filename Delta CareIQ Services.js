// Delta to add to CareIQ Services.js
// Add this method to the CareIQServices.prototype object

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