import {createCustomElement, actionTypes} from '@servicenow/ui-core';
import {createHttpEffect} from '@servicenow/ui-effect-http';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';
import packageJson from '../../package.json';
import {
	groupAssessmentsByMasterId,
	paginateAssessments,
	loadCareIQConfig,
	hasRelationships,
	calculateVisibleQuestions
} from './utils.js';
import * as effects from './effects.js';
import {coreActions} from './core-actions.js';
import {configActions} from './config-actions.js';

const {COMPONENT_BOOTSTRAPPED} = actionTypes;


const view = (state, {updateState, dispatch}) => {
	// Reusable SVG Icons
	const CheckIcon = () => (
		<svg attrs={{width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor"}}>
			<path attrs={{d: "M13.485 3.429a1 1 0 0 1 0 1.414L6.707 11.62a1 1 0 0 1-1.414 0L2.515 8.843a1 1 0 1 1 1.414-1.414L6 9.5a1 1 0 0 1 0 0l6.071-6.071a1 1 0 0 1 1.414 0z"}} />
		</svg>
	);

	const XIcon = () => (
		<svg attrs={{width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor"}}>
			<path attrs={{d: "M3.646 3.646a1 1 0 0 1 1.414 0L8 6.586l2.94-2.94a1 1 0 1 1 1.414 1.414L9.414 8l2.94 2.94a1 1 0 0 1-1.414 1.414L8 9.414l-2.94 2.94a1 1 0 0 1-1.414-1.414L6.586 8 3.646 5.06a1 1 0 0 1 0-1.414z"}} />
		</svg>
	);

	// Spinner component for loading states
	const SpinnerIcon = ({size = "24"}) => (
		<svg
			attrs={{
				width: size,
				height: size,
				viewBox: "0 0 24 24",
				fill: "none",
				stroke: "currentColor",
				"stroke-width": "2",
				"stroke-linecap": "round",
				"stroke-linejoin": "round"
			}}
			style={{
				animation: "spin 1s linear infinite"
			}}
		>
			<circle attrs={{cx: "12", cy: "12", r: "10", opacity: "0.25"}} />
			<path attrs={{d: "M12 2 A10 10 0 0 1 22 12", opacity: "0.75"}} />
		</svg>
	);

	// Loading Overlay Component - reusable overlay with spinner
	const LoadingOverlay = ({message = "Loading...", isModal = false}) => (
		<div
			style={{
				position: isModal ? "fixed" : "absolute",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				backgroundColor: isModal ? "rgba(0, 0, 0, 0.6)" : "rgba(255, 255, 255, 0.9)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				zIndex: isModal ? 999999 : 1000,
				borderRadius: isModal ? "0" : "4px",
				pointerEvents: "auto",
				cursor: isModal ? "wait" : "default"
			}}
			onclick={(e) => {
				if (isModal) {
					e.stopPropagation();
					e.preventDefault();
				}
			}}
		>
			<div style={{
				backgroundColor: "#fff",
				padding: "32px 48px",
				borderRadius: "12px",
				boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				gap: "16px",
				minWidth: "200px"
			}}>
				<SpinnerIcon size="48" />
				<div style={{
					fontSize: "16px",
					color: "#111827",
					fontWeight: "600",
					textAlign: "center",
					whiteSpace: "nowrap"
				}}>
					{message}
				</div>
			</div>
		</div>
	);

	// Helper function to check if there are any unsaved changes
	// Only counts questions/answers that have been EDITED (isUnsaved: true)
	// NOT just newly added questions that haven't been touched yet
	const hasAnyUnsavedChanges = (state) => {
		// Check if any question has isUnsaved flag set
		const hasUnsavedQuestions = state.currentQuestions?.questions?.some(q => q.isUnsaved === true) || false;

		// Check if any answer changes exist (answer changes always mean editing)
		const hasUnsavedAnswers = (state.answerChanges && Object.keys(state.answerChanges).length > 0) || false;

		return hasUnsavedQuestions || hasUnsavedAnswers;
	};

	// Auto-scroll system message box to bottom after render
	setTimeout(() => {
		const systemWindows = document.querySelectorAll('.careiq-builder .system-window');
		systemWindows.forEach(window => {
			window.scrollTop = window.scrollHeight;
		});
	}, 10); // Reduced delay for better responsiveness
	
	return (
		<div className="careiq-builder">
			{/* Global modal loading overlay for question moves */}
			{state.movingQuestion && (
				<LoadingOverlay message="Moving question..." isModal={true} />
			)}

			{/* Global modal loading overlay for creating version */}
			{state.creatingVersion && (
				<LoadingOverlay message="Creating new version..." isModal={true} />
			)}

			{/* Global modal loading overlay for publishing assessment */}
			{state.publishingAssessment && (
				<LoadingOverlay message="Publishing assessment..." isModal={true} />
			)}

			<h1>CareIQ Builder</h1>

			{/* Ticker-Style System Messages */}
			<div className="system-window-container">
				{/* Current message ticker with info icon toggle */}
				<div
					className="system-message-ticker"
					style={{
						display: 'flex',
						alignItems: 'center',
						padding: '8px 12px',
						backgroundColor: '#ffffff',
						border: '1px solid #e0e0e0',
						borderRadius: '4px',
						marginBottom: '12px',
						minHeight: '36px'
					}}
				>
					{/* Info icon toggle */}
					<button
						style={{
							background: 'none',
							border: 'none',
							fontSize: '18px',
							cursor: 'pointer',
							marginRight: '12px',
							color: (() => {
								// Check if current message is an error or if there are any recent errors
								if (state.systemMessages?.length > 0) {
									const lastMessage = state.systemMessages[state.systemMessages.length - 1];
									if (lastMessage.type === 'error') return '#dc3545'; // Red for errors
								}
								if (state.error) return '#dc3545'; // Red for static errors
								return '#6b7280'; // Default gray
							})(),
							padding: '2px',
							borderRadius: '50%'
						}}
						onclick={() => dispatch('TOGGLE_SYSTEM_MESSAGES')}
						title={state.systemMessagesCollapsed ? 'Show message history' : 'Hide message history'}
					>
						ℹ️
					</button>

					{/* Current message display */}
					{(() => {
						// Get the most recent message from any source
						let currentMessage = null;

						// Check dynamic messages first (most recent)
						if (state.systemMessages?.length > 0) {
							const lastDynamicMessage = state.systemMessages[state.systemMessages.length - 1];
							currentMessage = {
								type: lastDynamicMessage.type,
								message: lastDynamicMessage.message,
								timestamp: lastDynamicMessage.timestamp
							};
						}
						// Otherwise check static status messages
						else if (state.error) {
							currentMessage = {
								type: 'error',
								message: `Error: ${state.error}`,
								timestamp: new Date().toISOString()
							};
						} else if (state.categoriesLoading) {
							currentMessage = {
								type: 'loading',
								message: 'Loading use case categories...',
								timestamp: new Date().toISOString()
							};
						} else if (state.useCaseCategories && state.useCaseCategories.length === 0) {
							currentMessage = {
								type: 'warning',
								message: 'No use case categories found for CM',
								timestamp: new Date().toISOString()
							};
						} else if (state.useCaseCategories && state.useCaseCategories.length > 0) {
							currentMessage = {
								type: 'success',
								message: `Loaded ${state.useCaseCategories.length} Use Case Categories`,
								timestamp: new Date().toISOString()
							};
						} else if (state.careiqConfig && state.accessToken) {
							currentMessage = {
								type: 'success',
								message: 'Connected to the CareIQ Platform',
								timestamp: new Date().toISOString()
							};
						} else if (state.loading) {
							currentMessage = {
								type: 'loading',
								message: 'Connecting to the CareIQ Platform...',
								timestamp: new Date().toISOString()
							};
						}

						if (currentMessage) {
							return (
								<div style={{
									display: 'flex',
									alignItems: 'center',
									flex: 1,
									fontSize: '13px'
								}}>
									<span style={{
										fontWeight: 'bold',
										color: currentMessage.type === 'success' ? '#28a745' :
											   currentMessage.type === 'error' ? '#dc3545' :
											   currentMessage.type === 'warning' ? '#ffc107' : '#17a2b8',
										marginRight: '8px'
									}}>
										{currentMessage.type === 'success' ? '✅' :
										 currentMessage.type === 'error' ? '❌' :
										 currentMessage.type === 'warning' ? '⚠️' :
										 currentMessage.type === 'loading' ? '🔄' : 'ℹ️'}
									</span>
									<span style={{flex: 1}}>{currentMessage.message}</span>
									<span style={{
										fontSize: '10px',
										color: '#6b7280',
										marginLeft: '8px'
									}}>
										{new Date(currentMessage.timestamp).toLocaleTimeString()}
									</span>
								</div>
							);
						} else {
							return (
								<span style={{
									color: '#6b7280',
									fontSize: '12px',
									fontStyle: 'italic',
									flex: 1
								}}>
									Ready
								</span>
							);
						}
					})()}
				</div>

				{/* Message history - only show when expanded */}
				{!state.systemMessagesCollapsed && (
					<div
						className="system-messages-history"
						style={{
							height: '150px',  // 2.5x height for expanded history
							overflowY: 'auto',
							border: '1px solid #e0e0e0',
							borderRadius: '4px',
							backgroundColor: '#f8f9fa',
							marginBottom: '12px'
						}}
						hook={{
							insert: (vnode) => {
								vnode.elm.scrollTop = vnode.elm.scrollHeight;
							},
							update: (oldVnode, vnode) => {
								setTimeout(() => {
									vnode.elm.scrollTop = vnode.elm.scrollHeight;
								}, 10);
							}
						}}
					>
						<div style={{padding: '8px 12px', fontSize: '11px', fontWeight: '500', color: '#6b7280', borderBottom: '1px solid #e0e0e0'}}>
							Message History:
						</div>

						{/* Static status messages */}
						{state.loading && (
							<div className="system-message loading" style={{padding: '4px 12px 4px 48px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #f0f0f0'}}>
								🔄 <strong>Connecting to the CareIQ Platform...</strong>
							</div>
						)}
						{state.careiqConfig && state.accessToken && (
							<div className="system-message success" style={{padding: '4px 12px 4px 48px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #f0f0f0'}}>
								✅ <strong>Connected to the CareIQ Platform</strong>
							</div>
						)}
						{state.categoriesLoading && (
							<div className="system-message loading" style={{padding: '4px 12px 4px 48px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #f0f0f0'}}>
								🔄 <strong>Loading use case categories...</strong>
							</div>
						)}
						{state.useCaseCategories && state.useCaseCategories.length > 0 && (
							<div className="system-message success" style={{padding: '4px 12px 4px 48px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #f0f0f0'}}>
								📋 <strong>Loaded {state.useCaseCategories.length} Use Case Categories:</strong>
								<ul className="categories-list" style={{fontSize: '10px', marginLeft: '12px', marginTop: '4px'}}>
									{state.useCaseCategories.map(category => (
										<li key={category.id} className="category-item">
											{category.name} (ID: {category.id})
										</li>
									))}
								</ul>
							</div>
						)}
						{state.useCaseCategories && state.useCaseCategories.length === 0 && !state.categoriesLoading && (
							<div className="system-message warning" style={{padding: '4px 12px 4px 48px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #f0f0f0'}}>
								⚠️ <strong>No use case categories found for CM</strong>
							</div>
						)}
						{state.error && (
							<div className="system-message error" style={{padding: '4px 12px 4px 48px', fontSize: '11px', color: '#6b7280', borderBottom: '1px solid #f0f0f0'}}>
								❌ <strong>Error:</strong> {state.error}
							</div>
						)}

						{/* Dynamic system messages */}
						{state.systemMessages && state.systemMessages.map((msg, index) => (
							<div key={index} className={`system-message ${msg.type}`} style={{padding: '4px 12px 4px 48px', fontSize: '11px', color: '#6b7280', borderBottom: index < state.systemMessages.length - 1 ? '1px solid #f0f0f0' : 'none'}}>
								<span style={{
									color: msg.type === 'success' ? '#28a745' :
										   msg.type === 'error' ? '#dc3545' :
										   msg.type === 'warning' ? '#ffc107' : '#17a2b8',
									marginRight: '6px'
								}}>
									{msg.type === 'loading' && '🔄'}
									{msg.type === 'success' && '✅'}
									{msg.type === 'error' && '❌'}
									{msg.type === 'warning' && '⚠️'}
									{msg.type === 'info' && 'ℹ️'}
								</span>
								<strong>{msg.message}</strong>
								{msg.timestamp && (
									<span style={{
										float: 'right',
										fontSize: '9px',
										color: '#9ca3af'
									}}>
										{new Date(msg.timestamp).toLocaleTimeString()}
									</span>
								)}
							</div>
						))}
					</div>
				)}
			</div>
			
			{state.useCaseCategories && state.useCaseCategories.length > 0 && !state.builderView && (
				<div className="assessments-section">
					<div className="assessments-header">
						<h2>Assessments</h2>
						<div className="assessments-controls">
							<input 
								type="text" 
								className="search-input" 
								placeholder="Search assessments..." 
								value={state.searchTerm || ''}
								oninput={(e) => {
									updateState({searchTerm: e.target.value});
									dispatch('SEARCH_ASSESSMENTS', {searchTerm: e.target.value});
								}}
							/>
							<div className="page-size-controls">
								<label className="page-size-label">Show:</label>
								<select 
									className="page-size-select"
									value={state.assessmentsPagination.displayPageSize}
									onchange={(e) => dispatch('CHANGE_PAGE_SIZE', {pageSize: parseInt(e.target.value)})}
								>
									<option value={5}>5</option>
									<option value={10} selected>10</option>
									<option value={25}>25</option>
									<option value={50}>50</option>
								</select>
								<span className="page-size-label">per page</span>
							</div>
							<button 
								className="new-assessment-btn"
								onclick={() => dispatch('CREATE_NEW_ASSESSMENT')}
							>
								+ New Assessment
							</button>
						</div>
					</div>
					
					{state.assessmentsLoading && (
						<div className="assessments-loading">
							🔄 Loading assessments...
						</div>
					)}
					
					{state.assessments && state.assessments.length > 0 && (
						<div className="assessments-container">
							<div className="assessments-grid">
								{paginateAssessments(
									state.filteredAssessments || state.assessments, 
									state.assessmentsPagination.displayPage, 
									state.assessmentsPagination.displayPageSize
								).map(assessment => {
									const isExpanded = state.expandedAssessments[assessment.id];
									const versions = state.assessmentVersions[assessment.id];
									const baseTitle = assessment.title.replace(/ - v\d+(\.\d+)?$/, '');
									
									return (
										<div key={assessment.id} className="assessment-group">
											<div 
												className={`assessment-card clickable ${isExpanded ? 'expanded' : ''}`}
												onclick={() => dispatch('OPEN_ASSESSMENT_BUILDER', {
													assessmentId: assessment.id,
													assessmentTitle: assessment.title
												})}
											>
												<div className="assessment-card-header">
													<h3 className="assessment-title">
														{baseTitle}
														<span className="version-count">
															(Latest: v{assessment.version})
														</span>
													</h3>
													<div className="assessment-status-group">
														<span className={`assessment-status ${assessment.status}`}>
															{assessment.status}
														</span>
														<span 
															className="expand-icon"
															onclick={(event) => {
																event.stopPropagation();
																dispatch('EXPAND_ASSESSMENT_VERSIONS', {
																	assessmentId: assessment.id,
																	assessmentTitle: assessment.title
																});
															}}
														>
															{isExpanded ? '−' : '+'}
														</span>
													</div>
												</div>
												<div className="assessment-card-body">
													<p className="assessment-policy">Policy: {assessment.policy_number}</p>
													<p className="assessment-category">
														Category: {assessment.use_case_category.name}
													</p>
													<p className="assessment-usage">Usage: {assessment.usage}</p>
													<p className="assessment-version">Version: {assessment.version}</p>
													{assessment.version_name && (
														<p className="assessment-version-name">{assessment.version_name}</p>
													)}
													<p className="assessment-dates">
														Created: {new Date(assessment.created_date).toLocaleDateString()}
													</p>
												</div>
											</div>
											
											{isExpanded && versions && (
												<div className="version-list">
													{versions.map(version => (
														<div
															key={version.id}
															className="version-card clickable"
															onclick={() => dispatch('OPEN_ASSESSMENT_BUILDER', {
																assessmentId: version.id,
																assessmentTitle: version.title
															})}
														>
															<div className="version-header">
																<span className="version-title">Version {version.version}</span>
																<span className={`version-status ${version.status}`}>
																	{version.status}
																</span>
															</div>
															<div className="version-body">
																{version.version_name && (
																	<p className="version-name">{version.version_name}</p>
																)}
																<p>Created: {new Date(version.created_date).toLocaleDateString()}</p>
																{version.end_date && (
																	<p>Ended: {new Date(version.end_date).toLocaleDateString()}</p>
																)}
																<p>Most Recent: {version.most_recent ? 'Yes' : 'No'}</p>
															</div>
														</div>
													))}
												</div>
											)}
										</div>
									);
								})}
							</div>
							
							{(() => {
								const dataToShow = state.filteredAssessments || state.assessments;
								const totalItems = dataToShow ? dataToShow.length : 0;
								const totalPages = Math.ceil(totalItems / state.assessmentsPagination.displayPageSize);
								const startItem = (state.assessmentsPagination.displayPage * state.assessmentsPagination.displayPageSize) + 1;
								const endItem = Math.min((state.assessmentsPagination.displayPage + 1) * state.assessmentsPagination.displayPageSize, totalItems);
								
								return totalPages > 1 ? (
									<div className="pagination">
										<div className="pagination-left">
											<button 
												className="pagination-btn"
												disabled={state.assessmentsPagination.displayPage === 0}
												onclick={() => dispatch('GOTO_FIRST_PAGE')}
											>
												⏮ First
											</button>
											<button 
												className="pagination-btn"
												disabled={state.assessmentsPagination.displayPage === 0}
												onclick={() => dispatch('GOTO_PREVIOUS_PAGE')}
											>
												← Previous
											</button>
										</div>
										<span className="pagination-info">
											Showing {startItem} - {endItem} of {totalItems}
										</span>
										<div className="pagination-right">
											<button 
												className="pagination-btn"
												disabled={state.assessmentsPagination.displayPage >= totalPages - 1}
												onclick={() => dispatch('GOTO_NEXT_PAGE')}
											>
												Next →
											</button>
											<button 
												className="pagination-btn"
												disabled={state.assessmentsPagination.displayPage >= totalPages - 1}
												onclick={() => dispatch('GOTO_LAST_PAGE')}
											>
												Last ⏭
											</button>
										</div>
									</div>
								) : null;
							})()}
						</div>
					)}
					
					{state.assessments && state.assessments.length === 0 && !state.assessmentsLoading && (
						<div className="no-assessments">
							No assessments found.
						</div>
					)}
				</div>
			)}
			
			{state.useCaseCategories && state.useCaseCategories.length > 0 && state.builderView && (
				<div className="builder-section">
					<div className="builder-header">
						<div className="builder-title">
							<h2>
								{state.currentAssessment ? (state.currentAssessment.version_name || state.currentAssessment.title) : 'Assessment Builder'}
							</h2>
							{state.currentAssessment && (
								<button
									className="view-details-btn"
									onclick={() => dispatch('OPEN_ASSESSMENT_DETAILS')}
									title="View assessment details"
								>
									View Details
								</button>
							)}
						</div>
						<div className="builder-controls">
							<button
								key="refresh-btn"
								className="refresh-btn"
								onclick={() => dispatch('REFRESH_ASSESSMENT')}
								title="Refresh assessment data"
							>
								🔄 Refresh
							</button>
							{(state.currentAssessment?.status === 'draft' || !state.currentAssessment?.status) ? [
								<button 
									key="edit-btn"
									className={`mode-toggle-btn ${state.builderMode ? 'active' : ''}`}
									onclick={() => dispatch('TOGGLE_BUILDER_MODE', {mode: true})}
								>
									🔧 Edit Mode
								</button>,
								<button 
									key="preview-btn"
									className={`mode-toggle-btn ${!state.builderMode ? 'active' : ''}`}
									onclick={() => dispatch('TOGGLE_BUILDER_MODE', {mode: false})}
								>
									👁️ Preview Mode
								</button>,
								<button
									key="edit-relationships-btn"
									className={`mode-toggle-btn ${state.showRelationships ? 'active' : ''}`}
									onclick={() => dispatch('TOGGLE_EDIT_RELATIONSHIPS')}
								>
									🔗 Edit Relationships
								</button>,
								<button
									key="edit-scoring-btn"
									className={`mode-toggle-btn ${state.scoringPanelOpen ? 'active' : ''}`}
									onclick={() => dispatch('TOGGLE_SCORING_MODE')}
									disabled={state.selectedScoringModel}
									title={state.selectedScoringModel ? 'Save or cancel current scoring changes first' : 'Open scoring models panel'}
								>
									🎯 Edit Scoring
								</button>,
								<button
									key="publish-btn"
									className="publish-btn"
									onclick={() => dispatch('PUBLISH_ASSESSMENT', {
										assessmentId: state.currentAssessmentId,
										assessmentTitle: state.currentAssessment?.title
									})}
								>
									🚀 Publish
								</button>,
								// Individual save buttons will be shown per question instead of holistic save
							] : null}
							{state.currentAssessment?.status === 'published' ? [
								<span key="published-indicator" className="published-indicator">
									📋 Published Version - Read Only
								</span>,
								<button
									key="unpublish-btn"
									className="unpublish-btn"
									onclick={() => dispatch('UNPUBLISH_ASSESSMENT', {
										assessmentId: state.currentAssessmentId,
										assessmentTitle: state.currentAssessment?.title
									})}
									title="Unpublish this assessment"
								>
									↩️ Unpublish
								</button>,
								<button
									key="create-new-version-btn"
									className="create-new-version-btn"
									onclick={() => dispatch('CREATE_NEW_VERSION', {
										assessmentId: state.currentAssessmentId,
										assessmentTitle: state.currentAssessment?.title,
										currentVersion: state.currentAssessment?.version
									})}
								>
									Create New Version
								</button>
							] : null}
							{state.currentAssessment?.status === 'unpublished' ? [
								<span key="unpublished-indicator" className="published-indicator">
									📋 Unpublished Version - Read Only
								</span>,
								<button
									key="create-new-version-btn"
									className="create-new-version-btn"
									onclick={() => dispatch('CREATE_NEW_VERSION', {
										assessmentId: state.currentAssessmentId,
										assessmentTitle: state.currentAssessment?.title,
										currentVersion: state.currentAssessment?.version
									})}
								>
									Create New Version
								</button>
							] : null}
							<button 
								className="close-builder-btn"
								onclick={() => dispatch('CLOSE_ASSESSMENT_BUILDER')}
							>
								← Back to Assessments
							</button>
						</div>
					</div>

					{/* Scoring Model Indicator - Moved here for better prominence */}
					{state.selectedScoringModel && (
						<div className="scoring-model-indicator" style={{
							padding: '8px 12px',
							backgroundColor: '#e3f2fd',
							border: '1px solid #2196f3',
							borderRadius: '4px',
							marginTop: '16px',
							marginBottom: '16px',
							fontSize: '14px',
							fontWeight: '500',
							color: '#1976d2',
							display: 'flex',
							alignItems: 'center',
							justifyContent: 'space-between',
							position: 'relative'
						}}>
							<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
								<span>📊 Now editing: {state.selectedScoringModel.label}</span>
								{Object.keys(state.scoringChanges || {}).length > 0 && (
									<span style={{
										fontSize: '12px',
										color: '#f57c00',
										fontWeight: '600',
										background: '#fff3e0',
										padding: '2px 8px',
										borderRadius: '3px',
										border: '1px solid #ffb74d'
									}}>
										Unsaved changes
									</span>
								)}
							</div>
							<div style={{
								display: 'flex',
								alignItems: 'center',
								gap: '8px'
							}}>
								{Object.keys(state.scoringChanges || {}).length > 0 && (
									<button
										onclick={() => dispatch('SAVE_SCORING_CHANGES')}
										title="Save all scoring changes"
										disabled={state.savingScoringChanges}
										style={{
											background: state.savingScoringChanges ? '#90caf9' : '#1976d2',
											border: 'none',
											color: 'white',
											cursor: state.savingScoringChanges ? 'wait' : 'pointer',
											padding: '6px 12px',
											borderRadius: '4px',
											fontSize: '13px',
											fontWeight: '500',
											display: 'flex',
											alignItems: 'center',
											gap: '4px',
											opacity: state.savingScoringChanges ? 0.7 : 1
										}}
									>
										{state.savingScoringChanges ? '⏳ Saving...' : '💾 Save'}
									</button>
								)}
								<button
									onclick={() => dispatch('CANCEL_SCORING_CHANGES')}
									title="Cancel scoring changes"
									disabled={state.savingScoringChanges}
									style={{
										background: '#f5f5f5',
										border: '1px solid #d1d5db',
										color: '#666',
										cursor: state.savingScoringChanges ? 'not-allowed' : 'pointer',
										padding: '6px 12px',
										borderRadius: '4px',
										fontSize: '13px',
										fontWeight: '500',
										display: 'flex',
										alignItems: 'center',
										gap: '4px',
										opacity: state.savingScoringChanges ? 0.5 : 1
									}}
								>
									↶ Cancel
								</button>
								<button
									className="exit-scoring-btn"
									onclick={() => dispatch('EXIT_SCORING_MODE')}
									title="Exit scoring mode"
									style={{
										background: 'none',
										border: 'none',
										color: '#1976d2',
										cursor: 'pointer',
										padding: '2px',
										borderRadius: '2px',
										display: 'flex',
										alignItems: 'center',
										justifyContent: 'center'
									}}
								>
									<XIcon />
								</button>
							</div>
							{state.savingScoringChanges && (
								<LoadingOverlay message="Saving scores..." />
							)}
						</div>
					)}

					{state.assessmentDetailsLoading && (
						<div className="builder-loading">
							🔄 Loading assessment details...
						</div>
					)}
					
					{state.currentAssessment && !state.assessmentDetailsLoading && (
						<div className={`builder-content ${state.sectionsPanelExpanded ? 'sections-expanded' : ''} ${state.questionsPanelExpanded ? 'questions-expanded' : ''}`}>
							<div className={`sections-sidebar ${state.sectionsPanelExpanded ? 'expanded' : ''}`}>

								<div className="sections-header">
									<div className="sections-title-container">
										<button
											className="expand-sections-btn"
											onclick={() => dispatch('TOGGLE_SECTIONS_PANEL')}
											title={state.sectionsPanelExpanded ? 'Collapse sections panel' : 'Expand sections panel'}
										>
											<span className={state.sectionsPanelExpanded ? 'expand-icon expanded' : 'expand-icon'}>⤢</span>
										</button>
										<h3>Sections</h3>
									</div>
									<div className="header-right-buttons">
										{state.builderMode && (state.currentAssessment?.status === 'draft' || !state.currentAssessment?.status) && (
											<button
												className="add-section-btn"
												onclick={() => dispatch('ADD_SECTION')}
												title="Add new parent section"
											>
												+
											</button>
										)}
										{state.sectionsPanelExpanded && (
											<button
												className="btn-cancel"
												onclick={() => dispatch('TOGGLE_SECTIONS_PANEL')}
												title="Close panel"
											>
												<XIcon />
											</button>
										)}
									</div>
								</div>
								{state.currentAssessment.sections && state.currentAssessment.sections.length > 0 ? (
									<div className="sections-list">
										{state.currentAssessment.sections
											.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
											.map(section => (
											<div key={section.id} className="section-item" style={{position: "relative"}}>
												<div className="section-header">
													<div
														className={`section-item draggable ${state.selectedSection === section.id ? 'selected' : ''} ${state.dragOverSection === section.id ? 'drag-over' : ''}`}
														ondblclick={(e) => {
															if (state.builderMode && state.currentAssessment?.status === 'draft') {
																e.stopPropagation();
																e.preventDefault();
																dispatch('EDIT_SECTION_NAME', {
																	sectionId: section.id,
																	sectionLabel: section.label
																});
															}
														}}
													>
														{state.editingSectionId === section.id ? (
															<div className="section-name-edit-container">
																<div className="typeahead-container">
																	<input
																		type="text"
																		className="section-name-edit-input"
																		value={state.editingSectionName !== null ? state.editingSectionName : section.label}
																		oninput={(e) => {
																			dispatch('UPDATE_SECTION_NAME', {
																				sectionName: e.target.value
																			});
																			dispatch('SECTION_TYPEAHEAD_INPUT_CHANGE', {
																				searchText: e.target.value
																			});
																		}}
																		onkeydown={(e) => {
																			if (e.key === 'Enter') {
																				if (state.sectionTypeaheadVisible && state.sectionTypeaheadSelectedIndex >= 0) {
																					e.preventDefault();
																					dispatch('SECTION_TYPEAHEAD_KEYBOARD', { key: 'Enter' });
																				} else {
																					dispatch('SAVE_SECTION_NAME', {
																						sectionId: section.id,
																						sectionLabel: state.editingSectionName !== null ? state.editingSectionName : section.label
																					});
																				}
																			} else if (e.key === 'Escape') {
																				if (state.sectionTypeaheadVisible) {
																					dispatch('SECTION_TYPEAHEAD_HIDE');
																				} else {
																					dispatch('CANCEL_SECTION_EDIT');
																				}
																			} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
																				e.preventDefault();
																				dispatch('SECTION_TYPEAHEAD_KEYBOARD', { key: e.key });
																			}
																		}}
																		onblur={(e) => {
																			// Hide typeahead after a short delay to allow selection
																			setTimeout(() => {
																				dispatch('SECTION_TYPEAHEAD_HIDE');
																			}, 150);
																		}}
																		autoFocus
																	/>

																	{/* Section Typeahead Results */}
																	{state.sectionTypeaheadVisible && (
																		<div className="typeahead-dropdown section-typeahead-dropdown">
																			{state.sectionTypeaheadResults && state.sectionTypeaheadResults.length > 0 ? (
																				state.sectionTypeaheadResults
																					.slice(0, 10)
																					.map((result, index) => (
																						<div
																							key={result.id}
																							className={`typeahead-item ${index === state.sectionTypeaheadSelectedIndex ? 'selected' : ''}`}
																							onclick={() => dispatch('SECTION_TYPEAHEAD_SELECT', {selectedItem: result})}
																						>
																							<div className={`typeahead-item-title ${result.exact_match ? 'exact-match' : ''}`}>{result.name || result.label}</div>
																						</div>
																					))
																			) : (
																				<div className="typeahead-no-results">No matching sections found</div>
																			)}
																		</div>
																	)}
																</div>
																<div className="section-edit-buttons">
																	<button
																		className="section-edit-save-btn"
																		onclick={() => dispatch('SAVE_SECTION_NAME', {
																			sectionId: section.id,
																			sectionLabel: state.editingSectionName !== null ? state.editingSectionName : section.label
																		})}
																		ondblclick={(e) => {
																			e.stopPropagation();
																			e.preventDefault();
																		}}
																		title="Save changes"
																	>
																		<CheckIcon />
																	</button>
																	<button
																		className="section-edit-cancel-btn"
																		onclick={() => dispatch('CANCEL_SECTION_EDIT')}
																		ondblclick={(e) => {
																			e.stopPropagation();
																			e.preventDefault();
																		}}
																		title="Cancel changes"
																	>
																		✗
																	</button>
																</div>
															</div>
														) : (
															<div className="section-display" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
																{state.editingSectionId !== section.id && (
																	<span className="section-label" style={{fontWeight: 'bold'}}>
																		{section.label || 'Untitled Parent Section'}
																	</span>
																)}

																<span className="section-info" style={{color: '#666', fontSize: '12px'}}>
																	({(section.subsections || []).length} subsections)
																</span>

																{state.builderMode && state.currentAssessment?.status === 'draft' && state.editingSectionId !== section.id && (
																	<button
																		className="add-child-section-btn"
																		onclick={() => dispatch('ADD_CHILD_SECTION', {parentSectionId: section.id})}
																		title="Add child section"
																		style={{
																			marginLeft: 'auto',
																			backgroundColor: '#28a745',
																			color: 'white',
																			border: 'none',
																			borderRadius: '3px',
																			width: '20px',
																			height: '20px',
																			fontSize: '12px',
																			cursor: 'pointer',
																			display: 'flex',
																			alignItems: 'center',
																			justifyContent: 'center'
																		}}
																	>
																		+
																	</button>
																)}
																{/* Show delete button only if parent section has no child sections */}
																{state.builderMode && state.currentAssessment?.status === 'draft' && state.editingSectionId !== section.id && (section.subsections || []).length === 0 && (
																	<button
																		className="delete-parent-section-btn"
																		onclick={(e) => {
																			e.stopPropagation();
																			dispatch('DELETE_SECTION', {sectionId: section.id, sectionName: section.label});
																		}}
																		title="Delete section"
																		style={{
																			backgroundColor: '#6b7280',
																			color: 'white',
																			border: 'none',
																			borderRadius: '3px',
																			width: '20px',
																			height: '20px',
																			fontSize: '10px',
																			cursor: 'pointer',
																			display: 'flex',
																			alignItems: 'center',
																			justifyContent: 'center',
																			marginLeft: '4px'
																		}}
																	>
																		🗑️
																	</button>
																)}
															</div>
														)}
													</div>
												</div>
												
												{section.subsections && section.subsections.length > 0 && (
													<div className="subsections-list">
														{section.subsections
															.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
															.map(subsection => (
															<div key={subsection.id} style={{position: "relative"}}>
																<div
																	className={`subsection-item draggable ${state.selectedSection === subsection.id ? 'selected' : ''} ${state.dragOverSection === subsection.id ? 'drag-over' : ''}`}
																	draggable={false}
																	ondblclick={(e) => {
																	if (state.builderMode && state.currentAssessment?.status === 'draft') {
																		e.stopPropagation();
																		e.preventDefault();
																		dispatch('EDIT_SECTION_NAME', {
																			sectionId: subsection.id,
																			sectionLabel: subsection.label
																		});
																	}
																}}
																ondragover={(e) => {
																	// Check if it's a section drag or question drag
																	try {
																		const dragData = e.dataTransfer.types.includes('text/plain');
																		if (state.draggingSection || dragData) {
																			e.preventDefault();
																			e.dataTransfer.dropEffect = 'move';
																			if (state.draggingSection) {
																				dispatch('DRAG_SECTION_OVER', {sectionId: subsection.id});
																			} else {
																				// Question drag - highlight section
																				dispatch('DRAG_QUESTION_OVER_SECTION', {sectionId: subsection.id});
																			}
																		}
																	} catch (error) {
																		// During section drag, dataTransfer.types may not be accessible
																		if (state.draggingSection) {
																			e.preventDefault();
																			e.dataTransfer.dropEffect = 'move';
																			dispatch('DRAG_SECTION_OVER', {sectionId: subsection.id});
																		}
																	}
																}}
																ondragleave={(e) => {
																	if (state.draggingSection) {
																		dispatch('DRAG_SECTION_LEAVE');
																	} else {
																		dispatch('DRAG_QUESTION_LEAVE_SECTION');
																	}
																}}
																ondrop={(e) => {
																	e.preventDefault();

																	// Check if this is a section drop or question drop
																	try {
																		const dragDataText = e.dataTransfer.getData('text/plain');
																		if (dragDataText) {
																			const dragData = JSON.parse(dragDataText);
																			if (dragData.type === 'question') {
																				// Question drop on section - move question to this section
																				if (dragData.sourceSectionId !== subsection.id) {
																					dispatch('MOVE_QUESTION_TO_SECTION', {
																						questionId: dragData.questionId,
																						sourceSectionId: dragData.sourceSectionId,
																						sourceSectionLabel: dragData.sourceSectionLabel,
																						targetSectionId: subsection.id,
																						targetSectionLabel: subsection.label,
																						question: dragData.question
																					});
																				}
																				dispatch('DRAG_QUESTION_LEAVE_SECTION');
																				return;
																			}
																		}
																	} catch (error) {
																		console.error('Error parsing drag data:', error);
																	}

																	// If we get here, it's a section drop
																	if (state.draggingSection && state.draggingSection !== subsection.id) {
																		dispatch('DROP_SECTION', {
																			targetSectionId: subsection.id,
																			targetIndex: section.subsections.indexOf(subsection)
																		});
																	}
																}}
																ondragend={(e) => {
																	dispatch('DRAG_SECTION_END');
																}}
																onclick={(e) => {
																	// Only handle click if we're not in edit mode and not clicking on edit/delete elements
																	if (state.editingSectionId !== subsection.id && 
																		!e.target.closest('.section-name-edit-container') &&
																		!e.target.closest('.delete-section-btn')) {
																		dispatch('SELECT_SECTION', {
																			sectionId: subsection.id,
																			sectionLabel: subsection.label
																		});
																	}
																}}
															>
																{state.editingSectionId === subsection.id ? (
																	<div className="section-name-edit-container">
																		<div className="typeahead-container">
																			<input
																				type="text"
																				className="section-name-edit-input"
																				value={state.editingSectionName !== null ? state.editingSectionName : subsection.label}
																				oninput={(e) => {
																					dispatch('UPDATE_SECTION_NAME', {
																						sectionName: e.target.value
																					});
																					dispatch('SECTION_TYPEAHEAD_INPUT_CHANGE', {
																						searchText: e.target.value
																					});
																				}}
																				onkeydown={(e) => {
																					if (e.key === 'Enter') {
																						if (state.sectionTypeaheadVisible && state.sectionTypeaheadSelectedIndex >= 0) {
																							e.preventDefault();
																							dispatch('SECTION_TYPEAHEAD_KEYBOARD', { key: 'Enter' });
																						} else {
																							dispatch('SAVE_SECTION_NAME', {
																								sectionId: subsection.id,
																								sectionLabel: state.editingSectionName !== null ? state.editingSectionName : subsection.label
																							});
																						}
																					} else if (e.key === 'Escape') {
																						if (state.sectionTypeaheadVisible) {
																							dispatch('SECTION_TYPEAHEAD_HIDE');
																						} else {
																							dispatch('CANCEL_SECTION_EDIT');
																						}
																					} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
																						e.preventDefault();
																						dispatch('SECTION_TYPEAHEAD_KEYBOARD', { key: e.key });
																					}
																				}}
																				onblur={(e) => {
																					// Hide typeahead after a short delay to allow selection
																					setTimeout(() => {
																						dispatch('SECTION_TYPEAHEAD_HIDE');
																					}, 150);
																				}}
																				autoFocus
																			/>
																			{state.sectionTypeaheadVisible && (
																				<div className="typeahead-dropdown">
																					{state.sectionTypeaheadLoading ? (
																						<div className="typeahead-loading">Searching...</div>
																					) : state.sectionTypeaheadResults.length > 0 ? (
																						state.sectionTypeaheadResults.map((result, index) => (
																							<div 
																								key={result.id}
																								className={`typeahead-item ${index === state.sectionTypeaheadSelectedIndex ? 'selected' : ''}`}
																								onmousedown={(e) => {
																									e.preventDefault(); // Prevent blur
																									dispatch('SECTION_TYPEAHEAD_SELECT', {
																										selectedItem: result
																									});
																								}}
																								onmouseenter={() => {
																									dispatch('SECTION_TYPEAHEAD_KEYBOARD', { key: 'MouseEnter', index });
																								}}
																							>
																								{result.exact_match ? (
																									<strong>{result.name}</strong>
																								) : (
																									result.name
																								)}
																							</div>
																						))
																					) : (
																						<div className="typeahead-no-results">No matching sections found</div>
																					)}
																				</div>
																			)}
																		</div>
																		<div className="section-edit-buttons">
																			<button
																				className="section-edit-save-btn"
																				onclick={() => dispatch('SAVE_SECTION_NAME', {
																					sectionId: subsection.id,
																					sectionLabel: state.editingSectionName !== null ? state.editingSectionName : subsection.label
																				})}
																				ondblclick={(e) => {
																					e.stopPropagation();
																					e.preventDefault();
																				}}
																				title="Save changes"
																			>
																				<CheckIcon />
																			</button>
																			<button
																				className="section-edit-cancel-btn"
																				onclick={() => dispatch('CANCEL_SECTION_EDIT')}
																				ondblclick={(e) => {
																					e.stopPropagation();
																					e.preventDefault();
																				}}
																				title="Cancel changes"
																			>
																				<XIcon />
																			</button>
																		</div>
																	</div>
																) : (
																	<span className="subsection-label">
																		{state.builderMode && state.currentAssessment?.status === 'draft' && (
																			<span 
																				className="section-drag-handle"
																				title="Drag to reorder section"
																				draggable={true}
																				style={{
																					cursor: 'grab',
																					marginRight: '6px',
																					padding: '1px 3px',
																					backgroundColor: '#f8f8f8',
																					borderRadius: '3px',
																					fontSize: '11px',
																					display: 'inline-block',
																					border: '1px solid #ddd',
																					color: '#666'
																				}}
																				ondragstart={(e) => {
																					const sectionIndex = section.subsections.indexOf(subsection);
																					dispatch('DRAG_SECTION_START', {
																						sectionId: subsection.id,
																						sectionIndex: sectionIndex
																					});
																					e.dataTransfer.effectAllowed = 'move';
																					e.dataTransfer.setData('text/plain', JSON.stringify({
																						type: 'section',
																						sectionId: subsection.id,
																						sourceIndex: sectionIndex
																					}));
																				}}
																				ondragend={(e) => {
																					dispatch('DRAG_SECTION_END');
																				}}
																			>
																				⋮⋮
																			</span>
																		)}
																		{subsection.label}
																		{/* Sections auto-save - no unsaved indicator needed */}
																	</span>
																)}
																{state.editingSectionId !== subsection.id && (
																	<span className="subsection-info">
																		({subsection.questions_quantity || 0} questions)
																	</span>
																)}
																{state.builderMode && state.currentAssessment?.status === 'draft' && state.editingSectionId === subsection.id && (
																	<button 
																		className="delete-section-btn"
																		onclick={(e) => {
																			e.stopPropagation();
																			dispatch('DELETE_SECTION', {sectionId: subsection.id, sectionName: subsection.label});
																		}}
																		title="Delete section"
																	>
																		🗑️
																	</button>
																)}
															</div>
														</div>
														))}
													</div>
												)}
											</div>
										))}
									</div>
								) : (
									<div className="no-sections">
										No sections found for this assessment.
									</div>
								)}
							</div>
							
							<div className={`questions-panel ${state.questionsPanelExpanded ? 'expanded' : ''}`}>
								<div className="questions-header">
									<div className="questions-title-container">
										<button
											className="expand-questions-btn"
											onclick={() => dispatch('TOGGLE_QUESTIONS_PANEL')}
											title={state.questionsPanelExpanded ? 'Collapse questions panel' : 'Expand questions panel'}
										>
											<span className={state.questionsPanelExpanded ? 'expand-icon expanded' : 'expand-icon'}>⤢</span>
										</button>
										<h3>
											{state.selectedSectionLabel ?
												`Questions - ${state.selectedSectionLabel}` :
												'Questions & Problems'
											}
										</h3>
									</div>
									{state.questionsPanelExpanded && (
										<button
											className="btn-cancel"
											onclick={() => dispatch('TOGGLE_QUESTIONS_PANEL')}
											title="Close panel"
										>
											<XIcon />
										</button>
									)}
								</div>


								{state.questionsLoading && (
									<div className="questions-loading">
										🔄 Loading questions...
									</div>
								)}
								
								{!state.selectedSection && !state.questionsLoading && (
									<div className="questions-placeholder">
										Select a section to view questions
									</div>
								)}

								{state.currentQuestions && state.currentQuestions.questions && !state.questionsLoading && (
									<div className="questions-list">
										{hasAnyUnsavedChanges(state) && (
											<div style={{
												padding: '12px 16px',
												backgroundColor: '#fef3c7',
												border: '1px solid #fbbf24',
												borderRadius: '6px',
												marginBottom: '16px',
												fontSize: '14px',
												color: '#92400e',
												display: 'flex',
												alignItems: 'center',
												gap: '8px'
											}}>
												<span style={{ fontSize: '16px' }}>⚠️</span>
												<span>You have unsaved changes. Save or cancel current changes to edit other questions.</span>
											</div>
										)}
										{state.currentQuestions.questions
											.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
											.filter(question => {
												// In edit mode, show all questions
												if (state.builderMode) return true;
												// In preview mode, only show visible questions
												return state.visibleQuestions.includes(question.ids.id) || 
													   (!question.hidden && state.visibleQuestions.length === 0);
											})
											.map((question, qIndex) => {
												const isEditable = state.builderMode && state.currentAssessment?.status === 'draft';
												//
											return (
											<div key={question.ids.id} style={{position: "relative"}}>
												{/* Loading overlays for question operations */}
												{state.deletingQuestions[question.ids.id] && (
													<LoadingOverlay message="Deleting question..." />
												)}
												{state.savingQuestions && state.savingQuestions[question.ids.id] && (
													<LoadingOverlay message="Saving question..." />
												)}
												{state.cancelingQuestions && state.cancelingQuestions[question.ids.id] && (
													<LoadingOverlay message="Canceling changes..." />
												)}
												<div
													className={`question-item ${isEditable ? 'editable' : 'preview'} ${isEditable ? 'draggable-question' : ''}`}
													draggable={false}
													style={question.isUnsaved ? {
														backgroundColor: '#e3f2fd',
														borderLeft: '5px solid #2196F3',
														boxShadow: '0 4px 12px rgba(33, 150, 243, 0.25)',
														transition: 'all 0.3s ease'
													} : {}}
													onclick={() => {
													}}
												ondragend={isEditable ? (e) => {
													e.currentTarget.classList.remove('dragging');
												} : null}
												ondragover={isEditable ? (e) => {
													e.preventDefault();
													e.currentTarget.classList.add('drag-over');
												} : null}
												ondragleave={isEditable ? (e) => {
													e.currentTarget.classList.remove('drag-over');
												} : null}
												ondrop={isEditable ? (e) => {
													e.preventDefault();
													e.currentTarget.classList.remove('drag-over');
													try {
														const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
														if (dragData.type === 'question') {
															dispatch('REORDER_QUESTIONS', {
																sourceIndex: dragData.sourceIndex,
																targetIndex: qIndex
															});
														}
													} catch (error) {
														console.error('Error handling question drop:', error);
													}
												} : null}
											>
												<div className="question-header">
													{isEditable ? (
														<div
															className="drag-handle"
															title="Drag to reorder or move to another section"
															draggable={true}
															ondragstart={(e) => {
																e.dataTransfer.setData('text/plain', JSON.stringify({
																	type: 'question',
																	questionId: question.ids.id,
																	sourceIndex: qIndex,
																	sourceSectionId: state.selectedSection,
																	sourceSectionLabel: state.selectedSectionLabel,
																	question: {
																		label: question.label,
																		type: question.type,
																		tooltip: question.tooltip || '',
																		alternative_wording: question.alternative_wording || '',
																		sort_order: question.sort_order,
																		custom_attributes: question.custom_attributes || {},
																		voice: question.voice || 'CaseManager',
																		required: question.required || false,
																		available: question.available || false,
																		has_quality_measures: question.has_quality_measures || false,
																		library_id: question.library_id || question.libraryQuestionId || (question.ids?.master_id_path ? question.ids.master_id_path[question.ids.master_id_path.length - 1] : null) || question.ids?.master_id || null,
																		isLibraryQuestion: question.isLibraryQuestion || !!question.library_id || !!(question.ids?.master_id_path && question.ids.master_id_path.length > 0) || false,
																		answers: (question.answers || []).map(answer => ({
																			...answer,
																			library_id: answer.library_id || answer.ids?.master_id || answer.master_id || null
																		}))
																	}
																}));
																e.dataTransfer.effectAllowed = 'move';

																// Add visual feedback to the parent question
																const parentElement = e.target.closest('.question-item');
																if (parentElement) {
																	parentElement.classList.add('dragging');
																}
															}}
															ondragend={(e) => {
																// Remove visual feedback
																const parentElement = e.target.closest('.question-item');
																if (parentElement) {
																	parentElement.classList.remove('dragging');
																}
															}}
														>
															⋮⋮
														</div>
													) : null}
													{isEditable ? (
														<div className="question-edit-header" style={state.isMobileView ? {
															display: 'flex',
															flexWrap: 'wrap',
															gap: '1rem',
															width: '100%',
															overflow: 'visible'
														} : {}}>
															<div className="question-number">{qIndex + 1}.</div>
															{question.isUnsaved && (
																<span style={{
																	backgroundColor: '#2196F3',
																	color: 'white',
																	padding: '3px 10px',
																	borderRadius: '4px',
																	fontSize: '11px',
																	fontWeight: 'bold',
																	marginLeft: '8px',
																	marginRight: '8px',
																	letterSpacing: '0.5px',
																	boxShadow: '0 2px 4px rgba(33, 150, 243, 0.3)'
																}}>
																	EDITING
																</span>
															)}
															<div className="question-single-line" style={state.isMobileView ? {
																display: 'flex',
																flexWrap: 'wrap',
																gap: '0.75rem',
																width: '100%',
																overflow: 'visible',
																alignItems: 'center'
															} : {}}>
																<select
																	className="voice-select"
																	disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																	style={state.isMobileView ? {
																		flexShrink: '0'
																	} : {}}
																	onchange={(e) => {
																		dispatch('UPDATE_QUESTION_VOICE', {
																			questionId: question.ids.id,
																			newVoice: e.target.value
																		});
																	}}
																	onmousedown={(e) => {
																		e.stopPropagation();
																	}}
																	onfocus={(e) => {
																		e.stopPropagation();
																	}}
																>
																	<option value="CaseManager" selected={question.voice === 'CaseManager'}>Case Manager</option>
																	<option value="Caregiver" selected={question.voice === 'Caregiver'}>Caregiver</option>
																	<option value="Patient" selected={question.voice === 'Patient'}>Patient</option>
																</select>
																<div className="typeahead-container">
																	<input
																		type="text"
																		className="question-label-input"
																		value={question.label}
																		placeholder="Enter question text..."
																		disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																		oninput={(e) => {
																			const newValue = e.target.value;
																			// Update the question label locally
																			dispatch('UPDATE_QUESTION_LABEL', {
																				questionId: question.ids.id,
																				newLabel: newValue
																			});
																			// Trigger typeahead search if length >= 3
																			if (newValue.length >= 2) {
																				dispatch('QUESTION_TYPEAHEAD_INPUT_CHANGE', {
																					searchText: newValue,
																					questionId: question.ids.id
																				});
																			} else {
																				dispatch('QUESTION_TYPEAHEAD_HIDE');
																			}
																		}}
																		onkeydown={(e) => {
																			if (e.key === 'Enter') {
																				if (state.questionTypeaheadVisible && state.questionTypeaheadSelectedIndex >= 0) {
																					e.preventDefault();
																					dispatch('QUESTION_TYPEAHEAD_KEYBOARD', { key: 'Enter' });
																				}
																			} else if (e.key === 'Escape') {
																				if (state.questionTypeaheadVisible) {
																					dispatch('QUESTION_TYPEAHEAD_HIDE');
																				}
																			} else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
																				e.preventDefault();
																				dispatch('QUESTION_TYPEAHEAD_KEYBOARD', { key: e.key });
																			}
																		}}
																		onblur={(e) => {
																			// Hide typeahead after a short delay to allow selection
																			setTimeout(() => {
																				dispatch('QUESTION_TYPEAHEAD_HIDE');
																			}, 150);
																		}}
																	onmousedown={(e) => {
																		e.stopPropagation();
																	}}
																	onfocus={(e) => {
																		e.stopPropagation();
																	}}
																/>
																{state.questionTypeaheadVisible && state.editingQuestionId === question.ids.id && (
																	<div className="typeahead-dropdown">
																		{state.questionTypeaheadLoading ? (
																			<div className="typeahead-item loading">
																				<div className="loading-spinner"></div>
																				Searching for questions...
																			</div>
																		) : state.questionTypeaheadResults && state.questionTypeaheadResults.length > 0 ? (
																			state.questionTypeaheadResults.map((result, index) => (
																				<div
																					key={result.id}
																					className={`typeahead-item ${index === state.questionTypeaheadSelectedIndex ? 'selected' : ''}`}
																					onclick={(e) => {
																						e.preventDefault();
																						e.stopPropagation();
																						dispatch('SELECT_LIBRARY_QUESTION', {
																							questionId: question.ids.id,
																							libraryQuestion: result
																						});
																					}}
																					onmousedown={(e) => {
																						e.preventDefault();
																						e.stopPropagation();
																					}}
																				>
																					<div className={`typeahead-item-title ${result.exact_match ? 'exact-match' : ''}`}>{result.name}</div>
																				</div>
																			))
																		) : state.questionTypeaheadQuery.length >= 2 && !state.questionTypeaheadLoading ? (
																			<div className="typeahead-item no-results">
																				No matching questions found for "{state.questionTypeaheadQuery}"
																			</div>
																		) : null}
																	</div>
																)}
															</div>
																<div className="tooltip-edit-icon">
																	<span
																		className={`tooltip-icon ${question.tooltip ? 'has-tooltip' : 'no-tooltip'}`}
																		title="Click to edit tooltip"
																		style={hasAnyUnsavedChanges(state) && !question.isUnsaved ? {
																			opacity: 0.5,
																			cursor: 'not-allowed'
																		} : {}}
																		onclick={(e) => {
																			e.stopPropagation();
																			if (hasAnyUnsavedChanges(state) && !question.isUnsaved) {
																				return; // Blocked when other questions have changes
																			}
																			dispatch('EDIT_QUESTION_TOOLTIP', {
																				questionId: question.ids.id,
																				currentTooltip: question.tooltip || ''
																			});
																		}}
																	>
																		ⓘ
																	</span>
																</div>
															</div>
															<div className="question-controls" style={state.isMobileView ? {
																display: 'flex',
																flexWrap: 'wrap',
																gap: '0.75rem',
																width: '100%',
																overflow: 'visible'
															} : {}}>
																<label className="checkbox-control">
																	<input
																		type="checkbox"
																		checked={question.required}
																		disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																		onchange={(e) => {
																			dispatch('UPDATE_QUESTION_REQUIRED', {
																				questionId: question.ids.id,
																				required: e.target.checked
																			});
																		}}
																		onmousedown={(e) => {
																			e.stopPropagation();
																		}}
																		onfocus={(e) => {
																			e.stopPropagation();
																		}}
																	/>
																	Required
																</label>
																<select
																	className="question-type-select"
																	disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																	style={state.isMobileView ? {
																		flexShrink: '0'
																	} : {}}
																	onchange={(e) => {
																	dispatch('UPDATE_QUESTION_TYPE', {
																		questionId: question.ids.id,
																		newType: e.target.value
																	});
																}} onmousedown={(e) => {
																	e.stopPropagation();
																}} onfocus={(e) => {
																	e.stopPropagation();
																}}>
																	<option value="Single Select" selected={question.type === 'Single Select'}>Single Select</option>
																	<option value="Multiselect" selected={question.type === 'Multiselect'}>Multiselect</option>
																	<option value="Text" selected={question.type === 'Text'}>Text</option>
																	<option value="Date" selected={question.type === 'Date'}>Date</option>
																	<option value="Numeric" selected={question.type === 'Numeric'}>Numeric</option>
																</select>
																<span
																	className="custom-attributes-icon"
																	title="Click to add, remove or change custom attributes"
																	style={hasAnyUnsavedChanges(state) && !question.isUnsaved ? {
																		opacity: 0.5,
																		cursor: 'not-allowed'
																	} : {}}
																	onclick={() => {
																		if (hasAnyUnsavedChanges(state) && !question.isUnsaved) {
																			return; // Blocked when other questions have changes
																		}
																		dispatch('OPEN_CUSTOM_ATTRIBUTES_MODAL', {
																			itemType: 'question',
																			itemId: question.ids.id,
																			currentAttributes: question.custom_attributes || {}
																		});
																	}}
																>
																	CA
																</span>
																{question.isUnsaved && [
																	<div
																		key="save-cancel-buttons"
																		style={{
																			display: 'flex',
																			flexDirection: 'column',
																			gap: '2px',
																			marginRight: '5px',
																			...(state.isMobileView ? {
																				flexShrink: '0',
																				marginBottom: '0.5rem'
																			} : {})
																		}}
																	>
																		<button
																			className="save-question-btn"
																			title="Save Question"
																			style={{
																				backgroundColor: '#28a745',
																				color: 'white',
																				border: 'none',
																				borderRadius: '3px',
																				padding: '4px 8px',
																				cursor: 'pointer',
																				fontSize: '12px',
																				width: '100%'
																			}}
																			onclick={() => {
																				dispatch('SAVE_QUESTION_IMMEDIATELY', {
																					questionId: question.ids.id
																				});
																			}}
																		>
																			💾 Save
																		</button>
																		<button
																			className="cancel-question-btn"
																			title="Cancel Changes"
																			style={{
																				backgroundColor: '#6c757d',
																				color: 'white',
																				border: 'none',
																				borderRadius: '3px',
																				padding: '4px 8px',
																				cursor: 'pointer',
																				fontSize: '11px',
																				width: '100%'
																			}}
																			onclick={() => {
																				dispatch('CANCEL_QUESTION_CHANGES', {
																					questionId: question.ids.id
																				});
																			}}
																		>
																			↶ Cancel
																		</button>
																	</div>
																]}
																<button
																	className="delete-question-btn"
																	title="Delete Question"
																	disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																	style={state.isMobileView ? {
																		flexShrink: '0',
																		minWidth: '40px',
																		marginBottom: '0.5rem'
																	} : {}}
																	onclick={(e) => {
																		e.stopPropagation();
																		e.preventDefault();
																		dispatch('DELETE_QUESTION', {
																			questionId: question.ids.id
																		});
																	}}
																>
																	🗑️
																</button>
																{question.isUnsaved && (question.type === 'Single Select' || question.type === 'Multiselect') && (
																	<button
																		className="save-bundle-btn"
																		title="Click to save the question bundle"
																		disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																		style={state.isMobileView ? {
																			flexShrink: '0',
																			minWidth: '40px',
																			marginBottom: '0.5rem',
																			marginLeft: '4px'
																		} : {
																			marginLeft: '4px'
																		}}
																		onclick={() => {
																			dispatch('SAVE_QUESTION_BUNDLE', {
																				questionId: question.ids.id,
																				questionLabel: question.label
																			});
																		}}
																	>
																		📦
																	</button>
																)}
															</div>
														</div>
													) : (
														<div className="question-preview-header">
															<div className="question-preview-line">
																<span className="voice-display">{question.voice === 'CaseManager' ? 'CASE MANAGER' : question.voice === 'Caregiver' ? 'CAREGIVER' : question.voice === 'Patient' ? 'PATIENT' : 'CASE MANAGER'}</span>
																<h4 className="question-label">
																	{qIndex + 1}. {question.label}
																	{question.required && <span className="required-indicator">*</span>}
																	{question.tooltip && (
																		<span className="tooltip-icon" title={question.tooltip}>ⓘ</span>
																	)}
																</h4>
															</div>
															<div className="question-meta">
																<span className="question-type">{question.type}</span>
																{question.hidden && <span className="hidden-indicator">Hidden</span>}
															</div>
														</div>
													)}
												</div>

												{state.libraryQuestionLoading === question.ids.id && (
													<div className="library-loading-overlay" style={{
														padding: '10px',
														textAlign: 'center',
														backgroundColor: '#f8f9fa',
														border: '1px solid #dee2e6',
														borderRadius: '4px',
														margin: '5px 0',
														color: '#6c757d'
													}}>
														⏳ Loading library question and answers...
													</div>
												)}

												<div className="question-body">
													{/* Single Select Questions */}
													{question.type === 'Single Select' && (
														<div className="answer-options single-select">
															{question.answers
																.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
																.map((answer, aIndex) => (
																<div 
																	key={answer.ids.id} 
																	className={`answer-option ${isEditable ? 'editable draggable-answer' : ''}`} 
																	draggable={false}
																	data-debugeditable={isEditable}
																	data-debugbuildermode={state.builderMode}
																	data-debugstatus={state.currentAssessment?.status}
																	onclick={(e) => {
																		if (isEditable) {
																			e.stopPropagation();
																		}
																	}}
																	ondragend={isEditable ? (e) => {
																		e.currentTarget.classList.remove('dragging');
																	} : null}
																	ondragover={isEditable ? (e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		e.currentTarget.classList.add('drag-over');
																	} : null}
																	ondragleave={isEditable ? (e) => {
																		e.currentTarget.classList.remove('drag-over');
																	} : null}
																	ondrop={isEditable ? (e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		e.currentTarget.classList.remove('drag-over');
																		
																		try {
																			const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
																			if (dragData.type === 'answer' && dragData.questionId === question.ids.id) {
																				dispatch('REORDER_ANSWERS', {
																					questionId: question.ids.id,
																					sourceIndex: dragData.sourceIndex,
																					targetIndex: aIndex
																				});
																			}
																		} catch (error) {
																			console.error('Error handling answer drop:', error);
																		}
																	} : null}
																>
																	{isEditable ? (
																			<div 
																				className="answer-drag-handle" 
																				title="Drag to reorder"
																				draggable={true}
																				ondragstart={(e) => {
																					e.dataTransfer.setData('text/plain', JSON.stringify({
																						type: 'answer',
																						questionId: question.ids.id,
																						answerId: answer.ids.id,
																						sourceIndex: aIndex
																					}));
																					e.dataTransfer.effectAllowed = 'move';
																					e.stopPropagation(); // Prevent question drag
																					
																					// Add visual feedback to the parent answer
																					const parentElement = e.target.closest('.answer-option');
																					if (parentElement) {
																						parentElement.classList.add('dragging');
																					}
																				}}
																				ondragend={(e) => {
																					// Remove visual feedback
																					const parentElement = e.target.closest('.answer-option');
																					if (parentElement) {
																						parentElement.classList.remove('dragging');
																					}
																				}}
																			>
																				⋮⋮
																			</div>
																		) : null}
																	{isEditable ? (
																		<div className="answer-edit" style={answer.isDeleted ? {opacity: 0.5, backgroundColor: '#fee2e2'} : {}}>
																			<div className="answer-single-line">
																				<span className="answer-number">{aIndex + 1}.</span>
																				<div className="typeahead-container">
																					<input
																						type="text"
																						className="answer-label-input"
																						value={answer.label}
																						placeholder="Enter answer text..."
																						disabled={answer.isDeleted || (hasAnyUnsavedChanges(state) && !question.isUnsaved)}
																						style={answer.isDeleted ? {textDecoration: 'line-through'} : {}}
																						oninput={(e) => {
																							const newValue = e.target.value;
																							// Update the answer label locally
																							dispatch('UPDATE_ANSWER_LABEL', {
																								answerId: answer.ids.id,
																								newLabel: newValue
																							});
																							// Trigger typeahead search if length >= 3
																							if (newValue.length >= 2) {
																								dispatch('ANSWER_TYPEAHEAD_INPUT_CHANGE', {
																									searchText: newValue,
																									answerId: answer.ids.id
																								});
																							} else {
																								dispatch('ANSWER_TYPEAHEAD_HIDE');
																							}
																						}}
																						onkeydown={(e) => {
																							if (e.key === 'Escape') {
																								if (state.answerTypeaheadVisible) {
																									dispatch('ANSWER_TYPEAHEAD_HIDE');
																								}
																							}
																						}}
																						onblur={(e) => {
																							// Hide typeahead after a short delay to allow selection
																							setTimeout(() => {
																								dispatch('ANSWER_TYPEAHEAD_HIDE');
																							}, 150);
																						}}
																						onmousedown={(e) => {
																							e.stopPropagation();
																						}}
																						onfocus={(e) => {
																							e.stopPropagation();
																						}}
																					/>
																					{state.answerTypeaheadVisible && state.editingAnswerId === answer.ids.id && (
																						<div className="typeahead-dropdown">
																							{state.answerTypeaheadLoading ? (
																								<div className="typeahead-item loading">
																									<div className="loading-spinner"></div>
																									Searching for answers...
																								</div>
																							) : state.answerTypeaheadResults && state.answerTypeaheadResults.length > 0 ? (
																								state.answerTypeaheadResults.map((result, index) => (
																									<div
																										key={result.id}
																										className="typeahead-item"
																										onclick={(e) => {
																											e.preventDefault();
																											e.stopPropagation();
																											dispatch('SELECT_LIBRARY_ANSWER', {
																												answerId: answer.ids.id,
																												libraryAnswer: result
																											});
																										}}
																										onmousedown={(e) => {
																											e.preventDefault();
																											e.stopPropagation();
																										}}
																									>
																										<div className={`typeahead-item-title ${result.exact_match ? 'exact-match' : ''}`}>{result.name}</div>
																									</div>
																								))
																							) : state.answerTypeaheadQuery && state.answerTypeaheadQuery.length >= 2 && !state.answerTypeaheadLoading ? (
																								<div className="typeahead-item no-results">
																									No matching answers found for "{state.answerTypeaheadQuery}"
																								</div>
																							) : null}
																						</div>
																					)}
																				</div>

																				{/* Score input box for Single Select and Multiselect questions when scoring model is selected */}
																				{state.selectedScoringModel && (question.type === 'Single Select' || question.type === 'Multiselect') && (
																					<div className="score-input-container" style={{
																						marginLeft: '8px',
																						display: 'flex',
																						alignItems: 'center',
																						gap: '4px'
																					}}>
																						<label style={{
																							fontSize: '12px',
																							color: '#666',
																							whiteSpace: 'nowrap'
																						}}>
																							Score:
																						</label>
																						<input
																							type="number"
																							min="0"
																							className="answer-score-input"
																							value={answer.scoring?.[state.selectedScoringModel?.id] || ''}
																							placeholder="0"
																							style={{
																								width: '60px',
																								padding: '4px 6px',
																								border: '1px solid #ccc',
																								borderRadius: '3px',
																								fontSize: '12px',
																								textAlign: 'center'
																							}}
																							oninput={(e) => {
																								const score = e.target.value;
																								dispatch('UPDATE_ANSWER_SCORE', {
																									answerId: answer.ids.id,
																									score: score
																								});
																							}}
																							onclick={(e) => {
																								e.stopPropagation();
																							}}
																							onmousedown={(e) => {
																								e.stopPropagation();
																							}}
																						/>
																					</div>
																				)}

																				<div className="answer-tooltip-icon">
																					<span
																						className={`tooltip-icon ${answer.tooltip ? 'has-tooltip' : 'no-tooltip'}`}
																						title="Click to edit tooltip"
																						style={hasAnyUnsavedChanges(state) && !question.isUnsaved ? {
																							opacity: 0.5,
																							cursor: 'not-allowed'
																						} : {}}
																						onclick={(e) => {
																							e.stopPropagation();
																							if (hasAnyUnsavedChanges(state) && !question.isUnsaved) {
																								return; // Blocked when other questions have changes
																							}
																							dispatch('EDIT_ANSWER_TOOLTIP', {
																								answerId: answer.ids.id,
																								currentTooltip: answer.tooltip || ''
																							});
																						}}
																					>
																						ⓘ
																					</span>
																				</div>
																				<span
																					className="custom-attributes-icon"
																					title="Click to add, remove or change custom attributes"
																					style={hasAnyUnsavedChanges(state) && !question.isUnsaved ? {
																						opacity: 0.5,
																						cursor: 'not-allowed'
																					} : {}}
																					onclick={() => {
																						if (hasAnyUnsavedChanges(state) && !question.isUnsaved) {
																							return; // Blocked when other questions have changes
																						}
																						dispatch('OPEN_CUSTOM_ATTRIBUTES_MODAL', {
																							itemType: 'answer',
																							itemId: answer.ids.id,
																							currentAttributes: answer.custom_attributes || {}
																						});
																					}}
																				>
																					CA
																				</span>
																				<div className="answer-controls" style={state.isMobileView ? {
																					display: 'flex',
																					flexWrap: 'wrap',
																					gap: '0.75rem',
																					width: '100%',
																					overflow: 'visible'
																				} : {}}>
																					<select
																						className="secondary-input-select"
																						disabled={answer.isDeleted || (hasAnyUnsavedChanges(state) && !question.isUnsaved)}
																						style={answer.isDeleted ? {textDecoration: 'line-through'} : {}}
																						style={state.isMobileView ? {
																							flexShrink: '0'
																						} : {}}
																						onchange={(e) => {
																							dispatch('UPDATE_ANSWER_SECONDARY_INPUT', {
																								answerId: answer.ids.id,
																								newSecondaryInputType: e.target.value || null
																							});
																						}}
																					>
																						<option value="" selected={!answer.secondary_input_type}>No secondary input</option>
																						<option value="text" selected={answer.secondary_input_type === 'text'}>Text input</option>
																						<option value="date" selected={answer.secondary_input_type === 'date'}>Date input</option>
																						<option value="numeric" selected={answer.secondary_input_type === 'numeric'}>Numeric input</option>
																					</select>
																					<button
																						className="delete-answer-btn"
																						title="Delete Answer"
																						disabled={answer.isDeleted || (hasAnyUnsavedChanges(state) && !question.isUnsaved)}
																						style={answer.isDeleted ? {textDecoration: 'line-through'} : {}}
																						style={state.isMobileView ? {
																							flexShrink: '0'
																						} : {}}
																						onclick={() => {
																							dispatch('DELETE_ANSWER', {
																								answerId: answer.ids.id,
																								questionId: question.ids.id
																							});
																						}}
																					>
																						🗑️
																					</button>
																				</div>
																			</div>
																			{/* Show triggered questions indicator in edit mode */}
																			{answer.triggered_questions && answer.triggered_questions.length > 0 && (
																				<div className="triggered-questions-indicator">
																					<span className="trigger-icon">🔗</span>
																					<span className="trigger-text">
																						Triggers {answer.triggered_questions.length} question{answer.triggered_questions.length !== 1 ? 's' : ''}
																					</span>
																					<div className="trigger-details">
																						{answer.triggered_questions.map((triggeredId, triggerIndex) => {
																							// Find the triggered question to show its label
																							const triggeredQuestion = state.currentQuestions?.questions?.find(q => q.ids.id === triggeredId);
																							return (
																								<div key={triggerIndex} className="triggered-question-item">
																									<span className="triggered-question-label">
																										→ {triggeredQuestion?.label || `Question ${triggeredId.substring(0, 8)}...`}
																									</span>
																									<button 
																										className="delete-triggered-question-btn"
																										onclick={(e) => {
																											e.stopPropagation();
																											dispatch('REMOVE_TRIGGERED_QUESTION', {
																												answerId: answer.ids.id,
																												questionId: triggeredId,
																												questionLabel: triggeredQuestion?.label || 'Unknown Question'
																											});
																										}}
																										title="Remove triggered question"
																										style={{
																											display: isEditable ? 'flex' : 'none',
																											backgroundColor: isEditable ? '#fee2e2' : 'gray'
																										}}
																									>
																										🗑️ DEBUG
																									</button>
																								</div>
																							);
																						})}
																					</div>
																				</div>
																			)}
																			
																			{/* Show guideline relationships indicator in edit mode */}
																			{(() => {
																				// Find guideline relationships for this answer
																				const guidelineRelationships = Object.values(state.relationshipChanges || {}).filter(change =>
																					change.answerId === answer.ids.id &&
																					change.relationshipType === 'guideline' &&
																					change.action === 'add'
																				);

																				return guidelineRelationships.length > 0 && (
																					<div className="triggered-questions-indicator guideline-indicator">
																						<span className="trigger-icon">📋</span>
																						<span className="trigger-text">
																							Links to {guidelineRelationships.length} guideline{guidelineRelationships.length !== 1 ? 's' : ''}
																						</span>
																						<div className="trigger-details">
																							{guidelineRelationships.map((relationship, relationshipIndex) => (
																								<div key={relationshipIndex} className="triggered-question-item guideline-relationship-item">
																									<span className="triggered-question-label guideline-relationship-label">
																										→ {relationship.targetLabel}
																									</span>
																									{isEditable && (
																										<button 
																											className="cancel-relationship-btn"
																											onclick={(e) => {
																												e.stopPropagation();
																												dispatch('REMOVE_GUIDELINE_RELATIONSHIP', {
																													answerId: answer.ids.id,
																													guidelineId: relationship.targetId,
																													guidelineName: relationship.targetLabel
																												});
																											}}
																											title="Remove guideline relationship"
																											style={{
																												display: isEditable ? 'flex' : 'none',
																											}}
																										>
																											<XIcon />
																										</button>
																									)}
																								</div>
																							))}
																						</div>
																					</div>
																				);
																			})()}
																			
																			{/* Relationship button/counts */}
																			{isEditable && state.showRelationships && (
																				<div className="answer-relationships">
																					{!state.relationshipsLoading[answer.ids.id] ? (
																						<button
																							className="load-relationships-btn"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('OPEN_RELATIONSHIP_MODAL', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							{(() => {
																								if (!answer.counts) return 'Manage Relationships';

																								const labels = [
																									{ key: 'triggered_guidelines', label: 'G' },
																									{ key: 'problems', label: 'P' },
																									{ key: 'triggered_questions', label: 'Q' },
																									{ key: 'evidence', label: 'E' },
																									{ key: 'barriers', label: 'B' }
																								];

																								const displayCounts = labels
																									.filter(item => answer.counts[item.key] && answer.counts[item.key] > 0)
																									.map(item => `${item.label}: ${answer.counts[item.key]}`);

																								return displayCounts.length > 0 ? displayCounts.join(' ') : 'Manage Relationships';
																							})()}
																						</button>
																					) : (
																						<div className="relationships-loading">
																							⏳ Loading relationships...
																						</div>
																					)}
																				</div>
																			)}
																			
																			{/* OLD Relationship display (DISABLED - now using modal) */}
																			{false && isEditable && state.showRelationships && state.answerRelationships[answer.ids.id] && (
																				<div className="relationships-display">
																					<div className="relationships-header">
																						🔍 <strong>Relationships for "{answer.label}"</strong>
																						<button
																							className="refresh-relationships-btn"
																							title="Refresh relationships"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('LOAD_ANSWER_RELATIONSHIPS', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							🔄
																						</button>
																						<button
																							className="edit-relationships-btn"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('OPEN_RELATIONSHIP_MODAL', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							✏️ Edit
																						</button>
																						<button
																							className="close-relationships-btn"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('CLOSE_ANSWER_RELATIONSHIPS', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							<XIcon />
																						</button>
																					</div>
																					<div className="relationships-content">
																						{state.answerRelationships[answer.ids.id].questions?.questions?.length > 0 && (
																							<div className="relationship-section">
																								<span className="relationship-label">Questions ({state.answerRelationships[answer.ids.id].questions.questions_quantity})</span>
																								<div className="relationship-items">
																									{state.answerRelationships[answer.ids.id].questions.questions.map((question, qIndex) => (
																										<div key={qIndex} className="relationship-item">
																											<span className="relationship-item-label">→ {question.label}</span>
																											<button 
																												className="delete-relationship-btn"
																												onclick={(e) => {
																													e.stopPropagation();
																													dispatch('REMOVE_TRIGGERED_QUESTION', {
																														answerId: answer.ids.id,
																														questionId: question.id,
																														questionLabel: question.label
																													});
																												}}
																												title="Remove triggered question"
																											>
																												🗑️
																											</button>
																										</div>
																									))}
																								</div>
																							</div>
																						)}
																						{state.answerRelationships[answer.ids.id].problems?.problems?.length > 0 && (
																							<div className="relationship-section">
																								<span className="relationship-label">Problems ({state.answerRelationships[answer.ids.id].problems.problems_quantity})</span>
																								<div className="relationship-items">
																									{state.answerRelationships[answer.ids.id].problems.problems.map((problem, pIndex) => (
																										<span key={pIndex} className="relationship-item">
																											→ {problem.label || problem.name}
																										</span>
																									))}
																								</div>
																							</div>
																						)}
																						{state.answerRelationships[answer.ids.id].barriers?.barriers?.length > 0 && (
																							<div className="relationship-section">
																								<span className="relationship-label">Barriers ({state.answerRelationships[answer.ids.id].barriers.barriers_quantity})</span>
																								<div className="relationship-items">
																									{state.answerRelationships[answer.ids.id].barriers.barriers.map((barrier, bIndex) => (
																										<span key={bIndex} className="relationship-item">
																											→ {barrier.label || barrier.name}
																										</span>
																									))}
																								</div>
																							</div>
																						)}
																						{state.answerRelationships[answer.ids.id].guidelines?.guidelines?.length > 0 && (
																							<div className="relationship-section">
																								<span className="relationship-label">Guidelines ({state.answerRelationships[answer.ids.id].guidelines.guidelines_quantity})</span>
																								<div className="relationship-items">
																									{state.answerRelationships[answer.ids.id].guidelines.guidelines.map((guideline, gIndex) => (
																										<span key={gIndex} className="relationship-item">
																											→ {guideline.use_case_category?.name ? `${guideline.label || guideline.name} - ${guideline.use_case_category.name}` : (guideline.label || guideline.name)}
																										</span>
																									))}
																								</div>
																							</div>
																						)}
																						{/* Show message if no relationships */}
																						{(!state.answerRelationships[answer.ids.id].questions?.questions?.length && 
																						  !state.answerRelationships[answer.ids.id].problems?.problems?.length &&
																						  !state.answerRelationships[answer.ids.id].barriers?.barriers?.length &&
																						  !state.answerRelationships[answer.ids.id].guidelines?.guidelines?.length) && (
																							<div className="no-relationships">
																								No relationships found for this answer.
																							</div>
																						)}
																						
																						{/* Add Relationship Section */}
																						{state.addingRelationship === answer.ids.id ? (
																							<div className="add-relationship-form">
																								<div className="relationship-type-selector">
																									<label>Select Relationship Type:</label>
																									<select 
																										value={state.selectedRelationshipType || ''}
																										onchange={(e) => {
																											dispatch('SET_RELATIONSHIP_TYPE', {
																												relationshipType: e.target.value
																											});
																										}}
																									>
																										<option value="">Choose type...</option>
																										<option value="question">Triggered Question</option>
																										<option value="problem">Problem</option>
																										<option value="barrier">Barrier</option>
																										<option value="guideline">Guideline</option>
																									</select>
																								</div>
																								
																								{state.selectedRelationshipType === 'question' && (
																									<div className="question-typeahead-section">
																										<label>Select Question from Current Section:</label>
																										<div className="typeahead-container">
																											<input 
																												type="text" 
																												className="relationship-typeahead-input"
																												placeholder="Type to search questions..."
																												value={state.relationshipTypeaheadText || ''}
																												oninput={(e) => {
																													dispatch('RELATIONSHIP_TYPEAHEAD_INPUT', {
																														text: e.target.value,
																														answerId: answer.ids.id
																													});
																												}}
																											/>
																											{state.relationshipTypeaheadResults && state.relationshipTypeaheadResults.length > 0 && (
																												<div
																													className="typeahead-dropdown"
																													hook-insert={(vnode) => {
																														const input = vnode.elm.parentElement.querySelector('.relationship-typeahead-input');
																														if (input) {
																															const rect = input.getBoundingClientRect();
																															vnode.elm.style.top = `${rect.bottom}px`;
																															vnode.elm.style.left = `${rect.left}px`;
																															vnode.elm.style.width = `${rect.width}px`;
																														}
																													}}
																													hook-update={(oldVnode, vnode) => {
																														const input = vnode.elm.parentElement.querySelector('.relationship-typeahead-input');
																														if (input) {
																															const rect = input.getBoundingClientRect();
																															vnode.elm.style.top = `${rect.bottom}px`;
																															vnode.elm.style.left = `${rect.left}px`;
																															vnode.elm.style.width = `${rect.width}px`;
																														}
																													}}
																												>
																													{state.relationshipTypeaheadResults.map((question, index) => (
																														<div 
																															key={question.ids?.id || index}
																															className="typeahead-item"
																															onclick={(e) => {
																																e.stopPropagation();
																																e.preventDefault();
																																dispatch('SELECT_RELATIONSHIP_QUESTION', {
																																	answerId: answer.ids.id,
																																	questionId: question.ids.id,
																																	questionLabel: question.label
																																});
																															}}
																														>
																															{question.label}
																														</div>
																													))}
																												</div>
																											)}
																										</div>
																									</div>
																								)}
																								
																								{state.selectedRelationshipType === 'guideline' && (
																									<div className="guideline-typeahead-section">
																										<label>Search Guidelines:</label>
																										<div className="typeahead-container">
																											<input
																												type="text"
																												className="relationship-typeahead-input"
																												placeholder="Type to search guidelines (min 3 chars)..."
																												value={state.relationshipTypeaheadText || ''}
																												oninput={(e) => {
																													dispatch('GUIDELINE_TYPEAHEAD_INPUT', {
																														text: e.target.value,
																														answerId: answer.ids.id
																													});
																												}}
																												onkeydown={(e) => {
																													if (e.key === 'Escape') {
																														dispatch('GUIDELINE_TYPEAHEAD_HIDE');
																													}
																												}}
																												onblur={(e) => {
																													// Hide typeahead after a short delay to allow selection
																													setTimeout(() => {
																														dispatch('GUIDELINE_TYPEAHEAD_HIDE');
																													}, 150);
																												}}
																											/>
																											{state.relationshipTypeaheadResults && state.relationshipTypeaheadResults.length > 0 && (
																												<div className="typeahead-dropdown">
																													{state.relationshipTypeaheadResults.map((guideline, index) => (
																														<div 
																															key={guideline.id || index}
																															className="typeahead-item"
																															onclick={(e) => {
																																e.stopPropagation();
																																e.preventDefault();
																																dispatch('SELECT_RELATIONSHIP_GUIDELINE', {
																																	answerId: answer.ids.id,
																																	guidelineId: guideline.id,
																																	guidelineName: guideline.name,
																																	guidelineMasterId: guideline.master_id,
																																	guidelineCategory: guideline.use_case_category?.name
																																});
																															}}
																														>
																															<div className="guideline-item">
																																<div className="guideline-name">{guideline.name}</div>
																																<div className="guideline-category">{guideline.use_case_category?.name}</div>
																															</div>
																														</div>
																													))}
																												</div>
																											)}
																										</div>
																									</div>
																								)}
																								
																								<div className="add-relationship-buttons">
																									{state.selectedRelationshipQuestion ? (
																										<div className="relationship-confirm-buttons">
																											<button 
																												className="confirm-relationship-btn"
																												onclick={(e) => {
																													e.stopPropagation();
																													e.preventDefault();
																													dispatch('CONFIRM_ADD_RELATIONSHIP', {
																														answerId: answer.ids.id
																													});
																												}}
																												title="Confirm relationship"
																											>
																												<CheckIcon />
																											</button>
																											<button 
																												className="cancel-relationship-btn"
																												onclick={() => {
																													dispatch('CANCEL_ADD_RELATIONSHIP');
																												}}
																												title="Cancel"
																											>
																												<XIcon />
																											</button>
																										</div>
																									) : (
																										<button 
																											className="cancel-relationship-btn"
																											onclick={() => {
																												dispatch('CANCEL_ADD_RELATIONSHIP');
																											}}
																										>
																											Cancel
																										</button>
																									)}
																								</div>
																							</div>
																						) : (
																							<div className="add-relationship-section">
																								<button 
																									className="add-relationship-btn"
																									onclick={() => {
																										dispatch('START_ADD_RELATIONSHIP', {
																											answerId: answer.ids.id
																										});
																									}}
																								>
																									+ Add Relationship
																								</button>
																							</div>
																						)}
																					</div>
																				</div>
																			)}
																		</div>
																	) : (
																		<div className="answer-container">
																			<label className="answer-label">
																				<input
																					type="radio"
																					name={`question-${question.ids.id}`}
																					value={answer.ids.id}
																					checked={state.selectedAnswers[question.ids.id]?.includes(answer.ids.id) || false}
																					onchange={(event) => {
																						if (event.target.checked) {
																							// Handle mutually exclusive logic first
																							if (answer.mutually_exclusive) {
																								dispatch('HANDLE_MUTUALLY_EXCLUSIVE', {
																									questionId: question.ids.id,
																									answerId: answer.ids.id
																								});
																							} else {
																								dispatch('SELECT_ANSWER', {
																									questionId: question.ids.id,
																									answerId: answer.ids.id,
																									questionType: question.type
																								});
																							}
																						}
																					}}
																				/>
																				<span className="answer-text">
																					{answer.label}
																					{answer.secondary_input_type && (
																						<span className="secondary-indicator">📝</span>
																					)}
																					{answer.tooltip && (
																						<span className="tooltip-icon" title={answer.tooltip}>ⓘ</span>
																					)}
																					{/* PGI Badge for preview mode */}
																					{!isEditable && answer.counts && (() => {
																						const hasPGI = (answer.counts.problems || 0) > 0 ||
																									   (answer.counts.triggered_guidelines || 0) > 0 ||
																									   (answer.counts.barriers || 0) > 0;
																						const hasRelationships = hasPGI ||
																											   (answer.counts.triggered_questions || 0) > 0 ||
																											   (answer.counts.evidence || 0) > 0;

																						if (!hasRelationships) {
																							return (
																								<span className="pgi-badge no-relationships" style={{
																									marginLeft: '8px',
																									padding: '2px 6px',
																									backgroundColor: '#e5e7eb',
																									color: '#6b7280',
																									borderRadius: '10px',
																									fontSize: '11px',
																									fontWeight: '500',
																									cursor: 'default'
																								}}>
																									No relationships
																								</span>
																							);
																						}

																						if (hasPGI) {
																							const pgiLabels = [];
																							if (answer.counts.problems > 0) pgiLabels.push(`P: ${answer.counts.problems}`);
																							if (answer.counts.triggered_guidelines > 0) pgiLabels.push(`G: ${answer.counts.triggered_guidelines}`);
																							if (answer.counts.barriers > 0) pgiLabels.push(`B: ${answer.counts.barriers}`);

																							return (
																								<span
																									className="pgi-badge clickable"
																									style={{
																										marginLeft: '8px',
																										padding: '2px 6px',
																										backgroundColor: '#dbeafe',
																										color: '#1e40af',
																										borderRadius: '10px',
																										fontSize: '11px',
																										fontWeight: '500',
																										cursor: 'pointer',
																										border: '1px solid #93c5fd'
																									}}
																									onclick={(e) => {
																										e.stopPropagation();
																										e.preventDefault();
																										dispatch('OPEN_PGI_MODAL', {
																											answerId: answer.ids.id
																										});
																									}}
																									title="Click to view Problems, Goals, Interventions, and Barriers"
																								>
																									{pgiLabels.join(' ')}
																								</span>
																							);
																						}

																						return null;
																					})()}
																				</span>
																			</label>
																			{/* Show secondary input below answer if this answer is selected */}
																			{!state.builderMode && state.selectedAnswers[question.ids.id]?.includes(answer.ids.id) && answer.secondary_input_type && (
																				<div className="secondary-input">
																					{answer.secondary_input_type === 'text' && (
																						<input type="text" placeholder="Please specify..." className="secondary-text-input" />
																					)}
																					{answer.secondary_input_type === 'date' && (
																						<input type="date" className="secondary-date-input" />
																					)}
																					{answer.secondary_input_type === 'numeric' && (
																						<input type="number" placeholder="Enter number..." className="secondary-numeric-input" />
																					)}
																				</div>
																			)}
																		</div>
																	)}
																</div>
															))}
															{isEditable ? (
																<button
																	className="add-answer-btn"
																	disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																	onclick={() => dispatch('ADD_ANSWER', {
																		questionId: question.ids.id
																	})}
																>
																	+ Add Answer
																</button>
															) : null}
														</div>
													)}
													
													{/* Multiselect Questions */}
													{question.type === 'Multiselect' && (
														<div className="answer-options multiselect">
															{question.answers
																.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
																.map((answer, aIndex) => (
																<div 
																	key={answer.ids.id} 
																	className={`answer-option ${isEditable ? 'editable draggable-answer' : ''}`} 
																	draggable={false}
																	data-debugeditable={isEditable}
																	data-debugbuildermode={state.builderMode}
																	data-debugstatus={state.currentAssessment?.status}
																	onclick={(e) => {
																		if (isEditable) {
																			e.stopPropagation();
																		}
																	}}
																	ondragend={isEditable ? (e) => {
																		e.currentTarget.classList.remove('dragging');
																	} : null}
																	ondragover={isEditable ? (e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		e.currentTarget.classList.add('drag-over');
																	} : null}
																	ondragleave={isEditable ? (e) => {
																		e.currentTarget.classList.remove('drag-over');
																	} : null}
																	ondrop={isEditable ? (e) => {
																		e.preventDefault();
																		e.stopPropagation();
																		e.currentTarget.classList.remove('drag-over');
																		
																		try {
																			const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
																			if (dragData.type === 'answer' && dragData.questionId === question.ids.id) {
																				dispatch('REORDER_ANSWERS', {
																					questionId: question.ids.id,
																					sourceIndex: dragData.sourceIndex,
																					targetIndex: aIndex
																				});
																			}
																		} catch (error) {
																			console.error('Error handling answer drop:', error);
																		}
																	} : null}
																>
																	{isEditable ? (
																			<div 
																				className="answer-drag-handle" 
																				title="Drag to reorder"
																				draggable={true}
																				ondragstart={(e) => {
																					e.dataTransfer.setData('text/plain', JSON.stringify({
																						type: 'answer',
																						questionId: question.ids.id,
																						answerId: answer.ids.id,
																						sourceIndex: aIndex
																					}));
																					e.dataTransfer.effectAllowed = 'move';
																					e.stopPropagation(); // Prevent question drag
																					
																					// Add visual feedback to the parent answer
																					const parentElement = e.target.closest('.answer-option');
																					if (parentElement) {
																						parentElement.classList.add('dragging');
																					}
																				}}
																				ondragend={(e) => {
																					// Remove visual feedback
																					const parentElement = e.target.closest('.answer-option');
																					if (parentElement) {
																						parentElement.classList.remove('dragging');
																					}
																				}}
																			>
																				⋮⋮
																			</div>
																		) : null}
																	{isEditable ? (
																		<div className="answer-edit" style={answer.isDeleted ? {opacity: 0.5, backgroundColor: '#fee2e2'} : {}}>
																			<div className="answer-single-line">
																				<span className="answer-number">{aIndex + 1}.</span>
																				<div className="typeahead-container">
																					<input
																						type="text"
																						className="answer-label-input"
																						value={answer.label}
																						placeholder="Enter answer text..."
																						disabled={answer.isDeleted || (hasAnyUnsavedChanges(state) && !question.isUnsaved)}
																						style={answer.isDeleted ? {textDecoration: 'line-through'} : {}}
																						oninput={(e) => {
																							const newValue = e.target.value;
																							// Update the answer label locally
																							dispatch('UPDATE_ANSWER_LABEL', {
																								answerId: answer.ids.id,
																								newLabel: newValue
																							});
																							// Trigger typeahead search if length >= 3
																							if (newValue.length >= 2) {
																								dispatch('ANSWER_TYPEAHEAD_INPUT_CHANGE', {
																									searchText: newValue,
																									answerId: answer.ids.id
																								});
																							} else {
																								dispatch('ANSWER_TYPEAHEAD_HIDE');
																							}
																						}}
																						onkeydown={(e) => {
																							if (e.key === 'Escape') {
																								if (state.answerTypeaheadVisible) {
																									dispatch('ANSWER_TYPEAHEAD_HIDE');
																								}
																							}
																						}}
																						onblur={(e) => {
																							// Hide typeahead after a short delay to allow selection
																							setTimeout(() => {
																								dispatch('ANSWER_TYPEAHEAD_HIDE');
																							}, 150);
																						}}
																						onmousedown={(e) => {
																							e.stopPropagation();
																						}}
																						onfocus={(e) => {
																							e.stopPropagation();
																						}}
																					/>
																					{state.answerTypeaheadVisible && state.editingAnswerId === answer.ids.id && (
																						<div className="typeahead-dropdown">
																							{state.answerTypeaheadLoading ? (
																								<div className="typeahead-item loading">
																									<div className="loading-spinner"></div>
																									Searching for answers...
																								</div>
																							) : state.answerTypeaheadResults && state.answerTypeaheadResults.length > 0 ? (
																								state.answerTypeaheadResults.map((result, index) => (
																									<div
																										key={result.id}
																										className="typeahead-item"
																										onclick={(e) => {
																											e.preventDefault();
																											e.stopPropagation();
																											dispatch('SELECT_LIBRARY_ANSWER', {
																												answerId: answer.ids.id,
																												libraryAnswer: result
																											});
																										}}
																										onmousedown={(e) => {
																											e.preventDefault();
																											e.stopPropagation();
																										}}
																									>
																										<div className={`typeahead-item-title ${result.exact_match ? 'exact-match' : ''}`}>{result.name}</div>
																									</div>
																								))
																							) : state.answerTypeaheadQuery && state.answerTypeaheadQuery.length >= 2 && !state.answerTypeaheadLoading ? (
																								<div className="typeahead-item no-results">
																									No matching answers found for "{state.answerTypeaheadQuery}"
																								</div>
																							) : null}
																						</div>
																					)}
																				</div>

																				{/* Score input box for Single Select and Multiselect questions when scoring model is selected */}
																				{state.selectedScoringModel && (question.type === 'Single Select' || question.type === 'Multiselect') && (
																					<div className="score-input-container" style={{
																						marginLeft: '8px',
																						display: 'flex',
																						alignItems: 'center',
																						gap: '4px'
																					}}>
																						<label style={{
																							fontSize: '12px',
																							color: '#666',
																							whiteSpace: 'nowrap'
																						}}>
																							Score:
																						</label>
																						<input
																							type="number"
																							min="0"
																							className="answer-score-input"
																							value={answer.scoring?.[state.selectedScoringModel?.id] || ''}
																							placeholder="0"
																							style={{
																								width: '60px',
																								padding: '4px 6px',
																								border: '1px solid #ccc',
																								borderRadius: '3px',
																								fontSize: '12px',
																								textAlign: 'center'
																							}}
																							oninput={(e) => {
																								const score = e.target.value;
																								dispatch('UPDATE_ANSWER_SCORE', {
																									answerId: answer.ids.id,
																									score: score
																								});
																							}}
																							onclick={(e) => {
																								e.stopPropagation();
																							}}
																							onmousedown={(e) => {
																								e.stopPropagation();
																							}}
																						/>
																					</div>
																				)}

																				<div className="answer-tooltip-icon">
																					<span
																						className={`tooltip-icon ${answer.tooltip ? 'has-tooltip' : 'no-tooltip'}`}
																						title="Click to edit tooltip"
																						style={hasAnyUnsavedChanges(state) && !question.isUnsaved ? {
																							opacity: 0.5,
																							cursor: 'not-allowed'
																						} : {}}
																						onclick={(e) => {
																							e.stopPropagation();
																							if (hasAnyUnsavedChanges(state) && !question.isUnsaved) {
																								return; // Blocked when other questions have changes
																							}
																							dispatch('EDIT_ANSWER_TOOLTIP', {
																								answerId: answer.ids.id,
																								currentTooltip: answer.tooltip || ''
																							});
																						}}
																					>
																						ⓘ
																					</span>
																				</div>
																				<span
																					className="custom-attributes-icon"
																					title="Click to add, remove or change custom attributes"
																					style={hasAnyUnsavedChanges(state) && !question.isUnsaved ? {
																						opacity: 0.5,
																						cursor: 'not-allowed'
																					} : {}}
																					onclick={() => {
																						if (hasAnyUnsavedChanges(state) && !question.isUnsaved) {
																							return; // Blocked when other questions have changes
																						}
																						dispatch('OPEN_CUSTOM_ATTRIBUTES_MODAL', {
																							itemType: 'answer',
																							itemId: answer.ids.id,
																							currentAttributes: answer.custom_attributes || {}
																						});
																					}}
																				>
																					CA
																				</span>
																				<div className="answer-controls" style={state.isMobileView ? {
																					display: 'flex',
																					flexWrap: 'wrap',
																					gap: '0.75rem',
																					width: '100%',
																					overflow: 'visible'
																				} : {}}>
																					<label className="checkbox-control">
																						<input 
																							type="checkbox" 
																							checked={answer.mutually_exclusive}
																							onchange={(e) => {
																								dispatch('UPDATE_ANSWER_MUTUALLY_EXCLUSIVE', {
																									answerId: answer.ids.id,
																									mutually_exclusive: e.target.checked
																								});
																							}}
																							onmousedown={(e) => {
																								e.stopPropagation();
																							}}
																							onfocus={(e) => {
																								e.stopPropagation();
																							}}
																						/>
																						Exclusive
																					</label>
																					<select
																						className="secondary-input-select"
																						disabled={answer.isDeleted || (hasAnyUnsavedChanges(state) && !question.isUnsaved)}
																						style={answer.isDeleted ? {textDecoration: 'line-through'} : {}}
																						style={state.isMobileView ? {
																							flexShrink: '0'
																						} : {}}
																						onchange={(e) => {
																							dispatch('UPDATE_ANSWER_SECONDARY_INPUT', {
																								answerId: answer.ids.id,
																								newSecondaryInputType: e.target.value || null
																							});
																						}}
																					>
																						<option value="" selected={!answer.secondary_input_type}>No secondary input</option>
																						<option value="text" selected={answer.secondary_input_type === 'text'}>Text input</option>
																						<option value="date" selected={answer.secondary_input_type === 'date'}>Date input</option>
																						<option value="numeric" selected={answer.secondary_input_type === 'numeric'}>Numeric input</option>
																					</select>
																					<button
																						className="delete-answer-btn"
																						title="Delete Answer"
																						disabled={answer.isDeleted || (hasAnyUnsavedChanges(state) && !question.isUnsaved)}
																						style={answer.isDeleted ? {textDecoration: 'line-through'} : {}}
																						style={state.isMobileView ? {
																							flexShrink: '0'
																						} : {}}
																						onclick={() => {
																							dispatch('DELETE_ANSWER', {
																								answerId: answer.ids.id,
																								questionId: question.ids.id
																							});
																						}}
																					>
																						🗑️
																					</button>
																				</div>
																			</div>
																			{/* Show triggered questions indicator in edit mode */}
																			{answer.triggered_questions && answer.triggered_questions.length > 0 && (
																				<div className="triggered-questions-indicator">
																					<span className="trigger-icon">🔗</span>
																					<span className="trigger-text">
																						Triggers {answer.triggered_questions.length} question{answer.triggered_questions.length !== 1 ? 's' : ''}
																					</span>
																					<div className="trigger-details">
																						{answer.triggered_questions.map((triggeredId, triggerIndex) => {
																							// Find the triggered question to show its label
																							const triggeredQuestion = state.currentQuestions?.questions?.find(q => q.ids.id === triggeredId);
																							return (
																								<div key={triggerIndex} className="triggered-question-item">
																									<span className="triggered-question-label">
																										→ {triggeredQuestion?.label || `Question ${triggeredId.substring(0, 8)}...`}
																									</span>
																									<button 
																										className="delete-triggered-question-btn"
																										onclick={(e) => {
																											e.stopPropagation();
																											dispatch('REMOVE_TRIGGERED_QUESTION', {
																												answerId: answer.ids.id,
																												questionId: triggeredId,
																												questionLabel: triggeredQuestion?.label || 'Unknown Question'
																											});
																										}}
																										title="Remove triggered question"
																										style={{
																											display: isEditable ? 'flex' : 'none',
																											backgroundColor: isEditable ? '#fee2e2' : 'gray'
																										}}
																									>
																										🗑️ DEBUG
																									</button>
																								</div>
																							);
																						})}
																					</div>
																				</div>
																			)}
																			
																			{/* Show guideline relationships indicator in edit mode */}
																			{(() => {
																				// Find guideline relationships for this answer
																				const guidelineRelationships = Object.values(state.relationshipChanges || {}).filter(change =>
																					change.answerId === answer.ids.id &&
																					change.relationshipType === 'guideline' &&
																					change.action === 'add'
																				);

																				return guidelineRelationships.length > 0 && (
																					<div className="triggered-questions-indicator guideline-indicator">
																						<span className="trigger-icon">📋</span>
																						<span className="trigger-text">
																							Links to {guidelineRelationships.length} guideline{guidelineRelationships.length !== 1 ? 's' : ''}
																						</span>
																						<div className="trigger-details">
																							{guidelineRelationships.map((relationship, relationshipIndex) => (
																								<div key={relationshipIndex} className="triggered-question-item guideline-relationship-item">
																									<span className="triggered-question-label guideline-relationship-label">
																										→ {relationship.targetLabel}
																									</span>
																									{isEditable && (
																										<button 
																											className="remove-trigger-btn remove-guideline-btn"
																											onclick={(e) => {
																												e.stopPropagation();
																												dispatch('REMOVE_GUIDELINE_RELATIONSHIP', {
																													answerId: answer.ids.id,
																													guidelineId: relationship.targetId,
																													guidelineName: relationship.targetLabel
																												});
																											}}
																											title="Remove guideline relationship"
																											style={{
																												display: isEditable ? 'flex' : 'none',
																												backgroundColor: isEditable ? '#fee2e2' : 'gray'
																											}}
																										>
																											🗑️
																										</button>
																									)}
																								</div>
																							))}
																						</div>
																					</div>
																				);
																			})()}
																			
																			{/* Relationship button/counts */}
																			{isEditable && state.showRelationships && (
																				<div className="answer-relationships">
																					{!state.relationshipsLoading[answer.ids.id] ? (
																						<button
																							className="load-relationships-btn"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('OPEN_RELATIONSHIP_MODAL', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							{(() => {
																								if (!answer.counts) return 'Manage Relationships';

																								const labels = [
																									{ key: 'triggered_guidelines', label: 'G' },
																									{ key: 'problems', label: 'P' },
																									{ key: 'triggered_questions', label: 'Q' },
																									{ key: 'evidence', label: 'E' },
																									{ key: 'barriers', label: 'B' }
																								];

																								const displayCounts = labels
																									.filter(item => answer.counts[item.key] && answer.counts[item.key] > 0)
																									.map(item => `${item.label}: ${answer.counts[item.key]}`);

																								return displayCounts.length > 0 ? displayCounts.join(' ') : 'Manage Relationships';
																							})()}
																						</button>
																					) : (
																						<div className="relationships-loading">
																							⏳ Loading relationships...
																						</div>
																					)}
																				</div>
																			)}
																			
																			{/* OLD Relationship display (DISABLED - now using modal) */}
																			{false && isEditable && state.showRelationships && state.answerRelationships[answer.ids.id] && (
																				<div className="relationships-display">
																					<div className="relationships-header">
																						🔍 <strong>Relationships for "{answer.label}"</strong>
																						<button
																							className="refresh-relationships-btn"
																							title="Refresh relationships"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('LOAD_ANSWER_RELATIONSHIPS', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							🔄
																						</button>
																						<button
																							className="edit-relationships-btn"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('OPEN_RELATIONSHIP_MODAL', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							✏️ Edit
																						</button>
																						<button
																							className="close-relationships-btn"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('CLOSE_ANSWER_RELATIONSHIPS', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							<XIcon />
																						</button>
																					</div>
																					<div className="relationships-content">
																						{state.answerRelationships[answer.ids.id].questions?.questions?.length > 0 && (
																							<div className="relationship-section">
																								<span className="relationship-label">Questions ({state.answerRelationships[answer.ids.id].questions.questions_quantity})</span>
																								<div className="relationship-items">
																									{state.answerRelationships[answer.ids.id].questions.questions.map((question, qIndex) => (
																										<div key={qIndex} className="relationship-item">
																											<span className="relationship-item-label">→ {question.label}</span>
																											<button 
																												className="delete-relationship-btn"
																												onclick={(e) => {
																													e.stopPropagation();
																													dispatch('REMOVE_TRIGGERED_QUESTION', {
																														answerId: answer.ids.id,
																														questionId: question.id,
																														questionLabel: question.label
																													});
																												}}
																												title="Remove triggered question"
																											>
																												🗑️
																											</button>
																										</div>
																									))}
																								</div>
																							</div>
																						)}
																						{state.answerRelationships[answer.ids.id].problems?.problems?.length > 0 && (
																							<div className="relationship-section">
																								<span className="relationship-label">Problems ({state.answerRelationships[answer.ids.id].problems.problems_quantity})</span>
																								<div className="relationship-items">
																									{state.answerRelationships[answer.ids.id].problems.problems.map((problem, pIndex) => (
																										<span key={pIndex} className="relationship-item">
																											→ {problem.label || problem.name}
																										</span>
																									))}
																								</div>
																							</div>
																						)}
																						{state.answerRelationships[answer.ids.id].barriers?.barriers?.length > 0 && (
																							<div className="relationship-section">
																								<span className="relationship-label">Barriers ({state.answerRelationships[answer.ids.id].barriers.barriers_quantity})</span>
																								<div className="relationship-items">
																									{state.answerRelationships[answer.ids.id].barriers.barriers.map((barrier, bIndex) => (
																										<span key={bIndex} className="relationship-item">
																											→ {barrier.label || barrier.name}
																										</span>
																									))}
																								</div>
																							</div>
																						)}
																						{state.answerRelationships[answer.ids.id].guidelines?.guidelines?.length > 0 && (
																							<div className="relationship-section">
																								<span className="relationship-label">Guidelines ({state.answerRelationships[answer.ids.id].guidelines.guidelines_quantity})</span>
																								<div className="relationship-items">
																									{state.answerRelationships[answer.ids.id].guidelines.guidelines.map((guideline, gIndex) => (
																										<span key={gIndex} className="relationship-item">
																											→ {guideline.use_case_category?.name ? `${guideline.label || guideline.name} - ${guideline.use_case_category.name}` : (guideline.label || guideline.name)}
																										</span>
																									))}
																								</div>
																							</div>
																						)}
																						{/* Show message if no relationships */}
																						{(!state.answerRelationships[answer.ids.id].questions?.questions?.length && 
																						  !state.answerRelationships[answer.ids.id].problems?.problems?.length &&
																						  !state.answerRelationships[answer.ids.id].barriers?.barriers?.length &&
																						  !state.answerRelationships[answer.ids.id].guidelines?.guidelines?.length) && (
																							<div className="no-relationships">
																								No relationships found for this answer.
																							</div>
																						)}
																						
																						{/* Add Relationship Section */}
																						{state.addingRelationship === answer.ids.id ? (
																							<div className="add-relationship-form">
																								<div className="relationship-type-selector">
																									<label>Select Relationship Type:</label>
																									<select 
																										value={state.selectedRelationshipType || ''}
																										onchange={(e) => {
																											dispatch('SET_RELATIONSHIP_TYPE', {
																												relationshipType: e.target.value
																											});
																										}}
																									>
																										<option value="">Choose type...</option>
																										<option value="question">Triggered Question</option>
																										<option value="problem">Problem</option>
																										<option value="barrier">Barrier</option>
																										<option value="guideline">Guideline</option>
																									</select>
																								</div>
																								
																								{state.selectedRelationshipType === 'question' && (
																									<div className="question-typeahead-section">
																										<label>Select Question from Current Section:</label>
																										<div className="typeahead-container">
																											<input 
																												type="text" 
																												className="relationship-typeahead-input"
																												placeholder="Type to search questions..."
																												value={state.relationshipTypeaheadText || ''}
																												oninput={(e) => {
																													dispatch('RELATIONSHIP_TYPEAHEAD_INPUT', {
																														text: e.target.value,
																														answerId: answer.ids.id
																													});
																												}}
																											/>
																											{state.relationshipTypeaheadResults && state.relationshipTypeaheadResults.length > 0 && (
																												<div
																													className="typeahead-dropdown"
																													hook-insert={(vnode) => {
																														const input = vnode.elm.parentElement.querySelector('.relationship-typeahead-input');
																														if (input) {
																															const rect = input.getBoundingClientRect();
																															vnode.elm.style.top = `${rect.bottom}px`;
																															vnode.elm.style.left = `${rect.left}px`;
																															vnode.elm.style.width = `${rect.width}px`;
																														}
																													}}
																													hook-update={(oldVnode, vnode) => {
																														const input = vnode.elm.parentElement.querySelector('.relationship-typeahead-input');
																														if (input) {
																															const rect = input.getBoundingClientRect();
																															vnode.elm.style.top = `${rect.bottom}px`;
																															vnode.elm.style.left = `${rect.left}px`;
																															vnode.elm.style.width = `${rect.width}px`;
																														}
																													}}
																												>
																													{state.relationshipTypeaheadResults.map((question, index) => (
																														<div 
																															key={question.ids?.id || index}
																															className="typeahead-item"
																															onclick={(e) => {
																																e.stopPropagation();
																																e.preventDefault();
																																dispatch('SELECT_RELATIONSHIP_QUESTION', {
																																	answerId: answer.ids.id,
																																	questionId: question.ids.id,
																																	questionLabel: question.label
																																});
																															}}
																														>
																															{question.label}
																														</div>
																													))}
																												</div>
																											)}
																										</div>
																									</div>
																								)}
																								
																								{state.selectedRelationshipType === 'guideline' && (
																									<div className="guideline-typeahead-section">
																										<label>Search Guidelines:</label>
																										<div className="typeahead-container">
																											<input
																												type="text"
																												className="relationship-typeahead-input"
																												placeholder="Type to search guidelines (min 3 chars)..."
																												value={state.relationshipTypeaheadText || ''}
																												oninput={(e) => {
																													dispatch('GUIDELINE_TYPEAHEAD_INPUT', {
																														text: e.target.value,
																														answerId: answer.ids.id
																													});
																												}}
																												onkeydown={(e) => {
																													if (e.key === 'Escape') {
																														dispatch('GUIDELINE_TYPEAHEAD_HIDE');
																													}
																												}}
																												onblur={(e) => {
																													// Hide typeahead after a short delay to allow selection
																													setTimeout(() => {
																														dispatch('GUIDELINE_TYPEAHEAD_HIDE');
																													}, 150);
																												}}
																											/>
																											{state.relationshipTypeaheadResults && state.relationshipTypeaheadResults.length > 0 && (
																												<div className="typeahead-dropdown">
																													{state.relationshipTypeaheadResults.map((guideline, index) => (
																														<div 
																															key={guideline.id || index}
																															className="typeahead-item"
																															onclick={(e) => {
																																e.stopPropagation();
																																e.preventDefault();
																																dispatch('SELECT_RELATIONSHIP_GUIDELINE', {
																																	answerId: answer.ids.id,
																																	guidelineId: guideline.id,
																																	guidelineName: guideline.name,
																																	guidelineMasterId: guideline.master_id,
																																	guidelineCategory: guideline.use_case_category?.name
																																});
																															}}
																														>
																															<div className="guideline-item">
																																<div className="guideline-name">{guideline.name}</div>
																																<div className="guideline-category">{guideline.use_case_category?.name}</div>
																															</div>
																														</div>
																													))}
																												</div>
																											)}
																										</div>
																									</div>
																								)}
																								
																								<div className="add-relationship-buttons">
																									{state.selectedRelationshipQuestion ? (
																										<div className="relationship-confirm-buttons">
																											<button 
																												className="confirm-relationship-btn"
																												onclick={(e) => {
																													e.stopPropagation();
																													e.preventDefault();
																													dispatch('CONFIRM_ADD_RELATIONSHIP', {
																														answerId: answer.ids.id
																													});
																												}}
																												title="Confirm relationship"
																											>
																												<CheckIcon />
																											</button>
																											<button 
																												className="cancel-relationship-btn"
																												onclick={() => {
																													dispatch('CANCEL_ADD_RELATIONSHIP');
																												}}
																												title="Cancel"
																											>
																												<XIcon />
																											</button>
																										</div>
																									) : (
																										<button 
																											className="cancel-relationship-btn"
																											onclick={() => {
																												dispatch('CANCEL_ADD_RELATIONSHIP');
																											}}
																										>
																											Cancel
																										</button>
																									)}
																								</div>
																							</div>
																						) : (
																							<div className="add-relationship-section">
																								<button 
																									className="add-relationship-btn"
																									onclick={() => {
																										dispatch('START_ADD_RELATIONSHIP', {
																											answerId: answer.ids.id
																										});
																									}}
																								>
																									+ Add Relationship
																								</button>
																							</div>
																						)}
																					</div>
																				</div>
																			)}
																		</div>
																	) : (
																		<div className="answer-container">
																			<label className="answer-label">
																				<input
																					type="checkbox"
																					name={`question-${question.ids.id}`}
																					value={answer.ids.id}
																					checked={state.selectedAnswers[question.ids.id]?.includes(answer.ids.id) || false}
																					onchange={(event) => {
																						// Handle mutually exclusive logic first
																						if (answer.mutually_exclusive && event.target.checked) {
																							dispatch('HANDLE_MUTUALLY_EXCLUSIVE', {
																								questionId: question.ids.id,
																								answerId: answer.ids.id
																							});
																						} else {
																							dispatch('SELECT_ANSWER', {
																								questionId: question.ids.id,
																								answerId: answer.ids.id,
																								questionType: question.type
																							});
																						}
																					}}
																				/>
																				<span className="answer-text">
																					{answer.label}
																					{answer.secondary_input_type && (
																						<span className="secondary-indicator">📝</span>
																					)}
																					{answer.tooltip && (
																						<span className="tooltip-icon" title={answer.tooltip}>ⓘ</span>
																					)}
																					{/* PGI Badge for preview mode */}
																					{!isEditable && answer.counts && (() => {
																						const hasPGI = (answer.counts.problems || 0) > 0 ||
																									   (answer.counts.triggered_guidelines || 0) > 0 ||
																									   (answer.counts.barriers || 0) > 0;
																						const hasRelationships = hasPGI ||
																											   (answer.counts.triggered_questions || 0) > 0 ||
																											   (answer.counts.evidence || 0) > 0;

																						if (!hasRelationships) {
																							return (
																								<span className="pgi-badge no-relationships" style={{
																									marginLeft: '8px',
																									padding: '2px 6px',
																									backgroundColor: '#e5e7eb',
																									color: '#6b7280',
																									borderRadius: '10px',
																									fontSize: '11px',
																									fontWeight: '500',
																									cursor: 'default'
																								}}>
																									No relationships
																								</span>
																							);
																						}

																						if (hasPGI) {
																							const pgiLabels = [];
																							if (answer.counts.problems > 0) pgiLabels.push(`P: ${answer.counts.problems}`);
																							if (answer.counts.triggered_guidelines > 0) pgiLabels.push(`G: ${answer.counts.triggered_guidelines}`);
																							if (answer.counts.barriers > 0) pgiLabels.push(`B: ${answer.counts.barriers}`);

																							return (
																								<span
																									className="pgi-badge clickable"
																									style={{
																										marginLeft: '8px',
																										padding: '2px 6px',
																										backgroundColor: '#dbeafe',
																										color: '#1e40af',
																										borderRadius: '10px',
																										fontSize: '11px',
																										fontWeight: '500',
																										cursor: 'pointer',
																										border: '1px solid #93c5fd'
																									}}
																									onclick={(e) => {
																										e.stopPropagation();
																										e.preventDefault();
																										dispatch('OPEN_PGI_MODAL', {
																											answerId: answer.ids.id
																										});
																									}}
																									title="Click to view Problems, Goals, Interventions, and Barriers"
																								>
																									{pgiLabels.join(' ')}
																								</span>
																							);
																						}

																						return null;
																					})()}
																				</span>
																			</label>
																			{/* Show secondary input below answer if this answer is selected */}
																			{!state.builderMode && state.selectedAnswers[question.ids.id]?.includes(answer.ids.id) && answer.secondary_input_type && (
																				<div className="secondary-input">
																					{answer.secondary_input_type === 'text' && (
																						<input type="text" placeholder="Please specify..." className="secondary-text-input" />
																					)}
																					{answer.secondary_input_type === 'date' && (
																						<input type="date" className="secondary-date-input" />
																					)}
																					{answer.secondary_input_type === 'numeric' && (
																						<input type="number" placeholder="Enter number..." className="secondary-numeric-input" />
																					)}
																				</div>
																			)}
																		</div>
																	)}
																</div>
															))}
															{isEditable ? (
																<button
																	className="add-answer-btn"
																	disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																	onclick={() => dispatch('ADD_ANSWER', {
																		questionId: question.ids.id
																	})}
																>
																	+ Add Answer
																</button>
															) : null}
														</div>
													)}
													
													{/* Text Questions */}
													{question.type === 'Text' && (
														<div className="text-input-container">
															<input
																key={`text-${question.ids.id}-${state.builderMode ? 'edit' : 'preview'}`}
																type="text"
																className="text-input"
																disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																placeholder="Enter your answer..."
																onmousedown={(e) => {
																	e.stopPropagation();
																}}
																onfocus={(e) => {
																	e.stopPropagation();
																}}
															/>
														</div>
													)}

													{/* Date Questions */}
													{question.type === 'Date' && (
														<div className="date-input-container">
															<input
																key={`date-${question.ids.id}-${state.builderMode ? 'edit' : 'preview'}`}
																type="date"
																className="date-input"
																disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																onmousedown={(e) => {
																	e.stopPropagation();
																}}
																onfocus={(e) => {
																	e.stopPropagation();
																}}
															/>
														</div>
													)}

													{/* Numeric Questions */}
													{question.type === 'Numeric' && (
														<div className="numeric-input-container">
															<input
																key={`numeric-${question.ids.id}-${state.builderMode ? 'edit' : 'preview'}`}
																type="number"
																className="numeric-input"
																disabled={hasAnyUnsavedChanges(state) && !question.isUnsaved}
																placeholder="Enter number..."
																onmousedown={(e) => {
																	e.stopPropagation();
																}}
																onfocus={(e) => {
																	e.stopPropagation();
																}}
															/>
														</div>
													)}
												</div>
											</div>
										</div>
											);
										})}

										{/* Add Question Button - only show in edit mode for draft assessments */}
										{state.builderMode && state.currentAssessment?.status === 'draft' && (
											<button
												className="add-question-btn"
												disabled={hasAnyUnsavedChanges(state)}
												onclick={() => dispatch('ADD_QUESTION', {
													sectionId: state.selectedSection
												})}
											>
												+ Add Question
											</button>
										)}
									</div>
								)}
								
								{state.selectedSection && state.currentQuestions && state.currentQuestions.questions && state.currentQuestions.questions.length === 0 && !state.questionsLoading && (
									<div className="no-questions">
										No questions found in this section.
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			)}
			
			{/* Tooltip Edit Modal */}
			{state.editingTooltip && (
				<div className="modal-overlay" onclick={(e) => {
					if (e.target.className === 'modal-overlay') {
						dispatch('SAVE_TOOLTIP_EDIT');
					}
				}}>
					<div className="tooltip-modal">
						<div className="modal-header">
							<h3>Edit Tooltip</h3>
							<button
								className="modal-close"
								onclick={() => dispatch('SAVE_TOOLTIP_EDIT')}
							>
								×
							</button>
						</div>
						<div className="modal-body">
							<textarea
								className="tooltip-textarea"
								value={state.editingTooltipText || ''}
								placeholder="Enter helpful tooltip text..."
								oninput={(e) => dispatch('UPDATE_TOOLTIP_TEXT', {
									text: e.target.value
								})}
								rows="4"
								autoFocus
							></textarea>
						</div>
						<div className="modal-footer">
							<button
								className="btn-save"
								onclick={() => dispatch('SAVE_TOOLTIP_EDIT')}
							>
								Done
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Create New Version Modal */}
			{state.createVersionModal?.isOpen && (
				<div className="modal-overlay">
					<div className="create-version-modal">
						<div className="modal-header">
							<div className="modal-title-group">
								<h3>{state.createVersionModal.assessmentTitle}</h3>
								<p className="modal-subtitle">Policy: {state.createVersionModal.policyNumber}</p>
							</div>
						</div>
						<div className="modal-body">
							<div className="form-group">
								<label htmlFor="versionName">Version Name:</label>
								<input
									id="versionName"
									type="text"
									className="form-input"
									value={state.createVersionModal.versionName || ''}
									oninput={(e) => dispatch('UPDATE_VERSION_MODAL_FIELD', {
										field: 'versionName',
										value: e.target.value
									})}
									placeholder="Enter version name"
									autoFocus
								/>
							</div>
							<div className="form-group">
								<label htmlFor="effectiveDate">Effective Date:</label>
								<input
									id="effectiveDate"
									type="date"
									className="form-input"
									value={state.createVersionModal.effectiveDate || ''}
									oninput={(e) => dispatch('UPDATE_VERSION_MODAL_FIELD', {
										field: 'effectiveDate',
										value: e.target.value
									})}
								/>
							</div>
						</div>
						<div className="modal-footer">
							<button
								className="btn-cancel"
								onclick={() => dispatch('CANCEL_CREATE_VERSION')}
							>
								Cancel
							</button>
							<button
								className="btn-save"
								onclick={() => dispatch('SUBMIT_CREATE_VERSION')}
								disabled={!state.createVersionModal.versionName || !state.createVersionModal.effectiveDate}
							>
								Create New Version
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Assessment Details Panel */}
			{state.assessmentDetailsPanel?.isOpen && (() => {
				// Helper: Check if field is editable based on status
				const status = state.assessmentDetailsPanel.status;
				const isPublished = status === 'published';
				const isUnpublished = status === 'unpublished';
				const isFieldEditable = (fieldName) => {
					// Draft assessments: all fields editable
					if (!isPublished && !isUnpublished) return true;
					// Published assessments: only review dates editable
					if (isPublished) {
						return fieldName === 'reviewDate' || fieldName === 'nextReviewDate';
					}
					// Unpublished assessments: read-only (no fields editable)
					if (isUnpublished) {
						return false;
					}
					return true;
				};

				return (
				<div className="assessment-details-overlay" onclick={() => dispatch('CLOSE_ASSESSMENT_DETAILS')}>
					<div className="assessment-details-panel" onclick={(e) => e.stopPropagation()}>
						<div className="panel-header">
							<h3>Assessment Details</h3>
							<button
								className="panel-close"
								onclick={() => dispatch('CLOSE_ASSESSMENT_DETAILS')}
							>
								×
							</button>
						</div>
						<div className="panel-body">
							<div className="form-columns">
								{/* LEFT COLUMN */}
								<div className="form-column">
									{/* Version Title */}
									<div className="form-group">
										<label>Version Title:</label>
										{isFieldEditable('versionName') ? (
											<input
												type="text"
												className="form-input"
												value={state.assessmentDetailsPanel.versionName || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'versionName',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.versionName}</div>
										)}
									</div>

									{/* Use Case */}
									<div className="form-group">
										<label>Use Case:</label>
										{isFieldEditable('useCase') ? (
											<input
												type="text"
												className="form-input"
												value={state.assessmentDetailsPanel.useCase || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'useCase',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.useCase}</div>
										)}
									</div>

									{/* Use Case Category */}
									<div className="form-group">
										<label>Use Case Category:</label>
										{isFieldEditable('useCaseCategory') ? (
											<select
												className="form-input"
												value={state.assessmentDetailsPanel.useCaseCategory || ''}
												onchange={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'useCaseCategory',
													value: e.target.value
												})}
											>
												<option value="">Select Category</option>
												{(state.useCaseCategories || []).map(category => (
													<option
														key={category.id}
														value={category.id}
														selected={category.id === state.assessmentDetailsPanel.useCaseCategory}
													>
														{category.name}
													</option>
												))}
											</select>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.useCaseCategoryName}</div>
										)}
									</div>

									{/* Content Source */}
									<div className="form-group">
										<label>Content Source:</label>
										{isFieldEditable('contentSource') ? (
											<input
												type="text"
												className="form-input"
												value={state.assessmentDetailsPanel.contentSource || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'contentSource',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.contentSource}</div>
										)}
									</div>

									{/* Effective Date */}
									<div className="form-group">
										<label>Effective Date:</label>
										{isFieldEditable('effectiveDate') ? (
											<input
												type="date"
												className="form-input"
												value={state.assessmentDetailsPanel.effectiveDate || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'effectiveDate',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.effectiveDate}</div>
										)}
									</div>

									{/* Review Date */}
									<div className="form-group">
										<label>Review Date:</label>
										{isFieldEditable('reviewDate') ? (
											<input
												type="date"
												className="form-input"
												value={state.assessmentDetailsPanel.reviewDate || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'reviewDate',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.reviewDate}</div>
										)}
									</div>

									{/* Allow MCG Content */}
									<div className="form-group">
										<label>Allow MCG Content:</label>
										<div className="checkbox-group">
											<input
												type="checkbox"
												id="allowMcgContent"
												checked={state.assessmentDetailsPanel.allowMcgContent || false}
												disabled={!isFieldEditable('allowMcgContent')}
												onchange={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'allowMcgContent',
													value: e.target.checked
												})}
											/>
											<label htmlFor="allowMcgContent">Enable</label>
										</div>
									</div>
								</div>

								{/* RIGHT COLUMN */}
								<div className="form-column">
									{/* Title (Display Only) */}
									<div className="form-group">
										<label>Title:</label>
										<div className="readonly-field">{state.assessmentDetailsPanel.title || ''}</div>
									</div>

									{/* Usage */}
									<div className="form-group">
										<label>Usage:</label>
										{isFieldEditable('usage') ? (
											<input
												type="text"
												className="form-input"
												value={state.assessmentDetailsPanel.usage || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'usage',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.usage}</div>
										)}
									</div>

									{/* Code/Policy Number */}
									<div className="form-group">
										<label>Code/Policy Number:</label>
										{isFieldEditable('policyNumber') ? (
											<input
												type="text"
												className="form-input"
												value={state.assessmentDetailsPanel.policyNumber || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'policyNumber',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.policyNumber}</div>
										)}
									</div>

									{/* Response Logging - DROPDOWN */}
									<div className="form-group">
										<label>Response Logging:</label>
										{isFieldEditable('responseLogging') ? (
											<select
												className="form-input"
												onchange={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'responseLogging',
													value: e.target.value
												})}
											>
												<option value="use_default" selected={state.assessmentDetailsPanel.responseLogging === 'use_default'}>Use Org Default</option>
												<option value="disabled" selected={state.assessmentDetailsPanel.responseLogging === 'disabled'}>Disabled</option>
												<option value="draft" selected={state.assessmentDetailsPanel.responseLogging === 'draft'}>Save as Draft and Submit</option>
												<option value="submit" selected={state.assessmentDetailsPanel.responseLogging === 'submit'}>Submit Only</option>
											</select>
										) : (
											<div className="readonly-field">{
												(() => {
													const value = state.assessmentDetailsPanel.responseLogging;
													if (value === 'use_default') return 'Use Org Default';
													if (value === 'disabled') return 'Disabled';
													if (value === 'draft') return 'Save as Draft and Submit';
													if (value === 'submit') return 'Submit Only';
													return 'Use Org Default';
												})()
											}</div>
										)}
									</div>

									{/* End Date */}
									<div className="form-group">
										<label>End Date:</label>
										{isFieldEditable('endDate') ? (
											<input
												type="date"
												className="form-input"
												value={state.assessmentDetailsPanel.endDate || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'endDate',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.endDate}</div>
										)}
									</div>

									{/* Next Review Date */}
									<div className="form-group">
										<label>Next Review Date:</label>
										{isFieldEditable('nextReviewDate') ? (
											<input
												type="date"
												className="form-input"
												value={state.assessmentDetailsPanel.nextReviewDate || ''}
												oninput={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'nextReviewDate',
													value: e.target.value
												})}
											/>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.nextReviewDate}</div>
										)}
									</div>

									{/* Enable "Select All PGI Elements" */}
									<div className="form-group">
										<label>Enable "Select All PGI Elements":</label>
										<div className="checkbox-group">
											<input
												type="checkbox"
												id="enableSelectAllPgi"
												checked={state.assessmentDetailsPanel.enableSelectAllPgi || false}
												disabled={!isFieldEditable('enableSelectAllPgi')}
												onchange={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
													field: 'enableSelectAllPgi',
													value: e.target.checked
												})}
											/>
											<label htmlFor="enableSelectAllPgi">Enable</label>
										</div>
									</div>
								</div>
							</div>
						</div>
						<div className="panel-footer">
							<button
								className="btn-cancel"
								onclick={() => dispatch('CLOSE_ASSESSMENT_DETAILS')}
							>
								Cancel
							</button>
							<button
								className="btn-save"
								onclick={() => dispatch('SAVE_ASSESSMENT_DETAILS')}
							>
								Save Changes
							</button>
						</div>
					</div>
				</div>
				);
			})()}

			{/* Publish Assessment Panel */}
			{state.publishPanel?.isOpen && (
				<div className="publish-panel-overlay" onclick={() => dispatch('CLOSE_PUBLISH_PANEL')}>
					<div className="publish-panel" onclick={(e) => e.stopPropagation()}>
						<div className="panel-header">
							<h3>{state.publishPanel.versionName}</h3>
							<button
								className="panel-close"
								onclick={() => dispatch('CLOSE_PUBLISH_PANEL')}
							>
								×
							</button>
						</div>
						<div className="panel-body">
							<div className="form-group">
								<label>Effective Date: <span className="required">*</span></label>
								<input
									type="date"
									className="form-input"
									value={state.publishPanel.effectiveDate || ''}
									oninput={(e) => dispatch('UPDATE_PUBLISH_FIELD', {
										field: 'effectiveDate',
										value: e.target.value
									})}
								/>
							</div>
							<div className="form-group">
								<label>End Date:</label>
								<input
									type="date"
									className="form-input"
									value={state.publishPanel.endDate || ''}
									oninput={(e) => dispatch('UPDATE_PUBLISH_FIELD', {
										field: 'endDate',
										value: e.target.value
									})}
								/>
							</div>
							<div className="form-group">
								<label>Review Date:</label>
								<input
									type="date"
									className="form-input"
									value={state.publishPanel.reviewDate || ''}
									oninput={(e) => dispatch('UPDATE_PUBLISH_FIELD', {
										field: 'reviewDate',
										value: e.target.value
									})}
								/>
							</div>
							<div className="form-group">
								<label>Next Review Date:</label>
								<input
									type="date"
									className="form-input"
									value={state.publishPanel.nextReviewDate || ''}
									oninput={(e) => dispatch('UPDATE_PUBLISH_FIELD', {
										field: 'nextReviewDate',
										value: e.target.value
									})}
								/>
							</div>
							<div className="form-group">
								<label>Response Logging:</label>
								<select
									className="form-input"
									value={state.publishPanel.responseLogging || 'use_default'}
									onchange={(e) => dispatch('UPDATE_PUBLISH_FIELD', {
										field: 'responseLogging',
										value: e.target.value
									})}
								>
									<option value="use_default" selected={state.publishPanel.responseLogging === 'use_default'}>Use Org Default</option>
									<option value="disabled" selected={state.publishPanel.responseLogging === 'disabled'}>Disable</option>
									<option value="auto_save_draft_submit" selected={state.publishPanel.responseLogging === 'auto_save_draft_submit'}>Auto-save, Draft and Submit</option>
									<option value="save_draft_submit" selected={state.publishPanel.responseLogging === 'save_draft_submit'}>Save as Draft and Submit</option>
									<option value="submit_only" selected={state.publishPanel.responseLogging === 'submit_only'}>Submit Only</option>
								</select>
							</div>
						</div>
						<div className="panel-footer">
							<button
								className="btn-cancel"
								onclick={() => dispatch('CLOSE_PUBLISH_PANEL')}
							>
								Cancel
							</button>
							<button
								className="btn-save"
								onclick={() => dispatch('SUBMIT_PUBLISH_ASSESSMENT')}
								disabled={!state.publishPanel.effectiveDate}
							>
								Publish
							</button>
						</div>
					</div>
				</div>
			)}

			{/* New Assessment Modal */}
			{state.newAssessmentModalOpen && (
				<div className="modal-overlay" style={{
					position: 'fixed',
					top: '0',
					left: '0',
					width: '100%',
					height: '100%',
					backgroundColor: 'rgba(0,0,0,0.5)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: '9999'
				}}>
					<div className="modal-content" style={{
						backgroundColor: 'white',
						padding: '20px',
						borderRadius: '8px',
						width: '600px',
						maxWidth: '90vw',
						maxHeight: '90vh',
						overflow: 'auto',
						boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
					}}>
						<h3 className="modal-title" style={{marginTop: '0', marginBottom: '20px'}}>
							Create New Assessment
						</h3>

						<div className="new-assessment-form" style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
							{/* Use Case (hardcoded) */}
							<div className="form-field">
								<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
									Use Case
								</label>
								<input
									type="text"
									value="Case Management"
									disabled
									style={{
										width: '100%',
										padding: '8px',
										border: '1px solid #ddd',
										borderRadius: '4px',
										backgroundColor: '#f5f5f5'
									}}
								/>
							</div>

							{/* Guideline Name */}
							<div className="form-field">
								<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
									Guideline Name <span style={{color: 'red'}}>*</span>
								</label>
								<input
									type="text"
									value={state.newAssessmentForm.guidelineName}
									oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'guidelineName', value: e.target.value})}
									style={{
										width: '100%',
										padding: '8px',
										border: '1px solid #ddd',
										borderRadius: '4px',
										boxSizing: 'border-box'
									}}
								/>
							</div>

							{/* Use Case Category */}
							<div className="form-field">
								<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
									Use Case Category <span style={{color: 'red'}}>*</span>
								</label>
								<select
									value={state.newAssessmentForm.useCaseCategory}
									onchange={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'useCaseCategory', value: e.target.value})}
									style={{
										width: '100%',
										padding: '8px',
										border: '1px solid #ddd',
										borderRadius: '4px',
										boxSizing: 'border-box'
									}}
								>
									{state.useCaseCategories && state.useCaseCategories.length > 0 ? (
										state.useCaseCategories.map(category => (
											<option
												key={category.id}
												value={category.name}
												selected={state.newAssessmentForm.useCaseCategory === category.name}
											>
												{category.name}
											</option>
										))
									) : (
										<option value="">Loading categories...</option>
									)}
								</select>
							</div>

							{/* Usage (formerly Type) */}
							<div className="form-field">
								<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
									Usage <span style={{color: 'red'}}>*</span>
								</label>
								<select
									value={state.newAssessmentForm.type}
									onchange={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'type', value: e.target.value})}
									style={{
										width: '100%',
										padding: '8px',
										border: '1px solid #ddd',
										borderRadius: '4px',
										boxSizing: 'border-box'
									}}
								>
									<option value="Assessment Only">Assessment Only</option>
									<option value="Care Planning">Care Planning</option>
									<option value="Care Plan Only">Care Plan Only</option>
								</select>
							</div>

							{/* Content Source */}
							<div className="form-field">
								<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
									Content Source <span style={{color: 'red'}}>*</span>
								</label>
								<input
									type="text"
									value={state.newAssessmentForm.contentSource}
									oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'contentSource', value: e.target.value})}
									style={{
										width: '100%',
										padding: '8px',
										border: '1px solid #ddd',
										borderRadius: '4px',
										boxSizing: 'border-box'
									}}
								/>
							</div>

							{/* Code/Policy Number */}
							<div className="form-field">
								<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
									Code/Policy Number <span style={{color: 'red'}}>*</span>
								</label>
								<input
									type="text"
									value={state.newAssessmentForm.codePolicyNumber}
									oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'codePolicyNumber', value: e.target.value})}
									style={{
										width: '100%',
										padding: '8px',
										border: '1px solid #ddd',
										borderRadius: '4px',
										boxSizing: 'border-box'
									}}
								/>
							</div>

							{/* Date Fields Row */}
							<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
								{/* Effective Date */}
								<div className="form-field">
									<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
										Effective Date
									</label>
									<input
										type="date"
										value={state.newAssessmentForm.effectiveDate}
										oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'effectiveDate', value: e.target.value})}
										style={{
											width: '100%',
											padding: '8px',
											border: '1px solid #ddd',
											borderRadius: '4px',
											boxSizing: 'border-box'
										}}
									/>
								</div>

								{/* End Date */}
								<div className="form-field">
									<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
										End Date
									</label>
									<input
										type="date"
										value={state.newAssessmentForm.endDate}
										oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'endDate', value: e.target.value})}
										style={{
											width: '100%',
											padding: '8px',
											border: '1px solid #ddd',
											borderRadius: '4px',
											boxSizing: 'border-box'
										}}
									/>
								</div>
							</div>

							{/* Review Date Fields Row */}
							<div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px'}}>
								{/* Review Date */}
								<div className="form-field">
									<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
										Review Date
									</label>
									<input
										type="date"
										value={state.newAssessmentForm.reviewDate}
										oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'reviewDate', value: e.target.value})}
										style={{
											width: '100%',
											padding: '8px',
											border: '1px solid #ddd',
											borderRadius: '4px',
											boxSizing: 'border-box'
										}}
									/>
								</div>

								{/* Next Review Date */}
								<div className="form-field">
									<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
										Next Review Date
									</label>
									<input
										type="date"
										value={state.newAssessmentForm.nextReviewDate}
										oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'nextReviewDate', value: e.target.value})}
										style={{
											width: '100%',
											padding: '8px',
											border: '1px solid #ddd',
											borderRadius: '4px',
											boxSizing: 'border-box'
										}}
									/>
								</div>
							</div>

							{/* Response Logging */}
							<div className="form-field">
								<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
									Response Logging
								</label>
								<select
									value={state.newAssessmentForm.responseLogging}
									onchange={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'responseLogging', value: e.target.value})}
									style={{
										width: '100%',
										padding: '8px',
										border: '1px solid #ddd',
										borderRadius: '4px',
										boxSizing: 'border-box'
									}}
								>
									<option value="use_default">Use Org Default</option>
									<option value="disabled">Disabled</option>
									<option value="draft">Save as Draft and Submit</option>
									<option value="submit">Submit Only</option>
								</select>
							</div>

							{/* Allow MCG Content */}
							<div className="form-field">
								<label style={{display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500'}}>
									<input
										type="checkbox"
										checked={state.newAssessmentForm.allowMcgContent}
										onchange={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'allowMcgContent', value: e.target.checked})}
									/>
									Allow MCG Content
								</label>
							</div>

							{/* Enable "Select All PGI Elements" */}
							<div className="form-field">
								<label style={{display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500'}}>
									<input
										type="checkbox"
										checked={state.newAssessmentForm.selectAllEnabled}
										onchange={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {fieldName: 'selectAllEnabled', value: e.target.checked})}
									/>
									Enable "Select All PGI Elements"
								</label>
							</div>
						</div>

						{/* Modal Buttons */}
						<div className="modal-buttons" style={{
							marginTop: '25px',
							display: 'flex',
							gap: '10px',
							justifyContent: 'flex-end'
						}}>
							<button
								className="modal-save-btn"
								style={{
									backgroundColor: '#28a745',
									color: 'white',
									border: 'none',
									padding: '10px 20px',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '14px',
									fontWeight: '500'
								}}
								onclick={() => dispatch('SAVE_NEW_ASSESSMENT')}
							>
								<CheckIcon /> Create Assessment
							</button>
							<button
								className="modal-cancel-btn"
								style={{
									backgroundColor: '#6c757d',
									color: 'white',
									border: 'none',
									padding: '10px 20px',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '14px'
								}}
								onclick={() => dispatch('CANCEL_NEW_ASSESSMENT')}
							>
								✗ Cancel
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Custom Attributes Modal */}
			{state.customAttributesModalOpen && (
				<div className="modal-overlay" style={{
					position: 'fixed',
					top: '0',
					left: '0',
					width: '100vw',
					height: '100vh',
					backgroundColor: 'rgba(0,0,0,0.75)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: '99999',
					isolation: 'isolate'
				}}
				onclick={(e) => {
					if (e.target.className === 'modal-overlay') {
						dispatch('SAVE_CUSTOM_ATTRIBUTES');
					}
				}}
				>
					<div className="modal-content" style={{
						backgroundColor: 'white',
						padding: '20px',
						borderRadius: '8px',
						width: '500px',
						maxWidth: '90vw',
						maxHeight: '90vh',
						overflow: 'auto',
						boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
						zIndex: '10000',
						position: 'relative'
					}}>
						<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
							<h3 className="modal-title" style={{marginTop: '0', marginBottom: '0'}}>
								Custom Attributes - {state.customAttributesItemType === 'question' ? 'Question' : 'Answer'}
							</h3>
							<button
								className="modal-close"
								onclick={() => dispatch('SAVE_CUSTOM_ATTRIBUTES')}
								style={{
									background: 'none',
									border: 'none',
									fontSize: '24px',
									cursor: 'pointer',
									padding: '0',
									lineHeight: '1'
								}}
							>
								×
							</button>
						</div>

						{/* Validation Error Message */}
						{state.customAttributesValidationError && (
							<div style={{
								backgroundColor: '#fee',
								border: '1px solid #fcc',
								borderRadius: '4px',
								padding: '12px',
								marginBottom: '15px',
								color: '#c00',
								fontSize: '14px',
								display: 'flex',
								alignItems: 'center',
								gap: '8px'
							}}>
								<span style={{fontSize: '18px'}}>⚠️</span>
								<span>{state.customAttributesValidationError}</span>
							</div>
						)}

						<div className="custom-attributes-editor">
							{state.customAttributesData && state.customAttributesData.length > 0 ? (
								state.customAttributesData.map((attribute, index) => (
									<div key={index} className="custom-attribute-row" style={{
										display: 'flex',
										gap: '8px',
										marginBottom: '12px',
										alignItems: 'center'
									}}>
										<input
											type="text"
											placeholder="Key"
											value={attribute.key}
											oninput={(e) => {
												dispatch('UPDATE_CUSTOM_ATTRIBUTE', {
													index: index,
													field: 'key',
													value: e.target.value
												});
											}}
											style={{
												flex: '1',
												padding: '8px',
												border: '1px solid #ddd',
												borderRadius: '4px',
												zIndex: '10001',
												position: 'relative'
											}}
										/>
										<input
											type="text"
											placeholder="Value"
											value={attribute.value}
											oninput={(e) => {
												dispatch('UPDATE_CUSTOM_ATTRIBUTE', {
													index: index,
													field: 'value',
													value: e.target.value
												});
											}}
											style={{
												flex: '1',
												padding: '8px',
												border: '1px solid #ddd',
												borderRadius: '4px',
												zIndex: '10001',
												position: 'relative'
											}}
										/>
										<button
											onclick={() => {
												dispatch('REMOVE_CUSTOM_ATTRIBUTE_ROW', {index: index});
											}}
											style={{
												background: '#6b7280',
												color: 'white',
												border: 'none',
												padding: '8px',
												borderRadius: '4px',
												cursor: 'pointer',
												fontSize: '12px',
												zIndex: '10001',
												position: 'relative'
											}}
											title="Remove this attribute"
										>
											✗
										</button>
									</div>
								))
							) : (
								<p style={{textAlign: 'center', color: '#666', fontStyle: 'italic'}}>
									No custom attributes yet. Click "Add Attribute" to get started.
								</p>
							)}

							<div style={{marginTop: '15px', marginBottom: '20px'}}>
								<button
									onclick={() => dispatch('ADD_CUSTOM_ATTRIBUTE_ROW')}
									style={{
										background: '#28a745',
										color: 'white',
										border: 'none',
										padding: '8px 12px',
										borderRadius: '4px',
										cursor: 'pointer',
										fontSize: '14px',
										zIndex: '10001',
										position: 'relative'
									}}
								>
									+ Add Attribute
								</button>
							</div>
						</div>

						<div className="modal-buttons" style={{
							display: 'flex',
							gap: '10px',
							justifyContent: 'flex-end',
							borderTop: '1px solid #eee',
							paddingTop: '15px',
							marginTop: '15px'
						}}>
							<button
								className="modal-save-btn"
								style={{
									backgroundColor: '#007bff',
									color: 'white',
									border: 'none',
									padding: '10px 20px',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '14px',
									fontWeight: '500',
									zIndex: '10001',
									position: 'relative'
								}}
								onclick={() => dispatch('SAVE_CUSTOM_ATTRIBUTES')}
							>
								Done
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Relationship Panel */}
			{state.relationshipPanelOpen && (
				<div className={`relationship-panel expanded`}>
					<div className="relationship-header">
						<div className="relationship-title-container">
							<h3>Manage Answer Relationships</h3>
						</div>
						<button
							className="btn-cancel"
							onclick={() => dispatch('CLOSE_RELATIONSHIP_MODAL')}
						>
							<XIcon />
						</button>
					</div>

					{(() => {
						const answerId = state.relationshipModalAnswerId;
						if (!answerId || !state.currentQuestions?.questions) return null;

						// Find the question and answer
						const question = state.currentQuestions.questions.find(q =>
							q.answers && q.answers.some(a => a.ids.id === answerId)
						);
						if (!question) return null;

						const answer = question.answers.find(a => a.ids.id === answerId);
						if (!answer) return null;

						return (
							<div className="relationship-context">
								<div className="context-question">Question: <strong>{question.label}</strong></div>
								<div className="context-answer">Answer: <strong>{answer.label}</strong></div>
							</div>
						);
					})()}

					{/* Ticker-Style System Messages - MOVED TO TOP */}
					<div className="modal-system-messages" style={{
						borderTop: '1px solid #e0e0e0',
						borderBottom: '1px solid #e0e0e0',
						backgroundColor: '#f8f9fa',
						marginBottom: '12px'
					}}>
						{/* Current message ticker with info icon toggle */}
						<div
							className="system-message-ticker"
							style={{
								display: 'flex',
								alignItems: 'center',
								padding: '8px 12px',
								backgroundColor: '#ffffff',
								minHeight: '36px'
							}}
						>
						{/* Info icon button - LEFT SIDE */}
						{state.modalSystemMessages?.length > 0 && (
							<button
								onclick={() => {
									updateState({
										modalSystemMessagesCollapsed: !state.modalSystemMessagesCollapsed
									});
								}}
								style={{
									background: 'none',
									border: 'none',
									cursor: 'pointer',
									padding: '4px',
									fontSize: '18px',
									color: '#17a2b8',
									fontWeight: 'bold',
									marginRight: '12px'
								}}
								title={state.modalSystemMessagesCollapsed ? 'Show message history' : 'Hide message history'}
							>
								ℹ️
							</button>
						)}

							{/* Current message display */}
							{(() => {
								const currentMessage = state.modalSystemMessages?.length > 0
									? state.modalSystemMessages[state.modalSystemMessages.length - 1]
									: null;

								if (currentMessage) {
									return (
										<div style={{
											display: 'flex',
											alignItems: 'center',
											flex: 1,
											fontSize: '13px'
										}}>
											<span style={{
												fontWeight: 'bold',
												color: currentMessage.type === 'success' ? '#28a745' :
													   currentMessage.type === 'error' ? '#dc3545' :
													   currentMessage.type === 'warning' ? '#ffc107' : '#17a2b8',
												marginRight: '8px'
											}}>
												{currentMessage.type === 'success' ? '✅' : currentMessage.type === 'error' ? '❌' : currentMessage.type === 'warning' ? '⚠️' : 'ℹ️'}
											</span>
											<span style={{flex: 1}}>{currentMessage.message}</span>
											<span style={{
												fontSize: '10px',
												color: '#6b7280',
												marginLeft: '8px'
											}}>
												{new Date(currentMessage.timestamp).toLocaleTimeString()}
											</span>
										</div>
									);
								} else {
									return (
										<span style={{
											color: '#6b7280',
											fontSize: '12px',
											fontStyle: 'italic',
											flex: 1
										}}>
											Ready for operations...
										</span>
									);
								}
							})()}
						</div>

						{/* Message history - only show when expanded */}
						{!state.modalSystemMessagesCollapsed && state.modalSystemMessages?.length > 1 && (
							<div
								className="system-messages-history"
								style={{
									height: '150px',  // 2.5x height for expanded history
									overflowY: 'auto',
									borderTop: '1px solid #e0e0e0',
									backgroundColor: '#f8f9fa'
								}}
								ref={(el) => {
									// Auto-scroll to bottom to show latest message
									if (el && state.modalSystemMessages?.length > 0) {
										setTimeout(() => {
											el.scrollTop = el.scrollHeight;
										}, 10);
									}
								}}
							>
								<div style={{padding: '8px 12px', fontSize: '11px', fontWeight: '500', color: '#6b7280'}}>
									Message History:
								</div>
								{state.modalSystemMessages.slice(0, -1).map((msg, index) => (
									<div
										key={index}
										className={`system-message ${msg.type}`}
										style={{
											padding: '4px 12px 4px 48px', // Indent to align with ticker content
											borderBottom: '1px solid #f0f0f0',
											fontSize: '11px',
											lineHeight: '1.3',
											color: '#6b7280'
										}}
									>
										<span style={{
											color: msg.type === 'success' ? '#28a745' :
												   msg.type === 'error' ? '#dc3545' :
												   msg.type === 'warning' ? '#ffc107' : '#17a2b8',
											marginRight: '6px'
										}}>
											{msg.type === 'success' ? '✅' : msg.type === 'error' ? '❌' : msg.type === 'warning' ? '⚠️' : 'ℹ️'}
										</span>
										<span>{msg.message}</span>
										<span style={{
											float: 'right',
											fontSize: '9px',
											color: '#9ca3af'
										}}>
											{new Date(msg.timestamp).toLocaleTimeString()}
										</span>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="relationship-tabs">
								<div
									className={`tab ${state.relationshipModalActiveTab === 'guidelines' ? 'active' : ''}`}
									on={{
										click: () => dispatch('SET_RELATIONSHIP_TAB', {tab: 'guidelines'})
									}}
								>
									📋 Guidelines {(() => {
										const answerId = state.relationshipModalAnswerId;
										const relationships = state.answerRelationships[answerId];

										// First try loaded relationship data
										if (relationships && relationships.guidelines && relationships.guidelines.length > 0) {
											return `(${relationships.guidelines.length})`;
										}

										// Fallback to badge counts from answer.counts
										const answer = state.currentQuestions?.questions?.find(q =>
											q.answers?.some(a => a.ids.id === answerId)
										)?.answers?.find(a => a.ids.id === answerId);

										if (answer?.counts?.triggered_guidelines > 0) {
											return `(${answer.counts.triggered_guidelines})`;
										}

										return '';
									})()}
								</div>
								<div
									className={`tab ${state.relationshipModalActiveTab === 'questions' ? 'active' : ''}`}
									on={{
										click: () => dispatch('SET_RELATIONSHIP_TAB', {tab: 'questions'})
									}}
								>
									❓ Questions {(() => {
										const answerId = state.relationshipModalAnswerId;
										const relationships = state.answerRelationships[answerId];

										// First try loaded relationship data
										if (relationships && relationships.questions && relationships.questions.questions && relationships.questions.questions.length > 0) {
											return `(${relationships.questions.questions.length})`;
										}

										// Fallback to badge counts from answer.counts
										const answer = state.currentQuestions?.questions?.find(q =>
											q.answers?.some(a => a.ids.id === answerId)
										)?.answers?.find(a => a.ids.id === answerId);

										if (answer?.counts?.triggered_questions > 0) {
											return `(${answer.counts.triggered_questions})`;
										}

										return '';
									})()}
								</div>
								<div
									className={`tab ${state.relationshipModalActiveTab === 'problems' ? 'active' : ''}`}
									on={{
										click: () => dispatch('SET_RELATIONSHIP_TAB', {tab: 'problems'})
									}}
								>
									⚠️ Problems {(() => {
										const answerId = state.relationshipModalAnswerId;
										const relationships = state.answerRelationships[answerId];

										// First try loaded relationship data
										if (relationships && relationships.problems && relationships.problems.problems && relationships.problems.problems.length > 0) {
											return `(${relationships.problems.problems.length})`;
										}

										// Fallback to badge counts from answer.counts
										const answer = state.currentQuestions?.questions?.find(q =>
											q.answers?.some(a => a.ids.id === answerId)
										)?.answers?.find(a => a.ids.id === answerId);

										if (answer?.counts?.problems > 0) {
											return `(${answer.counts.problems})`;
										}

										return '';
									})()}
								</div>
								<div
									className={`tab ${state.relationshipModalActiveTab === 'barriers' ? 'active' : ''}`}
									on={{
										click: () => dispatch('SET_RELATIONSHIP_TAB', {tab: 'barriers'})
									}}
								>
									🚧 Barriers {(() => {
										const answerId = state.relationshipModalAnswerId;
										const relationships = state.answerRelationships[answerId];

										// First try loaded relationship data
										if (relationships && relationships.barriers && relationships.barriers.length > 0) {
											return `(${relationships.barriers.length})`;
										}

										// Fallback to badge counts from answer.counts
										const answer = state.currentQuestions?.questions?.find(q =>
											q.answers?.some(a => a.ids.id === answerId)
										)?.answers?.find(a => a.ids.id === answerId);

										if (answer?.counts?.barriers > 0) {
											return `(${answer.counts.barriers})`;
										}

										return '';
									})()}
								</div>
							</div>

							<div className="modal-body">
								{/* Guidelines Tab */}
								{state.relationshipModalActiveTab === 'guidelines' && (
									<div className="tab-content" style={{position: 'relative'}}>
										{/* Loading overlay for guideline operations */}
										{state.savingGuidelineRelationship && (
											<LoadingOverlay message="Processing..." />
										)}
										<h4>Guidelines</h4>

										{/* Existing Guidelines */}
										{(() => {
											const answerId = state.relationshipModalAnswerId;
											const relationships = state.answerRelationships[answerId];

											if (relationships && relationships.guidelines && relationships.guidelines.guidelines && relationships.guidelines.guidelines.length > 0) {
												return (
													<div className="existing-relationships">
														{relationships.guidelines.guidelines.map((guideline, index) => (
															<div key={index} className="relationship-item">
																<span className="relationship-label">{guideline.label}</span>
																<button
																	className="cancel-relationship-btn"
																	on={{
																		click: () => dispatch('REMOVE_GUIDELINE_RELATIONSHIP', {
																			answerId: answerId,
																			guidelineId: guideline.master_id || guideline.id,
																			guidelineName: guideline.label
																		})
																	}}
																	title="Delete guideline"
																>
																	<XIcon />
																</button>
															</div>
														))}
													</div>
												);
											}
											// Check badge counts before showing "no guidelines"
											const answer = state.currentQuestions?.questions?.find(q =>
												q.answers?.some(a => a.ids.id === answerId)
											)?.answers?.find(a => a.ids.id === answerId);

											if (answer?.counts?.triggered_guidelines > 0) {
												return <p>Guidelines exist but relationship data is loading...</p>;
											}
											return <p>No guidelines linked to this answer.</p>;
										})()}

										{/* Add New Guideline */}
										<div className="add-relationship">
											<div className="input-with-actions" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
												<input
													type="text"
													placeholder="Search for guidelines..."
													value={state.relationshipTypeaheadText}
													style={{flex: 1}}
													on={{
														input: (e) => {
															const value = e.target.value;
															updateState({relationshipTypeaheadText: value});

															dispatch('GUIDELINE_TYPEAHEAD_INPUT', {
																text: value,
																answerId: state.relationshipModalAnswerId
															});
														},
														keydown: (e) => {
															if (e.key === 'Escape') {
																dispatch('GUIDELINE_TYPEAHEAD_HIDE');
															}
														},
														blur: () => {
															setTimeout(() => {
																dispatch('GUIDELINE_TYPEAHEAD_HIDE');
															}, 150);
														}
													}}
												/>

												{/* Check/X buttons - always visible when guideline selected */}
												{state.selectedGuideline && (
													<div style={{display: 'flex', gap: '8px', marginLeft: '8px'}}>
														<button
															className="confirm-relationship-btn"
															style={{
																fontSize: '14px',
																padding: '10px 16px',
																backgroundColor: '#10b981',
																color: 'white',
																border: 'none',
																borderRadius: '6px',
																cursor: 'pointer',
																fontWeight: '500'
															}}
															onclick={() => {
																dispatch('ADD_GUIDELINE_RELATIONSHIP', {
																	answerId: state.relationshipModalAnswerId,
																	guidelineId: state.selectedGuideline.master_id || state.selectedGuideline.id,
																	guidelineName: state.selectedGuideline.label || state.selectedGuideline.name
																});

																// Clear the selection after saving
																updateState({
																	selectedGuideline: null,
																	relationshipTypeaheadText: ''
																});
															}}
															title="Save guideline relationship"
														>
															<CheckIcon />
														</button>
														<button
															className="cancel-relationship-btn"
															style={{
																fontSize: '14px',
																padding: '10px 16px',
																backgroundColor: '#6b7280',
																color: 'white',
																border: 'none',
																borderRadius: '6px',
																cursor: 'pointer',
																fontWeight: '500'
															}}
															onclick={() => {
																// Clear the selection without saving
																updateState({
																	selectedGuideline: null,
																	relationshipTypeaheadText: ''
																});
															}}
															title="Cancel"
														>
															<XIcon />
														</button>
													</div>
												)}
											</div>

											{state.relationshipTypeaheadResults.length > 0 && (
												<div className="typeahead-dropdown">
													{state.relationshipTypeaheadResults.map((guideline, index) => (
														<div
															key={guideline.id}
															className="typeahead-item"
															onclick={() => {
																// Just populate the input and store the selected guideline
																updateState({
																	relationshipTypeaheadText: guideline.label || guideline.name,
																	selectedGuideline: guideline,
																	relationshipTypeaheadResults: [] // Hide dropdown
																});
															}}
															style={{
																cursor: 'pointer',
																padding: '8px 12px',
																borderBottom: '1px solid #e5e7eb',
																backgroundColor: '#ffffff'
															}}
															onmouseenter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
															onmouseleave={(e) => e.target.style.backgroundColor = '#ffffff'}
														>
															<div style={{fontWeight: '500', marginBottom: '4px'}}>
																{guideline.label || guideline.name}
															</div>
															{guideline.use_case_category?.name && (
																<div style={{fontSize: '12px', color: '#6b7280'}}>
																	{guideline.use_case_category.name}
																</div>
															)}
														</div>
													))}
												</div>
											)}
										</div>
									</div>
								)}

								{/* Questions Tab */}
								{state.relationshipModalActiveTab === 'questions' && (
									<div className="tab-content" style={{position: 'relative'}}>
										{/* Loading overlay for question operations */}
										{state.savingQuestionRelationship && (
											<LoadingOverlay message="Processing..." />
										)}
										<h4>Questions</h4>

										{/* Existing Questions */}
										{(() => {
											const answerId = state.relationshipModalAnswerId;
											const relationships = state.answerRelationships[answerId];
											if (relationships && relationships.questions && relationships.questions.questions && relationships.questions.questions.length > 0) {
												return (
													<div className="existing-relationships">
														{relationships.questions.questions.map((question, index) => (
															<div key={index} className="relationship-item">
																<span className="relationship-label">{question.label}</span>
																<button
																	className="cancel-relationship-btn"
																	on={{
																		click: () => dispatch('DELETE_BRANCH_QUESTION', {
																			answerId: answerId,
																			questionId: question.id,
																			questionLabel: question.label
																		})
																	}}
																	title="Delete question"
																>
																	<XIcon />
																</button>
															</div>
														))}
													</div>
												);
											}
											// Check if relationships are still loading
											if (state.relationshipsLoading[answerId]) {
												return <p>Loading question relationships...</p>;
											}

											// Use actual relationship data, not stale badge counts
											// Badge counts are only updated on full section refresh, but relationship data is live
											return <p>No questions linked to this answer.</p>;
										})()}

										{/* Add New Question */}
										<div className="add-relationship">
											<div style={{display: 'flex', alignItems: 'center', gap: '4px'}}>
												<input
													type="text"
													placeholder="Search for questions..."
													value={state.relationshipTypeaheadText}
													style={{flex: 1}}
													on={{
														input: (e) => {
															const value = e.target.value;
															updateState({relationshipTypeaheadText: value});

															dispatch('QUESTION_TYPEAHEAD_INPUT', {
																text: value,
																answerId: state.relationshipModalAnswerId
															});
														},
														keydown: (e) => {
															if (e.key === 'Escape') {
																dispatch('QUESTION_TYPEAHEAD_HIDE');
															}
														},
														blur: () => {
															setTimeout(() => {
																dispatch('QUESTION_TYPEAHEAD_HIDE');
															}, 150);
														}
													}}
												/>

												{/* Check/X buttons - always visible when question selected */}
												{state.selectedQuestion && (
													<div style={{display: 'flex', gap: '8px', marginLeft: '8px'}}>
														<button
															className="confirm-relationship-btn"
															style={{
																fontSize: '14px',
																padding: '10px 16px',
																backgroundColor: '#10b981',
																color: 'white',
																border: 'none',
																borderRadius: '6px',
																cursor: 'pointer',
																fontWeight: '500'
															}}
															onclick={() => {
																dispatch('ADD_QUESTION_RELATIONSHIP', {
																	answerId: state.relationshipModalAnswerId,
																	questionId: state.selectedQuestion.ids.id,
																	questionLabel: state.selectedQuestion.label
																});

																// Clear the selection after saving
																updateState({
																	selectedQuestion: null,
																	relationshipTypeaheadText: ''
																});
															}}
															title="Save question relationship"
														>
															<CheckIcon />
														</button>
														<button
															className="cancel-relationship-btn"
															style={{
																fontSize: '14px',
																padding: '10px 16px',
																backgroundColor: '#6b7280',
																color: 'white',
																border: 'none',
																borderRadius: '6px',
																cursor: 'pointer',
																fontWeight: '500'
															}}
															onclick={() => {
																// Clear the selection without saving
																updateState({
																	selectedQuestion: null,
																	relationshipTypeaheadText: ''
																});
															}}
															title="Cancel"
														>
															<XIcon />
														</button>
													</div>
												)}
											</div>

											{state.relationshipTypeaheadResults.length > 0 && (
												<div className="typeahead-dropdown"
													hook-insert={(vnode) => {
														const input = vnode.elm.parentElement.querySelector('input[type="text"]');
														if (input) {
															const rect = input.getBoundingClientRect();
															vnode.elm.style.top = `${rect.bottom}px`;
															vnode.elm.style.left = `${rect.left}px`;
															vnode.elm.style.width = `${rect.width}px`;
														}
													}}
													hook-update={(oldVnode, vnode) => {
														const input = vnode.elm.parentElement.querySelector('input[type="text"]');
														if (input) {
															const rect = input.getBoundingClientRect();
															vnode.elm.style.top = `${rect.bottom}px`;
															vnode.elm.style.left = `${rect.left}px`;
															vnode.elm.style.width = `${rect.width}px`;
														}
													}}
												>
													{state.relationshipTypeaheadResults.map((question, index) => (
														<div
															key={question.ids.id}
															className="typeahead-item"
															onclick={() => {
																// Just populate the input and store the selected question
																updateState({
																	relationshipTypeaheadText: question.label,
																	selectedQuestion: question,
																	relationshipTypeaheadResults: [] // Hide dropdown
																});
															}}
															style={{
																cursor: 'pointer',
																padding: '8px 12px',
																borderBottom: '1px solid #e5e7eb',
																backgroundColor: '#ffffff'
															}}
															onmouseenter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
															onmouseleave={(e) => e.target.style.backgroundColor = '#ffffff'}
														>
															{question.label}
														</div>
													))}
												</div>
											)}

											{state.relationshipTypeaheadText && state.relationshipTypeaheadText.length >= 2 &&
											 state.relationshipTypeaheadResults.length === 0 &&
											 !state.selectedQuestion && (
												<div className="typeahead-dropdown">
													<div className="typeahead-item no-results">
														No matching questions found for "{state.relationshipTypeaheadText}"
													</div>
												</div>
											)}
										</div>
									</div>
								)}

								{/* Problems Tab */}
								{state.relationshipModalActiveTab === 'problems' && (
									<div className="tab-content" style={{position: 'relative'}}>
										{/* Loading overlay for problem add operations */}
										{state.savingProblem && (
											<LoadingOverlay message="Processing..." />
										)}
										<h4>Problems</h4>

										{/* Existing Problems */}
										{(() => {
											const answerId = state.relationshipModalAnswerId;
											const relationships = state.answerRelationships[answerId];
											if (relationships && relationships.problems && relationships.problems.problems && relationships.problems.problems.length > 0) {
												return (
													<div className="existing-relationships">
														{relationships.problems.problems.map((problem, index) => [
															<div key={`problem-${index}`} className="relationship-item" style={{position: "relative"}}>
																{/* Loading overlay for problem delete */}
																{state.deletingProblems[problem.id] && (
																	<LoadingOverlay message="Deleting problem..." />
																)}

																{/* Check if this problem is being edited */}
																{state.editingProblemId === problem.id ? [
																	// Problem editing UI (matches goal layout)
																	<div key="edit-ui" style={{display: 'flex', flexDirection: 'column', flex: 1, gap: '8px'}}>
																		{state.problemDetailsLoading === problem.id ? (
																			<div style={{padding: '12px', textAlign: 'center', color: '#6b7280'}}>
																				Loading problem details...
																			</div>
																		) : [
																			<div key="label-field">
																				<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																					Problem Text
																				</label>
																				<input
																					type="text"
																					value={state.editingProblemData?.label || ''}
																					oninput={(e) => {
																						updateState({
																							editingProblemData: {
																								...state.editingProblemData,
																								label: e.target.value
																							}
																						});
																					}}
																					style={{
																						width: '100%',
																						padding: '8px',
																						border: '1px solid #d1d5db',
																						borderRadius: '4px',
																						fontSize: '14px'
																					}}
																					placeholder="Enter problem text"
																				/>
																			</div>,
																			<div key="alt-field">
																				<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																					Alternative Wording
																				</label>
																				<input
																					type="text"
																					value={state.editingProblemData?.alternative_wording || ''}
																					oninput={(e) => {
																						updateState({
																							editingProblemData: {
																								...state.editingProblemData,
																								alternative_wording: e.target.value
																							}
																						});
																					}}
																					style={{
																						width: '100%',
																						padding: '8px',
																						border: '1px solid #d1d5db',
																						borderRadius: '4px',
																						fontSize: '14px'
																					}}
																					placeholder="Enter alternative wording"
																				/>
																			</div>,
																			<div key="tooltip-field">
																				<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																					Tooltip
																				</label>
																				<textarea
																					value={state.editingProblemData?.tooltip || ''}
																					oninput={(e) => {
																						updateState({
																							editingProblemData: {
																								...state.editingProblemData,
																								tooltip: e.target.value
																							}
																						});
																					}}
																					style={{
																						width: '100%',
																						padding: '8px',
																						border: '1px solid #d1d5db',
																						borderRadius: '4px',
																						fontSize: '14px',
																						minHeight: '60px',
																						resize: 'vertical'
																					}}
																					placeholder="Enter tooltip text"
																				/>
																			</div>,
																			<div key="custom-attributes-field">
																				<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '8px'}}>
																					Custom Attributes
																				</label>
																				<div style={{border: '1px solid #d1d5db', borderRadius: '4px', padding: '12px', backgroundColor: '#f9fafb'}}>
																					{(state.editingProblemData?.custom_attributes && Object.keys(state.editingProblemData.custom_attributes).length > 0) ? (
																						Object.entries(state.editingProblemData.custom_attributes).map(([key, value], index) => (
																							<div key={index} style={{display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center'}}>
																								<input
																									type="text"
																									placeholder="Key"
																									value={key}
																									oninput={(e) => {
																										const oldKey = key;
																										const newKey = e.target.value;
																										const newAttributes = {...state.editingProblemData.custom_attributes};
																										delete newAttributes[oldKey];
																										newAttributes[newKey] = value;
																										updateState({
																											editingProblemData: {
																												...state.editingProblemData,
																												custom_attributes: newAttributes
																											}
																										});
																									}}
																									style={{
																										flex: '1',
																										padding: '6px 8px',
																										border: '1px solid #d1d5db',
																										borderRadius: '4px',
																										fontSize: '12px'
																									}}
																								/>
																								<input
																									type="text"
																									placeholder="Value"
																									value={value}
																									oninput={(e) => {
																										updateState({
																											editingProblemData: {
																												...state.editingProblemData,
																												custom_attributes: {
																													...state.editingProblemData.custom_attributes,
																													[key]: e.target.value
																												}
																											}
																										});
																									}}
																									style={{
																										flex: '1',
																										padding: '6px 8px',
																										border: '1px solid #d1d5db',
																										borderRadius: '4px',
																										fontSize: '12px'
																									}}
																								/>
																								<button
																									onclick={() => {
																										const newAttributes = {...state.editingProblemData.custom_attributes};
																										delete newAttributes[key];
																										updateState({
																											editingProblemData: {
																												...state.editingProblemData,
																												custom_attributes: newAttributes
																											}
																										});
																										// Auto-save after removing custom attribute
																										dispatch('SAVE_PROBLEM_EDITS', {
																											answerId: answerId,
																											problemId: problem.id,
																											editData: {
																												...state.editingProblemData,
																												custom_attributes: newAttributes
																											}
																										});
																									}}
																									style={{
																										background: '#6b7280',
																										color: 'white',
																										border: 'none',
																										padding: '6px 8px',
																										borderRadius: '4px',
																										cursor: 'pointer',
																										fontSize: '12px'
																									}}
																									title="Remove this attribute"
																								>
																									✗
																								</button>
																							</div>
																						))
																					) : (
																						<p style={{textAlign: 'center', color: '#6b7280', fontStyle: 'italic', margin: '8px 0', fontSize: '12px'}}>
																							No custom attributes. Click "Add Attribute" to get started.
																						</p>
																					)}
																					<button
																						onclick={() => {
																							updateState({
																								editingProblemData: {
																									...state.editingProblemData,
																									custom_attributes: {
																										...state.editingProblemData.custom_attributes,
																										'': ''
																									}
																								}
																							});
																						}}
																						style={{
																							background: '#3b82f6',
																							color: 'white',
																							border: 'none',
																							padding: '6px 12px',
																							borderRadius: '4px',
																							cursor: 'pointer',
																							fontSize: '12px',
																							width: '100%'
																						}}
																					>
																						+ Add Attribute
																					</button>
																				</div>
																			</div>
																		]}
																	</div>,
																	<div key="edit-buttons" style={{display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '12px'}}>
																		<button
																			className="confirm-relationship-btn"
																			style={{
																				fontSize: '14px',
																				padding: '8px 12px',
																				backgroundColor: '#10b981',
																				color: 'white',
																				border: 'none',
																				borderRadius: '4px',
																				cursor: 'pointer',
																				fontWeight: '500'
																			}}
																			onclick={() => {
																				dispatch('SAVE_PROBLEM_EDITS', {
																					answerId: answerId,
																					problemId: problem.id,
																					editData: state.editingProblemData
																				});
																			}}
																			title="Save problem changes"
																		>
																			<CheckIcon />
																		</button>
																		<button
																			className="cancel-relationship-btn"
																			style={{
																				fontSize: '14px',
																				padding: '8px 12px',
																				backgroundColor: '#6b7280',
																				color: 'white',
																				border: 'none',
																				borderRadius: '4px',
																				cursor: 'pointer',
																				fontWeight: '500'
																			}}
																			onclick={() => {
																				updateState({
																					editingProblemId: null,
																					editingProblemData: null
																				});
																			}}
																			title="Cancel"
																		>
																			✗
																		</button>
																	</div>
																] : (
																	// Normal display mode - ServiceNow doesn't support JSX fragments, use array
																	[
																		<span
																			className="expansion-icon"
																			onclick={() => dispatch('TOGGLE_PROBLEM_EXPANSION', {
																				problemId: problem.id
																			})}
																			title="Click to expand/collapse goals"
																			style={{cursor: 'pointer', marginRight: '8px', fontSize: '12px'}}
																		>
																			{state.expandedProblems[problem.id] ? '▼' : '▶'}
																		</span>,
																		<span
																			className="relationship-label"
																			ondblclick={() => {
																				// Fetch full problem details before editing
																				dispatch('FETCH_PROBLEM_DETAILS', {
																					problemId: problem.id,
																					fallbackData: {
																						label: problem.label || problem.name,
																						alternative_wording: problem.alternative_wording || '',
																						tooltip: problem.tooltip || ''
																					}
																				});
																			}}
																			title="Double-click to edit"
																			style={{cursor: 'pointer'}}
																		>
																			{problem.label || problem.name}
																		</span>,
																	<button
																		className="cancel-relationship-btn"
																		onclick={() => dispatch('DELETE_PROBLEM_RELATIONSHIP', {
																			answerId: answerId,
																			problemId: problem.id,
																			problemName: problem.label || problem.name
																		})}
																		title="Delete problem"
																			style={{marginLeft: '8px'}}
																	>
																		<XIcon />
																	</button>,
																	<button
																		className="save-bundle-btn"
																		title="Save Problem Bundle to Library"
																		onclick={() => {
																			dispatch('SAVE_PROBLEM_BUNDLE', {
																				problemId: problem.id,
																				problemLabel: problem.label || problem.name
																			});
																		}}
																		style={{marginLeft: '8px'}}
																	>
																		📦
																	</button>
																]
															)}
															</div>,

															// Goals Display - Show when problem is expanded (outside flex container)
															state.expandedProblems[problem.id] && (
																<div key={`goals-${index}`} className="goals-container" style={{marginLeft: '24px', marginTop: '12px', marginBottom: '16px', borderLeft: '2px solid #e2e8f0', paddingLeft: '16px', backgroundColor: '#fafbfc', borderRadius: '6px', padding: '12px'}}>
																	{/* Goals Header */}
																	<div style={{marginBottom: '12px', fontSize: '14px', color: '#374151', fontWeight: '600'}}>
																		Goals
																	</div>

																	{/* Existing Goals */}
																	{(() => {
																		// Check loading state first
																		if (state.goalsLoading[problem.id]) {
																			return (
																				<div style={{fontSize: '14px', color: '#6b7280', fontStyle: 'italic', marginBottom: '12px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px'}}>
																					Loading goals...
																				</div>
																			);
																		}

																		// Check if we have loaded goals data for this problem
																		const problemGoals = state.problemGoals[problem.id];
																		if (problemGoals && problemGoals.length > 0) {
																			return (
																				<div className="existing-goals" style={{marginBottom: '12px'}}>
																					{problemGoals.map((goal, goalIndex) => {
																						// Check if this goal is being edited
																						const isEditing = state.editingGoalId === goal.id;
																						const isLoading = state.goalDetailsLoading === goal.id;

																						return [
																							// Goal Item
																							<div key={`goal-${goalIndex}`} className="goal-item" style={{
																								display: 'flex',
																								alignItems: 'center',
																								marginBottom: '8px',
																								fontSize: '14px',
																								padding: '8px 12px',
																								backgroundColor: '#ffffff',
																								border: '1px solid #e5e7eb',
																								borderRadius: '6px',
																								boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
																								position: 'relative'
																							}}>
																								{/* Loading overlay for goal delete */}
																								{state.deletingGoals[goal.id] && (
																									<LoadingOverlay message="Deleting goal..." />
																								)}

																								{isEditing ? [
																									// Goal editing UI
																									<div key="edit-ui" style={{display: 'flex', flexDirection: 'column', flex: 1, gap: '8px'}}>
																										<div>
																											<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																												Goal Text
																											</label>
																											<input
																												type="text"
																												value={state.editingGoalData?.label || ''}
																												oninput={(e) => {
																													updateState({
																														editingGoalData: {
																															...state.editingGoalData,
																															label: e.target.value
																														}
																													});
																												}}
																												style={{
																													width: '100%',
																													padding: '8px',
																													border: '1px solid #d1d5db',
																													borderRadius: '4px',
																													fontSize: '14px'
																												}}
																												placeholder="Enter goal text"
																											/>
																										</div>
																										<div>
																											<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																												Alternative Wording
																											</label>
																											<input
																												type="text"
																												value={state.editingGoalData?.alternative_wording || ''}
																												oninput={(e) => {
																													updateState({
																														editingGoalData: {
																															...state.editingGoalData,
																															alternative_wording: e.target.value
																														}
																													});
																												}}
																												style={{
																													width: '100%',
																													padding: '8px',
																													border: '1px solid #d1d5db',
																													borderRadius: '4px',
																													fontSize: '14px'
																												}}
																												placeholder="Enter alternative wording"
																											/>
																										</div>
																										<div>
																											<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																												Tooltip
																											</label>
																											<textarea
																												value={state.editingGoalData?.tooltip || ''}
																												oninput={(e) => {
																													updateState({
																														editingGoalData: {
																															...state.editingGoalData,
																															tooltip: e.target.value
																														}
																													});
																												}}
																												style={{
																													width: '100%',
																													padding: '8px',
																													border: '1px solid #d1d5db',
																													borderRadius: '4px',
																													fontSize: '14px',
																													minHeight: '60px',
																													resize: 'vertical'
																												}}
																												placeholder="Enter tooltip text"
																											/>
																										</div>
																										<div>
																											<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '8px'}}>
																												Custom Attributes
																											</label>
																											<div style={{border: '1px solid #d1d5db', borderRadius: '4px', padding: '12px', backgroundColor: '#f9fafb'}}>
																												{(state.editingGoalData?.custom_attributes && Object.keys(state.editingGoalData.custom_attributes).length > 0) ? (
																													Object.entries(state.editingGoalData.custom_attributes).map(([key, value], index) => (
																														<div key={index} style={{display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center'}}>
																															<input
																																type="text"
																																placeholder="Key"
																																value={key}
																																oninput={(e) => {
																																	const oldKey = key;
																																	const newKey = e.target.value;
																																	const newAttributes = {...state.editingGoalData.custom_attributes};
																																	delete newAttributes[oldKey];
																																	newAttributes[newKey] = value;
																																	updateState({
																																		editingGoalData: {
																																			...state.editingGoalData,
																																			custom_attributes: newAttributes
																																		}
																																	});
																																}}
																																style={{
																																	flex: '1',
																																	padding: '6px 8px',
																																	border: '1px solid #d1d5db',
																																	borderRadius: '4px',
																																	fontSize: '12px'
																																}}
																															/>
																															<input
																																type="text"
																																placeholder="Value"
																																value={value}
																																oninput={(e) => {
																																	updateState({
																																		editingGoalData: {
																																			...state.editingGoalData,
																																			custom_attributes: {
																																				...state.editingGoalData.custom_attributes,
																																				[key]: e.target.value
																																			}
																																		}
																																	});
																																}}
																																style={{
																																	flex: '1',
																																	padding: '6px 8px',
																																	border: '1px solid #d1d5db',
																																	borderRadius: '4px',
																																	fontSize: '12px'
																																}}
																															/>
																															<button
																																onclick={() => {
																																	const newAttributes = {...state.editingGoalData.custom_attributes};
																																	delete newAttributes[key];
																																	updateState({
																																		editingGoalData: {
																																			...state.editingGoalData,
																																			custom_attributes: newAttributes
																																		}
																																	});
																																	// Auto-save after removing custom attribute
																																	dispatch('SAVE_GOAL_EDITS', {
																																		goalId: goal.id,
																																		goalData: {
																																			...state.editingGoalData,
																																			custom_attributes: newAttributes
																																		}
																																	});
																																}}
																																style={{
																																	background: '#6b7280',
																																	color: 'white',
																																	border: 'none',
																																	padding: '6px 8px',
																																	borderRadius: '4px',
																																	cursor: 'pointer',
																																	fontSize: '12px'
																																}}
																																title="Remove this attribute"
																															>
																																✗
																															</button>
																														</div>
																													))
																												) : (
																													<p style={{textAlign: 'center', color: '#6b7280', fontStyle: 'italic', margin: '8px 0', fontSize: '12px'}}>
																														No custom attributes. Click "Add Attribute" to get started.
																													</p>
																												)}
																												<button
																													onclick={() => {
																														updateState({
																															editingGoalData: {
																																...state.editingGoalData,
																																custom_attributes: {
																																	...state.editingGoalData.custom_attributes,
																																	'': ''
																																}
																															}
																														});
																													}}
																													style={{
																														background: '#3b82f6',
																														color: 'white',
																														border: 'none',
																														padding: '6px 12px',
																														borderRadius: '4px',
																														cursor: 'pointer',
																														fontSize: '12px',
																														width: '100%'
																													}}
																												>
																													+ Add Attribute
																												</button>
																											</div>
																										</div>
																									</div>,
																									<div key="edit-buttons" style={{display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '12px'}}>
																										<button
																											className="confirm-relationship-btn"
																											style={{
																												fontSize: '14px',
																												padding: '8px 12px',
																												backgroundColor: '#10b981',
																												color: 'white',
																												border: 'none',
																												borderRadius: '4px',
																												cursor: 'pointer',
																												fontWeight: '500'
																											}}
																											onclick={() => {
																												dispatch('SAVE_GOAL_EDITS', {
																													goalId: goal.id,
																													goalData: state.editingGoalData
																												});
																											}}
																											title="Save goal changes"
																										>
																											<CheckIcon />
																										</button>
																										<button
																											className="cancel-relationship-btn"
																											style={{
																												fontSize: '14px',
																												padding: '8px 12px',
																												backgroundColor: '#6b7280',
																												color: 'white',
																												border: 'none',
																												borderRadius: '4px',
																												cursor: 'pointer',
																												fontWeight: '500'
																											}}
																											onclick={() => {
																												updateState({
																													editingGoalId: null,
																													editingGoalData: null,
																													editingGoalProblemId: null
																												});
																											}}
																											title="Cancel"
																										>
																											✗
																										</button>
																									</div>
																								] : [
																									// Normal goal display with expansion icon
																									<span
																										key="expansion-icon"
																										className="expansion-icon"
																										onclick={() => dispatch('TOGGLE_GOAL_EXPANSION', {
																											goalId: goal.id
																										})}
																										title="Click to expand/collapse interventions"
																										style={{cursor: 'pointer', marginRight: '8px', fontSize: '12px'}}
																									>
																										{state.expandedGoals[goal.id] ? '▼' : '▶'}
																									</span>,
																									<span
																										key="goal-label"
																										className="goal-label"
																										style={{flex: 1, cursor: 'pointer', color: '#374151', fontWeight: '500'}}
																										title="Double-click to edit goal"
																										ondblclick={() => {
																											dispatch('GET_GOAL_DETAILS', {
																												goalId: goal.id,
																												problemId: problem.id
																											});
																										}}
																									>
																										{isLoading ? 'Loading...' : (goal.label || goal.name)}
																									</span>,
																									<button
																										key="delete-btn"
																										className="cancel-relationship-btn"
																										style={{marginLeft: '12px', fontSize: '12px', padding: '4px 8px'}}
																										title="Delete goal"
																										onclick={() => dispatch('DELETE_GOAL', {
																											answerId: state.relationshipModalAnswerId,
																											goalId: goal.id,
																											goalName: goal.label || goal.name,
																											problemId: problem.id
																										})}
																									>
																										<XIcon />
																									</button>
																								]}
																							</div>,

																							// Interventions Display - Show when goal is expanded (similar to goals under problems)
																							state.expandedGoals[goal.id] && (
																								<div key={`interventions-${goalIndex}`} className="interventions-container" style={{marginLeft: '24px', marginTop: '12px', marginBottom: '16px', borderLeft: '2px solid #e2e8f0', paddingLeft: '16px', backgroundColor: '#fafbfc', borderRadius: '6px', padding: '12px'}}>
																									{/* Interventions Header */}
																									<div style={{marginBottom: '12px', fontSize: '14px', color: '#374151', fontWeight: '600'}}>
																										Interventions
																									</div>

																									{/* Existing Interventions */}
																									{(() => {
																										// Check loading state first
																										if (state.interventionsLoading[goal.id]) {
																											return (
																												<div style={{fontSize: '14px', color: '#6b7280', fontStyle: 'italic', marginBottom: '12px', padding: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px'}}>
																													Loading interventions...
																												</div>
																											);
																										}

																										// Check if we have loaded interventions data for this goal
																										const goalInterventions = state.goalInterventions[goal.id];
																										if (goalInterventions && goalInterventions.length > 0) {
																											return (
																												<div className="existing-interventions" style={{marginBottom: '12px'}}>
																											{(() => {
																												// Group interventions by category
																												const groupedByCategory = {};
																												goalInterventions.forEach(intervention => {
																													const category = intervention.category || 'Uncategorized';
																													if (!groupedByCategory[category]) {
																														groupedByCategory[category] = [];
																													}
																													groupedByCategory[category].push(intervention);
																												});

																												// Sort categories alphabetically
																												const sortedCategories = Object.keys(groupedByCategory).sort();

																												// Sort interventions within each category alphabetically
																												sortedCategories.forEach(category => {
																													groupedByCategory[category].sort((a, b) => {
																														const labelA = (a.label || '').toLowerCase();
																														const labelB = (b.label || '').toLowerCase();
																														return labelA.localeCompare(labelB);
																													});
																												});

																												return sortedCategories.map(category => (
																													<div key={category} style={{marginBottom: '16px'}}>
																														<div style={{
																															fontSize: '13px',
																															fontWeight: '600',
																															color: '#374151',
																															marginBottom: '8px',
																															paddingBottom: '4px',
																															borderBottom: '2px solid #e5e7eb'
																														}}>
																															{category}
																														</div>
																														{groupedByCategory[category].map((intervention, interventionIndex) => {
																														// Check if this intervention is being edited
																														const isEditing = state.editingInterventionId === intervention.id;
																														const isLoading = state.interventionDetailsLoading === intervention.id;

																														return isEditing ? (
																															// Edit form for intervention
																															<div key={interventionIndex} className="intervention-edit-form" style={{
																																marginBottom: '12px',
																																padding: '12px',
																																backgroundColor: '#f9fafb',
																																border: '2px solid #3b82f6',
																																borderRadius: '6px'
																															}}>
																																<div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
																																	<div>
																																		<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																																			Intervention Text
																																		</label>
																																		<input
																																			type="text"
																																			value={state.editingInterventionData?.label || ''}
																																			oninput={(e) => {
																																				updateState({
																																					editingInterventionData: {
																																						...state.editingInterventionData,
																																						label: e.target.value
																																					}
																																				});
																																			}}
																																			style={{
																																				width: '100%',
																																				padding: '8px',
																																				border: '1px solid #d1d5db',
																																				borderRadius: '4px',
																																				fontSize: '14px'
																																			}}
																																			placeholder="Enter intervention text"
																																		/>
																																	</div>
																																	<div>
																																		<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																																			Alternative Wording
																																		</label>
																																		<input
																																			type="text"
																																			value={state.editingInterventionData?.alternative_wording || ''}
																																			oninput={(e) => {
																																				updateState({
																																					editingInterventionData: {
																																						...state.editingInterventionData,
																																						alternative_wording: e.target.value
																																					}
																																				});
																																			}}
																																			style={{
																																				width: '100%',
																																				padding: '8px',
																																				border: '1px solid #d1d5db',
																																				borderRadius: '4px',
																																				fontSize: '14px'
																																			}}
																																			placeholder="Enter alternative wording"
																																		/>
																																	</div>
																																	<div>
																																		<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																																			Tooltip
																																		</label>
																																		<input
																																			type="text"
																																			value={state.editingInterventionData?.tooltip || ''}
																																			oninput={(e) => {
																																				updateState({
																																					editingInterventionData: {
																																						...state.editingInterventionData,
																																						tooltip: e.target.value
																																					}
																																				});
																																			}}
																																			style={{
																																				width: '100%',
																																				padding: '8px',
																																				border: '1px solid #d1d5db',
																																				borderRadius: '4px',
																																				fontSize: '14px'
																																			}}
																																			placeholder="Enter tooltip text"
																																		/>
																																	</div>
																																	<div>
																																		<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '4px'}}>
																																			Category
																																		</label>
																																		<select
																																			value={state.editingInterventionData?.category || 'assist'}
																																			onchange={(e) => {
																																				updateState({
																																					editingInterventionData: {
																																						...state.editingInterventionData,
																																						category: e.target.value
																																					}
																																				});
																																			}}
																																			style={{
																																				width: '100%',
																																				padding: '8px',
																																				border: '1px solid #d1d5db',
																																				borderRadius: '4px',
																																				fontSize: '14px'
																																			}}
																																		>
																																			<option value="assist">Assist</option>
																																			<option value="coordinate">Coordinate</option>
																																			<option value="educate">Educate</option>
																																			<option value="send">Send</option>
																																			<option value="reconcile">Reconcile</option>
																																		</select>
																																	</div>
																																	<div>
																																		<label style={{display: 'block', fontSize: '12px', fontWeight: '500', color: '#374151', marginBottom: '8px'}}>
																																			Custom Attributes
																																		</label>
																																		<div style={{border: '1px solid #d1d5db', borderRadius: '4px', padding: '12px', backgroundColor: '#f9fafb'}}>
																																			{(state.editingInterventionData?.custom_attributes && Object.keys(state.editingInterventionData.custom_attributes).length > 0) ? (
																																				Object.entries(state.editingInterventionData.custom_attributes).map(([key, value], index) => (
																																					<div key={index} style={{display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center'}}>
																																						<input
																																							type="text"
																																							placeholder="Key"
																																							value={key}
																																							oninput={(e) => {
																																								const oldKey = key;
																																								const newKey = e.target.value;
																																								const newAttributes = {...state.editingInterventionData.custom_attributes};
																																								delete newAttributes[oldKey];
																																								newAttributes[newKey] = value;
																																								updateState({
																																									editingInterventionData: {
																																										...state.editingInterventionData,
																																										custom_attributes: newAttributes
																																									}
																																								});
																																							}}
																																							style={{
																																								flex: '1',
																																								padding: '6px 8px',
																																								border: '1px solid #d1d5db',
																																								borderRadius: '4px',
																																								fontSize: '12px'
																																							}}
																																						/>
																																						<input
																																							type="text"
																																							placeholder="Value"
																																							value={value}
																																							oninput={(e) => {
																																								updateState({
																																									editingInterventionData: {
																																										...state.editingInterventionData,
																																										custom_attributes: {
																																											...state.editingInterventionData.custom_attributes,
																																											[key]: e.target.value
																																										}
																																									}
																																								});
																																							}}
																																							style={{
																																								flex: '1',
																																								padding: '6px 8px',
																																								border: '1px solid #d1d5db',
																																								borderRadius: '4px',
																																								fontSize: '12px'
																																							}}
																																						/>
																																						<button
																																							onclick={() => {
																																								const newAttributes = {...state.editingInterventionData.custom_attributes};
																																								delete newAttributes[key];
																																								updateState({
																																									editingInterventionData: {
																																										...state.editingInterventionData,
																																										custom_attributes: newAttributes
																																									}
																																								});
																																								// Auto-save after removing custom attribute
																																								dispatch('SAVE_INTERVENTION_EDITS', {
																																									interventionId: intervention.id,
																																									interventionData: {
																																										...state.editingInterventionData,
																																										custom_attributes: newAttributes
																																									}
																																								});
																																							}}
																																							style={{
																																								background: '#6b7280',
																																								color: 'white',
																																								border: 'none',
																																								padding: '6px 8px',
																																								borderRadius: '4px',
																																								cursor: 'pointer',
																																								fontSize: '12px'
																																							}}
																																							title="Remove this attribute"
																																						>
																																							✗
																																						</button>
																																					</div>
																																				))
																																			) : (
																																				<p style={{textAlign: 'center', color: '#6b7280', fontStyle: 'italic', margin: '8px 0', fontSize: '12px'}}>
																																					No custom attributes. Click "Add Attribute" to get started.
																																				</p>
																																			)}
																																			<button
																																				onclick={() => {
																																					updateState({
																																						editingInterventionData: {
																																							...state.editingInterventionData,
																																							custom_attributes: {
																																								...state.editingInterventionData.custom_attributes,
																																								'': ''
																																							}
																																						}
																																					});
																																				}}
																																				style={{
																																					background: '#3b82f6',
																																					color: 'white',
																																					border: 'none',
																																					padding: '6px 12px',
																																					borderRadius: '4px',
																																					cursor: 'pointer',
																																					fontSize: '12px',
																																					width: '100%'
																																				}}
																																			>
																																				+ Add Attribute
																																			</button>
																																		</div>
																																	</div>
																																	<div style={{display: 'flex', gap: '8px', marginTop: '8px'}}>
																																		<button
																																			style={{
																																				fontSize: '12px',
																																				padding: '8px 12px',
																																				backgroundColor: '#10b981',
																																				color: 'white',
																																				border: 'none',
																																				borderRadius: '4px',
																																				cursor: 'pointer',
																																				fontWeight: '500'
																																			}}
																																			onclick={() => {
																																				dispatch('SAVE_INTERVENTION_EDITS', {
																																					interventionId: intervention.id,
																																					interventionData: state.editingInterventionData
																																				});
																																			}}
																																			title="Save intervention changes"
																																		>
																																			<CheckIcon />
																																		</button>
																																		<button
																																			style={{
																																				fontSize: '12px',
																																				padding: '8px 12px',
																																				backgroundColor: '#6b7280',
																																				color: 'white',
																																				border: 'none',
																																				borderRadius: '4px',
																																				cursor: 'pointer',
																																				fontWeight: '500'
																																			}}
																																			onclick={() => {
																																				updateState({
																																					editingInterventionId: null,
																																					editingInterventionData: null,
																																					editingInterventionGoalId: null
																																				});
																																			}}
																																			title="Cancel"
																																		>
																																			✗
																																		</button>
																																	</div>
																																</div>
																															</div>
																														) : (
																															// Normal intervention display
																															<div key={interventionIndex} className="intervention-item" style={{
																																display: 'flex',
																																alignItems: 'center',
																																marginBottom: '8px',
																																fontSize: '14px',
																																padding: '8px 12px',
																																backgroundColor: '#ffffff',
																																border: '1px solid #e5e7eb',
																																borderRadius: '6px',
																																boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
																																position: 'relative'
																															}}>
																																{/* Loading overlay for intervention delete */}
																																{state.deletingInterventions[intervention.id] && (
																																	<LoadingOverlay message="Deleting intervention..." />
																																)}

																																<span
																																	className="intervention-label"
																																	style={{flex: 1, cursor: 'pointer', color: '#374151', fontWeight: '500'}}
																																	title="Double-click to edit intervention"
																																	ondblclick={() => {
																																		dispatch('GET_INTERVENTION_DETAILS', {
																																			interventionId: intervention.id,
																																			goalId: goal.id
																																		});
																																	}}
																																>
																																	{isLoading ? 'Loading...' : intervention.label}
																																</span>
																																<span
																																	className="intervention-category"
																																	style={{
																																		marginLeft: '8px',
																																		fontSize: '12px',
																																		padding: '2px 6px',
																																		backgroundColor: '#e0f2fe',
																																		color: '#0369a1',
																																		borderRadius: '4px',
																																		fontWeight: '500'
																																	}}
																																>
																																	{intervention.category}
																																</span>
																																<button
																																	className="delete-intervention-btn"
																																	style={{
																																		marginLeft: '12px',
																																		fontSize: '12px',
																																		fontWeight: 'normal',
																																		padding: '4px 8px',
																																		opacity: state.deletingInterventions[intervention.id] ? 0.6 : 1,
																																		cursor: state.deletingInterventions[intervention.id] ? 'not-allowed' : 'pointer'
																																	}}
																																	title={state.deletingInterventions[intervention.id] ? "Deleting..." : "Delete intervention"}
																																	disabled={state.deletingInterventions[intervention.id]}
																																	onclick={() => {
																																		if (!state.deletingInterventions[intervention.id]) {
																																			dispatch('DELETE_INTERVENTION', {
																																				answerId: state.relationshipModalAnswerId,
																																				interventionId: intervention.id,
																																				interventionName: intervention.label,
																																				goalId: goal.id
																																			});
																																		}
																																	}}
																																>
																																	{state.deletingInterventions[intervention.id] ? '🔄' : 'X'}
																																</button>
																															</div>
																														);
																														})}
																													</div>
																												));
																											})()}
																												</div>
																											);
																										}

																										// Show no interventions message only if we've tried to load (not loading and no data)
																										if (goalInterventions !== undefined && goalInterventions.length === 0) {
																											return (
																												<div style={{fontSize: '14px', color: '#9ca3af', fontStyle: 'italic', marginBottom: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', textAlign: 'center'}}>
																													No interventions linked to this goal yet.
																												</div>
																											);
																										}

																										// Default: haven't loaded yet, show placeholder
																										return (
																											<div style={{fontSize: '14px', color: '#9ca3af', fontStyle: 'italic', marginBottom: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', textAlign: 'center'}}>
																												Click to load interventions...
																											</div>
																										);
																									})()}

																									{/* Add New Intervention */}
																									<div className="add-intervention" style={{marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px', position: 'relative'}}>
																										{/* Loading overlay for intervention save */}
																										{state.savingInterventions[goal.id] && (
																											<LoadingOverlay message="Processing..." />
																										)}
																										<div style={{marginBottom: '8px', fontSize: '13px', color: '#6b7280', fontWeight: '500'}}>
																											Add New Intervention
																										</div>
																										<div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
																											<div style={{display: 'flex', alignItems: 'center', gap: '12px'}}>
																												<div style={{flex: 1, position: 'relative'}}>
																													<input
																														type="text"
																														placeholder="Search for interventions or type to create new..."
																														value={state.interventionTypeaheadText[goal.id] || ''}
																														style={{
																															width: '100%',
																															fontSize: '14px',
																															padding: '10px 12px',
																															border: '1px solid #d1d5db',
																															borderRadius: '6px',
																															backgroundColor: '#ffffff',
																															outline: 'none',
																															transition: 'border-color 0.2s'
																														}}
																														on={{
																															input: (e) => {
																																const value = e.target.value;
																																updateState({
																																	interventionTypeaheadText: {
																																		...state.interventionTypeaheadText,
																																		[goal.id]: value
																																	}
																																});

																																// Trigger search if 3+ characters
																																if (value.length >= 2) {
																																	dispatch('GENERIC_TYPEAHEAD_SEARCH', {
																																		searchText: value,
																																		type: 'intervention',
																																		goalId: goal.id  // Pass goalId for context
																																	});
																																} else {
																																	updateState({
																																		interventionTypeaheadResults: {
																																			...state.interventionTypeaheadResults,
																																			[goal.id]: []
																																		}
																																	});
																																}
																															},
																															blur: (e) => {
																																// Hide results after delay to allow item selection
																																setTimeout(() => {
																																	updateState({
																																		interventionTypeaheadResults: {
																																			...state.interventionTypeaheadResults,
																																			[goal.id]: []
																																		},
																																		// Clear intervention search context after delay
																																		currentInterventionSearchContext: null
																																	});
																																}, 150);
																															},
																															keydown: (e) => {
																																if (e.key === 'Escape') {
																																	updateState({
																																		interventionTypeaheadText: {
																																			...state.interventionTypeaheadText,
																																			[goal.id]: ''
																																		},
																																		interventionTypeaheadResults: {
																																			...state.interventionTypeaheadResults,
																																			[goal.id]: []
																																		},
																																		selectedInterventionData: {
																																			...state.selectedInterventionData,
																																			[goal.id]: null
																																		},
																																		currentInterventionSearchContext: null
																																	});
																																}
																															}
																														}}
																													/>

																													{/* Typeahead Results Dropdown */}
																													{state.interventionTypeaheadResults && state.interventionTypeaheadResults[goal.id] && state.interventionTypeaheadResults[goal.id].length > 0 && (
																														<div style={{
																															position: 'absolute',
																															top: '100%',
																															left: 0,
																															right: 0,
																															backgroundColor: 'white',
																															border: '1px solid #d1d5db',
																															borderRadius: '6px',
																															boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
																															maxHeight: '200px',
																															overflowY: 'auto',
																															zIndex: 8000
																														}}>
																															{state.interventionTypeaheadResults[goal.id].map((intervention, interventionIdx) => {
																																const interventionText = intervention.label || intervention.name;
																																const searchText = state.interventionTypeaheadText?.[goal.id] || '';
																																const isExactMatch = interventionText.toLowerCase().trim() === searchText.toLowerCase().trim();
																																return (
																																	<div
																																		key={interventionIdx}
																																		style={{
																																			padding: '8px 12px',
																																			cursor: 'pointer',
																																			fontSize: '14px',
																																			borderBottom: interventionIdx < state.interventionTypeaheadResults[goal.id].length - 1 ? '1px solid #e5e7eb' : 'none'
																																		}}
																																		on={{
																																			click: () => {
																																				updateState({
																																					interventionTypeaheadText: {
																																						...state.interventionTypeaheadText,
																																						[goal.id]: interventionText
																																					},
																																					interventionTypeaheadResults: {
																																						...state.interventionTypeaheadResults,
																																						[goal.id]: []
																																					},
																																					selectedInterventionData: {
																																						...state.selectedInterventionData,
																																						[goal.id]: intervention
																																					}
																																				});
																																			}
																																		}}
																																	>
																																		<div style={{fontWeight: isExactMatch ? 'bold' : '500'}}>{interventionText}</div>
																																		{intervention.category && (
																																			<div style={{fontSize: '12px', color: '#6b7280', marginTop: '2px'}}>
																																				Category: {intervention.category}
																																			</div>
																																		)}
																																	</div>
																																);
																															})}
																														</div>
																													)}
																												</div>
																												<select
																													style={{
																														fontSize: '14px',
																														padding: '10px 12px',
																														border: '1px solid #d1d5db',
																														borderRadius: '6px',
																														backgroundColor: '#ffffff'
																													}}
																													onchange={(e) => {
																														updateState({
																															interventionCategorySelection: {
																																...state.interventionCategorySelection,
																																[goal.id]: e.target.value
																															}
																														});
																													}}
																												>
																													<option value="assist" selected={!state.interventionCategorySelection || !state.interventionCategorySelection[goal.id] || state.interventionCategorySelection[goal.id] === 'assist'}>Assist</option>
																													<option value="send" selected={state.interventionCategorySelection && state.interventionCategorySelection[goal.id] === 'send'}>Send</option>
																													<option value="educate" selected={state.interventionCategorySelection && state.interventionCategorySelection[goal.id] === 'educate'}>Educate</option>
																													<option value="coordinate" selected={state.interventionCategorySelection && state.interventionCategorySelection[goal.id] === 'coordinate'}>Coordinate</option>
																													<option value="reconcile" selected={state.interventionCategorySelection && state.interventionCategorySelection[goal.id] === 'reconcile'}>Reconcile</option>
																												</select>
																												<button
																													className="create-relationship-btn"
																													style={{
																														fontSize: '14px',
																														padding: '10px 16px',
																														backgroundColor: '#10b981',
																														color: 'white',
																														border: 'none',
																														borderRadius: '6px',
																														cursor: 'pointer',
																														fontWeight: '500'
																													}}
																													title="Save intervention"
																													onclick={(e) => {
																														e.stopPropagation();
																														const interventionText = state.interventionTypeaheadText[goal.id];
																														const selectedIntervention = state.selectedInterventionData[goal.id];
																														const selectedCategory = state.interventionCategorySelection && state.interventionCategorySelection[goal.id] ? state.interventionCategorySelection[goal.id] : 'assist';

																														if (!interventionText || interventionText.trim().length === 0) {
																															return; // Don't save empty interventions
																														}

																														dispatch('SAVE_INTERVENTION_TO_GOAL', {
																															goalId: goal.id,
																															interventionText: interventionText.trim(),
																															category: selectedCategory,
																															selectedIntervention: selectedIntervention, // null if new intervention, object if existing
																															answerId: state.relationshipModalAnswerId
																														});
																													}}
																												>
																													<CheckIcon />
																												</button>
																												<button
																													className="cancel-relationship-btn"
																													style={{
																														fontSize: '14px',
																														padding: '10px 16px',
																														backgroundColor: '#6b7280',
																														color: 'white',
																														border: 'none',
																														borderRadius: '6px',
																														cursor: 'pointer',
																														fontWeight: '500'
																													}}
																													title="Cancel"
																													onclick={(e) => {
																														e.stopPropagation();
																														// Clear intervention input and selection
																														updateState({
																															interventionTypeaheadText: {
																																...state.interventionTypeaheadText,
																																[goal.id]: ''
																															},
																															interventionTypeaheadResults: {
																																...state.interventionTypeaheadResults,
																																[goal.id]: []
																															},
																															selectedInterventionData: {
																																...state.selectedInterventionData,
																																[goal.id]: null
																															},
																															interventionCategorySelection: {
																																...state.interventionCategorySelection,
																																[goal.id]: 'assist' // Reset to default
																															},
																															currentInterventionSearchContext: null
																														});
																													}}
																												>
																													<XIcon />
																												</button>
																											</div>
																										</div>
																									</div>
																								</div>
																							)
																						];
																					}).flat()}
																				</div>
																			);
																		}

																		// Show no goals message only if we've tried to load (not loading and no data)
																		if (problemGoals !== undefined && problemGoals.length === 0) {
																			return (
																				<div style={{fontSize: '14px', color: '#9ca3af', fontStyle: 'italic', marginBottom: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', textAlign: 'center'}}>
																					No goals linked to this problem yet.
																				</div>
																			);
																		}

																		// Default: haven't loaded yet, show placeholder
																		return (
																			<div style={{fontSize: '14px', color: '#9ca3af', fontStyle: 'italic', marginBottom: '12px', padding: '12px', backgroundColor: '#f9fafb', borderRadius: '4px', textAlign: 'center'}}>
																				Click to load goals...
																			</div>
																		);
																	})()}

																	{/* Add New Goal */}
																	<div className="add-goal" style={{marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px', position: 'relative'}}>
																		{/* Loading overlay for goal save */}
																		{state.savingGoals[problem.id] && (
																			<LoadingOverlay message="Processing..." />
																		)}
																		<div style={{marginBottom: '8px', fontSize: '13px', color: '#6b7280', fontWeight: '500'}}>
																			Add New Goal
																		</div>
																		<div style={{display: 'flex', alignItems: 'center', gap: '12px', position: 'relative'}}>
																			<div style={{flex: 1, position: 'relative'}}>
																				<input
																					type="text"
																					placeholder="Search for goals or type to create new..."
																					value={state.goalTypeaheadText[problem.id] || ''}
																					style={{
																						width: '100%',
																						fontSize: '14px',
																						padding: '10px 12px',
																						border: '1px solid #d1d5db',
																						borderRadius: '6px',
																						backgroundColor: '#ffffff',
																						outline: 'none',
																						transition: 'border-color 0.2s'
																					}}
																					on={{
																						input: (e) => {
																							const value = e.target.value;
																							updateState({
																								goalTypeaheadText: {
																									...state.goalTypeaheadText,
																									[problem.id]: value
																								}
																							});

																							// Trigger search if 3+ characters
																							if (value.length >= 2) {
																								dispatch('GENERIC_TYPEAHEAD_SEARCH', {
																									searchText: value,
																									type: 'goal',
																									problemId: problem.id  // Pass problemId for context
																								});
																							} else {
																								updateState({
																									goalTypeaheadResults: {
																										...state.goalTypeaheadResults,
																										[problem.id]: []
																									}
																								});
																							}
																						},
																						focus: (e) => e.target.style.borderColor = '#3b82f6',
																						blur: (e) => {
																							e.target.style.borderColor = '#d1d5db';
																							// Hide dropdown after delay
																							setTimeout(() => {
																								updateState({
																									goalTypeaheadResults: {
																										...state.goalTypeaheadResults,
																										[problem.id]: []
																									},
																									// Clear goal search context after delay
																									currentGoalSearchContext: null
																								});
																							}, 150);
																						},
																						keydown: (e) => {
																							if (e.key === 'Escape') {
																								updateState({
																									goalTypeaheadText: {
																										...state.goalTypeaheadText,
																										[problem.id]: ''
																									},
																									goalTypeaheadResults: {
																										...state.goalTypeaheadResults,
																										[problem.id]: []
																									},
																									selectedGoalData: {
																										...state.selectedGoalData,
																										[problem.id]: null
																									},
																									// Clear goal search context when user escapes
																									currentGoalSearchContext: null
																								});
																							}
																						}
																					}}
																				/>

																				{/* Typeahead dropdown */}
																				{(state.goalTypeaheadResults[problem.id] && state.goalTypeaheadResults[problem.id].length > 0) && (
																					<div style={{
																						position: 'absolute',
																						top: '100%',
																						left: 0,
																						right: 0,
																						backgroundColor: '#ffffff',
																						border: '1px solid #d1d5db',
																						borderRadius: '6px',
																						boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
																						zIndex: 8000,
																						maxHeight: '200px',
																						overflowY: 'auto'
																					}}>
																						{state.goalTypeaheadResults[problem.id].map((goal, goalIdx) => {
																							const goalText = goal.label || goal.name;
																							const searchText = state.goalTypeaheadText?.[problem.id] || '';
																							const isExactMatch = goalText.toLowerCase().trim() === searchText.toLowerCase().trim();
																							return (
																								<div
																									key={goalIdx}
																									style={{
																										padding: '8px 12px',
																										cursor: 'pointer',
																										fontSize: '14px',
																										borderBottom: goalIdx < state.goalTypeaheadResults[problem.id].length - 1 ? '1px solid #e5e7eb' : 'none',
																										fontWeight: isExactMatch ? 'bold' : 'normal'
																									}}
																									on={{
																										click: () => {
																											updateState({
																												goalTypeaheadText: {
																													...state.goalTypeaheadText,
																													[problem.id]: goalText
																												},
																												goalTypeaheadResults: {
																													...state.goalTypeaheadResults,
																													[problem.id]: []
																												},
																												selectedGoalData: {
																													...state.selectedGoalData,
																													[problem.id]: goal
																												}
																											});
																										},
																										mouseenter: (e) => e.target.style.backgroundColor = '#f3f4f6',
																										mouseleave: (e) => e.target.style.backgroundColor = '#ffffff'
																									}}
																								>
																									{goalText}
																								</div>
																							);
																						})}
																					</div>
																				)}
																			</div>
																			<button
																				className="confirm-relationship-btn"
																				style={{
																					fontSize: '14px',
																					padding: '10px 16px',
																					backgroundColor: '#10b981',
																					color: 'white',
																					border: 'none',
																					borderRadius: '6px',
																					cursor: 'pointer',
																					fontWeight: '500'
																				}}
																				title="Save goal"
																				onclick={(e) => {
																					e.stopPropagation();
																					const goalText = state.goalTypeaheadText[problem.id];
																					const selectedGoal = state.selectedGoalData[problem.id];

																					if (!goalText || goalText.trim().length === 0) {
																						return; // Don't save empty goals
																					}

																					dispatch('SAVE_GOAL_TO_PROBLEM', {
																						problemId: problem.id,
																						goalText: goalText.trim(),
																						selectedGoal: selectedGoal, // null if new goal, object if existing
																						answerId: state.relationshipModalAnswerId
																					});
																				}}
																			>
																				<CheckIcon />
																			</button>
																			<button
																				className="cancel-relationship-btn"
																				style={{
																					fontSize: '14px',
																					padding: '10px 16px',
																					backgroundColor: '#6b7280',
																					color: 'white',
																					border: 'none',
																					borderRadius: '6px',
																					cursor: 'pointer',
																					fontWeight: '500'
																				}}
																				title="Cancel"
																				onclick={(e) => {
																					e.stopPropagation();
																					// Clear goal input and selection
																					updateState({
																						goalTypeaheadText: {
																							...state.goalTypeaheadText,
																							[problem.id]: ''
																						},
																						goalTypeaheadResults: {
																							...state.goalTypeaheadResults,
																							[problem.id]: []
																						},
																						selectedGoalData: {
																							...state.selectedGoalData,
																							[problem.id]: null
																						},
																						// Clear goal search context when cancelling
																						currentGoalSearchContext: null
																					});
																				}}
																			>
																				<XIcon />
																			</button>
																		</div>
																	</div>
																</div>
															)
														])}
													</div>
												);
											}
											// Check badge counts before showing "no problems"
											const answer = state.currentQuestions?.questions?.find(q =>
												q.answers?.some(a => a.ids.id === answerId)
											)?.answers?.find(a => a.ids.id === answerId);

											if (answer?.counts?.problems > 0) {
												return <p>Problems exist but relationship data is loading...</p>;
											}
											return <p>No problems linked to this answer.</p>;
										})()}

										{/* Add New Problem */}
										<div className="add-relationship">
											<div className="input-with-actions" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
												<input
													type="text"
													placeholder="Search for problems or type to create new..."
													value={state.relationshipTypeaheadText}
													style={{flex: 1}}
													on={{
														input: (e) => {
															const value = e.target.value;
															updateState({relationshipTypeaheadText: value});

															if (value.length >= 2) {
																// Use generic typeahead for problems
																dispatch('GENERIC_TYPEAHEAD_SEARCH', {
																	searchText: value,
																	type: 'problem'
																});
															} else {
																updateState({relationshipTypeaheadResults: []});
															}
														},
														keydown: (e) => {
															if (e.key === 'Escape') {
																updateState({relationshipTypeaheadResults: [], relationshipTypeaheadText: '', selectedProblemData: null});
															}
														},
														blur: () => {
															setTimeout(() => {
																updateState({relationshipTypeaheadResults: []});
															}, 150);
														}
													}}
												/>

												{/* Check/X buttons - always visible */}
												<button
													className="confirm-relationship-btn"
													style={{
														fontSize: '14px',
														padding: '10px 16px',
														backgroundColor: '#10b981',
														color: 'white',
														border: 'none',
														borderRadius: '6px',
														cursor: 'pointer',
														fontWeight: '500'
													}}
													onclick={() => {
														const problemText = state.relationshipTypeaheadText;
														if (!problemText || problemText.trim() === '') {
															// Show error or do nothing for empty problems
															return;
														}

														if (state.selectedProblemData) {
															// Adding existing problem
															dispatch('ADD_PROBLEM_RELATIONSHIP', {
																answerId: state.relationshipModalAnswerId,
																problemId: state.selectedProblemData.id,
																problemName: state.selectedProblemData.name || state.selectedProblemData.label,
																problemMasterId: state.selectedProblemData.master_id
															});
														} else {
															// Creating new problem
															dispatch('CREATE_NEW_PROBLEM', {
																answerId: state.relationshipModalAnswerId,
																problemName: problemText
															});
														}
													}}
													title="Add Problem"
												>
													<CheckIcon />
												</button>
												<button
													className="cancel-relationship-btn"
													style={{
														fontSize: '14px',
														padding: '10px 16px',
														backgroundColor: '#6b7280',
														color: 'white',
														border: 'none',
														borderRadius: '6px',
														cursor: 'pointer',
														fontWeight: '500'
													}}
													onclick={() => {
														updateState({
															relationshipTypeaheadText: '',
															relationshipTypeaheadResults: [],
															selectedProblemData: null
														});
													}}
													title="Cancel"
												>
													<XIcon />
												</button>
											</div>

											{state.relationshipTypeaheadResults.length > 0 && (
												<div
													className="typeahead-dropdown"
													hook-insert={(vnode) => {
														const input = vnode.elm.parentElement.querySelector('input[type="text"]');
														if (input) {
															const rect = input.getBoundingClientRect();
															vnode.elm.style.top = `${rect.bottom}px`;
															vnode.elm.style.left = `${rect.left}px`;
															vnode.elm.style.width = `${rect.width}px`;
														}
													}}
													hook-update={(oldVnode, vnode) => {
														const input = vnode.elm.parentElement.querySelector('input[type="text"]');
														if (input) {
															const rect = input.getBoundingClientRect();
															vnode.elm.style.top = `${rect.bottom}px`;
															vnode.elm.style.left = `${rect.left}px`;
															vnode.elm.style.width = `${rect.width}px`;
														}
													}}
												>
													{state.relationshipTypeaheadResults.map((problem, index) => {
														const problemText = problem.label || problem.name;
														const searchText = state.relationshipTypeaheadText || '';
														const isExactMatch = problemText.toLowerCase().trim() === searchText.toLowerCase().trim();

														return (
															<div
																key={problem.id}
																className="typeahead-item"
																style={isExactMatch ? {fontWeight: 'bold'} : {}}
																on={{
																	click: () => {
																		updateState({
																			selectedProblemData: problem,
																			relationshipTypeaheadText: problemText,
																			relationshipTypeaheadResults: []
																		});
																	}
																}}
															>
																{problemText}
															</div>
														);
													})}
												</div>
											)}
										</div>
									</div>
								)}

								{/* Barriers Tab */}
								{state.relationshipModalActiveTab === 'barriers' && (
									<div className="tab-content" style={{position: 'relative'}}>
										{/* Loading overlay for barrier operations */}
										{state.savingBarrierRelationship && (
											<LoadingOverlay message="Processing..." />
										)}
										<h4>Barriers</h4>

										{/* Existing Barriers */}
										{(() => {
											const answerId = state.relationshipModalAnswerId;
											const relationships = state.answerRelationships[answerId];
											if (relationships && relationships.barriers && relationships.barriers.barriers && relationships.barriers.barriers.length > 0) {
												return (
													<div className="existing-relationships">
														{relationships.barriers.barriers.map((barrier, index) => (
															<div key={index} className="relationship-item">
																<span className="relationship-label">{barrier.label || barrier.name}</span>
																<button
																	className="cancel-relationship-btn"
																	on={{
																		click: () => dispatch('REMOVE_BARRIER_RELATIONSHIP', {
																			answerId: answerId,
																			barrierId: barrier.id
																		})
																	}}
																	title="Delete barrier"
																>
																	<XIcon />
																</button>
															</div>
														))}
													</div>
												);
											}
											// Check badge counts before showing "no barriers"
											const answer = state.currentQuestions?.questions?.find(q =>
												q.answers?.some(a => a.ids.id === answerId)
											)?.answers?.find(a => a.ids.id === answerId);

											if (answer?.counts?.barriers > 0) {
												return <p>Barriers exist but relationship data is loading...</p>;
											}
											return <p>No barriers linked to this answer.</p>;
										})()}

										{/* Add New Barrier */}
										<div className="add-relationship">
											<div className="input-with-actions" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
												<input
													type="text"
													placeholder="Search for barriers or type to create new..."
													value={state.relationshipTypeaheadText}
													style={{flex: 1}}
													on={{
														input: (e) => {
															const value = e.target.value;
															updateState({relationshipTypeaheadText: value});

															if (value.length >= 2) {
																// Use generic typeahead for barriers
																dispatch('GENERIC_TYPEAHEAD_SEARCH', {
																	searchText: value,
																	type: 'barrier'
																});
															} else {
																updateState({relationshipTypeaheadResults: []});
															}
														},
														keydown: (e) => {
															if (e.key === 'Escape') {
																updateState({relationshipTypeaheadResults: [], relationshipTypeaheadText: '', selectedBarrierData: null});
															}
														},
														blur: () => {
															setTimeout(() => {
																updateState({relationshipTypeaheadResults: []});
															}, 150);
														}
													}}
												/>

												{/* Check/X buttons - always visible */}
												<button
													className="confirm-relationship-btn"
													style={{
														fontSize: '14px',
														padding: '10px 16px',
														backgroundColor: '#10b981',
														color: 'white',
														border: 'none',
														borderRadius: '6px',
														cursor: 'pointer',
														fontWeight: '500'
													}}
													onclick={() => {
														const barrierText = state.relationshipTypeaheadText;
														if (!barrierText || barrierText.trim() === '') {
															// Show error or do nothing for empty barriers
															return;
														}

														if (state.selectedBarrierData) {
															// Adding existing barrier
															dispatch('ADD_BARRIER_RELATIONSHIP', {
																answerId: state.relationshipModalAnswerId,
																barrierId: state.selectedBarrierData.id,
																barrierName: state.selectedBarrierData.name || state.selectedBarrierData.label,
																barrierMasterId: state.selectedBarrierData.master_id
															});
														} else {
															// Creating new barrier
															dispatch('CREATE_NEW_BARRIER', {
																answerId: state.relationshipModalAnswerId,
																barrierName: barrierText
															});
														}
													}}
													title="Add Barrier"
												>
													<CheckIcon />
												</button>
												<button
													className="cancel-relationship-btn"
													style={{
														fontSize: '14px',
														padding: '10px 16px',
														backgroundColor: '#6b7280',
														color: 'white',
														border: 'none',
														borderRadius: '6px',
														cursor: 'pointer',
														fontWeight: '500'
													}}
													onclick={() => {
														updateState({
															relationshipTypeaheadText: '',
															relationshipTypeaheadResults: [],
															selectedBarrierData: null
														});
													}}
													title="Cancel"
												>
													<XIcon />
												</button>
											</div>

											{/* Simple Dropdown - Direct Click */}
											{state.relationshipTypeaheadResults?.length > 0 && (
												<div
													className="typeahead-dropdown"
													hook-insert={(vnode) => {
														const input = vnode.elm.parentElement.querySelector('input[type="text"]');
														if (input) {
															const rect = input.getBoundingClientRect();
															vnode.elm.style.top = `${rect.bottom}px`;
															vnode.elm.style.left = `${rect.left}px`;
															vnode.elm.style.width = `${rect.width}px`;
														}
													}}
													hook-update={(oldVnode, vnode) => {
														const input = vnode.elm.parentElement.querySelector('input[type="text"]');
														if (input) {
															const rect = input.getBoundingClientRect();
															vnode.elm.style.top = `${rect.bottom}px`;
															vnode.elm.style.left = `${rect.left}px`;
															vnode.elm.style.width = `${rect.width}px`;
														}
													}}
												>
													{(() => {
														const answerId = state.relationshipModalAnswerId;
														const relationships = state.answerRelationships[answerId];
														const existingBarrierIds = [];

														// Get existing barrier IDs to filter out
														if (relationships && relationships.barriers && relationships.barriers.barriers) {
															relationships.barriers.barriers.forEach(barrier => {
																if (barrier.id) existingBarrierIds.push(barrier.id);
																if (barrier.master_id) existingBarrierIds.push(barrier.master_id);
															});
														}

														// Filter out existing barriers
														const filteredBarriers = state.relationshipTypeaheadResults.filter(barrier => {
															return !existingBarrierIds.includes(barrier.id) &&
																   !existingBarrierIds.includes(barrier.master_id);
														});

														return filteredBarriers.map((barrier, index) => {
															const barrierText = barrier.name || barrier.label;
															const searchText = state.relationshipTypeaheadText || '';
															const isExactMatch = barrierText.toLowerCase().trim() === searchText.toLowerCase().trim();

															return (
																<div
																	key={barrier.id || index}
																	className="typeahead-item"
																	style={isExactMatch ? {fontWeight: 'bold'} : {}}
																	on={{
																		click: () => {
																			// Fill input and store barrier data with master_id
																			updateState({
																				relationshipTypeaheadText: barrierText,
																				relationshipTypeaheadResults: [],
																				selectedBarrierData: barrier
																			});
																		}
																	}}
																>
																	{barrierText}
																</div>
															);
														});
													})()}
												</div>
											)}
										</div>
									</div>
								)}
							</div>


				</div>
			)}

			{/* PGI Preview Modal */}
			{state.pgiModalOpen && (() => {
				const answerId = state.pgiModalAnswerId;
				const relationships = state.answerRelationships[answerId];
				const isLoading = state.relationshipsLoading[answerId];

				return (
					<div className="modal-overlay" style={{
						position: 'fixed',
						top: 0,
						left: 0,
						width: '100%',
						height: '100%',
						backgroundColor: 'rgba(0, 0, 0, 0.5)',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						zIndex: 9999
					}}
					onclick={() => dispatch('CLOSE_PGI_MODAL')}
					>
						<div className="pgi-modal" style={{
							backgroundColor: 'white',
							borderRadius: '8px',
							width: '90vw',
							maxWidth: '800px',
							height: '80vh',
							display: 'flex',
							flexDirection: 'column',
							boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
						}}
						onclick={(e) => e.stopPropagation()}
						>
							<div style={{
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								padding: '24px 24px 12px 24px',
								borderBottom: '2px solid #e5e7eb',
								flexShrink: 0
							}}>
								<h3 style={{margin: 0, fontSize: '20px', fontWeight: '600'}}>
									Problems, Goals, Interventions & Barriers
								</h3>
								<button
									onclick={() => dispatch('CLOSE_PGI_MODAL')}
									style={{
										background: 'none',
										border: 'none',
										fontSize: '24px',
										cursor: 'pointer',
										color: '#6b7280',
										padding: '0 8px'
									}}
								>
									×
								</button>
							</div>

							<div style={{
								flex: 1,
								overflow: 'auto',
								padding: '24px'
							}}>
							{isLoading ? (
								<div style={{textAlign: 'center', padding: '40px', color: '#6b7280'}}>
									⏳ Loading relationships...
								</div>
							) : !relationships ? (
								<div style={{textAlign: 'center', padding: '40px', color: '#6b7280'}}>
									No relationship data available
								</div>
							) : (
								<div>
									{/* Guidelines Section */}
									{relationships.guidelines && relationships.guidelines.guidelines && relationships.guidelines.guidelines.length > 0 ? (
										<div style={{marginBottom: '24px', position: 'relative'}}>
											{/* Loading overlay for guideline operations */}
											{state.savingGuidelineRelationship && (
												<LoadingOverlay message="Processing..." />
											)}
											<h4 style={{
												fontSize: '16px',
												fontWeight: '600',
												color: '#1f2937',
												marginBottom: '12px',
												display: 'flex',
												alignItems: 'center',
												gap: '8px'
											}}>
												<span style={{
													backgroundColor: '#dbeafe',
													color: '#1e40af',
													padding: '2px 8px',
													borderRadius: '12px',
													fontSize: '14px'
												}}>
													Guidelines ({relationships.guidelines.guidelines_quantity || 0})
												</span>
											</h4>
											{relationships.guidelines.guidelines.map((guideline, gIndex) => (
												<div key={gIndex} style={{
													marginLeft: '16px',
													padding: '12px',
													backgroundColor: '#eff6ff',
													borderLeft: '3px solid #3b82f6',
													borderRadius: '4px',
													marginBottom: '8px'
												}}>
													{guideline.name || guideline.label}
												</div>
											))}
										</div>
									) : null}

									{/* Problems Section */}
									{relationships.problems && relationships.problems.problems && relationships.problems.problems.length > 0 ? (
										<div style={{marginBottom: '24px'}}>
											<h4 style={{
												fontSize: '16px',
												fontWeight: '600',
												color: '#1f2937',
												marginBottom: '12px',
												display: 'flex',
												alignItems: 'center',
												gap: '8px'
											}}>
												<span style={{
													backgroundColor: '#fef3c7',
													color: '#92400e',
													padding: '2px 8px',
													borderRadius: '12px',
													fontSize: '14px'
												}}>
													Problems ({relationships.problems.problems_quantity || 0})
												</span>
											</h4>
											{relationships.problems.problems.map((problem, pIndex) => {
												const isExpanded = state.expandedProblems && state.expandedProblems[problem.id];
												const goals = state.problemGoals && state.problemGoals[problem.id];
												const goalsLoading = state.goalsLoading && state.goalsLoading[problem.id];
												const goalCount = goals ? goals.length : (problem.goals_quantity || 0);

												return (
													<div key={pIndex} style={{
														marginLeft: '16px',
														marginBottom: '16px',
														padding: '12px',
														backgroundColor: '#fffbeb',
														borderLeft: '3px solid #f59e0b',
														borderRadius: '4px'
													}}>
														<div style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}
															onclick={() => {
																if (isExpanded) {
																	updateState({
																		expandedProblems: {
																			...state.expandedProblems,
																			[problem.id]: false
																		}
																	});
																} else {
																	updateState({
																		expandedProblems: {
																			...state.expandedProblems,
																			[problem.id]: true
																		}
																	});
																	if (!goals) {
																		dispatch('LOAD_PROBLEM_GOALS', {
																			problemId: problem.id,
																			guidelineTemplateId: state.currentAssessmentId
																		});
																	}
																}
															}}
														>
															<span style={{fontSize: '12px', color: '#92400e'}}>
																{isExpanded ? '▼' : '▶'}
															</span>
															<div style={{fontWeight: '500', flex: 1}}>
																{problem.label || problem.name}
															</div>
															{goalCount > 0 && (
																<span style={{
																	fontSize: '12px',
																	color: '#059669',
																	backgroundColor: '#f0fdf4',
																	padding: '2px 6px',
																	borderRadius: '8px',
																	fontWeight: '500'
																}}>
																	{goalCount} goal{goalCount !== 1 ? 's' : ''}
																</span>
															)}
														</div>

														{isExpanded && (
															<div style={{marginLeft: '16px', marginTop: '12px'}}>
																{goalsLoading ? (
																	<div style={{padding: '8px', color: '#6b7280', fontSize: '13px'}}>
																		⏳ Loading goals...
																	</div>
																) : goals && goals.length > 0 ? (
																	goals.map((goal, gIndex) => {
																		const isGoalExpanded = state.expandedGoals && state.expandedGoals[goal.id];
																		const interventions = state.goalInterventions && state.goalInterventions[goal.id];
																		const interventionsLoading = state.interventionsLoading && state.interventionsLoading[goal.id];
																		const interventionCount = interventions ? interventions.length : (goal.interventions_quantity || 0);

																		return (
																			<div key={gIndex} style={{
																				marginBottom: '12px',
																				padding: '10px',
																				backgroundColor: '#f0fdf4',
																				borderLeft: '3px solid #10b981',
																				borderRadius: '4px'
																			}}>
																				<div style={{display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer'}}
																					onclick={() => {
																						if (isGoalExpanded) {
																							updateState({
																								expandedGoals: {
																									...state.expandedGoals,
																									[goal.id]: false
																								}
																							});
																						} else {
																							updateState({
																								expandedGoals: {
																									...state.expandedGoals,
																									[goal.id]: true
																								}
																							});
																							if (!interventions) {
																								dispatch('LOAD_GOAL_INTERVENTIONS', {
																									goalId: goal.id,
																									guidelineTemplateId: state.currentAssessmentId
																								});
																							}
																						}
																					}}
																				>
																					<span style={{fontSize: '11px', color: '#059669'}}>
																						{isGoalExpanded ? '▼' : '▶'}
																					</span>
																					<div style={{fontWeight: '500', fontSize: '14px', flex: 1}}>
																						{goal.label || goal.name}
																					</div>
																					{interventionCount > 0 && (
																						<span style={{
																							fontSize: '11px',
																							color: '#3b82f6',
																							backgroundColor: '#eff6ff',
																							padding: '2px 6px',
																							borderRadius: '8px',
																							fontWeight: '500'
																						}}>
																							{interventionCount} intervention{interventionCount !== 1 ? 's' : ''}
																						</span>
																					)}
																				</div>

																				{isGoalExpanded && (
																					<div style={{marginLeft: '16px', marginTop: '8px'}}>
																						{interventionsLoading ? (
																							<div style={{padding: '8px', color: '#6b7280', fontSize: '12px'}}>
																								⏳ Loading interventions...
																							</div>
																						) : interventions && interventions.length > 0 ? (
																							interventions.map((intervention, iIndex) => (
																								<div key={iIndex} style={{
																									padding: '8px',
																									backgroundColor: '#eff6ff',
																									borderLeft: '2px solid #3b82f6',
																									borderRadius: '4px',
																									marginBottom: '6px',
																									fontSize: '13px'
																								}}>
																									{intervention.label || intervention.name}
																								</div>
																							))
																						) : (
																							<div style={{padding: '8px', color: '#6b7280', fontSize: '12px', fontStyle: 'italic'}}>
																								No interventions found
																							</div>
																						)}
																					</div>
																				)}
																			</div>
																		);
																	})
																) : (
																	<div style={{padding: '8px', color: '#6b7280', fontSize: '13px', fontStyle: 'italic'}}>
																		No goals found
																	</div>
																)}
															</div>
														)}
													</div>
												);
											})}
										</div>
									) : null}

									{/* Barriers Section */}
									{relationships.barriers && relationships.barriers.barriers && relationships.barriers.barriers.length > 0 ? (
										<div style={{marginBottom: '24px'}}>
											<h4 style={{
												fontSize: '16px',
												fontWeight: '600',
												color: '#1f2937',
												marginBottom: '12px',
												display: 'flex',
												alignItems: 'center',
												gap: '8px'
											}}>
												<span style={{
													backgroundColor: '#fee2e2',
													color: '#991b1b',
													padding: '2px 8px',
													borderRadius: '12px',
													fontSize: '14px'
												}}>
													Barriers ({relationships.barriers.barriers_quantity || 0})
												</span>
											</h4>
											{relationships.barriers.barriers.map((barrier, bIndex) => (
												<div key={bIndex} style={{
													marginLeft: '16px',
													padding: '12px',
													backgroundColor: '#fef2f2',
													borderLeft: '3px solid #ef4444',
													borderRadius: '4px',
													marginBottom: '8px'
												}}>
													{barrier.label || barrier.name}
												</div>
											))}
										</div>
									) : null}

									{/* No PGI Message */}
									{(!relationships.guidelines || !relationships.guidelines.guidelines || relationships.guidelines.guidelines.length === 0) &&
									 (!relationships.problems || !relationships.problems.problems || relationships.problems.problems.length === 0) &&
									 (!relationships.barriers || !relationships.barriers.barriers || relationships.barriers.barriers.length === 0) && (
										<div style={{textAlign: 'center', padding: '40px', color: '#6b7280'}}>
											No Guidelines, Problems, Goals, Interventions, or Barriers associated with this answer.
										</div>
									)}
								</div>
							)}
							</div>
						</div>
					</div>
				);
			})()}


			{/* Scoring Models Side Panel */}
			{state.scoringPanelOpen && (
				<div className={`scoring-panel-overlay ${state.scoringPanelOpen ? 'open' : ''}`}>
					<div className="scoring-panel">
						<div className="scoring-panel-header">
							<h3>Scoring Models</h3>
							<button
								className="close-panel-btn"
								onclick={() => dispatch('TOGGLE_SCORING_MODE')}
								title="Close panel"
							>
								<XIcon />
							</button>
						</div>
						<div className="scoring-panel-content">
							{state.scoringModelsLoading ? (
								<div className="loading-message">
									<div className="spinner"></div>
									Loading scoring models...
								</div>
							) : (
								<div>
									{/* Create New Scoring Model Form */}
									{state.showCreateScoringModel ? (
										<div className="create-scoring-model-form">
											<h4>Create New Scoring Model</h4>
											<div className="form-group">
												<label>Label:</label>
												<input
													type="text"
													placeholder="Enter scoring model label"
													value={state.newScoringModelLabel || ''}
													className="scoring-model-label-input"
													on={{
														input: (e) => updateState({
															newScoringModelLabel: e.target.value
														})
													}}
												/>
											</div>
											<div className="form-group">
												<label>Scoring Type:</label>
												<input
													type="text"
													className="scoring-model-type-select"
													value="Sum"
													disabled
												/>
											</div>
											<div className="form-buttons">
												<button
													className="btn-primary"
													onclick={() => {
														const label = (state.newScoringModelLabel || '').trim();
														if (!label) {
															updateState({
																systemMessages: [
																	...(state.systemMessages || []),
																	{
																		type: 'error',
																		message: 'Label cannot be empty',
																		timestamp: new Date().toISOString()
																	}
																]
															});
															return;
														}
														dispatch('CREATE_SCORING_MODEL', {
															label: label,
															scoringType: 'sum',
															guidelineTemplateId: state.currentAssessmentId
														});
													}}
													disabled={state.creatingScoringModel}
												>
													{state.creatingScoringModel ? 'Creating...' : 'Create'}
												</button>
												<button
													className="btn-cancel"
													onclick={() => updateState({
														showCreateScoringModel: false,
														newScoringModelLabel: ''
													})}
												>
													Cancel
												</button>
											</div>
										</div>
									) : (
										<div>
											<div className="create-model-header">
												<button
													className="create-model-btn"
													onclick={() => updateState({
														showCreateScoringModel: true,
														newScoringModelLabel: ''
													})}
													disabled={state.selectedScoringModel}
													title={state.selectedScoringModel ? 'Cannot create new model while editing scores' : 'Create a new scoring model'}
												>
													+ Create New Scoring Model
												</button>
											</div>

											{(!state.scoringModels || state.scoringModels.length === 0) ? (
												<div className="no-models-message">
													<p>No scoring models have been created for this assessment.</p>
												</div>
											) : (
												<div className="scoring-models-list">
													{state.scoringModels.map((model, index) => (
														<div key={model.id || index} className="scoring-model-item"
															onclick={() => dispatch('SELECT_SCORING_MODEL', { model: model })}>
															<div className="model-row">
																<div className="model-info">
																	<div className="model-name">
																		<strong>{model.label}</strong>
																	</div>
																	<div className="model-type">
																		Type: {model.scoring_type}
																	</div>
																</div>
																<button
																	className="delete-model-btn"
																	onclick={(e) => {
																		e.stopPropagation();
																		dispatch('DELETE_SCORING_MODEL', {
																			modelId: model.id,
																			modelLabel: model.label
																		});
																	}}
																	disabled={state.selectedScoringModel}
																	title={state.selectedScoringModel ? 'Cannot delete model while editing scores' : `Delete scoring model: ${model.label}`}
																>
																	<XIcon />
																</button>
															</div>
														</div>
													))}
												</div>
											)}
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</div>
			)}

			{/* Confirmation Dialog Modal */}
			{state.confirmationDialogOpen && (
				<div className="modal-overlay" style={{
					position: 'fixed',
					top: '0',
					left: '0',
					width: '100%',
					height: '100%',
					backgroundColor: 'rgba(0,0,0,0.6)',
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
					zIndex: '1000100'
				}}>
					<div className="confirmation-dialog" style={{
						backgroundColor: 'white',
						padding: '24px',
						borderRadius: '12px',
						width: '420px',
						maxWidth: '90vw',
						boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
						position: 'relative',
						zIndex: '1000101',
						animation: 'fadeIn 0.2s ease-out'
					}}>
						<div style={{
							display: 'flex',
							alignItems: 'flex-start',
							marginBottom: '20px'
						}}>
							<span style={{
								fontSize: '32px',
								marginRight: '12px',
								lineHeight: '1'
							}}>⚠️</span>
							<div style={{flex: 1}}>
								<h3 style={{
									margin: '0 0 8px 0',
									fontSize: '18px',
									fontWeight: '600',
									color: '#1f2937'
								}}>Confirm Action</h3>
								<p style={{
									margin: '0',
									fontSize: '14px',
									color: '#6b7280',
									lineHeight: '1.5'
								}}>
									{state.confirmationDialogMessage}
								</p>
							</div>
						</div>
						<div style={{
							display: 'flex',
							gap: '12px',
							justifyContent: 'flex-end'
						}}>
							<button
								style={{
									backgroundColor: '#6b7280',
									color: 'white',
									border: 'none',
									padding: '10px 20px',
									borderRadius: '6px',
									cursor: 'pointer',
									fontSize: '14px',
									fontWeight: '500',
									transition: 'background-color 0.2s'
								}}
								onclick={() => {
									dispatch('CANCEL_DIALOG_ACTION');
								}}
							>
								Cancel
							</button>
							<button
								style={{
									backgroundColor: '#10b981',
									color: 'white',
									border: 'none',
									padding: '10px 20px',
									borderRadius: '6px',
									cursor: 'pointer',
									fontSize: '14px',
									fontWeight: '500',
									transition: 'background-color 0.2s'
								}}
								onmouseenter={(e) => e.target.style.backgroundColor = '#059669'}
								onmouseleave={(e) => e.target.style.backgroundColor = '#10b981'}
								onclick={() => {
									dispatch('CONFIRM_DIALOG_ACTION');
								}}
							>
								Continue
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Toast Notifications */}
			{state.toastNotifications && state.toastNotifications.length > 0 && (
				<div className="toast-container" style={{
					position: 'fixed',
					top: '20px',
					right: '20px',
					zIndex: '1000200',
					display: 'flex',
					flexDirection: 'column',
					gap: '12px',
					maxWidth: '400px'
				}}>
					{state.toastNotifications.map((toast) => (
						<div
							key={toast.id}
							className="toast-notification"
							style={{
								backgroundColor: 'white',
								padding: '16px',
								borderRadius: '8px',
								boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
								display: 'flex',
								alignItems: 'flex-start',
								gap: '12px',
								minWidth: '300px',
								animation: 'slideInRight 0.3s ease-out',
								borderLeft: `4px solid ${
									toast.type === 'success' ? '#28a745' :
									toast.type === 'error' ? '#dc3545' :
									toast.type === 'warning' ? '#ffc107' : '#17a2b8'
								}`
							}}
						>
							<span style={{
								fontSize: '20px',
								lineHeight: '1'
							}}>
								{toast.type === 'success' ? '✅' :
								 toast.type === 'error' ? '❌' :
								 toast.type === 'warning' ? '⚠️' : 'ℹ️'}
							</span>
							<div style={{flex: 1, fontSize: '14px', color: '#374151'}}>
								{toast.message}
							</div>
							<button
								style={{
									background: 'none',
									border: 'none',
									cursor: 'pointer',
									fontSize: '18px',
									color: '#9ca3af',
									padding: '0',
									lineHeight: '1'
								}}
								onclick={() => {
									dispatch('DISMISS_TOAST', {toastId: toast.id});
								}}
							>
								✗
							</button>
						</div>
					))}
				</div>
			)}

			<div className="version-display">v{packageJson.version}</div>
		</div>
	);
};

createCustomElement('cadal-careiq-builder', {
	renderer: {type: snabbdom},
	view,
	styles,
	initialState: {
		loading: true,
		error: null,
		careiqConfig: null,
		configLoadAttempted: false,
		accessToken: null,
		useCaseCategories: null,
		categoriesLoading: false,
		assessments: null,
		assessmentsLoading: false,
		assessmentsPagination: {
			total: 0,
			apiOffset: 0,
			apiLimit: 200,
			displayPage: 0,
			displayPageSize: 10,
			totalPages: 0
		},
		searchTerm: '',
		filteredAssessments: null,
		expandedAssessments: {},
		assessmentVersions: {},
		currentRequest: null,
		// Assessment Builder state
		builderView: false,
		currentAssessment: null,
		assessmentDetailsLoading: false,
		selectedSection: null,
		selectedSectionLabel: null,
		currentQuestions: null,
		questionsLoading: false,
		builderMode: true, // true = edit mode, false = preview mode
		// Answer selection state for preview mode
		selectedAnswers: {}, // Format: { questionId: [answerId1, answerId2, ...] }
		visibleQuestions: [], // Questions that should be shown based on answer relationships
		// Answer relationships state
		answerRelationships: {}, // Format: { answerId: { problems: [], barriers: [], guidelines: [], questions: [] } }
		relationshipsLoading: {},
		// UI state
		systemMessagesCollapsed: true,
		showRelationships: false, // Toggle for relationship buttons visibility
		scoringPanelOpen: false, // Toggle for scoring models side panel
		scoringModels: null, // Array of scoring models for current assessment
		scoringModelsLoading: false, // Loading state for scoring models
		selectedScoringModel: null, // Currently selected scoring model for editing
		showCreateScoringModel: false, // Toggle for create scoring model form
		newScoringModelLabel: '', // Label input for new scoring model
		creatingScoringModel: false, // Loading state for creating scoring model
		isMobileView: false, // Track if window is mobile-sized for responsive inline styles
		sectionsPanelExpanded: false, // Toggle for expanded sections panel
		questionsPanelExpanded: false, // Toggle for expanded questions panel
		scoringChanges: {}, // Track unsaved scoring changes { answerId: { modelId: score } }
		savingScoringChanges: false, // Loading state for saving scoring changes
		pendingScoringChanges: 0, // Count of pending save requests
		savingGuidelineRelationship: false, // Loading state for adding/deleting guideline relationships
		savingQuestionRelationship: false, // Loading state for adding/deleting question relationships
		savingBarrierRelationship: false, // Loading state for adding/deleting barrier relationships
		relationshipPanelOpen: false, // Controls relationship panel visibility (converted from modal)
		pgiModalOpen: false, // Controls PGI preview modal visibility
		pgiModalAnswerId: null, // Answer ID for PGI modal
		// Add relationship state
		addingRelationship: null, // answerId when adding relationship to that answer
		selectedRelationshipType: null, // 'question', 'problem', 'barrier', 'guideline'
		relationshipTypeaheadText: '', // text input for typeahead search
		relationshipTypeaheadResults: [], // search results for relationship typeahead
		relationshipTypeaheadLoading: false,
		selectedRelationshipQuestion: null, // {id, label} of selected question
		// Question typeahead state (similar to section typeahead)
		questionTypeaheadResults: [],
		questionTypeaheadLoading: false,
		questionTypeaheadQuery: '',
		questionTypeaheadVisible: false,
		questionTypeaheadSelectedIndex: -1,
		questionTypeaheadDebounceTimeout: null,
		selectedQuestionLibraryId: null,
		pendingLibraryQuestionReplacementId: null,
		libraryQuestionLoading: null,
		// New Assessment Modal state
		newAssessmentModalOpen: false,
		newAssessmentForm: {
			guidelineName: '',
			useCaseCategory: 'Chronic Care', // Use actual category from API
			type: 'Assessment Only',
			contentSource: '',
			codePolicyNumber: '',
			effectiveDate: '',
			endDate: '',
			reviewDate: '',
			nextReviewDate: '',
			responseLogging: 'Use Org Default',
			allowMcgContent: false
		},
		// Section editing state
		editingSectionId: null,
		editingSectionName: null,
		// Sections auto-save (no change tracking needed)
		// Question editing state
		editingQuestionId: null,
		editingQuestionName: null,
		// Individual question editing state (replaces bulk change tracking)
		editingQuestion: null, // {questionId, hasChanges}
		// Original data backup for cancel functionality
		originalAssessmentData: null,
		// Section reselection after save
		pendingReselectionSection: null,
		pendingReselectionSectionLabel: null,
		// Drag and drop state
		draggingSection: null,
		dragOverSection: null,
		draggingSectionIndex: null,
		// Tooltip editing state
		editingTooltip: null,
		editingTooltipText: null,
		editingTooltipOriginalText: null,  // Store original value for comparison
		editingTooltipQuestionId: null,
		editingTooltipAnswerId: null,
		// Typeahead state
		sectionTypeaheadResults: [],
		sectionTypeaheadLoading: false,
		sectionTypeaheadQuery: '',
		sectionTypeaheadVisible: false,
		sectionTypeaheadSelectedIndex: -1,
		sectionTypeaheadDebounceTimeout: null,
		selectedSectionLibraryId: null,

		// Answer typeahead state
		answerTypeaheadResults: [],
		answerTypeaheadLoading: false,
		answerTypeaheadQuery: '',
		answerTypeaheadVisible: false,
		answerTypeaheadSelectedIndex: -1,
		answerTypeaheadDebounceTimeout: null,
		editingAnswerId: null,
		currentAnswerSearchQuestionId: null,
		libraryAnswerLoading: null,
		pendingLibraryAnswerReplacementId: null,

		// Relationship Modal state
		relationshipModalAnswerId: null,           // Which answer is being edited
		relationshipModalActiveTab: 'guidelines',  // Current active tab
		selectedGuideline: null,                   // Selected guideline for check/x buttons
		selectedQuestion: null,                    // Selected question for check/x buttons
		modalSystemMessages: [],                   // System messages that occur while modal is open
		modalSystemMessagesCollapsed: true,        // Toggle for modal system messages visibility

		// Pre-save context for problems (prevents duplicates)
		preSaveProblemContext: null,               // Context for pre-save exact match checks
		pendingProblemSave: null,                  // Pending problem save data during exact match check

		// Goal editing state
		editingGoalId: null,                       // ID of goal currently being edited
		editingGoalData: null,                     // Goal data being edited
		goalDetailsLoading: null,                  // ID of goal whose details are being loaded
		goalDetailsFallback: null,                 // Fallback goal data if API fails
		editingGoalProblemId: null,                // Problem ID containing the goal being edited
		lastEditedGoalProblemId: null,             // Problem ID for the last edited goal (for success handler)

		// Intervention editing state (same pattern as goals)
		editingInterventionId: null,               // ID of intervention currently being edited
		editingInterventionData: null,             // Intervention data being edited
		interventionDetailsLoading: null,          // ID of intervention whose details are being loaded
		interventionDetailsFallback: null,         // Fallback intervention data if API fails
		editingInterventionGoalId: null,           // Goal ID containing the intervention being edited
		lastEditedInterventionGoalId: null,        // Goal ID for the last edited intervention (for success handler)
		currentInterventionsLoadingGoalId: null,  // Track which goal is currently loading interventions
		lastDeletedQuestionContext: null,         // Context for deleted question (for success handler)

		// Section operation loading states
		deletingSections: {},                     // Track which sections are being deleted {sectionId: true}
		updatingSections: {},                     // Track which sections are being updated {sectionId: true}
		addingSection: false,                     // Track if a section is being added

		// Question operation loading states
		deletingQuestions: {},                    // Track which questions are being deleted {questionId: true}
		updatingQuestions: {},                    // Track which questions are being updated {questionId: true}
		addingQuestion: false,                    // Track if a question is being added
		savingQuestions: {},                      // Track which questions are being saved {questionId: true}
		cancelingQuestions: {},                   // Track which questions are being canceled {questionId: true}

		// Answer operation loading states
		deletingAnswers: {},                      // Track which answers are being deleted {answerId: true}
		updatingAnswers: {},                      // Track which answers are being updated {answerId: true}
		addingAnswer: false,                      // Track if an answer is being added

		// Problem operation loading states
		deletingProblems: {},                     // Track which problems are being deleted {problemId: true}
		updatingProblems: {},                     // Track which problems are being updated {problemId: true}
		addingProblem: false,                     // Track if a problem is being added
		savingProblem: false,                     // Loading state for adding problem relationship

		// Goal operation loading states
		deletingGoals: {},                        // Track which goals are being deleted {goalId: true}
		updatingGoals: {},                        // Track which goals are being updated {goalId: true}
		addingGoal: false,                        // Track if a goal is being added
		savingGoals: {},                          // Track which problems are saving goals {problemId: true}

		// Intervention operation loading states
		deletingInterventions: {},                // Track which interventions are being deleted {interventionId: true}
		updatingInterventions: {},                // Track which interventions are being updated {interventionId: true}
		addingIntervention: false,                // Track if an intervention is being added
		savingInterventions: {},                  // Track which goals are saving interventions {goalId: true}

		// Relationship operation loading states
		deletingBranchQuestions: {},              // Track which branch questions are being deleted {questionId: true}
		deletingGuidelines: {},                   // Track which guidelines are being deleted {guidelineId: true}
		deletingBarriers: {},                     // Track which barriers are being deleted {barrierId: true}
		addingBranchQuestion: false,              // Track if a branch question is being added
		addingGuideline: false,                   // Track if a guideline is being added
		addingBarrier: false,                     // Track if a barrier is being added

		// Unsaved changes confirmation dialog
		confirmationDialogOpen: false,            // Is confirmation dialog visible
		confirmationDialogMessage: '',            // Message to display
		confirmationDialogPendingAction: null,    // Action to execute if user confirms

		// Loading states for long operations
		creatingVersion: false,                   // Creating new version loading state
		publishingAssessment: false,              // Publishing assessment loading state

		// Pending error context for newer GT version name lookup
		pendingNewerGtError: null,                // {originalMessage, gtId} for "newer GTs available" errors

		// Toast notifications
		toastNotifications: []                    // Array of {id, type, message, timestamp}
	},
	actionHandlers: {
		[COMPONENT_BOOTSTRAPPED]: (coeffects) => {
			const {dispatch} = coeffects;
			dispatch('LOAD_CAREIQ_CONFIG');
			dispatch('CHECK_MOBILE_VIEW');
			
			// Add multiple listeners for responsive behavior
			const checkMobile = () => {
				dispatch('CHECK_MOBILE_VIEW');
			};
			
			window.addEventListener('resize', checkMobile);
			window.addEventListener('orientationchange', checkMobile);
			
			// Use ResizeObserver on document body if available
			if (window.ResizeObserver) {
				const resizeObserver = new ResizeObserver(checkMobile);
				resizeObserver.observe(document.body);
			}
			
			// Also check periodically as fallback - more frequent for dev tools
			setInterval(checkMobile, 500);
			
			// Add visibility change listener (for when dev tools open/close)
			document.addEventListener('visibilitychange', checkMobile);
		},
		
		// Core UI Actions (mobile view, panel toggles, system messages)
		...coreActions,

		
		'LOAD_CAREIQ_CONFIG': effects.LOAD_CAREIQ_CONFIG,

		// Configuration Actions (config loading, token exchange, use case categories)
		...configActions,



		'MAKE_USE_CASE_CATEGORIES_REQUEST': effects.MAKE_USE_CASE_CATEGORIES_REQUEST,


		'MAKE_ASSESSMENTS_REQUEST': effects.MAKE_ASSESSMENTS_REQUEST,

		'ASSESSMENTS_FETCH_START': (coeffects) => {
			const {updateState} = coeffects;
			updateState({assessmentsLoading: true});
		},

		'ASSESSMENTS_SUCCESS': (coeffects) => {
			const {action, state, updateState} = coeffects;
			const assessments = action.payload?.results || [];
			const total = action.payload?.total || 0;
			const offset = action.payload?.offset || 0;
			const limit = action.payload?.limit || 10;
			// Check if this is a version fetch request
			const isVersionFetch = state.currentRequest?.isVersionFetch;
			const targetAssessmentId = state.currentRequest?.targetAssessmentId;

			if (isVersionFetch && targetAssessmentId) {
				// This is a version fetch - cache the versions and expand
				const newVersions = {...state.assessmentVersions};
				newVersions[targetAssessmentId] = assessments;

				const newExpandedState = {...state.expandedAssessments};
				newExpandedState[targetAssessmentId] = true;

				updateState({
					assessmentVersions: newVersions,
					expandedAssessments: newExpandedState,
					assessmentsLoading: false,
					currentRequest: null
				});
			} else {
				// Normal assessment fetch - sort alphabetically by title
				const sortedAssessments = assessments.sort((a, b) => {
					const titleA = a.title.toLowerCase();
					const titleB = b.title.toLowerCase();
					return titleA.localeCompare(titleB);
				});

				updateState({
					assessments: sortedAssessments,
					assessmentsLoading: false,
					filteredAssessments: sortedAssessments,
					assessmentsPagination: {
						...state.assessmentsPagination,
						total: total,
						apiOffset: offset,
						apiLimit: limit,
						displayPage: 0,
						totalPages: Math.ceil(sortedAssessments.length / state.assessmentsPagination.displayPageSize)
					},
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'success',
							message: `Loaded ${assessments.length} assessments`,
							timestamp: new Date().toISOString()
						}
					]
				});
			}
		},

		'ASSESSMENTS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('ASSESSMENTS_ERROR - Full Response:', action.payload);
			console.error('Error type:', typeof action.payload);
			console.error('Error keys:', Object.keys(action.payload || {}));
			console.error('Error Details:', JSON.stringify(action.payload, null, 2));

			// Try to extract error message from various possible locations
			let errorMessage = 'Unknown error';
			if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.detail) {
				errorMessage = action.payload.detail;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			} else if (action.payload?.statusText) {
				errorMessage = action.payload.statusText;
			} else if (action.payload?.response) {
				errorMessage = action.payload.response;
			}

			const fullErrorMessage = 'Failed to fetch assessments: ' + errorMessage;

			updateState({
				assessments: null,
				error: fullErrorMessage,
				assessmentsLoading: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: fullErrorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'FETCH_ASSESSMENTS': (coeffects) => {
			const {action, dispatch, updateState, state} = coeffects;
			const {offset, limit, latestVersionOnly, searchValue} = action.payload;
			updateState({
				assessmentsLoading: true,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'loading',
						message: 'Loading assessments...',
						timestamp: new Date().toISOString()
					}
				]
			});

			const requestBody = JSON.stringify({
				useCase: 'CM',
				offset: offset,
				limit: limit,
				contentSource: 'Organization',
				latestVersionOnly: latestVersionOnly !== false,
				searchValue: searchValue || ''
			});
			dispatch('MAKE_ASSESSMENTS_REQUEST', {requestBody: requestBody});
		},

		'CREATE_NEW_ASSESSMENT': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				newAssessmentModalOpen: true,
				// Reset form to defaults
				newAssessmentForm: {
					guidelineName: '',
					useCaseCategory: 'Chronic Care',
					type: 'Assessment Only',
					contentSource: 'Organization',
					codePolicyNumber: '',
					effectiveDate: '',
					endDate: '',
					reviewDate: '',
					nextReviewDate: '',
					responseLogging: 'use_default',
					allowMcgContent: false,
					selectAllEnabled: false
				}
			});
		},

		'UPDATE_NEW_ASSESSMENT_FIELD': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {fieldName, value} = action.payload;

			updateState({
				newAssessmentForm: {
					...state.newAssessmentForm,
					[fieldName]: value
				}
			});
		},

		'CANCEL_NEW_ASSESSMENT': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				newAssessmentModalOpen: false
			});
		},

		'SAVE_NEW_ASSESSMENT': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			// Validate required fields
			const form = state.newAssessmentForm;

			if (!form.guidelineName || !form.useCaseCategory) {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Please fill in all required fields (Guideline Name and Use Case Category)',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Set loading state
			updateState({
				newAssessmentForm: {
					...form,
					isCreating: true
				},
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'loading',
						message: 'Creating new assessment...',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Dispatch the create assessment API call
			dispatch('CREATE_ASSESSMENT_API', {
				assessmentData: form
			});
		},

		'CREATE_ASSESSMENT_API': (coeffects) => {
			const {action, dispatch, state} = coeffects;
			const {assessmentData} = action.payload;
			// Get config and access token
			const config = state.careiqConfig;
			const accessToken = state.accessToken;

			// CRITICAL: Map the display name to UUID
			let useCaseCategoryId = assessmentData.useCaseCategory;
			// Find the category UUID from loaded categories
			if (state.useCaseCategories && Array.isArray(state.useCaseCategories)) {
				const matchingCategory = state.useCaseCategories.find(cat =>
					cat.name === assessmentData.useCaseCategory ||
					cat.label === assessmentData.useCaseCategory ||
					cat.display_name === assessmentData.useCaseCategory
				);

				if (matchingCategory) {
					useCaseCategoryId = matchingCategory.id || matchingCategory.uuid;
				} else {
					// CRITICAL: Don't send invalid category name - use first available category as fallback
					const fallbackCategory = state.useCaseCategories[0];
					if (fallbackCategory) {
						useCaseCategoryId = fallbackCategory.id || fallbackCategory.uuid;
					}
				}
			}

			// Build request body - ServiceNow wraps in data automatically
			// CRITICAL: Send fields directly, ServiceNow HTTP framework adds data wrapper
			const payload = {
				title: assessmentData.guidelineName, // Map guidelineName to title
				use_case: 'CM', // Fixed value as per your example
				content_source: 'Organization', // Fixed value as per your example
				version_name: assessmentData.guidelineName + ' - v1', // Auto-append v1 to the title
				external_id: assessmentData.external_id || '',
				custom_attributes: assessmentData.custom_attributes || {},
				tags: assessmentData.tags || [],
				tooltip: assessmentData.tooltip || '',
				alternative_wording: assessmentData.alternative_wording || '',
				available: assessmentData.available || false,
				policy_number: assessmentData.codePolicyNumber || '',
				use_case_category_id: useCaseCategoryId, // Use mapped UUID instead of display name
				quality_measures: assessmentData.quality_measures || {},
				settings: {
					store_responses: assessmentData.responseLogging || "use_default"
				},
				usage: assessmentData.usage || 'Care Planning',
				mcg_content_enabled: assessmentData.allowMcgContent || false,
				select_all_enabled: assessmentData.selectAllEnabled || false,
				multi_tenant_default: assessmentData.multi_tenant_default || false
			};

			// Only add date fields if they are not empty
			if (assessmentData.effectiveDate && assessmentData.effectiveDate.trim() !== '') {
				payload.effective_date = assessmentData.effectiveDate;
			}
			if (assessmentData.endDate && assessmentData.endDate.trim() !== '') {
				payload.end_date = assessmentData.endDate;
			}
			if (assessmentData.reviewDate && assessmentData.reviewDate.trim() !== '') {
				payload.review_date = assessmentData.reviewDate;
			}
			if (assessmentData.nextReviewDate && assessmentData.nextReviewDate.trim() !== '') {
				payload.next_review_date = assessmentData.nextReviewDate;
			}

			const requestBody = JSON.stringify(payload);
			dispatch('MAKE_CREATE_ASSESSMENT_REQUEST', {requestBody: requestBody});
		},

		'MAKE_CREATE_ASSESSMENT_REQUEST': effects.MAKE_CREATE_ASSESSMENT_REQUEST,

		'MAKE_CREATE_VERSION_REQUEST': effects.MAKE_CREATE_VERSION_REQUEST,

		'MAKE_UPDATE_ASSESSMENT_REQUEST': effects.MAKE_UPDATE_ASSESSMENT_REQUEST,

		'MAKE_PUBLISH_ASSESSMENT_REQUEST': effects.MAKE_PUBLISH_ASSESSMENT_REQUEST,

		'MAKE_UNPUBLISH_ASSESSMENT_REQUEST': effects.MAKE_UNPUBLISH_ASSESSMENT_REQUEST,

		'CREATE_ASSESSMENT_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			// First check if this is actually a validation error disguised as success
			if (action.payload?.detail && Array.isArray(action.payload.detail)) {
				const hasValidationErrors = action.payload.detail.some(item =>
					item && typeof item === 'object' && (
						item.type === 'date_from_datetime_parsing' ||
						item.type === 'validation_error' ||
						item.type === 'uuid_parsing' ||
						item.msg // Any item with a message is likely an error
					)
				);

				if (hasValidationErrors) {
					// Treat this as an error, not success
					const errorMessages = action.payload.detail
						.filter(item => item && item.msg)
						.map(item => item.msg)
						.join('; ');

					updateState({
						newAssessmentForm: {
							...state.newAssessmentForm,
							isCreating: false
						},
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'error',
								message: `Assessment creation failed: ${errorMessages}`,
								timestamp: new Date().toISOString()
							}
						]
					});
					return; // Exit early - don't try to open builder
				}
			}

			// Try to extract the assessment ID from various possible locations
			let newAssessmentId = action.payload?.id || action.payload?.data?.id;

			// Check if the ID is in the response root or nested
			if (!newAssessmentId && action.payload?.detail?.[0] && typeof action.payload.detail[0] === 'string') {
				newAssessmentId = action.payload.detail[0];
			}

			const assessmentTitle = state.newAssessmentForm.guidelineName;

			// Check if we have a valid ID
			if (!newAssessmentId) {
				updateState({
					newAssessmentForm: {
						...state.newAssessmentForm,
						isCreating: false
					},
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Assessment created but ID not found in response. Check server logs.',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			updateState({
				// Close the modal and reset form
				newAssessmentModalOpen: false,
				newAssessmentForm: {
					guidelineName: '',
					useCaseCategory: 'Chronic Care', // Use actual category from API
					type: 'Assessment Only',
					contentSource: '',
					codePolicyNumber: '',
					effectiveDate: '',
					endDate: '',
					reviewDate: '',
					nextReviewDate: '',
					responseLogging: 'Use Org Default',
					allowMcgContent: false,
					isCreating: false
				},
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Assessment "${assessmentTitle}" created successfully! Opening builder...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Open the newly created assessment in builder mode (same as any other assessment)
			dispatch('OPEN_ASSESSMENT_BUILDER', {
				assessmentId: newAssessmentId,
				assessmentTitle: assessmentTitle
			});
		},

		'CREATE_ASSESSMENT_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('=== CREATE_ASSESSMENT_ERROR DEBUG ===');
			console.error('Full action payload:', action.payload);
			console.error('Error data:', action.payload?.data);
			console.error('Error status:', action.payload?.status);
			console.error('Error response:', action.payload?.response);
			console.error('Raw error message:', action.payload?.message);
			console.error('Complete error object:', JSON.stringify(action.payload, null, 2));

			// Extract error message from various possible locations
			let errorMessage = 'Failed to create assessment';
			if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			} else if (action.payload?.response) {
				errorMessage = action.payload.response;
			}

			console.error('Final error message to display:', errorMessage);

			updateState({
				newAssessmentForm: {
					...state.newAssessmentForm,
					isCreating: false
				},
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CREATE_NEW_VERSION': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {assessmentId, assessmentTitle, currentVersion} = action.payload;

			// Open the modal with pre-populated data - use full assessment title as version name
			updateState({
				createVersionModal: {
					isOpen: true,
					assessmentId: assessmentId,
					assessmentTitle: assessmentTitle,
					policyNumber: state.currentAssessment?.policy_number || '',
					versionName: assessmentTitle || '',
					effectiveDate: state.currentAssessment?.effective_date || ''
				}
			});
		},

		'UPDATE_VERSION_MODAL_FIELD': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {field, value} = action.payload;

			updateState({
				createVersionModal: {
					...state.createVersionModal,
					[field]: value
				}
			});
		},

		'CANCEL_CREATE_VERSION': (coeffects) => {
			const {updateState} = coeffects;

			updateState({
				createVersionModal: {
					isOpen: false,
					assessmentId: null,
					assessmentTitle: '',
					policyNumber: '',
					versionName: '',
					effectiveDate: ''
				}
			});
		},

		'SUBMIT_CREATE_VERSION': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			const modalData = state.createVersionModal;

			// Close modal, show loading message, and set loading state
			updateState({
				creatingVersion: true,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: `Creating new version "${modalData.versionName}"...`,
						timestamp: new Date().toISOString()
					}
				],
				createVersionModal: {
					isOpen: false,
					assessmentId: null,
					assessmentTitle: '',
					policyNumber: '',
					versionName: '',
					effectiveDate: ''
				}
			});

			// Make API call to create version
			const requestBody = JSON.stringify({
				assessmentId: state.currentAssessmentId,
				versionName: modalData.versionName,
				effectiveDate: modalData.effectiveDate
			});

			dispatch('MAKE_CREATE_VERSION_REQUEST', {requestBody: requestBody});
		},

		'OPEN_ASSESSMENT_DETAILS': (coeffects) => {
			const {updateState, state} = coeffects;

			console.log('OPEN_ASSESSMENT_DETAILS - currentAssessment.select_all_enabled:', state.currentAssessment?.select_all_enabled);
			console.log('OPEN_ASSESSMENT_DETAILS - currentAssessment.settings:', state.currentAssessment?.settings);
			console.log('OPEN_ASSESSMENT_DETAILS - currentAssessment.settings.store_responses:', state.currentAssessment?.settings?.store_responses);

			// Open the details panel with current assessment data
			updateState({
				assessmentDetailsPanel: {
					isOpen: true,
					useCase: state.currentAssessment?.use_case || '',
					versionName: state.currentAssessment?.version_name || '',
					title: state.currentAssessment?.title || '',  // NEW - Display only
					useCaseCategory: state.currentAssessment?.use_case_category?.id || '',
					useCaseCategoryName: state.currentAssessment?.use_case_category?.name || '',
					usage: state.currentAssessment?.usage || '',
					contentSource: state.currentAssessment?.content_source || '',
					policyNumber: state.currentAssessment?.policy_number || '',
					effectiveDate: state.currentAssessment?.effective_date || '',
					endDate: state.currentAssessment?.end_date || '',
					reviewDate: state.currentAssessment?.review_date || '',
					nextReviewDate: state.currentAssessment?.next_review_date || '',
					responseLogging: state.currentAssessment?.settings?.store_responses || 'use_default',
					allowMcgContent: state.currentAssessment?.mcg_content_enabled || false,
					enableSelectAllPgi: state.currentAssessment?.select_all_enabled || false,
					isEditable: true,
					status: state.currentAssessment?.status  // Store status to check if published
				}
			});
		},

		'CLOSE_ASSESSMENT_DETAILS': (coeffects) => {
			const {updateState} = coeffects;

			updateState({
				assessmentDetailsPanel: {
					isOpen: false,
					useCase: '',
					versionName: '',
					title: '',  // NEW
					useCaseCategory: '',
					useCaseCategoryName: '',
					usage: '',
					contentSource: '',
					policyNumber: '',
					effectiveDate: '',
					endDate: '',
					reviewDate: '',
					nextReviewDate: '',
					responseLogging: 'use_default',
					allowMcgContent: false,
					enableSelectAllPgi: false,  // NEW
					isEditable: false
				}
			});
		},

		'UPDATE_ASSESSMENT_DETAIL_FIELD': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {field, value} = action.payload;

			console.log('UPDATE_ASSESSMENT_DETAIL_FIELD - field:', field, 'value:', value);

			updateState({
				assessmentDetailsPanel: {
					...state.assessmentDetailsPanel,
					[field]: value
				}
			});
		},

		'SAVE_ASSESSMENT_DETAILS': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			const panelData = state.assessmentDetailsPanel;

			console.log('SAVE_ASSESSMENT_DETAILS - panelData.enableSelectAllPgi:', panelData.enableSelectAllPgi);

			// Close panel and show saving message
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Saving assessment details...',
						timestamp: new Date().toISOString()
					}
				],
				assessmentDetailsPanel: {
					...panelData,
					isOpen: false
				}
			});

			// Build payload based on status
			const status = panelData.status;
			const isPublished = status === 'published';
			const isUnpublished = status === 'unpublished';

			// Don't allow saving unpublished assessments
			if (isUnpublished) {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Cannot save changes to unpublished assessments.',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			let payload;

			if (isPublished) {
				// For published assessments, only send reviewDate and nextReviewDate
				payload = {
					assessmentId: state.currentAssessmentId,
					reviewDate: panelData.reviewDate,
					nextReviewDate: panelData.nextReviewDate
				};
			} else {
				// For draft assessments, send all fields
				payload = {
					assessmentId: state.currentAssessmentId,
					versionName: panelData.versionName,
					useCaseCategory: panelData.useCaseCategory,
					usage: panelData.usage,
					contentSource: panelData.contentSource,
					policyNumber: panelData.policyNumber,
					effectiveDate: panelData.effectiveDate,
					endDate: panelData.endDate,
					reviewDate: panelData.reviewDate,
					nextReviewDate: panelData.nextReviewDate,
					responseLogging: panelData.responseLogging,
					allowMcgContent: panelData.allowMcgContent,
					select_all_enabled: panelData.enableSelectAllPgi
				};
			}

			console.log('SAVE_ASSESSMENT_DETAILS - Full payload:', payload);

			const requestBody = JSON.stringify(payload);
			dispatch('MAKE_UPDATE_ASSESSMENT_REQUEST', {requestBody: requestBody});
		},

		'UNPUBLISH_ASSESSMENT': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {assessmentId, assessmentTitle} = action.payload;

			console.log('UNPUBLISH_ASSESSMENT - assessmentId:', assessmentId);
			console.log('UNPUBLISH_ASSESSMENT - assessmentTitle:', assessmentTitle);

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: `Unpublishing assessment: ${assessmentTitle}...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			const payload = {
				guidelineTemplateId: assessmentId
			};

			const requestBody = JSON.stringify(payload);
			console.log('UNPUBLISH_ASSESSMENT - requestBody:', requestBody);
			console.log('UNPUBLISH_ASSESSMENT - About to dispatch MAKE_UNPUBLISH_ASSESSMENT_REQUEST');
			dispatch('MAKE_UNPUBLISH_ASSESSMENT_REQUEST', {requestBody: requestBody});
		},

		'UNPUBLISH_ASSESSMENT_SUCCESS': (coeffects) => {
			const {updateState, state, dispatch, action} = coeffects;

			console.log('UNPUBLISH_ASSESSMENT_SUCCESS - action.payload:', action.payload);

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Assessment unpublished successfully! Reloading assessment...',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Reload the current assessment to show unpublished state
			if (state.currentAssessmentId) {
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessmentId,
					assessmentTitle: state.currentAssessment?.title || 'Assessment'
				});
			}

			// Also refresh the assessments list
			dispatch('LOAD_ASSESSMENTS', {pageNumber: state.currentPage});
		},

		'UNPUBLISH_ASSESSMENT_ERROR': (coeffects) => {
			const {updateState, state, action} = coeffects;

			console.log('UNPUBLISH_ASSESSMENT_ERROR - action.payload:', action.payload);

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: 'Failed to unpublish assessment. Please try again.',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'PUBLISH_ASSESSMENT': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {assessmentId, assessmentTitle} = action.payload;

			// Open the publish panel with pre-populated data
			updateState({
				publishPanel: {
					isOpen: true,
					assessmentId: assessmentId,
					versionName: state.currentAssessment?.version_name || assessmentTitle,
					effectiveDate: state.currentAssessment?.effective_date || '',
					endDate: state.currentAssessment?.end_date || '',
					reviewDate: state.currentAssessment?.review_date || '',
					nextReviewDate: state.currentAssessment?.next_review_date || '',
					responseLogging: state.currentAssessment?.settings?.store_responses || 'use_default'
				}
			});
		},

		'CLOSE_PUBLISH_PANEL': (coeffects) => {
			const {updateState} = coeffects;

			updateState({
				publishPanel: {
					isOpen: false,
					assessmentId: null,
					versionName: '',
					effectiveDate: '',
					endDate: '',
					reviewDate: '',
					nextReviewDate: '',
					responseLogging: 'use_default'
				}
			});
		},

		'UPDATE_PUBLISH_FIELD': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {field, value} = action.payload;

			updateState({
				publishPanel: {
					...state.publishPanel,
					[field]: value
				}
			});
		},

		'SUBMIT_PUBLISH_ASSESSMENT': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			const publishData = state.publishPanel;
			// Close panel, show publishing message, and set loading state
			updateState({
				publishingAssessment: true,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: `Publishing "${publishData.versionName}"...`,
						timestamp: new Date().toISOString()
					}
				],
				publishPanel: {
					isOpen: false,
					assessmentId: null,
					versionName: '',
					effectiveDate: '',
					endDate: '',
					reviewDate: '',
					nextReviewDate: '',
					responseLogging: 'use_default'
				}
			});

			// Prepare request body with direct fields (ServiceNow adds data wrapper automatically)
			const requestBody = JSON.stringify({
				assessmentId: publishData.assessmentId,
				versionName: publishData.versionName,
				effectiveDate: publishData.effectiveDate,
				endDate: publishData.endDate,
				reviewDate: publishData.reviewDate,
				nextReviewDate: publishData.nextReviewDate,
				responseLogging: publishData.responseLogging
			});
			// Make the API call
			dispatch('MAKE_PUBLISH_ASSESSMENT_REQUEST', {requestBody});
		},

		'PUBLISH_ASSESSMENT_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Extract the new assessment ID from response
			const newAssessmentId = action.payload?.id || action.payload?.data?.id;
			// Show success message and clear loading state
			updateState({
				publishingAssessment: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Assessment published successfully! Reloading assessment data...',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Store current section for reselection after refresh
			updateState({
				pendingReselectionSection: state.selectedSection,
				pendingReselectionSectionLabel: state.selectedSectionLabel
			});

			// If we got a new ID, use it to reload the assessment
			if (newAssessmentId) {
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: newAssessmentId,
					assessmentTitle: state.currentAssessment?.title || 'Assessment'
				});
			} else {
				// Fallback: reload with current ID
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessmentId,
					assessmentTitle: state.currentAssessment?.title || 'Assessment'
				});
			}
		},

		'PUBLISH_ASSESSMENT_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			let errorMessage = 'Failed to publish assessment';

			// Extract error message from response
			if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			}

			updateState({
				publishingAssessment: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'UPDATE_ASSESSMENT_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('UPDATE_ASSESSMENT_SUCCESS - response payload:', action.payload);

			// Show success message
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Assessment details saved successfully',
						timestamp: new Date().toISOString()
					}
				],
				// Reset panel state
				assessmentDetailsPanel: {
					isOpen: false,
					useCase: '',
					versionTitle: '',
					useCaseCategory: '',
					useCaseCategoryName: '',
					usage: '',
					contentSource: '',
					policyNumber: '',
					effectiveDate: '',
					endDate: '',
					reviewDate: '',
					nextReviewDate: '',
					responseLogging: false,
					allowMcgContent: false,
					isEditable: false
				}
			});

			// Refresh assessment data to reflect server changes
			if (state.currentAssessmentId) {
				// Store current section for reselection after refresh
				updateState({
					pendingReselectionSection: state.selectedSection,
					pendingReselectionSectionLabel: state.selectedSectionLabel
				});

				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessmentId,
					assessmentTitle: state.currentAssessment?.title || 'Assessment'
				});
			}
		},

		'UPDATE_ASSESSMENT_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			// Extract error message from backend response
			let errorMessage = 'Failed to save assessment details';
			if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			}

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: errorMessage,
						timestamp: new Date().toISOString()
					}
				],
				// Reset panel state
				assessmentDetailsPanel: {
					isOpen: false,
					useCase: '',
					versionTitle: '',
					useCaseCategory: '',
					useCaseCategoryName: '',
					usage: '',
					contentSource: '',
					policyNumber: '',
					effectiveDate: '',
					endDate: '',
					reviewDate: '',
					nextReviewDate: '',
					responseLogging: false,
					allowMcgContent: false,
					isEditable: false
				}
			});
		},

		'CREATE_VERSION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			// Check if this is actually an error response disguised as success
			if (action.payload && (action.payload.detail || action.payload.error)) {
				const errorMessage = action.payload.detail || action.payload.error;

				// Check if this is a "newer GTs available" error
				if (errorMessage && errorMessage.includes('newer GTs available')) {
					// Extract the GT ID using regex
					const idMatch = errorMessage.match(/newer GTs available:\s*([a-f0-9-]+)/i);

					if (idMatch && idMatch[1]) {
						const newerGtId = idMatch[1];

						// Store the original error message and GT ID for later use
						updateState({
							creatingVersion: false,
							pendingNewerGtError: {
								originalMessage: errorMessage,
								gtId: newerGtId
							}
						});

						// Make API call to get the version name using the correct parameter
						const requestBody = JSON.stringify({
							assessmentId: newerGtId
						});

						dispatch('MAKE_ASSESSMENT_DETAILS_REQUEST', {requestBody});
						return;
					}
				}

				// Regular error - just display it
				updateState({
					creatingVersion: false,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: errorMessage,
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Parse the response to get the new version ID
			let newVersionId = null;
			if (action.payload && action.payload.id) {
				newVersionId = action.payload.id;
			}

			updateState({
				creatingVersion: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'New version created successfully',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Open the new version in the builder
			if (newVersionId) {
				dispatch('OPEN_ASSESSMENT_BUILDER', {
					assessmentId: newVersionId,
					assessmentTitle: 'Assessment' // Will be fetched fresh
				});
			} else {
				// Fallback if no ID returned - show error
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Version created but could not open - no ID returned',
							timestamp: new Date().toISOString()
						}
					]
				});
			}
		},

		'CREATE_VERSION_ERROR': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			// Extract error message from backend response - check all possible locations
			let errorMessage = 'Failed to create new version';
			let detailMessage = null;

			// Check various possible locations for the detail/error message
			if (action.payload?.detail) {
				detailMessage = action.payload.detail;
				errorMessage = detailMessage;
			} else if (action.payload?.data?.detail) {
				detailMessage = action.payload.data.detail;
				errorMessage = detailMessage;
			} else if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
				detailMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
				detailMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
				detailMessage = action.payload.message;
			}

			// Check if this is a "newer GTs available" error
			if (detailMessage && detailMessage.includes('newer GTs available')) {
				// Extract the GT ID using regex: "newer GTs available: <ID>"
				const idMatch = detailMessage.match(/newer GTs available:\s*([a-f0-9-]+)/i);

				if (idMatch && idMatch[1]) {
					const newerGtId = idMatch[1];

					// Store the original error message and GT ID for later use
					updateState({
						creatingVersion: false,
						pendingNewerGtError: {
							originalMessage: errorMessage,
							gtId: newerGtId
						}
					});

					// Make API call to get the version name using the existing assessment details endpoint
					const requestBody = JSON.stringify({
						assessmentId: newerGtId
					});

					dispatch('MAKE_ASSESSMENT_DETAILS_REQUEST', {requestBody});
					return;
				}
			}

			// Regular error - just display it
			updateState({
				creatingVersion: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'GOTO_NEXT_PAGE': (coeffects) => {
			const {state, updateState} = coeffects;
			const dataToShow = state.filteredAssessments || state.assessments;
			const totalPages = Math.ceil(dataToShow.length / state.assessmentsPagination.displayPageSize);
			const newPage = Math.min(state.assessmentsPagination.displayPage + 1, totalPages - 1);
			updateState({
				assessmentsPagination: {
					...state.assessmentsPagination,
					displayPage: newPage
				}
			});
		},

		'GOTO_PREVIOUS_PAGE': (coeffects) => {
			const {state, updateState} = coeffects;
			const newPage = Math.max(0, state.assessmentsPagination.displayPage - 1);
			updateState({
				assessmentsPagination: {
					...state.assessmentsPagination,
					displayPage: newPage
				}
			});
		},

		'GOTO_FIRST_PAGE': (coeffects) => {
			const {state, updateState} = coeffects;
			updateState({
				assessmentsPagination: {
					...state.assessmentsPagination,
					displayPage: 0
				}
			});
		},

		'GOTO_LAST_PAGE': (coeffects) => {
			const {state, updateState} = coeffects;
			const dataToShow = state.filteredAssessments || state.assessments;
			const totalPages = Math.ceil(dataToShow.length / state.assessmentsPagination.displayPageSize);
			const lastPage = Math.max(0, totalPages - 1);
			updateState({
				assessmentsPagination: {
					...state.assessmentsPagination,
					displayPage: lastPage
				}
			});
		},

		'CHANGE_PAGE_SIZE': (coeffects) => {
			const {action, state, updateState} = coeffects;
			const {pageSize} = action.payload;
			// Update the page size and reset to first page
			updateState({
				assessmentsPagination: {
					...state.assessmentsPagination,
					displayPageSize: pageSize,
					displayPage: 0
				}
			});
		},

		'EXPAND_ASSESSMENT_VERSIONS': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {assessmentId, assessmentTitle} = action.payload;
			// Extract base title (remove version suffix)
			const baseTitle = assessmentTitle.replace(/ - v\d+(\.\d+)?$/, '');
			
			// Check if we already have the versions cached
			if (state.assessmentVersions[assessmentId]) {
				// Toggle expansion state
				const newExpandedState = {...state.expandedAssessments};
				newExpandedState[assessmentId] = !newExpandedState[assessmentId];
				
				updateState({
					expandedAssessments: newExpandedState
				});
			} else {
				// Fetch all versions using search_value
				updateState({
					assessmentsLoading: true
				});
				
				dispatch('FETCH_ASSESSMENT_VERSIONS', {
					assessmentId: assessmentId,
					baseTitle: baseTitle
				});
			}
		},

		'FETCH_ASSESSMENT_VERSIONS': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {assessmentId, baseTitle} = action.payload;
			// Set current request info
			updateState({
				currentRequest: {
					isVersionFetch: true,
					targetAssessmentId: assessmentId
				}
			});
			
			dispatch('FETCH_ASSESSMENTS', {
				offset: 0,
				limit: 200,
				latestVersionOnly: false,
				searchValue: baseTitle
			});
		},

		'SEARCH_ASSESSMENTS': (coeffects) => {
			const {action, state, updateState} = coeffects;
			const {searchTerm} = action.payload;
			
			if (!state.assessments) return;
			
			const filtered = searchTerm.trim() === '' ? state.assessments : 
				state.assessments.filter(assessment => 
					assessment.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
					assessment.policy_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
					assessment.use_case_category.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
					assessment.usage.toLowerCase().includes(searchTerm.toLowerCase())
				);
			
			updateState({
				filteredAssessments: filtered,
				assessmentsPagination: {
					...state.assessmentsPagination,
					displayPage: 0
				}
			});
		},

		'OPEN_ASSESSMENT_BUILDER': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {assessmentId, assessmentTitle, skipUnsavedCheck} = action.payload;

			// Check for unsaved changes when switching assessments (unless confirming)
			if (!skipUnsavedCheck && state.builderView) {
				const hasUnsavedChanges =
					(state.sectionChanges && Object.keys(state.sectionChanges).length > 0) ||
					(state.questionChanges && Object.keys(state.questionChanges).length > 0) ||
					(state.answerChanges && Object.keys(state.answerChanges).length > 0);

				if (hasUnsavedChanges) {
					// Show confirmation dialog
					dispatch('SHOW_CONFIRMATION_DIALOG', {
						message: 'You have unsaved changes that will be lost. Do you want to continue?',
						pendingAction: {
							type: 'OPEN_ASSESSMENT_BUILDER',
							payload: {
								assessmentId: assessmentId,
								assessmentTitle: assessmentTitle,
								skipUnsavedCheck: true  // Skip check on retry
							}
						}
					});
					return;  // Block the action
				}
			}

			// Switch to builder view and start loading assessment details
			updateState({
				builderView: true,
				assessmentDetailsLoading: true,
				currentAssessment: null,
				selectedSection: null,
				currentAssessmentId: assessmentId // Store the assessment ID for later use
			});

			// Fetch full assessment details
			dispatch('FETCH_ASSESSMENT_DETAILS', {
				assessmentId: assessmentId,
				assessmentTitle: assessmentTitle
			});
		},

		'REFRESH_ASSESSMENT_DETAILS': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {gtId, pendingReselectionSection, pendingReselectionSectionLabel} = action.payload;
			// Complete state reset for clean start
			updateState({
				assessmentDetailsLoading: true,
				currentAssessment: null,
				selectedSection: null,
				selectedSectionLabel: null,
				currentQuestions: null,
				questionsLoading: false,
				// Clear ALL change tracking
				sectionChanges: {},
				relationshipChanges: {},
				// Clear editing states
				editingSectionId: null,
				editingSectionName: null,
				editingTooltip: null,
				editingTooltipText: null,
				editingTooltipOriginalText: null,
				editingTooltipQuestionId: null,
				editingTooltipAnswerId: null,
				// Clear answer selection state
				selectedAnswers: {},
				visibleQuestions: [],
				// Clear relationships state
				answerRelationships: {},
				relationshipsLoading: {},
				// Store pending reselection
				pendingReselectionSection: pendingReselectionSection
			});
			
			// Fetch fresh assessment details
			dispatch('FETCH_ASSESSMENT_DETAILS', {
				assessmentId: gtId,
				assessmentTitle: state.currentAssessment?.title || 'Assessment'
			});
		},

		'REFRESH_ASSESSMENT': (coeffects) => {
			const {state, dispatch, updateState} = coeffects;
			// Store the current section to re-select after refresh
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			// Store assessment details before clearing state
			// Use the stored currentAssessmentId which is set when opening the builder
			const assessmentId = state.currentAssessmentId;
			const assessmentTitle = state.currentAssessment?.title;
			if (!assessmentId) {
				console.error('No assessment ID found for refresh!');
				updateState({
					systemMessages: [
					...(state.systemMessages || []),
						
						{
							type: 'error',
							message: 'Unable to refresh: No assessment ID found',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}
			
			// Complete state reset following CLAUDE.md refresh pattern
			updateState({
				assessmentDetailsLoading: true,
				// Clear all change tracking arrays
				sectionChanges: {},
				relationshipChanges: {},
				// Reset UI state - edit mode on, relationships off, collapsed  
				builderMode: true,
				showRelationships: false,
				answerRelationships: {}, // Clear all expanded relationship data
				relationshipsLoading: {},
				// Clear any active relationship editing
				addingRelationship: null,
				selectedRelationshipType: null,
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedRelationshipQuestion: null,
				selectedSection: null,
				selectedSectionLabel: null,
				currentQuestions: null,
				questionsLoading: false,
				// Clear ALL change tracking
				sectionChanges: {},
				relationshipChanges: {},
				// Clear editing states
				editingSectionId: null,
				editingSectionName: null,
				editingTooltip: null,
				editingTooltipText: null,
				editingTooltipOriginalText: null,
				editingTooltipQuestionId: null,
				editingTooltipAnswerId: null,
				// Clear answer selection state
				selectedAnswers: {},
				visibleQuestions: [],
				// Clear relationships state
				answerRelationships: {},
				relationshipsLoading: {},
				// Store pending reselection
				pendingReselectionSection: currentSection,
				pendingReselectionSectionLabel: currentSectionLabel,
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'loading',
						message: 'Refreshing assessment data...',
						timestamp: new Date().toISOString()
					}
				]
			});
			
			// Fetch fresh assessment details with stored values
			dispatch('FETCH_ASSESSMENT_DETAILS', {
				assessmentId: assessmentId,
				assessmentTitle: assessmentTitle
			});
		},

		'FETCH_ASSESSMENT_DETAILS': (coeffects) => {
			const {action, state, dispatch} = coeffects;
			const {assessmentId, assessmentTitle} = action.payload;
			const requestBody = JSON.stringify({
				assessmentId: assessmentId
			});
			dispatch('MAKE_ASSESSMENT_DETAILS_REQUEST', {requestBody: requestBody});
		},

		'MAKE_ASSESSMENT_DETAILS_REQUEST': effects.MAKE_ASSESSMENT_DETAILS_REQUEST,

		'ASSESSMENT_DETAILS_FETCH_START': (coeffects) => {
			const {updateState} = coeffects;
			updateState({assessmentDetailsLoading: true});
		},

		'ASSESSMENT_DETAILS_SUCCESS': (coeffects) => {
			const {action, updateState, dispatch, state} = coeffects;
			// Check if this is a response for a "newer GT available" error
			if (state.pendingNewerGtError) {
				const versionName = action.payload?.version_name || 'Unknown Version';
				const gtId = state.pendingNewerGtError.gtId;

				// Update the error message with the version name
				const enhancedMessage = `There are already newer GTs available: ${versionName} (${gtId})`;

				updateState({
					pendingNewerGtError: null,
					assessmentDetailsLoading: false,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: enhancedMessage,
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Debug section sort_order values
			if (action.payload?.sections) {
				action.payload.sections.forEach(section => {
					if (section.subsections) {
						section.subsections.forEach(subsection => {
						});
					}
				});
			}

			// Check if we need to re-select a section after save
			const pendingReselection = state.pendingReselectionSection;
			const pendingReselectionLabel = state.pendingReselectionSectionLabel;

			console.log('ASSESSMENT_DETAILS_SUCCESS - select_all_enabled from backend:', action.payload?.select_all_enabled);

			updateState({
				currentAssessment: action.payload,
				assessmentDetailsLoading: false,
				// Store original data for cancel functionality
				originalAssessmentData: JSON.parse(JSON.stringify(action.payload)),
				// Clear pending reselection
				pendingReselectionSection: null,
				pendingReselectionSectionLabel: null,
				// CRITICAL: Clear change tracking after successful save/refresh
				sectionChanges: {},
				questionChanges: {},
				answerChanges: {},
				relationshipChanges: {},
				// IMPORTANT: Preserve system messages during assessment refresh
				systemMessages: state.systemMessages,
				modalSystemMessages: state.modalSystemMessages,
				// Reset relationship editing state after refresh - return to original state
				showRelationships: false,
				answerRelationships: {}, // Clear all expanded relationship data - closes panels
				relationshipsLoading: {},
				relationshipVisibility: {},
				selectedRelationshipQuestion: null,
				selectedRelationshipType: null,
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				relationshipTypeaheadLoading: false,
				currentGuidelineSearchAnswerId: null
			});
			
			// Re-select the section we were editing, or auto-select first section
			let sectionToSelect = null;
			let sectionLabelToSelect = null;

			if (pendingReselection && pendingReselectionLabel) {
				sectionToSelect = pendingReselection;
				sectionLabelToSelect = pendingReselectionLabel;
			} else {
				// Auto-select first section (by sort_order) for immediate editing
				const sortedSections = (action.payload?.sections || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
				const firstSection = sortedSections[0];
				const sortedSubsections = firstSection?.subsections?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
				const firstSubsection = sortedSubsections?.[0];

				if (firstSubsection) {
					sectionToSelect = firstSubsection.id;
					sectionLabelToSelect = firstSubsection.label;
				}
			}

			if (sectionToSelect && sectionLabelToSelect) {
				dispatch('SELECT_SECTION', {
					sectionId: sectionToSelect,
					sectionLabel: sectionLabelToSelect
				});
			}
		},

		'ASSESSMENT_DETAILS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('ASSESSMENT_DETAILS_ERROR - Full Response:', action.payload);

			// Check if this was a failed attempt to fetch newer GT version name
			if (state.pendingNewerGtError) {
				// Fallback to showing the original error without the version name
				const originalMessage = state.pendingNewerGtError.originalMessage;

				updateState({
					pendingNewerGtError: null,
					assessmentDetailsLoading: false,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: originalMessage,
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			const errorMessage = action.payload?.message ||
							   action.payload?.error ||
							   action.payload?.statusText ||
							   'Unknown error';

			const fullErrorMessage = 'Failed to fetch assessment details: ' + errorMessage;

			updateState({
				error: fullErrorMessage,
				assessmentDetailsLoading: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: fullErrorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CLOSE_ASSESSMENT_BUILDER': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {skipUnsavedCheck} = action.payload || {};

			// Check for unsaved changes (unless confirming)
			if (!skipUnsavedCheck) {
				const hasUnsavedChanges =
					(state.sectionChanges && Object.keys(state.sectionChanges).length > 0) ||
					(state.questionChanges && Object.keys(state.questionChanges).length > 0) ||
					(state.answerChanges && Object.keys(state.answerChanges).length > 0);

				if (hasUnsavedChanges) {
					// Show confirmation dialog
					dispatch('SHOW_CONFIRMATION_DIALOG', {
						message: 'You have unsaved changes that will be lost. Do you want to continue?',
						pendingAction: {
							type: 'CLOSE_ASSESSMENT_BUILDER',
							payload: {
								skipUnsavedCheck: true  // Skip check on retry
							}
						}
					});
					return;  // Block the action
				}
			}

			updateState({
				builderView: false,
				currentAssessment: null,
				assessmentDetailsLoading: false,
				selectedSection: null,
				selectedSectionLabel: null,
				currentQuestions: null,
				questionsLoading: false
			});
		},

		'SELECT_SECTION': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {sectionId, sectionLabel, skipUnsavedCheck} = action.payload;

			// Check for unsaved changes (unless we're confirming the action)
			if (!skipUnsavedCheck) {
				// Use consistent logic with hasAnyUnsavedChanges helper
				const hasUnsavedQuestions = state.currentQuestions?.questions?.some(q => q.isUnsaved === true) || false;
				const hasUnsavedAnswers = (state.answerChanges && Object.keys(state.answerChanges).length > 0) || false;
				const hasUnsavedSections = (state.sectionChanges && Object.keys(state.sectionChanges).length > 0) || false;

				const hasUnsavedChanges = hasUnsavedQuestions || hasUnsavedAnswers || hasUnsavedSections;

				if (hasUnsavedChanges) {
					// Show confirmation dialog
					dispatch('SHOW_CONFIRMATION_DIALOG', {
						message: 'You have unsaved changes that will be lost. Do you want to continue?',
						pendingAction: {
							type: 'SELECT_SECTION',
							payload: {
								sectionId: sectionId,
								sectionLabel: sectionLabel,
								skipUnsavedCheck: true  // Skip check on retry
							}
						}
					});
					return;  // Block the action
				}
			}

			// Update selected section and start loading questions
			updateState({
				selectedSection: sectionId,
				selectedSectionLabel: sectionLabel,
				questionsLoading: true,
				currentQuestions: null
			});

			// Fetch questions for the selected section
			dispatch('FETCH_SECTION_QUESTIONS', {
				sectionId: sectionId,
				sectionLabel: sectionLabel
			});
		},

		'FETCH_SECTION_QUESTIONS': (coeffects) => {
			const {action, state, dispatch} = coeffects;
			const {sectionId, sectionLabel} = action.payload;
			const requestBody = JSON.stringify({
				gtId: state.currentAssessmentId,
				sectionId: sectionId
			});
			dispatch('MAKE_SECTION_QUESTIONS_REQUEST', {requestBody: requestBody});
		},

		'MAKE_SECTION_QUESTIONS_REQUEST': effects.MAKE_SECTION_QUESTIONS_REQUEST,

		'SECTION_QUESTIONS_FETCH_START': (coeffects) => {
			const {updateState} = coeffects;
			updateState({questionsLoading: true});
		},

		'SECTION_QUESTIONS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			//
			//
			//
			//

			// Sort questions by sort_order
			const questions = action.payload?.questions || [];
			const sortedQuestions = questions.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

			// Sort answers within each question by sort_order
			const questionsWithSortedAnswers = sortedQuestions.map(question => ({
				...question,
				answers: question.answers ? question.answers.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : []
			}));

			// Debug: log the questions structure to understand triggered_questions format
			questionsWithSortedAnswers.forEach((question, qIndex) => {
				question.answers?.forEach((answer, aIndex) => {
					if (answer.triggered_questions && answer.triggered_questions.length > 0) {
					}
				});
			});

			// Initialize visible questions for preview mode (no relationships loaded yet)
			const initialVisibleQuestions = calculateVisibleQuestions({}, questionsWithSortedAnswers, {});

			const updateStateObject = {
				currentQuestions: {
					...action.payload,
					questions: questionsWithSortedAnswers
				},
				questionsLoading: false,
				visibleQuestions: initialVisibleQuestions,
				// Clear all changes after successful data refresh
				sectionChanges: {},
				relationshipChanges: {},
				// Clear answer typeahead UI state to prevent stuck loading
				// NOTE: Do NOT clear currentAnswerSearchContext here - it must persist for in-flight requests
				// Context is only cleared by HIDE/ERROR handlers per CLAUDE.md pattern
				answerTypeaheadLoading: false,
				answerTypeaheadVisible: false,
				answerTypeaheadResults: [],
				editingAnswerId: null,
				// Clear question operation loading states
				cancelingQuestions: {},
				savingQuestions: {} // Clear all saving spinners after refresh
			};

			// If this was after a question move, clear modal, switch to target section, and show success message
			if (state.questionMoveRefreshInProgress) {
				const moveContext = state.questionMoveRefreshInProgress;
				updateStateObject.movingQuestion = false;
				updateStateObject.questionMoveRefreshInProgress = false;
				updateStateObject.selectedSection = moveContext.targetSectionId;
				updateStateObject.selectedSectionLabel = moveContext.targetSectionLabel;
				updateStateObject.systemMessages = [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Question "${moveContext.question.label}" moved successfully from "${moveContext.sourceSectionLabel}" to "${moveContext.targetSectionLabel}"!`,
						timestamp: new Date().toISOString()
					}
				];
			}

			updateState(updateStateObject);
		},

		'SECTION_QUESTIONS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('SECTION_QUESTIONS_ERROR - Full Response:', action.payload);

			const errorMessage = action.payload?.message ||
							   action.payload?.error ||
							   action.payload?.statusText ||
							   'Unknown error';

			const fullErrorMessage = 'Failed to fetch section questions: ' + errorMessage;

			updateState({
				error: fullErrorMessage,
				questionsLoading: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: fullErrorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		// Duplicate check flow for question moves
		'FETCH_SECTION_QUESTIONS_FOR_DUPLICATE_CHECK': (coeffects) => {
			const {action, state, dispatch} = coeffects;
			const {sectionId, sectionLabel} = action.payload;
			const requestBody = JSON.stringify({
				gtId: state.currentAssessmentId,
				sectionId: sectionId
			});
			dispatch('MAKE_SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_REQUEST', {requestBody: requestBody});
		},

		'MAKE_SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_REQUEST': effects.MAKE_SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_REQUEST,

		'SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const pendingMove = state.pendingQuestionMoveForDuplicateCheck;

			if (!pendingMove) {
				console.warn('No pending move found in duplicate check success handler');
				return;
			}

			const {questionId, sourceSectionId, sourceSectionLabel, targetSectionId, targetSectionLabel, question} = pendingMove;

			// Check for duplicate in fetched questions
			const targetQuestions = action.payload?.questions || [];
			const questionLabelLower = question.label.toLowerCase().trim();
			const duplicateInTarget = targetQuestions.find(q =>
				q.label.toLowerCase().trim() === questionLabelLower
			);

			if (duplicateInTarget) {
				// Duplicate found - abort move
				updateState({
					pendingQuestionMoveForDuplicateCheck: null,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Question "${question.label}" already exists in "${targetSectionLabel}". Cannot move duplicate questions to the same section.`,
							timestamp: new Date().toISOString()
						}
					]
				});
				return; // Stop the move operation
			}

			// No duplicate - clear pending move and continue with typeahead lookup
			updateState({
				pendingQuestionMoveForDuplicateCheck: null,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `No duplicate found. Proceeding with move...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Continue with the move by performing typeahead lookup
			// Check if this is a library question
			const library_id = question.library_id ||
							   question.libraryQuestionId ||
							   (question.ids?.master_id_path ? question.ids.master_id_path[question.ids.master_id_path.length - 1] : null) ||
							   question.ids?.master_id ||
							   null;

			const isLibraryQuestion = question.isLibraryQuestion ||
									 !!question.library_id ||
									 !!(question.ids?.master_id_path && question.ids.master_id_path.length > 0) ||
									 false;

			if (!isLibraryQuestion || !library_id) {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Cannot move question: Only library questions can be moved between sections. This appears to be a custom question.`,
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Show loading spinner
			updateState({
				movingQuestion: true,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'loading',
						message: `Moving question "${question.label}" from "${sourceSectionLabel}" to "${targetSectionLabel}"...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Store move context for later steps
			updateState({
				pendingQuestionMovePreLookup: {
					questionId,
					sourceSectionId,
					sourceSectionLabel,
					targetSectionId,
					targetSectionLabel,
					question,
					library_id,
					isLibraryQuestion
				}
			});

			// Perform typeahead lookup to get exact library question
			const typeaheadRequestBody = JSON.stringify({
				contentType: 'question',
				searchText: question.label
			});

			dispatch('MAKE_GENERIC_TYPEAHEAD_REQUEST', {
				requestBody: typeaheadRequestBody,
				meta: {contentType: 'question_move', questionLabel: question.label}
			});
		},

		'SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Failed to fetch section questions for duplicate check:', action.payload);

			updateState({
				pendingQuestionMoveForDuplicateCheck: null,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to check for duplicates: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'TOGGLE_BUILDER_MODE': (coeffects) => {
			const {action, updateState} = coeffects;
			const {mode} = action.payload;
			updateState({
				builderMode: mode,
				// Reset answer selections when switching to preview mode
				selectedAnswers: mode ? {} : {},
				visibleQuestions: mode ? [] : []
			});
		},

		'SELECT_ANSWER': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId, answerId, questionType} = action.payload;
			let newSelectedAnswers = {...state.selectedAnswers};
			
			// Handle different question types
			if (questionType === 'Single Select') {
				// Single select: replace any existing selection
				newSelectedAnswers[questionId] = [answerId];
			} else if (questionType === 'Multiselect') {
				// Multiselect: add to existing selections or toggle off
				if (!newSelectedAnswers[questionId]) {
					newSelectedAnswers[questionId] = [];
				}
				const currentSelections = newSelectedAnswers[questionId];
				const answerIndex = currentSelections.indexOf(answerId);
				
				if (answerIndex > -1) {
					// Answer already selected, remove it
					newSelectedAnswers[questionId] = currentSelections.filter(id => id !== answerId);
				} else {
					// Answer not selected, add it
					newSelectedAnswers[questionId] = [...currentSelections, answerId];
				}
			}
			
			// Check if we need to load relationships for this answer to get triggered questions
			const answerWasSelected = (questionType === 'Single Select') || 
									  (questionType === 'Multiselect' && newSelectedAnswers[questionId].includes(answerId));
			if (answerWasSelected && !state.answerRelationships[answerId] && !state.relationshipsLoading[answerId]) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}
			
			// Calculate visible questions based on answer relationships
			const visibleQuestions = calculateVisibleQuestions(newSelectedAnswers, state.currentQuestions?.questions || [], state.answerRelationships);
			
			updateState({
				selectedAnswers: newSelectedAnswers,
				visibleQuestions: visibleQuestions
			});
		},

		'HANDLE_MUTUALLY_EXCLUSIVE': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, answerId} = action.payload;
			// Find the answer to check if it's mutually exclusive
			const question = state.currentQuestions?.questions?.find(q => q.ids.id === questionId);
			const answer = question?.answers?.find(a => a.ids.id === answerId);
			
			if (answer?.mutually_exclusive) {
				// Clear all other selections for this question
				let newSelectedAnswers = {...state.selectedAnswers};
				newSelectedAnswers[questionId] = [answerId];
				
				const visibleQuestions = calculateVisibleQuestions(newSelectedAnswers, state.currentQuestions?.questions || [], state.answerRelationships);
				
				updateState({
					selectedAnswers: newSelectedAnswers,
					visibleQuestions: visibleQuestions
				});
			}
		},

		'REORDER_QUESTIONS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {sourceIndex, targetIndex} = action.payload;
			if (!state.currentQuestions?.questions || sourceIndex === targetIndex) {
				return;
			}

			const questions = [...state.currentQuestions.questions];
			const [movedQuestion] = questions.splice(sourceIndex, 1);
			questions.splice(targetIndex, 0, movedQuestion);

			// Update sort_order for all questions
			const updatedQuestions = questions.map((question, index) => ({
				...question,
				sort_order: index + 1
			}));

			// Track all affected questions as changed for auto-save
			const updatedQuestionChanges = { ...state.questionChanges };

			updatedQuestions.forEach(question => {
				// Only track real questions (not temp ones) that have changed sort order
				if (!question.ids.id.startsWith('temp_')) {
					updatedQuestionChanges[question.ids.id] = {
						...updatedQuestionChanges[question.ids.id],
						action: updatedQuestionChanges[question.ids.id]?.action || 'update',
						questionId: question.ids.id,
						sort_order: question.sort_order,
						// Preserve other existing changes
						label: question.label,
						type: question.type,
						required: question.required || false,
						tooltip: question.tooltip || '',
						voice: question.voice || 'Patient'
					};
				}
			});

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				questionChanges: updatedQuestionChanges
			});

			// Auto-save the reordering changes immediately
			dispatch('SAVE_ALL_CHANGES');
		},

		'REORDER_ANSWERS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, sourceIndex, targetIndex} = action.payload;
			if (!state.currentQuestions?.questions || sourceIndex === targetIndex) {
				return;
			}

			const questions = [...state.currentQuestions.questions];
			const questionIndex = questions.findIndex(q => q.ids.id === questionId);

			if (questionIndex === -1 || !questions[questionIndex].answers) {
				return;
			}

			const answers = [...questions[questionIndex].answers];
			const [movedAnswer] = answers.splice(sourceIndex, 1);
			answers.splice(targetIndex, 0, movedAnswer);

			// Update sort_order for all answers
			const updatedAnswers = answers.map((answer, index) => ({
				...answer,
				sort_order: index + 1
			}));

			// Mark question as unsaved (this will show save/cancel buttons)
			questions[questionIndex] = {
				...questions[questionIndex],
				answers: updatedAnswers,
				isUnsaved: true
			};

			// Track answer reordering in questionChanges
			// Store the new sort orders for all affected answers
			const answerSortOrders = {};
			updatedAnswers.forEach(answer => {
				// Only track real answers (not temp ones)
				if (!answer.ids.id.startsWith('temp_')) {
					answerSortOrders[answer.ids.id] = answer.sort_order;
				}
			});

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: questions
				},
				// Track answer reorder changes for this question
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						...(state.questionChanges?.[questionId] || {}),
						action: state.questionChanges?.[questionId]?.action || 'update',
						questionId: questionId,
						answerSortOrders: answerSortOrders // Store all answer sort orders
					}
				}
			});
		},

		'ADD_QUESTION': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {sectionId} = action.payload;
			if (!state.currentQuestions?.questions) {
				return;
			}

			// Generate a temporary UUID for the new question
			const newQuestionId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

			// Calculate next sort_order to ensure new question appears last
			const maxSortOrder = Math.max(...state.currentQuestions.questions.map(q => q.sort_order || 0), 0);
			const nextSortOrder = maxSortOrder + 1;

			const newQuestion = {
				ids: { id: newQuestionId },
				label: '',
				type: 'Single Select',
				required: false,
				hidden: false,
				tooltip: '',
				voice: 'CaseManager', // Set default voice for new questions
				sort_order: nextSortOrder,
				answers: [
					{
						ids: { id: 'temp_answer_' + Date.now() + '_1' },
						label: '',
						sort_order: 1,
						secondary_input_type: null,
						mutually_exclusive: false,
						tooltip: '',
						triggered_questions: []
					}
				],
				// Mark as unsaved so save/cancel buttons appear immediately
				isUnsaved: true
			};

			const updatedQuestions = [...state.currentQuestions.questions, newQuestion];

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				// CRITICAL: Track new question with action: 'add' immediately
				questionChanges: {
					...state.questionChanges,
					[newQuestionId]: {
						action: 'add',
						label: '',
						type: 'Single Select',
						tooltip: '',
						required: false,
						sort_order: nextSortOrder,
						sectionId: sectionId,
						section_id: sectionId,
						guideline_template_id: state.currentAssessmentId,
						answers: [
							{
								label: '',
								sort_order: 1,
								tooltip: '',
								secondary_input_type: null,
								mutually_exclusive: false
							}
						]
					}
				},
				// Clear answer typeahead UI state when adding new question
				// NOTE: Do NOT clear currentAnswerSearchContext here - it must persist for in-flight requests
				// Context is only cleared by HIDE/ERROR handlers per CLAUDE.md pattern
				answerTypeaheadLoading: false,
				answerTypeaheadVisible: false,
				answerTypeaheadResults: [],
				editingAnswerId: null
			});
		},

		'UPDATE_QUESTION_TYPE': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, newType} = action.payload;
			if (!state.currentQuestions?.questions) {
				return;
			}

			const updatedQuestions = state.currentQuestions.questions.map(question => {
				if (question.ids.id === questionId) {
					const updatedQuestion = {...question, type: newType, isUnsaved: true};

					// Handle type-specific changes
					if (newType === 'Text' || newType === 'Date' || newType === 'Numeric') {
						// Non-select types don't need answers
						updatedQuestion.answers = [];
					} else if ((newType === 'Single Select' || newType === 'Multiselect') && question.answers.length === 0) {
						// Select types need at least one answer
						updatedQuestion.answers = [
							{
								ids: { id: 'temp_answer_' + Date.now() + '_1' },
								label: '',
								sort_order: 1,
								secondary_input_type: null,
								mutually_exclusive: false,
								tooltip: '',
								triggered_questions: []
							}
						];
					}

					return updatedQuestion;
				}
				return question;
			});

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				// Track question change for save - preserve 'add' and 'library_replace' actions
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						...(state.questionChanges?.[questionId] || {}),
						action: state.questionChanges?.[questionId]?.action === 'add' ? 'add' :
						        state.questionChanges?.[questionId]?.action === 'library_replace' ? 'library_replace' : 'update',
						questionId: questionId,
						type: newType
					}
				}
			});
		},

		'UPDATE_QUESTION_LABEL': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, newLabel} = action.payload;
			if (!state.currentQuestions?.questions) {
				return;
			}

			const updatedQuestions = state.currentQuestions.questions.map(question => {
				if (question.ids.id === questionId) {
					return {...question, label: newLabel, isUnsaved: true};
				}
				return question;
			});

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				// Track question change for save - preserve 'add' action if it exists
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						...(state.questionChanges?.[questionId] || {}),
						action: state.questionChanges?.[questionId]?.action === 'add' ? 'add' : 'update',
						questionId: questionId,
						label: newLabel
					}
				}
			});
		},

		'UPDATE_QUESTION_VOICE': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, newVoice} = action.payload;
			if (!state.currentQuestions?.questions) {
				return;
			}

			const updatedQuestions = state.currentQuestions.questions.map(question => {
				if (question.ids.id === questionId) {
					return {...question, voice: newVoice, isUnsaved: true};
				}
				return question;
			});

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				// Track question change for save - preserve 'add' action if it exists
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						...(state.questionChanges?.[questionId] || {}),
						action: state.questionChanges?.[questionId]?.action === 'add' ? 'add' : 'update',
						questionId: questionId,
						voice: newVoice
					}
				}
			});
		},

		'UPDATE_QUESTION_REQUIRED': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, required} = action.payload;
			if (!state.currentQuestions?.questions) {
				return;
			}

			const updatedQuestions = state.currentQuestions.questions.map(question => {
				if (question.ids.id === questionId) {
					return {...question, required: required, isUnsaved: true};
				}
				return question;
			});

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				// Track question change for save - preserve 'add' action if it exists
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						...(state.questionChanges?.[questionId] || {}),
						action: state.questionChanges?.[questionId]?.action === 'add' ? 'add' : 'update',
						questionId: questionId,
						required: required
					}
				}
			});
		},

		'ADD_ANSWER': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId} = action.payload;
			if (!state.currentQuestions?.questions) {
				return;
			}

			// Generate the new answer ID outside the map function
			const newAnswerId = 'temp_answer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

			const updatedQuestions = state.currentQuestions.questions.map(question => {
				if (question.ids.id === questionId) {
					const nextSortOrder = question.answers ? question.answers.length + 1 : 1;

					const newAnswer = {
						ids: { id: newAnswerId },
						label: '',
						sort_order: nextSortOrder,
						secondary_input_type: null,
						mutually_exclusive: false,
						tooltip: '',
						triggered_questions: []
					};

					return {
						...question,
						answers: [...(question.answers || []), newAnswer],
						isUnsaved: true // Mark question as needing save
					};
				}
				return question;
			});

			// Track this new answer in answerChanges for save logic (similar to library answers)
			const answerChanges = {
				...state.answerChanges,
				[newAnswerId]: {
					action: 'add',
					questionId: questionId,
					label: '',
					sort_order: updatedQuestions.find(q => q.ids.id === questionId)?.answers?.length || 1,
					tooltip: '',
					alternative_wording: '',
					secondary_input_type: null,
					mutually_exclusive: false,
					custom_attributes: {},
					required: false
				}
			};

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				answerChanges: answerChanges // Track the new answer for save
			});
		},

		'DELETE_ANSWER': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, questionId} = action.payload;
			if (!state.currentQuestions?.questions) {
				return;
			}

			// Check if this is a temp answer that has never been saved
			// An answer is only truly unsaved if it has temp_ ID AND is tracked in answerChanges with action 'add'
			const isUnsavedTempAnswer = answerId.startsWith('temp_') &&
				state.answerChanges?.[answerId]?.action === 'add';

			if (isUnsavedTempAnswer) {
				// Just remove from UI, no API call needed
				const updatedQuestions = state.currentQuestions.questions.map(question => {
					if (question.ids.id === questionId) {
						return {
							...question,
							answers: question.answers?.filter(answer => answer.ids.id !== answerId) || [],
							isUnsaved: true // Mark question as unsaved to show save/cancel buttons
						};
					}
					return question;
				});

				// Also remove from answerChanges if it was tracked
				const updatedAnswerChanges = {...state.answerChanges};
				delete updatedAnswerChanges[answerId];

				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					},
					answerChanges: updatedAnswerChanges
				});
			} else {
				// Real answer - mark for deletion, don't remove from UI yet
				const updatedQuestions = state.currentQuestions.questions.map(question => {
					if (question.ids.id === questionId) {
						return {
							...question,
							answers: question.answers?.map(answer => {
								if (answer.ids.id === answerId) {
									return {
										...answer,
										isDeleted: true // Mark answer as deleted
									};
								}
								return answer;
							}) || [],
							isUnsaved: true // Mark question as unsaved to show save/cancel buttons
						};
					}
					return question;
				});

				// Track the deletion in answerChanges
				const updatedAnswerChanges = {
					...state.answerChanges,
					[answerId]: {
						action: 'delete',
						questionId: questionId
					}
				};

				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					},
					answerChanges: updatedAnswerChanges
				});
			}
		},

		'DELETE_QUESTION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId} = action.payload;
			if (!state.currentQuestions?.questions) {
				return;
			}

			// Find the question to get its label
			const questionToDelete = state.currentQuestions.questions.find(q => q.ids.id === questionId);
			if (!questionToDelete) {
				console.error('Question not found for deletion:', questionId);
				return;
			}

			const questionLabel = questionToDelete.label || 'Untitled Question';

			// Show confirmation dialog
			dispatch('SHOW_CONFIRMATION_DIALOG', {
				message: `Are you sure you want to delete question "${questionLabel}"?`,
				pendingAction: {
					type: 'CONFIRM_DELETE_QUESTION',
					payload: { questionId }
				}
			});
		},

		'CONFIRM_DELETE_QUESTION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId} = action.payload;

			// Remove question from local state immediately (optimistic update)
			const updatedQuestions = state.currentQuestions.questions.filter(question =>
				question.ids.id !== questionId
			);

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				}
			});

			// Auto-delete from backend immediately (only if not temp ID)
			if (!questionId.startsWith('temp_')) {
				dispatch('DELETE_QUESTION_API', { questionId });
			} else {
				// Show toast for temp questions
				dispatch('SHOW_TOAST', {
					type: 'success',
					message: 'Question removed successfully!'
				});
			}
		},

		'SAVE_QUESTION_BUNDLE': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId, questionLabel} = action.payload;

			// Show system message that we're saving
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'loading',
						message: `Saving question bundle "${questionLabel}" to library...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Call the existing HTTP effect with questionId as contentId
			const requestBody = JSON.stringify({
				contentId: questionId
			});

			dispatch('MAKE_CREATE_QUESTION_BUNDLE_REQUEST', {
				requestBody: requestBody,
				meta: {
					questionId: questionId,
					questionLabel: questionLabel
				}
			});
		},

		'SAVE_PROBLEM_BUNDLE': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {problemId, problemLabel} = action.payload;

			// Store problemLabel in state for success handler
			updateState({
				currentProblemBundleLabel: problemLabel,
				modalSystemMessages: [
					...(state.modalSystemMessages || []),
					{
						type: 'loading',
						message: `Saving problem bundle "${problemLabel}" to library...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Call the HTTP effect with problemId as contentId
			const requestBody = JSON.stringify({
				contentId: problemId
			});

			dispatch('MAKE_CREATE_PROBLEM_BUNDLE_REQUEST', {
				requestBody: requestBody,
				meta: {
					problemId: problemId,
					problemLabel: problemLabel
				}
			});
		},

		'SAVE_QUESTION_IMMEDIATELY': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId} = action.payload;

			// Store questionId and set saving state for spinner
			updateState({
				lastSavedQuestionId: questionId,
				savingQuestions: {
					...state.savingQuestions,
					[questionId]: true
				}
			});
			const question = state.currentQuestions?.questions?.find(q => q.ids.id === questionId);

			if (!question) {
				console.error('Question not found for saving:', questionId);
				// Clear saving state on error
				const updatedSavingQuestions = {...state.savingQuestions};
				delete updatedSavingQuestions[questionId];
				updateState({ savingQuestions: updatedSavingQuestions });
				return;
			}

			// Validate question label is not blank
			if (!question.label || question.label.trim() === '') {
				// Clear saving state on validation error
				const updatedSavingQuestions = {...state.savingQuestions};
				delete updatedSavingQuestions[questionId];
				updateState({
					savingQuestions: updatedSavingQuestions,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Question text cannot be blank. Please enter a question.',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Check for duplicate answers within this question
			if (question.answers && question.answers.length > 1) {
				const answerLabels = [];
				const duplicates = [];

				question.answers.forEach(answer => {
					const trimmedLabel = answer.label.toLowerCase().trim();
					if (answerLabels.includes(trimmedLabel)) {
						// Found a duplicate
						if (!duplicates.includes(answer.label)) {
							duplicates.push(answer.label);
						}
					} else {
						answerLabels.push(trimmedLabel);
					}
				});

				if (duplicates.length > 0) {
					// Clear saving state on validation error
					const updatedSavingQuestions = {...state.savingQuestions};
					delete updatedSavingQuestions[questionId];
					updateState({
						savingQuestions: updatedSavingQuestions,
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'error',
								message: `Duplicate answer(s) found: "${duplicates.join('", "')}". Each answer must be unique within the question.`,
								timestamp: new Date().toISOString()
							}
						]
					});
					return;
				}
			}

			// Check if there are answer changes for this question - if so, use SAVE_ALL_CHANGES
			const questionAnswerChanges = Object.keys(state.answerChanges || {}).filter(answerId => {
				const answerData = state.answerChanges[answerId];
				// Check if this answer belongs to the question being saved
				let belongsToQuestion = false;

				// For existing answers (add/library_replace), check if answer exists in question
				if (question.answers) {
					belongsToQuestion = question.answers.some(ans => ans.ids.id === answerId);
				}

				// For deleted answers, check the question_id in answerChanges since answer is removed from UI
				if (!belongsToQuestion && answerData.question_id === questionId) {
					belongsToQuestion = true;
				}

				return belongsToQuestion;
			});

			if (questionAnswerChanges.length > 0) {
				dispatch('SAVE_ALL_CHANGES');
				return;
			}

			// Check if this is a temp question (add) or real question (update)
			if (questionId.startsWith('temp_')) {
				// Check for duplicate question before saving
				const existingQuestions = [];
				if (state.currentQuestions?.questions) {
					state.currentQuestions.questions.forEach(existingQuestion => {
						// Don't compare with itself
						if (existingQuestion.ids.id !== questionId) {
							// Only check against questions that are NOT temp questions
							// (i.e., questions that already existed in the section before)
							if (!existingQuestion.ids.id.startsWith('temp_')) {
								existingQuestions.push(existingQuestion.label.toLowerCase().trim());
							}
						}
					});
				}

				const currentQuestionLabel = question.label.toLowerCase().trim();
				if (existingQuestions.includes(currentQuestionLabel)) {
					updateState({
						systemMessages: [
					...(state.systemMessages || []),

							{
								type: 'error',
								message: `Question "${question.label}" already exists in this section. Please use a different name.`,
								timestamp: new Date().toISOString()
							}
						]
					});
					return; // Stop the save process
				}

				// PRE-SAVE LIBRARY DETECTION: Check if this matches a library question for ALL types
				if (!question.isLibraryQuestion) {
					// Store context for library search and trigger pre-save check
					updateState({
						preSaveQuestionContext: {
							questionId: questionId,
							questionData: question,
							sectionId: state.selectedSection,
							isPreSaveCheck: true
						},
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'info',
								message: `Checking if "${question.label}" matches a library question...`,
								timestamp: new Date().toISOString()
							}
						]
					});

					// Search for exact library matches using generic typeahead
					dispatch('GENERIC_TYPEAHEAD_SEARCH', {
						searchText: question.label,
						type: 'question',
						isPreSaveCheck: true // Flag to identify this as pre-save library check
					});
					return; // Stop normal save process, let the search result handler continue
				}
				// New question - use new 2-step process
				if (question.type === 'Text' || question.type === 'Date' || question.type === 'Numeric') {
					// Step 1: Add question to section (no answers needed)
					// Get the most current voice value from questionChanges if available
					const currentVoice = state.questionChanges?.[questionId]?.voice || question.voice || 'CaseManager';

					const questionData = {
						label: question.label,
						type: question.type,
						required: question.required,
						tooltip: question.tooltip || '',
						voice: currentVoice,
						sort_order: question.sort_order,
						alternative_wording: '',
						custom_attributes: {},
						available: false,
						has_quality_measures: false
					};

					// Add library_id for library questions
					if (question.isLibraryQuestion && (question.libraryQuestionId || question.library_id)) {
						questionData.library_id = question.libraryQuestionId || question.library_id;
					}

					dispatch('ADD_QUESTION_TO_SECTION_API', {
						questionData: questionData,
						sectionId: state.selectedSection
					});
				} else if (question.type === 'Single Select' || question.type === 'Multiselect') {
					// Check if this is a library question
					// Use 2-step process for both library and regular questions
					if (question.isLibraryQuestion) {
					}

					// DEBUG: Log what we're checking for voice
					console.log('SAVE_QUESTION_IMMEDIATELY - questionId:', questionId);
					console.log('SAVE_QUESTION_IMMEDIATELY - question.voice:', question.voice);
					console.log('SAVE_QUESTION_IMMEDIATELY - questionChanges voice:', state.questionChanges?.[questionId]?.voice);
					console.log('SAVE_QUESTION_IMMEDIATELY - Full questionChanges:', state.questionChanges?.[questionId]);

					// Get the most current voice value from questionChanges if available
					const currentVoice = state.questionChanges?.[questionId]?.voice || question.voice || 'CaseManager';

					console.log('SAVE_QUESTION_IMMEDIATELY - Final currentVoice:', currentVoice);

					const questionData = {
						label: question.label,
						type: question.type,
						required: question.required,
						tooltip: question.tooltip || '',
						voice: currentVoice,
						sort_order: question.sort_order,
						alternative_wording: '',
						custom_attributes: {},
						available: false,
						has_quality_measures: false
					};

					// Add library_id for library questions
					if (question.isLibraryQuestion && (question.libraryQuestionId || question.library_id)) {
						questionData.library_id = question.libraryQuestionId || question.library_id;
					}

					dispatch('ADD_QUESTION_TO_SECTION_API', {
						questionData: questionData,
						sectionId: state.selectedSection,
						// Store answers for step 2 (both library and regular questions)
						pendingAnswers: question.answers || []
					});
				} else {
					// Fallback for any other question types
					dispatch('ADD_QUESTION_API', {
						questionData: {
							sectionId: state.selectedSection,
							label: question.label,
							type: question.type,
							required: question.required,
							tooltip: question.tooltip || '',
							voice: question.voice || 'CaseManager',
							sort_order: question.sort_order,
							answers: question.answers || []
						}
					});
				}
			} else {
				// Existing question - call UPDATE API
				// CRITICAL: Clear change tracking using EXACT pattern from CANCEL_QUESTION_CHANGES
				const updatedQuestionChanges = {...state.questionChanges};
				const updatedAnswerChanges = {...state.answerChanges};

				// Check if there are answer reordering changes for this question
				const questionChange = state.questionChanges?.[questionId];
				const hasAnswerReordering = questionChange?.answerSortOrders;

				// If we have answer reordering, send UPDATE_ANSWER_API calls for each answer
				if (hasAnswerReordering) {
					const answerSortOrders = questionChange.answerSortOrders;
					Object.keys(answerSortOrders).forEach(answerId => {
						const answer = question.answers?.find(a => a.ids.id === answerId);
						if (answer) {
							dispatch('UPDATE_ANSWER_API', {
								answerData: {
									answerId: answerId,
									sort_order: answerSortOrders[answerId],
									// Include other required fields
									label: answer.label,
									tooltip: answer.tooltip || '',
									alternative_wording: answer.alternative_wording || 'string',
									required: answer.required || false,
									custom_attributes: answer.custom_attributes || {},
									secondary_input_type: answer.secondary_input_type,
									mutually_exclusive: answer.mutually_exclusive || false
								},
								skipReload: true // Don't trigger reload for batch answer reordering
							});
						}
					});
				}

				// Remove changes related to this question
				delete updatedQuestionChanges[questionId];

				// Remove answer changes related to this question (same as CANCEL)
				Object.keys(updatedAnswerChanges).forEach(answerId => {
					const answerChange = updatedAnswerChanges[answerId];
					// Check if this answer change belongs to the question being saved
					const belongsToQuestion = question.answers?.some(a => a.ids.id === answerId);

					if (belongsToQuestion || answerChange.question_id === questionId) {
						delete updatedAnswerChanges[answerId];
					}
				});

				// Clear isUnsaved flag on the question object itself (buttons check question.isUnsaved)
				const updatedQuestions = state.currentQuestions.questions.map(q =>
					q.ids.id === questionId ? {...q, isUnsaved: false} : q
				);

				updateState({
					questionChanges: updatedQuestionChanges,
					answerChanges: updatedAnswerChanges,
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					}
				});

				// Get the most current voice value - check questionChanges first, then question object
				const currentVoice = state.questionChanges?.[questionId]?.voice || question.voice || 'CaseManager';

				dispatch('UPDATE_QUESTION_API', {
					questionData: {
						questionId: questionId,
						label: question.label,
						type: question.type,
						required: question.required,
						tooltip: question.tooltip || '',
						alternative_wording: question.alternative_wording || '',
						custom_attributes: question.custom_attributes || {},
						voice: currentVoice,
						sort_order: question.sort_order
					}
				});
			}
		},

		'LOAD_ANSWER_RELATIONSHIPS': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {answerId} = action.payload;
			// Set loading state for this answer
			updateState({
				relationshipsLoading: {
					...state.relationshipsLoading,
					[answerId]: true
				}
			});
			
			// Build request body for simplified API call - NO data wrapper
			const requestBody = JSON.stringify({
				answerId: answerId
			});
			dispatch('MAKE_ANSWER_RELATIONSHIPS_REQUEST', {requestBody: requestBody});
		},

		'MAKE_ANSWER_RELATIONSHIPS_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/answer-relationships', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ANSWER_RELATIONSHIPS_SUCCESS',
			errorActionType: 'ANSWER_RELATIONSHIPS_ERROR'
		}),

		'ANSWER_RELATIONSHIPS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			// The answerId should be in the response, let's use that
			const answerId = action.payload?.id;
			
			if (!answerId) {
				console.error('No answer ID found in relationships response');
				return;
			}
			
			// Update the relationships for this specific answer
			const updatedRelationships = {
				...state.answerRelationships,
				[answerId]: action.payload
			};
			
			const updatedLoading = {
				...state.relationshipsLoading,
				[answerId]: false
			};
			
			// If we're in preview mode, recalculate visible questions with the new relationships data
			const visibleQuestions = !state.builderMode ? 
				calculateVisibleQuestions(state.selectedAnswers, state.currentQuestions?.questions || [], updatedRelationships) :
				state.visibleQuestions;
			updateState({
				answerRelationships: updatedRelationships,
				relationshipsLoading: updatedLoading,
				visibleQuestions: visibleQuestions,
				// Clear relationship changes after successful refresh - relationships now loaded from server
				relationshipChanges: {}
			});
		},

		'ANSWER_RELATIONSHIPS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('ANSWER_RELATIONSHIPS_ERROR - Full Response:', action.payload);

			const fullErrorMessage = 'Failed to fetch answer relationships: ' + (action.payload?.error || 'Unknown error');

			// We'll need to track which answer this was for in loading state
			// For now, clear all loading states on error
			updateState({
				relationshipsLoading: {},
				error: fullErrorMessage,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: fullErrorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'MAKE_ADD_BRANCH_QUESTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-branch-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_BRANCH_QUESTION_SUCCESS',
			errorActionType: 'ADD_BRANCH_QUESTION_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_GUIDELINE_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-guideline-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_GUIDELINE_RELATIONSHIP_SUCCESS',
			errorActionType: 'ADD_GUIDELINE_RELATIONSHIP_ERROR',
			metaParam: 'meta'
		}),

		'ADD_GUIDELINE_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Get the answer ID from the original request body since meta doesn't persist through HTTP effect
			let answerId = null;
			try {
				// The answerId should be in the original request that triggered this success
				// Look for it in the current action or extract from stored state
				if (action.meta && action.meta.answerId) {
					answerId = action.meta.answerId;
				} else if (state.relationshipPanelOpen && state.relationshipModalAnswerId) {
					// Fallback: Use the currently opened relationship modal answer ID
					answerId = state.relationshipModalAnswerId;
				} else {
					// Last resort: look for the first answer in relationships (may be wrong!)
					const openPanels = Object.keys(state.answerRelationships || {});
					if (openPanels.length > 0) {
						answerId = openPanels[0];
					}
				}
			} catch (e) {
				console.error('Error extracting answerId:', e);
			}

			// Show success message - don't clear relationshipChanges until refresh completes
			const successMessage = {
				type: 'success',
				message: `Guideline relationship saved successfully! Auto-refreshing now...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), successMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages,
				savingGuidelineRelationship: false
			});

			// Immediate auto-refresh since backend has already committed
			if (answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}
		},

		'ADD_GUIDELINE_RELATIONSHIP_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('=== ADD_GUIDELINE_RELATIONSHIP_ERROR ===');
			console.error('Error adding guideline relationship:', action.payload);

			const errorMessage = action.payload?.error ||
							   action.payload?.message ||
							   'Unknown error occurred while adding guideline relationship';

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to add guideline relationship: ${errorMessage}`,
						timestamp: new Date().toISOString()
					}
				],
				savingGuidelineRelationship: false
			});
		},

		'ADD_BRANCH_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;


			// Check if backend returned an error in the payload (returns 200 but with error detail)
			// Errors contain messages like "answer do not belong", "failed", etc.
			// Success messages contain "added", "saved", "created", etc.
			if (action.payload && action.payload.detail) {
				const detail = action.payload.detail.toLowerCase();
				const isError = detail.includes('do not belong') ||
				                detail.includes('failed') ||
				                detail.includes('error') ||
				                detail.includes('not found') ||
				                detail.includes('invalid');

				if (isError) {
					console.error('Backend returned error:', action.payload.detail);
					const errorMessage = {
						type: 'error',
						message: `Failed to add triggered question: ${action.payload.detail}`,
						timestamp: new Date().toISOString()
					};

					updateState({
						systemMessages: [
							...(state.systemMessages || []),
							errorMessage
						],
						modalSystemMessages: state.relationshipPanelOpen ? [
							...(state.modalSystemMessages || []),
							errorMessage
						] : state.modalSystemMessages,
						savingQuestionRelationship: false
					});
					return; // Stop here, don't refresh
				}
				// If not an error, it's a success detail message - continue to normal success flow
			}

			// Get the answer ID using the same fallback pattern as guidelines
			let answerId = null;
			try {
				// The answerId should be in the original request that triggered this success
				if (action.meta && action.meta.answerId) {
					answerId = action.meta.answerId;
				} else if (state.relationshipPanelOpen && state.relationshipModalAnswerId) {
					// Fallback: Use the currently opened relationship modal answer ID
					answerId = state.relationshipModalAnswerId;
				} else {
					// Last resort: look for the first answer in relationships (may be wrong!)
					const openPanels = Object.keys(state.answerRelationships || {});
					if (openPanels.length > 0) {
						answerId = openPanels[0];
					}
				}
			} catch (e) {
				console.error('Error extracting answerId:', e);
			}


			// Clear relationship changes and show success message
			const successMessage = {
				type: 'success',
				message: `Question relationship saved successfully! Auto-refreshing now...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				relationshipChanges: {},
				systemMessages: [
					...(state.systemMessages || []),
					successMessage
				],
				// ALSO add to modal system messages if relationship panel is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages,
				savingQuestionRelationship: false
			});

			// Immediate auto-refresh since backend has already committed (same as guidelines)
			if (answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			} else {
				console.error('No answerId found - cannot refresh relationships!');
			}
		},

		'ADD_BRANCH_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;


			const errorMessage = {
				type: 'error',
				message: `Failed to add triggered question: ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					errorMessage
				],
				// Also add to modal messages if relationship panel is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages,
				savingQuestionRelationship: false
			});
		},
		'DELETE_BRANCH_QUESTION': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {answerId, questionId, questionLabel} = action.payload;

			// Set loading state and store deletion context for success handler (meta params don't work reliably)
			updateState({
				savingQuestionRelationship: true,
				lastDeletedQuestionContext: {
					answerId: answerId,
					questionId: questionId,
					questionLabel: questionLabel
				}
			});

			const requestBody = JSON.stringify({
				answerId: answerId,
				questionId: questionId
			});

			dispatch('MAKE_DELETE_BRANCH_QUESTION_REQUEST', {
				requestBody: requestBody,
				meta: {
					answerId: answerId,
					questionId: questionId,
					questionLabel: questionLabel
				}
			});
		},
		'MAKE_DELETE_BRANCH_QUESTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-branch-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_BRANCH_QUESTION_SUCCESS',
			errorActionType: 'DELETE_BRANCH_QUESTION_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_DELETE_GUIDELINE_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-guideline-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_GUIDELINE_RELATIONSHIP_SUCCESS',
			errorActionType: 'DELETE_GUIDELINE_RELATIONSHIP_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_BARRIER_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-barrier-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_BARRIER_RELATIONSHIP_SUCCESS',
			errorActionType: 'ADD_BARRIER_RELATIONSHIP_ERROR'
		}),

		'MAKE_DELETE_BARRIER_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-barrier-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_BARRIER_RELATIONSHIP_SUCCESS',
			errorActionType: 'DELETE_BARRIER_RELATIONSHIP_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_PROBLEM_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-problem-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_PROBLEM_RELATIONSHIP_SUCCESS',
			errorActionType: 'ADD_PROBLEM_RELATIONSHIP_ERROR'
		}),

		'MAKE_SAVE_PROBLEM_EDITS_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/save-problem-edits', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'SAVE_PROBLEM_EDITS_SUCCESS',
			errorActionType: 'SAVE_PROBLEM_EDITS_ERROR'
		}),

		'MAKE_GET_PROBLEM_DETAILS_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-problem-details', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GET_PROBLEM_DETAILS_SUCCESS',
			errorActionType: 'GET_PROBLEM_DETAILS_ERROR'
		}),

		'MAKE_GET_GOAL_DETAILS_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-goal-details', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GET_GOAL_DETAILS_SUCCESS',
			errorActionType: 'GET_GOAL_DETAILS_ERROR'
		}),

		'MAKE_UPDATE_GOAL_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-goal', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'UPDATE_GOAL_SUCCESS',
			errorActionType: 'UPDATE_GOAL_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_GET_INTERVENTION_DETAILS_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-intervention-details', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GET_INTERVENTION_DETAILS_SUCCESS',
			errorActionType: 'GET_INTERVENTION_DETAILS_ERROR'
		}),

		'MAKE_UPDATE_INTERVENTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-intervention', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'UPDATE_INTERVENTION_SUCCESS',
			errorActionType: 'UPDATE_INTERVENTION_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_DELETE_PROBLEM_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-problem-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_PROBLEM_RELATIONSHIP_SUCCESS',
			errorActionType: 'DELETE_PROBLEM_RELATIONSHIP_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_DELETE_GOAL_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-goal', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_GOAL_SUCCESS',
			errorActionType: 'DELETE_GOAL_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_DELETE_INTERVENTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-intervention', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_INTERVENTION_SUCCESS',
			errorActionType: 'DELETE_INTERVENTION_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_LOAD_PROBLEM_GOALS_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-problem-goals', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'LOAD_PROBLEM_GOALS_SUCCESS',
			errorActionType: 'LOAD_PROBLEM_GOALS_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_GOAL_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-goal', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_GOAL_SUCCESS',
			errorActionType: 'ADD_GOAL_ERROR',
			metaParam: 'meta'
		}),

		// Intervention API endpoints (following goals pattern)
		'MAKE_LOAD_GOAL_INTERVENTIONS_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-goal-interventions', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'LOAD_GOAL_INTERVENTIONS_SUCCESS',
			errorActionType: 'LOAD_GOAL_INTERVENTIONS_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_INTERVENTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-intervention', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_INTERVENTION_SUCCESS',
			errorActionType: 'ADD_INTERVENTION_ERROR',
			metaParam: 'meta'
		}),
		'DELETE_BRANCH_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Get context from stored state (meta params don't work reliably in ServiceNow)
			const context = state.lastDeletedQuestionContext || {};
			const {answerId, questionId, questionLabel} = context;


			// Clear the stored context
			updateState({
				lastDeletedQuestionContext: null
			});

			// Show success message but don't clear excessive state - we're only refreshing relationships
			const newSystemMessage = {
				type: 'success',
				message: `Successfully deleted triggered question "${questionLabel}" from answer relationship! Refreshing data...`,
				timestamp: new Date().toISOString()
			};


			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					newSystemMessage
				],
				// ALSO add to modal system messages if relationship panel is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					newSystemMessage
				] : state.modalSystemMessages,
				savingQuestionRelationship: false
			});
			
			// Only refresh the specific answer relationships, not the entire assessment
			if (answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			} else {
				console.warn('No answerId available for relationship refresh');
			}
		},
		'DELETE_BRANCH_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('DELETE_BRANCH_QUESTION_ERROR:', action.payload);

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to delete triggered question: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				],
				savingQuestionRelationship: false
			});
		},

		'DELETE_GUIDELINE_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			if (action.meta) {
			}

			// Get original data from response payload (enhanced by backend API)
			const originalRequest = action.payload?.originalRequest || {};
			const {answerId, guidelineId, guidelineName} = originalRequest;
			// Show success message
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Successfully deleted guideline relationship "${guidelineName}"! Refreshing data...`,
						timestamp: new Date().toISOString()
					}
				],
				savingGuidelineRelationship: false
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipPanelOpen && state.relationshipModalAnswerId === answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}

			// Also refresh section questions to update badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'DELETE_GUIDELINE_RELATIONSHIP_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('DELETE_GUIDELINE_RELATIONSHIP_ERROR:', action.payload);

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to delete guideline relationship: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				],
				savingGuidelineRelationship: false
			});
		},

		'ADD_BARRIER_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			// ALWAYS surface backend detail message if present (including duplicates, warnings, etc)
			let messageType = 'success';
			let messageText = 'Barrier added successfully! Refreshing data...';

			if (action.payload?.detail) {
				messageText = action.payload.detail;
				const lowerDetail = action.payload.detail.toLowerCase();
				// Classify message type based on content
				if (lowerDetail.includes('duplicate') || lowerDetail.includes('already')) {
					messageType = 'warning'; // Duplicate is informational, not error
				} else if (lowerDetail.includes('error') || lowerDetail.includes('failed') || lowerDetail.includes('required')) {
					messageType = 'error';
				}
			} else {
				// Get original data from response payload for custom message
				const originalRequest = action.payload?.originalRequest || {};
				const {barrierName} = originalRequest;
				if (barrierName) {
					messageText = `Successfully added barrier "${barrierName}"! Refreshing data...`;
				}
			}

			const message = {
				type: messageType,
				message: messageText,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), message],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					message
				] : state.modalSystemMessages,
				// Clear typeahead state
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedBarrierData: null,
				// Clear loading state
				savingBarrierRelationship: false
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			const originalRequest = action.payload?.originalRequest || {};
			const {answerId} = originalRequest;
			if (answerId && state.relationshipPanelOpen && state.relationshipModalAnswerId === answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}

			// Also refresh section questions to update badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'ADD_BARRIER_RELATIONSHIP_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('ADD_BARRIER_RELATIONSHIP_ERROR:', action.payload);

			const errorMessage = {
				type: 'error',
				message: `Failed to add barrier relationship: ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages,
				// Clear loading state
				savingBarrierRelationship: false
			});
		},

		'ADD_PROBLEM_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			// ALWAYS surface backend detail message if present (including duplicates, warnings, etc)
			let messageType = 'success';
			let messageText = 'Problem added successfully! Refreshing data...';

			if (action.payload?.detail) {
				messageText = action.payload.detail;
				const lowerDetail = action.payload.detail.toLowerCase();
				// Classify message type based on content
				if (lowerDetail.includes('duplicate') || lowerDetail.includes('already')) {
					messageType = 'warning'; // Duplicate is informational, not error
				} else if (lowerDetail.includes('error') || lowerDetail.includes('failed') || lowerDetail.includes('required')) {
					messageType = 'error';
				}
			} else {
				// Get original data from response payload for custom message
				const originalRequest = action.payload?.originalRequest || {};
				const {problemName} = originalRequest;
				if (problemName) {
					messageText = `Successfully added problem "${problemName}"! Refreshing data...`;
				}
			}

			const message = {
				type: messageType,
				message: messageText,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					message
				],
				// Also add to modal messages if modal is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					message
				] : state.modalSystemMessages,
				// Clear typeahead state
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedProblemData: null,
				savingProblem: false
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			const originalRequest = action.payload?.originalRequest || {};
			const {answerId} = originalRequest;
			if (answerId && state.relationshipPanelOpen && state.relationshipModalAnswerId === answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}

			// Also refresh section questions to update badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'ADD_PROBLEM_RELATIONSHIP_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('ADD_PROBLEM_RELATIONSHIP_ERROR:', action.payload);

			// Follow standard backend error extraction pattern
			let errorMessage = 'Unknown error';
			if (action.payload?.detail) {
				errorMessage = action.payload.detail;
			} else if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			} else if (action.payload?.statusText) {
				errorMessage = action.payload.statusText;
			}

			const errorMessageObj = {
				type: 'error',
				message: `Failed to add problem: ${errorMessage}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessageObj],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessageObj
				] : state.modalSystemMessages,
				savingProblem: false
			});
		},

		'DELETE_BARRIER_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const successMessage = {
				type: 'success',
				message: `Barrier relationship deleted successfully! Refreshing data...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), successMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages,
				// Clear loading state
				savingBarrierRelationship: false
			});

			// Refresh the modal answer relationships to show updated data
			if (state.relationshipModalAnswerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: state.relationshipModalAnswerId,
					currentAssessmentId: state.currentAssessmentId,
					sectionId: state.selectedSectionId,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'DELETE_BARRIER_RELATIONSHIP_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('DELETE_BARRIER_RELATIONSHIP_ERROR:', action.payload);

			const errorMessage = {
				type: 'error',
				message: `Failed to delete barrier relationship: ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages,
				// Clear loading state
				savingBarrierRelationship: false
			});
		},

		'REMOVE_BARRIER_RELATIONSHIP': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, barrierId} = action.payload;
			// Find barrier name for user feedback
			const relationships = state.answerRelationships?.[answerId];
			const barrier = relationships?.barriers?.barriers?.find(b => b.id === barrierId);
			const barrierName = barrier?.label || barrier?.name || 'Unknown Barrier';

			// Set loading state
			updateState({
				savingBarrierRelationship: true
			});

			// AUTO-DELETE: Immediately call API
			const requestBody = JSON.stringify({
				barrierId: barrierId
			});
			dispatch('MAKE_DELETE_BARRIER_RELATIONSHIP_REQUEST', {
				requestBody: requestBody,
				meta: {
					answerId: answerId,
					barrierId: barrierId,
					barrierName: barrierName
				}
			});

			// Show system message about auto-delete
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Deleting barrier relationship from backend...',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'SAVE_PROBLEM_EDITS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, problemId, editData} = action.payload;

			// Validate problem label is not blank
			if (!editData.label || editData.label.trim() === '') {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Problem text cannot be blank. Please enter problem text.',
							timestamp: new Date().toISOString()
						}
					],
					modalSystemMessages: state.relationshipPanelOpen ? [
						...(state.modalSystemMessages || []),
						{
							type: 'error',
							message: 'Problem text cannot be blank. Please enter problem text.',
							timestamp: new Date().toISOString()
						}
					] : state.modalSystemMessages
				});
				return; // Don't clear editing state - keep save/cancel buttons
			}

			// Get current problem data for merging with edits
			const relationships = state.answerRelationships?.[answerId];
			const currentProblem = relationships?.problems?.problems?.find(p => p.id === problemId);

			if (!currentProblem) {
				console.error('Could not find problem to edit:', problemId);
				updateState({
					editingProblemId: null,
					editingProblemData: null,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Could not find problem to update',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// AUTO-SAVE: Immediately call API with full payload structure
			const requestBody = JSON.stringify({
				problemId: problemId,  // Use correct field name expected by server API
				label: editData.label,
				tooltip: editData.tooltip || '',
				alternative_wording: editData.alternative_wording || '',
				custom_attributes: editData.custom_attributes || {},
				required: currentProblem.required || false
			});
			dispatch('MAKE_SAVE_PROBLEM_EDITS_REQUEST', {
				requestBody: requestBody
			});

			// Clear editing state and show system message
			updateState({
				editingProblemId: null,
				editingProblemData: null,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Saving problem changes to backend...',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'SAVE_PROBLEM_EDITS_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Handle 204 No Content response (null/empty payload is expected and indicates success)
			if (action.payload === null || action.payload === undefined) {
				const successMessage = {
					type: 'success',
					message: 'Problem updated successfully! Refreshing data...',
					timestamp: new Date().toISOString()
				};

				updateState({
					systemMessages: [...(state.systemMessages || []), successMessage],
					modalSystemMessages: state.relationshipPanelOpen ? [
						...(state.modalSystemMessages || []),
						successMessage
					] : state.modalSystemMessages
				});

				// Refresh the modal answer relationships to show updated data
				if (state.relationshipModalAnswerId) {
					dispatch('LOAD_ANSWER_RELATIONSHIPS', {
						answerId: state.relationshipModalAnswerId
					});
				}
				return;
			}

			// Check if the response contains an error
			if (action.payload?.error) {
				console.error('API returned error in success response:', action.payload.error);
				const errorMessage = {
					type: 'error',
					message: `Failed to save problem edits: ${action.payload.error}`,
					timestamp: new Date().toISOString()
				};

				updateState({
					systemMessages: [...(state.systemMessages || []), errorMessage],
					modalSystemMessages: state.relationshipPanelOpen ? [
						...(state.modalSystemMessages || []),
						errorMessage
					] : state.modalSystemMessages
				});
				return;
			}

			const successMessage = {
				type: 'success',
				message: 'Problem updated successfully! Refreshing data...',
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), successMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages
			});

			// Refresh the modal answer relationships to show updated data
			if (state.relationshipModalAnswerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: state.relationshipModalAnswerId
				});
			}
		},

		'SAVE_PROBLEM_EDITS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('SAVE_PROBLEM_EDITS_ERROR:', action.payload);

			// Follow standard backend error extraction pattern
			let errorMessage = 'Unknown error';
			if (action.payload?.detail) {
				errorMessage = action.payload.detail;
			} else if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			} else if (action.payload?.statusText) {
				errorMessage = action.payload.statusText;
			}

			const errorMessageObj = {
				type: 'error',
				message: `Failed to update problem: ${errorMessage}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessageObj],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessageObj
				] : state.modalSystemMessages
			});
		},


		'TOGGLE_EDIT_RELATIONSHIPS': (coeffects) => {
			const {updateState, state} = coeffects;
			updateState({
				showRelationships: !state.showRelationships
			});
		},

		'TOGGLE_SCORING_MODE': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			if (!state.scoringPanelOpen) {
				// Opening panel - fetch scoring models for this assessment
				updateState({
					scoringPanelOpen: true,
					scoringModelsLoading: true
				});

				// Fetch scoring models for this assessment
				if (!state.currentAssessmentId) {
					updateState({
						scoringModelsLoading: false,
						scoringModels: [],
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'error',
								message: 'Assessment ID not available. Cannot load scoring models.',
								timestamp: new Date().toISOString()
							}
						]
					});
					return;
				}

				dispatch('FETCH_SCORING_MODELS', {
					guidelineTemplateId: state.currentAssessmentId
				});
			} else {
				// Closing panel
				updateState({
					scoringPanelOpen: false
				});
			}
		},

		'CREATE_SCORING_MODEL': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			const {label, scoringType, guidelineTemplateId} = coeffects.action.payload;
			// Show creating state
			updateState({
				creatingScoringModel: true
			});

			// Build request payload - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				guideline_template_id: guidelineTemplateId,
				label: label,
				scoring_type: scoringType
			});
			dispatch('MAKE_CREATE_SCORING_MODEL_REQUEST', {requestBody: requestBody});
		},

		'MAKE_CREATE_SCORING_MODEL_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/create-scoring-model', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'CREATE_SCORING_MODEL_SUCCESS',
			errorActionType: 'CREATE_SCORING_MODEL_ERROR'
		}),

		'CREATE_SCORING_MODEL_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Clear form and loading state
			updateState({
				creatingScoringModel: false,
				showCreateScoringModel: false,
				newScoringModelLabel: '',
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Scoring model created successfully!',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Refresh scoring models list after successful creation
			if (state.currentAssessmentId) {
				dispatch('FETCH_SCORING_MODELS', {
					guidelineTemplateId: state.currentAssessmentId
				});
			}
		},

		'CREATE_SCORING_MODEL_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('Failed to create scoring model:', action.payload);

			updateState({
				creatingScoringModel: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: 'Failed to create scoring model: ' + (action.payload?.error || 'Unknown error'),
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'FETCH_SCORING_MODELS': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			const {guidelineTemplateId} = coeffects.action.payload;
			// Get current config for the request
			if (!state.careiqConfig) {
				updateState({
					scoringModelsLoading: false,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Configuration not loaded. Please try again.',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Build request payload - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				guideline_template_id: guidelineTemplateId
			});
			dispatch('MAKE_GET_SCORING_MODELS_REQUEST', {requestBody: requestBody});
		},

		'MAKE_GET_SCORING_MODELS_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-scoring-models', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GET_SCORING_MODELS_SUCCESS',
			errorActionType: 'GET_SCORING_MODELS_ERROR'
		}),

		'GET_SCORING_MODELS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			// Extract scoring models from response
			const scoringModels = action.payload?.scoring || [];

			updateState({
				scoringModelsLoading: false,
				scoringModels: scoringModels,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Found ${scoringModels.length} scoring model${scoringModels.length === 1 ? '' : 's'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'GET_SCORING_MODELS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('Failed to fetch scoring models:', action.payload);

			updateState({
				scoringModelsLoading: false,
				scoringModels: [],
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: 'Failed to fetch scoring models: ' + (action.payload?.error || 'Unknown error'),
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'DELETE_SCORING_MODEL': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			const {modelId, modelLabel} = coeffects.action.payload;

			// Build request payload - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				guideline_template_id: state.currentAssessmentId,
				model_id: modelId
			});
			dispatch('MAKE_DELETE_SCORING_MODEL_REQUEST', {
				requestBody: requestBody,
				meta: { modelId: modelId, modelLabel: modelLabel }
			});
		},

		'MAKE_DELETE_SCORING_MODEL_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-scoring-model', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_SCORING_MODEL_SUCCESS',
			errorActionType: 'DELETE_SCORING_MODEL_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_SAVE_SCORING_MODEL_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/save-scoring-model', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'SAVE_SCORING_MODEL_SUCCESS',
			errorActionType: 'SAVE_SCORING_MODEL_ERROR',
			metaParam: 'meta'
		}),

		'DELETE_SCORING_MODEL_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const modelLabel = action.meta?.modelLabel || 'Scoring model';
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `${modelLabel} deleted successfully!`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Refresh scoring models list after successful deletion
			if (state.currentAssessmentId) {
				dispatch('FETCH_SCORING_MODELS', {
					guidelineTemplateId: state.currentAssessmentId
				});
			}
		},

		'DELETE_SCORING_MODEL_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const modelLabel = action.meta?.modelLabel || 'Scoring model';

			console.error('Failed to delete scoring model:', action.payload);

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to delete ${modelLabel}: ` + (action.payload?.error || 'Unknown error'),
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'SAVE_SCORING_MODEL_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('SAVE_SCORING_MODEL_SUCCESS called:', {
				savingScoringChanges: state.savingScoringChanges,
				pendingScoringChanges: state.pendingScoringChanges,
				actionPayload: action.payload
			});

			// Only process when we're in a batch save operation
			if (state.savingScoringChanges && state.pendingScoringChanges > 0) {
				const remainingCount = state.pendingScoringChanges - 1;

				console.log('Processing batch save, remainingCount:', remainingCount);

				// If this is the last save, show message and reload
				if (remainingCount <= 0) {
					console.log('Last save completed, clearing loading state');
					updateState({
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'success',
								message: 'Scores saved successfully',
								timestamp: new Date().toISOString()
							}
						],
						savingScoringChanges: false,
						pendingScoringChanges: 0
					});

					// Reload assessment data after all saves complete (stay in scoring mode)
					if (state.currentAssessmentId) {
						dispatch('FETCH_ASSESSMENT_DETAILS', {
							assessmentId: state.currentAssessmentId
						});
					}
				} else {
					// Decrement the counter
					console.log('Decrementing counter to:', remainingCount);
					updateState({
						pendingScoringChanges: remainingCount
					});
				}
			}
		},

		'SAVE_SCORING_MODEL_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			// Always clear loading state on error during batch saves
			if (state.savingScoringChanges) {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Failed to save score: ' + (action.payload?.error || 'Unknown error'),
							timestamp: new Date().toISOString()
						}
					],
					savingScoringChanges: false,
					pendingScoringChanges: 0
				});
			} else {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Failed to save score: ' + (action.payload?.error || 'Unknown error'),
							timestamp: new Date().toISOString()
						}
					]
				});
			}
		},

		'SELECT_SCORING_MODEL': (coeffects) => {
			const {updateState, state} = coeffects;
			const {model} = coeffects.action.payload;

			updateState({
				selectedScoringModel: model,
				scoringPanelOpen: false, // Close the scoring panel
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Now editing scores for: ${model.label}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'EXIT_SCORING_MODE': (coeffects) => {
			const {updateState, state} = coeffects;

			updateState({
				selectedScoringModel: null,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Exited scoring mode',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'START_ADD_RELATIONSHIP': (coeffects) => {
			const {action, updateState} = coeffects;
			const {answerId} = action.payload;
			
			updateState({
				addingRelationship: answerId,
				selectedRelationshipType: null,
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedRelationshipQuestion: null
			});
		},

		'CANCEL_ADD_RELATIONSHIP': (coeffects) => {
			const {updateState} = coeffects;
			
			updateState({
				addingRelationship: null,
				selectedRelationshipType: null,
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedRelationshipQuestion: null,
				currentGuidelineSearchAnswerId: null
			});
		},

		'SET_RELATIONSHIP_TYPE': (coeffects) => {
			const {action, updateState} = coeffects;
			const {relationshipType} = action.payload;
			
			updateState({
				selectedRelationshipType: relationshipType,
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedRelationshipQuestion: null,
				currentGuidelineSearchAnswerId: null
			});
		},

		'RELATIONSHIP_TYPEAHEAD_INPUT': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {text, answerId} = action.payload;
			updateState({
				relationshipTypeaheadText: text
			});
			
			// Filter questions from current section based on input text
			if (text.length >= 2 && state.currentQuestions?.questions) {
				// Find the current answer to check its existing triggered questions
				let currentAnswer = null;
				for (const question of state.currentQuestions.questions) {
					if (question.answers) {
						for (const answer of question.answers) {
							if (answer.ids.id === answerId) {
								currentAnswer = answer;
								break;
							}
						}
					}
					if (currentAnswer) break;
				}
				
				if (!currentAnswer) {
					console.error('Could not find current answer with ID:', answerId);
					updateState({
						relationshipTypeaheadResults: []
					});
					return;
				}
				
				// Get existing triggered questions from multiple sources:
				// 1. Local answer data (from section API)
				const localTriggeredQuestions = currentAnswer.triggered_questions || [];
				
				// 2. Loaded relationship data (from relationships API)
				const relationshipData = state.answerRelationships[answerId];
				const apiTriggeredQuestions = relationshipData?.questions?.questions?.map(q => q.id) || [];
				
				// 3. Combine both sources to get complete list
				const allTriggeredQuestions = [...new Set([...localTriggeredQuestions, ...apiTriggeredQuestions])];
				const filteredQuestions = state.currentQuestions.questions.filter(question => {
					const matchesText = question.label.toLowerCase().includes(text.toLowerCase());
					const notAlreadyTriggered = !allTriggeredQuestions.includes(question.ids.id);
					
					if (matchesText) {
					}
					
					return matchesText && notAlreadyTriggered;
				});
				updateState({
					relationshipTypeaheadResults: filteredQuestions.slice(0, 10) // Limit to 10 results
				});
			} else {
				updateState({
					relationshipTypeaheadResults: []
				});
			}
		},

		'SELECT_RELATIONSHIP_QUESTION': (coeffects) => {
			const {action, updateState} = coeffects;
			const {answerId, questionId, questionLabel} = action.payload;
			// Store the selected question and populate the input field
			updateState({
				selectedRelationshipQuestion: {
					id: questionId,
					label: questionLabel
				},
				relationshipTypeaheadText: questionLabel,
				relationshipTypeaheadResults: [] // Hide dropdown
			});
		},
		'GUIDELINE_TYPEAHEAD_INPUT': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {text, answerId} = action.payload;
			updateState({
				relationshipTypeaheadText: text,
				selectedRelationshipQuestion: null // Clear any selected guideline
			});

			// Only search after 3 characters
			if (text && text.length >= 2) {
				dispatch('SEARCH_GUIDELINES', {
					searchText: text,
					answerId: answerId
				});
			} else {
				updateState({
					relationshipTypeaheadResults: []
				});
			}
		},
		'SEARCH_GUIDELINES': (coeffects) => {
			const {action, dispatch, updateState} = coeffects;
			const {searchText, answerId} = action.payload;
			const requestBody = JSON.stringify({
				searchText: searchText
			});
			updateState({
				relationshipTypeaheadLoading: true,
				currentGuidelineSearchAnswerId: answerId // Store answerId in state
			});
			dispatch('MAKE_GUIDELINE_SEARCH_REQUEST', {
				requestBody: requestBody,
				meta: {
					searchText: searchText,
					answerId: answerId
				}
			});
		},

		'FETCH_PROBLEM_DETAILS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {problemId, fallbackData} = action.payload;
			// Show loading state for the specific problem
			updateState({
				editingProblemId: problemId,
				editingProblemData: null, // Clear previous data while loading
				problemDetailsLoading: problemId
			});

			// Make API request to get full problem details
			const requestBody = JSON.stringify({
				problemId: problemId
			});
			// Store fallback data in case the API call fails
			updateState({
				problemDetailsFallback: fallbackData
			});

			dispatch('MAKE_GET_PROBLEM_DETAILS_REQUEST', {
				requestBody: requestBody
			});
		},

		'GET_PROBLEM_DETAILS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			// Clear loading state
			updateState({
				problemDetailsLoading: null
			});

			// Check if we got valid problem data
			if (action.payload && (action.payload.label || action.payload.name)) {
				// Use the detailed data from the API
				updateState({
					editingProblemData: {
						label: action.payload.label || action.payload.name || '',
						alternative_wording: action.payload.alternative_wording || '',
						tooltip: action.payload.tooltip || '',
						custom_attributes: action.payload.custom_attributes || {}
					}
				});
			} else {
				// Fallback to cached data if API didn't return proper details
				const fallbackData = state.problemDetailsFallback || {
					label: '',
					alternative_wording: '',
					tooltip: '',
					custom_attributes: {}
				};
				updateState({
					editingProblemData: {
						...fallbackData,
						custom_attributes: fallbackData.custom_attributes || {}
					}
				});
			}

			// Clear fallback data
			updateState({
				problemDetailsFallback: null
			});
		},

		'GET_PROBLEM_DETAILS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('GET_PROBLEM_DETAILS_ERROR:', action.payload);

			// Clear loading state and use fallback data
			updateState({
				problemDetailsLoading: null,
				editingProblemData: state.problemDetailsFallback || {
					label: '',
					alternative_wording: '',
					tooltip: ''
				},
				problemDetailsFallback: null,
				systemMessages: [...(state.systemMessages || []), {
					type: 'warning',
					message: 'Could not load full problem details. Using basic information for editing.',
					timestamp: new Date().toISOString()
				}],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					{
						type: 'warning',
						message: 'Could not load full problem details. Using basic information for editing.',
						timestamp: new Date().toISOString()
					}
				] : state.modalSystemMessages
			});
		},

		'DELETE_PROBLEM_RELATIONSHIP': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, problemId, problemName} = action.payload;

			// Set loading state for this problem
			updateState({
				deletingProblems: {
					...state.deletingProblems,
					[problemId]: true
				}
			});

			// AUTO-DELETE: Immediately call API
			const requestBody = JSON.stringify({
				problemId: problemId
			});
			dispatch('MAKE_DELETE_PROBLEM_RELATIONSHIP_REQUEST', {
				requestBody: requestBody,
				meta: {
					problemId: problemId,
					problemName: problemName,
					answerId: answerId
				}
			});

			// Show system message about deletion
			const deletingMessage = {
				type: 'info',
				message: 'Deleting problem relationship from backend...',
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), deletingMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					deletingMessage
				] : state.modalSystemMessages
			});
		},

		'DELETE_PROBLEM_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const meta = action.meta || {};
			const {problemName, answerId, problemId} = meta;

			// Clear loading state
			const updatedDeletingProblems = {...state.deletingProblems};
			if (problemId) {
				delete updatedDeletingProblems[problemId];
			}

			// Handle 204 No Content response (null/empty payload is expected and indicates success)
			if (action.payload === null || action.payload === undefined) {
			}

			const successMessage = {
				type: 'success',
				message: `Problem relationship deleted successfully! Refreshing data...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				deletingProblems: updatedDeletingProblems,
				systemMessages: [...(state.systemMessages || []), successMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages
			});

			// Refresh the modal answer relationships to show updated data
			if (state.relationshipModalAnswerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: state.relationshipModalAnswerId,
					currentAssessmentId: state.currentAssessmentId,
					sectionId: state.selectedSectionId,
					sectionLabel: state.selectedSectionLabel
				});
			}

			// Also refresh section questions to update badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'DELETE_PROBLEM_RELATIONSHIP_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('DELETE_PROBLEM_RELATIONSHIP_ERROR:', action.payload);

			const meta = action.meta || {};
			const {problemName, problemId} = meta;

			// Clear loading state
			const updatedDeletingProblems = {...state.deletingProblems};
			if (problemId) {
				delete updatedDeletingProblems[problemId];
			}

			const errorMessage = {
				type: 'error',
				message: `Failed to delete problem "${problemName}": ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				deletingProblems: updatedDeletingProblems,
				systemMessages: [...(state.systemMessages || []), errorMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'LOAD_PROBLEM_GOALS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {problemId, guidelineTemplateId} = action.payload;
			// Set loading state and store current loading problemId for success handler
			updateState({
				goalsLoading: {
					...state.goalsLoading,
					[problemId]: true
				},
				currentGoalsLoadingProblemId: problemId  // Store for SUCCESS handler
			});

			// Fix: Use direct fields pattern (API expects request.body.data.problemId directly)
			const requestBody = JSON.stringify({
				problemId: problemId,
				guidelineTemplateId: guidelineTemplateId
			});
			dispatch('MAKE_LOAD_PROBLEM_GOALS_REQUEST', {
				requestBody: requestBody,
				meta: {
					problemId: problemId,
					guidelineTemplateId: guidelineTemplateId
				}
			});
		},

		'LOAD_PROBLEM_GOALS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			// Use stored problemId from state instead of meta (meta not working reliably)
			const problemId = state.currentGoalsLoadingProblemId;
			// Parse the response to get goals data
			const goalsData = action.payload?.goals || [];

			updateState({
				goalsLoading: {
					...state.goalsLoading,
					[problemId]: false
				},
				problemGoals: {
					...state.problemGoals,
					[problemId]: goalsData
				},
				currentGoalsLoadingProblemId: null  // Clear stored ID
			});
		},

		'SAVE_GOAL_TO_PROBLEM': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {problemId, goalText, selectedGoal, answerId} = action.payload;
			// Show saving message
			const savingMessage = {
				type: 'info',
				message: selectedGoal ? `Linking existing goal "${goalText}" to problem...` : `Creating new goal "${goalText}"...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					savingMessage
				],
				// Also add to modal messages if modal is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					savingMessage
				] : state.modalSystemMessages,
				// Set loading state for this problem's goal save
				savingGoals: {
					...state.savingGoals,
					[problemId]: true
				}
			});

			// Clear input immediately for better UX
			updateState({
				goalTypeaheadText: {
					...state.goalTypeaheadText,
					[problemId]: ''
				},
				goalTypeaheadResults: {
					...state.goalTypeaheadResults,
					[problemId]: []
				},
				selectedGoalData: {
					...state.selectedGoalData,
					[problemId]: null
				}
			});

			// ALWAYS do pre-save typeahead check for exact matches to prevent duplicates
			// Store original save data for after the check
			updateState({
				pendingGoalSave: {
					problemId: problemId,
					goalText: goalText,
					selectedGoal: selectedGoal,
					answerId: answerId
				},
				// Store pre-save context separately from UI context to prevent clearing
				preSaveGoalContext: {
					contentType: 'goal',
					problemId: problemId,
					searchText: goalText,
					isPreSaveCheck: true
				}
			});

			// Silent typeahead search to check for exact matches
			dispatch('GENERIC_TYPEAHEAD_SEARCH', {
				searchText: goalText,
				type: 'goal',
				problemId: problemId,
				isPreSaveCheck: true  // Flag to identify this as pre-save check
			});
		},

		'SAVE_GOAL_TO_PROBLEM_AFTER_CHECK': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {problemId, goalText, selectedGoal, answerId} = action.payload;
			// Prepare request body for goal creation/linking
			const requestBody = JSON.stringify({
				problemId: problemId,
				goalText: goalText,
				goalId: selectedGoal ? selectedGoal.id : null, // null means create new
				answerId: answerId,
				guidelineTemplateId: state.currentAssessmentId,  // Required by backend
				libraryId: selectedGoal ? selectedGoal.master_id : null  // Library reference for existing goals
			});

			dispatch('MAKE_ADD_GOAL_REQUEST', {
				requestBody: requestBody,
				meta: {problemId: problemId, answerId: answerId, goalText: goalText}
			});
		},

		'ADD_GOAL_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Get original data from response payload
			const originalRequest = action.payload?.originalRequest || {};
			const {answerId, goalText, problemId} = originalRequest;
			// Show success or backend message
			let systemMessage = `Goal "${goalText}" processed! Refreshing data...`;
			let messageType = 'success';

			// ALWAYS surface backend detail messages to user (duplicates, errors, warnings, etc)
			if (action.payload && action.payload.detail) {
				systemMessage = action.payload.detail;
				const lowerMessage = systemMessage.toLowerCase();
				// Classify message type based on content
				if (lowerMessage.includes('duplicate') || lowerMessage.includes('already')) {
					messageType = 'warning'; // Informational, not error
				} else if (lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('required')) {
					messageType = 'error';
				}
			}

			const newMessage = {
				type: messageType,
				message: systemMessage,
				timestamp: new Date().toISOString()
			};

			// Clear loading state for this problem's goal save
			const updatedSavingGoals = {...state.savingGoals};
			if (problemId) {
				delete updatedSavingGoals[problemId];
			}

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					newMessage
				],
				// Also add to modal messages if modal is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					newMessage
				] : state.modalSystemMessages,
				savingGoals: updatedSavingGoals
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipPanelOpen && state.relationshipModalAnswerId === answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});

				// Also refresh goals for any expanded problems to show the new goal
				const expandedProblems = Object.keys(state.expandedProblems || {});
				expandedProblems.forEach(problemId => {
					if (state.expandedProblems[problemId] === true) {
						dispatch('LOAD_PROBLEM_GOALS', {
							problemId: problemId,
							guidelineTemplateId: state.currentAssessmentId
						});
					}
				});
			}

			// Also refresh section questions to update badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'ADD_GOAL_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('=== ADD_GOAL_ERROR ===');
			console.error('Error:', action.payload);

			// Extract problemId from originalRequest if available
			const originalRequest = action.payload?.originalRequest || {};
			const {problemId} = originalRequest;

			// Clear loading state
			const updatedSavingGoals = {...state.savingGoals};
			if (problemId) {
				delete updatedSavingGoals[problemId];
			}

			updateState({
				savingGoals: updatedSavingGoals,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to save goal: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'SAVE_INTERVENTION_TO_GOAL': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {goalId, interventionText, category, selectedIntervention, answerId} = action.payload;
			// Show saving message
			const savingMessage = {
				type: 'info',
				message: selectedIntervention ? `Linking existing intervention "${interventionText}" to goal...` : `Creating new intervention "${interventionText}"...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					savingMessage
				],
				// Also add to modal messages if modal is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					savingMessage
				] : state.modalSystemMessages,
				// Set loading state for this goal's intervention save
				savingInterventions: {
					...state.savingInterventions,
					[goalId]: true
				}
			});

			// Clear input immediately for better UX
			updateState({
				interventionTypeaheadText: {
					...state.interventionTypeaheadText,
					[goalId]: ''
				},
				interventionTypeaheadResults: {
					...state.interventionTypeaheadResults,
					[goalId]: []
				},
				selectedInterventionData: {
					...state.selectedInterventionData,
					[goalId]: null
				},
				interventionCategorySelection: {
					...state.interventionCategorySelection,
					[goalId]: 'assist' // Reset to default
				}
			});

			// If selectedIntervention already exists (user picked from dropdown), skip pre-save check
			if (selectedIntervention) {
				dispatch('SAVE_INTERVENTION_TO_GOAL_AFTER_CHECK', {
					goalId: goalId,
					interventionText: interventionText,
					category: category,
					selectedIntervention: selectedIntervention,
					answerId: answerId
				});
				return;
			}
			// Store original save data for after the check
			updateState({
				pendingInterventionSave: {
					goalId: goalId,
					interventionText: interventionText,
					category: category,
					selectedIntervention: selectedIntervention,
					answerId: answerId
				},
				preSaveInterventionContext: {
					contentType: 'intervention',
					goalId: goalId,
					searchText: interventionText,
					isPreSaveCheck: true  // Flag to identify this as pre-save check
				}
			});

			// Search for exact match using generic typeahead
			dispatch('GENERIC_TYPEAHEAD_SEARCH', {
				searchText: interventionText,
				type: 'intervention',
				goalId: goalId,
				isPreSaveCheck: true  // Flag to identify this as pre-save check
			});
		},

		'SAVE_INTERVENTION_TO_GOAL_AFTER_CHECK': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {goalId, interventionText, category, selectedIntervention, answerId} = action.payload;
			// CRITICAL: Store goalId in state for success handler refresh (meta params don't work reliably)
			updateState({
				lastAddedInterventionGoalId: goalId
			});

			// Prepare request body for intervention creation/linking
			const requestBody = JSON.stringify({
				goalId: goalId,
				interventionText: interventionText,
				category: category,
				interventionId: selectedIntervention ? selectedIntervention.id : null, // null means create new
				guidelineTemplateId: state.currentAssessmentId,  // Required by backend
				tooltip: selectedIntervention ? selectedIntervention.tooltip : '',
				alternativeWording: selectedIntervention ? selectedIntervention.alternative_wording : '',
				libraryId: selectedIntervention ? selectedIntervention.master_id : null  // Library reference for existing interventions
			});

			dispatch('MAKE_ADD_INTERVENTION_REQUEST', {
				requestBody: requestBody,
				meta: {
					goalId: goalId,
					interventionText: interventionText,
					category: category,
					answerId: answerId
				}
			});
		},

		'MAKE_ADD_INTERVENTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-intervention', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_INTERVENTION_SUCCESS',
			errorActionType: 'ADD_INTERVENTION_ERROR',
			metaParam: 'meta'
		}),

		'ADD_INTERVENTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Get original data from meta, with fallback to stored state
			const meta = action.meta || {};
			let {answerId, interventionText, goalId} = meta;

			// Fallback: Use stored goalId if meta doesn't have it (meta params unreliable in ServiceNow)
			if (!goalId) {
				goalId = state.lastAddedInterventionGoalId;
			}

			// Show success or backend message
			let systemMessage = interventionText ? `Intervention "${interventionText}" processed! Refreshing data...` : 'Intervention created successfully! Refreshing data...';
			let messageType = 'success';

			// ALWAYS surface backend detail messages to user (duplicates, errors, warnings, etc)
			if (action.payload && action.payload.detail) {
				systemMessage = action.payload.detail;
				const lowerMessage = systemMessage.toLowerCase();
				// Classify message type based on content
				if (lowerMessage.includes('duplicate') || lowerMessage.includes('already')) {
					messageType = 'warning'; // Informational, not error
				} else if (lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('required')) {
					messageType = 'error';
				}
			}

			const newMessage = {
				type: messageType,
				message: systemMessage,
				timestamp: new Date().toISOString()
			};

			// Clear loading state for this goal's intervention save
			const updatedSavingInterventions = {...state.savingInterventions};
			if (goalId) {
				delete updatedSavingInterventions[goalId];
			}

			updateState({
				savingInterventions: updatedSavingInterventions,
				systemMessages: [
					...(state.systemMessages || []),
					newMessage
				],
				// Also add to modal messages if modal is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					newMessage
				] : state.modalSystemMessages,
				// Clear typeahead state after successful intervention creation
				interventionTypeaheadText: goalId ? {
					...state.interventionTypeaheadText,
					[goalId]: ''
				} : state.interventionTypeaheadText,
				interventionTypeaheadResults: goalId ? {
					...state.interventionTypeaheadResults,
					[goalId]: []
				} : state.interventionTypeaheadResults,
				selectedInterventionData: goalId ? {
					...state.selectedInterventionData,
					[goalId]: null
				} : state.selectedInterventionData,
				// Clear stored goalId after use
				lastAddedInterventionGoalId: null
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipPanelOpen && state.relationshipModalAnswerId === answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}

			// CRITICAL: Refresh interventions for the SPECIFIC goal that was just updated
			if (goalId && state.currentAssessmentId) {
				dispatch('LOAD_GOAL_INTERVENTIONS', {
					goalId: goalId,
					guidelineTemplateId: state.currentAssessmentId
				});
			}

			// Also refresh section questions to update badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'ADD_INTERVENTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('=== ADD_INTERVENTION_ERROR ===');
			console.error('Error:', action.payload);

			// Extract goalId from meta if available
			const meta = action.meta || {};
			const {goalId} = meta;

			// Clear loading state
			const updatedSavingInterventions = {...state.savingInterventions};
			if (goalId) {
				delete updatedSavingInterventions[goalId];
			}

			updateState({
				savingInterventions: updatedSavingInterventions,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to save intervention: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'DELETE_GOAL': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, goalId, goalName, problemId} = action.payload;

			// Set loading state for this goal
			updateState({
				deletingGoals: {
					...state.deletingGoals,
					[goalId]: true
				}
			});

			// AUTO-DELETE: Immediately call API
			const requestBody = JSON.stringify({
				goalId: goalId
			});
			dispatch('MAKE_DELETE_GOAL_REQUEST', {
				requestBody: requestBody,
				meta: {
					goalId: goalId,
					goalName: goalName,
					answerId: answerId,
					problemId: problemId
				}
			});

			// Spinner already shows deletion status - no need for system message
		},

		'DELETE_GOAL_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const meta = action.meta || {};
			const {goalName, answerId, problemId, goalId} = meta;

			// Clear loading state
			const updatedDeletingGoals = {...state.deletingGoals};
			if (goalId) {
				delete updatedDeletingGoals[goalId];
			}

			// Handle 204 No Content response (null/empty payload is expected and indicates success)
			if (action.payload === null || action.payload === undefined) {
			}

			// Debug modal state
			updateState({
				deletingGoals: updatedDeletingGoals,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Goal "${goalName || 'Unknown'}" deleted successfully! Refreshing data...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// EXACT SAME PATTERN AS ADD_GOAL_SUCCESS - Use current modal answer ID
			if (state.relationshipPanelOpen && state.relationshipModalAnswerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: state.relationshipModalAnswerId
				});

				// Also refresh goals for any expanded problems to show the deletion
				const expandedProblems = Object.keys(state.expandedProblems || {});
				expandedProblems.forEach(problemId => {
					if (state.expandedProblems[problemId] === true) {
						dispatch('LOAD_PROBLEM_GOALS', {
							problemId: problemId,
							guidelineTemplateId: state.currentAssessmentId
						});
					}
				});
			}

			// Also refresh section questions to update badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'DELETE_GOAL_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('DELETE_GOAL_ERROR:', action.payload);

			const meta = action.meta || {};
			const {goalName, goalId} = meta;

			// Clear loading state
			const updatedDeletingGoals = {...state.deletingGoals};
			if (goalId) {
				delete updatedDeletingGoals[goalId];
			}

			updateState({
				deletingGoals: updatedDeletingGoals,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to delete goal "${goalName}": ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'DELETE_INTERVENTION': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, interventionId, interventionName, goalId} = action.payload;
			// Store context for success handler refresh and set deleting state
			updateState({
				lastDeletedInterventionGoalId: goalId,
				lastDeletedInterventionName: interventionName, // Store intervention name for success handler
				deletingInterventions: {
					...state.deletingInterventions,
					[interventionId]: true
				}
			});

			// AUTO-DELETE: Immediately call API
			const requestBody = JSON.stringify({
				interventionId: interventionId,
				goalId: goalId
			});
			dispatch('MAKE_DELETE_INTERVENTION_REQUEST', {
				requestBody: requestBody,
				meta: {
					interventionId: interventionId,
					interventionName: interventionName,
					answerId: answerId,
					goalId: goalId
				}
			});

			// Spinner already shows deletion status - no need for system message
		},

		'DELETE_INTERVENTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const meta = action.meta || {};
			const interventionId = meta.interventionId;
			// Use stored intervention name instead of unreliable meta parameter
			const interventionName = state.lastDeletedInterventionName;

			// Clear deleting state
			const updatedDeletingInterventions = {...state.deletingInterventions};
			if (interventionId) {
				delete updatedDeletingInterventions[interventionId];
			}

			// Show success message (both windows)
			const successMessage = {
				type: 'success',
				message: `Intervention "${interventionName}" deleted successfully! Refreshing data...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				deletingInterventions: updatedDeletingInterventions,
				systemMessages: [
					...(state.systemMessages || []),
					successMessage
				],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages
			});

			// CRITICAL: Refresh intervention data using stored goalId (same pattern as add)
			const goalId = state.lastDeletedInterventionGoalId;
			if (goalId && state.currentAssessmentId) {
				// Clear the stored context after use
				updateState({
					lastDeletedInterventionGoalId: null,
					lastDeletedInterventionName: null
				});
				dispatch('LOAD_GOAL_INTERVENTIONS', {
					goalId: goalId,
					guidelineTemplateId: state.currentAssessmentId
				});
			} else {
			}

			// If modal is open, refresh the relationship data
			const answerId = state.relationshipModalAnswerId;
			if (answerId && state.relationshipPanelOpen) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {answerId: answerId});
			}

			// Also refresh section questions to update badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'DELETE_INTERVENTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('DELETE_INTERVENTION_ERROR:', action.payload);

			const meta = action.meta || {};
			const interventionId = meta.interventionId;
			// Use stored intervention name instead of unreliable meta parameter
			const interventionName = state.lastDeletedInterventionName;

			// Clear deleting state
			const updatedDeletingInterventions = {...state.deletingInterventions};
			if (interventionId) {
				delete updatedDeletingInterventions[interventionId];
			}

			// Show error message (both windows)
			const errorMessage = {
				type: 'error',
				message: `Failed to delete intervention "${interventionName}": ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				deletingInterventions: updatedDeletingInterventions,
				// Clear stored context after error
				lastDeletedInterventionGoalId: null,
				lastDeletedInterventionName: null,
				systemMessages: [
					...(state.systemMessages || []),
					errorMessage
				],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'LOAD_PROBLEM_GOALS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('LOAD_PROBLEM_GOALS_ERROR:', action.payload);

			// Use stored problemId from state instead of meta
			const problemId = state.currentGoalsLoadingProblemId;

			updateState({
				goalsLoading: {
					...state.goalsLoading,
					[problemId]: false
				},
				currentGoalsLoadingProblemId: null,  // Clear stored ID
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to load goals for problem: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'GENERIC_TYPEAHEAD_SEARCH': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {searchText, type, problemId, goalId, isPreSaveCheck} = action.payload;
			if (!searchText || (searchText.length < 2 && !isPreSaveCheck)) {
				if (type === 'goal' && problemId) {
					// Clear goal typeahead results for specific problem
					updateState({
						goalTypeaheadResults: {
							...state.goalTypeaheadResults,
							[problemId]: []
						}
					});
				} else if (type === 'intervention' && goalId) {
					// Clear intervention typeahead results for specific goal
					updateState({
						interventionTypeaheadResults: {
							...state.interventionTypeaheadResults,
							[goalId]: []
						}
					});
				} else {
					updateState({relationshipTypeaheadResults: []});
				}
				return;
			}

			// Store context in state for SUCCESS handler to use
			if (type === 'goal' && problemId) {
				updateState({
					goalTypeaheadLoading: {
						...state.goalTypeaheadLoading,
						[problemId]: true
					},
					// Store current goal search context
					currentGoalSearchContext: {
						contentType: type,
						problemId: problemId,
						searchText: searchText,
						isPreSaveCheck: isPreSaveCheck || false
					}
				});
			} else if (type === 'intervention' && goalId) {
				updateState({
					interventionTypeaheadLoading: {
						...state.interventionTypeaheadLoading,
						[goalId]: true
					},
					// Store current intervention search context
					currentInterventionSearchContext: {
						contentType: type,
						goalId: goalId,
						searchText: searchText,
						isPreSaveCheck: isPreSaveCheck || false
					}
				});
			} else {
				updateState({
					relationshipTypeaheadLoading: true
					// DON'T clear goal/intervention search context for non-goal/intervention searches
					// Only clear context when searches are explicitly cancelled
				});
			}

			const requestBody = JSON.stringify({
				searchText: searchText,
				contentType: type,
				...(problemId && {problemId: problemId}),
				...(goalId && {goalId: goalId})
			});

			dispatch('MAKE_GENERIC_TYPEAHEAD_REQUEST', {
				requestBody: requestBody,
				meta: {
					searchText: searchText,
					contentType: type,
					problemId: problemId,
					goalId: goalId
				}
			});
		},

		'MAKE_GENERIC_TYPEAHEAD_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/generic-typeahead', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GENERIC_TYPEAHEAD_SUCCESS',
			errorActionType: 'GENERIC_TYPEAHEAD_ERROR',
			metaParam: 'meta'
		}),

		'GENERIC_TYPEAHEAD_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const results = action.payload?.results || [];

			// Check if this is an answer duplicate check during save
			const answerContext = action.meta?.answerContext || state.answerDuplicateCheckContext;

			if (answerContext && state.pendingAnswersToCheck) {
				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					// Found library match! Update the answer with library_id

					// Find the answer in pendingAnswersToCheck and add library_id
					const updatedAnswersToCheck = state.pendingAnswersToCheck.map(answer => {
						if (answer.questionId === answerContext.questionId &&
							answer.answerLabel === answerContext.answerLabel) {
							return {
								...answer,
								library_id: exactMatch.id,
								isLibraryAnswer: true
							};
						}
						return answer;
					});

					// Check next answer
					const nextIndex = (state.pendingAnswersCheckIndex || 0) + 1;
					updateState({
						pendingAnswersToCheck: updatedAnswersToCheck,
						pendingAnswersCheckIndex: nextIndex,
						answerDuplicateCheckContext: null,
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'info',
								message: `Answer "${answerContext.answerLabel}" matched library answer - using library reference.`,
								timestamp: new Date().toISOString()
							}
						]
					});
					dispatch('CHECK_NEXT_ANSWER_FOR_DUPLICATE', {});
					return;
				} else {
					// No duplicate, check next answer
					const nextIndex = (state.pendingAnswersCheckIndex || 0) + 1;
					updateState({
						pendingAnswersCheckIndex: nextIndex,
						answerDuplicateCheckContext: null
					});
					dispatch('CHECK_NEXT_ANSWER_FOR_DUPLICATE', {});
					return;
				}
			}

			// Use stored context from state instead of meta
			const goalSearchContext = state.currentGoalSearchContext;
			const interventionSearchContext = state.currentInterventionSearchContext;
			const questionSearchContext = state.currentQuestionSearchContext;
			const answerSearchContext = state.currentAnswerSearchContext;
			const preSaveGoalContext = state.preSaveGoalContext;
			const preSaveProblemContext = state.preSaveProblemContext;
			const preSaveQuestionContext = state.preSaveQuestionContext;
			// Check if this is a pre-save exact match check for goals
			if (preSaveGoalContext && preSaveGoalContext.isPreSaveCheck) {
				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					// Use the exact match as selectedGoal with library data
					const selectedGoal = {
						id: exactMatch.id,
						name: exactMatch.name,
						master_id: exactMatch.master_id
					};

					// Get pending save data and proceed with library goal
					const pendingGoalSave = state.pendingGoalSave;
					if (pendingGoalSave) {
						dispatch('SAVE_GOAL_TO_PROBLEM_AFTER_CHECK', {
							problemId: pendingGoalSave.problemId,
							goalText: pendingGoalSave.goalText,
							selectedGoal: selectedGoal,  // Use exact match
							answerId: pendingGoalSave.answerId
						});
					}
				} else {
					// No exact match, proceed with original goal (new goal creation)
					const pendingGoalSave = state.pendingGoalSave;
					if (pendingGoalSave) {
						dispatch('SAVE_GOAL_TO_PROBLEM_AFTER_CHECK', {
							problemId: pendingGoalSave.problemId,
							goalText: pendingGoalSave.goalText,
							selectedGoal: pendingGoalSave.selectedGoal,  // Original selection (null for new)
							answerId: pendingGoalSave.answerId
						});
					}
				}

				// Clear pre-save context and pending data
				updateState({
					preSaveGoalContext: null,
					pendingGoalSave: null
				});

				return; // Exit early - this was a pre-save check, not a UI typeahead
			}

			// Check if this is a pre-save exact match check for problems
			if (preSaveProblemContext && preSaveProblemContext.isPreSaveCheck) {
				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					// Use the exact match as selectedProblem with library data
					const selectedProblem = {
						id: exactMatch.id,
						name: exactMatch.name || exactMatch.label,
						label: exactMatch.label || exactMatch.name,
						master_id: exactMatch.master_id
					};

					// Get pending save data and proceed with library problem
					const pendingProblemSave = state.pendingProblemSave;
					if (pendingProblemSave) {
						dispatch('ADD_PROBLEM_RELATIONSHIP', {
							answerId: pendingProblemSave.answerId,
							problemId: selectedProblem.id,
							problemName: selectedProblem.name || selectedProblem.label,
							problemMasterId: selectedProblem.master_id
						});
					}
				} else {
					// No exact match, proceed with new problem creation
					const pendingProblemSave = state.pendingProblemSave;
					if (pendingProblemSave) {
						dispatch('CREATE_NEW_PROBLEM_AFTER_CHECK', {
							answerId: pendingProblemSave.answerId,
							problemName: pendingProblemSave.problemName
						});
					}
				}

				// Clear pre-save context and pending data
				updateState({
					preSaveProblemContext: null,
					pendingProblemSave: null
				});

				return; // Exit early - this was a pre-save check, not a UI typeahead
			}

			// Check if this is a pre-save exact match check for interventions
			const preSaveInterventionContext = state.preSaveInterventionContext;
			if (preSaveInterventionContext && preSaveInterventionContext.isPreSaveCheck) {
				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					// Use the exact match as selectedIntervention with library data
					const selectedIntervention = {
						id: exactMatch.id,
						name: exactMatch.name || exactMatch.label,
						label: exactMatch.label || exactMatch.name,
						master_id: exactMatch.master_id,
						tooltip: exactMatch.tooltip,
						alternative_wording: exactMatch.alternative_wording,
						category: exactMatch.category
					};

					// Get pending save data and proceed with library intervention
					const pendingInterventionSave = state.pendingInterventionSave;
					if (pendingInterventionSave) {
						dispatch('SAVE_INTERVENTION_TO_GOAL_AFTER_CHECK', {
							goalId: pendingInterventionSave.goalId,
							interventionText: pendingInterventionSave.interventionText,
							category: pendingInterventionSave.category,
							selectedIntervention: selectedIntervention,  // Use exact match
							answerId: pendingInterventionSave.answerId
						});
					}
				} else {
					// No exact match, proceed with original intervention (new intervention creation)
					const pendingInterventionSave = state.pendingInterventionSave;
					if (pendingInterventionSave) {
						dispatch('SAVE_INTERVENTION_TO_GOAL_AFTER_CHECK', {
							goalId: pendingInterventionSave.goalId,
							interventionText: pendingInterventionSave.interventionText,
							category: pendingInterventionSave.category,
							selectedIntervention: pendingInterventionSave.selectedIntervention,  // Original selection (null for new)
							answerId: pendingInterventionSave.answerId
						});
					}
				}

				// Clear pre-save context and pending data
				updateState({
					preSaveInterventionContext: null,
					pendingInterventionSave: null
				});

				return; // Exit early - this was a pre-save check, not a UI typeahead
			}

			// Check if this is a pre-save exact match check for questions
		if (preSaveQuestionContext && preSaveQuestionContext.isPreSaveCheck) {
				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					// Found library question - fetch full details including answers
					updateState({
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'success',
								message: `Found library question "${exactMatch.label || exactMatch.name}" with answers! Auto-populating and saving...`,
								timestamp: new Date().toISOString()
							}
						]
					});

					// Fetch the complete library question with answers
					dispatch('FETCH_LIBRARY_QUESTION_FOR_PRESAVE', {
						libraryQuestionId: exactMatch.id,
						questionContext: preSaveQuestionContext
					});
				} else {
					// No exact match - proceed with normal save
					updateState({
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'info',
								message: `No library match found. Proceeding with new question save...`,
								timestamp: new Date().toISOString()
							}
						]
					});

					// Continue with normal save process using stored context
					dispatch('CONTINUE_QUESTION_SAVE_AFTER_CHECK', {
						questionContext: preSaveQuestionContext
					});
				}

				// Clear pre-save context
				updateState({
					preSaveQuestionContext: null
				});

				return; // Exit early - this was a pre-save check, not a UI typeahead
			}

			// Check if this is a question move operation (lookup before move)
			const pendingQuestionMovePreLookup = state.pendingQuestionMovePreLookup;
			if (pendingQuestionMovePreLookup) {
				// Look for exact match to get library_id
				const exactMatch = results.find(result => result.exact_match === true);
				const libraryId = exactMatch ? (exactMatch.id || exactMatch.master_id) : null;

				// Continue with the move using the library_id
				dispatch('CONTINUE_QUESTION_MOVE_AFTER_LOOKUP', {
					libraryId: libraryId
				});

				return; // Exit early - this was a move lookup, not a UI typeahead
			}

			// Check if this is a pre-save exact match check for sections
			const preSaveSectionContext = state.preSaveSectionContext;
			if (preSaveSectionContext && preSaveSectionContext.isPreSaveCheck) {
				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					// Get pending save data and proceed with library section
					const pendingSectionSave = state.pendingSectionSave;
					if (pendingSectionSave) {
						// Update state to indicate library section selection
						updateState({
							selectedSectionLibraryId: exactMatch.master_id
						});

						dispatch('PROCEED_WITH_SECTION_SAVE', {
							sectionId: pendingSectionSave.sectionId,
							sectionLabel: pendingSectionSave.sectionLabel
						});
					}
				} else {
					// No exact match, proceed with original section (new section creation)
					const pendingSectionSave = state.pendingSectionSave;
					if (pendingSectionSave) {
						// Clear library selection since this is a new section
						updateState({
							selectedSectionLibraryId: null
						});

						dispatch('PROCEED_WITH_SECTION_SAVE', {
							sectionId: pendingSectionSave.sectionId,
							sectionLabel: pendingSectionSave.sectionLabel
						});
					}
				}

				// Clear pre-save context and pending data
				updateState({
					preSaveSectionContext: null,
					pendingSectionSave: null
				});

				return; // Exit early - this was a pre-save check, not a UI typeahead
			}

			// Check if this is a pre-save exact match check for barriers
			const preSaveBarrierContext = state.preSaveBarrierContext;
			if (preSaveBarrierContext && preSaveBarrierContext.isPreSaveCheck) {
				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					// Use the exact match as selectedBarrier with library data
					const selectedBarrier = {
						id: exactMatch.id,
						name: exactMatch.name || exactMatch.label,
						label: exactMatch.label || exactMatch.name,
						master_id: exactMatch.master_id
					};

					// Get pending save data and proceed with library barrier
					const pendingBarrierSave = state.pendingBarrierSave;
					if (pendingBarrierSave) {
						dispatch('ADD_BARRIER_RELATIONSHIP', {
							answerId: pendingBarrierSave.answerId,
							barrierId: selectedBarrier.id,
							barrierName: selectedBarrier.name || selectedBarrier.label,
							barrierMasterId: selectedBarrier.master_id
						});
					}
				} else {
					// No exact match, proceed with new barrier creation
					const pendingBarrierSave = state.pendingBarrierSave;
					if (pendingBarrierSave) {
						dispatch('CREATE_NEW_BARRIER_AFTER_CHECK', {
							answerId: pendingBarrierSave.answerId,
							barrierName: pendingBarrierSave.barrierName
						});
					}
				}

				// Clear pre-save context and pending data
				updateState({
					preSaveBarrierContext: null,
					pendingBarrierSave: null
				});

				return; // Exit early - this was a pre-save check, not a UI typeahead
			}

			// Normal typeahead UI flow (not pre-save check)
			if (goalSearchContext && goalSearchContext.contentType === 'goal' && goalSearchContext.problemId) {
				const problemId = goalSearchContext.problemId;
				// Update goal typeahead state for specific problem - DON'T clear context yet
				updateState({
					goalTypeaheadResults: {
						...state.goalTypeaheadResults,
						[problemId]: results
					},
					goalTypeaheadLoading: {
						...state.goalTypeaheadLoading,
						[problemId]: false
					}
					// DON'T clear context - let it be cleared by blur/escape events
				});
			} else if (interventionSearchContext && interventionSearchContext.contentType === 'intervention' && interventionSearchContext.goalId) {
				const goalId = interventionSearchContext.goalId;
				// Update intervention typeahead state for specific goal - DON'T clear context yet
				updateState({
					interventionTypeaheadResults: {
						...state.interventionTypeaheadResults,
						[goalId]: results
					},
					interventionTypeaheadLoading: {
						...state.interventionTypeaheadLoading,
						[goalId]: false
					}
					// DON'T clear context - let it be cleared by blur/escape events
				});
			} else if (questionSearchContext && questionSearchContext.contentType === 'question') {
				// Question typeahead using generic endpoint with stored context pattern
				// Apply same filtering logic as original QUESTION_SEARCH_SUCCESS
				if (state.relationshipPanelOpen && state.relationshipTypeaheadLoading) {
					// Filter out the current question (the one this answer belongs to)
					const answerId = state.relationshipModalAnswerId;
					const currentQuestionId = state.currentQuestions?.questions?.find(q =>
						q.answers?.some(a => a.ids.id === answerId)
					)?.ids?.id;

					// Also filter out questions that already have relationships with this answer
					const existingQuestionIds = state.answerRelationships[answerId]?.questions?.questions?.map(q => q.id) || [];

					const filteredResults = results.filter(question => {
						// Don't show the current question
						if (question.id === currentQuestionId) {
							return false;
						}
						// Don't show questions that already have relationships
						if (existingQuestionIds.includes(question.id)) {
							return false;
						}
						return true;
					});

					updateState({
						relationshipTypeaheadResults: filteredResults,
						relationshipTypeaheadLoading: false
					});
				} else {
					// Regular question typeahead (not in relationship modal)
					updateState({
						questionTypeaheadResults: results,
						questionTypeaheadLoading: false
					});
				}
				// DON'T clear context - let it be cleared by blur/escape events like goals/interventions
			} else if (answerSearchContext && answerSearchContext.contentType === 'answer') {
				// Answer typeahead using generic endpoint with stored context pattern
				// Apply same filtering logic as original ANSWER_SEARCH_SUCCESS
				if (state.relationshipPanelOpen && state.relationshipTypeaheadLoading) {
					// This is for relationship modal - use relationship typeahead state
					updateState({
						relationshipTypeaheadResults: results,
						relationshipTypeaheadLoading: false
					});
				} else {
					// Regular answer typeahead (not in relationship modal)
					updateState({
						answerTypeaheadResults: results,
						answerTypeaheadLoading: false,
						answerTypeaheadVisible: true
					});
				}
				// DON'T clear context - let it be cleared by blur/escape events like goals/interventions/questions
			} else {
				// Default to relationship typeahead (orphaned responses with cleared context)
				// NOTE: Do NOT touch answerTypeaheadLoading here - answer might still be in flight
				updateState({
					relationshipTypeaheadResults: results,
					relationshipTypeaheadLoading: false
				});
			}
		},

		'GENERIC_TYPEAHEAD_ERROR': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;


			// Check if this was an answer duplicate check
			if (state.answerDuplicateCheckContext && state.pendingAnswersToCheck) {
				updateState({
					pendingAnswersToCheck: null,
					pendingAnswersCheckIndex: null,
					answerDuplicateCheckContext: null,
					isCheckingAnswerDuplicates: false,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Error checking answer duplicates: ${action.payload?.error || 'Unknown error'}. Continuing with save...`,
							timestamp: new Date().toISOString()
						}
					]
				});
				// Continue with save despite error
				dispatch('RESUME_SAVE_AFTER_ANSWER_CHECK', {});
				return;
			}

			// Use stored context from state instead of meta
			const goalSearchContext = state.currentGoalSearchContext;
			const interventionSearchContext = state.currentInterventionSearchContext;
			const questionSearchContext = state.currentQuestionSearchContext;
			const answerSearchContext = state.currentAnswerSearchContext;

			// Handle goal-specific error states
			if (goalSearchContext && goalSearchContext.contentType === 'goal' && goalSearchContext.problemId) {
				const problemId = goalSearchContext.problemId;
				updateState({
					goalTypeaheadResults: {
						...state.goalTypeaheadResults,
						[problemId]: []
					},
					goalTypeaheadLoading: {
						...state.goalTypeaheadLoading,
						[problemId]: false
					},
					// Clear context after use
					currentGoalSearchContext: null,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Failed to search goals: ${action.payload?.error || 'Unknown error'}`,
							timestamp: new Date().toISOString()
						}
					]
				});
			} else if (interventionSearchContext && interventionSearchContext.contentType === 'intervention' && interventionSearchContext.goalId) {
				const goalId = interventionSearchContext.goalId;
				updateState({
					interventionTypeaheadResults: {
						...state.interventionTypeaheadResults,
						[goalId]: []
					},
					interventionTypeaheadLoading: {
						...state.interventionTypeaheadLoading,
						[goalId]: false
					},
					// Clear context after use
					currentInterventionSearchContext: null,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Failed to search interventions: ${action.payload?.error || 'Unknown error'}`,
							timestamp: new Date().toISOString()
						}
					]
				});
			} else if (questionSearchContext && questionSearchContext.contentType === 'question') {
				// Question search error with stored context pattern
				updateState({
					questionTypeaheadResults: [],
					questionTypeaheadLoading: false,
					currentQuestionSearchSectionId: null,
					currentQuestionSearchContext: null, // Clear context after use
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Error searching questions: ${action.payload?.error || 'Unknown error'}`,
							timestamp: new Date().toISOString()
						}
					]
				});
			} else if (answerSearchContext && answerSearchContext.contentType === 'answer') {
				// Answer search error with stored context pattern
				updateState({
					answerTypeaheadResults: [],
					answerTypeaheadLoading: false,
					answerTypeaheadVisible: false,
					currentAnswerSearchQuestionId: null,
					currentAnswerSearchContext: null, // Clear context after use
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Error searching answers: ${action.payload?.error || 'Unknown error'}`,
							timestamp: new Date().toISOString()
						}
					]
				});
			} else {
				// Default error handler (orphaned errors with cleared context)
				// NOTE: Do NOT touch answerTypeaheadLoading here - answer might still be in flight
				updateState({
					relationshipTypeaheadResults: [],
					relationshipTypeaheadLoading: false,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Failed to search content: ${action.payload?.error || 'Unknown error'}`,
							timestamp: new Date().toISOString()
						}
					]
				});
			}
		},

'MAKE_GUIDELINE_SEARCH_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/guideline-typeahead', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GUIDELINE_SEARCH_SUCCESS',
			errorActionType: 'GUIDELINE_SEARCH_ERROR',
			metaParam: 'meta'
		}),


		'MAKE_LIBRARY_QUESTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-library-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'LIBRARY_QUESTION_SUCCESS',
			errorActionType: 'LIBRARY_QUESTION_ERROR',
			metaParam: 'meta'
		}),


		'MAKE_LIBRARY_ANSWER_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/library-answer-details', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'LIBRARY_ANSWER_SUCCESS',
			errorActionType: 'LIBRARY_ANSWER_ERROR',
			metaParam: 'meta'
		}),



		'LIBRARY_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const libraryQuestion = action.payload;
			// Check if this is a pre-save operation
					// CRITICAL: Use state-based pre-save context (HTTP effect meta doesn't work)
			const preSaveContext = state.preSaveLibraryContext;

			if (preSaveContext && preSaveContext.isPreSave && preSaveContext.questionContext) {
				// This is a pre-save library question fetch - populate question with library data and save
				const questionContext = preSaveContext.questionContext;
				const questionId = questionContext.questionId;
				const sectionId = questionContext.sectionId;

				// Transform library answers for UI display (they need ids structure and proper field names)
				const transformedAnswers = (libraryQuestion.answers || []).map((answer, index) => ({
					ids: { id: `temp_answer_${Date.now()}_${index}` },
					label: answer.text || answer.label,
					tooltip: answer.tooltip || '',
					alternative_wording: answer.alternative_wording || '',
					secondary_input_type: answer.secondary_input_type || null,
					mutually_exclusive: answer.mutually_exclusive || false,
					sort_order: answer.sort_order || index,
					isLibraryAnswer: true,
					library_id: answer.master_id || answer.id // CRITICAL: Use library_id field name for consistency
				}));

				// Update the question in UI with library data
				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: state.currentQuestions.questions.map(q => {
							if (q.ids.id === questionId) {
								return {
									...q,
									label: libraryQuestion.label,
									type: libraryQuestion.type,
									required: libraryQuestion.required || false,
									tooltip: libraryQuestion.tooltip || '',
									answers: transformedAnswers,
									isLibraryQuestion: true,
									libraryQuestionId: libraryQuestion.master_id || libraryQuestion.id,
									libraryStatus: 'unmodified'
								};
							}
							return q;
						})
					},
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'success',
							message: `Auto-populated with library question "${libraryQuestion.label}" (${libraryQuestion.answers?.length || 0} answers). Saving...`,
							timestamp: new Date().toISOString()
						}
					]
				});

				// Now save the library question with all its answers
				const questionData = {
					label: libraryQuestion.label,
					type: libraryQuestion.type,
					required: libraryQuestion.required || false,
					tooltip: libraryQuestion.tooltip || '',
					voice: libraryQuestion.voice || 'CaseManager',
					sort_order: questionContext.questionData.sort_order,
					alternative_wording: libraryQuestion.alternative_wording || '',
					custom_attributes: libraryQuestion.custom_attributes || {},
					available: libraryQuestion.available || false,
					has_quality_measures: libraryQuestion.has_quality_measures || false,
					library_id: libraryQuestion.master_id || libraryQuestion.id // CRITICAL: Use master_id (library questions use master_id, not id)
				};

				// Process library answers to mark them with library metadata
				const processedLibraryAnswers = (libraryQuestion.answers || []).map((answer, index) => ({
					label: answer.text || answer.label, // Library answers use 'text' field
					tooltip: answer.tooltip || '',
					alternative_wording: answer.alternative_wording || '',
					secondary_input_type: answer.secondary_input_type || null,
					mutually_exclusive: answer.mutually_exclusive || false,
					custom_attributes: answer.custom_attributes || {},
					required: answer.required || false,
					sort_order: answer.sort_order || index,
					isLibraryAnswer: true,
					library_id: answer.master_id || answer.id // CRITICAL: Use library_id field name for consistency
				}));

			// Clear pre-save context
			updateState({
				preSaveLibraryContext: null
			});

				// CRITICAL: Now re-dispatch SAVE_QUESTION_IMMEDIATELY which will pick up the library flags
				dispatch('SAVE_QUESTION_IMMEDIATELY', {
					questionId: questionId
				});

				return; // Exit early for pre-save operations
			}

			// Normal library question replacement (existing functionality)
			const targetQuestionId = state.pendingLibraryQuestionReplacementId;

			// Clear the typeahead and pending replacement ID
			updateState({
				questionTypeaheadLoading: false,
				questionTypeaheadText: '',
				questionTypeaheadResults: [],
				currentQuestionSearchSectionId: null,
				pendingLibraryQuestionReplacementId: null,  // Clear after use
				libraryQuestionLoading: null  // Clear loading state
			});

			// Replace the target question with the library question
			dispatch('REPLACE_QUESTION_WITH_LIBRARY', {
				targetQuestionId: targetQuestionId,
				libraryQuestion: libraryQuestion
			});
		},

		'LIBRARY_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('LIBRARY_QUESTION_ERROR:', action.payload);

			updateState({
				questionTypeaheadResults: [],
				questionTypeaheadLoading: false,
				currentQuestionSearchSectionId: null,
				libraryQuestionLoading: null,  // Clear loading state
				pendingLibraryQuestionReplacementId: null,  // Clear pending ID
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Error fetching library question: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'FETCH_LIBRARY_QUESTION_FOR_PRESAVE': (coeffects) => {
			const {action, dispatch, updateState} = coeffects;
			const {libraryQuestionId, questionContext} = action.payload;

			// CRITICAL: Store pre-save context in state (HTTP effect meta doesn't work reliably)
			updateState({
				preSaveLibraryContext: {
					isPreSave: true,
					questionContext: questionContext
				}
			});

			dispatch('MAKE_LIBRARY_QUESTION_REQUEST', {
				requestBody: JSON.stringify({questionId: libraryQuestionId})
			});
		},

		'CONTINUE_QUESTION_SAVE_AFTER_CHECK': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {questionContext} = action.payload;

			// Continue with normal save process using stored context
			const question = questionContext.questionData;
			const questionId = questionContext.questionId;
			const sectionId = questionContext.sectionId;

			// Proceed with normal save logic (same as original SAVE_QUESTION_IMMEDIATELY)
			if (question.type === 'Text' || question.type === 'Date' || question.type === 'Numeric') {
				// Step 1: Add question to section (no answers needed)
				dispatch('ADD_QUESTION_TO_SECTION_API', {
					questionData: {
						label: question.label,
						type: question.type,
						required: question.required,
						tooltip: question.tooltip || '',
						voice: question.voice || 'CaseManager',
						sort_order: question.sort_order,
						alternative_wording: '',
						custom_attributes: {},
						available: false,
						has_quality_measures: false
					},
					sectionId: sectionId
				});
			} else if (question.type === 'Single Select' || question.type === 'Multiselect') {
				const questionData = {
					label: question.label,
					type: question.type,
					required: question.required,
					tooltip: question.tooltip || '',
					voice: question.voice || 'CaseManager',
					sort_order: question.sort_order,
					alternative_wording: '',
					custom_attributes: {},
					available: false,
					has_quality_measures: false
				};

				dispatch('ADD_QUESTION_TO_SECTION_API', {
					questionData: questionData,
					sectionId: sectionId,
					// Store answers for step 2 (regular questions)
					pendingAnswers: question.answers || []
				});
			}
		},



		'LIBRARY_ANSWER_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Debug library answer structure
			const libraryAnswer = action.payload;
			const targetAnswerId = state.pendingLibraryAnswerReplacementId;

			// Clear the typeahead and pending replacement ID
			updateState({
				answerTypeaheadResults: [],
				answerTypeaheadLoading: false,
				answerTypeaheadVisible: false,
				answerTypeaheadQuery: '',
				answerTypeaheadSelectedIndex: -1,
				currentAnswerSearchQuestionId: null,
				libraryAnswerLoading: null,
				pendingLibraryAnswerReplacementId: null
			});

			// Replace the target answer with the library answer
			dispatch('REPLACE_ANSWER_WITH_LIBRARY', {
				answerId: targetAnswerId,
				libraryAnswerData: libraryAnswer
			});
		},

		'LIBRARY_ANSWER_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('LIBRARY_ANSWER_ERROR:', action.payload);

			updateState({
				answerTypeaheadResults: [],
				answerTypeaheadLoading: false,
				answerTypeaheadVisible: false,
				currentAnswerSearchQuestionId: null,
				libraryAnswerLoading: null,
				pendingLibraryAnswerReplacementId: null,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Error fetching library answer: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'ADD_LIBRARY_QUESTION_TO_SECTION': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {sectionId, libraryQuestion} = action.payload;
			if (!state.currentQuestions?.questions) {
				console.error('No current questions available');
				return;
			}

			// Generate a temporary UUID for the new question
			const newQuestionId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			const nextSortOrder = state.currentQuestions.questions.length + 1;

			// Create the question structure based on library question
			const newQuestion = {
				ids: { id: newQuestionId },
				label: libraryQuestion.label,
				required: libraryQuestion.required || false,
				type: libraryQuestion.type,
				tooltip: libraryQuestion.tooltip || '',
				alternative_wording: libraryQuestion.alternative_wording || '',
				voice: libraryQuestion.voice || 'Patient',
				sort_order: nextSortOrder,
				hidden: false,
				custom_attributes: libraryQuestion.custom_attributes || {},
				answers: [],
				// Mark as library question for proper backend handling
				isLibraryQuestion: true,
				libraryQuestionId: libraryQuestion.master_id || libraryQuestion.id
			};

			// Add all library answers if they exist
			if (libraryQuestion.answers && libraryQuestion.answers.length > 0) {
				newQuestion.answers = libraryQuestion.answers.map((libraryAnswer, index) => {
					const tempAnswerId = 'temp_answer_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 9);

					return {
						ids: { id: tempAnswerId },
						label: libraryAnswer.text,
						tooltip: libraryAnswer.tooltip || '',
						alternative_wording: libraryAnswer.alternative_wording || '',
						secondary_input_type: libraryAnswer.secondary_input_type || null,
						mutually_exclusive: libraryAnswer.mutually_exclusive || false,
						sort_order: libraryAnswer.sort_order || index,
						// Mark as library answer for proper backend handling
						isLibraryAnswer: true,
						library_id: libraryAnswer.master_id || libraryAnswer.id
					};
				});
			}

			// Add question to current questions
			const updatedQuestions = [
				...state.currentQuestions.questions,
				newQuestion
			];

			// Track the library question addition in questionChanges
			const questionChangeKey = newQuestionId;
			const questionChangeData = {
				action: 'add',
				questionId: newQuestionId,
				label: newQuestion.label,
				required: newQuestion.required,
				type: newQuestion.type,
				tooltip: newQuestion.tooltip,
				alternative_wording: newQuestion.alternative_wording,
				voice: newQuestion.voice,
				sort_order: newQuestion.sort_order,
				sectionId: sectionId,
				isLibraryQuestion: true,
				libraryQuestionId: newQuestion.libraryQuestionId,
				timestamp: new Date().toISOString()
			};

			// Track all library answers in answerChanges
			const updatedAnswerChanges = { ...state.answerChanges };
			newQuestion.answers.forEach(answer => {
				const answerChangeKey = answer.ids.id;
				updatedAnswerChanges[answerChangeKey] = {
					action: 'add',
					answerId: answer.ids.id,
					questionId: newQuestionId,
					label: answer.label,
					tooltip: answer.tooltip,
					alternative_wording: answer.alternative_wording,
					secondary_input_type: answer.secondary_input_type,
					mutually_exclusive: answer.mutually_exclusive,
					sort_order: answer.sort_order,
					isLibraryAnswer: true,
					library_id: answer.library_id,
					timestamp: new Date().toISOString()
				};
			});

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				// Track the library question change
				questionChanges: {
					...state.questionChanges,
					[questionChangeKey]: questionChangeData
				},
				// Track all library answer changes
				answerChanges: updatedAnswerChanges,
				// Add success message
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'success',
						message: `Library question "${libraryQuestion.label}" added with ${libraryQuestion.answers?.length || 0} answers. Click "Save Changes" to apply.`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'REPLACE_QUESTION_WITH_LIBRARY': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {targetQuestionId, libraryQuestion} = action.payload;
			if (!state.currentQuestions?.questions) {
				console.error('No current questions available');
				return;
			}

			// Find the target question to replace
			const questionIndex = state.currentQuestions.questions.findIndex(q => q.ids.id === targetQuestionId);
			if (questionIndex === -1) {
				console.error('Target question not found:', targetQuestionId);
				return;
			}

			const currentQuestion = state.currentQuestions.questions[questionIndex];
			// Create replacement question with library data
			const replacementQuestion = {
				ids: { id: targetQuestionId }, // Keep the same ID
				label: libraryQuestion.label || libraryQuestion.name,
				required: libraryQuestion.required || false,
				type: libraryQuestion.type || libraryQuestion.question_type || 'Single Select',
				tooltip: libraryQuestion.tooltip || '',
				alternative_wording: libraryQuestion.alternative_wording || '',
				voice: libraryQuestion.voice || 'Patient',
				sort_order: currentQuestion.sort_order, // Keep original sort order
				hidden: currentQuestion.hidden || false,
				custom_attributes: libraryQuestion.custom_attributes || {},
				answers: [],
				isLibraryQuestion: true,
				libraryQuestionId: libraryQuestion.master_id || libraryQuestion.id,
				isUnsaved: true // Show save button for library questions
			};

			// Add library answers if they exist
			if (libraryQuestion.answers && libraryQuestion.answers.length > 0) {
				replacementQuestion.answers = libraryQuestion.answers.map((libraryAnswer, index) => {
					const tempAnswerId = 'temp_answer_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 9);

					return {
						ids: { id: tempAnswerId },
						label: libraryAnswer.text || libraryAnswer.label,
						tooltip: libraryAnswer.tooltip || '',
						alternative_wording: libraryAnswer.alternative_wording || '',
						secondary_input_type: libraryAnswer.secondary_input_type || null,
						mutually_exclusive: libraryAnswer.mutually_exclusive || false,
						sort_order: libraryAnswer.sort_order || (index + 1),
						triggered_questions: [],
						isLibraryAnswer: true,
						library_id: libraryAnswer.master_id || libraryAnswer.id
					};
				});
			}

			// Update the questions array
			const updatedQuestions = [...state.currentQuestions.questions];
			updatedQuestions[questionIndex] = replacementQuestion;

			// Update question changes tracking with library question status
			const questionChangeKey = targetQuestionId;
			const updatedQuestionChanges = {
				...state.questionChanges,
				[questionChangeKey]: {
					action: 'library_replace',  // Special action for library replacement
					questionId: targetQuestionId,
					type: replacementQuestion.type,
					label: replacementQuestion.label,
					required: replacementQuestion.required,
					tooltip: replacementQuestion.tooltip,
					alternative_wording: replacementQuestion.alternative_wording,
					voice: replacementQuestion.voice,
					sort_order: replacementQuestion.sort_order,
					isLibraryQuestion: true,
					libraryQuestionId: replacementQuestion.libraryQuestionId,
					libraryStatus: 'unmodified',  // Track modification status
					originalLibraryData: {  // Store original library data for comparison
						label: libraryQuestion.label || libraryQuestion.name,
						type: libraryQuestion.type,
						required: libraryQuestion.required || false,
						tooltip: libraryQuestion.tooltip || '',
						alternative_wording: libraryQuestion.alternative_wording || '',
						voice: libraryQuestion.voice || 'Patient'
					},
					timestamp: new Date().toISOString()
				}
			};

			// Track all library answers in answerChanges
			const updatedAnswerChanges = { ...state.answerChanges };
			replacementQuestion.answers.forEach((answer, index) => {
				const answerChangeKey = answer.ids.id;
				const originalLibraryAnswer = libraryQuestion.answers[index];
				updatedAnswerChanges[answerChangeKey] = {
					action: 'library_add',  // Special action for library answers
					answerId: answer.ids.id,
					questionId: targetQuestionId,
					label: answer.label,
					tooltip: answer.tooltip,
					alternative_wording: answer.alternative_wording,
					secondary_input_type: answer.secondary_input_type,
					mutually_exclusive: answer.mutually_exclusive,
					sort_order: answer.sort_order,
					isLibraryAnswer: true,
					library_id: answer.library_id,
					libraryStatus: 'unmodified',  // Track modification status
					originalLibraryData: {  // Store original library answer data
						label: originalLibraryAnswer.text || originalLibraryAnswer.label,
						tooltip: originalLibraryAnswer.tooltip || '',
						alternative_wording: originalLibraryAnswer.alternative_wording || '',
						secondary_input_type: originalLibraryAnswer.secondary_input_type || null,
						mutually_exclusive: originalLibraryAnswer.mutually_exclusive || false,
						sort_order: originalLibraryAnswer.sort_order || (index + 1)
					},
					library_id: answer.library_id,
					timestamp: new Date().toISOString()
				};
			});

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				questionChanges: updatedQuestionChanges,
				answerChanges: updatedAnswerChanges,
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'success',
						message: `Question replaced with library question "${replacementQuestion.label}" (${replacementQuestion.answers.length} answers). Click "Save Changes" to apply.`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'GUIDELINE_SEARCH_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const results = action.payload.results || [];
			// Try different ways to access the answerId, including from state
			const answerId = action.meta?.answerId || action.payload.meta?.answerId || action.answerId || state.currentGuidelineSearchAnswerId;
			// Filter out guidelines that are already added to this answer
			let filteredResults = results;
			if (answerId && state.answerRelationships[answerId]) {
				// Check if guidelines exist in the relationship data
				const relationshipData = state.answerRelationships[answerId];
				// Look for guidelines in different possible locations
				let existingGuidelineIds = [];
				
				if (relationshipData.guidelines?.guidelines) {
					existingGuidelineIds = relationshipData.guidelines.guidelines.map(g => g.id);
				} else {
				}
				
				if (existingGuidelineIds.length > 0) {
					filteredResults = results.filter(guideline => {
						const notAlreadyAdded = !existingGuidelineIds.includes(guideline.id);
						if (!notAlreadyAdded) {
						} else {
						}
						return notAlreadyAdded;
					});
				}
			}

			// Also filter out the current assessment itself
			const currentAssessmentId = state.currentAssessmentId;
			if (currentAssessmentId) {
				const beforeCurrentFilter = filteredResults.length;
				filteredResults = filteredResults.filter(guideline => {
					const isCurrentAssessment = guideline.id === currentAssessmentId;
					if (isCurrentAssessment) {
					}
					return !isCurrentAssessment;
				});
			}
			filteredResults.forEach((guideline, index) => {
			});

			updateState({
				relationshipTypeaheadResults: filteredResults,
				relationshipTypeaheadLoading: false
				// Keep currentGuidelineSearchAnswerId for subsequent searches
			});
			
			// Position dropdown with fixed positioning to avoid clipping
			const positionDropdown = () => {
				// Find any active typeahead input
				const activeInput = document.querySelector('.relationship-typeahead-input:focus') || 
				                   document.querySelector('.typeahead-container:hover .relationship-typeahead-input') ||
				                   document.querySelector('.typeahead-container .relationship-typeahead-input');
				
				if (activeInput) {
					const rect = activeInput.getBoundingClientRect();
					const dropdown = activeInput.parentElement.querySelector('.typeahead-dropdown');
					
					if (dropdown && rect) {
						// Use fixed positioning with exact coordinates
						dropdown.style.position = 'fixed';
						dropdown.style.top = (rect.bottom) + 'px';
						dropdown.style.left = rect.left + 'px';
						dropdown.style.width = rect.width + 'px';
						dropdown.style.zIndex = '999999';
						
						// Check if there's enough space below
						const spaceBelow = window.innerHeight - rect.bottom;
						const dropdownHeight = 200;
						
						if (spaceBelow < dropdownHeight && rect.top > dropdownHeight) {
							// Position above input instead
							dropdown.style.top = (rect.top - dropdownHeight) + 'px';
							dropdown.style.borderRadius = '6px 6px 0 0';
						} else {
							dropdown.style.borderRadius = '0 0 6px 6px';
						}
					}
				}
			};
			
			// Position immediately and also after a short delay
			setTimeout(positionDropdown, 10);
			setTimeout(positionDropdown, 100);
		},
		'GUIDELINE_SEARCH_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Error payload:', action.payload);
			console.error('Error payload type:', typeof action.payload);
			console.error('Error payload keys:', action.payload ? Object.keys(action.payload) : 'payload is null');
			console.error('Full error action:', action);
			console.error('Error status:', action.payload ? action.payload.status : 'no status');
			console.error('Error message:', action.payload ? action.payload.data : 'no data');
			
			updateState({
				relationshipTypeaheadResults: [],
				relationshipTypeaheadLoading: false,
				currentGuidelineSearchAnswerId: null, // Clear on error
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to search guidelines: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},
'GUIDELINE_TYPEAHEAD_HIDE': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				relationshipTypeaheadResults: [],
				currentGuidelineSearchAnswerId: null
			});
		},

		'QUESTION_TYPEAHEAD_INPUT': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {text, sectionId, answerId} = action.payload;
			if (answerId) {
				// Relationship modal context
				updateState({
					relationshipTypeaheadText: text,
					selectedQuestion: null // Clear any selected question
				});

				// Only search after 3 characters
				if (text && text.length >= 2) {
					// Get current section questions
					const allQuestions = state.currentQuestions?.questions || [];
					// Find the current question (the one this answer belongs to)
					const currentQuestion = allQuestions.find(q =>
						q.answers?.some(a => a.ids.id === answerId)
					);
					const currentQuestionId = currentQuestion?.ids?.id;
					// Get existing triggered questions for this answer
					const existingQuestionIds = state.answerRelationships[answerId]?.questions?.questions?.map(q => q.id) || [];
					// Filter questions: match search text, exclude current question, exclude existing relationships, only higher sort order
					const filteredQuestions = allQuestions.filter(question => {
						// Must contain search text (case insensitive)
						const matchesSearch = question.label?.toLowerCase().includes(text.toLowerCase());

						// Exclude current question
						const isCurrentQuestion = question.ids.id === currentQuestionId;

						// Exclude existing triggered questions
						const isExistingTriggered = existingQuestionIds.includes(question.ids.id);

						// Only allow questions with higher sort order (triggered questions must come after current question)
						const hasHigherSortOrder = question.sort_order > (currentQuestion?.sort_order || 0);
						return matchesSearch && !isCurrentQuestion && !isExistingTriggered && hasHigherSortOrder;
					});
					updateState({
						relationshipTypeaheadResults: filteredQuestions,
						relationshipTypeaheadLoading: false
					});
				} else {
					updateState({
						relationshipTypeaheadResults: []
					});
				}
			} else {
				// Inline editing context - use existing logic
				updateState({
					questionTypeaheadText: text,
					currentQuestionSearchSectionId: sectionId
				});

				// Only search after 3 characters
				if (text && text.length >= 2) {
					dispatch('SEARCH_QUESTIONS', {
						searchText: text,
						sectionId: sectionId
					});
				} else {
					updateState({
						questionTypeaheadResults: []
					});
				}
			}
		},

		'SEARCH_QUESTIONS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {searchText, sectionId} = action.payload;
			const requestBody = JSON.stringify({
				searchText: searchText,
				contentType: 'question'
			});

			// Use same pattern as goals/interventions for reliable context storage
			const questionSearchContext = {
				contentType: 'question',
				sectionId: sectionId,
				searchText: searchText
			};

			updateState({
				questionTypeaheadLoading: true,
				currentQuestionSearchSectionId: sectionId,
				currentQuestionSearchContext: questionSearchContext  // Store context like goals/interventions
			});
			dispatch('MAKE_GENERIC_TYPEAHEAD_REQUEST', {
				requestBody: requestBody,
				meta: {
					searchText: searchText,
					contentType: 'question',
					sectionId: sectionId
				}
			});
		},

		'QUESTION_TYPEAHEAD_INPUT_CHANGE': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {searchText, questionId} = action.payload;

			if (questionId) {
				// Inline editing context - use existing logic
				// Clear existing timeout
				if (state.questionTypeaheadDebounceTimeout) {
					clearTimeout(state.questionTypeaheadDebounceTimeout);
				}

				// Set up debounced search
				const timeout = setTimeout(() => {
					dispatch('SEARCH_QUESTIONS', {
						searchText: searchText
					});
				}, 300);

				updateState({
					questionTypeaheadQuery: searchText,
					questionTypeaheadVisible: true,
					questionTypeaheadSelectedIndex: -1,
					questionTypeaheadDebounceTimeout: timeout,
					editingQuestionId: questionId
				});
			} else {
				// Relationship modal context - use different search action
				dispatch('RELATIONSHIP_QUESTION_SEARCH', {
					searchText: searchText,
					answerId: state.relationshipModalAnswerId
				});
			}
		},

		'RELATIONSHIP_QUESTION_SEARCH': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {searchText, answerId} = action.payload;
			if (searchText.length >= 2) {
				// Start loading state
				updateState({
					relationshipTypeaheadLoading: true
				});

				// Use the existing question search endpoint
				dispatch('SEARCH_QUESTIONS', {
					searchText: searchText
				});
			} else {
				updateState({
					relationshipTypeaheadResults: []
				});
			}
		},

		'QUESTION_TYPEAHEAD_HIDE': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				questionTypeaheadVisible: false,
				questionTypeaheadResults: [],
				questionTypeaheadSelectedIndex: -1,
				editingQuestionId: null,
				questionTypeaheadLoading: false,
				currentQuestionSearchContext: null,  // CRITICAL: Must clear context like answer typeahead
				currentQuestionSearchSectionId: null
			});
		},

		'QUESTION_TYPEAHEAD_KEYBOARD': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {key} = action.payload;

			if (key === 'ArrowDown') {
				const newIndex = state.questionTypeaheadSelectedIndex < state.questionTypeaheadResults.length - 1
					? state.questionTypeaheadSelectedIndex + 1
					: 0;
				updateState({
					questionTypeaheadSelectedIndex: newIndex
				});
			} else if (key === 'ArrowUp') {
				const newIndex = state.questionTypeaheadSelectedIndex > 0
					? state.questionTypeaheadSelectedIndex - 1
					: state.questionTypeaheadResults.length - 1;
				updateState({
					questionTypeaheadSelectedIndex: newIndex
				});
			} else if (key === 'Enter' && state.questionTypeaheadSelectedIndex >= 0) {
				const selectedResult = state.questionTypeaheadResults[state.questionTypeaheadSelectedIndex];
				if (selectedResult) {
					dispatch('SELECT_LIBRARY_QUESTION', {
						questionId: state.editingQuestionId,
						libraryQuestion: selectedResult
					});
				}
			}
		},

		'SELECT_LIBRARY_QUESTION': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {questionId, libraryQuestion} = action.payload;
			// Hide typeahead dropdown but keep question visible during fetch
			updateState({
				questionTypeaheadVisible: false,
				questionTypeaheadResults: [],
				questionTypeaheadSelectedIndex: -1,
				pendingLibraryQuestionReplacementId: questionId,  // Store for later use
				libraryQuestionLoading: questionId  // Show loading state on specific question
			});

			// Fetch the full library question details including answers
			dispatch('FETCH_LIBRARY_QUESTION', {
				libraryQuestionId: libraryQuestion.id,
				targetQuestionId: questionId
			});
		},

		'FETCH_LIBRARY_QUESTION': (coeffects) => {
			const {action, updateState, dispatch} = coeffects;
			const {libraryQuestionId, targetQuestionId} = action.payload;
			const requestBody = JSON.stringify({
				questionId: libraryQuestionId
			});

			updateState({
				questionTypeaheadLoading: true
			});
			dispatch('MAKE_LIBRARY_QUESTION_REQUEST', {
				requestBody: requestBody,
				meta: {
					targetQuestionId: targetQuestionId
				}
			});
		},

		'SELECT_RELATIONSHIP_GUIDELINE': (coeffects) => {
			const {action, updateState} = coeffects;
			const {answerId, guidelineId, guidelineName, guidelineMasterId, guidelineCategory} = action.payload;
			updateState({
				selectedRelationshipQuestion: {
					id: guidelineId,
					master_id: guidelineMasterId,
					label: guidelineName,
					category: guidelineCategory
				},
				relationshipTypeaheadText: guidelineCategory ? `${guidelineName} - ${guidelineCategory}` : guidelineName,
				relationshipTypeaheadResults: [] // Hide dropdown
			});
		},

		'CONFIRM_ADD_RELATIONSHIP': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {answerId} = action.payload;
			// Get the selected question/guideline details
			const selectedItem = state.selectedRelationshipQuestion;
			const relationshipType = state.selectedRelationshipType;

			if (!selectedItem || !relationshipType) {
				console.error('No relationship item or type selected to confirm');
				updateState({
					systemMessages: [
					...(state.systemMessages || []),

						{
							type: 'error',
							message: 'Error: No relationship selected to confirm',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}
			// Use master_id for guidelines, id for questions
			const targetId = relationshipType === 'guideline' ? selectedItem.master_id : selectedItem.id;

			// Generate a unique key for this relationship change
			const relationshipKey = `${answerId}_${relationshipType}_${targetId}`;
			// AUTO-SAVE: For guidelines, immediately dispatch the save action instead of queuing
			if (relationshipType === 'guideline') {
				dispatch('ADD_GUIDELINE_RELATIONSHIP', {
					answerId: answerId,
					guidelineId: targetId,
					guidelineName: selectedItem.label
				});

				// Clear the relationship UI
				updateState({
					addingRelationship: null,
					selectedRelationshipType: null,
					relationshipTypeaheadText: '',
					relationshipTypeaheadResults: [],
					selectedRelationshipQuestion: null
				});

				return; // Exit early for guidelines - ADD_GUIDELINE_RELATIONSHIP handles the rest
			}

			// AUTO-SAVE: For questions, immediately dispatch the save action instead of queuing
			if (relationshipType === 'question') {
				dispatch('ADD_BRANCH_QUESTION', {
					answerId: answerId,
					questionId: targetId,
					questionLabel: selectedItem.label
				});

				// Clear the relationship UI
				updateState({
					addingRelationship: null,
					selectedRelationshipType: null,
					relationshipTypeaheadText: '',
					relationshipTypeaheadResults: [],
					selectedRelationshipQuestion: null
				});

				return; // Exit early for questions - ADD_BRANCH_QUESTION handles the rest
			}
		},
		'REMOVE_TRIGGERED_QUESTION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {answerId, questionId, questionLabel} = action.payload;

			// Add immediate system message to show the action was triggered
			const immediateMessage = {
				type: 'info',
				message: `Deleting triggered question "${questionLabel}"... Please wait.`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					immediateMessage
				],
				// ALSO add to modal system messages if relationship panel is open
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					immediateMessage
				] : state.modalSystemMessages
			});

			// AUTO-SAVE: Immediately delete the triggered question like we do for adding
			dispatch('DELETE_BRANCH_QUESTION', {
				answerId: answerId,
				questionId: questionId,
				questionLabel: questionLabel
			});
		},

		'REMOVE_GUIDELINE_RELATIONSHIP': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {answerId, guidelineId, guidelineName} = action.payload;

			// Set loading state
			updateState({
				savingGuidelineRelationship: true
			});

			// Call backend API to delete guideline relationship immediately (like DELETE_BRANCH_QUESTION)
			const requestBody = JSON.stringify({
				answerId: answerId,
				guidelineId: guidelineId,
				guidelineName: guidelineName
			});
			dispatch('MAKE_DELETE_GUIDELINE_RELATIONSHIP_REQUEST', {
				requestBody: requestBody,
				meta: {
					answerId: answerId,
					guidelineId: guidelineId,
					guidelineName: guidelineName
				}
			});
		},

		'ADD_BRANCH_QUESTION': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {answerId, questionId, questionLabel} = action.payload;

			// Set loading state
			updateState({
				savingQuestionRelationship: true
			});

			const requestBody = JSON.stringify({
				answerId: answerId,
				questionId: questionId
			});

			// Show system message about auto-save
			const savingMessage = {
				type: 'info',
				message: 'Saving triggered question relationship to backend...',
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), savingMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					savingMessage
				] : state.modalSystemMessages
			});

			dispatch('MAKE_ADD_BRANCH_QUESTION_REQUEST', {
				requestBody: requestBody,
				meta: {
					answerId: answerId,
					questionId: questionId,
					questionLabel: questionLabel
				}
			});
		},

		'ADD_GUIDELINE_RELATIONSHIP': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, guidelineId, guidelineName} = action.payload;

			// Set loading state
			updateState({
				savingGuidelineRelationship: true
			});

			// AUTO-SAVE: Immediately call API like sections do
			const requestBody = JSON.stringify({
				answerId: answerId,
				guidelineId: guidelineId
			});
			dispatch('MAKE_ADD_GUIDELINE_RELATIONSHIP_REQUEST', {
				requestBody: requestBody,
				meta: {
					answerId: answerId,
					guidelineId: guidelineId,
					guidelineName: guidelineName
				}
			});

			// Show system message about auto-save
			const savingMessage = {
				type: 'info',
				message: 'Saving guideline relationship to backend...',
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), savingMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					savingMessage
				] : state.modalSystemMessages
			});
		},

		'ADD_BARRIER_RELATIONSHIP': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, barrierId, barrierName, barrierMasterId} = action.payload;
			// Calculate sort_order based on existing barriers
			const existingBarriers = state.answerRelationships?.[answerId]?.barriers?.barriers || [];
			const sortOrder = existingBarriers.length + 1;

			// Set loading state
			updateState({
				savingBarrierRelationship: true
			});

			// AUTO-SAVE: Immediately call API
			const requestBody = JSON.stringify({
				answerId: answerId,
				barrierName: barrierName,
				barrierId: barrierId, // Will be used as library_id in backend if exists
				sortOrder: sortOrder,
				guidelineTemplateId: state.currentAssessmentId
			});
			dispatch('MAKE_ADD_BARRIER_RELATIONSHIP_REQUEST', {
				requestBody: requestBody
			});

			// Show system message about auto-save
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Saving barrier relationship to backend...',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CREATE_NEW_BARRIER': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, barrierName} = action.payload;
			// Show saving message
			const savingMessage = {
				type: 'info',
				message: `Creating new barrier "${barrierName}"...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), savingMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					savingMessage
				] : state.modalSystemMessages
			});

			// Clear input immediately for better UX
			updateState({
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedBarrierData: null
			});

			// ALWAYS do pre-save typeahead check for exact matches to prevent duplicates
			// Store original save data for after the check
			updateState({
				pendingBarrierSave: {
					answerId: answerId,
					barrierName: barrierName
				},
				// Store pre-save context separately from UI context to prevent clearing
				preSaveBarrierContext: {
					contentType: 'barrier',
					answerId: answerId,
					searchText: barrierName,
					isPreSaveCheck: true
				}
			});

			// Search for exact matches using generic typeahead
			dispatch('GENERIC_TYPEAHEAD_SEARCH', {
				searchText: barrierName,
				type: 'barrier',
				answerId: answerId,
				isPreSaveCheck: true  // Flag to identify this as pre-save check
			});
		},

		'CREATE_NEW_BARRIER_AFTER_CHECK': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, barrierName} = action.payload;
			// Calculate sort_order based on existing barriers
			const existingBarriers = state.answerRelationships?.[answerId]?.barriers?.barriers || [];
			const sortOrder = existingBarriers.length + 1;

			// Prepare request body for barrier creation
			const requestBody = JSON.stringify({
				answerId: answerId,
				barrierName: barrierName,
				sortOrder: sortOrder,
				guidelineTemplateId: state.currentAssessmentId
				// No barrierId means create new barrier (no library_id in payload)
			});
			dispatch('MAKE_ADD_BARRIER_RELATIONSHIP_REQUEST', {
				requestBody: requestBody
			});

			// Show system message about creating new barrier
			const creatingMessage = {
				type: 'info',
				message: 'Creating new barrier and saving to backend...',
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), creatingMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					creatingMessage
				] : state.modalSystemMessages
			});
		},

		'ADD_PROBLEM_RELATIONSHIP': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, problemId, problemName, problemMasterId} = action.payload;

			// Validate problem name is not blank
			if (!problemName || problemName.trim() === '') {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Problem text cannot be blank. Please enter a problem name.',
							timestamp: new Date().toISOString()
						}
					],
					modalSystemMessages: state.relationshipPanelOpen ? [
						...(state.modalSystemMessages || []),
						{
							type: 'error',
							message: 'Problem text cannot be blank. Please enter a problem name.',
							timestamp: new Date().toISOString()
						}
					] : state.modalSystemMessages
				});
				return;
			}

			// Set loading state
			updateState({
				savingProblem: true
			});

			// Calculate sort_order based on existing problems
			const existingProblems = state.answerRelationships?.[answerId]?.problems?.problems || [];
			const sortOrder = existingProblems.length + 1;

			// AUTO-SAVE: Immediately call API with library problemId
			const requestBody = JSON.stringify({
				answerId: answerId,
				problemName: problemName,
				problemId: problemId, // Include for existing library problems
				sortOrder: sortOrder,
				guidelineTemplateId: state.currentAssessmentId
			});
			dispatch('MAKE_ADD_PROBLEM_RELATIONSHIP_REQUEST', {
				requestBody: requestBody
			});

			// Show system message about auto-save
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Saving problem relationship to backend...',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CREATE_NEW_PROBLEM': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, problemName} = action.payload;

			// Set loading state
			updateState({
				savingProblem: true
			});

			// Show saving message
			const savingMessage = {
				type: 'info',
				message: `Creating new problem "${problemName}"...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), savingMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					savingMessage
				] : state.modalSystemMessages
			});

			// Clear input immediately for better UX
			updateState({
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedProblemData: null
			});

			// ALWAYS do pre-save typeahead check for exact matches to prevent duplicates
			// Store original save data for after the check
			updateState({
				pendingProblemSave: {
					answerId: answerId,
					problemName: problemName
				},
				// Store pre-save context separately from UI context to prevent clearing
				preSaveProblemContext: {
					contentType: 'problem',
					answerId: answerId,
					searchText: problemName,
					isPreSaveCheck: true
				}
			});

			// Search for exact matches using generic typeahead
			dispatch('GENERIC_TYPEAHEAD_SEARCH', {
				searchText: problemName,
				type: 'problem',
				answerId: answerId,
				isPreSaveCheck: true  // Flag to identify this as pre-save check
			});
		},

		'CREATE_NEW_PROBLEM_AFTER_CHECK': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, problemName} = action.payload;

			// Ensure loading state is set (may already be set from CREATE_NEW_PROBLEM)
			updateState({
				savingProblem: true
			});

			// Calculate sort_order based on existing problems
			const existingProblems = state.answerRelationships?.[answerId]?.problems?.problems || [];
			const sortOrder = existingProblems.length + 1;

			// Prepare request body for problem creation
			const requestBody = JSON.stringify({
				answerId: answerId,
				problemName: problemName,
				sortOrder: sortOrder,
				guidelineTemplateId: state.currentAssessmentId
				// No problemId means create new problem (no library_id in payload)
			});
			dispatch('MAKE_ADD_PROBLEM_RELATIONSHIP_REQUEST', {
				requestBody: requestBody
			});

			// Show system message about creating new problem
			const creatingMessage = {
				type: 'info',
				message: 'Creating new problem and saving to backend...',
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), creatingMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					creatingMessage
				] : state.modalSystemMessages
			});
		},

		'GET_GOAL_DETAILS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {goalId, problemId} = action.payload;
			// Show loading state for the specific goal and store problem ID
			updateState({
				editingGoalId: goalId,
				editingGoalData: null, // Clear previous data while loading
				goalDetailsLoading: goalId,
				editingGoalProblemId: problemId // Store the problem ID for later use
			});

			// Store fallback data in case the API call fails
			const fallbackData = {
				label: `Goal ${goalId}`,
				alternative_wording: '',
				tooltip: ''
			};

			// Store fallback data in case the API call fails
			updateState({
				goalDetailsFallback: fallbackData
			});

			const requestBody = JSON.stringify({
				goalId: goalId
			});

			dispatch('MAKE_GET_GOAL_DETAILS_REQUEST', {
				requestBody: requestBody
			});
		},

		'GET_GOAL_DETAILS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			// Clear loading state
			updateState({
				goalDetailsLoading: null
			});

			// Check if we got valid goal data
			if (action.payload && (action.payload.label || action.payload.name)) {
				// Use the detailed data from the API
				updateState({
					editingGoalData: {
						label: action.payload.label || action.payload.name || '',
						alternative_wording: action.payload.alternative_wording || '',
						tooltip: action.payload.tooltip || '',
						custom_attributes: action.payload.custom_attributes || {}
					}
				});
			} else {
				// Fallback to cached data if API didn't return proper details
				const fallbackData = state.goalDetailsFallback || {
					label: '',
					alternative_wording: '',
					tooltip: '',
					custom_attributes: {}
				};
				updateState({
					editingGoalData: {
						...fallbackData,
						custom_attributes: fallbackData.custom_attributes || {}
					}
				});
			}

			// Clear fallback data
			updateState({
				goalDetailsFallback: null
			});
		},

		'GET_GOAL_DETAILS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('GET_GOAL_DETAILS_ERROR:', action.payload);

			// Clear loading state and use fallback data
			updateState({
				goalDetailsLoading: null,
				editingGoalData: state.goalDetailsFallback || {
					label: '',
					alternative_wording: '',
					tooltip: ''
				},
				goalDetailsFallback: null,
				systemMessages: [...(state.systemMessages || []), {
					type: 'warning',
					message: 'Could not load full goal details. Using basic information for editing.',
					timestamp: new Date().toISOString()
				}],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					{
						type: 'warning',
						message: 'Could not load full goal details. Using basic information for editing.',
						timestamp: new Date().toISOString()
					}
				] : state.modalSystemMessages
			});
		},

		'SAVE_GOAL_EDITS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {goalId, goalData} = action.payload;

			// Validate goal label is not blank
			if (!goalData.label || goalData.label.trim() === '') {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Goal text cannot be blank. Please enter goal text.',
							timestamp: new Date().toISOString()
						}
					],
					modalSystemMessages: state.relationshipPanelOpen ? [
						...(state.modalSystemMessages || []),
						{
							type: 'error',
							message: 'Goal text cannot be blank. Please enter goal text.',
							timestamp: new Date().toISOString()
						}
					] : state.modalSystemMessages
				});
				return; // Don't clear editing state - keep save/cancel buttons
			}

			// Store problem ID before clearing it
			const problemId = state.editingGoalProblemId;

			// Clear editing state and show system message, but store problem ID for success handler
			updateState({
				editingGoalId: null,
				editingGoalData: null,
				editingGoalProblemId: null,
				lastEditedGoalProblemId: problemId, // Store for success handler
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Saving goal changes to backend...',
						timestamp: new Date().toISOString()
					}
				],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					{
						type: 'info',
						message: 'Saving goal changes to backend...',
						timestamp: new Date().toISOString()
					}
				] : state.modalSystemMessages
			});

			// Prepare request body for goal update
			const requestBody = JSON.stringify({
				goalId: goalId,
				label: goalData.label,
				tooltip: goalData.tooltip || '',
				alternative_wording: goalData.alternative_wording || '',
				required: goalData.required || false,
				custom_attributes: goalData.custom_attributes || {}
			});

			dispatch('MAKE_UPDATE_GOAL_REQUEST', {
				requestBody: requestBody,
				meta: {
					problemId: problemId
				}
			});
		},

		'UPDATE_GOAL_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Handle 204 No Content response (null/empty payload is expected and indicates success)
			if (action.payload === null || action.payload === undefined) {
				const successMessage = {
					type: 'success',
					message: 'Goal updated successfully! Refreshing data...',
					timestamp: new Date().toISOString()
				};

				updateState({
					systemMessages: [...(state.systemMessages || []), successMessage],
					modalSystemMessages: state.relationshipPanelOpen ? [
						...(state.modalSystemMessages || []),
						successMessage
					] : state.modalSystemMessages
				});

				// Refresh just the goals for the specific problem using stored ID
				const problemId = state.lastEditedGoalProblemId;
				if (problemId && state.currentAssessmentId) {
					// Clear the stored problem ID and refresh goals
					updateState({
						lastEditedGoalProblemId: null
					});

					dispatch('LOAD_PROBLEM_GOALS', {
						problemId: problemId,
						guidelineTemplateId: state.currentAssessmentId
					});
				} else {
				}
				return;
			}

			// Check if the response contains an error
			if (action.payload?.error) {
				console.error('API returned error in success response:', action.payload.error);
				const errorMessage = {
					type: 'error',
					message: `Failed to save goal edits: ${action.payload.error}`,
					timestamp: new Date().toISOString()
				};

				updateState({
					systemMessages: [...(state.systemMessages || []), errorMessage],
					modalSystemMessages: state.relationshipPanelOpen ? [
						...(state.modalSystemMessages || []),
						errorMessage
					] : state.modalSystemMessages
				});
				return;
			}

			const successMessage = {
				type: 'success',
				message: 'Goal updated successfully! Refreshing data...',
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), successMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages
			});

			// Refresh the modal answer relationships to show updated data
			if (state.relationshipModalAnswerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: state.relationshipModalAnswerId
				});
			}
		},

		'UPDATE_GOAL_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('UPDATE_GOAL_ERROR:', action.payload);

			const errorMessage = {
				type: 'error',
				message: `Failed to update goal: ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		// Intervention editing action handlers (same pattern as goals)
		'GET_INTERVENTION_DETAILS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {interventionId, goalId} = action.payload;
			// Show loading state for the specific intervention and store goal ID
			updateState({
				editingInterventionId: interventionId,
				editingInterventionData: null, // Clear previous data while loading
				interventionDetailsLoading: interventionId,
				editingInterventionGoalId: goalId // Store the goal ID for later use
			});

			// Store fallback data in case the API call fails
			const fallbackData = {
				label: `Intervention ${interventionId}`,
				alternative_wording: '',
				tooltip: '',
				category: 'assist'
			};

			// Store fallback data in case the API call fails
			updateState({
				interventionDetailsFallback: fallbackData
			});

			// Prepare the request body for the API call
			const requestBody = JSON.stringify({
				interventionId: interventionId
			});
			// Make the API call
			dispatch('MAKE_GET_INTERVENTION_DETAILS_REQUEST', {
				requestBody: requestBody
			});
		},

		'GET_INTERVENTION_DETAILS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			// Clear loading state
			updateState({
				interventionDetailsLoading: null
			});

			// Check if we got valid intervention data
			if (action.payload && (action.payload.label || action.payload.name)) {
				// Use the detailed data from the API
				updateState({
					editingInterventionData: {
						label: action.payload.label || action.payload.name || '',
						alternative_wording: action.payload.alternative_wording || '',
						tooltip: action.payload.tooltip || '',
						category: action.payload.category || 'assist',
						custom_attributes: action.payload.custom_attributes || {}
					}
				});
			} else {
				// Fallback to cached data if API didn't return proper details
				const fallbackData = state.interventionDetailsFallback || {
					label: '',
					alternative_wording: '',
					tooltip: '',
					category: 'assist',
					custom_attributes: {}
				};
				updateState({
					editingInterventionData: {
						...fallbackData,
						custom_attributes: fallbackData.custom_attributes || {}
					},
					interventionDetailsFallback: null
				});
			}
		},

		'GET_INTERVENTION_DETAILS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('GET_INTERVENTION_DETAILS_ERROR:', action.payload);

			// Clear loading state and use fallback data
			updateState({
				interventionDetailsLoading: null,
				editingInterventionData: state.interventionDetailsFallback || {
					label: '',
					alternative_wording: '',
					tooltip: '',
					category: 'assist'
				},
				interventionDetailsFallback: null,
				systemMessages: [...(state.systemMessages || []), {
					type: 'warning',
					message: 'Could not load full intervention details. Using basic information for editing.',
					timestamp: new Date().toISOString()
				}],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					{
						type: 'warning',
						message: 'Could not load full intervention details. Using basic information for editing.',
						timestamp: new Date().toISOString()
					}
				] : state.modalSystemMessages
			});
		},

		'SAVE_INTERVENTION_EDITS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {interventionId, interventionData} = action.payload;

			// Validate intervention label is not blank
			if (!interventionData.label || interventionData.label.trim() === '') {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Intervention text cannot be blank. Please enter intervention text.',
							timestamp: new Date().toISOString()
						}
					],
					modalSystemMessages: state.relationshipPanelOpen ? [
						...(state.modalSystemMessages || []),
						{
							type: 'error',
							message: 'Intervention text cannot be blank. Please enter intervention text.',
							timestamp: new Date().toISOString()
						}
					] : state.modalSystemMessages
				});
				return; // Don't clear editing state - keep save/cancel buttons
			}

			// Store goal ID before clearing it
			const goalId = state.editingInterventionGoalId;

			// Clear editing state and show system message, but store goal ID for success handler
			updateState({
				editingInterventionId: null,
				editingInterventionData: null,
				editingInterventionGoalId: null,
				lastEditedInterventionGoalId: goalId, // Store for success handler
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Saving intervention changes to backend...',
						timestamp: new Date().toISOString()
					}
				],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					{
						type: 'info',
						message: 'Saving intervention changes to backend...',
						timestamp: new Date().toISOString()
					}
				] : state.modalSystemMessages
			});

			// Prepare the request body for the update
			const requestBody = JSON.stringify({
				interventionId: interventionId,
				label: interventionData.label,
				alternative_wording: interventionData.alternative_wording,
				tooltip: interventionData.tooltip,
				category: interventionData.category,
				custom_attributes: interventionData.custom_attributes || {},
				goal_id: goalId
			});
			// Make the API call
			dispatch('MAKE_UPDATE_INTERVENTION_REQUEST', {
				requestBody: requestBody,
				meta: {goalId: goalId} // Pass goalId for success handler
			});
		},

		'UPDATE_INTERVENTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Extract goal ID from stored state (using working pattern from goals)
			const goalId = state.lastEditedInterventionGoalId;

			if (goalId && state.currentAssessmentId) {
				updateState({ lastEditedInterventionGoalId: null }); // Clear after use
				dispatch('LOAD_GOAL_INTERVENTIONS', {
					goalId: goalId,
					guidelineTemplateId: state.currentAssessmentId
				});
			}

			// Show success message
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Intervention updated successfully! Refreshing data...',
						timestamp: new Date().toISOString()
					}
				],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					{
						type: 'success',
						message: 'Intervention updated successfully! Refreshing data...',
						timestamp: new Date().toISOString()
					}
				] : state.modalSystemMessages
			});
		},

		'UPDATE_INTERVENTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('UPDATE_INTERVENTION_ERROR:', action.payload);

			const errorMessage = {
				type: 'error',
				message: `Failed to update intervention: ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessage],
				modalSystemMessages: state.relationshipPanelOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'ADD_QUESTION_RELATIONSHIP': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {answerId, questionId, questionLabel} = action.payload;
			// Just forward to the existing ADD_BRANCH_QUESTION action
			dispatch('ADD_BRANCH_QUESTION', {
				answerId: answerId,
				questionId: questionId,
				questionLabel: questionLabel
			});
		},

		'ADD_SECTION': (coeffects) => {
			const {updateState, state} = coeffects;
			// Get existing sections for sort_order calculation
			const existingSections = state.currentAssessment.sections || [];

			// Calculate next sort_order among parent sections
			const parentSortOrders = existingSections.map(s => s.sort_order || 0);
			const maxParentSortOrder = parentSortOrders.length > 0 ? Math.max(...parentSortOrders) : 0;
			const nextSortOrder = maxParentSortOrder + 1;

			// Create a new parent section object with temporary ID
			const newSectionId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			const newSection = {
				id: newSectionId,
				label: '',
				sort_order: nextSortOrder,
				subsections: [],
				tooltip: '',
				alternative_wording: '',
				required: false,
				custom_attributes: {},
				isNew: true // Mark as new for save operation
			};

			// Add as new parent section
			const updatedSections = [...existingSections, newSection];

			updateState({
				currentAssessment: {
					...state.currentAssessment,
					sections: updatedSections
				},
				selectedSection: newSection,
				editingSectionId: newSectionId, // Auto-edit the new section
				editingSectionName: '', // Start with empty name for editing
				// Track this as a new addition for backend saving
				sectionChanges: {
					...state.sectionChanges,
					[newSectionId]: {
						action: 'add',
						...newSection,
						parent_section_id: null, // Parent section has no parent
						gt_id: state.currentAssessmentId,
						library_id: null
					}
				}
			});
		},

		'ADD_CHILD_SECTION': (coeffects) => {
			const {updateState, state, action} = coeffects;
			const {parentSectionId} = action.payload;
			// Find the parent section
			const existingSections = state.currentAssessment.sections || [];
			const parentSection = existingSections.find(s => s.id === parentSectionId);

			if (!parentSection) {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Parent section not found',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Calculate next sort_order within the parent section
			const existingSubsections = parentSection.subsections || [];
			const sortOrders = existingSubsections.map(s => s.sort_order || 0);
			const maxSortOrder = sortOrders.length > 0 ? Math.max(...sortOrders) : 0;
			const nextSortOrder = maxSortOrder + 1;
			// Create new child section
			const newSectionId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			const newSection = {
				id: newSectionId,
				label: '',
				sort_order: nextSortOrder,
				questions_quantity: 0,
				tooltip: '',
				alternative_wording: '',
				required: false,
				custom_attributes: {},
				isNew: true // Mark as new for save operation
			};

			// Add to the parent section's subsections
			const updatedSections = [...existingSections];
			const parentSectionIndex = updatedSections.findIndex(s => s.id === parentSectionId);
			if (parentSectionIndex !== -1) {
				updatedSections[parentSectionIndex] = {
					...updatedSections[parentSectionIndex],
					subsections: [...(updatedSections[parentSectionIndex].subsections || []), newSection]
				};
			}

			updateState({
				currentAssessment: {
					...state.currentAssessment,
					sections: updatedSections
				},
				selectedSection: newSection,
				editingSectionId: newSectionId, // Auto-edit the new section
				editingSectionName: '', // Start with empty name for editing
				// Track this as a new addition for backend saving
				sectionChanges: {
					...state.sectionChanges,
					[newSectionId]: {
						action: 'add',
						...newSection,
						parent_section_id: parentSectionId,
						gt_id: state.currentAssessmentId,
						library_id: null
					}
				}
			});
		},

		'EDIT_SECTION_NAME': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {sectionId, sectionLabel} = action.payload;
			updateState({
				editingSectionId: sectionId,
				editingSectionName: sectionLabel
			});
		},

		'UPDATE_SECTION_NAME': (coeffects) => {
			const {action, updateState} = coeffects;
			const {sectionName} = action.payload;
			
			updateState({
				editingSectionName: sectionName
			});
		},

		'SAVE_SECTION_NAME': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {sectionId, sectionLabel} = action.payload;
			// First check for exact matches using typeahead API
			dispatch('CHECK_SECTION_DUPLICATE', {
				sectionId,
				sectionLabel
			});
		},

		'CHECK_SECTION_DUPLICATE': (coeffects) => {
			const {action, dispatch, state, updateState} = coeffects;
			const {sectionId, sectionLabel} = action.payload;

			// Check for blank section name
			if (!sectionLabel || sectionLabel.trim() === '') {
				updateState({
					systemMessages: [
					...(state.systemMessages || []),

						{
							type: 'error',
							message: 'Section name cannot be blank. Please enter a section name.',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			const currentSectionName = sectionLabel.toLowerCase().trim();

			// Determine if the section being saved is a parent or child, and find its parent if it's a child
			let isParentSection = false;
			let parentSectionId = null;

			if (state.currentAssessment?.sections) {
				// Check if sectionId is a parent section
				const parentSection = state.currentAssessment.sections.find(s => s.id === sectionId);
				if (parentSection) {
					isParentSection = true;
				} else {
					// It's a child section - find which parent it belongs to
					for (const section of state.currentAssessment.sections) {
						if (section.subsections) {
							const childSection = section.subsections.find(sub => sub.id === sectionId);
							if (childSection) {
								parentSectionId = section.id;
								break;
							}
						}
					}
				}
			}

			// Apply validation rules based on whether it's a parent or child section
			if (isParentSection) {
				// RULE: Parent sections must have unique names across all parents
				const duplicateParent = state.currentAssessment.sections.find(section =>
					section.id !== sectionId && section.label.toLowerCase().trim() === currentSectionName
				);

				if (duplicateParent) {
					updateState({
						systemMessages: [
						...(state.systemMessages || []),

							{
								type: 'error',
								message: `Parent section "${sectionLabel}" already exists. Parent sections must have unique names.`,
								timestamp: new Date().toISOString()
							}
						]
					});
					return;
				}
			} else {
				// RULE: Child sections must have unique names only within the same parent
				const parentSection = state.currentAssessment.sections.find(s => s.id === parentSectionId);
				if (parentSection && parentSection.subsections) {
					const duplicateSibling = parentSection.subsections.find(subsection =>
						subsection.id !== sectionId && subsection.label.toLowerCase().trim() === currentSectionName
					);

					if (duplicateSibling) {
						updateState({
							systemMessages: [
							...(state.systemMessages || []),

								{
									type: 'error',
									message: `Child section "${sectionLabel}" already exists under "${parentSection.label}". Child sections must have unique names within the same parent.`,
									timestamp: new Date().toISOString()
								}
							]
						});
						return;
					}
				}
			}

			// No duplicate found, now check for library matches before saving
			dispatch('CHECK_SECTION_LIBRARY_MATCH', {
				sectionId,
				sectionLabel
			});
		},

		'CHECK_SECTION_LIBRARY_MATCH': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {sectionId, sectionLabel} = action.payload;
			// Store original save data for after the library check
			updateState({
				pendingSectionSave: {
					sectionId: sectionId,
					sectionLabel: sectionLabel
				},
				preSaveSectionContext: {
					contentType: 'section',
					searchText: sectionLabel,
					isPreSaveCheck: true  // Flag to identify this as pre-save check
				}
			});

			// Search for exact match using generic typeahead
			dispatch('GENERIC_TYPEAHEAD_SEARCH', {
				searchText: sectionLabel,
				type: 'section',
				isPreSaveCheck: true  // Flag to identify this as pre-save check
			});
		},

		'PROCEED_WITH_SECTION_SAVE': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {sectionId, sectionLabel} = action.payload;
			// Update the section label in the assessment (handles both parent and child sections)
			const updatedSections = state.currentAssessment.sections.map(section => {
				// Check if this is a parent section being updated
				if (section.id === sectionId) {
					return {...section, label: sectionLabel};
				}

				// Otherwise, check subsections for child section updates
				return {
					...section,
					subsections: section.subsections?.map(subsection =>
						subsection.id === sectionId
							? {...subsection, label: sectionLabel}
							: subsection
					) || []
				};
			});

			updateState({
				currentAssessment: {
					...state.currentAssessment,
					sections: updatedSections
				},
				editingSectionId: null,
				editingSectionName: null,
				// Clear typeahead state
				sectionTypeaheadVisible: false,
				sectionTypeaheadResults: [],
				sectionTypeaheadQuery: '',
				sectionTypeaheadSelectedIndex: -1,
				selectedSectionLibraryId: null
			});

			// Auto-save the section immediately
			dispatch('SAVE_SECTION_IMMEDIATELY', {
				sectionId: sectionId,
				sectionLabel: sectionLabel,
				libraryId: state.selectedSectionLibraryId
			});
		},

		'CANCEL_SECTION_EDIT': (coeffects) => {
			const {updateState, state} = coeffects;

			// Check if we're canceling a new section that should be removed
			const editingSectionId = state.editingSectionId;
			let shouldRemoveSection = false;

			if (editingSectionId) {
				// Find the section being edited
				const sectionToCheck = state.currentAssessment?.sections?.find(section =>
					section.subsections?.some(subsection => subsection.id === editingSectionId)
				);

				if (sectionToCheck) {
					const subsectionToCheck = sectionToCheck.subsections?.find(subsection =>
						subsection.id === editingSectionId
					);

					// Remove if it's new (has isNew flag or temp ID) and has empty/blank label
					if (subsectionToCheck &&
						(subsectionToCheck.isNew || editingSectionId.startsWith('temp_')) &&
						(!subsectionToCheck.label || subsectionToCheck.label.trim() === '')) {
						shouldRemoveSection = true;
					}
				}
			}

			// Clear section from change tracking (important fix!)
			const updatedSectionChanges = {...state.sectionChanges};
			if (editingSectionId && updatedSectionChanges[editingSectionId]) {
				delete updatedSectionChanges[editingSectionId];
			}

			if (shouldRemoveSection) {
				// Remove the section from the assessment
				const updatedSections = state.currentAssessment.sections.map(section => ({
					...section,
					subsections: section.subsections?.filter(subsection =>
						subsection.id !== editingSectionId
					) || []
				}));

				updateState({
					currentAssessment: {
						...state.currentAssessment,
						sections: updatedSections
					},
					sectionChanges: updatedSectionChanges, // Clear change tracking
					editingSectionId: null,
					editingSectionName: null,
					// Clear typeahead state
					sectionTypeaheadVisible: false,
					sectionTypeaheadResults: [],
					sectionTypeaheadQuery: '',
					sectionTypeaheadSelectedIndex: -1,
					selectedSectionLibraryId: null,
					systemMessages: [
					...(state.systemMessages || []),
						
						{
							type: 'info',
							message: 'New section removed.',
							timestamp: new Date().toISOString()
						}
					]
				});
			} else {
				// Just cancel editing without removing
				updateState({
					sectionChanges: updatedSectionChanges, // Clear change tracking
					editingSectionId: null,
					editingSectionName: null,
					// Clear typeahead state
					sectionTypeaheadVisible: false,
					sectionTypeaheadResults: [],
					sectionTypeaheadQuery: '',
					sectionTypeaheadSelectedIndex: -1,
					selectedSectionLibraryId: null
				});
			}
		},

		'SAVE_SECTION_IMMEDIATELY': (coeffects) => {
			const {action, dispatch, state, updateState} = coeffects;
			const {sectionId, sectionLabel, libraryId} = action.payload;
			// Validate section label is not blank
			if (!sectionLabel || sectionLabel.trim() === '') {
				console.error('Cannot save section with blank label');
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Section name cannot be blank',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Determine if this is a new section (temp ID) or existing section
			if (sectionId.startsWith('temp_')) {
				// New section - find the actual section data to get the correct sort_order
				let actualSection = null;
				let isParentSection = false;
				let parentSectionId = null;

				// First check if it's a parent section
				for (const section of state.currentAssessment.sections) {
					if (section.id === sectionId) {
						actualSection = section;
						isParentSection = true;
						parentSectionId = null; // Parent sections have no parent
						break;
					}
				}

				// If not found as parent section, check subsections
				if (!actualSection) {
					for (const section of state.currentAssessment.sections) {
						if (section.subsections) {
							const foundSubsection = section.subsections.find(sub => sub.id === sectionId);
							if (foundSubsection) {
								actualSection = foundSubsection;
								isParentSection = false;
								parentSectionId = section.id; // Use the parent section's ID
								break;
							}
						}
					}
				}

				if (!actualSection) {
					console.error('Could not find section data for temp section:', sectionId);
					return;
				}
				// Check if parent section has temp ID - need to save parent first
				if (parentSectionId && parentSectionId.startsWith('temp_')) {
					// Find the parent section data
					const parentSection = state.currentAssessment.sections.find(s => s.id === parentSectionId);
					if (!parentSection) {
						updateState({
							systemMessages: [
								...(state.systemMessages || []),
								{
									type: 'error',
									message: 'Parent section not found - cannot save child section',
									timestamp: new Date().toISOString()
								}
							]
						});
						return;
					}

					// Store the child section save request to execute after parent save
					updateState({
						pendingChildSectionSave: {
							sectionId: sectionId,
							sectionLabel: sectionLabel,
							libraryId: libraryId
						},
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'info',
								message: 'Saving parent section first, then child section...',
								timestamp: new Date().toISOString()
							}
						]
					});

					// Save the parent section first
					dispatch('SAVE_SECTION_IMMEDIATELY', {
						sectionId: parentSectionId,
						sectionLabel: parentSection.label,
						libraryId: null // Parent sections typically don't have library IDs when being auto-saved
					});
					return;
				}

				const sectionData = {
					label: sectionLabel,
					guideline_template_id: state.currentAssessmentId,
					sort_order: actualSection.sort_order,  // Use the actual sort_order from the section
					parent_section_id: parentSectionId
				};

				if (libraryId) {
					sectionData.library_id = libraryId;
				}

				dispatch('ADD_SECTION_API', {
					sectionData: sectionData
				});
			} else {
				// Existing section - use UPDATE API
				// Find the section to get its current sort_order
				let existingSection = null;

				// First check if it's a parent section
				for (const section of state.currentAssessment.sections) {
					if (section.id === sectionId) {
						existingSection = section;
						break;
					}
				}

				// If not found as parent section, check subsections
				if (!existingSection) {
					for (const section of state.currentAssessment.sections) {
						if (section.subsections) {
							const foundSubsection = section.subsections.find(sub => sub.id === sectionId);
							if (foundSubsection) {
								existingSection = foundSubsection;
								break;
							}
						}
					}
				}

				if (!existingSection) {
					console.error('Could not find section data for existing section:', sectionId);
					return;
				}

				const sectionData = {
					sectionId: sectionId,
					label: sectionLabel,
					sort_order: existingSection.sort_order // Include sort_order to preserve it
				};

				if (libraryId) {
					sectionData.library_id = libraryId;
				}

				dispatch('UPDATE_SECTION_API', {
					sectionData: sectionData
				});
			}
		},

		'DELETE_SECTION': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {sectionId, sectionName} = action.payload;

			// Show confirmation dialog
			dispatch('SHOW_CONFIRMATION_DIALOG', {
				message: `Are you sure you want to delete section "${sectionName}"?`,
				pendingAction: {
					type: 'CONFIRM_DELETE_SECTION',
					payload: { sectionId }
				}
			});
		},

		'CONFIRM_DELETE_SECTION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {sectionId} = action.payload;

			let updatedSections;
			let isParentSection = false;

			// Check if this is a parent section (top level)
			const parentSectionToDelete = state.currentAssessment.sections.find(section => section.id === sectionId);

			if (parentSectionToDelete) {
				// This is a parent section - remove it completely from the sections array
				isParentSection = true;
				updatedSections = state.currentAssessment.sections.filter(section => section.id !== sectionId);
			} else {
				// This is a child section - remove it from parent sections' subsections
				updatedSections = state.currentAssessment.sections.map(section => ({
					...section,
					subsections: section.subsections?.filter(subsection => subsection.id !== sectionId) || []
				}));
			}

			updateState({
				currentAssessment: {
					...state.currentAssessment,
					sections: updatedSections
				},
				selectedSection: state.selectedSection === sectionId ? null : state.selectedSection,
				selectedSectionLabel: state.selectedSection === sectionId ? null : state.selectedSectionLabel
			});

			// Auto-delete from backend immediately (only if not temp ID)
			if (!sectionId.startsWith('temp_')) {
				dispatch('DELETE_SECTION_API', {
					sectionId: sectionId
				});
			} else {
				// Show toast for temp sections
				dispatch('SHOW_TOAST', {
					type: 'success',
					message: 'Section removed successfully!'
				});
			}
		},

		'ADD_SECTION_API': (coeffects) => {
			const {action, dispatch, state, updateState} = coeffects;
			const {sectionData} = action.payload;

			// Store the new section label in state so we can use it after the API call
			updateState({
				addingSection: true,
				pendingNewSectionLabel: sectionData.label
			});

			// Send fields directly - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				gt_id: state.currentAssessmentId,
				parent_section_id: sectionData.parent_section_id, // Use the correct parent_section_id from sectionData
				label: sectionData.label,
				sort_order: sectionData.sort_order,
				library_id: sectionData.library_id
			});
			dispatch('MAKE_ADD_SECTION_REQUEST', {requestBody: requestBody});
		},

		'UPDATE_SECTION_API': (coeffects) => {
			const {action, dispatch, updateState, state} = coeffects;
			const {sectionData} = action.payload;

			// Set loading state for this section
			updateState({
				updatingSections: {
					...state.updatingSections,
					[sectionData.sectionId]: true
				}
			});

			// Send fields directly - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				sectionId: sectionData.sectionId,
				label: sectionData.label,
				tooltip: sectionData.tooltip || '',
				alternative_wording: sectionData.alternative_wording || '',
				required: sectionData.required || false,
				custom_attributes: sectionData.custom_attributes || {},
				sort_order: sectionData.sort_order || 0
			});
			dispatch('MAKE_SECTION_UPDATE_REQUEST', {requestBody: requestBody, sectionId: sectionData.sectionId});
		},

		'DELETE_SECTION_API': (coeffects) => {
			const {action, dispatch, updateState, state} = coeffects;
			const {sectionId} = action.payload;

			// Set loading state for this section
			updateState({
				deletingSections: {
					...state.deletingSections,
					[sectionId]: true
				}
			});

			const requestBody = JSON.stringify({
				sectionId: sectionId
			});
			dispatch('MAKE_DELETE_SECTION_REQUEST', {requestBody: requestBody, sectionId: sectionId});
		},

		'MAKE_DELETE_SECTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-section', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_SECTION_SUCCESS',
			errorActionType: 'DELETE_SECTION_ERROR',
			metaParam: 'sectionId'
		}),

		'DELETE_SECTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const sectionId = action.meta?.sectionId;

			// Clear loading state
			const updatedDeletingSections = {...state.deletingSections};
			if (sectionId) {
				delete updatedDeletingSections[sectionId];
			}

			// Clear section changes for the deleted section
			const updatedSectionChanges = {...state.sectionChanges};
			if (sectionId) {
				delete updatedSectionChanges[sectionId];
			}

			updateState({
				deletingSections: updatedDeletingSections,
				sectionChanges: updatedSectionChanges,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Section deleted successfully!',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Reload assessment data to refresh the section list and reset to first section
			if (state.currentAssessmentId) {
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessmentId
				});
			}
		},

		'DELETE_SECTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const sectionId = action.meta?.sectionId;

			// Clear loading state
			const updatedDeletingSections = {...state.deletingSections};
			if (sectionId) {
				delete updatedDeletingSections[sectionId];
			}
			console.error('Section delete error:', action.payload);

			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to delete section';

			updateState({
				deletingSections: updatedDeletingSections,
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'error',
						message: errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'DRAG_SECTION_START': (coeffects) => {
			const {action, updateState} = coeffects;
			const {sectionId, sectionIndex} = action.payload;
			updateState({
				draggingSection: sectionId,
				draggingSectionIndex: sectionIndex,
				dragOverSection: null
			});
		},

		'DRAG_SECTION_OVER': (coeffects) => {
			const {action, updateState} = coeffects;
			const {sectionId} = action.payload;
			
			updateState({
				dragOverSection: sectionId
			});
		},

		'DRAG_SECTION_LEAVE': (coeffects) => {
			const {updateState} = coeffects;

			updateState({
				dragOverSection: null
			});
		},

		'DRAG_QUESTION_OVER_SECTION': (coeffects) => {
			const {action, updateState} = coeffects;
			const {sectionId} = action.payload;

			updateState({
				dragOverSection: sectionId
			});
		},

		'DRAG_QUESTION_LEAVE_SECTION': (coeffects) => {
			const {updateState} = coeffects;

			updateState({
				dragOverSection: null
			});
		},

		'MOVE_QUESTION_TO_SECTION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {
				questionId,
				sourceSectionId,
				sourceSectionLabel,
				targetSectionId,
				targetSectionLabel,
				question
			} = action.payload;

			// CRITICAL: Check if question already exists in target section
			// If target section is currently selected, check currentQuestions
			let targetSectionQuestions = [];
			if (targetSectionId === state.selectedSection && state.currentQuestions) {
				targetSectionQuestions = state.currentQuestions.questions || [];
			}

			const questionLabelLower = question.label.toLowerCase().trim();
			const duplicateInTarget = targetSectionQuestions.find(q =>
				q.label.toLowerCase().trim() === questionLabelLower
			);

			if (duplicateInTarget) {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Question "${question.label}" already exists in "${targetSectionLabel}". Cannot move duplicate questions to the same section.`,
							timestamp: new Date().toISOString()
						}
					]
				});
				return; // Stop the move operation
			}

			// If target section is NOT currently selected, we need to fetch its questions first to check for duplicates
			if (targetSectionId !== state.selectedSection) {
				// Store move request and fetch target section questions first
				updateState({
					pendingQuestionMoveForDuplicateCheck: {
						questionId,
						sourceSectionId,
						sourceSectionLabel,
						targetSectionId,
						targetSectionLabel,
						question
					},
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'loading',
							message: `Checking "${targetSectionLabel}" for duplicates...`,
							timestamp: new Date().toISOString()
						}
					]
				});

				// Fetch target section questions to check for duplicates
				dispatch('FETCH_SECTION_QUESTIONS_FOR_DUPLICATE_CHECK', {
					sectionId: targetSectionId,
					sectionLabel: targetSectionLabel
				});
				return; // Wait for questions to load, then continue in success handler
			}

			// Show loading message and spinner
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'loading',
						message: `Moving "${question.label}" to "${targetSectionLabel}"...`,
						timestamp: new Date().toISOString()
					}
				],
				movingQuestion: true,  // Show loading overlay
				// Store move context for typeahead success handler
				pendingQuestionMovePreLookup: {
					questionId,
					sourceSectionId,
					sourceSectionLabel,
					targetSectionId,
					targetSectionLabel,
					question
				}
			});

			// Step 1: Search typeahead to get library_id if it exists
			dispatch('GENERIC_TYPEAHEAD_SEARCH', {
				searchText: question.label,
				type: 'question',
				isQuestionMove: true  // Flag to identify this as a move operation
			});
		},

		'CONTINUE_QUESTION_MOVE_AFTER_LOOKUP': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {libraryId} = action.payload;
			const moveContext = state.pendingQuestionMovePreLookup;

			if (!moveContext) {
				console.error('No pending move context found');
				return;
			}

			// DEBUG: Check if libraryId is actually set
			if (!libraryId) {
				console.error('CRITICAL: No libraryId found from typeahead! Question:', moveContext.question.label);
				updateState({
					movingQuestion: false,
					pendingQuestionMovePreLookup: null,
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Failed to find library ID for question "${moveContext.question.label}". Cannot move.`,
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			const {questionId, sourceSectionId, sourceSectionLabel, targetSectionId, targetSectionLabel, question} = moveContext;

			// Update message
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'loading',
						message: `Moving question "${question.label}" from "${sourceSectionLabel}" to "${targetSectionLabel}"...`,
						timestamp: new Date().toISOString()
					}
				],
				pendingQuestionMovePreLookup: null  // Clear pre-lookup context
			});

			// Get the highest sort_order in the target section
			const targetSectionQuestions = state.sectionQuestions?.[targetSectionId] || [];
			const maxSortOrder = targetSectionQuestions.length > 0
				? Math.max(...targetSectionQuestions.map(q => q.sort_order || 0))
				: 0;
			const newSortOrder = maxSortOrder + 1;

			// Prepare question data for ADD_QUESTION_TO_SECTION_API
			const questionData = {
				label: question.label,
				type: question.type,
				tooltip: question.tooltip || '',
				alternative_wording: question.alternative_wording || '',
				sort_order: newSortOrder,
				custom_attributes: question.custom_attributes || {},
				voice: question.voice || 'CaseManager',
				required: question.required || false,
				available: question.available || false,
				has_quality_measures: question.has_quality_measures || false,
				library_id: libraryId || null  // Use the library_id from typeahead lookup
			};


			// Store the move context for the success handler
			updateState({
				pendingQuestionMove: {
					questionId,
					sourceSectionId,
					sourceSectionLabel,
					targetSectionId,
					targetSectionLabel,
					question,
					answers: question.answers || []
				}
			});

			// Step 1: Add question to target section using ADD_QUESTION_TO_SECTION_API
			// This will properly handle library questions with minimal payload
			dispatch('ADD_QUESTION_TO_SECTION_API', {
				questionData: questionData,
				sectionId: targetSectionId,
				pendingAnswers: question.answers || []
			});
		},

		'DROP_SECTION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {targetSectionId, targetIndex} = action.payload;
			const draggingSection = state.draggingSection;
			const draggingIndex = state.draggingSectionIndex;
			if (draggingSection && draggingSection !== targetSectionId) {
				// Find the sections array and reorder
				const updatedSections = state.currentAssessment.sections.map(section => {
					if (section.subsections && section.subsections.length > 0) {
						// Find if this section contains both dragging and target subsections
						const draggingSubsection = section.subsections.find(sub => sub.id === draggingSection);
						const targetSubsection = section.subsections.find(sub => sub.id === targetSectionId);
						
						if (draggingSubsection && targetSubsection) {
							// Reorder within this section
							const newSubsections = [...section.subsections];
							const draggedItem = newSubsections.splice(draggingIndex, 1)[0];
							newSubsections.splice(targetIndex, 0, draggedItem);
							
							// Update sort_order based on new positions
							const reorderedSubsections = newSubsections.map((subsection, index) => ({
								...subsection,
								sort_order: index + 1
							}));
							
							return {
								...section,
								subsections: reorderedSubsections
							};
						}
					}
					return section;
				});
				
				updateState({
					currentAssessment: {
						...state.currentAssessment,
						sections: updatedSections
					},
					draggingSection: null,
					dragOverSection: null,
					draggingSectionIndex: null
				});

				// Auto-save all reordered sections immediately
				const reorderedSection = updatedSections.find(section =>
					section.subsections?.some(sub => sub.id === draggingSection || sub.id === targetSectionId)
				);

				if (reorderedSection && reorderedSection.subsections) {
					// Show immediate feedback for reordering operation
					updateState({
						systemMessages: [
					...(state.systemMessages || []),
							
							{
								type: 'success',
								message: `Reordering ${reorderedSection.subsections.length} sections and saving to backend...`,
								timestamp: new Date().toISOString()
							}
						]
					});

					reorderedSection.subsections.forEach(subsection => {
						// Auto-save each reordered section with new sort_order
						dispatch('UPDATE_SECTION_API', {
							sectionData: {
								sectionId: subsection.id,
								label: subsection.label,
								sort_order: subsection.sort_order
							}
						});
					});
				}
			}
		},

		'DRAG_SECTION_END': (coeffects) => {
			const {updateState} = coeffects;
			
			updateState({
				draggingSection: null,
				dragOverSection: null,
				draggingSectionIndex: null
			});
		},

		'EDIT_QUESTION_TOOLTIP': (coeffects) => {
			const {action, updateState} = coeffects;
			const {questionId, currentTooltip} = action.payload;
			updateState({
				editingTooltip: true,
				editingTooltipText: currentTooltip,
				editingTooltipOriginalText: currentTooltip,  // Store original for comparison
				editingTooltipQuestionId: questionId
			});
		},

		'UPDATE_TOOLTIP_TEXT': (coeffects) => {
			const {action, updateState} = coeffects;
			const {text} = action.payload;
			
			updateState({
				editingTooltipText: text
			});
		},

		'SAVE_TOOLTIP_EDIT': (coeffects) => {
			const {updateState, state} = coeffects;
			const questionId = state.editingTooltipQuestionId;
			const answerId = state.editingTooltipAnswerId;
			const newTooltip = state.editingTooltipText;
			const originalTooltip = state.editingTooltipOriginalText;

			// Check if tooltip actually changed
			const tooltipChanged = newTooltip !== originalTooltip;

			if (questionId) {
				// Find the current question to check if it already has unsaved changes
				const currentQuestion = state.currentQuestions.questions.find(q => q.ids.id === questionId);
				const alreadyUnsaved = currentQuestion?.isUnsaved || false;

				// Update the question in the current questions data
				const updatedQuestions = {
					...state.currentQuestions,
					questions: state.currentQuestions.questions.map(question =>
						question.ids.id === questionId
							? {...question, tooltip: newTooltip, isUnsaved: tooltipChanged ? true : alreadyUnsaved}
							: question
					)
				};

				// Only track changes if tooltip actually changed
				const updatedQuestionChanges = tooltipChanged ? {
					...state.questionChanges,
					[questionId]: {
						...(state.questionChanges?.[questionId] || {}),
						action: state.questionChanges?.[questionId]?.action === 'add' ? 'add' : 'update',
						questionId: questionId,
						tooltip: newTooltip
					}
				} : state.questionChanges;

				updateState({
					currentQuestions: updatedQuestions,
					editingTooltip: null,
					editingTooltipText: null,
					editingTooltipOriginalText: null,
					editingTooltipQuestionId: null,
					editingTooltipAnswerId: null,
					questionChanges: updatedQuestionChanges
				});
			} else if (answerId) {
				// Find the question containing this answer to check if it already has unsaved changes
				let parentQuestionAlreadyUnsaved = false;
				state.currentQuestions.questions.forEach(question => {
					if (question.answers?.some(answer => answer.ids.id === answerId)) {
						parentQuestionAlreadyUnsaved = question.isUnsaved || false;
					}
				});

				// Update the answer in the current questions data
				const updatedQuestions = {
					...state.currentQuestions,
					questions: state.currentQuestions.questions.map(question => {
						const hasAnswerToUpdate = question.answers?.some(answer => answer.ids.id === answerId);
						return {
							...question,
							answers: question.answers?.map(answer =>
								answer.ids.id === answerId
									? {...answer, tooltip: newTooltip}
									: answer
							) || [],
							// Mark question as unsaved only if tooltip changed
							isUnsaved: hasAnswerToUpdate ? (tooltipChanged ? true : parentQuestionAlreadyUnsaved) : question.isUnsaved
						};
					})
				};

				// Only track changes if tooltip actually changed
				const updatedAnswerChanges = tooltipChanged ? {
					...state.answerChanges,
					[answerId]: {
						action: 'update',
						answerId: answerId,
						tooltip: newTooltip
					}
				} : state.answerChanges;

				updateState({
					currentQuestions: updatedQuestions,
					editingTooltip: null,
					editingTooltipText: null,
					editingTooltipOriginalText: null,
					editingTooltipQuestionId: null,
					editingTooltipAnswerId: null,
					answerChanges: updatedAnswerChanges
				});
			}
		},

		// Custom Attributes Modal Actions
		'OPEN_CUSTOM_ATTRIBUTES_MODAL': (coeffects) => {
			const {action, updateState} = coeffects;
			const {itemType, itemId, currentAttributes} = action.payload;

			updateState({
				customAttributesModalOpen: true,
				customAttributesItemType: itemType,
				customAttributesItemId: itemId,
				customAttributesData: Object.keys(currentAttributes || {}).map(key => ({
					key: key,
					value: currentAttributes[key]
				})),
				customAttributesOriginalData: currentAttributes || {},  // Store original for comparison
				customAttributesValidationError: null  // Clear any previous errors
			});
		},

		'CLOSE_CUSTOM_ATTRIBUTES_MODAL': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				customAttributesModalOpen: false,
				customAttributesItemType: null,
				customAttributesItemId: null,
				customAttributesData: [],
				customAttributesOriginalData: null,  // Clear original data
				customAttributesValidationError: null  // Clear validation error
			});
		},

		'ADD_CUSTOM_ATTRIBUTE_ROW': (coeffects) => {
			const {updateState, state} = coeffects;
			updateState({
				customAttributesData: [
					...state.customAttributesData,
					{key: '', value: ''}
				]
			});
		},

		'UPDATE_CUSTOM_ATTRIBUTE': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {index, field, value} = action.payload;

			const updatedData = [...state.customAttributesData];
			updatedData[index] = {
				...updatedData[index],
				[field]: value
			};

			updateState({
				customAttributesData: updatedData
			});
		},

		'REMOVE_CUSTOM_ATTRIBUTE_ROW': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {index} = action.payload;

			const updatedData = state.customAttributesData.filter((_, i) => i !== index);
			updateState({
				customAttributesData: updatedData
			});
		},

		'SAVE_CUSTOM_ATTRIBUTES': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;

			// Validate: check for blank keys or values
			const hasBlankFields = state.customAttributesData.some(item =>
				item.key.trim() === '' || item.value.trim() === ''
			);

			if (hasBlankFields) {
				// Show validation error
				updateState({
					customAttributesValidationError: 'All custom attribute keys and values must be filled in. Remove empty rows or fill them out.'
				});
				return; // Stop save process
			}

			// Clear validation error
			updateState({
				customAttributesValidationError: null
			});

			// Convert array back to object format
			const customAttributes = {};
			state.customAttributesData.forEach(item => {
				if (item.key.trim() !== '') {
					customAttributes[item.key.trim()] = item.value;
				}
			});

			const originalAttributes = state.customAttributesOriginalData || {};

			// Helper function to compare two attribute objects
			const attributesChanged = () => {
				const newKeys = Object.keys(customAttributes).sort();
				const oldKeys = Object.keys(originalAttributes).sort();

				// Check if keys are different
				if (newKeys.length !== oldKeys.length) return true;
				if (JSON.stringify(newKeys) !== JSON.stringify(oldKeys)) return true;

				// Check if values are different
				for (let key of newKeys) {
					if (customAttributes[key] !== originalAttributes[key]) return true;
				}

				return false;
			};

			const hasChanges = attributesChanged();

			const itemType = state.customAttributesItemType;
			const itemId = state.customAttributesItemId;

			if (itemType === 'question') {
				// Find the current question data
				const currentQuestion = state.currentQuestions.questions.find(q => q.ids.id === itemId);
				if (!currentQuestion) return;

				const alreadyUnsaved = currentQuestion?.isUnsaved || false;

				// Update question locally
				const updatedQuestions = state.currentQuestions.questions.map(question => {
					if (question.ids.id === itemId) {
						return {
							...question,
							custom_attributes: Object.keys(customAttributes).length > 0 ? customAttributes : undefined,
							isUnsaved: hasChanges ? true : alreadyUnsaved
						};
					}
					return question;
				});

				// Only track changes if custom attributes actually changed
				const updatedQuestionChanges = hasChanges ? {
					...state.questionChanges,
					[itemId]: {
						...(state.questionChanges?.[itemId] || {}),
						action: state.questionChanges?.[itemId]?.action === 'add' ? 'add' : 'update',
						questionId: itemId,
						custom_attributes: Object.keys(customAttributes).length > 0 ? customAttributes : undefined
					}
				} : state.questionChanges;

				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					},
					questionChanges: updatedQuestionChanges
				});

			} else if (itemType === 'answer') {
				// Find the current answer and parent question
				let currentAnswer = null;
				let parentQuestionAlreadyUnsaved = false;
				state.currentQuestions.questions.forEach(question => {
					const answer = question.answers?.find(a => a.ids.id === itemId);
					if (answer) {
						currentAnswer = answer;
						parentQuestionAlreadyUnsaved = question.isUnsaved || false;
					}
				});

				if (!currentAnswer) return;

				// Update answer locally
				const updatedQuestions = state.currentQuestions.questions.map(question => {
					const hasAnswerToUpdate = question.answers?.some(answer => answer.ids.id === itemId);
					return {
						...question,
						answers: question.answers?.map(answer => {
							if (answer.ids.id === itemId) {
								return {
									...answer,
									custom_attributes: Object.keys(customAttributes).length > 0 ? customAttributes : undefined
								};
							}
							return answer;
						}) || [],
						// Mark question as unsaved only if custom attributes changed
						isUnsaved: hasAnswerToUpdate ? (hasChanges ? true : parentQuestionAlreadyUnsaved) : question.isUnsaved
					};
				});

				// Only track changes if custom attributes actually changed
				const updatedAnswerChanges = hasChanges ? {
					...state.answerChanges,
					[itemId]: {
						action: 'update',
						answerId: itemId,
						custom_attributes: Object.keys(customAttributes).length > 0 ? customAttributes : undefined
					}
				} : state.answerChanges;

				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					},
					answerChanges: updatedAnswerChanges
				});
			}

			dispatch('CLOSE_CUSTOM_ATTRIBUTES_MODAL');
		},

		'UPDATE_ANSWER_LABEL': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, newLabel} = action.payload;

			// Find the question that contains this answer
			let parentQuestionId = null;
			state.currentQuestions?.questions?.forEach(question => {
				if (question.answers?.some(answer => answer.ids.id === answerId)) {
					parentQuestionId = question.ids.id;
				}
			});

			// Update the answer in the current questions data and mark parent question as unsaved
			const updatedQuestions = {
				...state.currentQuestions,
				questions: state.currentQuestions.questions.map(question => {
					const hasAnswerToUpdate = question.answers?.some(answer => answer.ids.id === answerId);
					return {
						...question,
						answers: question.answers?.map(answer =>
							answer.ids.id === answerId
								? {...answer, label: newLabel}
								: answer
						) || [],
						// Mark question as unsaved if it contains the updated answer
						isUnsaved: hasAnswerToUpdate ? true : question.isUnsaved
					};
				})
			};

			updateState({
				currentQuestions: updatedQuestions,
				// Track answer change for save
				answerChanges: {
					...state.answerChanges,
					[answerId]: {
						action: 'update',
						answerId: answerId,
						questionId: parentQuestionId, // CRITICAL: Add questionId for library checking
						label: newLabel
					}
				}
			});
		},

		'UPDATE_ANSWER_SCORE': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, score} = action.payload;

			if (!state.selectedScoringModel) {
				return;
			}

			const selectedModelId = state.selectedScoringModel.id;

			// Update the answer score in the scoring object for the selected model
			const updatedQuestions = {
				...state.currentQuestions,
				questions: state.currentQuestions.questions.map(question => ({
					...question,
					answers: question.answers?.map(answer => {
						if (answer.ids.id === answerId) {
							return {
								...answer,
								scoring: {
									...answer.scoring,
									[selectedModelId]: score || null
								}
							};
						}
						return answer;
					}) || []
				}))
			};

			// Track the change in scoringChanges state
			const updatedScoringChanges = {
				...state.scoringChanges,
				[answerId]: {
					...(state.scoringChanges[answerId] || {}),
					[selectedModelId]: score || null
				}
			};

			updateState({
				currentQuestions: updatedQuestions,
				scoringChanges: updatedScoringChanges
			});
		},

		'SAVE_SCORING_CHANGES': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;

			if (!state.selectedScoringModel) {
				return;
			}

			const scoringChanges = state.scoringChanges || {};
			const selectedModelId = state.selectedScoringModel.id;
			const selectedModel = state.selectedScoringModel;

			// If no changes, just show message
			if (Object.keys(scoringChanges).length === 0) {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'info',
							message: 'No changes to save',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Count how many saves we need to do
			let saveCount = 0;
			Object.keys(scoringChanges).forEach(answerId => {
				const answerChanges = scoringChanges[answerId];
				if (answerChanges[selectedModelId] !== undefined) {
					saveCount++;
				}
			});

			// Set loading state and pending count
			updateState({
				savingScoringChanges: true,
				pendingScoringChanges: saveCount
			});

			// Iterate through all scoring changes and save them
			let completedCount = 0;
			Object.keys(scoringChanges).forEach(answerId => {
				const answerChanges = scoringChanges[answerId];
				if (answerChanges[selectedModelId] !== undefined) {
					const score = answerChanges[selectedModelId];
					const scoreString = score ? String(score) : "";

					// Use the exact same format as SAVE_ANSWER_SCORE
					const requestBody = JSON.stringify({
						scoring_model_id: selectedModel.id,
						guideline_template_id: state.currentAssessmentId,
						label: selectedModel.label,
						scoring_type: selectedModel.scoring_type,
						answer_id: answerId,
						value: scoreString
					});

					dispatch('MAKE_SAVE_SCORING_MODEL_REQUEST', {
						requestBody: requestBody,
						isBatch: true,
						totalCount: saveCount
					});
				}
			});

			// Clear scoring changes after dispatching all saves
			updateState({
				scoringChanges: {}
			});
		},

		'CANCEL_SCORING_CHANGES': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;

			// Clear scoring changes and exit scoring mode
			updateState({
				scoringChanges: {},
				selectedScoringModel: null
			});

			// Reload assessment data to restore original values
			if (state.currentAssessmentId) {
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessmentId
				});
			}
		},

		'SAVE_ANSWER_SCORE': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {answerId, score} = action.payload;

			if (!state.selectedScoringModel) {
				return;
			}

			if (!state.careiqConfig || !state.accessToken) {
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'Cannot save score: Missing configuration',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			const config = state.careiqConfig;
			const accessToken = state.accessToken;
			const selectedModel = state.selectedScoringModel;

			// Convert score to string as required by API
			const scoreString = score ? String(score) : "";

			// Build request payload - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				scoring_model_id: selectedModel.id,
				guideline_template_id: state.currentAssessmentId,
				label: selectedModel.label,
				scoring_type: selectedModel.scoring_type,
				answer_id: answerId,
				value: scoreString
			});

			dispatch('MAKE_SAVE_SCORING_MODEL_REQUEST', {
				requestBody: requestBody,
				meta: { answerId: answerId, score: score }
			});
		},

		'UPDATE_ANSWER_SECONDARY_INPUT': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, newSecondaryInputType} = action.payload;
			// Update the answer in the current questions data and mark parent question as unsaved
			const updatedQuestions = {
				...state.currentQuestions,
				questions: state.currentQuestions.questions.map(question => {
					const hasAnswerToUpdate = question.answers?.some(answer => answer.ids.id === answerId);
					return {
						...question,
						answers: question.answers?.map(answer =>
							answer.ids.id === answerId
								? {...answer, secondary_input_type: newSecondaryInputType}
								: answer
						) || [],
						// Mark question as unsaved if it contains the updated answer
						isUnsaved: hasAnswerToUpdate ? true : question.isUnsaved
					};
				})
			};

			updateState({
				currentQuestions: updatedQuestions
			});
		},

		'UPDATE_ANSWER_MUTUALLY_EXCLUSIVE': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, mutually_exclusive} = action.payload;
			// Update the answer in the current questions data and mark parent question as unsaved
			const updatedQuestions = {
				...state.currentQuestions,
				questions: state.currentQuestions.questions.map(question => {
					const hasAnswerToUpdate = question.answers?.some(answer => answer.ids.id === answerId);
					return {
						...question,
						answers: question.answers?.map(answer =>
							answer.ids.id === answerId
								? {...answer, mutually_exclusive: mutually_exclusive}
								: answer
						) || [],
						// Mark question as unsaved if it contains the updated answer
						isUnsaved: hasAnswerToUpdate ? true : question.isUnsaved
					};
				})
			};

			updateState({
				currentQuestions: updatedQuestions
			});
		},

		'EDIT_ANSWER_TOOLTIP': (coeffects) => {
			const {action, updateState} = coeffects;
			const {answerId, currentTooltip} = action.payload;
			updateState({
				editingTooltip: true,
				editingTooltipText: currentTooltip,
				editingTooltipOriginalText: currentTooltip,  // Store original for comparison
				editingTooltipAnswerId: answerId
			});
		},

		'SAVE_ALL_CHANGES': async (coeffects) => {
			const {updateState, state, dispatch} = coeffects;


			//
			//
			//
			//
			 // Keep for delete debugging
			//

			// CRITICAL: Capture COMPLETE change data, then IMMEDIATELY clear tracking to prevent duplicates
			const sectionChangesData = {...(state.sectionChanges || {})};
			const questionChangesData = {...(state.questionChanges || {})};
			const answerChangesData = {...(state.answerChanges || {})};
			const relationshipChangesData = {...(state.relationshipChanges || {})};

			const sectionChanges = Object.keys(sectionChangesData);
			const questionChanges = Object.keys(questionChangesData);
			const answerChanges = Object.keys(answerChangesData);
			const relationshipChanges = Object.keys(relationshipChangesData);


			// DEBUG: Log what we captured
			// FIRST: Run all validations before clearing change tracking or performing saves
			const validationErrors = [];

			// Validate all questions for blank text
			if (questionChanges.length > 0) {
				questionChanges.forEach(questionId => {
					const questionData = questionChangesData[questionId];
					if (!questionData.label || questionData.label.trim() === '') {
						validationErrors.push('Question text cannot be blank. Please enter a question.');
					}
				});
			}

			// Validate all answers for blank text (skip deleted answers)
			if (answerChanges.length > 0) {
				answerChanges.forEach(answerId => {
					const answerData = answerChangesData[answerId];
					// Skip validation for answers being deleted
					if (answerData.action === 'delete') {
						return;
					}
					// Only validate label if the label field is actually being changed
					// (answerData.label will be undefined for partial updates like tooltip or custom_attributes only)
					if (answerData.hasOwnProperty('label') && (!answerData.label || answerData.label.trim() === '')) {
						validationErrors.push('Answer text cannot be blank. Please enter answer text.');
					}
				});
			}

			// Validate for duplicate answers within questions being saved
			// Check ALL questions that have answer changes
			if (answerChanges.length > 0 && state.currentQuestions?.questions) {

				// Build set of unique question IDs that have answer changes
				const questionIdsWithAnswerChanges = new Set();
				answerChanges.forEach(answerId => {
					const answerData = answerChangesData[answerId];
					// Find which question this answer belongs to
					if (state.currentQuestions?.questions) {
						for (let question of state.currentQuestions.questions) {
							if (question.answers) {
								const foundAnswer = question.answers.find(ans => ans.ids.id === answerId);
								if (foundAnswer) {
									questionIdsWithAnswerChanges.add(question.ids.id);
									break;
								}
							}
						}
					}
					// Also check if question_id is in answerData
					if (answerData.question_id) {
						questionIdsWithAnswerChanges.add(answerData.question_id);
					}
					if (answerData.questionId) {
						questionIdsWithAnswerChanges.add(answerData.questionId);
					}
				});


				// Check each question for duplicate answers (within same question)
				questionIdsWithAnswerChanges.forEach(questionId => {
					const currentQuestion = state.currentQuestions.questions.find(q => q.ids.id === questionId);


					if (currentQuestion && currentQuestion.answers && currentQuestion.answers.length > 0) {
						const answerLabels = [];
						const duplicatesFound = [];


						currentQuestion.answers.forEach(answer => {
							// Skip answers marked for deletion
							if (answer.isDeleted) {
								return;
							}
							const trimmedLabel = answer.label.toLowerCase().trim();
							if (answerLabels.includes(trimmedLabel)) {
								// This is a duplicate within the same question
								if (!duplicatesFound.includes(answer.label)) {
									duplicatesFound.push(answer.label);
								}
							} else {
								answerLabels.push(trimmedLabel);
							}
						});

						if (duplicatesFound.length > 0) {
							validationErrors.push(`Question "${currentQuestion.label}" has duplicate answers: ${duplicatesFound.join(', ')}`);
						}
					}
				});

				// CRITICAL: Check each answer against existing library/database answers
				// This prevents backend duplicate errors for answers like "Option 1", "Option 2", etc.
				// ONLY do this if we haven't already checked (prevent infinite loop)
				const answersToCheck = [];

				if (!state.answerDuplicateCheckCompleted) {

					// Check ALL answers from questions with temp IDs (new questions)
					if (state.currentQuestions && state.currentQuestions.questions) {
						state.currentQuestions.questions.forEach(question => {
							// For new questions (temp IDs), check all their answers
							if (question.ids.id.startsWith('temp_') && question.answers && question.answers.length > 0) {
								question.answers.forEach(answer => {
									// Only check if this answer doesn't already have a library_id
									if (!answer.library_id && !answer.isLibraryAnswer) {
										answersToCheck.push({
											questionId: question.ids.id,
											questionLabel: question.label,
											answerLabel: answer.label,
											answerId: answer.ids.id // Store answerId for later matching
										});
									}
								});
							}
						});
					}

					// Also check answers from answerChanges (for existing questions)
					Object.keys(state.answerChanges || {}).forEach(answerId => {
						const answerChange = state.answerChanges[answerId];

						// Check answers that are being added OR are temp answers being updated (new answers that were edited)
						const isNewAnswer = answerChange && (answerChange.action === 'add' || (answerChange.action === 'update' && answerId.startsWith('temp_')));

						// Support both question_id and questionId field names
						const questionIdForAnswer = answerChange.question_id || answerChange.questionId;

						if (isNewAnswer && questionIdForAnswer && !questionIdForAnswer.startsWith('temp_')) {
							const currentQuestion = state.currentQuestions.questions.find(q => q.ids.id === questionIdForAnswer);

							if (currentQuestion && !answersToCheck.some(a => a.answerId === answerId)) {
								answersToCheck.push({
									questionId: questionIdForAnswer,
									questionLabel: currentQuestion.label,
									answerLabel: answerChange.label,
									answerId: answerId // Store answerId for later matching
								});
							}
						}
					});

				}

				// If we have answers to check, dispatch check action and pause save
				if (answersToCheck.length > 0 && !state.answerDuplicateCheckCompleted) {
					updateState({
						pendingAnswersToCheck: answersToCheck,
						pendingAnswersCheckIndex: 0,
						isCheckingAnswerDuplicates: true, // Flag to prevent state clearing
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'info',
								message: `Checking ${answersToCheck.length} answer(s) against existing library...`,
								timestamp: new Date().toISOString()
							}
						]
					});

					// Start checking first answer - use setTimeout to ensure state is updated first
					setTimeout(() => {
						dispatch('CHECK_NEXT_ANSWER_FOR_DUPLICATE', {});
					}, 100);
					return; // Pause save until all answers are checked
				}
			}

			// Check for duplicate questions BEFORE clearing state
			if (questionChanges.length > 0) {

				questionChanges.forEach(questionId => {
					const questionData = questionChangesData[questionId];

					// Check for duplicate questions - applies to 'add' and 'library_replace' actions
					if (questionData.action === 'add' || questionData.action === 'library_replace') {
						// CRITICAL FIX: Only check against questions that have REAL UUIDs (already persisted to backend)
						// Skip any questions with temp IDs (they're all new questions in this save batch)
						const existingQuestions = [];
						if (state.currentQuestions?.questions) {
							state.currentQuestions.questions.forEach(existingQuestion => {
								// Don't compare with itself
								if (existingQuestion.ids.id !== questionId) {
									// ONLY include questions with real UUIDs (not temp_*)
									// These are questions that were already saved in previous operations
									const hasRealUUID = !existingQuestion.ids.id.startsWith('temp_');
									const hasNoChanges = !questionChanges.includes(existingQuestion.ids.id) && existingQuestion.isUnsaved !== true;

									if (hasRealUUID && hasNoChanges) {
										existingQuestions.push(existingQuestion.label.toLowerCase().trim());
									}
								}
							});
						}

						const currentQuestionLabel = questionData.label.toLowerCase().trim();

						if (existingQuestions.includes(currentQuestionLabel)) {
							validationErrors.push(`Question "${questionData.label}" already exists in this section. Please use a different name.`);
						}
					}
				});
			}


			// If any validation errors, show them and return early (preserve save/cancel buttons)
			if (validationErrors.length > 0) {
				updateState({
					savingQuestions: {}, // Clear all saving spinners
					systemMessages: [
						...(state.systemMessages || []),
						...validationErrors.map(error => ({
							type: 'error',
							message: error,
							timestamp: new Date().toISOString()
						}))
					]
				});
				return; // Exit early - validation failed, preserve editing state
			}

			// All validations passed - clear change tracking to hide save buttons
			updateState({
				sectionChanges: {},
				questionChanges: {},
				answerChanges: {},
				relationshipChanges: {},
				answerDuplicateCheckCompleted: false, // Reset for next save
				savingQuestions: {}, // Clear all saving spinners
				// Clear isUnsaved flags from all questions to hide save buttons
				currentQuestions: state.currentQuestions ? {
					...state.currentQuestions,
					questions: state.currentQuestions.questions.map(q => ({
						...q,
						isUnsaved: false
					}))
				} : state.currentQuestions
			});

			const hasChanges = sectionChanges.length > 0 || questionChanges.length > 0 || answerChanges.length > 0 || relationshipChanges.length > 0;

			if (hasChanges) {
				updateState({
					systemMessages: [
					...(state.systemMessages || []),
						
						{
							type: 'loading',
							message: 'Saving changes to backend...',
							timestamp: new Date().toISOString()
						}
					]
				});
			}
			
			// Save section changes in dependency order: parents first, then children
			if (sectionChanges.length > 0) {
				// Separate parent sections from child sections
				const parentSections = [];
				const childSections = [];

				sectionChanges.forEach(sectionId => {
					const sectionData = sectionChangesData[sectionId];

					// Handle deleted sections with DELETE API
					if (sectionData.deleted) {
						// Only delete if it's not a temporary ID (real UUIDs only)
						if (!sectionId.startsWith('temp_')) {
							dispatch('DELETE_SECTION_API', {
								sectionId: sectionId
							});
						}
						return;
					}

					// Check if this is a parent or child section by finding it in the assessment structure
					let isParentSection = false;
					let isChildSection = false;

					// Check if it's a parent section (top-level)
					for (const section of state.currentAssessment.sections) {
						if (section.id === sectionId) {
							isParentSection = true;
							break;
						}
						// Also check if it's a child section (subsection)
						if (section.subsections) {
							for (const subsection of section.subsections) {
								if (subsection.id === sectionId) {
									isChildSection = true;
									break;
								}
							}
						}
						if (isChildSection) break;
					}

					if (isParentSection) {
						parentSections.push({sectionId, sectionData});
					} else if (isChildSection) {
						childSections.push({sectionId, sectionData});
					} else {
						// If not found in either, it's likely a new parent section with temp ID
						parentSections.push({sectionId, sectionData});
					}
				});

				// Save parent sections first
				parentSections.forEach(({sectionId, sectionData}) => {
					dispatch('SAVE_SECTION', {
						sectionId: sectionId,
						sectionData: sectionData,
						config: state.careiqConfig,
						accessToken: state.accessToken
					});
				});

				// Child sections will be saved after parent sections are done
				// This will be handled by the parent section success handlers
				if (childSections.length > 0) {
					updateState({
						pendingChildSections: childSections
					});
				}
			}
			
			// Save question changes
			if (questionChanges.length > 0) {
				questionChanges.forEach(questionId => {
					const questionData = questionChangesData[questionId];
					// Handle new questions with ADD API
					if (questionData.action === 'add') {
						// CORRECT IMPLEMENTATION: 2-step process (add question to section, then add answers)
						// CRITICAL: Get current question from UI state to include ALL answers (not just from questionChanges)
						const currentQuestion = state.currentQuestions?.questions?.find(q => q.ids.id === questionId);
						const allAnswers = currentQuestion?.answers || questionData.answers || [];

						// Step 1: Add question to section (NO answers in this call)
						const backendQuestionData = {
							label: questionData.label,
							type: questionData.type,
							tooltip: questionData.tooltip || '',
							alternative_wording: '',
							sort_order: questionData.sort_order,
							custom_attributes: {},
							voice: currentQuestion?.voice || questionData.voice || 'CaseManager',
							required: questionData.required || false,
							available: false,
							has_quality_measures: false
						};

						dispatch('ADD_QUESTION_TO_SECTION_API', {
							questionData: backendQuestionData,
							sectionId: state.selectedSection,
							pendingAnswers: allAnswers // Step 2 will add these after question creation
						});
					} else if (questionData.action === 'delete') {
						// Skip if the question has a temp ID (was never saved to backend)
						if (questionId.startsWith('temp_')) {
							return;
						}
						
						dispatch('DELETE_QUESTION_API', {
							questionId: questionId
						});
					} else if (questionData.action === 'library_replace') {
						// Find the current question to get actual UI values
						let currentQuestion = null;
						if (state.currentQuestions && state.currentQuestions.questions) {
							currentQuestion = state.currentQuestions.questions.find(q => q.ids.id === questionId);
						}

						if (!currentQuestion) {
							console.error('CRITICAL ERROR: Current question not found for library save!');
							return;
						}

						// Get all library answers for this question
						const questionAnswers = currentQuestion.answers || [];
						// Use 2-step process for library questions to handle answers correctly
						// Use the standard 2-step API flow which now handles library answers correctly
						const libraryQuestionData = {
							label: currentQuestion.label,
							type: currentQuestion.type,
							tooltip: currentQuestion.tooltip || '',
							alternative_wording: questionData.alternative_wording || '',
							sort_order: currentQuestion.sort_order || 0,
							custom_attributes: {},
							voice: currentQuestion.voice || 'Patient',
							required: currentQuestion.required || false,
							available: false,
							has_quality_measures: false,
							library_id: currentQuestion.libraryQuestionId // Include library ID
						};
						dispatch('ADD_QUESTION_TO_SECTION_API', {
							questionData: libraryQuestionData,
							sectionId: state.selectedSection,
							pendingAnswers: questionAnswers // Raw answers - will be processed by API handler
						});
					} else if (questionData.action === 'update') {
						// Find the current question to get actual UI values
						let currentQuestion = null;
						if (state.currentQuestions && state.currentQuestions.questions) {
							currentQuestion = state.currentQuestions.questions.find(q => q.ids.id === questionId);
						}

						// Prepare data for backend API using actual current values
						const backendQuestionData = {
							questionId: questionId,
							label: currentQuestion ? currentQuestion.label : questionData.label,
							tooltip: currentQuestion ? (currentQuestion.tooltip || '') : (questionData.tooltip || ''),
							alternative_wording: questionData.alternative_wording || 'string',
							required: currentQuestion ? (currentQuestion.required || false) : (questionData.required || false),
							custom_attributes: questionData.custom_attributes || {},
							sort_order: currentQuestion ? (currentQuestion.sort_order || 0) : (questionData.sort_order || 0),
							voice: currentQuestion ? (currentQuestion.voice || 'Patient') : (questionData.voice || 'Patient'),
							type: currentQuestion ? currentQuestion.type : questionData.type
						};

						dispatch('UPDATE_QUESTION_API', {
							questionData: backendQuestionData
						});
					}
					// TODO: Complete question update implementation
				});
			}
			
			// Save answer changes - Group by question and action type
			// Note: Library matching happens during interactive typeahead, not during save
			if (answerChanges.length > 0) {
				// Group answers by question ID and action type
				const answersGroupedByQuestion = {};
				const individualAnswers = [];

				answerChanges.forEach(answerId => {
					const answerData = answerChangesData[answerId];

					// Treat temp IDs with 'update' as 'add' (new answers that were edited)
					const isTempAnswer = answerId.startsWith('temp_');
					const isAddAction = answerData.action === 'add' || answerData.action === 'library_replace' || (isTempAnswer && answerData.action === 'update');

					if (isAddAction) {

						// Skip if the question is also new (temp ID) - will be handled with question creation
						if (answerData.question_id && answerData.question_id.startsWith('temp_')) {
							return;
						}

						// Find the question ID for this answer
						let questionId = answerData.question_id || answerData.questionId;

						// For library_replace, we need to find the question ID from the current questions
						if (!questionId && answerData.action === 'library_replace') {
							if (state.currentQuestions && state.currentQuestions.questions) {
								for (let question of state.currentQuestions.questions) {
									if (question.answers) {
										const foundAnswer = question.answers.find(ans => ans.ids.id === answerId);
										if (foundAnswer) {
											questionId = question.ids.id;
											break;
										}
									}
								}
							}
						}

						if (questionId && !questionId.startsWith('temp_')) {
							if (!answersGroupedByQuestion[questionId]) {
								answersGroupedByQuestion[questionId] = [];
							}
							answersGroupedByQuestion[questionId].push({ answerId, answerData });
						}
					} else {
						// Individual operations (update, delete, library_add, etc.)
						individualAnswers.push({ answerId, answerData });
					}
				});

				// Process grouped new answers first (use bulk ADD_ANSWERS_TO_QUESTION API)
				Object.keys(answersGroupedByQuestion).forEach(questionId => {
					const answersForQuestion = answersGroupedByQuestion[questionId];
					// Prepare answers array for bulk API
					const answersArray = answersForQuestion.map(({ answerId, answerData }) => {
						// Handle library answers differently - use library ID instead of creating new answer
						if (answerData.action === 'library_replace') {
							// Find the current answer to get sort_order
							let currentAnswer = null;
							if (state.currentQuestions && state.currentQuestions.questions) {
								for (let question of state.currentQuestions.questions) {
									if (question.answers) {
										currentAnswer = question.answers.find(ans => ans.ids.id === answerId);
										if (currentAnswer) break;
									}
								}
							}

							return {
								library_id: answerData.library_id, // Use library ID for library answers
								sort_order: currentAnswer ? currentAnswer.sort_order : 0, // Required field
								label: answerData.label,
								tooltip: answerData.tooltip || '',
								alternative_wording: answerData.alternative_wording || '',
								secondary_input_type: answerData.secondary_input_type,
								mutually_exclusive: answerData.mutually_exclusive || false,
								custom_attributes: answerData.custom_attributes || {},
								required: answerData.required || false
							};
						} else {
							// Handle regular new answers
							// Find the current answer in questions to get actual UI values
							let currentAnswer = null;
							if (state.currentQuestions && state.currentQuestions.questions) {
								for (let question of state.currentQuestions.questions) {
									if (question.answers) {
										currentAnswer = question.answers.find(ans => ans.ids.id === answerId);
										if (currentAnswer) break;
									}
								}
							}

							const answerPayload = {
								label: currentAnswer ? currentAnswer.label : answerData.label,
								sort_order: currentAnswer ? currentAnswer.sort_order : 0, // Required field
								tooltip: currentAnswer ? (currentAnswer.tooltip || '') : (answerData.tooltip || ''),
								alternative_wording: answerData.alternative_wording || '',
								secondary_input_type: currentAnswer ? currentAnswer.secondary_input_type : answerData.secondary_input_type,
								mutually_exclusive: currentAnswer ? (currentAnswer.mutually_exclusive || false) : (answerData.mutually_exclusive || false),
								custom_attributes: answerData.custom_attributes || {},
								required: answerData.required || false
							};

							// Add library_id if this answer was matched to library during duplicate check
							if (answerData.library_id || (currentAnswer && currentAnswer.library_id)) {
								answerPayload.library_id = answerData.library_id || currentAnswer.library_id;
							}

							return answerPayload;
						}
					});

					// Call bulk ADD_ANSWERS_TO_QUESTION API
					const requestBody = JSON.stringify({
						questionId: questionId,
						guideline_template_id: state.currentAssessmentId,
						answers: answersArray
					});
					dispatch('MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST', { requestBody });
				});

				// Process individual answer operations
				individualAnswers.forEach(({ answerId, answerData }) => {
					if (answerData.action === 'delete') {
						// Skip if the answer has a temp ID (was never saved to backend)
						if (answerId.startsWith('temp_')) {
							return;
						}

						dispatch('DELETE_ANSWER_API', {
							answerId: answerId,
							suppressMessage: true // Suppress individual success message during bulk save
						});
					} else if (answerData.action === 'update') {
						// Find the current answer in questions to get actual UI values
						let currentAnswer = null;
						if (state.currentQuestions && state.currentQuestions.questions) {
							for (let question of state.currentQuestions.questions) {
								if (question.answers) {
									currentAnswer = question.answers.find(ans => ans.ids.id === answerId);
									if (currentAnswer) break;
								}
							}
						}
						
						// Prepare data for backend API using actual current values
						const backendAnswerData = {
							answerId: answerId,
							label: currentAnswer ? currentAnswer.label : answerData.label,
							tooltip: currentAnswer ? (currentAnswer.tooltip || '') : (answerData.tooltip || ''),
							alternative_wording: answerData.alternative_wording || 'string',
							required: currentAnswer ? (currentAnswer.required || false) : (answerData.required || false),
							custom_attributes: answerData.custom_attributes || {},
							sort_order: currentAnswer ? (currentAnswer.sort_order || 0) : (answerData.sort_order || 0),
							secondary_input_type: currentAnswer ? currentAnswer.secondary_input_type : answerData.secondary_input_type,
							mutually_exclusive: currentAnswer ? (currentAnswer.mutually_exclusive || false) : (answerData.mutually_exclusive || false)
						};
						
						dispatch('UPDATE_ANSWER_API', {
							answerData: backendAnswerData
						});
					}
				});
			}

			// Save relationship changes
			if (relationshipChanges.length > 0) {
				relationshipChanges.forEach(relationshipKey => {
					const relationshipData = relationshipChangesData[relationshipKey];
					if (relationshipData.action === 'add' && relationshipData.relationshipType === 'question') {
						dispatch('ADD_BRANCH_QUESTION', {
							answerId: relationshipData.answerId,
							questionId: relationshipData.targetId,
							questionLabel: relationshipData.targetLabel
						});
					} else if (relationshipData.action === 'delete' && relationshipData.relationshipType === 'question') {
						dispatch('DELETE_BRANCH_QUESTION', {
							answerId: relationshipData.answerId,
							questionId: relationshipData.targetId,
							questionLabel: relationshipData.targetLabel
						});
					} else if (relationshipData.action === 'add' && relationshipData.relationshipType === 'guideline') {
						const requestBody = JSON.stringify({
							answerId: relationshipData.answerId,
							guidelineId: relationshipData.targetId
						});
						dispatch('MAKE_ADD_GUIDELINE_RELATIONSHIP_REQUEST', {
							requestBody: requestBody,
							meta: {
								answerId: relationshipData.answerId,
								guidelineId: relationshipData.targetId,
								guidelineName: relationshipData.targetLabel
							}
						});
					}
					// TODO: Handle other relationship types (problems, barriers) and guideline delete when implemented
				});
			}
			
			if (!hasChanges) {
				// No changes to save
				updateState({
					systemMessages: [
					...(state.systemMessages || []),

						{
							type: 'warning',
							message: 'No changes to save.',
							timestamp: new Date().toISOString()
						}
					]
				});
			}
		},

		'CHECK_NEXT_ANSWER_FOR_DUPLICATE': (coeffects) => {
			const {state, dispatch, updateState} = coeffects;
			const answersToCheck = state.pendingAnswersToCheck || [];
			const currentIndex = state.pendingAnswersCheckIndex || 0;


			if (currentIndex >= answersToCheck.length) {
				// All answers checked, no duplicates found - continue with save

				// CRITICAL: Store answers before clearing, then clear state before resume
				const finalAnswersToTransfer = answersToCheck;

				updateState({
					pendingAnswersToCheck: null, // MUST clear before resume to prevent infinite loop
					pendingAnswersCheckIndex: null,
					isCheckingAnswerDuplicates: false,
					answerDuplicateCheckCompleted: true, // Mark as completed to prevent re-checking
					answersToTransferLibraryIds: finalAnswersToTransfer, // Store for transfer
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'success',
							message: 'All answers validated successfully! Continuing save...',
							timestamp: new Date().toISOString()
						}
					]
				});

				// Resume the save process by calling SAVE_ALL_CHANGES again
				// This time pendingAnswersToCheck will be null so it won't re-check
				setTimeout(() => {
					dispatch('RESUME_SAVE_AFTER_ANSWER_CHECK', {});
				}, 100);
				return;
			}

			const answerToCheck = answersToCheck[currentIndex];

			// Store context in state for SUCCESS handler
			updateState({
				answerDuplicateCheckContext: answerToCheck
			});

			// Call answer typeahead to check for exact match
			dispatch('GENERIC_TYPEAHEAD_SEARCH', {
				searchText: answerToCheck.answerLabel,
				type: 'answer',
				isPreSaveCheck: true
			});
		},

		'RESUME_SAVE_AFTER_ANSWER_CHECK': (coeffects) => {
			const {state, dispatch, updateState} = coeffects;


			// Transfer library_id from answersToTransferLibraryIds to actual question answers
			// This was stored before clearing pendingAnswersToCheck
			const answersToCheck = state.answersToTransferLibraryIds || [];

			if (answersToCheck.length > 0 && state.currentQuestions?.questions) {
				// Update questions with library_id for matched answers
				const updatedQuestions = state.currentQuestions.questions.map(question => {
					// Check if this question has answers that were checked
					const answersForThisQuestion = answersToCheck.filter(a => a.questionId === question.ids.id);

					if (answersForThisQuestion.length > 0) {
						// Update answers with library_id
						const updatedAnswers = question.answers.map(answer => {
							const matchedAnswer = answersForThisQuestion.find(a => a.answerLabel === answer.label);
							if (matchedAnswer && matchedAnswer.library_id) {
								return {
									...answer,
									library_id: matchedAnswer.library_id,
									isLibraryAnswer: true
								};
							}
							return answer;
						});

						return {
							...question,
							answers: updatedAnswers
						};
					}

					return question;
				});

				// ALSO update answerChanges with library_id for answers being added
				const updatedAnswerChanges = {...state.answerChanges};
				answersToCheck.forEach(checkedAnswer => {
					if (checkedAnswer.library_id && checkedAnswer.answerId) {
						const answerChange = updatedAnswerChanges[checkedAnswer.answerId];
						if (answerChange) {
							updatedAnswerChanges[checkedAnswer.answerId] = {
								...answerChange,
								library_id: checkedAnswer.library_id,
								isLibraryAnswer: true
							};
						}
					}
				});

				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					},
					answerChanges: updatedAnswerChanges,
					answersToTransferLibraryIds: null // Clear after use
				});
			} else {
				updateState({
					answersToTransferLibraryIds: null // Clear even if no transfer needed
				});
			}

			// Re-run SAVE_ALL_CHANGES but without answer checking
			// (pendingAnswersToCheck is already null so it won't re-check)
			dispatch('SAVE_ALL_CHANGES', {});
		},

		'SAVE_SECTION': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {sectionId, sectionData, config, accessToken} = action.payload;
			// Check if this is a new section (add) or existing section (update)
			// New sections have either action='add' or temp IDs starting with 'temp_'
			if (sectionData.action === 'add' || sectionId.startsWith('temp_')) {
				const requestBody = JSON.stringify({
					sort_order: sectionData.sort_order || 1,
					gt_id: sectionData.gt_id,
					label: sectionData.label || '',
					parent_section_id: sectionData.parent_section_id,
					library_id: sectionData.library_id || null
				});
				dispatch('MAKE_ADD_SECTION_REQUEST', {requestBody: requestBody});
				
			} else {
				const requestBody = JSON.stringify({
					sectionId: sectionId,
					label: sectionData.label || '',
					tooltip: sectionData.tooltip || '',
					alternative_wording: sectionData.alternative_wording || '',
					required: sectionData.required || false,
					custom_attributes: sectionData.custom_attributes || {},
					sort_order: sectionData.sort_order || 0
				});
				dispatch('MAKE_SECTION_UPDATE_REQUEST', {requestBody: requestBody, sectionId: sectionId});
			}
		},

		'MAKE_SECTION_UPDATE_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-section', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'SECTION_UPDATE_SUCCESS',
			errorActionType: 'SECTION_UPDATE_ERROR',
			metaParam: 'sectionId'
		}),

		'MAKE_ADD_SECTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-section', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_SECTION_SUCCESS',
			errorActionType: 'ADD_SECTION_ERROR'
		}),


		'ADD_QUESTION_TO_SECTION_API': (coeffects) => {
			const {action, dispatch, state, updateState} = coeffects;
			const {questionData, sectionId, pendingAnswers} = action.payload;

			if (pendingAnswers && pendingAnswers.length > 0) {
				pendingAnswers.forEach((ans, idx) => {
				});
			}

			// CRITICAL: For library questions, use minimal payload (only sort_order and library_id)
			let requestBodyData;
			if (questionData.library_id) {
				requestBodyData = {
					sectionId: sectionId,
					sort_order: questionData.sort_order,
					library_id: questionData.library_id
				};
			} else {
				// DEBUG: Log the voice value we're about to send
				console.log('ADD_QUESTION_TO_SECTION_API - questionData.voice:', questionData.voice);
				console.log('ADD_QUESTION_TO_SECTION_API - Full questionData:', questionData);

				// Regular question - use full payload
				requestBodyData = {
					sectionId: sectionId,
					label: questionData.label,
					type: questionData.type,
					tooltip: questionData.tooltip || '',
					alternative_wording: questionData.alternative_wording || '',
					sort_order: questionData.sort_order,
					custom_attributes: questionData.custom_attributes || {},
					voice: questionData.voice || 'CaseManager',
					required: questionData.required || false,
					available: questionData.available || false,
					has_quality_measures: questionData.has_quality_measures || false
				};

				// DEBUG: Log the final voice value being sent
				console.log('ADD_QUESTION_TO_SECTION_API - Final voice in requestBodyData:', requestBodyData.voice);

				// Add library_id for library questions
				if (questionData.library_id) {
					requestBodyData.library_id = questionData.library_id;
				}
			}

			// Store question metadata for bundle creation decision
			const shouldCreateBundle = !questionData.library_id &&
				(questionData.type === 'Single Select' || questionData.type === 'Multiselect') &&
				pendingAnswers && pendingAnswers.length > 0;

			// Store pending answers and metadata in state for later use in success handler
			if (pendingAnswers && pendingAnswers.length > 0) {
				// Process pending answers to add library_id for library answers ONLY
				const processedPendingAnswers = pendingAnswers.map((answer, index) => {
					// Base payload for all answers (library and non-library)
					const answerPayload = {
						sort_order: answer.sort_order || index,
						label: answer.label,
						tooltip: answer.tooltip || '',
						alternative_wording: answer.alternative_wording || '',
						secondary_input_type: answer.secondary_input_type || null,
						mutually_exclusive: answer.mutually_exclusive || false,
						custom_attributes: answer.custom_attributes || {},
						required: answer.required || false
					};

					// ONLY add library_id for library answers
					if (answer.isLibraryAnswer && answer.library_id) {
						answerPayload.library_id = answer.library_id;
					} else {
					}
					return answerPayload;
				});

				updateState({
					pendingQuestionAnswers: processedPendingAnswers,
					pendingQuestionMetadata: {
						shouldCreateBundle: shouldCreateBundle,
						questionType: questionData.type,
						isLibrary: !!questionData.library_id
					}
				});
			}


			const requestBody = JSON.stringify(requestBodyData);


			dispatch('MAKE_ADD_QUESTION_TO_SECTION_REQUEST', {requestBody: requestBody});
		},

		'ADD_ANSWER_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {answerData} = action.payload;
			// Prepare request body following the established pattern (direct fields, no data wrapper)
			const requestBody = JSON.stringify({
				label: answerData.label,
				tooltip: answerData.tooltip,
				alternative_wording: answerData.alternative_wording,
				secondary_input_type: answerData.secondary_input_type,
				mutually_exclusive: answerData.mutually_exclusive,
				custom_attributes: answerData.custom_attributes,
				required: answerData.required,
				sort_order: answerData.sort_order,
				question_id: answerData.question_id,
				guideline_template_id: answerData.guideline_template_id
			});
			dispatch('MAKE_ADD_ANSWER_REQUEST', {requestBody: requestBody});
		},

		'DELETE_ANSWER_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {answerId, suppressMessage} = action.payload;
			// Prepare request body following the established pattern (direct fields, no data wrapper)
			const requestBody = JSON.stringify({
				answerId: answerId
			});
			dispatch('MAKE_DELETE_ANSWER_REQUEST', {
				requestBody: requestBody
			});
		},

		'UPDATE_ANSWER_API': (coeffects) => {
			const {action, dispatch, updateState} = coeffects;
			const {answerData, skipReload} = action.payload;

			// Store skipReload flag in state for success handler to check
			if (skipReload) {
				updateState({
					skipAnswerUpdateReload: true
				});
			}

			// Prepare request body following the established pattern (direct fields, no data wrapper)
			const requestBody = JSON.stringify({
				answerId: answerData.answerId,
				label: answerData.label,
				tooltip: answerData.tooltip,
				alternative_wording: answerData.alternative_wording,
				required: answerData.required,
				custom_attributes: answerData.custom_attributes,
				sort_order: answerData.sort_order,
				secondary_input_type: answerData.secondary_input_type,
				mutually_exclusive: answerData.mutually_exclusive
			});
			dispatch('MAKE_UPDATE_ANSWER_REQUEST', {requestBody: requestBody});
		},

		'MAKE_UPDATE_ANSWER_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-answer', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'UPDATE_ANSWER_SUCCESS',
			errorActionType: 'UPDATE_ANSWER_ERROR'
		}),

		'UPDATE_ANSWER_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			// Clear the skipReload flag if it was set
			if (state.skipAnswerUpdateReload) {
				updateState({
					skipAnswerUpdateReload: false
				});
			}

			// Default behavior: NO reload (same as questions)
			// Just show success message and force UI re-render
			updateState({
				renderKey: Date.now(), // Force re-render
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Answer updated successfully!',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'UPDATE_ANSWER_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Update answer error:', action.payload);

			// Follow standard backend error extraction pattern
			let errorMessage = 'Unknown error';
			if (action.payload?.detail) {
				errorMessage = action.payload.detail;
			} else if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			} else if (action.payload?.statusText) {
				errorMessage = action.payload.statusText;
			}

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: 'Failed to update answer: ' + errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'DELETE_QUESTION_API': (coeffects) => {
			const {action, dispatch, updateState, state} = coeffects;
			const {questionId} = action.payload;

			// Set loading state for this question
			updateState({
				deletingQuestions: {
					...state.deletingQuestions,
					[questionId]: true
				}
			});

			// Prepare request body following the established pattern (direct fields, no data wrapper)
			const requestBody = JSON.stringify({
				questionId: questionId
			});
			dispatch('MAKE_DELETE_QUESTION_REQUEST', {requestBody: requestBody, questionId: questionId});
		},

		'UPDATE_QUESTION_API': (coeffects) => {
			const {action, dispatch, updateState, state} = coeffects;
			const {questionData} = action.payload;
			const questionId = questionData.questionId;


			// Prepare request body following the established pattern (direct fields, no data wrapper)
			const requestBody = JSON.stringify({
				questionId: questionData.questionId,
				label: questionData.label,
				tooltip: questionData.tooltip,
				alternative_wording: questionData.alternative_wording,
				required: questionData.required,
				custom_attributes: questionData.custom_attributes,
				sort_order: questionData.sort_order,
				voice: questionData.voice,
				type: questionData.type
			});
			dispatch('MAKE_UPDATE_QUESTION_REQUEST', {requestBody: requestBody, questionId: questionId});
		},

		'MAKE_UPDATE_QUESTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-question', {
			method: 'POST',
			dataParam: 'requestBody',
			metaParam: 'questionId',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'UPDATE_QUESTION_SUCCESS',
			errorActionType: 'UPDATE_QUESTION_ERROR'
		}),

		'UPDATE_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;


			// Clear questionChanges for the saved question
			const questionId = state.lastSavedQuestionId;
			const updatedQuestionChanges = {...state.questionChanges};
			if (questionId && updatedQuestionChanges[questionId]) {
				delete updatedQuestionChanges[questionId];
			}

			// Clear saving state
			const updatedSavingQuestions = {...state.savingQuestions};
			if (questionId) {
				delete updatedSavingQuestions[questionId];
			}

			// Just show success message - no refresh needed
			// CRITICAL: Force UI re-render by updating renderKey
			updateState({
				questionChanges: updatedQuestionChanges,
				lastSavedQuestionId: null,
				savingQuestions: updatedSavingQuestions,
				renderKey: Date.now(), // Force re-render
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'success',
						message: 'Question updated successfully!',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'UPDATE_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const errorMessage = action.payload?.error?.message || action.payload?.message || 'Failed to update question';

			console.error('Update question failed:', errorMessage);

			// Clear saving state on error
			const questionId = state.lastSavedQuestionId;
			const updatedSavingQuestions = {...state.savingQuestions};
			if (questionId) {
				delete updatedSavingQuestions[questionId];
			}

			updateState({
				savingQuestions: updatedSavingQuestions,
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'error',
						message: `Failed to update question: ${errorMessage}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},


		'MAKE_ADD_QUESTION_TO_SECTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-question-to-section', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_QUESTION_TO_SECTION_SUCCESS',
			errorActionType: 'ADD_QUESTION_TO_SECTION_ERROR'
		}),

		'MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-answers-to-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_ANSWERS_TO_QUESTION_SUCCESS',
			errorActionType: 'ADD_ANSWERS_TO_QUESTION_ERROR'
		}),

		'MAKE_CREATE_QUESTION_BUNDLE_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/create-question-bundle', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'CREATE_QUESTION_BUNDLE_SUCCESS',
			errorActionType: 'CREATE_QUESTION_BUNDLE_ERROR'
		}),

		'MAKE_CREATE_PROBLEM_BUNDLE_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/create-problem-bundle', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'CREATE_PROBLEM_BUNDLE_SUCCESS',
			errorActionType: 'CREATE_PROBLEM_BUNDLE_ERROR'
		}),

		'ADD_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			// Default success message
			let systemMessage = 'Question created successfully! Refreshing data...';
			let messageType = 'success';

			// COMPREHENSIVE backend message extraction - check ALL possible locations
			if (action.payload) {
				// Check direct detail field
				if (action.payload.detail) {
					systemMessage = action.payload.detail;
					messageType = action.payload.detail.toLowerCase().includes('duplicate') ? 'warning' : 'success';
				}
				// Check nested data.detail
				else if (action.payload.data && action.payload.data.detail) {
					systemMessage = action.payload.data.detail;
					messageType = action.payload.data.detail.toLowerCase().includes('duplicate') ? 'warning' : 'success';
				}
				// Check message field
				else if (action.payload.message) {
					systemMessage = action.payload.message;
					messageType = action.payload.message.toLowerCase().includes('error') ? 'error' : 'success';
				}
				// Check nested data.message
				else if (action.payload.data && action.payload.data.message) {
					systemMessage = action.payload.data.message;
					messageType = action.payload.data.message.toLowerCase().includes('error') ? 'error' : 'success';
				}
				// Check status_message field
				else if (action.payload.status_message) {
					systemMessage = action.payload.status_message;
					messageType = 'info';
				}
				// Check response field
				else if (action.payload.response) {
					systemMessage = action.payload.response;
					messageType = 'info';
				}
			}

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: messageType,
						message: systemMessage,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Check if this is a brand new Single Select/Multiselect question (not library)
			// If so, silently create a question bundle
			const originalRequest = action.payload?.originalRequest;
			const questionId = action.payload?.id;

			if (originalRequest && questionId && !originalRequest.library_id &&
				(originalRequest.type === 'Single Select' || originalRequest.type === 'Multiselect')) {

				// Create question bundle silently
				const requestBody = JSON.stringify({
					contentId: questionId
				});

				dispatch('MAKE_CREATE_QUESTION_BUNDLE_REQUEST', {requestBody: requestBody});
			}

			// Refresh the questions for the current section
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					config: state.careiqConfig,
					accessToken: state.accessToken
				});
			}
		},

		'ADD_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Question add error:', action.payload);

			// Follow standard backend error extraction pattern
			let errorMessage = 'Unknown error';
			if (action.payload?.detail) {
				errorMessage = action.payload.detail;
			} else if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			} else if (action.payload?.statusText) {
				errorMessage = action.payload.statusText;
			}

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: 'Error creating question: ' + errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CREATE_QUESTION_BUNDLE_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const questionLabel = action.meta?.questionLabel || 'Question';

			// Check if this was triggered by manual save button or auto-save
			const isManualSave = action.meta?.questionLabel; // Manual saves include questionLabel in meta

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: isManualSave
							? `Question bundle "${questionLabel}" saved to library successfully!`
							: 'Question bundle created successfully',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CREATE_QUESTION_BUNDLE_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const questionLabel = action.meta?.questionLabel || 'Question';
			const errorMessage = action.payload?.error || action.payload?.message || 'Unknown error';

			// Check if this was triggered by manual save button or auto-save
			const isManualSave = action.meta?.questionLabel;

			console.error('Question bundle creation failed:', action.payload);

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: isManualSave ? 'error' : 'info',
						message: isManualSave
							? `Failed to save question bundle "${questionLabel}": ${errorMessage}`
							: 'Question bundle creation skipped',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CREATE_PROBLEM_BUNDLE_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const problemLabel = state.currentProblemBundleLabel || 'Problem';

			updateState({
				currentProblemBundleLabel: null, // Clear after use
				modalSystemMessages: [
					...(state.modalSystemMessages || []),
					{
						type: 'success',
						message: `Problem bundle "${problemLabel}" saved to library successfully!`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CREATE_PROBLEM_BUNDLE_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const problemLabel = state.currentProblemBundleLabel || 'Problem';
			const errorMessage = action.payload?.error || action.payload?.message || 'Unknown error';

			console.error('CREATE_PROBLEM_BUNDLE_ERROR called!');
			console.error('Action:', action);
			console.error('Meta:', action.meta);
			console.error('Payload:', action.payload);
			console.error('Problem bundle creation failed:', action.payload);

			updateState({
				currentProblemBundleLabel: null, // Clear after use
				modalSystemMessages: [
					...(state.modalSystemMessages || []),
					{
						type: 'error',
						message: `Failed to save problem bundle "${problemLabel}": ${errorMessage}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'ADD_QUESTION_TO_SECTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;


			// Handle different response formats
			let newQuestionId = action.payload.id;
			let isLibraryResponse = false;

			// Check if this is a library question response (might have detail instead of id)
			if (!newQuestionId && action.payload.detail) {
				isLibraryResponse = true;
				// For library questions, we might need to generate a temporary ID or handle differently
				// The backend should still provide some way to identify the created question
			}

			// CHECK IF THIS IS PART OF A QUESTION MOVE OPERATION
			if (state.pendingQuestionMove) {
				const moveContext = state.pendingQuestionMove;

				// If this is a library question response (no new ID), it means the question
				// and its answers are already in the library, so we can skip adding answers
				// and proceed directly to delete from source
				if (isLibraryResponse || !newQuestionId) {

					// Show the backend detail message if available
					const backendMessage = action.payload.detail || 'Library question added';

					updateState({
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'success',
								message: backendMessage,
								timestamp: new Date().toISOString()
							},
							{
								type: 'loading',
								message: `Removing from "${moveContext.sourceSectionLabel}"...`,
								timestamp: new Date().toISOString()
							}
						]
					});

					const deleteRequestBody = JSON.stringify({
						region: state.careiqConfig.region,
						version: state.careiqConfig.version,
						accessToken: state.accessToken,
						app: state.careiqConfig.app,
						questionId: moveContext.questionId
					});

					dispatch('MAKE_DELETE_QUESTION_REQUEST', {requestBody: deleteRequestBody});
					return;
				}

				// Store the new question ID for the delete operation
				updateState({
					pendingQuestionMove: {
						...moveContext,
						newQuestionId: newQuestionId
					}
				});

				// If there are answers, add them to the new question
				if (moveContext.answers && moveContext.answers.length > 0 &&
					(moveContext.question.type === 'Single Select' || moveContext.question.type === 'Multiselect')) {

					// Transform answers to match API format
					const answersForAPI = moveContext.answers.map((answer, index) => {
						const apiAnswer = {
							sort_order: answer.sort_order || index,
							label: answer.label,
							tooltip: answer.tooltip || '',
							alternative_wording: '',
							secondary_input_type: answer.secondary_input_type || null,
							mutually_exclusive: answer.mutually_exclusive || false,
							custom_attributes: {},
							required: false
						};
						// Include library_id if this is a library answer
						if (answer.library_id) {
							apiAnswer.library_id = answer.library_id;
						}
						return apiAnswer;
					});

					const requestBody = JSON.stringify({
						questionId: newQuestionId,
						guideline_template_id: state.currentAssessmentId,
						answers: answersForAPI
					});

					// Update message
					updateState({
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'loading',
								message: `Question added to "${moveContext.targetSectionLabel}". Adding ${answersForAPI.length} answers...`,
								timestamp: new Date().toISOString()
							}
						]
					});

					dispatch('MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST', { requestBody });
					return; // Handler will continue in ADD_ANSWERS_TO_QUESTION_SUCCESS
				} else {
					// No answers to add, proceed directly to delete
					updateState({
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'loading',
								message: `Question added to "${moveContext.targetSectionLabel}". Removing from "${moveContext.sourceSectionLabel}"...`,
								timestamp: new Date().toISOString()
							}
						]
					});

					const deleteRequestBody = JSON.stringify({
						region: state.careiqConfig.region,
						version: state.careiqConfig.version,
						accessToken: state.accessToken,
						app: state.careiqConfig.app,
						questionId: moveContext.questionId
					});

					dispatch('MAKE_DELETE_QUESTION_REQUEST', {requestBody: deleteRequestBody});
					return; // Handler will continue in DELETE_QUESTION_SUCCESS
				}
			}
			// Find and update the temp question with the real ID locally
			// Match using lastSavedQuestionId to find the exact question that was just saved
			const savedQuestionId = state.lastSavedQuestionId;
			const updatedQuestions = state.currentQuestions.questions.map(question => {
				// If this is the temp question being saved, replace with real data
				// Check by ID match (not isUnsaved flag, which may be false for new questions)
				if (savedQuestionId && question.ids.id === savedQuestionId && question.ids.id.startsWith('temp_')) {
					return {
						...question,
						ids: { id: newQuestionId || question.ids.id }, // Replace temp ID with real ID
						isUnsaved: false // Remove the unsaved flag
					};
				}
				return question;
			});

			// Store the question ID for later use in bundle creation
			updateState({
				lastCreatedQuestionId: newQuestionId
			});

			// Check if there are pending answers to add (for Single Select/Multiselect questions)
			const pendingAnswers = state.pendingQuestionAnswers;
			if (pendingAnswers && pendingAnswers.length > 0) {
				// Handle library questions that might not return a real question ID
				if (!newQuestionId && isLibraryResponse) {
					updateState({
						currentQuestions: {
							...state.currentQuestions,
							questions: updatedQuestions
						},
						systemMessages: [
					...(state.systemMessages || []),
							
							{
								type: 'success',
								message: 'Library question added successfully! Please refresh to see complete data.',
								timestamp: new Date().toISOString()
							}
						],
						// Clear pending answers
						pendingQuestionAnswers: null
					});
					return;
				}

				// Validate newQuestionId for regular questions
				if (!newQuestionId) {
					console.error('CRITICAL ERROR: newQuestionId is missing! Cannot add answers.');
					updateState({
						systemMessages: [
					...(state.systemMessages || []),
							
							{
								type: 'error',
								message: 'Error: Question ID missing, cannot add answers.',
								timestamp: new Date().toISOString()
							}
						]
					});
					return;
				}

				// Transform answers to match API format - PRESERVE library_id if present
				const answersForAPI = pendingAnswers.map((answer, index) => {
					const apiAnswer = {
						sort_order: answer.sort_order || index,
						label: answer.label,
						tooltip: answer.tooltip || '',
						alternative_wording: '',
						secondary_input_type: answer.secondary_input_type || null,
						mutually_exclusive: answer.mutually_exclusive || false,
						custom_attributes: {},
						required: false
					};

					// CRITICAL: Preserve library_id for library answers (check both field names)
					if (answer.library_id || answer.library_id) {
						apiAnswer.library_id = answer.library_id || answer.library_id;
					}

					return apiAnswer;
				});
				// Create request body for add answers API
				// Don't add data wrapper - ServiceNow adds it automatically
				const requestBody = JSON.stringify({
					questionId: newQuestionId,
					answers: answersForAPI
				});
				// Dispatch the add answers request
				dispatch('MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST', { requestBody });

				// CRITICAL: Remove the saved question from questionChanges to prevent re-saving
				const updatedQuestionChanges = {...state.questionChanges};
				if (savedQuestionId) {
					delete updatedQuestionChanges[savedQuestionId];
				}

				// Update UI with message about adding answers and clear pending answers
				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					},
					systemMessages: [
					...(state.systemMessages || []),

						{
							type: 'success',
							message: 'Question added to section successfully! Adding answers...',
							timestamp: new Date().toISOString()
						}
					],
					// CRITICAL: Clear all question save tracking to prevent re-saving
					questionChanges: updatedQuestionChanges,  // Remove this question from changes
					pendingQuestionAnswers: null,
					lastSavedQuestionId: null,
					savingQuestions: {}  // Clear all saving states
				});
			} else {
				// No answers to add
				// Check if this is a library question (needs refresh to show properly)
				if (isLibraryResponse && action.payload.detail) {
					// Library question - show backend message and refresh
					updateState({
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'success',
								message: action.payload.detail,
								timestamp: new Date().toISOString()
							}
						]
					});

					// Refresh the section to show the library question
					if (state.selectedSection) {
						dispatch('FETCH_SECTION_QUESTIONS', {
							sectionId: state.selectedSection,
							sectionLabel: state.selectedSectionLabel
						});
					}
				} else {
					// CRITICAL: Remove the saved question from questionChanges to prevent re-saving
					const updatedQuestionChanges = {...state.questionChanges};
					if (savedQuestionId) {
						delete updatedQuestionChanges[savedQuestionId];
					}

					// Regular question - just update state and CLEAR tracking
					updateState({
						currentQuestions: {
							...state.currentQuestions,
							questions: updatedQuestions
						},
						systemMessages: [
							...(state.systemMessages || []),
							{
								type: 'success',
								message: 'Question added to section successfully! No refresh needed.',
								timestamp: new Date().toISOString()
							}
						],
						// CRITICAL: Clear all question save tracking to prevent re-saving
						questionChanges: updatedQuestionChanges,  // Remove this question from changes
						lastSavedQuestionId: null,
						pendingQuestionAnswers: null,
						savingQuestions: {}  // Clear all saving states
					});
				}
			}
		},

		'ADD_QUESTION_TO_SECTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Question add to section error:', action.payload);

			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to add question to section';

			updateState({
				movingQuestion: false,  // Clear loading spinner
				pendingQuestionMove: null,  // Clear move context
				// CRITICAL: Clear all question save tracking on error to prevent issues
				lastSavedQuestionId: null,
				pendingQuestionAnswers: null,
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'error',
						message: 'Error adding question to section: ' + errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'ADD_ANSWERS_TO_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			// CHECK IF THIS IS PART OF A QUESTION MOVE OPERATION
			if (state.pendingQuestionMove) {
				const moveContext = state.pendingQuestionMove;

				// Update message
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'loading',
							message: `Answers added successfully. Removing question from "${moveContext.sourceSectionLabel}"...`,
							timestamp: new Date().toISOString()
						}
					]
				});

				// Now delete the question from the source section
				const deleteRequestBody = JSON.stringify({
					region: state.careiqConfig.region,
					version: state.careiqConfig.version,
					accessToken: state.accessToken,
					app: state.careiqConfig.app,
					questionId: moveContext.questionId
				});

				dispatch('MAKE_DELETE_QUESTION_REQUEST', {requestBody: deleteRequestBody});
				return; // Handler will continue in DELETE_QUESTION_SUCCESS
			}

			// The response should contain array of answer UUIDs
			const newAnswerIds = action.payload;
			// Handle different response types - success vs duplicate/warning
			let message = 'Answer(s) added to question successfully!';
			let messageType = 'success';

			if (action.payload && action.payload.detail) {
				// Backend returned a detail message (usually duplicate warning)
				message = action.payload.detail;
				messageType = message.toLowerCase().includes('duplicate') ? 'warning' : 'info';
			} else if (newAnswerIds && Array.isArray(newAnswerIds)) {
				message = `${newAnswerIds.length} answer(s) added to question successfully!`;
			}

			updateState({
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: messageType,
						message: message,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Check if we should create a question bundle
			// This happens for brand new Single Select/Multiselect questions (not library)
			const metadata = state.pendingQuestionMetadata;
			const questionId = state.lastCreatedQuestionId; // We'll need to track this


			if (metadata && metadata.shouldCreateBundle && questionId) {

				// Create question bundle silently
				const requestBody = JSON.stringify({
					contentId: questionId
				});

				dispatch('MAKE_CREATE_QUESTION_BUNDLE_REQUEST', {requestBody: requestBody});

				// Clear metadata after use
				updateState({
					pendingQuestionMetadata: null,
					lastCreatedQuestionId: null
				});
			}

			// Refresh section to get real UUIDs for newly added answers
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'ADD_ANSWERS_TO_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Add answers to question error:', action.payload);

			// Surface backend error messages - check detail, error, and message fields
			const errorMessage = action.payload?.detail || action.payload?.error || action.payload?.message || 'Failed to add answers to question';

			updateState({
				movingQuestion: false,  // Clear modal spinner if this was part of a move
				pendingQuestionMove: null,  // Clear move context
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'error',
						message: errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'MAKE_ADD_ANSWER_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-answer', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_ANSWER_SUCCESS',
			errorActionType: 'ADD_ANSWER_ERROR'
		}),

		'MAKE_DELETE_ANSWER_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-answer', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_ANSWER_SUCCESS',
			errorActionType: 'DELETE_ANSWER_ERROR'
		}),

		'DELETE_ANSWER_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			updateState({
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'success',
						message: 'Answer deleted successfully!',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Refresh the questions for the current section to clear isUnsaved flags
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					config: state.careiqConfig,
					accessToken: state.accessToken
				});
			}
		},

		'DELETE_ANSWER_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Answer delete error:', action.payload);
			
			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to delete answer';
			
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'error',
						message: 'Error deleting answer: ' + errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'MAKE_DELETE_QUESTION_REQUEST': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_QUESTION_SUCCESS',
			errorActionType: 'DELETE_QUESTION_ERROR',
			metaParam: 'questionId'
		}),

		'DELETE_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const questionId = action.meta?.questionId;

			// Clear loading state
			const updatedDeletingQuestions = {...state.deletingQuestions};
			if (questionId) {
				delete updatedDeletingQuestions[questionId];
			}

			// CHECK IF THIS IS PART OF A QUESTION MOVE OPERATION
			if (state.pendingQuestionMove) {
				const moveContext = state.pendingQuestionMove;

				// Store move context for SECTION_QUESTIONS_SUCCESS to use
				// Don't change selected section or show message yet - wait until refresh completes
				updateState({
					deletingQuestions: updatedDeletingQuestions,
					pendingQuestionMove: null, // Clear the move context
					questionMoveRefreshInProgress: moveContext  // Store full context for success handler
					// Keep movingQuestion: true during refresh
				});

				// Refresh target section
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: moveContext.targetSectionId,
					sectionLabel: moveContext.targetSectionLabel
				});

				return;
			}

			// The question was already removed locally by DELETE_QUESTION handler
			// Now refresh the section to update relationship badges
			updateState({
				deletingQuestions: updatedDeletingQuestions,
				questionsLoading: true, // Show spinner during refresh
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Question deleted successfully! Refreshing section...',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Refresh current section to update relationship badges
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'DELETE_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const questionId = action.meta?.questionId;

			// Clear loading state
			const updatedDeletingQuestions = {...state.deletingQuestions};
			if (questionId) {
				delete updatedDeletingQuestions[questionId];
			}

			console.error('Question delete error:', action.payload);

			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to delete question';

			updateState({
				deletingQuestions: updatedDeletingQuestions,
				movingQuestion: false,  // Clear modal spinner if this was part of a move
				pendingQuestionMove: null,  // Clear move context
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'error',
						message: 'Error deleting question: ' + errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'ADD_ANSWER_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// Log the answer UUID to console
			if (action.payload && action.payload.id) {
			}
			
			updateState({
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'success',
						message: 'Answer created successfully! Refreshing data...',
						timestamp: new Date().toISOString()
					}
				]
			});
			
			// Refresh the questions for the current section
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					config: state.careiqConfig,
					accessToken: state.accessToken
				});
			}
		},

		'ADD_ANSWER_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Answer add error:', action.payload);

			// Follow standard backend error extraction pattern
			let errorMessage = 'Unknown error';
			if (action.payload?.detail) {
				errorMessage = action.payload.detail;
			} else if (action.payload?.data?.error) {
				errorMessage = action.payload.data.error;
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			} else if (action.payload?.statusText) {
				errorMessage = action.payload.statusText;
			}

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: 'Error creating answer: ' + errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'SECTION_UPDATE_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const sectionId = action.meta?.sectionId;

			// Clear loading state
			const updatedUpdatingSections = {...state.updatingSections};
			if (sectionId) {
				delete updatedUpdatingSections[sectionId];
			}

			// Clear section changes for the updated section since it's now saved
			const updatedSectionChanges = {...state.sectionChanges};
			if (sectionId) {
				delete updatedSectionChanges[sectionId];
			}

			// The section was already updated locally by SAVE_SECTION_IMMEDIATELY or reordering
			// Just confirm the backend operation succeeded
			updateState({
				updatingSections: updatedUpdatingSections,
				sectionChanges: updatedSectionChanges,
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'success',
						message: 'Section updated successfully! No refresh needed.',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Check if there are pending child sections to save after parent sections are done
			if (state.pendingChildSections && state.pendingChildSections.length > 0) {
				// Save all pending child sections
				state.pendingChildSections.forEach(({sectionId, sectionData}) => {
					dispatch('SAVE_SECTION', {
						sectionId: sectionId,
						sectionData: sectionData,
						config: state.careiqConfig,
						accessToken: state.accessToken
					});
				});

				// Clear pending child sections
				updateState({
					pendingChildSections: []
				});
			}
		},

		'SECTION_UPDATE_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const sectionId = action.meta?.sectionId;

			// Clear loading state
			const updatedUpdatingSections = {...state.updatingSections};
			if (sectionId) {
				delete updatedUpdatingSections[sectionId];
			}

			console.error('Section update error:', action.payload);

			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to update section';

			updateState({
				updatingSections: updatedUpdatingSections,
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'error',
						message: `Error saving section: ${errorMessage}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'ADD_SECTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			// The response contains the new section ID, label comes from state
			const newSectionId = action.payload.id;
			const newSectionLabel = state.pendingNewSectionLabel;

			// Clear loading state and show success message
			updateState({
				addingSection: false,
				pendingNewSectionLabel: null, // Clear the stored label
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Section added successfully!',
						timestamp: new Date().toISOString()
					}
				]
			});

			// Refresh assessment data and automatically select the new section
			if (state.currentAssessmentId && newSectionLabel) {
				updateState({
					pendingReselectionSection: newSectionId,
					pendingReselectionSectionLabel: newSectionLabel
				});

				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessmentId
				});
			}
		},

		'ADD_SECTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Add section error:', action.payload);

			let errorMessage = 'Failed to add section';

			// Check for detailed validation errors (like UUID parsing errors)
			if (action.payload?.detail && Array.isArray(action.payload.detail)) {
				const detailMessages = action.payload.detail.map(detail => detail.msg || detail.message).filter(Boolean);
				if (detailMessages.length > 0) {
					errorMessage = detailMessages.join('; ');
				}
			} else if (action.payload?.error) {
				errorMessage = action.payload.error;
			} else if (action.payload?.message) {
				errorMessage = action.payload.message;
			}

			updateState({
				addingSection: false, // Clear loading state
				pendingNewSectionLabel: null, // Clear the stored label
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Error adding section: ${errorMessage}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'CANCEL_ALL_CHANGES': (coeffects) => {
			const {dispatch} = coeffects;

			// Show confirmation dialog
			dispatch('SHOW_CONFIRMATION_DIALOG', {
				message: 'Are you sure you want to cancel all unsaved changes? This action cannot be undone.',
				pendingAction: {
					type: 'CONFIRM_CANCEL_ALL_CHANGES',
					payload: {}
				}
			});
		},

		'CONFIRM_CANCEL_ALL_CHANGES': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;

			// Restore original assessment data
			if (state.originalAssessmentData) {
				updateState({
					currentAssessment: JSON.parse(JSON.stringify(state.originalAssessmentData)),
					sectionChanges: {},
					questionChanges: {},
					answerChanges: {},
					// Clear any editing states
					editingSectionId: null,
					editingSectionName: null
				});

				// Reload the current section questions if one is selected
				if (state.selectedSection) {
					dispatch('FETCH_SECTION_QUESTIONS', {
						sectionId: state.selectedSection,
						sectionLabel: state.selectedSectionLabel
					});
				}
			} else {
				// Fallback: just clear the changes tracking
				updateState({
					sectionChanges: {},
					questionChanges: {},
					answerChanges: {},
					relationshipChanges: {},
					editingSectionId: null,
					editingSectionName: null
				});
			}

			// Show toast message
			dispatch('SHOW_TOAST', {
				type: 'warning',
				message: 'All unsaved changes have been canceled.'
			});
		},

		'CANCEL_QUESTION_CHANGES': (coeffects) => {
			const {action, dispatch, state} = coeffects;
			const {questionId} = action.payload;

			if (!state.currentQuestions?.questions) {
				return;
			}

			// Show confirmation dialog
			dispatch('SHOW_CONFIRMATION_DIALOG', {
				message: 'Are you sure you want to cancel all changes to this question? This will reload the current data from the server.',
				pendingAction: {
					type: 'CONFIRM_CANCEL_QUESTION_CHANGES',
					payload: { questionId }
				}
			});
		},

		'CONFIRM_CANCEL_QUESTION_CHANGES': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId} = action.payload;

			// Set canceling state for spinner
			updateState({
				cancelingQuestions: {
					...state.cancelingQuestions,
					[questionId]: true
				}
			});

			// Clear any question-specific change tracking
			const updatedQuestionChanges = {...state.questionChanges};
			const updatedAnswerChanges = {...state.answerChanges};

			// Remove changes related to this question
			delete updatedQuestionChanges[questionId];

			// Remove answer changes related to this question
			Object.keys(updatedAnswerChanges).forEach(answerId => {
				const answerChange = updatedAnswerChanges[answerId];
				// Check if this answer change belongs to the question being canceled
				const belongsToQuestion = state.currentQuestions.questions
					.find(q => q.ids.id === questionId)
					?.answers?.some(a => a.ids.id === answerId);

				if (belongsToQuestion || answerChange.question_id === questionId) {
					delete updatedAnswerChanges[answerId];
				}
			});

			updateState({
				questionChanges: updatedQuestionChanges,
				answerChanges: updatedAnswerChanges
			});

			// Reload section to get fresh data from server
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		// Typeahead functionality for sections
		'SECTION_TYPEAHEAD_INPUT_CHANGE': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {searchText, debounce = true} = action.payload;
			// Clear existing timeout
			if (state.sectionTypeaheadDebounceTimeout) {
				clearTimeout(state.sectionTypeaheadDebounceTimeout);
			}
			
			// Update query and hide dropdown if search is too short
			if (searchText.length < 2) {
				updateState({
					sectionTypeaheadQuery: searchText,
					sectionTypeaheadVisible: false,
					sectionTypeaheadResults: [],
					sectionTypeaheadDebounceTimeout: null
				});
				return;
			}
			
			updateState({
				sectionTypeaheadQuery: searchText,
				sectionTypeaheadVisible: true
			});
			
			if (debounce) {
				// Set new timeout for debounced search
				const timeoutId = setTimeout(() => {
					const requestBody = JSON.stringify({
						searchText: searchText,
						contentType: 'section',
						region: state.careiqConfig.region,
						version: state.careiqConfig.version,
						accessToken: state.accessToken,
						app: state.careiqConfig.app
					});
					dispatch('SECTION_TYPEAHEAD_SEARCH', { requestBody });
				}, 500);
				
				updateState({
					sectionTypeaheadDebounceTimeout: timeoutId
				});
			} else {
				const requestBody = JSON.stringify({
					searchText: searchText,
					contentType: 'section',
					region: state.careiqConfig.region,
					version: state.careiqConfig.version,
					accessToken: state.accessToken,
					app: state.careiqConfig.app
				});
				dispatch('SECTION_TYPEAHEAD_SEARCH', { requestBody });
			}
		},

		'SECTION_TYPEAHEAD_SEARCH': createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/generic-typeahead', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			startActionType: 'SECTION_TYPEAHEAD_SEARCH_START',
			successActionType: 'SECTION_TYPEAHEAD_SEARCH_SUCCESS', 
			errorActionType: 'SECTION_TYPEAHEAD_SEARCH_ERROR'
		}),

		'SECTION_TYPEAHEAD_SEARCH_START': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				sectionTypeaheadLoading: true
			});
		},

		'SECTION_TYPEAHEAD_SEARCH_SUCCESS': (coeffects) => {
			const {action, updateState} = coeffects;
			const response = action.payload;
			const results = response.results || [];
			updateState({
				sectionTypeaheadLoading: false,
				sectionTypeaheadResults: results,
				sectionTypeaheadSelectedIndex: -1
			});
		},

		'SECTION_TYPEAHEAD_SEARCH_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Section typeahead search error:', action.payload);
			console.error('Error details:', JSON.stringify(action.payload));
			console.error('HTTP status:', action.payload?.status || 'unknown');
			
			updateState({
				sectionTypeaheadLoading: false,
				sectionTypeaheadResults: [],
				sectionTypeaheadVisible: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: 'Failed to search section library. Please try again.',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'SECTION_TYPEAHEAD_SELECT': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {selectedItem} = action.payload;
			// Get section name from either name or label field
			const sectionName = selectedItem.name || selectedItem.label;
			// Update the editing section name with selected item
			updateState({
				editingSectionName: sectionName,
				sectionTypeaheadVisible: false,
				sectionTypeaheadQuery: sectionName,
				sectionTypeaheadResults: [],
				// Store the master_id for use as library_id when creating the section
				selectedSectionLibraryId: selectedItem.master_id
			});
		},

		'SEARCH_ANSWERS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {searchText, answerId} = action.payload;

			const requestBody = JSON.stringify({
				searchText: searchText,
				contentType: 'answer'
			});

			// Use same pattern as questions for reliable context storage
			const answerSearchContext = {
				contentType: 'answer',
				answerId: answerId,
				searchText: searchText
			};

			updateState({
				answerTypeaheadLoading: true,
				currentAnswerSearchQuestionId: answerId,
				currentAnswerSearchContext: answerSearchContext  // Store context like questions
			});

			dispatch('MAKE_GENERIC_TYPEAHEAD_REQUEST', {
				requestBody: requestBody,
				meta: {
					searchText: searchText,
					contentType: 'answer',
					answerId: answerId
				}
			});
		},

		'ANSWER_TYPEAHEAD_INPUT_CHANGE': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {searchText, answerId} = action.payload;

			// Clear existing timeout
			if (state.answerTypeaheadDebounceTimeout) {
				clearTimeout(state.answerTypeaheadDebounceTimeout);
			}

			// Set up debounced search
			const timeout = setTimeout(() => {
				dispatch('SEARCH_ANSWERS', {
					searchText: searchText,
					answerId: answerId
				});
			}, 300);

			updateState({
				answerTypeaheadDebounceTimeout: timeout,
				answerTypeaheadQuery: searchText,
				editingAnswerId: answerId,
				answerTypeaheadVisible: searchText.length >= 2
			});
		},

		'SELECT_LIBRARY_ANSWER': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, libraryAnswer} = action.payload;
			// Hide typeahead dropdown but keep answer visible during fetch
			updateState({
				answerTypeaheadVisible: false,
				answerTypeaheadLoading: true,
				pendingLibraryAnswerReplacementId: answerId
			});

			// Fetch full library answer details
			const requestBody = JSON.stringify({
				answerId: libraryAnswer.id
			});

			dispatch('MAKE_LIBRARY_ANSWER_REQUEST', {
				requestBody: requestBody,
				meta: {
					targetAnswerId: answerId
				}
			});
		},

		'REPLACE_ANSWER_WITH_LIBRARY': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, libraryAnswerData} = action.payload;
			// Find the answer and replace it with library data
			const updatedQuestions = state.currentQuestions.questions.map(question => ({
				...question,
				answers: question.answers?.map(answer => {
					if (answer.ids.id === answerId) {
						return {
							...answer,
							label: libraryAnswerData.label,
							tooltip: libraryAnswerData.tooltip || '',
							alternative_wording: libraryAnswerData.alternative_wording || '',
							secondary_input_type: libraryAnswerData.secondary_input_type,
							mutually_exclusive: libraryAnswerData.mutually_exclusive || false,
							isLibraryAnswer: true,
							library_id: libraryAnswerData.id,
							libraryStatus: 'unmodified',
							originalLibraryData: {
								label: libraryAnswerData.label,
								tooltip: libraryAnswerData.tooltip || '',
								alternative_wording: libraryAnswerData.alternative_wording || '',
								secondary_input_type: libraryAnswerData.secondary_input_type,
								mutually_exclusive: libraryAnswerData.mutually_exclusive || false
							}
						};
					}
					return answer;
				}) || []
			}));

			// Track this answer as changed for saving
			const answerChanges = {
				...state.answerChanges,
				[answerId]: {
					action: 'library_replace',
					isLibraryAnswer: true,
					library_id: libraryAnswerData.id,
					libraryStatus: 'unmodified',
					originalLibraryData: {
						label: libraryAnswerData.label,
						tooltip: libraryAnswerData.tooltip || '',
						alternative_wording: libraryAnswerData.alternative_wording || '',
						secondary_input_type: libraryAnswerData.secondary_input_type,
						mutually_exclusive: libraryAnswerData.mutually_exclusive || false
					},
					...libraryAnswerData
				}
			};

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				answerChanges: answerChanges,
				answerTypeaheadLoading: false,
				answerTypeaheadResults: [],
				answerTypeaheadQuery: '',
				pendingLibraryAnswerReplacementId: null,
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'success',
						message: `Answer replaced with library answer: "${libraryAnswerData.label}"`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'ANSWER_TYPEAHEAD_HIDE': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				answerTypeaheadVisible: false,
				answerTypeaheadResults: [],
				answerTypeaheadQuery: '',
				answerTypeaheadLoading: false,
				currentAnswerSearchQuestionId: null,
				currentAnswerSearchContext: null  // CRITICAL: Must clear context to stop loading state
			});
		},

		'SECTION_TYPEAHEAD_HIDE': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				sectionTypeaheadVisible: false,
				sectionTypeaheadSelectedIndex: -1
			});
		},

		'SECTION_TYPEAHEAD_KEYBOARD': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {key, index} = action.payload;
			
			if (!state.sectionTypeaheadVisible || state.sectionTypeaheadResults.length === 0) {
				return;
			}
			
			const results = state.sectionTypeaheadResults;
			let newIndex = state.sectionTypeaheadSelectedIndex;
			
			switch (key) {
				case 'ArrowDown':
					newIndex = Math.min(newIndex + 1, results.length - 1);
					break;
				case 'ArrowUp':
					newIndex = Math.max(newIndex - 1, -1);
					break;
				case 'Enter':
					if (newIndex >= 0) {
						dispatch('SECTION_TYPEAHEAD_SELECT', {
							selectedItem: results[newIndex]
						});
					}
					return;
				case 'Escape':
					dispatch('SECTION_TYPEAHEAD_HIDE');
					return;
				case 'MouseEnter':
					newIndex = index;
					break;
				default:
					return;
			}
			
			updateState({
				sectionTypeaheadSelectedIndex: newIndex
			});
		},

		// Relationship Panel Actions (converted from modal)
		'OPEN_RELATIONSHIP_MODAL': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {answerId} = action.payload;
			updateState({
				relationshipPanelOpen: true,
				relationshipModalAnswerId: answerId,
				relationshipModalActiveTab: 'guidelines',
				modalSystemMessages: [],  // Initialize empty modal messages
				modalSystemMessagesCollapsed: true,   // Start collapsed
				// Clear any existing typeahead state to prevent contamination
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				relationshipTypeaheadLoading: false,
				// Initialize problem expansion state tracking
				expandedProblems: {},
				// Initialize goals state tracking
				problemGoals: {},      // Store goals data by problemId
				goalsLoading: {},       // Track loading state by problemId
				// Goal typeahead state
				goalTypeaheadText: {},      // Track input text per problemId
				goalTypeaheadResults: {},   // Track results per problemId
				goalTypeaheadLoading: {},   // Track loading per problemId
				selectedGoalData: {},       // Track selected goal per problemId
				currentGoalSearchContext: null,  // Store current goal search context
				preSaveGoalContext: null,       // Store pre-save goal context
				pendingGoalSave: null,          // Store pending goal save data

				// Question pre-save state
				preSaveQuestionContext: null,   // Store pre-save question context

				// Initialize intervention state tracking (same pattern as goals)
				expandedGoals: {},          // Track which goals are expanded to show interventions
				goalInterventions: {},      // Store interventions data by goalId
				interventionsLoading: {},   // Track loading state by goalId
				// Intervention typeahead state
				interventionTypeaheadText: {},      // Track input text per goalId
				interventionTypeaheadResults: {},   // Track results per goalId
				interventionTypeaheadLoading: {},   // Track loading per goalId
				selectedInterventionData: {},       // Track selected intervention per goalId
				currentInterventionSearchContext: null,  // Store current intervention search context
				preSaveInterventionContext: null,       // Store pre-save intervention context
				pendingInterventionSave: null,          // Store pending intervention save data

				// Section pre-save state
				preSaveSectionContext: null,            // Store pre-save section context
				pendingSectionSave: null                // Store pending section save data
			});

			// ALWAYS reload relationships when opening modal to ensure fresh data
			// This is critical after deleting questions that were triggered by this answer
			if (answerId) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}
		},

		'CLOSE_RELATIONSHIP_MODAL': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			const answerId = state.relationshipModalAnswerId;
			updateState({
				relationshipPanelOpen: false,
				relationshipModalAnswerId: null,
				relationshipModalActiveTab: 'guidelines',
				// Clear typeahead state
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				relationshipTypeaheadLoading: false,
				// Clear selected items
				selectedGuideline: null,
				selectedQuestion: null,
				// Clear expansion state
				expandedProblems: {},
				// Clear goals state
				problemGoals: {},
				goalsLoading: {}
			});

			// Refresh section questions to get updated badge counts
			if (state.selectedSection) {
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		'OPEN_PGI_MODAL': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {answerId} = action.payload;
			updateState({
				pgiModalOpen: true,
				pgiModalAnswerId: answerId,
				// Initialize expansion state
				expandedProblems: {},
				expandedGoals: {},
				// Store goals and interventions by ID
				problemGoals: {},
				goalInterventions: {}
			});

			// Auto-load relationships if they don't exist yet
			if (answerId && !state.answerRelationships[answerId] && !state.relationshipsLoading[answerId]) {
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}
		},

		'CLOSE_PGI_MODAL': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				pgiModalOpen: false,
				pgiModalAnswerId: null,
				expandedProblems: {},
				expandedGoals: {},
				problemGoals: {},
				goalInterventions: {}
			});
		},

		// Confirmation Dialog Action Handlers
		'SHOW_CONFIRMATION_DIALOG': (coeffects) => {
			const {action, updateState} = coeffects;
			const {message, pendingAction} = action.payload;
			updateState({
				confirmationDialogOpen: true,
				confirmationDialogMessage: message,
				confirmationDialogPendingAction: pendingAction
			});
		},

		'CONFIRM_DIALOG_ACTION': (coeffects) => {
			const {state, updateState, dispatch} = coeffects;
			const pendingAction = state.confirmationDialogPendingAction;

			// Close dialog
			updateState({
				confirmationDialogOpen: false,
				confirmationDialogMessage: '',
				confirmationDialogPendingAction: null
			});

			// Execute the pending action if it exists
			if (pendingAction) {
				dispatch(pendingAction.type, pendingAction.payload);
			}
		},

		'CANCEL_DIALOG_ACTION': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				confirmationDialogOpen: false,
				confirmationDialogMessage: '',
				confirmationDialogPendingAction: null
			});
		},

		// Toast Notification Handlers
		'SHOW_TOAST': (coeffects) => {
			const {action, state, updateState} = coeffects;
			const {type, message, duration = 5000} = action.payload;

			// Create unique toast ID
			const toastId = 'toast_' + Date.now() + '_' + Math.random().toString(36).substring(7);

			// Add toast to array
			const newToast = {
				id: toastId,
				type: type || 'info',
				message: message,
				timestamp: new Date().toISOString()
			};

			updateState({
				toastNotifications: [...(state.toastNotifications || []), newToast]
			});

			// Auto-dismiss after duration (unless it's an error)
			if (type !== 'error') {
				setTimeout(() => {
					// Dispatch dismiss action
					const currentState = state;
					if (currentState.toastNotifications) {
						const filteredToasts = currentState.toastNotifications.filter(t => t.id !== toastId);
						updateState({
							toastNotifications: filteredToasts
						});
					}
				}, duration);
			}
		},

		'DISMISS_TOAST': (coeffects) => {
			const {action, state, updateState} = coeffects;
			const {toastId} = action.payload;

			const filteredToasts = (state.toastNotifications || []).filter(t => t.id !== toastId);
			updateState({
				toastNotifications: filteredToasts
			});
		},

		// Intervention Action Handlers (following goals pattern)
		'LOAD_GOAL_INTERVENTIONS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {goalId, guidelineTemplateId} = action.payload;
			// Set loading state and store current loading goalId for success handler
			updateState({
				interventionsLoading: {
					...state.interventionsLoading,
					[goalId]: true
				},
				currentInterventionsLoadingGoalId: goalId  // Store for SUCCESS handler
			});

			// Request body for get goal interventions API
			const requestBody = JSON.stringify({
				goalId: goalId,
				guidelineTemplateId: guidelineTemplateId
			});

			dispatch('MAKE_LOAD_GOAL_INTERVENTIONS_REQUEST', {
				requestBody: requestBody,
				meta: {
					goalId: goalId,
					guidelineTemplateId: guidelineTemplateId
				}
			});
		},

		'LOAD_GOAL_INTERVENTIONS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			// Use stored goalId from state instead of meta (meta not working reliably)
			const goalId = state.currentInterventionsLoadingGoalId;
			// Parse the response to get interventions data
			const interventionsData = action.payload?.interventions || [];

			updateState({
				interventionsLoading: {
					...state.interventionsLoading,
					[goalId]: false
				},
				goalInterventions: {
					...state.goalInterventions,
					[goalId]: interventionsData
				},
				currentInterventionsLoadingGoalId: null  // Clear stored ID
			});
		},

		'LOAD_GOAL_INTERVENTIONS_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('LOAD_GOAL_INTERVENTIONS_ERROR:', action.payload);

			// Use stored goalId from state instead of meta
			const goalId = state.currentInterventionsLoadingGoalId;

			updateState({
				interventionsLoading: {
					...state.interventionsLoading,
					[goalId]: false
				},
				currentInterventionsLoadingGoalId: null,  // Clear stored ID
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to load interventions for goal: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'TOGGLE_GOAL_EXPANSION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {goalId} = action.payload;
			// Toggle the expansion state for this goal
			const isCurrentlyExpanded = state.expandedGoals[goalId];
			const newExpansionState = !isCurrentlyExpanded;

			updateState({
				expandedGoals: {
					...state.expandedGoals,
					[goalId]: newExpansionState
				}
			});

			// If expanding and interventions not loaded yet, load them
			if (newExpansionState && !state.goalInterventions[goalId] && !state.interventionsLoading[goalId]) {
				dispatch('LOAD_GOAL_INTERVENTIONS', {
					goalId: goalId,
					guidelineTemplateId: state.currentAssessmentId
				});
			}
		},

		'TOGGLE_PROBLEM_EXPANSION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {problemId} = action.payload;
			const currentExpansion = state.expandedProblems || {};
			const isExpanded = currentExpansion[problemId] || false;

			updateState({
				expandedProblems: {
					...currentExpansion,
					[problemId]: !isExpanded
				}
			});

			// If expanding and goals haven't been loaded yet, load them
			if (!isExpanded && !state.problemGoals[problemId] && !state.goalsLoading[problemId]) {
				dispatch('LOAD_PROBLEM_GOALS', {
					problemId: problemId,
					guidelineTemplateId: state.currentAssessmentId
				});
			}
		},

		'SET_RELATIONSHIP_TAB': (coeffects) => {
			const {action, updateState} = coeffects;
			const {tab} = action.payload;
			updateState({
				relationshipModalActiveTab: tab,
				// Clear typeahead state when switching tabs to prevent contamination
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				relationshipTypeaheadLoading: false,
				// Clear selected items when switching tabs
				selectedGuideline: null,
				selectedQuestion: null
			});
		},

		'RELATIONSHIP_TYPEAHEAD_HIDE': (coeffects) => {
			const {updateState} = coeffects;
			updateState({
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				relationshipTypeaheadLoading: false
			});
		},

		'SAVE_RELATIONSHIP_CHANGES': (coeffects) => {
			const {dispatch} = coeffects;
			// For now, just close the modal. In the future, this would save changes to backend
			dispatch('CLOSE_RELATIONSHIP_MODAL');

			// TODO: Implement actual save logic to backend when needed
		},


	}
});