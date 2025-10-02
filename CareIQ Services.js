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
            gs.info('DANNY TEST');
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
            if(sessionToken != null) {
				r.setRequestHeader('token', sessionToken);
			}

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
	//The following methods are for the CareIQ Builder application
	getBuilderSectionQuestions: function(sectionId) {
		try {
			var config = this._getConfig();
        
			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}
        
			var endpoint = this._buildEndpoint('/builder/section/' + encodeURIComponent(sectionId));
			var r = this._createRESTMessage('Get Builder Section Questions', endpoint);
        
			var response = this._executeRequestWithRetry(r, 'BuilderGetSectionQuestions');
			return response.getBody();
		} catch (e) {
			this._logError('GetSectionQuestions - Error: ' + e);
			return '{"error": "' + e.message + '"}';
		}
	},
	builderAddSection: function(sectionData) {
		try {
			gs.info('DANNY');
			var config = this._getConfig();
			
			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}
			
			var endpoint = this._buildEndpoint('/builder/section');
			var r = this._createRESTMessage('POST Builder Add Section', endpoint);
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
			
			var response = this._executeRequestWithRetry(r, 'BuilderAddSection');
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
			var r = this._createRESTMessage('PATCH Builder Update Section', endpoint);
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
			
			var response = this._executeRequestWithRetry(r, 'BuilderUpdateSection');
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
			var r = this._createRESTMessage('Get Builder Answer Relationships', endpoint);
			
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
			var r = this._createRESTMessage('POST Add Answer', endpoint);
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
			var r = this._createRESTMessage('DELETE Answer', endpoint);
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
			var r = this._createRESTMessage('DELETE Question', endpoint);
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
			var r = this._createRESTMessage('PATCH Update Question', endpoint);
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
			var r = this._createRESTMessage('PATCH Update Answer', endpoint);
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
	builderGenericTypeahead: function(contentType, searchText) {
		try {
			var config = this._getConfig();
			
			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}
			
			// Validate content type
			var validTypes = ['section', 'question', 'answer','problem','barrier'];
			if (validTypes.indexOf(contentType) === -1) {
				return '{"error": "Invalid content type: ' + contentType + '"}';
			}
			
			// Build the typeahead endpoint with content type and search text
			var endpoint = this._buildEndpoint('/builder/' + contentType + '/typeahead?text=' + encodeURIComponent(searchText));
			var r = this._createRESTMessage('GET Generic Typeahead Search', endpoint);
			
			var response = this._executeRequestWithRetry(r, 'GenericTypeahead_' + contentType);
			return response.getBody();
		} catch (e) {
			this._logError('GenericTypeahead (' + contentType + ') - Error: ' + e);
			return '{"error": "' + e.message + '"}';
		}
	},
	addBranchQuestion: function(answerId, questionId) {
		try {
			var config = this._getConfig();
			
			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}
			
			// Build the branch question endpoint
			var endpoint = this._buildEndpoint('/builder/answer/' + answerId + '/branch-question');
			var r = this._createRESTMessage('POST Add Branch Question', endpoint);
			
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
	getGuidelineTypeahead: function(searchText) {
		try {
			var config = this._getConfig();
			
			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}
			
			// Build the guideline typeahead endpoint with query parameter
			var endpoint = this._buildEndpoint('/builder/guideline-template/typeahead?text=' + encodeURIComponent(searchText));
			var r = this._createRESTMessage('GET Guideline Typeahead', endpoint);
			
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
	addGuidelineRelationship: function(answerId, guidelineId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the guideline relationship endpoint with answer_id parameter
			var endpoint = this._buildEndpoint('/builder/answer/' + answerId + '/guideline-template');
			var r = this._createRESTMessage('POST Add Guideline Relationship', endpoint);

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
	getQuestionTypeahead: function(searchText) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the question typeahead endpoint
			var endpoint = this._buildEndpoint('/builder/question/typeahead?text=' + encodeURIComponent(searchText));
			var r = this._createRESTMessage('GET Question Typeahead', endpoint);

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
	builderAddQuestionToSection: function(sectionId, label, type, tooltip, alternative_wording, sort_order, custom_attributes, voice, required, available, has_quality_measures, library_id) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			var endpoint = this._buildEndpoint('/builder/section/' + encodeURIComponent(sectionId) + '/questions');
			var r = this._createRESTMessage('POST Add Question to Section', endpoint);
			r.setHttpMethod('POST');

			// Build request body matching the CareIQ API specification
			var requestBody;

			if (library_id) {
				// Library question - minimal payload (only sort_order and library_id)
				requestBody = {
					sort_order: sort_order || 0,
					library_id: library_id
				};
				this._log('AddQuestionToSection - Using minimal payload for library question: ' + library_id, false);
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
			var r = this._createRESTMessage('POST Add Answers to Question', endpoint);
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
	createQuestionBundle: function(contentId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			var endpoint = this._buildEndpoint('/builder/question-bundle');
			var r = this._createRESTMessage('POST Create Question Bundle', endpoint);
			r.setHttpMethod('POST');

			// Build request body with contentId (question UUID)
			var requestBody = {
				content_id: contentId
			};

			r.setRequestBody(JSON.stringify(requestBody));

			var response = this._executeRequestWithRetry(r, 'CreateQuestionBundle');
			return response.getBody();
		} catch (e) {
			this._logError('CreateQuestionBundle - Error: ' + e);
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
			var r = this._createRESTMessage('GET Answer Typeahead Search', endpoint);
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
			var r = this._createRESTMessage('GET Library Answer Details', endpoint);
			r.setHttpMethod('GET');

			var response = this._executeRequestWithRetry(r, 'GetLibraryAnswerDetails');
			return response.getBody();
		} catch (e) {
			this._logError('GetLibraryAnswerDetails - Error: ' + e);
			return '{"error": "' + e.message + '"}';
		}
	},
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
			var r = this._createRESTMessage('POST Create Assessment', endpoint);

			// Set method to POST
			r.setHttpMethod('POST');

			// Build request body for the CareIQ API
			var requestBody = {
				title: assessmentData.title,
				use_case: assessmentData.use_case,
				content_source: assessmentData.content_source,
				version_name: assessmentData.version_name,
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
	deleteGuidelineRelationship: function(answerId, guidelineId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			var endpoint = this._buildEndpoint('/builder/answer/' + encodeURIComponent(answerId) + '/guideline-template/' + encodeURIComponent(guidelineId));
			var r = this._createRESTMessage('DELETE Guideline Relationship', endpoint);
			r.setHttpMethod('DELETE');

			var response = this._executeRequestWithRetry(r, 'DeleteGuidelineRelationship');
			return response.getBody();
		} catch (e) {
			this._logError('DeleteGuidelineRelationship - Error: ' + e);
			return '{"error": "' + e.message + '"}';
		}
	},
	type: 'CareIQServices'
});