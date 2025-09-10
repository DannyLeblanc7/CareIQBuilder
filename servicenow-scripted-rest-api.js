/**
 * ServiceNow Scripted REST API: Use Case Categories
 * 
 * API Path: /api/x_cadal_careiq_b_0/careiq_api/use-case-categories
 * HTTP Method: GET
 * 
 * This endpoint fetches use case categories from the CareIQ platform
 * and returns them to the client-side component.
 */

(function process(/*RESTAPIRequest*/ request, /*RESTAPIResponse*/ response) {
    
    try {
        // Get the use_case query parameter
        var useCase = request.queryParams.use_case;
        
        if (!useCase) {
            response.setStatus(400);
            response.setBody({
                error: 'Missing required parameter: use_case'
            });
            return;
        }
        
        gs.log('CareIQ API: Fetching use case categories for use_case: ' + useCase, 'CareIQ_UseCaseCategories');
        
        // Get CareIQ configuration from system properties
        var careiqConfig = getCareIQConfig();
        if (!careiqConfig.success) {
            response.setStatus(500);
            response.setBody({
                error: 'Failed to load CareIQ configuration: ' + careiqConfig.error
            });
            return;
        }
        
        gs.log('CareIQ API: Configuration loaded successfully', 'CareIQ_UseCaseCategories');
        
        // Get access token from CareIQ
        var tokenResult = exchangeCareIQToken(careiqConfig.config);
        if (!tokenResult.success) {
            response.setStatus(401);
            response.setBody({
                error: 'Failed to authenticate with CareIQ: ' + tokenResult.error
            });
            return;
        }
        
        gs.log('CareIQ API: Token exchange successful', 'CareIQ_UseCaseCategories');
        
        // Make request to CareIQ platform for use case categories
        var categoriesResult = fetchUseCaseCategories(careiqConfig.config, tokenResult.accessToken, useCase);
        if (!categoriesResult.success) {
            response.setStatus(500);
            response.setBody({
                error: 'Failed to fetch use case categories: ' + categoriesResult.error
            });
            return;
        }
        
        gs.log('CareIQ API: Use case categories fetched successfully. Count: ' + 
               (categoriesResult.data.use_case_categories ? categoriesResult.data.use_case_categories.length : 0), 
               'CareIQ_UseCaseCategories');
        
        // Return the categories data
        response.setStatus(200);
        response.setBody(categoriesResult.data);
        
    } catch (ex) {
        gs.error('CareIQ API: Unexpected error in use-case-categories endpoint: ' + ex.getMessage(), 'CareIQ_UseCaseCategories');
        response.setStatus(500);
        response.setBody({
            error: 'Internal server error: ' + ex.getMessage()
        });
    }

    /**
     * Get CareIQ configuration from system properties
     */
    function getCareIQConfig() {
        try {
            var props = {};
            var required = ['apikey', 'app', 'id', 'otoken', 'region', 'version'];
            var missing = [];
            
            // Fetch all required properties
            for (var i = 0; i < required.length; i++) {
                var propName = 'x_1628056_careiq.careiq.platform.' + required[i];
                var value = gs.getProperty(propName, '').trim();
                
                if (!value) {
                    missing.push(propName);
                } else {
                    props[required[i]] = value;
                }
            }
            
            if (missing.length > 0) {
                return {
                    success: false,
                    error: 'Missing system properties: ' + missing.join(', ')
                };
            }
            
            return {
                success: true,
                config: props
            };
            
        } catch (ex) {
            return {
                success: false,
                error: 'Error reading system properties: ' + ex.getMessage()
            };
        }
    }
    
    /**
     * Exchange credentials for CareIQ access token
     */
    function exchangeCareIQToken(config) {
        try {
            // Prepare token exchange request
            var tokenUrl = 'https://app.' + config.region + '.careiq.cadalysapp.com/api/' + config.version + '/auth/token';
            var requestBody = {
                region: config.region,
                version: config.version,
                apikey: config.apikey,
                otoken: config.otoken,
                client_id: config.id
            };
            
            gs.log('CareIQ API: Requesting token from: ' + tokenUrl, 'CareIQ_UseCaseCategories');
            
            // Create HTTP request
            var request = new sn_ws.RESTMessageV2();
            request.setEndpoint(tokenUrl);
            request.setHttpMethod('POST');
            request.setRequestHeader('Content-Type', 'application/json');
            request.setRequestBody(JSON.stringify(requestBody));
            
            // Execute request
            var response = request.execute();
            var responseBody = response.getBody();
            var httpStatus = response.getStatusCode();
            
            gs.log('CareIQ API: Token exchange response status: ' + httpStatus, 'CareIQ_UseCaseCategories');
            
            if (httpStatus !== 200) {
                return {
                    success: false,
                    error: 'Token exchange failed with status ' + httpStatus + ': ' + responseBody
                };
            }
            
            var tokenData = JSON.parse(responseBody);
            var accessToken = tokenData.access_token || tokenData.mock_access_token;
            
            if (!accessToken) {
                return {
                    success: false,
                    error: 'No access token in response: ' + responseBody
                };
            }
            
            return {
                success: true,
                accessToken: accessToken
            };
            
        } catch (ex) {
            return {
                success: false,
                error: 'Token exchange error: ' + ex.getMessage()
            };
        }
    }
    
    /**
     * Fetch use case categories from CareIQ platform
     */
    function fetchUseCaseCategories(config, accessToken, useCase) {
        try {
            // Build CareIQ API URL
            var apiUrl = 'https://app.' + config.region + '.careiq.cadalysapp.com/api/' + config.version + '/builder/use-case-category';
            
            gs.log('CareIQ API: Fetching categories from: ' + apiUrl + '?use_case=' + useCase, 'CareIQ_UseCaseCategories');
            
            // Create HTTP request
            var request = new sn_ws.RESTMessageV2();
            request.setEndpoint(apiUrl + '?use_case=' + encodeURIComponent(useCase));
            request.setHttpMethod('GET');
            request.setRequestHeader('Authorization', 'Bearer ' + accessToken);
            request.setRequestHeader('Content-Type', 'application/json');
            
            // Execute request
            var response = request.execute();
            var responseBody = response.getBody();
            var httpStatus = response.getStatusCode();
            
            gs.log('CareIQ API: Categories response status: ' + httpStatus, 'CareIQ_UseCaseCategories');
            
            if (httpStatus !== 200) {
                return {
                    success: false,
                    error: 'CareIQ API request failed with status ' + httpStatus + ': ' + responseBody
                };
            }
            
            var categoriesData = JSON.parse(responseBody);
            
            // Validate response structure
            if (!categoriesData.use_case_categories || !Array.isArray(categoriesData.use_case_categories)) {
                return {
                    success: false,
                    error: 'Invalid response format from CareIQ API: ' + responseBody
                };
            }
            
            return {
                success: true,
                data: categoriesData
            };
            
        } catch (ex) {
            return {
                success: false,
                error: 'Categories fetch error: ' + ex.getMessage()
            };
        }
    }
    
})(request, response);