// Core UI Actions for CareIQ Builder Component
// Handles mobile view detection, panel toggles, and system message controls

export const coreActions = {
	// Mobile view detection for responsive behavior
	'CHECK_MOBILE_VIEW': (coeffects) => {
		const {updateState} = coeffects;
		// Increase threshold to catch dev tools scenarios (1342px in your case)
		const isMobile = window.innerWidth <= 1400;
		updateState({
			isMobileView: isMobile
		});
	},

	// Panel toggle actions for responsive layout
	'TOGGLE_SECTIONS_PANEL': (coeffects) => {
		const {updateState, state} = coeffects;
		updateState({
			sectionsPanelExpanded: !state.sectionsPanelExpanded
		});
	},

	'TOGGLE_QUESTIONS_PANEL': (coeffects) => {
		const {updateState, state} = coeffects;
		updateState({
			questionsPanelExpanded: !state.questionsPanelExpanded
		});
	},

	'TOGGLE_RELATIONSHIP_PANEL': (coeffects) => {
		const {updateState, state} = coeffects;
		updateState({
			relationshipPanelOpen: !state.relationshipPanelOpen
		});
	},

	// System messages controls
	'TOGGLE_SYSTEM_MESSAGES': (coeffects) => {
		const {updateState, state} = coeffects;
		updateState({
			systemMessagesCollapsed: !state.systemMessagesCollapsed
		});
	},

	'TOGGLE_MODAL_SYSTEM_MESSAGES': (coeffects) => {
		const {updateState, state} = coeffects;
		updateState({
			modalSystemMessagesCollapsed: !state.modalSystemMessagesCollapsed
		});
	}
};