(function process(request, response) {
    try {
        // Check if debug logging is enabled
        var isDebugEnabled = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';

        if (isDebugEnabled) {
            gs.info('=== CareIQ Config API ===');
            gs.info('Request method: ' + request.httpMethod);
        }

        // Fetch only the 3 required properties
        var gr = new GlideRecordSecure('sys_properties');
        gr.addQuery('name', 'IN', 'x_cadal_careiq_e_0.careiq.platform.region,x_cadal_careiq_e_0.careiq.platform.version,x_cadal_careiq_e_0.careiq.platform.app');
        gr.query();

        var config = {};
        while (gr.next()) {
            var key = gr.getValue('name').replace('x_cadal_careiq_e_0.careiq.platform.', '');
            config[key] = gr.getValue('value');
        }

        if (isDebugEnabled) {
            gs.info('Config properties found: ' + JSON.stringify(config));
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
