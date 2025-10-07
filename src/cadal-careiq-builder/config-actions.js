// Configuration Actions for CareIQ Builder Component
// Handles CareIQ config loading, token exchange, and use case categories

export const configActions = {
	// CareIQ Configuration Loading
	'CAREIQ_CONFIG_FETCH_START': (coeffects) => {
		const {updateState, state} = coeffects;
		console.log('CAREIQ_CONFIG_FETCH_START called');
		updateState({
			loading: true,
			error: null,
			systemMessages: [
				...(state.systemMessages || []),
				{
					type: 'loading',
					message: 'Loading CareIQ configuration...',
					timestamp: new Date().toISOString()
				}
			]
		});
	},

	'CAREIQ_CONFIG_FETCH_SUCCESS': (coeffects) => {
		const {action, updateState, dispatch, state} = coeffects;
		console.log('CAREIQ_CONFIG_FETCH_SUCCESS called', action.payload);
		// The new API returns the config object directly
		const props = action.payload || {};
		console.log('Config props:', props);
		// Check which required properties are missing (only region, version, app)
		const required = ['app', 'region', 'version'];
		const missing = required.filter(key => !props[key] || props[key].trim() === '');

		if (missing.length > 0) {
			console.log('Missing config properties:', missing);
			updateState({
				loading: false,
				error: `Missing required CareIQ configuration properties: ${missing.join(', ')}. Please configure these in System Properties.`,
				configLoadAttempted: true,
				careiqConfig: null,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Missing required CareIQ configuration properties: ${missing.join(', ')}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		} else {
			console.log('Config loaded successfully, dispatching FETCH_USE_CASE_CATEGORIES');
			updateState({
				loading: false,
				error: null,
				configLoadAttempted: true,
				careiqConfig: props,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'CareIQ configuration loaded successfully',
						timestamp: new Date().toISOString()
					}
				]
			});
			// Auto-proceed to use case categories (token exchange handled server-side)
			dispatch('FETCH_USE_CASE_CATEGORIES', {config: props});
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

	// Use Case Categories (token exchange handled server-side)
	'FETCH_USE_CASE_CATEGORIES': (coeffects) => {
		const {dispatch, updateState, state} = coeffects;
		console.log('FETCH_USE_CASE_CATEGORIES called');
		updateState({
			categoriesLoading: true,
			systemMessages: [
				...(state.systemMessages || []),
				{
					type: 'loading',
					message: 'Loading use case categories...',
					timestamp: new Date().toISOString()
				}
			]
		});

		const requestBody = JSON.stringify({
			useCase: 'CM'
		});
		console.log('Dispatching MAKE_USE_CASE_CATEGORIES_REQUEST with body:', requestBody);
		dispatch('MAKE_USE_CASE_CATEGORIES_REQUEST', {requestBody: requestBody});
	},

	'USE_CASE_CATEGORIES_FETCH_START': (coeffects) => {
		const {updateState} = coeffects;
		console.log('USE_CASE_CATEGORIES_FETCH_START called');
		updateState({categoriesLoading: true});
	},

	'USE_CASE_CATEGORIES_SUCCESS': (coeffects) => {
		const {action, updateState, dispatch, state} = coeffects;
		console.log('USE_CASE_CATEGORIES_SUCCESS called', action.payload);
		const categories = action.payload?.use_case_categories || action.payload || [];
		updateState({
			categoriesLoading: false,
			useCaseCategories: categories,
			systemMessages: [
				...(state.systemMessages || []),
				{
					type: 'success',
					message: `Loaded ${categories.length} use case categories`,
					timestamp: new Date().toISOString()
				}
			]
		});
		// Auto-load assessments after categories are loaded
		console.log('Dispatching FETCH_ASSESSMENTS');
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