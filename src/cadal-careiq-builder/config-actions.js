// Configuration Actions for CareIQ Builder Component
// Handles CareIQ config loading and use case categories

export const configActions = {
	'CAREIQ_CONFIG_FETCH_START': (coeffects) => {
		const {updateState, state} = coeffects;
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
		const props = action.payload || {};
		const required = ['app', 'region', 'version'];
		const missing = required.filter(key => !props[key] || props[key].trim() === '');

		if (missing.length > 0) {
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
			dispatch('FETCH_USE_CASE_CATEGORIES', {config: props});
		}
	},

	'CAREIQ_CONFIG_FETCH_ERROR': (coeffects) => {
		const {action, updateState} = coeffects;
		updateState({
			loading: false,
			error: action.payload?.error || action.payload?.message || 'Failed to load CareIQ configuration',
			configLoadAttempted: true,
			careiqConfig: null
		});
	},

	'FETCH_USE_CASE_CATEGORIES': (coeffects) => {
		const {dispatch, updateState, state} = coeffects;
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
		dispatch('MAKE_USE_CASE_CATEGORIES_REQUEST', {requestBody: requestBody});
	},

	'USE_CASE_CATEGORIES_FETCH_START': (coeffects) => {
		const {updateState} = coeffects;
		updateState({categoriesLoading: true});
	},

	'USE_CASE_CATEGORIES_SUCCESS': (coeffects) => {
		const {action, updateState, dispatch, state} = coeffects;
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
		dispatch('FETCH_ASSESSMENTS', {
			offset: 0,
			limit: state.assessmentsPagination?.apiLimit || 1000,  // Use 1000 as fallback
			useCase: 'CM',
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