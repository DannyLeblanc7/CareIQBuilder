// Configuration Actions for CareIQ Builder Component
// Handles CareIQ config loading, token exchange, and use case categories

export const configActions = {
	// CareIQ Configuration Loading
	'CAREIQ_CONFIG_FETCH_START': (coeffects) => {
		const {updateState} = coeffects;
		updateState({loading: true, error: null});
	},

	'CAREIQ_CONFIG_FETCH_SUCCESS': (coeffects) => {
		const {action, updateState, dispatch} = coeffects;
		// Map the results to our config object
		const props = {};
		if (action.payload.result) {
			action.payload.result.forEach(prop => {
				const key = prop.name.replace('x_1628056_careiq.careiq.platform.', '');
				props[key] = prop.value;
			});
		}
		// Check which required properties are missing
		const required = ['apikey', 'app', 'id', 'otoken', 'region', 'version'];
		const missing = required.filter(key => !props[key] || props[key].trim() === '');

		if (missing.length > 0) {
			updateState({
				loading: false,
				error: `Missing required CareIQ configuration properties: ${missing.join(', ')}. Please configure these in System Properties.`,
				configLoadAttempted: true,
				careiqConfig: null
			});
		} else {
			updateState({
				loading: false,
				error: null,
				configLoadAttempted: true,
				careiqConfig: props
			});
			// Auto-proceed to token exchange
			dispatch('EXCHANGE_TOKEN', {config: props});
		}
	},

	'CAREIQ_CONFIG_FETCH_ERROR': (coeffects) => {
		const {action, updateState} = coeffects;
		console.error('HTTP Effect Error:', action.payload);
		updateState({
			loading: false,
			error: action.payload?.error || action.payload?.message || 'Failed to load CareIQ configuration',
			configLoadAttempted: true,
			careiqConfig: null
		});
	},

	// Token Exchange
	'EXCHANGE_TOKEN': (coeffects) => {
		const {action, dispatch} = coeffects;
		const {config} = action.payload;
		const requestBody = JSON.stringify({
			app: config.app,
			region: config.region,
			version: config.version,
			apikey: config.apikey,
			id: config.id,
			otoken: config.otoken
		});
		dispatch('MAKE_TOKEN_REQUEST', {requestBody: requestBody});
	},

	'TOKEN_EXCHANGE_SUCCESS': (coeffects) => {
		const {action, updateState, dispatch, state} = coeffects;
		// Use either access_token (real) or mock_access_token (debug)
		const token = action.payload.access_token || action.payload.mock_access_token;
		updateState({accessToken: token});

		// Auto-proceed to fetch use case categories
		dispatch('FETCH_USE_CASE_CATEGORIES', {
			config: state.careiqConfig,
			accessToken: token
		});
	},

	'TOKEN_EXCHANGE_ERROR': (coeffects) => {
		const {action, updateState} = coeffects;
		const errorMessage = action.payload?.detail ||
							action.payload?.message ||
							action.payload?.error ||
							'Unknown error';
		updateState({
			loading: false,
			error: 'Failed to exchange token: ' + errorMessage,
			accessToken: null
		});
	},

	// Use Case Categories
	'FETCH_USE_CASE_CATEGORIES': (coeffects) => {
		const {action, dispatch, updateState} = coeffects;
		const {config, accessToken} = action.payload;
		updateState({categoriesLoading: true});

		const requestBody = JSON.stringify({
			app: config.app,
			region: config.region,
			version: config.version,
			accessToken: accessToken,
			useCase: 'CM'
		});
		dispatch('MAKE_USE_CASE_CATEGORIES_REQUEST', {requestBody: requestBody});
	},

	'USE_CASE_CATEGORIES_FETCH_START': (coeffects) => {
		const {updateState} = coeffects;
		updateState({categoriesLoading: true});
	},

	'USE_CASE_CATEGORIES_SUCCESS': (coeffects) => {
		const {action, updateState, dispatch, state} = coeffects;
		updateState({
			categoriesLoading: false,
			useCaseCategories: action.payload
		});
		// Auto-load assessments after categories are loaded
		dispatch('FETCH_ASSESSMENTS', {
			offset: 0,
			limit: state.assessmentsPagination.apiLimit,
			useCase: 'CM',
			contentSource: 'Organization',
			searchValue: ''
		});
	},

	'USE_CASE_CATEGORIES_ERROR': (coeffects) => {
		const {action, updateState} = coeffects;
		const errorMessage = action.payload?.detail ||
							action.payload?.message ||
							action.payload?.error ||
							'Unknown error';
		updateState({
			categoriesLoading: false,
			error: 'Failed to load use case categories: ' + errorMessage,
			useCaseCategories: null
		});
	}
};