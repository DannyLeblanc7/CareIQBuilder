import {createCustomElement, actionTypes} from '@servicenow/ui-core';
import {createHttpEffect} from '@servicenow/ui-effect-http';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';
import packageJson from '../../package.json';

const {COMPONENT_BOOTSTRAPPED} = actionTypes;

// Load CareIQ config using dispatch action
const loadCareIQConfig = (dispatch) => {
	console.log('Dispatching LOAD_CAREIQ_CONFIG action...');
	dispatch('LOAD_CAREIQ_CONFIG');
};

const view = (state, {updateState, dispatch}) => {
	console.log('Component rendered with state:', state);
	
	return (
		<div className="careiq-builder">
			<h1>CareIQ Builder</h1>
			<p>Component that connects to the CareIQ platform for creating and maintaining assessments.</p>
			
			{state.loading && <p className="loading">🔄 Loading CareIQ configuration...</p>}
			{state.error && (
				<div className="error">
					❌ <strong>Configuration Error:</strong><br/>
					{state.error}
				</div>
			)}
			{state.careiqConfig && (
				<div className="config-status">
					✅ <strong>Connected to CareIQ Platform</strong>
					<p>API Key: {state.careiqConfig.apikey}</p>
					<p>App: {state.careiqConfig.app}</p>
					<p>ID: {state.careiqConfig.id}</p>
					<p>OAuth Token: {state.careiqConfig.otoken}</p>
					<p>Region: {state.careiqConfig.region}</p>
					<p>Version: {state.careiqConfig.version}</p>
					{state.accessToken && <p>Token: {state.accessToken}</p>}
				</div>
			)}
			
			<p>You might want to read the <a href="https://developer.servicenow.com/dev.do#!/reference/next-experience/latest/ui-framework/getting-started/introduction">documentation</a> on the ServiceNow developer site.</p>
			<div className="version-display">v{packageJson.version}</div>
		</div>
	);
};

createCustomElement('cadal-careiq-builder', {
	renderer: {type: snabbdom},
	view,
	styles,
	initialState: {
		loading: false,
		error: null,
		careiqConfig: null,
		configLoadAttempted: false,
		accessToken: null
	},
	actionHandlers: {
		[COMPONENT_BOOTSTRAPPED]: (coeffects) => {
			const {dispatch} = coeffects;
			console.log('Component bootstrapped - auto-loading CareIQ config');
			dispatch('LOAD_CAREIQ_CONFIG');
		},
		
		'LOAD_CAREIQ_CONFIG': createHttpEffect('/api/now/table/sys_properties', {
			method: 'GET',
			queryParams: {
				// Real CareIQ properties query
				sysparm_query: 'nameLIKEx_1628056_careiq.careiq.platform',
				sysparm_fields: 'name,value'
			},
			startActionType: 'CAREIQ_CONFIG_FETCH_START',
			successActionType: 'CAREIQ_CONFIG_FETCH_SUCCESS',
			errorActionType: 'CAREIQ_CONFIG_FETCH_ERROR'
		}),

		'CAREIQ_CONFIG_FETCH_START': (coeffects) => {
			const {updateState} = coeffects;
			updateState({loading: true, error: null});
		},
		
		'CAREIQ_CONFIG_FETCH_SUCCESS': (coeffects) => {
			const {action, updateState, dispatch} = coeffects;
			console.log('HTTP Effect Success:', action.payload);
			
			// Map the results to our config object
			const props = {};
			if (action.payload.result) {
				action.payload.result.forEach(prop => {
					const key = prop.name.replace('x_1628056_careiq.careiq.platform.', '');
					props[key] = prop.value;
				});
			}
			
			console.log('Mapped properties:', props);
			
			// Check which required properties are missing
			const required = ['apikey', 'app', 'id', 'otoken', 'region', 'version'];
			const missing = required.filter(key => !props[key] || props[key].trim() === '');
			
			if (missing.length > 0) {
				console.log('Setting loading to false - missing properties');
				updateState({
					loading: false,
					error: `Missing system properties: ${missing.map(p => 'x_1628056_careiq.careiq.platform.' + p).join(', ')}`
				});
			} else {
				console.log('Setting loading to false - success');
				updateState({
					loading: false,
					error: null,
					careiqConfig: props
				});
				// Automatically exchange token after config success
				console.log('About to dispatch EXCHANGE_TOKEN with config:', {
					region: props.region,
					version: props.version,
					apikey: props.apikey ? '***' : 'missing',
					otoken: props.otoken ? '***' : 'missing',
					id: props.id ? '***' : 'missing'
				});
				dispatch('EXCHANGE_TOKEN', {config: props});
			}
		},
		
		'CAREIQ_CONFIG_FETCH_ERROR': (coeffects) => {
			const {action, updateState} = coeffects;
			console.error('HTTP Effect Error:', action.payload);
			console.log('Setting loading to false - error');
			updateState({
				loading: false,
				error: 'Failed to fetch system properties: ' + (action.payload?.message || 'Unknown error')
			});
		},

		'EXCHANGE_TOKEN': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {config} = action.payload;
			
			console.log('EXCHANGE_TOKEN handler called with config:', {
				region: config.region,
				version: config.version,
				apikey: config.apikey ? '***' : 'missing',
				otoken: config.otoken ? '***' : 'missing',
				id: config.id ? '***' : 'missing'
			});
			
			const requestBody = JSON.stringify({
				region: config.region,
				version: config.version,
				apikey: config.apikey,
				otoken: config.otoken,
				client_id: config.id
			});
			
			console.log('Request body to send:', requestBody);
			
			// Dispatch the HTTP effect with the request body data
			dispatch('MAKE_TOKEN_REQUEST', {requestBody: requestBody});
		},

		'MAKE_TOKEN_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/token-exchange', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'TOKEN_EXCHANGE_SUCCESS',
			errorActionType: 'TOKEN_EXCHANGE_ERROR'
		}),

		'TOKEN_EXCHANGE_SUCCESS': (coeffects) => {
			const {action, updateState} = coeffects;
			console.log('Token Exchange Success - Full Response:', action.payload);
			// Use either access_token (real) or mock_access_token (debug)
			const token = action.payload.access_token || action.payload.mock_access_token;
			console.log('Access Token:', token);
			updateState({
				accessToken: token
			});
		},

		'TOKEN_EXCHANGE_ERROR': (coeffects) => {
			const {action, updateState} = coeffects;
			console.error('Token Exchange Error - Full Response:', action.payload);
			console.error('Error Details:', JSON.stringify(action.payload, null, 2));
			updateState({
				error: 'Failed to exchange token: ' + (action.payload?.message || 'Unknown error')
			});
		}
	},
	reducers: {}
});