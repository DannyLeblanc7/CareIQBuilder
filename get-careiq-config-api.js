(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var careiqServices = new x_cadal_careiq_e_0.CareIQExperienceServices();
        var isDebugEnabled = careiqServices.getGlobalDebugSetting();

        if (isDebugEnabled) {
            gs.info('=== CareIQ Config API ===');
            gs.info('Request method: ' + request.httpMethod);
        }

        // Use CareIQ Services to get config (queries custom table)
        var config = careiqServices.getPublicConfig();

        if (isDebugEnabled) {
            gs.info('Config properties found: ' + JSON.stringify(config));
        }

        // Check if config has error
        if (config.error) {
            response.setStatus(500);
            response.setHeader('Content-Type', 'application/json');
            response.getStreamWriter().writeString(JSON.stringify(config));
            return;
        }

        // Return the config
        response.setStatus(200);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString(JSON.stringify(config));

    } catch (e) {
        // Safe error handling - avoid accessing potentially restricted properties
        var errorMsg = 'Unexpected server error occurred';
        try {
            if (e && typeof e.toString === 'function') {
                errorMsg = e.toString();
            }
        } catch (innerE) {
            errorMsg = 'Server error occurred';
        }

        gs.error('CareIQ Config Error: ' + errorMsg);
        response.setStatus(500);
        response.setHeader('Content-Type', 'application/json');
        response.getStreamWriter().writeString('{"error": "' + errorMsg + '"}');
    }
})(request, response);
