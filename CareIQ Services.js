var CareIQServices = Class.create();
CareIQServices.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {
    // Configuration and utility methods
    _isDebugEnabled: function() {
        return gs.getProperty('x_1628056_careiq.careiq.platform.globalDebug') === 'true';
    },
    
    _log: function(message, isError) {
        // ONLY log if debug is enabled OR it's an error message that we're explicitly logging as an error
        if (this._isDebugEnabled() || isError) {
            if (isError) {
                gs.error('[CareIQ] ' + message);
            } else {
                gs.info('[CareIQ] ' + message);
            }
        }
        // If debug is disabled and it's not an error, don't log anything
    },
    
    _logError: function(message) {
        // Always log errors regardless of debug setting
        gs.error('[CareIQ] ' + message);
    },
  
    _getConfig: function() {
        var config = {
            token: gs.getProperty('x_1628056_careiq.careiq.platform.token'),
            app: gs.getProperty('x_1628056_careiq.careiq.platform.app'),
            region: gs.getProperty('x_1628056_careiq.careiq.platform.region'),
            version: gs.getProperty('x_1628056_careiq.careiq.platform.version'),
            clientId: gs.getProperty('x_1628056_careiq.careiq.platform.id'),
            oToken: gs.getProperty('x_1628056_careiq.careiq.platform.otoken'),
            apiKey: gs.getProperty('x_1628056_careiq.careiq.platform.apikey')
        };
        
        return config;
    },
    
    _validateConfig: function(config, requiredFields) {
        var missing = [];
        
        requiredFields.forEach(function(field) {
            if (!config[field]) {
                missing.push(field);
            }
        });
        
        if (missing.length > 0) {
            this._logError('Missing required configuration values: ' + missing.join(', '));
            return false;
        }
        
        return true;
    },
    
    _buildEndpoint: function(path) {
        var config = this._getConfig();
        return 'https://' + config.app + '.' + config.region + '.careiq.cadalysapp.com/api/' + config.version + path;
    },
    
    _createRESTMessage: function(name, endpoint) {
        var r = new sn_ws.RESTMessageV2('x_1628056_careiq.CareIQ REST Calls', name);
        r.setEndpoint(endpoint);
        return r;
    },
    
    _setAuthHeaders: function(request, sessionToken) {
        var config = this._getConfig();
        request.setRequestHeader('Authorization', 'Bearer ' + config.token);
        
        if (sessionToken) {
            request.setRequestHeader('token', sessionToken);
        }
        
        return request;
    },
    
    _executeRequest: function(request, logContext) {
        try {
            this._log(logContext + ' - Executing REST request', false);
            var response = request.execute();
            var statusCode = response.getStatusCode();
            
            this._log(logContext + ' - Response received with status code: ' + statusCode, false);
            
            if (statusCode < 200 || statusCode >= 300) {
                this._logError(logContext + ' - Request failed with status code: ' + statusCode);
                this._logError(logContext + ' - Error response: ' + response.getBody());
            }
            
            return response;
        } catch (e) {
            this._logError(logContext + ' - Error executing request: ' + e);
            throw e;
        }
    },
    
    _executeRequestWithRetry: function(request, logContext, sessionToken) {
        var maxAttempts = 3;
        var currentAttempt = 1;
        var lastStatusCode = null;
        var lastError = null;
        
        while (currentAttempt <= maxAttempts) {
            try {
                this._log(logContext + ' - Attempt ' + currentAttempt + ' of ' + maxAttempts, false);
                
                // Set auth headers (they might have changed if token was refreshed)
                this._setAuthHeaders(request, sessionToken);
                
                // Execute the request
                this._log(logContext + ' - Executing REST request', false);
                var response = request.execute();
                var statusCode = response.getStatusCode();
                lastStatusCode = statusCode;
                
                this._log(logContext + ' - Response received with status code: ' + statusCode, false);
                
                // If successful, return the response
                if (statusCode >= 200 && statusCode < 300) {
                    return response;
                }
                
                // If unauthorized (401), refresh token and try again
                if (statusCode === 401) {
                    this._log(logContext + ' - Received 401 Unauthorized, refreshing token', true);
                    this.getToken(); // Refresh the token
                    currentAttempt++; // Increment attempt counter
                    continue; // Try again with new token
                }
                
                // For other errors, log and return response to be handled by the caller
                this._logError(logContext + ' - Request failed with status code: ' + statusCode);
                this._logError(logContext + ' - Error response: ' + response.getBody());
                return response;
                
            } catch (attemptError) {
                lastError = attemptError;
                this._logError(logContext + ' - Error in attempt ' + currentAttempt + ': ' + attemptError);
                currentAttempt++; // Increment attempt counter
                
                // Only retry if we haven't reached max attempts
                if (currentAttempt <= maxAttempts) {
                    this._log(logContext + ' - Refreshing token and retrying', false);
                    this.getToken(); // Refresh token before retry
                } else {
                    throw new Error('Failed after ' + maxAttempts + ' attempts. Last error: ' + attemptError.message);
                }
            }
        }
        
        // This should never be reached due to the throw in the catch block
        // but added as a safety measure
        throw new Error('Failed after ' + maxAttempts + ' attempts. Last status: ' + lastStatusCode);
    },
    
    // This is a shared utility function that all methods can access
    _reorderSubsections: function(input) {
        try {
            // Parse input string to object
            var data = JSON.parse(input);
            this._log("Successfully parsed input JSON string", false);
            
            // Process each section
            if (data.sections && Array.isArray(data.sections)) {
                this._log("Found sections array with " + data.sections.length + " sections", false);
                
                for (var i = 0; i < data.sections.length; i++) {
                    var section = data.sections[i];
                    
                    // Only process if subsections exist and has more than 1 item
                    if (section.subsections && Array.isArray(section.subsections) && section.subsections.length > 1) {
                        this._log("Section " + i + " has " + section.subsections.length + " subsections", false);
                        
                        // Sort subsections by sort_order
                        section.subsections.sort(function(a, b) {
                            return parseInt(a.sort_order) - parseInt(b.sort_order);
                        });
                        
                        this._log("Subsections sorted successfully", false);
                    }
                }
            }
            
            // Convert back to JSON string with same formatting as input
            var result = JSON.stringify(data);
            this._log("Successfully converted result back to JSON string", false);
            
            return result;
        } catch (e) {
            this._logError("Error sorting subsections: " + e);
            return input; // Return original on error
        }
    },

    getToken: function() {
        try {
            var config = this._getConfig();
            
            // Validate required values
            if (!this._validateConfig(config, ['app', 'region', 'version', 'apiKey', 'oToken', 'clientId'])) {
                return;
            }
            
            // Build the full endpoint URL
            var endpoint = this._buildEndpoint('/auth/token');
            this._log('Auth - Calling endpoint: ' + endpoint, false);
            
            // Create REST message
            var r = new sn_ws.RESTMessageV2();
            r.setHttpMethod('post'); 
            r.setEndpoint(endpoint);
            r.setRequestHeader('x-api-key', config.apiKey);
            r.setRequestHeader('o-token', config.oToken);
            r.setRequestHeader('x-client-id', config.clientId);
            
            // Execute the callout
            var response = this._executeRequest(r, 'Auth');
            var status = response.getStatusCode();
            
            // Handle success
            if (status === 200) {
                var responseBody = response.getBody();
                var json = JSON.parse(responseBody);
                var token = json.access_token;
                
                if (token) {
                    // Save token to sys_properties
                    var gr = new GlideRecord('sys_properties');
                    gr.addQuery('name', 'x_1628056_careiq.careiq.platform.token');
                    gr.query();
                    
                    if (gr.next()) {
                        gr.value = token;
                        gr.update();
                        this._log('Auth - Token updated successfully', false);
                    } else {
                        this._logError('Auth - Token property not found');
                    }
                } else {
                    this._logError('Auth - Token not found in response');
                }
            }
        } catch (ex) {
            this._logError('Auth - Exception: ' + ex.message);
        }
    },

    searchAssessments: function(useCase, searchValue, admin, useCaseCategories) {
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
            
            var response = this._executeRequestWithRetry(r, 'SearchAssessments');
            return response.getBody();
        } catch (e) {
            this._logError('SearchAssessments - Error: ' + e);
            return '{"error": "' + e.message + '"}';
        }
    },

    getUseCaseCategories: function(useCase) {
        try {
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                return '{"error": "Configuration invalid"}';
            }
            
            var endpoint = this._buildEndpoint('/builder/use-case-category');
            var r = this._createRESTMessage('Get Use Case Categories', endpoint);
            
            r.setQueryParameter('use_case', useCase);
            
            var response = this._executeRequestWithRetry(r, 'GetUseCaseCategories');
            return response.getBody();
        } catch (e) {
            this._logError('GetUseCaseCategories - Error: ' + e);
            return '{"error": "' + e.message + '"}';
        }
    },

    experienceNavTo: function(targetPage, params) {
        var tableName = params.tableName;
        var sysId = params.sysId;
        api.navigateTo(targetPage, {
            sysId: sysId,
            table: tableName
        });
    },

    getSections: function(gtId) {
        try {
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                return '{"error": "Configuration invalid"}';
            }
            
            var endpoint = this._buildEndpoint('/careflow/guideline-template/' + gtId);
            var r = this._createRESTMessage('Get Sections', endpoint);
            
            var response = this._executeRequestWithRetry(r, 'GetSections');
            //We need to ensure the sort order is followed
            return this._reorderSubsections(response.getBody());
        } catch (e) {
            this._logError('GetSections - Error: ' + e);
            return '{"error": "' + e.message + '"}';
        }
    },

    getQuestions: function(gtId, sectionId, sessionToken) {
        try {
            var config = this._getConfig();
            this._log("API Call - Starting Get Questions request", false);
            this._log("Session Token" + sessionToken, false);
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                return '{"error": "Configuration invalid"}';
            }

            var endpoint = this._buildEndpoint('/careflow/guideline-template/' + gtId + '/section/' + sectionId);
            var r = this._createRESTMessage('Get Section Questions', endpoint);
            r.setRequestHeader('token', sessionToken);

            var response = this._executeRequestWithRetry(r, 'GetQuestions');
            return response.getBody();
        } catch (e) {
            this._logError('GetQuestions - Error: ' + e);
            return '{"error": "' + e.message + '"}';
        }
    },

    createSession: function(gtId, aToken, cToken) {
        try {
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                return '{"error": "Configuration invalid"}';
            }
            
            var endpoint = this._buildEndpoint('/careflow/session');
            var r = this._createRESTMessage('POST Create Session', endpoint);
            r.setRequestHeader('a-token', aToken);
			r.setRequestHeader('c-token', cToken);

            var requestBody = {
                guideline_id: gtId
            };
            
            r.setRequestBody(JSON.stringify(requestBody));
            
            var response = this._executeRequestWithRetry(r, 'CreateSession');
            return response.getBody();
        } catch (e) {
            this._logError('CreateSession - Error: ' + e);
            return '{"error": "' + e.message + '"}';
        }
    },

    addAnswers: function(answerPayload, sessionToken) {
        try {
            this._log("API Call - Starting POST Answers request", false);
            
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                throw new Error("Configuration invalid");
            }
            
            var endpoint = this._buildEndpoint('/careflow/session/answers');
            var r = this._createRESTMessage('POST Answers', endpoint);
            
            // Log payload size for debugging
            var payloadSize = JSON.stringify(answerPayload).length;
            this._log("API Call - Setting request body with payload size: " + payloadSize + " characters", false);
            
            r.setRequestBody(JSON.stringify(answerPayload));
            
            var response = this._executeRequestWithRetry(r, 'AddAnswers', sessionToken);
            return response.getBody();
        } catch (error) {
            this._logError("API Call - Unhandled exception: " + error);
            // Return error details in a structured format
            return JSON.stringify({
                error: true,
                message: "Error calling CareIQ API: " + error.message,
                details: error.toString()
            });
        }
    },

    updateSessionStatus: function(sessionToken, gtId, status) {
        try {
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                return '{"error": "Configuration invalid"}';
            }
            
            var endpoint = this._buildEndpoint('/careflow/session/status');
            var r = this._createRESTMessage('POST Session Status', endpoint);
            
            var requestBody = {
                guideline_ids: [gtId],
                status: status
            };
            
            r.setRequestBody(JSON.stringify(requestBody));
            
            var response = this._executeRequestWithRetry(r, 'UpdateSessionStatus', sessionToken);
            return response.getBody();
        } catch (e) {
            this._logError('UpdateSessionStatus - Error: ' + e);
            return '{"error": "' + e.message + '"}';
        }
    },

    getCarePlan: function(sessionToken, problemsPerPage) {
        try {
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                return '{"error": "Configuration invalid"}';
            }
            
            var endpoint = this._buildEndpoint('/careflow/session/careplan');
            var r = this._createRESTMessage('GET Care Plan', endpoint);
            
            var response = this._executeRequestWithRetry(r, 'GetCarePlan', sessionToken);
            var theResponse = JSON.parse(response.getBody());
            
            if(theResponse.problems && theResponse.problems.length > 0) {
                var self = this;
                this._log('Processing ' + theResponse.problems.length + ' problems for care plan', false);
				theResponse.problemCount = theResponse.problems.length;
                //for (var i = 0; i < problemsPerPage && i < theResponse.problems.length; i++) {
				//	var problem = theResponse.problems[i];
				//	var problemResponse = JSON.parse(self.getProblem(sessionToken, problem.id));
				//	problem.goals = problemResponse.goals;
				//}

				//theResponse.problems.forEach(function(problem) {
                //    var problemResponse = JSON.parse(self.getProblem(sessionToken, problem.id));
                //    problem.goals = problemResponse.goals;
                //});
            }
            
            return theResponse;
        } catch (e) {
            this._logError('GetCarePlan - Error: ' + e);
            return '{"error": "' + e.message + '"}';
        }
    },

    getProblem: function(sessionToken, problemId) {
        try {
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                return '{"error": "Configuration invalid"}';
            }
            
            var endpoint = this._buildEndpoint('/careflow/careplan/problem/' + problemId);
            var r = this._createRESTMessage('GET Problem', endpoint);
            
            var response = this._executeRequestWithRetry(r, 'GetProblem', sessionToken);
            return response.getBody();
        } catch (e) {
            this._logError('GetProblem - Error: ' + e);
            return '{"error": "' + e.message + '"}';
        }
    },

    addInterventions: function(interventionPayload, sessionToken) {
        try {
            this._log("API Call - Starting POST Interventions request", false);
            
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                throw new Error("Configuration invalid");
            }
            
            var endpoint = this._buildEndpoint('/careflow/session/interventions');
            var r = this._createRESTMessage('POST Interventions', endpoint);
            
            // Log payload size for debugging
            var payloadSize = JSON.stringify(interventionPayload).length;
            this._log("API Call - Setting request body with payload size: " + payloadSize + " characters", false);
            
            r.setRequestBody(JSON.stringify(interventionPayload));
            
            var response = this._executeRequestWithRetry(r, 'AddInterventions', sessionToken);
            return response.getStatusCode();
        } catch (error) {
            this._logError("API Call - Unhandled exception: " + error);
            // Return error details in a structured format
            return JSON.stringify({
                error: true,
                message: "Error calling CareIQ API: " + error.message,
                details: error.toString()
            });
        }
    },

	updateCarePlanStatus: function(sessionToken, status) {
		try {
            this._log("API Call - Starting POST Care Plan Status request", false);

			var config = this._getConfig();
			
			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}
			
			var endpoint = this._buildEndpoint('/careflow/session/careplan/status');
			var r = this._createRESTMessage('POST Care Plan Status', endpoint);
			
			var requestBody = {
				status: status
			};
			
			r.setRequestBody(JSON.stringify(requestBody));
			
			var response = this._executeRequestWithRetry(r, 'UpdateCarePlanStatus', sessionToken);
			return response.getBody();
		} catch (e) {
			this._logError('UpdateCarePlanStatus - Error: ' + e);
			return '{"error": "' + e.message + '"}';
		}
	},

    addBarriers: function(barrierPayload, sessionToken) {
        try {
            this._log("API Call - Starting POST Barriers request", false);
            
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                throw new Error("Configuration invalid");
            }
            
            var endpoint = this._buildEndpoint('/careflow/session/barriers');
            var r = this._createRESTMessage('POST Barriers', endpoint);
            
            // Log payload size for debugging
            var payloadSize = JSON.stringify(barrierPayload).length;
            this._log("API Call - Setting request body with payload size: " + payloadSize + " characters", false);
            
            r.setRequestBody(JSON.stringify(barrierPayload));
            
            var response = this._executeRequestWithRetry(r, 'AddBarriers', sessionToken);
            return response.getStatusCode();
        } catch (error) {
            this._logError("API Call - Unhandled exception: " + error);
            // Return error details in a structured format
            return JSON.stringify({
                error: true,
                message: "Error calling CareIQ API: " + error.message,
                details: error.toString()
            });
        }
    },

	createRecord: function(tableName, recordObject) {
		try {
			this._log('CreateRecord - Starting record creation for table: ' + tableName, false);
			
			// Validate input parameters
			if (!tableName || typeof tableName !== 'string') {
				this._logError('CreateRecord - Invalid table name provided');
				return '{"error": "Invalid table name provided"}';
			}
			
			if (!recordObject || typeof recordObject !== 'object') {
				this._logError('CreateRecord - Invalid record object provided');
				return '{"error": "Invalid record object provided"}';
			}
			
			// Log the record object size for debugging
			var recordSize = JSON.stringify(recordObject).length;
			this._log('CreateRecord - Record object size: ' + recordSize + ' characters', false);
			
			// Create new GlideRecord for the specified table
			var gr = new GlideRecord(tableName);
			
			// Set all field values from the record object
			var fieldCount = 0;
			for (var field in recordObject) {
				if (recordObject.hasOwnProperty(field)) {
					gr.setValue(field, recordObject[field]);
					fieldCount++;
					this._log('CreateRecord - Set field "' + field + '" with value type: ' + typeof recordObject[field], false);
				}
			}
			
			this._log('CreateRecord - Set ' + fieldCount + ' fields on record', false);
			
			// Insert the record
			var newRecordId = gr.insert();
			
			if (newRecordId) {
				this._log('CreateRecord - Record created successfully with ID: ' + newRecordId, false);
				
				// Return success response with the new record ID
				return JSON.stringify({
					success: true,
					sys_id: newRecordId,
					table: tableName,
					message: 'Record created successfully'
				});
			} else {
				this._logError('CreateRecord - Failed to create record in table: ' + tableName);
				return JSON.stringify({
					error: true,
					message: 'Failed to create record',
					table: tableName
				});
			}
			
		} catch (error) {
			this._logError('CreateRecord - Unhandled exception: ' + error);
			
			// Return error details in a structured format
			return JSON.stringify({
				error: true,
				message: 'Error creating record: ' + error.message,
				details: error.toString(),
				table: tableName || 'unknown'
			});
		}
	},

	queryRecords: function(tableName, fieldsObject, systemId) {
		try {
			this._log('QueryRecords - Starting query for table: ' + tableName, false);
			
			// Validate input parameters
			if (!tableName || typeof tableName !== 'string') {
				this._logError('QueryRecords - Invalid table name provided');
				return '{"error": "Invalid table name provided"}';
			}
			
			// Parse fieldsObject if it's a string
			var parsedFieldsObject;
			try {
				if (typeof fieldsObject === 'string') {
					parsedFieldsObject = JSON.parse(fieldsObject);
					this._log('QueryRecords - Parsed fieldsObject from string', false);
				} else if (typeof fieldsObject === 'object' && fieldsObject !== null) {
					parsedFieldsObject = fieldsObject;
				} else {
					this._logError('QueryRecords - Invalid fields object provided - not string or object');
					return '{"error": "Invalid fields object provided"}';
				}
			} catch (parseError) {
				this._logError('QueryRecords - Failed to parse fieldsObject JSON: ' + parseError);
				return '{"error": "Invalid JSON in fields object"}';
			}
			
			// Extract fields to return and query conditions
			var fieldsToReturn = parsedFieldsObject.fields || [];
			var queryConditions = parsedFieldsObject.query || {};
			var orderBy = parsedFieldsObject.orderBy || '';
			var limit = parsedFieldsObject.limit || 0;
			
			this._log('QueryRecords - Fields to return: ' + fieldsToReturn.join(', '), false);
			this._log('QueryRecords - Query conditions: ' + JSON.stringify(queryConditions), false);
			
			// Log systemId if provided
			if (systemId) {
				this._log('QueryRecords - System ID filter: ' + systemId, false);
			}
			
			// Create GlideRecord for the specified table
			var gr = new GlideRecord(tableName);
			
			// Add systemId query condition first if provided
			if (systemId && typeof systemId === 'string' && systemId.trim() !== '') {
				gr.addQuery('sys_id', systemId.trim());
				this._log('QueryRecords - Added sys_id query condition: ' + systemId.trim(), false);
			}
			
			// Add other query conditions
			var conditionCount = 0;
			for (var field in queryConditions) {
				if (queryConditions.hasOwnProperty(field)) {
					gr.addQuery(field, queryConditions[field]);
					conditionCount++;
					this._log('QueryRecords - Added query condition: ' + field + ' = ' + queryConditions[field], false);
				}
			}
			
			// Add order by if specified
			if (orderBy) {
				gr.orderBy(orderBy);
				this._log('QueryRecords - Added order by: ' + orderBy, false);
			}
			
			// Set limit if specified
			if (limit > 0) {
				gr.setLimit(limit);
				this._log('QueryRecords - Set limit: ' + limit, false);
			}
			
			// Execute query
			gr.query();
			
			var records = [];
			var recordCount = 0;
			
			// Process results
			while (gr.next()) {
				var record = {};
				
				// If no specific fields requested, return all accessible fields
				if (fieldsToReturn.length === 0) {
					// Get all field names for this table
					var elements = gr.getElements();
					for (var i = 0; i < elements.size(); i++) {
						var element = elements.get(i);
						var fieldName = element.getName();
						record[fieldName] = gr.getDisplayValue(fieldName);
					}
				} else {
					// Return only specified fields
					for (var j = 0; j < fieldsToReturn.length; j++) {
						var fieldName = fieldsToReturn[j];
						if (gr.isValidField(fieldName)) {
							record[fieldName] = gr.getDisplayValue(fieldName);
						} else {
							this._log('QueryRecords - Warning: Field "' + fieldName + '" does not exist in table "' + tableName + '"', true);
						}
					}
				}
				
				// Always include sys_id for record identification
				record.sys_id = gr.getUniqueValue();
				
				records.push(record);
				recordCount++;
			}
			
			this._log('QueryRecords - Retrieved ' + recordCount + ' records from table: ' + tableName, false);
			
			// Return success response with records
			return JSON.stringify({
				success: true,
				table: tableName,
				recordCount: recordCount,
				records: records,
				systemId: systemId || null,
				message: 'Query executed successfully'
			});
			
		} catch (error) {
			this._logError('QueryRecords - Unhandled exception: ' + error);
			
			// Return error details in a structured format
			return JSON.stringify({
				error: true,
				message: 'Error querying records: ' + error.message,
				details: error.toString(),
				table: tableName || 'unknown',
				systemId: systemId || null
			});
		}
	},

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
			var r = this._createRESTMessage('Generic Typeahead Search (' + contentType + ')', endpoint);
			
			var response = this._executeRequestWithRetry(r, 'GenericTypeahead_' + contentType);
			return response.getBody();
		} catch (e) {
			this._logError('GenericTypeahead (' + contentType + ') - Error: ' + e);
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

    type: 'CareIQServices'
});