var CareIQExperienceServices = Class.create();
CareIQExperienceServices.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {
    // Configuration and utility methods
    _isDebugEnabled: function() {
        return gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';
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
            token: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.token'),
            app: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.app'),
            region: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.region'),
            version: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.version'),
            clientId: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.id'),
            oToken: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.otoken'),
            apiKey: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.apikey')
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
        var r = new sn_ws.RESTMessageV2('x_cadal_careiq_e_0.CareIQ Experience REST Calls', name);
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
                var response = request.execute();
                var statusCode = response.getStatusCode();
                lastStatusCode = statusCode;
                                
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
            
            // Process each section
            if (data.sections && Array.isArray(data.sections)) {
                
                for (var i = 0; i < data.sections.length; i++) {
                    var section = data.sections[i];
                    
                    // Only process if subsections exist and has more than 1 item
                    if (section.subsections && Array.isArray(section.subsections) && section.subsections.length > 1) {
                        
                        // Sort subsections by sort_order
                        section.subsections.sort(function(a, b) {
                            return parseInt(a.sort_order) - parseInt(b.sort_order);
                        });
                        
                    }
                }
            }
            
            // Convert back to JSON string with same formatting as input
            var result = JSON.stringify(data);
            
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
					var gr = new GlideRecordSecure('sys_properties');
					if (gr.isValid()) {  // ✅ Add validation
						gr.addQuery('name', 'x_cadal_careiq_e_0.careiq.platform.token');
						gr.query();
						
						if (gr.next()) {
							gr.value = token;
							gr.update();
							this._log('Auth - Token updated successfully', false);
						} else {
							this._logError('Auth - Token property not found');
						}
					} else {
						this._logError('Auth - Unable to access sys_properties table');
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
    getSections: function(gtId, token) {
        try {
			var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                return '{"error": "Configuration invalid"}';
            }
            
            var endpoint = this._buildEndpoint('/careflow/guideline-template/' + gtId);
            var r = this._createRESTMessage('Get Sections', endpoint);

            // Add token header if provided
            if (token) {
                r.setRequestHeader('token', token);
            }

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
            
            var config = this._getConfig();
            
            if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
                throw new Error("Configuration invalid");
            }
            
            var endpoint = this._buildEndpoint('/careflow/session/answers');
            var r = this._createRESTMessage('POST Answers', endpoint);
            
            // Log payload size for debugging
            var payloadSize = JSON.stringify(answerPayload).length;
            
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

    /*getCarePlan: function(sessionToken, problemsPerPage) {
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
    }, */

	getCarePlan: function(sessionToken) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the care plan endpoint: /careflow/session/careplan
			var endpoint = this._buildEndpoint('/careflow/session/careplan');
			var r = this._createRESTMessage('GET Care Plan', endpoint);

			// Set method to GET
			r.setHttpMethod('GET');

			// Add session token to header
			r.setRequestHeader('token', sessionToken);

			var response = this._executeRequestWithRetry(r, 'GetCarePlan');

			return response.getBody();
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
			
			// Validate table is within application scope for security
			if (!tableName.startsWith('x_cadal_careiq_e_0_')) {
				this._logError('CreateRecord - Table must be within application scope: ' + tableName);
				return JSON.stringify({
					error: true,
					message: 'Security error: Can only create records in application tables',
					table: tableName
				});
			}

			// Create new GlideRecord for the specified table
			var gr = new GlideRecordSecure(tableName);
			
			// ✅ Validate table exists
			if (!gr.isValid()) {
				this._logError('CreateRecord - Invalid table name: ' + tableName);
				return JSON.stringify({
					error: true,
					message: 'Invalid table name',
					table: tableName
				});
			}
			
			// Set all field values from the record object
			var fieldCount = 0;
			for (var field in recordObject) {
				if (recordObject.hasOwnProperty(field)) {
					// ✅ Validate field exists before setting
					if (gr.isValidField(field)) {
						gr.setValue(field, recordObject[field]);
						fieldCount++;
						this._log('CreateRecord - Set field "' + field + '" with value type: ' + typeof recordObject[field], false);
					} else {
						this._log('CreateRecord - Warning: Skipping invalid field "' + field + '"', true);
					}
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
			// Validate table is within application scope for security
			if (!tableName.startsWith('x_cadal_careiq_e_0_')) {
				this._logError('QueryRecords - Table must be within application scope: ' + tableName);
				return JSON.stringify({
					error: true,
					message: 'Security error: Can only query application tables',
					table: tableName
				});
			}			
			// Create GlideRecord for the specified table
			var gr = new GlideRecordSecure(tableName);

			if (!gr.isValid()) {
				this._logError('QueryRecords - Invalid table name: ' + tableName);
				return JSON.stringify({
					error: true,
					message: 'Invalid table name',
					table: tableName
				});
			}			
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
					//var elements = gr.getElements();
					//for (var i = 0; i < elements.size(); i++) {
					//	var element = elements.get(i);
					//	var fieldName = element.getName();
					var elements = gr.getElements();
					var elementCount = elements.size();
					for (var i = 0; i < elementCount; i++) {
						//var element = elements[i];  // Changed from .get(i) to [i]
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
				voice: questionData.voice || 'Patient',
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
			var validTypes = ['section', 'question', 'answer','problem','barrier','goal','intervention'];
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
				// Library question - include editable fields (tooltip, voice, required, alternative_wording)
				requestBody = {
					sort_order: sort_order || 0,
					library_id: library_id,
					tooltip: tooltip || '',
					voice: voice || 'Patient',
					required: required || false,
					alternative_wording: alternative_wording || ''
				};
				this._log('AddQuestionToSection - Using payload for library question: ' + library_id + ', required: ' + (required || false) + ', voice: ' + (voice || 'Patient') + ', tooltip length: ' + (tooltip ? tooltip.length : 0), false);
			} else {
				// Regular question - full payload
				requestBody = {
					tooltip: tooltip || '',
					alternative_wording: alternative_wording || '',
					sort_order: sort_order || 0,
					custom_attributes: custom_attributes || {},
					voice: voice || 'Patient',
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
	addBarrierRelationship: function(answerId, barrierName, barrierId, sortOrder, guidelineTemplateId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			var endpoint = this._buildEndpoint('/builder/barrier');
			var r = this._createRESTMessage('POST Barrier Relationship', endpoint);
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
			var r = this._createRESTMessage('DELETE Barrier Relationship', endpoint);
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
			var r = this._createRESTMessage('POST Problem Relationship', endpoint);
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
			var r = this._createRESTMessage('PATCH Problem Edits', endpoint);
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
			var r = this._createRESTMessage('GET Problem Details', endpoint);
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
			var r = this._createRESTMessage('DELETE Problem Relationship', endpoint);
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
			var r = this._createRESTMessage('GET Problem Goals', endpoint);
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
			var r = this._createRESTMessage('POST Goal to Problem', endpoint);
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
			var r = this._createRESTMessage('DELETE Goal', endpoint);
			r.setHttpMethod('DELETE');

			var response = this._executeRequestWithRetry(r, 'DeleteGoal');
			return response.getBody();
		} catch (e) {
			this._logError('DeleteGoal - Error: ' + e);
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
			var r = this._createRESTMessage('GET Goal Details', endpoint);
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
			var r = this._createRESTMessage('PATCH Update Goal', endpoint);
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
	getGoalInterventions: function(guidelineTemplateId, goalId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the goal interventions endpoint: /builder/guideline-template/{gtId}/goal/{goalId}/interventions
			var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(guidelineTemplateId) + '/goal/' + encodeURIComponent(goalId) + '/interventions');
			var r = this._createRESTMessage('GET Goal Interventions', endpoint);
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
			var r = this._createRESTMessage('POST Add Intervention', endpoint);
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
	deleteIntervention: function(goalId, interventionId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the delete intervention endpoint: /builder/goal/{goalId}/intervention/{interventionId}
			var endpoint = this._buildEndpoint('/builder/goal/' + encodeURIComponent(goalId) + '/intervention/' + encodeURIComponent(interventionId));
			var r = this._createRESTMessage('DELETE Intervention', endpoint);
			r.setHttpMethod('DELETE');

			var response = this._executeRequestWithRetry(r, 'DeleteIntervention');
			return response.getBody();
		} catch (e) {
			this._logError('DeleteIntervention - Error: ' + e);
			return '{"error": "' + e.message + '"}';
		}
	},
	createVersion: function(assessmentId, versionName, effectiveDate) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the create version endpoint
			var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(assessmentId) + '/status');
			var r = this._createRESTMessage('POST Create Version', endpoint);

			// Set method to PUT (for status endpoint)
			r.setHttpMethod('POST');

			// Set up the payload
			var payload = {
				status: "draft",
				effective_date: effectiveDate,
				version_name: versionName
			};

			this._log('Create Version - Endpoint: ' + endpoint);
			this._log('Create Version - Payload: ' + JSON.stringify(payload));

			r.setRequestBody(JSON.stringify(payload));
			r.setRequestHeader('Content-Type', 'application/json');

			var response = this._executeRequestWithRetry(r, 'CreateVersion');
			this._log('Create Version - Response: ' + response.getBody());

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
			var r = this._createRESTMessage('PATCH Update Assessment', endpoint);

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
			// Handle select_all_enabled (check both camelCase and snake_case)
			if (requestData.selectAllEnabled !== undefined) {
				payload.select_all_enabled = requestData.selectAllEnabled;
			} else if (requestData.select_all_enabled !== undefined) {
				payload.select_all_enabled = requestData.select_all_enabled;
			}
			// Handle response logging settings
			if (requestData.responseLogging !== undefined) {
				payload.settings = {
					store_responses: requestData.responseLogging
				};
			}

			this._log('Update Assessment - Endpoint: ' + endpoint);
			this._log('Update Assessment - Payload: ' + JSON.stringify(payload));

			r.setRequestBody(JSON.stringify(payload));
			r.setRequestHeader('Content-Type', 'application/json');

			var response = this._executeRequestWithRetry(r, 'UpdateAssessment');
			this._log('Update Assessment - Response: ' + response.getBody());

			return response.getBody();
		} catch (e) {
			this._logError('UpdateAssessment - Error: ' + e);
			return '{"error": "' + e.message + '"}';
		}
	},
	publishAssessment: function(requestData) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the publish endpoint: /builder/guideline-template/{assessmentId}/status
			var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(requestData.assessmentId) + '/status');
			var r = this._createRESTMessage('POST Publish Assessment', endpoint);

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
				"version_name": requestData.versionTitle || "string"
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
	getInterventionDetails: function(interventionId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			var endpoint = this._buildEndpoint('/builder/intervention/' + encodeURIComponent(interventionId));
			var r = this._createRESTMessage('GET Intervention Details', endpoint);
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
        var r = this._createRESTMessage('PATCH Update Intervention', endpoint);
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
	createScoringModel: function(guidelineTemplateId, label, scoringType) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			var endpoint = this._buildEndpoint('/builder/scoring_model');
			var r = this._createRESTMessage('POST Create Scoring Model', endpoint);
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
			var r = this._createRESTMessage('GET Scoring Models', endpoint);
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
			var r = this._createRESTMessage('DELETE Scoring Model', endpoint);
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
			var r = this._createRESTMessage('PATCH Save Scoring Model Value', endpoint);
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
	createQuestionBundle: function(contentId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the question bundle endpoint
			var endpoint = this._buildEndpoint('/builder/library/question/bundle');
			var r = this._createRESTMessage('POST Create Question Bundle', endpoint);

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
			var r = this._createRESTMessage('POST Create Problem Bundle', endpoint);

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
	unpublishAssessment: function(guidelineTemplateId) {
		try {
			var config = this._getConfig();

			if (!this._validateConfig(config, ['token', 'app', 'region', 'version'])) {
				return '{"error": "Configuration invalid"}';
			}

			// Build the unpublish endpoint: /builder/guideline-template/{guidelineTemplateId}/status
			var endpoint = this._buildEndpoint('/builder/guideline-template/' + encodeURIComponent(guidelineTemplateId) + '/status');
			var r = this._createRESTMessage('POST Unpublish Assessment', endpoint);

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
	type: 'CareIQExperienceServices'
});