import {createCustomElement, actionTypes} from '@servicenow/ui-core';
import {createHttpEffect} from '@servicenow/ui-effect-http';
import snabbdom from '@servicenow/ui-renderer-snabbdom';
import styles from './styles.scss';
import packageJson from '../../package.json';

const {COMPONENT_BOOTSTRAPPED} = actionTypes;

// Group assessments by master_id
const groupAssessmentsByMasterId = (assessments) => {
	const grouped = {};
	
	assessments.forEach(assessment => {
		const masterId = assessment.master_id;
		if (!grouped[masterId]) {
			grouped[masterId] = [];
		}
		grouped[masterId].push(assessment);
	});
	
	// Sort versions within each group by version number (descending)
	Object.keys(grouped).forEach(masterId => {
		grouped[masterId].sort((a, b) => {
			const versionA = parseFloat(a.version) || 0;
			const versionB = parseFloat(b.version) || 0;
			return versionB - versionA; // Descending order (newest first)
		});
	});
	
	return grouped;
};

// Paginate assessments for client-side display
const paginateAssessments = (assessments, currentPage, pageSize) => {
	if (!assessments || assessments.length === 0) return [];
	
	const startIndex = currentPage * pageSize;
	const endIndex = startIndex + pageSize;
	
	return assessments.slice(startIndex, endIndex);
};

// Load CareIQ config using dispatch action
const loadCareIQConfig = (dispatch) => {
	console.log('Dispatching LOAD_CAREIQ_CONFIG action...');
	dispatch('LOAD_CAREIQ_CONFIG');
};

// Check if answer has any relationships
const hasRelationships = (counts) => {
	if (!counts) return false;
	
	return (counts.triggered_guidelines > 0) || 
		   (counts.problems > 0) || 
		   (counts.triggered_questions > 0) || 
		   (counts.evidence > 0) || 
		   (counts.barriers > 0);
};

// Calculate which questions should be visible based on selected answers and their relationships
const calculateVisibleQuestions = (selectedAnswers, currentQuestions, answerRelationships = {}) => {
	if (!currentQuestions || currentQuestions.length === 0) {
		return [];
	}
	
	let visibleQuestions = [];
	
	// Start with questions that don't have a 'hidden' flag or have hidden: false
	currentQuestions.forEach(question => {
		if (!question.hidden) {
			visibleQuestions.push(question.ids.id); // Use correct UUID path
		}
	});
	
	console.log('calculateVisibleQuestions - Starting with non-hidden questions:', visibleQuestions.length);
	console.log('calculateVisibleQuestions - Selected answers:', selectedAnswers);
	console.log('calculateVisibleQuestions - Available relationships:', Object.keys(answerRelationships));
	
	// Add questions that should be shown based on triggered_questions relationships
	Object.keys(selectedAnswers).forEach(questionId => {
		const selectedAnswerIds = selectedAnswers[questionId];
		console.log('Processing question:', questionId, 'with selected answers:', selectedAnswerIds);
		
		selectedAnswerIds.forEach(answerId => {
			// Find the answer in the questions using correct UUID paths
			const question = currentQuestions.find(q => q.ids.id === questionId);
			const answer = question?.answers?.find(a => a.ids.id === answerId);
			
			console.log('Found question:', question?.label, 'Found answer:', answer?.label);
			
			// First check if the answer has triggered_questions in the section data
			if (answer?.triggered_questions && Array.isArray(answer.triggered_questions)) {
				console.log('Found triggered_questions in section data for answer:', answer.label, answer.triggered_questions);
				answer.triggered_questions.forEach(triggeredQuestionId => {
					if (!visibleQuestions.includes(triggeredQuestionId)) {
						console.log('Adding triggered question to visible list:', triggeredQuestionId);
						visibleQuestions.push(triggeredQuestionId);
					}
				});
			}
			// Otherwise, check if we have relationship data for this answer
			else if (answerRelationships[answerId] && answerRelationships[answerId].questions?.questions?.length > 0) {
				console.log('Found triggered questions in relationships data for answer:', answer?.label);
				answerRelationships[answerId].questions.questions.forEach(triggeredQuestion => {
					if (!visibleQuestions.includes(triggeredQuestion.id)) {
						console.log('Adding triggered question from relationships:', triggeredQuestion.id, triggeredQuestion.label);
						visibleQuestions.push(triggeredQuestion.id);
					}
				});
			} else {
				console.log('No triggered_questions found for answer:', answer?.label);
			}
		});
	});
	
	console.log('calculateVisibleQuestions - Final visible questions:', visibleQuestions);
	return visibleQuestions;
};

const view = (state, {updateState, dispatch}) => {
	console.log('Component rendered with state:', state);
	
	// Auto-scroll system message box to bottom after render
	setTimeout(() => {
		const systemWindows = document.querySelectorAll('.careiq-builder .system-window');
		systemWindows.forEach(window => {
			console.log('Scrolling system window to bottom, scrollHeight:', window.scrollHeight);
			window.scrollTop = window.scrollHeight;
		});
	}, 10); // Reduced delay for better responsiveness
	
	return (
		<div className="careiq-builder">
			<h1>CareIQ Builder</h1>
			
			<div className={`system-window-container ${state.systemMessagesCollapsed ? 'collapsed' : ''}`}>
				<div className="system-window-header">
					<h3>System Messages</h3>
					<span 
						className="system-window-toggle"
						onclick={() => dispatch('TOGGLE_SYSTEM_MESSAGES')}
					>
						{state.systemMessagesCollapsed ? '▼' : '▲'}
					</span>
				</div>
				{!state.systemMessagesCollapsed && (
					<div 
						className="system-window"
					hook={{
						insert: (vnode) => {
							console.log('System window inserted, scrolling to bottom');
							vnode.elm.scrollTop = vnode.elm.scrollHeight;
						},
						update: (oldVnode, vnode) => {
							console.log('System window updated, scrolling to bottom');
							setTimeout(() => {
								vnode.elm.scrollTop = vnode.elm.scrollHeight;
							}, 5);
						}
					}}
				>
					{state.loading && (
						<div className="system-message loading">
							🔄 <strong>Connecting to the CareIQ Platform...</strong>
						</div>
					)}
					{state.careiqConfig && state.accessToken && (
						<div className="system-message success">
							✅ <strong>Connected to the CareIQ Platform</strong>
						</div>
					)}
					{state.categoriesLoading && (
						<div className="system-message loading">
							🔄 <strong>Loading use case categories...</strong>
						</div>
					)}
					{state.useCaseCategories && state.useCaseCategories.length > 0 && (
						<div className="system-message success">
							📋 <strong>Loaded {state.useCaseCategories.length} Use Case Categories:</strong>
							<ul className="categories-list">
								{state.useCaseCategories.map(category => (
									<li key={category.id} className="category-item">
										{category.name} (ID: {category.id})
									</li>
								))}
							</ul>
						</div>
					)}
					{state.useCaseCategories && state.useCaseCategories.length === 0 && !state.categoriesLoading && (
						<div className="system-message warning">
							⚠️ <strong>No use case categories found for CM</strong>
						</div>
					)}
					{state.error && (
						<div className="system-message error">
							❌ <strong>Error:</strong> {state.error}
						</div>
					)}
					{/* Dynamic system messages */}
					{state.systemMessages && state.systemMessages.map((msg, index) => (
						<div key={index} className={`system-message ${msg.type}`}>
							{msg.type === 'loading' && '🔄'}
							{msg.type === 'success' && '✅'}
							{msg.type === 'error' && '❌'}
							{msg.type === 'warning' && '⚠️'}
							{msg.type === 'info' && 'ℹ️'}
							{' '}
							<strong>{msg.message}</strong>
							{msg.timestamp && (
								<span className="timestamp"> ({new Date(msg.timestamp).toLocaleTimeString()})</span>
							)}
						</div>
					))}
					</div>
				)}
			</div>
			
			{state.careiqConfig && state.accessToken && !state.builderView && (
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

													{/* Test SVG Icons */}
													<div style={{display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px'}}>
														<button style={{background: '#10b981', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
															<svg attrs={{width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor"}}>
																<path attrs={{d: "M13.485 3.429a1 1 0 0 1 0 1.414L6.707 11.62a1 1 0 0 1-1.414 0L2.515 8.843a1 1 0 1 1 1.414-1.414L6 9.5a1 1 0 0 1 0 0l6.071-6.071a1 1 0 0 1 1.414 0z"}} />
															</svg>
														</button>
														<button style={{background: '#ef4444', color: 'white', border: 'none', padding: '6px', borderRadius: '4px', cursor: 'pointer', fontStyle: 'italic', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
															<svg attrs={{width: "14", height: "14", viewBox: "0 0 16 16", fill: "currentColor"}}>
																<path attrs={{d: "M3.646 3.646a1 1 0 0 1 1.414 0L8 6.586l2.94-2.94a1 1 0 1 1 1.414 1.414L9.414 8l2.94 2.94a1 1 0 0 1-1.414 1.414L8 9.414l-2.94 2.94a1 1 0 0 1-1.414-1.414L6.586 8 3.646 5.06a1 1 0 0 1 0-1.414z"}} />
															</svg>
														</button>
													</div>
												</div>
												<div className="assessment-card-body">
													<p className="assessment-policy">Policy: {assessment.policy_number}</p>
													<p className="assessment-category">
														Category: {assessment.use_case_category.name}
													</p>
													<p className="assessment-usage">Usage: {assessment.usage}</p>
													<p className="assessment-version">Version: {assessment.version}</p>
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
			
			{state.careiqConfig && state.accessToken && state.builderView && (
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
							{state.currentAssessment?.status === 'draft' ? [
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
					
					{state.assessmentDetailsLoading && (
						<div className="builder-loading">
							🔄 Loading assessment details...
						</div>
					)}
					
					{state.currentAssessment && !state.assessmentDetailsLoading && (
						<div className={`builder-content ${state.sectionsPanelExpanded ? 'sections-expanded' : ''}`}>
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
									{state.builderMode && state.currentAssessment?.status === 'draft' && (
										<button 
											className="add-section-btn"
											onclick={() => dispatch('ADD_SECTION')}
											title="Add new section"
										>
											+
										</button>
									)}
								</div>
								{state.currentAssessment.sections && state.currentAssessment.sections.length > 0 ? (
									<div className="sections-list">
										{state.currentAssessment.sections
											.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
											.map(section => (
											<div key={section.id} className="section-item">
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
																		✓
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
																			backgroundColor: '#dc3545',
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
															<div 
																key={subsection.id} 
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
																	if (state.draggingSection) {
																		e.preventDefault();
																		e.dataTransfer.dropEffect = 'move';
																		dispatch('DRAG_SECTION_OVER', {sectionId: subsection.id});
																	}
																}}
																ondragleave={(e) => {
																	dispatch('DRAG_SECTION_LEAVE');
																}}
																ondrop={(e) => {
																	e.preventDefault();
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
																				✓
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
																				✕
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
																					console.log('Section drag start from handle:', {sectionId: subsection.id});
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
							
							<div className="questions-panel">
								<h3>
									{state.selectedSectionLabel ? 
										`Questions - ${state.selectedSectionLabel}` : 
										'Questions & Problems'
									}
								</h3>
								
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
												// console.log('Question render debug:', {
												//	builderMode: state.builderMode,
												//	assessmentStatus: state.currentAssessment?.status,
												//	isEditable: isEditable,
												//	questionId: question.ids.id,
												//	voice: question.voice,
												//	label: question.label
												// });
											return (
											<div 
												key={question.ids.id} 
												className={`question-item ${isEditable ? 'editable' : 'preview'} ${isEditable ? 'draggable-question' : ''}`} 
												draggable={false}
												onclick={() => {
													console.log('Question clicked! Editable:', isEditable, 'Draggable:', isEditable);
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
													
													console.log('Question drop event:', {targetIndex: qIndex});
													
													try {
														const dragData = JSON.parse(e.dataTransfer.getData('text/plain'));
														console.log('Drop data:', dragData);
														if (dragData.type === 'question') {
															console.log('Dispatching REORDER_QUESTIONS:', {
																sourceIndex: dragData.sourceIndex,
																targetIndex: qIndex
															});
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
															title="Drag to reorder"
															draggable={true}
															ondragstart={(e) => {
																console.log('Question drag start from handle:', {questionId: question.ids.id, sourceIndex: qIndex});
																e.dataTransfer.setData('text/plain', JSON.stringify({
																	type: 'question',
																	questionId: question.ids.id,
																	sourceIndex: qIndex
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
																	style={state.isMobileView ? {
																		flexShrink: '0'
																	} : {}}
																	onchange={(e) => {
																		console.log('Question voice changed to:', e.target.value);
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
																<span 
																	className="edit-icon"
																	title="Edit question text"
																	style={{
																		cursor: 'pointer',
																		marginRight: '8px',
																		padding: '2px 4px',
																		backgroundColor: '#f0f0f0',
																		borderRadius: '3px',
																		fontSize: '12px',
																		display: 'inline-block',
																		border: '1px solid #ccc'
																	}}
																	onclick={() => {
																		dispatch('OPEN_EDIT_MODAL', {
																			type: 'question',
																			itemId: question.ids.id,
																			text: question.label
																		});
																	}}
																>
																	🔍
																</span>
																<div className="typeahead-container">
																	<input
																		type="text"
																		className="question-label-input"
																		value={question.label}
																		placeholder="Enter question text..."
																		oninput={(e) => {
																			const newValue = e.target.value;
																			// Update the question label locally
																			dispatch('UPDATE_QUESTION_LABEL', {
																				questionId: question.ids.id,
																				newLabel: newValue
																			});
																			// Trigger typeahead search if length >= 3
																			if (newValue.length >= 3) {
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
																		) : state.questionTypeaheadQuery.length >= 3 && !state.questionTypeaheadLoading ? (
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
																		title={question.tooltip || 'Click to add tooltip'}
																		ondblclick={(e) => {
																			e.stopPropagation();
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
																		onchange={(e) => {
																			console.log('Question required changed to:', e.target.checked);
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
																<select className="question-type-select" style={state.isMobileView ? {
																	flexShrink: '0'
																} : {}} onchange={(e) => {
																	console.log('Question type changed to:', e.target.value);
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
																{question.isUnsaved && (
																	<button
																		className="save-question-btn"
																		title="Save Question"
																		style={{
																			backgroundColor: '#28a745',
																			color: 'white',
																			border: 'none',
																			borderRadius: '3px',
																			padding: '4px 8px',
																			marginRight: '5px',
																			cursor: 'pointer',
																			fontSize: '12px',
																			...(state.isMobileView ? {
																				flexShrink: '0',
																				minWidth: '40px',
																				marginBottom: '0.5rem'
																			} : {})
																		}}
																		onclick={() => {
																			dispatch('SAVE_QUESTION_IMMEDIATELY', {
																				questionId: question.ids.id
																			});
																		}}
																	>
																		💾 Save
																	</button>
																)}
																<button
																	className="delete-question-btn"
																	title="Delete Question"
																	style={state.isMobileView ? {
																		flexShrink: '0',
																		minWidth: '40px',
																		marginBottom: '0.5rem'
																	} : {}}
																	onclick={() => {
																		dispatch('DELETE_QUESTION', {
																			questionId: question.ids.id
																		});
																	}}
																>
																	🗑️
																</button>
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
																{question.isLibraryQuestion && (
																	<span className="library-indicator" style={{
																		backgroundColor: '#17a2b8',
																		color: 'white',
																		padding: '2px 6px',
																		borderRadius: '10px',
																		fontSize: '11px',
																		fontWeight: 'bold'
																	}}>
																		📚 LIBRARY
																	</span>
																)}
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
																			console.log('Answer option clicked!', answer.ids.id);
																			console.log('This answer option is draggable:', e.currentTarget.draggable);
																			console.log('Debug attributes:');
																			console.log('  data-debugeditable:', e.currentTarget.getAttribute('data-debugeditable'));
																			console.log('  data-debugbuildermode:', e.currentTarget.getAttribute('data-debugbuildermode'));
																			console.log('  data-debugstatus:', e.currentTarget.getAttribute('data-debugstatus'));
																			console.log('  isEditable value:', isEditable);
																			console.log('Try holding mouse down and DRAGGING this entire answer box');
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
																					console.log('Answer drag start from handle:', {questionId: question.ids.id, answerId: answer.ids.id, sourceIndex: aIndex});
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
																		<div className="answer-edit">
																			<div className="answer-single-line">
																				<span className="answer-number">{aIndex + 1}.</span>
																				<span 
																					className="edit-icon"
																					title="Edit answer text"
																					style={{
																						cursor: 'pointer',
																						marginRight: '6px',
																						padding: '1px 3px',
																						backgroundColor: '#f0f0f0',
																						borderRadius: '3px',
																						fontSize: '11px',
																						display: 'inline-block',
																						border: '1px solid #ccc'
																					}}
																					onclick={() => {
																						dispatch('OPEN_EDIT_MODAL', {
																							type: 'answer',
																							itemId: answer.ids.id,
																							text: answer.label
																						});
																					}}
																				>
																					🔍
																				</span>
																				<div className="typeahead-container">
																					<input
																						type="text"
																						className="answer-label-input"
																						value={answer.label}
																						placeholder="Enter answer text..."
																						oninput={(e) => {
																							const newValue = e.target.value;
																							// Update the answer label locally
																							dispatch('UPDATE_ANSWER_LABEL', {
																								answerId: answer.ids.id,
																								newLabel: newValue
																							});
																							// Trigger typeahead search if length >= 3
																							if (newValue.length >= 3) {
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
																							) : state.answerTypeaheadQuery && state.answerTypeaheadQuery.length >= 3 && !state.answerTypeaheadLoading ? (
																								<div className="typeahead-item no-results">
																									No matching answers found for "{state.answerTypeaheadQuery}"
																								</div>
																							) : null}
																						</div>
																					)}
																				</div>
																				<div className="answer-tooltip-icon">
																					<span
																						className={`tooltip-icon ${answer.tooltip ? 'has-tooltip' : 'no-tooltip'}`}
																						title={answer.tooltip || 'Click to add tooltip'}
																						ondblclick={(e) => {
																							e.stopPropagation();
																							dispatch('EDIT_ANSWER_TOOLTIP', {
																								answerId: answer.ids.id,
																								currentTooltip: answer.tooltip || ''
																							});
																						}}
																					>
																						ⓘ
																					</span>
																				</div>
																				{answer.isLibraryAnswer && (
																					<span className="answer-library-indicator" style={{
																						backgroundColor: '#17a2b8',
																						color: 'white',
																						padding: '1px 4px',
																						borderRadius: '8px',
																						fontSize: '9px',
																						fontWeight: 'bold',
																						marginLeft: '4px'
																					}}>
																						📚 LIB
																					</span>
																				)}
																				<div className="answer-controls" style={state.isMobileView ? {
																					display: 'flex',
																					flexWrap: 'wrap',
																					gap: '0.75rem',
																					width: '100%',
																					overflow: 'visible'
																				} : {}}>
																					<select 
																						className="secondary-input-select"
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
																											console.log('=== TRASH CAN CLICKED ===');
																											console.log('Deleting triggered question:', triggeredId);
																											console.log('From answer:', answer.ids.id);
																											console.log('isEditable check:', {
																												builderMode: state.builderMode,
																												assessmentStatus: state.currentAssessment?.status,
																												isEditable: isEditable
																											});
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
																												console.log('=== REMOVING GUIDELINE RELATIONSHIP ===');
																												console.log('Removing guideline:', relationship.targetId);
																												console.log('From answer:', answer.ids.id);
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
																							✕
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
																													console.log('=== RELATIONSHIP TRASH CAN CLICKED ===');
																													console.log('Deleting question:', question.id, question.label);
																													console.log('From answer:', answer.ids.id);
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
																												<div className="typeahead-dropdown">
																													{state.relationshipTypeaheadResults.map((question, index) => (
																														<div 
																															key={question.ids?.id || index}
																															className="typeahead-item"
																															onclick={(e) => {
																																console.log('=== TYPEAHEAD ITEM CLICKED ===');
																																console.log('Question clicked:', question);
																																console.log('Answer ID:', answer.ids.id);
																																console.log('Question ID:', question.ids?.id);
																																console.log('Question label:', question.label);
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
																																console.log('=== GUIDELINE TYPEAHEAD ITEM CLICKED ===');
																																console.log('Guideline clicked:', guideline);
																																console.log('Answer ID:', answer.ids.id);
																																console.log('Guideline ID:', guideline.id);
																																console.log('Guideline name:', guideline.name);
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
																													console.log('=== CHECKMARK BUTTON CLICKED ===');
																													console.log('Answer ID:', answer.ids.id);
																													console.log('Selected relationship question:', state.selectedRelationshipQuestion);
																													e.stopPropagation();
																													e.preventDefault();
																													dispatch('CONFIRM_ADD_RELATIONSHIP', {
																														answerId: answer.ids.id
																													});
																												}}
																												title="Confirm relationship"
																											>
																												✓
																											</button>
																											<button 
																												className="cancel-relationship-btn"
																												onclick={() => {
																													dispatch('CANCEL_ADD_RELATIONSHIP');
																												}}
																												title="Cancel"
																											>
																												✕
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
																			console.log('Answer option clicked!', answer.ids.id);
																			console.log('This answer option is draggable:', e.currentTarget.draggable);
																			console.log('Debug attributes:');
																			console.log('  data-debugeditable:', e.currentTarget.getAttribute('data-debugeditable'));
																			console.log('  data-debugbuildermode:', e.currentTarget.getAttribute('data-debugbuildermode'));
																			console.log('  data-debugstatus:', e.currentTarget.getAttribute('data-debugstatus'));
																			console.log('  isEditable value:', isEditable);
																			console.log('Try holding mouse down and DRAGGING this entire answer box');
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
																					console.log('Answer drag start from handle:', {questionId: question.ids.id, answerId: answer.ids.id, sourceIndex: aIndex});
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
																		<div className="answer-edit">
																			<div className="answer-single-line">
																				<span className="answer-number">{aIndex + 1}.</span>
																				<span 
																					className="edit-icon"
																					title="Edit answer text"
																					style={{
																						cursor: 'pointer',
																						marginRight: '6px',
																						padding: '1px 3px',
																						backgroundColor: '#f0f0f0',
																						borderRadius: '3px',
																						fontSize: '11px',
																						display: 'inline-block',
																						border: '1px solid #ccc'
																					}}
																					onclick={() => {
																						dispatch('OPEN_EDIT_MODAL', {
																							type: 'answer',
																							itemId: answer.ids.id,
																							text: answer.label
																						});
																					}}
																				>
																					🔍
																				</span>
																				<div className="typeahead-container">
																					<input
																						type="text"
																						className="answer-label-input"
																						value={answer.label}
																						placeholder="Enter answer text..."
																						oninput={(e) => {
																							const newValue = e.target.value;
																							// Update the answer label locally
																							dispatch('UPDATE_ANSWER_LABEL', {
																								answerId: answer.ids.id,
																								newLabel: newValue
																							});
																							// Trigger typeahead search if length >= 3
																							if (newValue.length >= 3) {
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
																							) : state.answerTypeaheadQuery && state.answerTypeaheadQuery.length >= 3 && !state.answerTypeaheadLoading ? (
																								<div className="typeahead-item no-results">
																									No matching answers found for "{state.answerTypeaheadQuery}"
																								</div>
																							) : null}
																						</div>
																					)}
																				</div>
																				<div className="answer-tooltip-icon">
																					<span
																						className={`tooltip-icon ${answer.tooltip ? 'has-tooltip' : 'no-tooltip'}`}
																						title={answer.tooltip || 'Click to add tooltip'}
																						ondblclick={(e) => {
																							e.stopPropagation();
																							dispatch('EDIT_ANSWER_TOOLTIP', {
																								answerId: answer.ids.id,
																								currentTooltip: answer.tooltip || ''
																							});
																						}}
																					>
																						ⓘ
																					</span>
																				</div>
																				{answer.isLibraryAnswer && (
																					<span className="answer-library-indicator" style={{
																						backgroundColor: '#17a2b8',
																						color: 'white',
																						padding: '1px 4px',
																						borderRadius: '8px',
																						fontSize: '9px',
																						fontWeight: 'bold',
																						marginLeft: '4px'
																					}}>
																						📚 LIB
																					</span>
																				)}
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
																								console.log('Answer mutually_exclusive changed to:', e.target.checked);
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
																											console.log('=== TRASH CAN CLICKED ===');
																											console.log('Deleting triggered question:', triggeredId);
																											console.log('From answer:', answer.ids.id);
																											console.log('isEditable check:', {
																												builderMode: state.builderMode,
																												assessmentStatus: state.currentAssessment?.status,
																												isEditable: isEditable
																											});
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
																												console.log('=== REMOVING GUIDELINE RELATIONSHIP ===');
																												console.log('Removing guideline:', relationship.targetId);
																												console.log('From answer:', answer.ids.id);
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
																							✕
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
																													console.log('=== RELATIONSHIP TRASH CAN CLICKED ===');
																													console.log('Deleting question:', question.id, question.label);
																													console.log('From answer:', answer.ids.id);
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
																												<div className="typeahead-dropdown">
																													{state.relationshipTypeaheadResults.map((question, index) => (
																														<div 
																															key={question.ids?.id || index}
																															className="typeahead-item"
																															onclick={(e) => {
																																console.log('=== TYPEAHEAD ITEM CLICKED ===');
																																console.log('Question clicked:', question);
																																console.log('Answer ID:', answer.ids.id);
																																console.log('Question ID:', question.ids?.id);
																																console.log('Question label:', question.label);
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
																																console.log('=== GUIDELINE TYPEAHEAD ITEM CLICKED ===');
																																console.log('Guideline clicked:', guideline);
																																console.log('Answer ID:', answer.ids.id);
																																console.log('Guideline ID:', guideline.id);
																																console.log('Guideline name:', guideline.name);
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
																													console.log('=== CHECKMARK BUTTON CLICKED ===');
																													console.log('Answer ID:', answer.ids.id);
																													console.log('Selected relationship question:', state.selectedRelationshipQuestion);
																													e.stopPropagation();
																													e.preventDefault();
																													dispatch('CONFIRM_ADD_RELATIONSHIP', {
																														answerId: answer.ids.id
																													});
																												}}
																												title="Confirm relationship"
																											>
																												✓
																											</button>
																											<button 
																												className="cancel-relationship-btn"
																												onclick={() => {
																													dispatch('CANCEL_ADD_RELATIONSHIP');
																												}}
																												title="Cancel"
																											>
																												✕
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
																type="text" 
																className="text-input"
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
																type="date" 
																className="date-input"
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
																type="number" 
																className="numeric-input"
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
											);
										})}
										
										{/* Add Question Button - only show in edit mode for draft assessments */}
										{state.builderMode && state.currentAssessment?.status === 'draft' && (
											<button
												className="add-question-btn"
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
						dispatch('CANCEL_TOOLTIP_EDIT');
					}
				}}>
					<div className="tooltip-modal">
						<div className="modal-header">
							<h3>Edit Tooltip</h3>
							<button 
								className="modal-close"
								onclick={() => dispatch('CANCEL_TOOLTIP_EDIT')}
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
								className="btn-cancel"
								onclick={() => dispatch('CANCEL_TOOLTIP_EDIT')}
							>
								Cancel
							</button>
							<button 
								className="btn-save"
								onclick={() => dispatch('SAVE_TOOLTIP_EDIT')}
							>
								Save
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
			{state.assessmentDetailsPanel?.isOpen && (
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
								<div className="form-column">
									<div className="form-group">
										<label>Use Case:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>Version Name:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>Use Case Category:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>Usage:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>Content Source:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>Code/Policy Number:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
								</div>
								<div className="form-column">
									<div className="form-group">
										<label>Effective Date:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>End Date:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>Review Date:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>Next Review Date:</label>
										{state.assessmentDetailsPanel.isEditable ? (
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
									<div className="form-group">
										<label>Response Logging:</label>
										{state.assessmentDetailsPanel.isEditable ? (
											<div className="checkbox-group">
												<input
													type="checkbox"
													id="responseLogging"
													checked={state.assessmentDetailsPanel.responseLogging || false}
													onchange={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
														field: 'responseLogging',
														value: e.target.checked
													})}
												/>
												<label htmlFor="responseLogging">Enable response logging</label>
											</div>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.responseLogging ? 'Enabled' : 'Disabled'}</div>
										)}
									</div>
									<div className="form-group">
										<label>Allow MCG Content:</label>
										{state.assessmentDetailsPanel.isEditable ? (
											<div className="checkbox-group">
												<input
													type="checkbox"
													id="allowMcgContent"
													checked={state.assessmentDetailsPanel.allowMcgContent || false}
													onchange={(e) => dispatch('UPDATE_ASSESSMENT_DETAIL_FIELD', {
														field: 'allowMcgContent',
														value: e.target.checked
													})}
												/>
												<label htmlFor="allowMcgContent">Allow MCG content</label>
											</div>
										) : (
											<div className="readonly-field">{state.assessmentDetailsPanel.allowMcgContent ? 'Allowed' : 'Not Allowed'}</div>
										)}
									</div>
								</div>
							</div>
						</div>
						{state.assessmentDetailsPanel.isEditable && (
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
						)}
					</div>
				</div>
			)}

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

			{/* Edit Modal */}
			{state.modalOpen && (
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
					zIndex: '1000'
				}}>
					<div className="modal-content" style={{
						backgroundColor: 'white',
						padding: '20px',
						borderRadius: '8px',
						width: '500px',
						maxWidth: '90vw',
						boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
					}}>
						<h3 className="modal-title">
							Edit {state.modalType === 'question' ? 'Question' : state.modalType === 'answer' ? 'Answer' : 'Section'}
						</h3>
						<textarea
							className="modal-textarea"
							value={state.modalText}
							oninput={(e) => {
								dispatch('UPDATE_MODAL_TEXT', {
									text: e.target.value
								});
							}}
							placeholder={`Enter ${state.modalType === 'question' ? 'question' : state.modalType === 'answer' ? 'answer' : 'section'} text...`}
							rows="8"
							style={{
								width: '100%',
								minHeight: '200px',
								resize: 'vertical',
								fontFamily: 'inherit',
								fontSize: '14px',
								padding: '10px',
								border: '1px solid #ccc',
								borderRadius: '4px'
							}}
						></textarea>
						<div className="modal-buttons" style={{
							marginTop: '15px',
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
									padding: '8px 16px',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '14px'
								}}
								onclick={() => {
									dispatch('SAVE_MODAL_TEXT');
								}}
							>
								✓ Save
							</button>
							<button 
								className="modal-cancel-btn"
								style={{
									backgroundColor: '#6c757d',
									color: 'white',
									border: 'none',
									padding: '8px 16px',
									borderRadius: '4px',
									cursor: 'pointer',
									fontSize: '14px'
								}}
								onclick={() => {
									dispatch('CLOSE_MODAL');
								}}
							>
								✗ Cancel
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
					zIndex: '1000'
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
									Guideline - Name *
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
									Use Case Category
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

							{/* Type */}
							<div className="form-field">
								<label style={{display: 'block', marginBottom: '5px', fontWeight: '500'}}>
									Type
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
									Content Source
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
									Code/Policy Number
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
									<option value="Use Org Default">Use Org Default</option>
									<option value="Disabled">Disabled</option>
									<option value="Auto-save, Draft and Submit">Auto-save, Draft and Submit</option>
									<option value="Save as Draft and Submit">Save as Draft and Submit</option>
									<option value="Submit only">Submit only</option>
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
								✓ Create Assessment
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

			{/* Relationship Modal */}
			{state.relationshipModalOpen && (
				<div className="relationship-modal">
					<div className="modal-overlay">
						<div className="modal-content" on={{
							click: (e) => e.stopPropagation(),
							keydown: (e) => {
								if (e.key === 'Escape') {
									dispatch('CLOSE_RELATIONSHIP_MODAL');
								}
							}
						}}>
							<div className="modal-header">
								<div className="modal-title-section">
									<h3>Manage Answer Relationships</h3>
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
								</div>
								<button
									className="btn-cancel"
									on={{click: () => dispatch('CLOSE_RELATIONSHIP_MODAL')}}
								>
									✗
								</button>
							</div>

							<div className="modal-tabs">
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
									<div className="tab-content">
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
																	className="remove-relationship-btn"
																	on={{
																		click: () => dispatch('REMOVE_GUIDELINE_RELATIONSHIP', {
																			answerId: answerId,
																			guidelineId: guideline.master_id || guideline.id,
																			guidelineName: guideline.label
																		})
																	}}
																>
																	✗
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
															✓
														</button>
														<button
															className="cancel-relationship-btn"
															style={{
																fontSize: '14px',
																padding: '10px 16px',
																backgroundColor: '#ef4444',
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
															✗
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
															{guideline.label || guideline.name}
														</div>
													))}
												</div>
											)}
										</div>
									</div>
								)}

								{/* Questions Tab */}
								{state.relationshipModalActiveTab === 'questions' && (
									<div className="tab-content">
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
																	className="remove-relationship-btn"
																	on={{
																		click: () => dispatch('DELETE_BRANCH_QUESTION', {
																			answerId: answerId,
																			questionId: question.id,
																			questionLabel: question.label
																		})
																	}}
																>
																	✗
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

											// Check badge counts before showing "no questions"
											const answer = state.currentQuestions?.questions?.find(q =>
												q.answers?.some(a => a.ids.id === answerId)
											)?.answers?.find(a => a.ids.id === answerId);

											if (answer?.counts?.triggered_questions > 0) {
												return <p>Questions exist but relationship data is loading...</p>;
											}
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
															✓
														</button>
														<button
															className="cancel-relationship-btn"
															style={{
																fontSize: '14px',
																padding: '10px 16px',
																backgroundColor: '#ef4444',
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
															✗
														</button>
													</div>
												)}
											</div>

											{state.relationshipTypeaheadResults.length > 0 && (
												<div className="typeahead-dropdown">
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

											{state.relationshipTypeaheadText && state.relationshipTypeaheadText.length >= 3 &&
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
									<div className="tab-content">
										<h4>Problems</h4>

										{/* Existing Problems */}
										{(() => {
											const answerId = state.relationshipModalAnswerId;
											const relationships = state.answerRelationships[answerId];
											if (relationships && relationships.problems && relationships.problems.problems && relationships.problems.problems.length > 0) {
												return (
													<div className="existing-relationships">
														{relationships.problems.problems.map((problem, index) => [
															<div key={`problem-${index}`} className="relationship-item">
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
																			✓
																		</button>
																		<button
																			className="cancel-relationship-btn"
																			style={{
																				fontSize: '14px',
																				padding: '8px 12px',
																				backgroundColor: '#ef4444',
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
																		>
																			✕
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
																								boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
																							}}>
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
																											✓
																										</button>
																										<button
																											className="cancel-relationship-btn"
																											style={{
																												fontSize: '14px',
																												padding: '8px 12px',
																												backgroundColor: '#ef4444',
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
																										✕
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
																													{goalInterventions.map((intervention, interventionIndex) => {
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
																																			✓
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
																																boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
																															}}>
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
																																	style={{marginLeft: '12px', fontSize: '12px', padding: '4px 8px'}}
																																	title="Delete intervention"
																																	onclick={() => dispatch('DELETE_INTERVENTION', {
																																		answerId: state.relationshipModalAnswerId,
																																		interventionId: intervention.id,
																																		interventionName: intervention.label,
																																		goalId: goal.id
																																	})}
																																>
																																	✕
																																</button>
																															</div>
																														);
																													})}
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
																									<div className="add-intervention" style={{marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px'}}>
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
																																if (value.length >= 3) {
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
																															zIndex: 1000
																														}}>
																															{state.interventionTypeaheadResults[goal.id].map((intervention, interventionIdx) => (
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
																																					[goal.id]: intervention.label || intervention.name
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
																																	<div style={{fontWeight: '500'}}>{intervention.label || intervention.name}</div>
																																	{intervention.category && (
																																		<div style={{fontSize: '12px', color: '#6b7280', marginTop: '2px'}}>
																																			Category: {intervention.category}
																																		</div>
																																	)}
																																</div>
																															))}
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
																													✓
																												</button>
																												<button
																													className="cancel-relationship-btn"
																													style={{
																														fontSize: '14px',
																														padding: '10px 16px',
																														backgroundColor: '#ef4444',
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
																													✕
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
																	<div className="add-goal" style={{marginTop: '16px', borderTop: '1px solid #e5e7eb', paddingTop: '16px'}}>
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
																							if (value.length >= 3) {
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
																						zIndex: 1000,
																						maxHeight: '200px',
																						overflowY: 'auto'
																					}}>
																						{state.goalTypeaheadResults[problem.id].map((goal, goalIdx) => (
																							<div
																								key={goalIdx}
																								style={{
																									padding: '8px 12px',
																									cursor: 'pointer',
																									fontSize: '14px',
																									borderBottom: goalIdx < state.goalTypeaheadResults[problem.id].length - 1 ? '1px solid #e5e7eb' : 'none'
																								}}
																								on={{
																									click: () => {
																										updateState({
																											goalTypeaheadText: {
																												...state.goalTypeaheadText,
																												[problem.id]: goal.label || goal.name
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
																								{goal.label || goal.name}
																							</div>
																						))}
																					</div>
																				)}

																				{/* Loading indicator */}
																				{state.goalTypeaheadLoading[problem.id] && (
																					<div style={{
																						position: 'absolute',
																						right: '12px',
																						top: '50%',
																						transform: 'translateY(-50%)',
																						fontSize: '12px',
																						color: '#6b7280'
																					}}>
																						Loading...
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
																				✓
																			</button>
																			<button
																				className="cancel-relationship-btn"
																				style={{
																					fontSize: '14px',
																					padding: '10px 16px',
																					backgroundColor: '#ef4444',
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
																				✕
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

															if (value.length >= 3) {
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
													✓
												</button>
												<button
													className="cancel-relationship-btn"
													style={{
														fontSize: '14px',
														padding: '10px 16px',
														backgroundColor: '#ef4444',
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
													✗
												</button>
											</div>

											{state.relationshipTypeaheadResults.length > 0 && (
												<div className="typeahead-dropdown">
													{state.relationshipTypeaheadResults.map((problem, index) => (
														<div
															key={problem.id}
															className="typeahead-item"
															on={{
																click: () => {
																	updateState({
																		selectedProblemData: problem,
																		relationshipTypeaheadText: problem.label || problem.name,
																		relationshipTypeaheadResults: []
																	});
																}
															}}
														>
															{problem.label || problem.name}
														</div>
													))}
												</div>
											)}
										</div>
									</div>
								)}

								{/* Barriers Tab */}
								{state.relationshipModalActiveTab === 'barriers' && (
									<div className="tab-content">
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
																	className="remove-relationship-btn"
																	on={{
																		click: () => dispatch('REMOVE_BARRIER_RELATIONSHIP', {
																			answerId: answerId,
																			barrierId: barrier.id
																		})
																	}}
																>
																	✗
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

															if (value.length >= 3) {
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
													✓
												</button>
												<button
													className="cancel-relationship-btn"
													style={{
														fontSize: '14px',
														padding: '10px 16px',
														backgroundColor: '#ef4444',
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
													✗
												</button>
											</div>

											{/* Simple Dropdown - Direct Click */}
											{state.relationshipTypeaheadResults?.length > 0 && (
												<div className="typeahead-dropdown">
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

														return filteredBarriers.map((barrier, index) => (
															<div
																key={barrier.id || index}
																className="typeahead-item"
																on={{
																	click: () => {
																		// Fill input and store barrier data with master_id
																		updateState({
																			relationshipTypeaheadText: barrier.name || barrier.label,
																			relationshipTypeaheadResults: [],
																			selectedBarrierData: barrier
																		});
																	}
																}}
															>
																{barrier.name || barrier.label}
															</div>
														));
													})()}
												</div>
											)}
										</div>
									</div>
								)}
							</div>

							{/* Modal System Messages Window */}
							<div className="modal-system-messages" style={{
								borderTop: '1px solid #e0e0e0',
								backgroundColor: '#f8f9fa'
							}}>
								{/* Header with toggle */}
								<div
									className="system-messages-header"
									style={{
										display: 'flex',
										justifyContent: 'space-between',
										alignItems: 'center',
										padding: '8px 12px',
										cursor: 'pointer',
										borderBottom: state.modalSystemMessagesCollapsed ? 'none' : '1px solid #e0e0e0',
										backgroundColor: '#f1f3f4'
									}}
									on={{click: () => dispatch('TOGGLE_MODAL_SYSTEM_MESSAGES')}}
								>
									<span style={{fontWeight: '500', fontSize: '14px'}}>
										System Messages ({state.modalSystemMessages?.length || 0})
									</span>
									<span style={{fontSize: '12px'}}>
										{state.modalSystemMessagesCollapsed ? '▶' : '▼'}
									</span>
								</div>

								{/* Messages content - only show when not collapsed */}
								{!state.modalSystemMessagesCollapsed && (
									<div
										className="system-messages-content"
										style={{
											height: '60px',  // About 2 lines at 14px font
											overflowY: 'auto',
											padding: '8px 12px',
											backgroundColor: '#ffffff'
										}}
									>
										{state.modalSystemMessages?.length > 0 ? (
											<div>
												{state.modalSystemMessages.map((msg, index) => (
													<div
														key={index}
														className={`system-message ${msg.type}`}
														style={{
															padding: '4px 0',
															borderBottom: index < state.modalSystemMessages.length - 1 ? '1px solid #f0f0f0' : 'none',
															fontSize: '12px',
															lineHeight: '1.3'
														}}
													>
														<span className={`message-type ${msg.type}`} style={{
															fontWeight: 'bold',
															color: msg.type === 'success' ? '#28a745' :
																   msg.type === 'error' ? '#dc3545' :
																   msg.type === 'warning' ? '#ffc107' : '#17a2b8',
															marginRight: '8px'
														}}>
															{msg.type === 'success' ? '✓' :
															 msg.type === 'error' ? '✗' :
															 msg.type === 'warning' ? '⚠' : 'ℹ'}
														</span>
														<span>{msg.message}</span>
														<span style={{
															float: 'right',
															color: '#888',
															fontSize: '10px'
														}}>
															{new Date(msg.timestamp).toLocaleTimeString()}
														</span>
													</div>
												))}
											</div>
										) : (
											<div style={{
												color: '#888',
												fontStyle: 'italic',
												fontSize: '12px',
												textAlign: 'center',
												padding: '16px 0'
											}}>
												No messages while modal is open
											</div>
										)}
									</div>
								)}
							</div>

							{/* Modal Footer with Close button */}
							<div className="modal-footer">
								<button
									className="btn-cancel"
									on={{click: () => dispatch('CLOSE_RELATIONSHIP_MODAL')}}
								>
									Close
								</button>
							</div>
						</div>
					</div>
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
		systemMessagesCollapsed: false,
		showRelationships: false, // Toggle for relationship buttons visibility
		isMobileView: false, // Track if window is mobile-sized for responsive inline styles
		sectionsPanelExpanded: false, // Toggle for expanded sections panel
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
		// Modal state for editing long text
		modalOpen: false,
		modalType: null, // 'question' or 'answer'
		modalItemId: null,
		modalText: '',
		modalOriginalText: '',
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
		relationshipModalOpen: false,              // Controls modal visibility
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
		currentInterventionsLoadingGoalId: null   // Track which goal is currently loading interventions
	},
	actionHandlers: {
		[COMPONENT_BOOTSTRAPPED]: (coeffects) => {
			const {dispatch} = coeffects;
			console.log('Component bootstrapped - auto-loading CareIQ config');
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
		
		'CHECK_MOBILE_VIEW': (coeffects) => {
			const {updateState} = coeffects;
			// Increase threshold to catch dev tools scenarios (1342px in your case)
			const isMobile = window.innerWidth <= 1400;
			//console.log('Mobile view check - window.innerWidth:', window.innerWidth, 'isMobile:', isMobile);
			updateState({
				isMobileView: isMobile
			});
		},

		'TOGGLE_SECTIONS_PANEL': (coeffects) => {
			const {updateState, state} = coeffects;
			updateState({
				sectionsPanelExpanded: !state.sectionsPanelExpanded
			});
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
				console.log('Config loaded - keeping loading state until token exchange completes');
				updateState({
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
				app: config.app,
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
			const {action, updateState, dispatch, state} = coeffects;
			console.log('Token Exchange Success - Full Response:', action.payload);
			// Use either access_token (real) or mock_access_token (debug)
			const token = action.payload.access_token || action.payload.mock_access_token;
			console.log('Access Token:', token);
			updateState({
				loading: false,
				accessToken: token
			});
			
			// Automatically fetch use case categories after token success
			console.log('About to dispatch FETCH_USE_CASE_CATEGORIES with config and token');
			dispatch('FETCH_USE_CASE_CATEGORIES', {
				config: state.careiqConfig,
				accessToken: token
			});
			
			// Automatically fetch assessments after token success
			console.log('About to dispatch FETCH_ASSESSMENTS');
			dispatch('FETCH_ASSESSMENTS', {
				offset: 0,
				limit: 200,
				latestVersionOnly: true
			});
		},

		'TOKEN_EXCHANGE_ERROR': (coeffects) => {
			const {action, updateState} = coeffects;
			console.error('Token Exchange Error - Full Response:', action.payload);
			console.error('Error Details:', JSON.stringify(action.payload, null, 2));
			updateState({
				error: 'Failed to exchange token: ' + (action.payload?.message || 'Unknown error')
			});
		},

		'FETCH_USE_CASE_CATEGORIES': (coeffects) => {
			const {action, dispatch, updateState} = coeffects;
			const {config, accessToken} = action.payload;
			
			console.log('FETCH_USE_CASE_CATEGORIES handler called');
			
			updateState({categoriesLoading: true});
			
			const requestBody = JSON.stringify({
				app: config.app,
				region: config.region,
				version: config.version,
				accessToken: accessToken,
				useCase: 'CM'
			});
			
			console.log('Use Case Categories request body:', requestBody);
			
			dispatch('MAKE_USE_CASE_CATEGORIES_REQUEST', {requestBody: requestBody});
		},

		'MAKE_USE_CASE_CATEGORIES_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/use-case-categories', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			startActionType: 'USE_CASE_CATEGORIES_FETCH_START',
			successActionType: 'USE_CASE_CATEGORIES_SUCCESS',
			errorActionType: 'USE_CASE_CATEGORIES_ERROR'
		}),

		'USE_CASE_CATEGORIES_FETCH_START': (coeffects) => {
			const {updateState} = coeffects;
			console.log('USE_CASE_CATEGORIES_FETCH_START - HTTP request started');
			updateState({categoriesLoading: true});
		},

		'USE_CASE_CATEGORIES_SUCCESS': (coeffects) => {
			const {action, updateState} = coeffects;
			// console.log('USE_CASE_CATEGORIES_SUCCESS - Full Response:', action.payload);
			console.log('Response type:', typeof action.payload);
			console.log('Response keys:', Object.keys(action.payload || {}));
			
			// Check if response has use_case_categories
			const categories = action.payload?.use_case_categories;
			console.log('Categories found:', categories);
			console.log('Categories type:', typeof categories);
			console.log('Categories length:', Array.isArray(categories) ? categories.length : 'not array');

			// Log each category for UUID debugging
			if (Array.isArray(categories)) {
				categories.forEach((category, index) => {
					console.log(`Category ${index}:`, category);
					console.log(`Category ${index} keys:`, Object.keys(category || {}));
				});
			}
			
			updateState({
				useCaseCategories: categories || [],
				categoriesLoading: false
			});
		},

		'USE_CASE_CATEGORIES_ERROR': (coeffects) => {
			const {action, updateState} = coeffects;
			console.error('USE_CASE_CATEGORIES_ERROR - Full Response:', action.payload);
			console.error('Error type:', typeof action.payload);
			console.error('Error keys:', Object.keys(action.payload || {}));
			console.error('Error Details:', JSON.stringify(action.payload, null, 2));
			
			const errorMessage = action.payload?.message || 
							   action.payload?.error || 
							   action.payload?.statusText || 
							   'Unknown error';
			
			updateState({
				error: 'Failed to fetch use case categories: ' + errorMessage,
				categoriesLoading: false
			});
		},

		'FETCH_ASSESSMENTS': (coeffects) => {
			const {action, dispatch, updateState} = coeffects;
			const {offset, limit, latestVersionOnly, searchValue} = action.payload;

			console.log('FETCH_ASSESSMENTS handler called');

			updateState({assessmentsLoading: true});

			const requestBody = JSON.stringify({
				useCase: 'CM',
				offset: offset,
				limit: limit,
				contentSource: 'Organization',
				latestVersionOnly: latestVersionOnly,
				searchValue: searchValue
			});

			console.log('Assessments request body:', requestBody);

			dispatch('MAKE_ASSESSMENTS_REQUEST', {requestBody: requestBody});
		},

		'MAKE_ASSESSMENTS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-assessments', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			startActionType: 'ASSESSMENTS_FETCH_START',
			successActionType: 'ASSESSMENTS_SUCCESS',
			errorActionType: 'ASSESSMENTS_ERROR'
		}),

		'ASSESSMENTS_FETCH_START': (coeffects) => {
			const {updateState} = coeffects;
			console.log('ASSESSMENTS_FETCH_START - HTTP request started');
			updateState({assessmentsLoading: true});
		},

		'ASSESSMENTS_SUCCESS': (coeffects) => {
			const {action, state, updateState} = coeffects;
			// console.log('ASSESSMENTS_SUCCESS - Full Response:', action.payload);
			
			const assessments = action.payload?.results || [];
			const total = action.payload?.total || 0;
			const offset = action.payload?.offset || 0;
			const limit = action.payload?.limit || 10;
			
			console.log('Assessments found:', assessments.length);
			console.log('Total assessments:', total);
			
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
					}
				});
			}
		},

		'ASSESSMENTS_ERROR': (coeffects) => {
			const {action, updateState} = coeffects;
			console.error('ASSESSMENTS_ERROR - Full Response:', action.payload);
			
			const errorMessage = action.payload?.message || 
							   action.payload?.error || 
							   action.payload?.statusText || 
							   'Unknown error';
			
			updateState({
				error: 'Failed to fetch assessments: ' + errorMessage,
				assessmentsLoading: false
			});
		},

		'CREATE_NEW_ASSESSMENT': (coeffects) => {
			const {updateState} = coeffects;
			console.log('Create new assessment clicked');
			updateState({
				newAssessmentModalOpen: true,
				// Reset form to defaults
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
			console.log('Save new assessment:', state.newAssessmentForm);

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

			console.log('=== CREATE_ASSESSMENT_API DEBUG ===');
			console.log('Creating assessment with form data:', assessmentData);
			console.log('Current config:', state.careiqConfig);
			console.log('Current access token available:', !!state.accessToken);
			console.log('Available use case categories:', state.useCaseCategories);

			// Get config and access token
			const config = state.careiqConfig;
			const accessToken = state.accessToken;

			// CRITICAL: Map the display name to UUID
			let useCaseCategoryId = assessmentData.useCaseCategory;

			console.log('=== UUID MAPPING DEBUG ===');
			console.log('Looking for category:', assessmentData.useCaseCategory);
			console.log('Categories available:', state.useCaseCategories);

			// Find the category UUID from loaded categories
			if (state.useCaseCategories && Array.isArray(state.useCaseCategories)) {
				console.log('Searching through categories...');
				state.useCaseCategories.forEach((cat, index) => {
					console.log(`Category ${index}:`, cat);
					console.log(`  - name: "${cat.name}"`, cat.name === assessmentData.useCaseCategory);
					console.log(`  - label: "${cat.label}"`, cat.label === assessmentData.useCaseCategory);
					console.log(`  - display_name: "${cat.display_name}"`, cat.display_name === assessmentData.useCaseCategory);
					console.log(`  - id: "${cat.id}"`);
					console.log(`  - uuid: "${cat.uuid}"`);
				});

				const matchingCategory = state.useCaseCategories.find(cat =>
					cat.name === assessmentData.useCaseCategory ||
					cat.label === assessmentData.useCaseCategory ||
					cat.display_name === assessmentData.useCaseCategory
				);

				if (matchingCategory) {
					const oldId = useCaseCategoryId;
					useCaseCategoryId = matchingCategory.id || matchingCategory.uuid;
					console.log('✅ Successfully mapped category:', oldId, '→', useCaseCategoryId);
					console.log('Using category:', matchingCategory);
				} else {
					console.error('❌ Could not find UUID for category:', assessmentData.useCaseCategory);
					console.error('Available category names:', state.useCaseCategories.map(cat => cat.name || cat.label || cat.display_name));

					// CRITICAL: Don't send invalid category name - use first available category as fallback
					const fallbackCategory = state.useCaseCategories[0];
					if (fallbackCategory) {
						useCaseCategoryId = fallbackCategory.id || fallbackCategory.uuid;
						console.warn('🔄 Using fallback category:', fallbackCategory.name, '→', useCaseCategoryId);
					}
				}
			} else {
				console.error('CRITICAL: No use case categories loaded for UUID lookup');
			}

			// Build request body - ServiceNow wraps in data automatically
			// CRITICAL: Send fields directly, ServiceNow HTTP framework adds data wrapper
			const requestBody = JSON.stringify({
				app: config.app,
				region: config.region,
				version: config.version,
				accessToken: accessToken,
				title: assessmentData.guidelineName, // Map guidelineName to title
				use_case: 'CM', // Fixed value as per your example
				content_source: 'Organization', // Fixed value as per your example
				version_name: assessmentData.guidelineName + ' - v1', // Auto-append v1 to the title
				external_id: assessmentData.external_id || '',
				custom_attributes: assessmentData.custom_attributes || {},
				tags: assessmentData.tags || [],
				effective_date: assessmentData.effectiveDate,
				end_date: assessmentData.endDate,
				review_date: assessmentData.reviewDate,
				next_review_date: assessmentData.nextReviewDate,
				tooltip: assessmentData.tooltip || '',
				alternative_wording: assessmentData.alternative_wording || '',
				available: assessmentData.available || false,
				policy_number: assessmentData.codePolicyNumber || '',
				use_case_category_id: useCaseCategoryId, // Use mapped UUID instead of display name
				quality_measures: assessmentData.quality_measures || {},
				settings: assessmentData.settings || {
					store_responses: "use_default"
				},
				usage: assessmentData.usage || 'Care Planning',
				mcg_content_enabled: assessmentData.allowMcgContent || false,
				select_all_enabled: assessmentData.select_all_enabled !== undefined ? assessmentData.select_all_enabled : true,
				multi_tenant_default: assessmentData.multi_tenant_default || false
			});

			console.log('Create assessment request body (ServiceNow will wrap in data):', requestBody);
			console.log('Parsed request body fields:', JSON.parse(requestBody));
			dispatch('MAKE_CREATE_ASSESSMENT_REQUEST', {requestBody: requestBody});
		},

		'MAKE_CREATE_ASSESSMENT_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/create-assessment', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'CREATE_ASSESSMENT_SUCCESS',
			errorActionType: 'CREATE_ASSESSMENT_ERROR'
		}),

		'MAKE_CREATE_VERSION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/create-version', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'CREATE_VERSION_SUCCESS',
			errorActionType: 'CREATE_VERSION_ERROR'
		}),

		'MAKE_UPDATE_ASSESSMENT_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/update-assessment', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'UPDATE_ASSESSMENT_SUCCESS',
			errorActionType: 'UPDATE_ASSESSMENT_ERROR'
		}),

		'MAKE_PUBLISH_ASSESSMENT_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/publish-assessment', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'PUBLISH_ASSESSMENT_SUCCESS',
			errorActionType: 'PUBLISH_ASSESSMENT_ERROR'
		}),

		'CREATE_ASSESSMENT_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			console.log('=== CREATE_ASSESSMENT_SUCCESS DEBUG ===');
			console.log('Full action payload:', action.payload);
			console.log('Response data:', action.payload?.data);
			console.log('Response type:', typeof action.payload);
			console.log('Detail array:', action.payload?.detail);
			console.log('Detail array length:', action.payload?.detail?.length);
			console.log('First detail item:', action.payload?.detail?.[0]);

			// Try to extract the assessment ID from various possible locations
			let newAssessmentId = action.payload?.id || action.payload?.data?.id;

			// Check if the ID is in the detail array
			if (!newAssessmentId && action.payload?.detail?.[0]) {
				const firstDetail = action.payload.detail[0];
				console.log('Checking first detail for ID:', firstDetail);
				newAssessmentId = firstDetail?.id || firstDetail;
			}

			const assessmentTitle = state.newAssessmentForm.guidelineName;

			console.log('Extracted assessment ID:', newAssessmentId);
			console.log('Assessment title:', assessmentTitle);

			// Check if we have a valid ID
			if (!newAssessmentId) {
				console.error('CRITICAL: No assessment ID found in response');
				console.error('Cannot proceed to open assessment builder without ID');
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
			console.log('Opening newly created assessment:', newAssessmentId);
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

			// Close modal and show loading message
			updateState({
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

			// Open the details panel with current assessment data
			updateState({
				assessmentDetailsPanel: {
					isOpen: true,
					useCase: state.currentAssessment?.use_case || '',
					versionName: state.currentAssessment?.version_name || '',
					useCaseCategory: state.currentAssessment?.use_case_category?.id || '',
					useCaseCategoryName: state.currentAssessment?.use_case_category?.name || '',
					usage: state.currentAssessment?.usage || '',
					contentSource: state.currentAssessment?.content_source || '',
					policyNumber: state.currentAssessment?.policy_number || '',
					effectiveDate: state.currentAssessment?.effective_date || '',
					endDate: state.currentAssessment?.end_date || '',
					reviewDate: state.currentAssessment?.review_date || '',
					nextReviewDate: state.currentAssessment?.next_review_date || '',
					responseLogging: state.currentAssessment?.response_logging || false,
					allowMcgContent: state.currentAssessment?.allow_mcg_content || false,
					isEditable: state.currentAssessment?.status === 'draft'
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

		'UPDATE_ASSESSMENT_DETAIL_FIELD': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {field, value} = action.payload;

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

			// Make API call to save assessment details
			const requestBody = JSON.stringify({
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
				allowMcgContent: panelData.allowMcgContent
			});

			dispatch('MAKE_UPDATE_ASSESSMENT_REQUEST', {requestBody: requestBody});
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

			console.log('=== SUBMIT_PUBLISH_ASSESSMENT DEBUG ===');
			console.log('Publish data:', publishData);

			// Close panel and show publishing message
			updateState({
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

			console.log('Publish request body:', requestBody);

			// Make the API call
			dispatch('MAKE_PUBLISH_ASSESSMENT_REQUEST', {requestBody});
		},

		'PUBLISH_ASSESSMENT_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== PUBLISH_ASSESSMENT_SUCCESS DEBUG ===');
			console.log('Full action payload:', action.payload);
			console.log('Response data:', action.payload?.data);

			// Extract the new assessment ID from response
			const newAssessmentId = action.payload?.id || action.payload?.data?.id;

			console.log('New assessment ID from response:', newAssessmentId);

			// Show success message
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Assessment published successfully! Reloading assessment data...',
						timestamp: new Date().toISOString()
					}
				]
			});

			// If we got a new ID, use it to reload the assessment
			if (newAssessmentId) {
				console.log('Reloading assessment with new ID:', newAssessmentId);
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: newAssessmentId,
					assessmentTitle: state.currentAssessment?.title || 'Assessment'
				});
			} else {
				console.log('No new ID found, reloading with current ID:', state.currentAssessmentId);
				// Fallback: reload with current ID
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessmentId,
					assessmentTitle: state.currentAssessment?.title || 'Assessment'
				});
			}
		},

		'PUBLISH_ASSESSMENT_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.log('=== PUBLISH_ASSESSMENT_ERROR DEBUG ===');
			console.log('Error payload:', action.payload);

			let errorMessage = 'Failed to publish assessment';

			// Extract error message from response
			if (action.payload?.error) {
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
				]
			});
		},

		'UPDATE_ASSESSMENT_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

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

			// Debug logging to see the actual response structure
			console.log('=== CREATE_VERSION_SUCCESS DEBUG ===');
			console.log('Full action payload:', action.payload);
			console.log('Payload type:', typeof action.payload);
			console.log('Payload keys:', action.payload ? Object.keys(action.payload) : 'null');
			console.log('=====================================');

			// Check if this is actually an error response disguised as success
			if (action.payload && (action.payload.detail || action.payload.error)) {
				const errorMessage = action.payload.detail || action.payload.error;
				updateState({
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
			const {action, updateState, state} = coeffects;

			// Extract error message from backend response
			let errorMessage = 'Failed to create new version';
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
				]
			});
		},

		'GOTO_NEXT_PAGE': (coeffects) => {
			const {state, updateState} = coeffects;
			const dataToShow = state.filteredAssessments || state.assessments;
			const totalPages = Math.ceil(dataToShow.length / state.assessmentsPagination.displayPageSize);
			const newPage = Math.min(state.assessmentsPagination.displayPage + 1, totalPages - 1);
			
			console.log('Going to next page:', newPage);
			
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
			
			console.log('Going to previous page:', newPage);
			
			updateState({
				assessmentsPagination: {
					...state.assessmentsPagination,
					displayPage: newPage
				}
			});
		},

		'GOTO_FIRST_PAGE': (coeffects) => {
			const {state, updateState} = coeffects;
			
			console.log('Going to first page');
			
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
			
			console.log('Going to last page:', lastPage);
			
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
			
			console.log('Changing page size to:', pageSize);
			
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
			
			console.log('Expanding versions for assessment:', assessmentTitle);
			
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
			
			console.log('Fetching all versions for:', baseTitle);
			
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
			const {assessmentId, assessmentTitle} = action.payload;
			
			console.log('Opening assessment builder for:', assessmentTitle, 'ID:', assessmentId);
			
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
			
			console.log('=== REFRESHING ASSESSMENT DETAILS ===');
			console.log('Assessment ID:', gtId);
			console.log('Pending section reselection:', pendingReselectionSection);
			
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
			
			console.log('=== MANUAL REFRESH TRIGGERED ===');
			console.log('Current assessment:', state.currentAssessment);
			console.log('Assessment ID path:', state.currentAssessment?.ids?.id);
			console.log('Assessment Title:', state.currentAssessment?.title);
			
			// Store the current section to re-select after refresh
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			// Store assessment details before clearing state
			// Use the stored currentAssessmentId which is set when opening the builder
			const assessmentId = state.currentAssessmentId;
			const assessmentTitle = state.currentAssessment?.title;
			
			console.log('Stored assessment ID for refresh:', assessmentId);
			console.log('Stored assessment title for refresh:', assessmentTitle);
			console.log('Available ID sources:');
			console.log('  - currentAssessmentId:', state.currentAssessmentId);
			console.log('  - currentAssessment.ids.id:', state.currentAssessment?.ids?.id);
			console.log('  - currentAssessment.id:', state.currentAssessment?.id);
			
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
			console.log('Dispatching FETCH_ASSESSMENT_DETAILS with:', {
				assessmentId: assessmentId,
				assessmentTitle: assessmentTitle
			});
			
			dispatch('FETCH_ASSESSMENT_DETAILS', {
				assessmentId: assessmentId,
				assessmentTitle: assessmentTitle
			});
		},

		'FETCH_ASSESSMENT_DETAILS': (coeffects) => {
			const {action, state, dispatch} = coeffects;
			const {assessmentId, assessmentTitle} = action.payload;
			
			console.log('FETCH_ASSESSMENT_DETAILS - assessmentId from payload:', assessmentId);
			console.log('FETCH_ASSESSMENT_DETAILS - assessmentTitle from payload:', assessmentTitle);
			console.log('Fetching assessment details for:', assessmentTitle);
			
			const requestBody = JSON.stringify({
				assessmentId: assessmentId
			});

			console.log('Assessment details request body:', requestBody);
			console.log('Assessment ID being sent:', assessmentId);
			
			dispatch('MAKE_ASSESSMENT_DETAILS_REQUEST', {requestBody: requestBody});
		},

		'MAKE_ASSESSMENT_DETAILS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-sections', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			startActionType: 'ASSESSMENT_DETAILS_FETCH_START',
			successActionType: 'ASSESSMENT_DETAILS_SUCCESS',
			errorActionType: 'ASSESSMENT_DETAILS_ERROR'
		}),

		'ASSESSMENT_DETAILS_FETCH_START': (coeffects) => {
			const {updateState} = coeffects;
			console.log('ASSESSMENT_DETAILS_FETCH_START - HTTP request started');
			updateState({assessmentDetailsLoading: true});
		},

		'ASSESSMENT_DETAILS_SUCCESS': (coeffects) => {
			const {action, updateState, dispatch, state} = coeffects;
			// console.log('ASSESSMENT_DETAILS_SUCCESS - Full Response:', action.payload);
			
			// Debug section sort_order values
			if (action.payload?.sections) {
				action.payload.sections.forEach(section => {
					console.log('Section:', section.label, 'sort_order:', section.sort_order);
					if (section.subsections) {
						section.subsections.forEach(subsection => {
							console.log('  Subsection:', subsection.label, 'sort_order:', subsection.sort_order);
						});
					}
				});
			}
			
			// Check if we need to re-select a section after save
			const pendingReselection = state.pendingReselectionSection;
			const pendingReselectionLabel = state.pendingReselectionSectionLabel;
			
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
				console.log('Re-selecting section after save:', pendingReselectionLabel);
				sectionToSelect = pendingReselection;
				sectionLabelToSelect = pendingReselectionLabel;
			} else {
				// Auto-select first section (by sort_order) for immediate editing
				const sortedSections = (action.payload?.sections || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
				const firstSection = sortedSections[0];
				const sortedSubsections = firstSection?.subsections?.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
				const firstSubsection = sortedSubsections?.[0];
				
				if (firstSubsection) {
					console.log('Auto-selecting first section by sort_order:', firstSubsection.label, 'sort_order:', firstSubsection.sort_order);
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
			const {action, updateState} = coeffects;
			console.error('ASSESSMENT_DETAILS_ERROR - Full Response:', action.payload);
			
			const errorMessage = action.payload?.message || 
							   action.payload?.error || 
							   action.payload?.statusText || 
							   'Unknown error';
			
			updateState({
				error: 'Failed to fetch assessment details: ' + errorMessage,
				assessmentDetailsLoading: false
			});
		},

		'CLOSE_ASSESSMENT_BUILDER': (coeffects) => {
			const {updateState} = coeffects;
			console.log('Closing assessment builder');
			
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
			const {sectionId, sectionLabel} = action.payload;
			
			console.log('Selecting section:', sectionLabel, 'ID:', sectionId);
			
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
			
			console.log('FETCH_SECTION_QUESTIONS - action.payload:', action.payload);
			console.log('FETCH_SECTION_QUESTIONS - sectionId:', sectionId);
			console.log('FETCH_SECTION_QUESTIONS - sectionLabel:', sectionLabel);
			console.log('Fetching questions for section (simplified):', sectionLabel);
			
			const requestBody = JSON.stringify({
				gtId: state.currentAssessmentId,
				sectionId: sectionId
			});
			
			console.log('Section questions request body (simplified):', requestBody);
			
			dispatch('MAKE_SECTION_QUESTIONS_REQUEST', {requestBody: requestBody});
		},

		'MAKE_SECTION_QUESTIONS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-section-questions', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			startActionType: 'SECTION_QUESTIONS_FETCH_START',
			successActionType: 'SECTION_QUESTIONS_SUCCESS',
			errorActionType: 'SECTION_QUESTIONS_ERROR'
		}),

		'SECTION_QUESTIONS_FETCH_START': (coeffects) => {
			const {updateState} = coeffects;
			console.log('SECTION_QUESTIONS_FETCH_START - HTTP request started');
			updateState({questionsLoading: true});
		},

		'SECTION_QUESTIONS_SUCCESS': (coeffects) => {
			const {action, updateState} = coeffects;
			// console.log('SECTION_QUESTIONS_SUCCESS - Full Response:', action.payload);
			// console.log('SECTION_QUESTIONS_SUCCESS - Response type:', typeof action.payload);
			// console.log('SECTION_QUESTIONS_SUCCESS - Response keys:', Object.keys(action.payload || {}));
			// console.log('SECTION_QUESTIONS_SUCCESS - Questions array:', action.payload?.questions);
			
			// Sort questions by sort_order
			const questions = action.payload?.questions || [];
			const sortedQuestions = questions.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
			
			// Sort answers within each question by sort_order
			const questionsWithSortedAnswers = sortedQuestions.map(question => ({
				...question,
				answers: question.answers ? question.answers.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) : []
			}));
			
			// Debug: log the questions structure to understand triggered_questions format
			console.log('Questions loaded with structure:', questionsWithSortedAnswers);
			questionsWithSortedAnswers.forEach((question, qIndex) => {
				console.log(`Question ${qIndex + 1} (${question.ids?.id}):`, question.label, 'Hidden:', question.hidden);
				question.answers?.forEach((answer, aIndex) => {
					console.log(`  Answer ${aIndex + 1} (${answer.ids?.id}):`, answer.label, 'Secondary input type:', answer.secondary_input_type);
					if (answer.triggered_questions && answer.triggered_questions.length > 0) {
						console.log(`  Answer ${aIndex + 1} (${answer.ids?.id}):`, answer.label, 'Triggers:', answer.triggered_questions);
					}
				});
			});
			
			// Initialize visible questions for preview mode (no relationships loaded yet)
			const initialVisibleQuestions = calculateVisibleQuestions({}, questionsWithSortedAnswers, {});
			console.log('Initial visible questions:', initialVisibleQuestions);
			
			updateState({
				currentQuestions: {
					...action.payload,
					questions: questionsWithSortedAnswers
				},
				questionsLoading: false,
				visibleQuestions: initialVisibleQuestions,
				// Clear all changes after successful data refresh
				sectionChanges: {},
				relationshipChanges: {}
			});
		},

		'SECTION_QUESTIONS_ERROR': (coeffects) => {
			const {action, updateState} = coeffects;
			console.error('SECTION_QUESTIONS_ERROR - Full Response:', action.payload);
			
			const errorMessage = action.payload?.message || 
							   action.payload?.error || 
							   action.payload?.statusText || 
							   'Unknown error';
			
			updateState({
				error: 'Failed to fetch section questions: ' + errorMessage,
				questionsLoading: false
			});
		},

		'TOGGLE_BUILDER_MODE': (coeffects) => {
			const {action, updateState} = coeffects;
			const {mode} = action.payload;
			
			console.log('Toggling builder mode to:', mode ? 'Edit' : 'Preview');
			
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
			
			console.log('Selecting answer:', {questionId, answerId, questionType});
			
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
			
			console.log('Answer selection check:', {
				answerWasSelected,
				answerId,
				hasRelationships: !!state.answerRelationships[answerId],
				isLoading: !!state.relationshipsLoading[answerId],
				currentRelationships: state.answerRelationships,
				currentLoadingStates: state.relationshipsLoading
			});
			
			if (answerWasSelected && !state.answerRelationships[answerId] && !state.relationshipsLoading[answerId]) {
				console.log('Auto-loading relationships for selected answer:', answerId);
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
			
			console.log('Handling mutually exclusive answer:', {questionId, answerId});
			
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

			console.log('Reordering questions:', {sourceIndex, targetIndex});

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
			console.log('Question reorder completed - auto-saving changes');
			dispatch('SAVE_ALL_CHANGES');
		},

		'REORDER_ANSWERS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId, sourceIndex, targetIndex} = action.payload;
			
			console.log('Reordering answers:', {questionId, sourceIndex, targetIndex});
			
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
			
			questions[questionIndex] = {
				...questions[questionIndex],
				answers: updatedAnswers
			};

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: questions
				}
			});

			// Auto-save only the affected answers with individual UPDATE_ANSWER_API calls
			console.log('Answer reorder completed - making individual update calls');
			updatedAnswers.forEach(answer => {
				// Only update real answers (not temp ones)
				if (!answer.ids.id.startsWith('temp_')) {
					console.log('Updating answer sort_order:', answer.ids.id, 'to:', answer.sort_order);
					dispatch('UPDATE_ANSWER_API', {
						answerData: {
							answerId: answer.ids.id,
							sort_order: answer.sort_order,
							// Include other required fields
							label: answer.label,
							tooltip: answer.tooltip || '',
							alternative_wording: answer.alternative_wording || 'string',
							required: answer.required || false,
							custom_attributes: answer.custom_attributes || {},
							secondary_input_type: answer.secondary_input_type,
							mutually_exclusive: answer.mutually_exclusive || false
						}
					});
				}
			});
		},

		'ADD_QUESTION': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {sectionId} = action.payload;

			console.log('Adding new question to section:', sectionId);

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
				label: 'New Question',
				type: 'Single Select',
				required: false,
				hidden: false,
				tooltip: '',
				sort_order: nextSortOrder,
				answers: [
					{
						ids: { id: 'temp_answer_' + Date.now() + '_1' },
						label: 'Option 1',
						sort_order: 1,
						secondary_input_type: null,
						mutually_exclusive: false,
						tooltip: '',
						triggered_questions: []
					}
				],
				// Mark as unsaved
				isUnsaved: true
			};

			const updatedQuestions = [...state.currentQuestions.questions, newQuestion];

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				}
			});
		},

		'UPDATE_QUESTION_TYPE': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, newType} = action.payload;

			console.log('Updating question type:', questionId, 'to:', newType);

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
								label: 'Option 1',
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
				// Track question change for save
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						action: 'update',
						questionId: questionId,
						type: newType
					}
				}
			});
		},

		'UPDATE_QUESTION_LABEL': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, newLabel} = action.payload;

			console.log('Updating question label:', questionId, 'to:', newLabel);

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
				// Track question change for save
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						action: 'update',
						questionId: questionId,
						label: newLabel
					}
				}
			});
		},

		'UPDATE_QUESTION_VOICE': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, newVoice} = action.payload;

			console.log('Updating question voice:', questionId, 'to:', newVoice);

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
				// Track question change for save
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						action: 'update',
						questionId: questionId,
						voice: newVoice
					}
				}
			});
		},

		'UPDATE_QUESTION_REQUIRED': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId, required} = action.payload;

			console.log('Updating question required:', questionId, 'to:', required);

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
				// Track question change for save
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						action: 'update',
						questionId: questionId,
						required: required
					}
				}
			});
		},

		'ADD_ANSWER': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {questionId} = action.payload;

			console.log('Adding new answer to question:', questionId);

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
						label: `Option ${nextSortOrder}`,
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
					label: `Option ${updatedQuestions.find(q => q.ids.id === questionId)?.answers?.length || 1}`,
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

			console.log('Deleting answer:', answerId, 'from question:', questionId);

			if (!state.currentQuestions?.questions) {
				return;
			}

			// Remove the answer from the current questions
			const updatedQuestions = state.currentQuestions.questions.map(question => {
				if (question.ids.id === questionId) {
					return {
						...question,
						answers: question.answers?.filter(answer => answer.ids.id !== answerId) || [],
						isUnsaved: true // Mark question as needing save
					};
				}
				return question;
			});

			// Track this deletion in answerChanges for save logic (similar to add/library answers)
			const answerChanges = {
				...state.answerChanges,
				[answerId]: {
					action: 'delete',
					question_id: questionId, // Use question_id to match other patterns
					answerId: answerId
				}
			};

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				answerChanges: answerChanges // Track the deletion for save
			});
		},

		'DELETE_QUESTION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId} = action.payload;

			console.log('Deleting question:', questionId);

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
			console.log('Deleting question:', questionLabel);

			// Show confirmation alert like sections
			if (confirm(`Are you sure you want to delete question "${questionLabel}"?`)) {
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
					console.log('Calling backend API to delete question:', questionId);
					dispatch('DELETE_QUESTION_API', { questionId });
				} else {
					console.log('Skipping backend API call - temp question:', questionId);
					// Show immediate success message for temp questions
					updateState({
						systemMessages: [
					...(state.systemMessages || []),
							
							{
								type: 'success',
								message: 'Question removed successfully! No backend call needed.',
								timestamp: new Date().toISOString()
							}
						]
					});
				}
			}
		},

		'SAVE_QUESTION_IMMEDIATELY': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {questionId} = action.payload;

			console.log('Saving question immediately:', questionId);

			const question = state.currentQuestions?.questions?.find(q => q.ids.id === questionId);
			if (!question) {
				console.error('Question not found for saving:', questionId);
				return;
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
				console.log('Question has answer changes - using SAVE_ALL_CHANGES instead');
				console.log('Answer changes found:', questionAnswerChanges);
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
							existingQuestions.push(existingQuestion.label.toLowerCase().trim());
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
				// New question - use new 2-step process
				console.log('Using new 2-step process for question type:', question.type);

				if (question.type === 'Text' || question.type === 'Date' || question.type === 'Numeric') {
					// Step 1: Add question to section (no answers needed)
					console.log('Step 1: Adding Text/Date/Numeric question to section');
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
						sectionId: state.selectedSection
					});
				} else if (question.type === 'Single Select' || question.type === 'Multiselect') {
					// Check if this is a library question
					// Use 2-step process for both library and regular questions
					console.log('Step 1: Adding Single Select/Multiselect question to section');

					if (question.isLibraryQuestion) {
						console.log('Library question ID:', question.libraryQuestionId);
					}

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

					// Add library_id for library questions
					if (question.isLibraryQuestion && question.libraryQuestionId) {
						questionData.library_id = question.libraryQuestionId;
					}

					dispatch('ADD_QUESTION_TO_SECTION_API', {
						questionData: questionData,
						sectionId: state.selectedSection,
						// Store answers for step 2 (both library and regular questions)
						pendingAnswers: question.answers || []
					});
				} else {
					// Fallback for any other question types
					console.log('Using fallback method for question type:', question.type);
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
				dispatch('UPDATE_QUESTION_API', {
					questionData: {
						questionId: questionId,
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
		},

		'LOAD_ANSWER_RELATIONSHIPS': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {answerId} = action.payload;
			
			console.log('=== LOAD_ANSWER_RELATIONSHIPS ACTION TRIGGERED ===');
			console.log('Loading answer relationships for answerId:', answerId);
			console.log('Current access token:', state.accessToken);
			console.log('Current careiq config:', state.careiqConfig);
			
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
			
			console.log('Answer relationships request body (simplified):', requestBody);
			
			dispatch('MAKE_ANSWER_RELATIONSHIPS_REQUEST', {requestBody: requestBody});
		},

		'MAKE_ANSWER_RELATIONSHIPS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/answer-relationships', {
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

			console.log('=== ANSWER_RELATIONSHIPS_SUCCESS ===');
			console.log('Full Response:', action.payload);
			console.log('Response type:', typeof action.payload);
			console.log('Response keys:', Object.keys(action.payload || {}));
			console.log('Action meta:', action.meta);
			console.log('Guidelines in response:', action.payload?.guidelines);
			console.log('=== DEBUGGING MISSING GUIDELINE ===');
			console.log('Expected to see newly added guideline in guidelines array');
			console.log('Guidelines array length:', action.payload?.guidelines?.guidelines?.length || 0);
			console.log('Full guidelines structure:', JSON.stringify(action.payload?.guidelines, null, 2));
			
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
			
			console.log('Recalculating visible questions after relationships loaded:', visibleQuestions);
			
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
			
			// We'll need to track which answer this was for in loading state
			// For now, clear all loading states on error
			updateState({
				relationshipsLoading: {},
				error: 'Failed to fetch answer relationships: ' + (action.payload?.error || 'Unknown error')
			});
		},


		'MAKE_ADD_BRANCH_QUESTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-branch-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_BRANCH_QUESTION_SUCCESS',
			errorActionType: 'ADD_BRANCH_QUESTION_ERROR'
		}),

		'MAKE_ADD_GUIDELINE_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-guideline-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_GUIDELINE_RELATIONSHIP_SUCCESS',
			errorActionType: 'ADD_GUIDELINE_RELATIONSHIP_ERROR'
		}),

		'ADD_GUIDELINE_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== ADD_GUIDELINE_RELATIONSHIP_SUCCESS ===');
			console.log('Guideline relationship added successfully');
			console.log('Response payload:', action.payload);
			console.log('Action meta:', action.meta);

			// Get the answer ID from the original request body since meta doesn't persist through HTTP effect
			let answerId = null;
			try {
				// The answerId should be in the original request that triggered this success
				// Look for it in the current action or extract from stored state
				if (action.meta && action.meta.answerId) {
					answerId = action.meta.answerId;
					console.log('Got answerId from action.meta:', answerId);
				} else {
					// Fallback: look for the currently opened relationship panel
					const openPanels = Object.keys(state.answerRelationships || {});
					if (openPanels.length > 0) {
						answerId = openPanels[0]; // Use the first open panel
						console.log('Got answerId from open relationship panel:', answerId);
					}
				}
			} catch (e) {
				console.error('Error extracting answerId:', e);
			}

			// Show success message - don't clear relationshipChanges until refresh completes
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Guideline relationship saved successfully! Auto-refreshing now...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Immediate auto-refresh since backend has already committed
			if (answerId) {
				console.log('=== AUTO-REFRESH: Immediately refreshing for answerId:', answerId);
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
				]
			});
		},

		'ADD_BRANCH_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== ADD_BRANCH_QUESTION_SUCCESS ===');
			console.log('Question relationship added successfully');
			console.log('Response payload:', action.payload);
			console.log('Action meta:', action.meta);

			// Get the answer ID using the same fallback pattern as guidelines
			let answerId = null;
			try {
				// The answerId should be in the original request that triggered this success
				if (action.meta && action.meta.answerId) {
					answerId = action.meta.answerId;
					console.log('Got answerId from action.meta:', answerId);
				} else {
					// Fallback: look for the currently opened relationship panel
					const openPanels = Object.keys(state.answerRelationships || {});
					if (openPanels.length > 0) {
						answerId = openPanels[0]; // Use the first open panel
						console.log('Got answerId from open relationship panel:', answerId);
					}
				}
			} catch (e) {
				console.error('Error extracting answerId:', e);
			}

			// Clear relationship changes and show success message
			updateState({
				relationshipChanges: {},
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Question relationship saved successfully! Auto-refreshing now...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Immediate auto-refresh since backend has already committed (same as guidelines)
			if (answerId) {
				console.log('=== AUTO-REFRESH: Immediately refreshing for answerId:', answerId);
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}
		},

		'ADD_BRANCH_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			
			console.error('ADD_BRANCH_QUESTION_ERROR:', action.payload);
			
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to add triggered question: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},
		'DELETE_BRANCH_QUESTION': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {answerId, questionId, questionLabel} = action.payload;
			
			console.log('=== DELETE_BRANCH_QUESTION ACTION TRIGGERED ===');
			console.log('Deleting branch question:', questionId, 'from answer:', answerId);
			
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
		'MAKE_DELETE_BRANCH_QUESTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-branch-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_BRANCH_QUESTION_SUCCESS',
			errorActionType: 'DELETE_BRANCH_QUESTION_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_DELETE_GUIDELINE_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-guideline-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_GUIDELINE_RELATIONSHIP_SUCCESS',
			errorActionType: 'DELETE_GUIDELINE_RELATIONSHIP_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_BARRIER_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-barrier-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_BARRIER_RELATIONSHIP_SUCCESS',
			errorActionType: 'ADD_BARRIER_RELATIONSHIP_ERROR'
		}),

		'MAKE_DELETE_BARRIER_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-barrier-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_BARRIER_RELATIONSHIP_SUCCESS',
			errorActionType: 'DELETE_BARRIER_RELATIONSHIP_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_PROBLEM_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-problem-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_PROBLEM_RELATIONSHIP_SUCCESS',
			errorActionType: 'ADD_PROBLEM_RELATIONSHIP_ERROR'
		}),

		'MAKE_SAVE_PROBLEM_EDITS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/save-problem-edits', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'SAVE_PROBLEM_EDITS_SUCCESS',
			errorActionType: 'SAVE_PROBLEM_EDITS_ERROR'
		}),

		'MAKE_GET_PROBLEM_DETAILS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-problem-details', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GET_PROBLEM_DETAILS_SUCCESS',
			errorActionType: 'GET_PROBLEM_DETAILS_ERROR'
		}),

		'MAKE_GET_GOAL_DETAILS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-goal-details', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GET_GOAL_DETAILS_SUCCESS',
			errorActionType: 'GET_GOAL_DETAILS_ERROR'
		}),

		'MAKE_UPDATE_GOAL_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/update-goal', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'UPDATE_GOAL_SUCCESS',
			errorActionType: 'UPDATE_GOAL_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_GET_INTERVENTION_DETAILS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-intervention-details', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GET_INTERVENTION_DETAILS_SUCCESS',
			errorActionType: 'GET_INTERVENTION_DETAILS_ERROR'
		}),

		'MAKE_UPDATE_INTERVENTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/update-intervention', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'UPDATE_INTERVENTION_SUCCESS',
			errorActionType: 'UPDATE_INTERVENTION_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_DELETE_PROBLEM_RELATIONSHIP_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-problem-relationship', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_PROBLEM_RELATIONSHIP_SUCCESS',
			errorActionType: 'DELETE_PROBLEM_RELATIONSHIP_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_DELETE_GOAL_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-goal', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_GOAL_SUCCESS',
			errorActionType: 'DELETE_GOAL_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_DELETE_INTERVENTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-intervention', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_INTERVENTION_SUCCESS',
			errorActionType: 'DELETE_INTERVENTION_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_LOAD_PROBLEM_GOALS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-problem-goals', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'LOAD_PROBLEM_GOALS_SUCCESS',
			errorActionType: 'LOAD_PROBLEM_GOALS_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_GOAL_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-goal', {
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
		'MAKE_LOAD_GOAL_INTERVENTIONS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-goal-interventions', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'LOAD_GOAL_INTERVENTIONS_SUCCESS',
			errorActionType: 'LOAD_GOAL_INTERVENTIONS_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ADD_INTERVENTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-intervention', {
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
			
			console.log('=== DELETE_BRANCH_QUESTION_SUCCESS ===');
			console.log('API Response:', action.payload);
			console.log('Original action data:', action.meta);
			
			// Get original data from meta (passed through HTTP effect)
			const {answerId, questionId, questionLabel} = action.meta || {};
			
			console.log('Branch question deleted successfully:', questionId, 'from answer:', answerId);
			
			// Follow CLAUDE.md refresh pattern - store current section for reselection
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			// Clear all change tracking arrays and reset UI state for fresh start
			updateState({
				relationshipChanges: {},
				sectionChanges: {},
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Successfully deleted triggered question "${questionLabel}" from answer relationship! Refreshing data...`,
						timestamp: new Date().toISOString()
					}
				],
				// Store pending reselection data - both ID and label needed
				pendingReselectionSection: currentSection,
				pendingReselectionSectionLabel: currentSectionLabel,
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
				selectedRelationshipQuestion: null
			});
			
			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipModalOpen && state.relationshipModalAnswerId === answerId) {
				console.log('Refreshing relationships for modal:', answerId);
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			}

			// Dispatch FETCH_ASSESSMENT_DETAILS to reload complete assessment structure
			dispatch('FETCH_ASSESSMENT_DETAILS', {
				assessmentId: state.currentAssessmentId
			});
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
				]
			});
		},

		'DELETE_GUIDELINE_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== DELETE_GUIDELINE_RELATIONSHIP_SUCCESS ===');
			console.log('API Response:', action.payload);
			console.log('Original action data:', action.meta);
			console.log('action.meta type:', typeof action.meta);
			if (action.meta) {
				console.log('action.meta keys:', Object.keys(action.meta));
			}

			// Get original data from response payload (enhanced by backend API)
			const originalRequest = action.payload?.originalRequest || {};
			const {answerId, guidelineId, guidelineName} = originalRequest;

			console.log('Guideline relationship deleted successfully:', guidelineId, 'from answer:', answerId);
			console.log('Extracted values:', {answerId, guidelineId, guidelineName});
			console.log('Modal state check:', {
				relationshipModalOpen: state.relationshipModalOpen,
				relationshipModalAnswerId: state.relationshipModalAnswerId,
				conditionMet: answerId && state.relationshipModalOpen && state.relationshipModalAnswerId === answerId
			});

			// Show success message
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `Successfully deleted guideline relationship "${guidelineName}"! Refreshing data...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipModalOpen && state.relationshipModalAnswerId === answerId) {
				console.log('Refreshing relationships for modal:', answerId);
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
				]
			});
		},

		'ADD_BARRIER_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== ADD_BARRIER_RELATIONSHIP_SUCCESS ===');
			console.log('API Response:', action.payload);

			// Check if the response contains an error (API can return 200 with error details)
			if (action.payload?.detail && (
				action.payload.detail.toLowerCase().includes('required') ||
				action.payload.detail.toLowerCase().includes('should be provided') ||
				action.payload.detail.toLowerCase().includes('error') ||
				action.payload.detail.toLowerCase().includes('failed')
			)) {
				console.error('API returned error in success response:', action.payload.detail);
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Failed to add barrier: ${action.payload.detail}`,
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Get original data from response payload
			const originalRequest = action.payload?.originalRequest || {};
			const {answerId, barrierName} = originalRequest;

			console.log('Barrier relationship added successfully:', barrierName, 'to answer:', answerId);

			// Show success message
			const successMessage = {
				type: 'success',
				message: `Successfully added barrier "${barrierName}"! Refreshing data...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), successMessage],
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages,
				// Clear typeahead state
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedBarrierData: null
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipModalOpen && state.relationshipModalAnswerId === answerId) {
				console.log('Refreshing relationships for modal:', answerId);
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
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'ADD_PROBLEM_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== ADD_PROBLEM_RELATIONSHIP_SUCCESS ===');
			console.log('API Response:', action.payload);

			// Check if the response contains an error (API can return 200 with error details)
			if (action.payload?.detail && (
				action.payload.detail.toLowerCase().includes('required') ||
				action.payload.detail.toLowerCase().includes('should be provided') ||
				action.payload.detail.toLowerCase().includes('error') ||
				action.payload.detail.toLowerCase().includes('failed')
			)) {
				console.error('API returned error in success response:', action.payload.detail);
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: `Failed to add problem: ${action.payload.detail}`,
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}

			// Get original data from response payload
			const originalRequest = action.payload?.originalRequest || {};
			const {answerId, problemName} = originalRequest;

			console.log('Problem relationship added successfully:', problemName, 'to answer:', answerId);

			// Show success message
			const successMessage = {
				type: 'success',
				message: `Successfully added problem "${problemName}"! Refreshing data...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					successMessage
				],
				// Also add to modal messages if modal is open
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages,
				// Clear typeahead state
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedProblemData: null
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipModalOpen && state.relationshipModalAnswerId === answerId) {
				console.log('Refreshing relationships for modal:', answerId);
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

			const errorMessage = {
				type: 'error',
				message: `Failed to add problem relationship: ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessage],
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'DELETE_BARRIER_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== DELETE_BARRIER_RELATIONSHIP_SUCCESS ===');
			console.log('API Response:', action.payload);

			const successMessage = {
				type: 'success',
				message: `Barrier relationship deleted successfully! Refreshing data...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), successMessage],
				modalSystemMessages: state.relationshipModalOpen ? [
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
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'REMOVE_BARRIER_RELATIONSHIP': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, barrierId} = action.payload;

			console.log('=== REMOVE_BARRIER_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Deleting barrier:', barrierId, 'from answer:', answerId);
			console.log('Full payload:', action.payload);

			// Find barrier name for user feedback
			const relationships = state.answerRelationships?.[answerId];
			const barrier = relationships?.barriers?.barriers?.find(b => b.id === barrierId);
			const barrierName = barrier?.label || barrier?.name || 'Unknown Barrier';

			console.log('Found barrier name:', barrierName);

			// AUTO-DELETE: Immediately call API
			const requestBody = JSON.stringify({
				barrierId: barrierId
			});

			console.log('=== DELETE BARRIER REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

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

			console.log('=== SAVE_PROBLEM_EDITS ACTION TRIGGERED ===');
			console.log('Saving problem edits for:', problemId, 'on answer:', answerId);
			console.log('Edit data:', editData);

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
				custom_attributes: currentProblem.custom_attributes || {},
				required: currentProblem.required || false
			});

			console.log('=== SAVE PROBLEM EDITS REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

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

			console.log('=== SAVE_PROBLEM_EDITS_SUCCESS ===');
			console.log('API Response:', action.payload);
			console.log('Response type:', typeof action.payload);

			// Handle 204 No Content response (null/empty payload is expected and indicates success)
			if (action.payload === null || action.payload === undefined) {
				console.log('API returned 204 No Content - this is expected for successful PATCH operations');

				const successMessage = {
					type: 'success',
					message: 'Problem updated successfully! Refreshing data...',
					timestamp: new Date().toISOString()
				};

				updateState({
					systemMessages: [...(state.systemMessages || []), successMessage],
					modalSystemMessages: state.relationshipModalOpen ? [
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
					modalSystemMessages: state.relationshipModalOpen ? [
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
				modalSystemMessages: state.relationshipModalOpen ? [
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

			const errorMessage = {
				type: 'error',
				message: `Failed to update problem: ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessage],
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'TOGGLE_SYSTEM_MESSAGES': (coeffects) => {
			const {updateState, state} = coeffects;
			
			updateState({
				systemMessagesCollapsed: !state.systemMessagesCollapsed
			});
		},

		'TOGGLE_EDIT_RELATIONSHIPS': (coeffects) => {
			const {updateState, state} = coeffects;
			
			console.log('Toggling relationship visibility:', !state.showRelationships);
			
			updateState({
				showRelationships: !state.showRelationships
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
			
			console.log('=== RELATIONSHIP_TYPEAHEAD_INPUT ===');
			console.log('Search text:', text);
			console.log('Answer ID:', answerId);
			console.log('Available questions:', state.currentQuestions?.questions?.length);
			
			updateState({
				relationshipTypeaheadText: text
			});
			
			// Filter questions from current section based on input text
			if (text.length >= 3 && state.currentQuestions?.questions) {
				console.log('=== DEBUG: Finding current answer ===');
				console.log('Looking for answerId:', answerId);
				console.log('All questions structure:', state.currentQuestions.questions.map(q => ({
					id: q.ids?.id, 
					label: q.label,
					answersCount: q.answers?.length || 0
				})));
				
				// Find the current answer to check its existing triggered questions
				let currentAnswer = null;
				for (const question of state.currentQuestions.questions) {
					if (question.answers) {
						for (const answer of question.answers) {
							if (answer.ids.id === answerId) {
								currentAnswer = answer;
								console.log('=== FOUND CURRENT ANSWER ===');
								console.log('Answer:', answer.label);
								console.log('Triggered questions:', answer.triggered_questions);
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
				
				console.log('=== FILTERING QUESTIONS ===');
				console.log('Local triggered questions (from answer):', localTriggeredQuestions);
				console.log('API triggered questions (from relationships):', apiTriggeredQuestions);
				console.log('Combined triggered questions:', allTriggeredQuestions);
				
				const filteredQuestions = state.currentQuestions.questions.filter(question => {
					const matchesText = question.label.toLowerCase().includes(text.toLowerCase());
					const notAlreadyTriggered = !allTriggeredQuestions.includes(question.ids.id);
					
					if (matchesText) {
						console.log(`Question "${question.label}" (${question.ids.id}): matchesText=true, alreadyTriggered=${allTriggeredQuestions.includes(question.ids.id)}, willShow=${notAlreadyTriggered}`);
					}
					
					return matchesText && notAlreadyTriggered;
				});
				
				console.log('=== FINAL RESULTS ===');
				console.log('Total filtered questions:', filteredQuestions.length);
				console.log('Questions to show:', filteredQuestions.map(q => q.label));
				
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
			
			console.log('=== SELECT_RELATIONSHIP_QUESTION ACTION TRIGGERED ===');
			console.log('Payload:', action.payload);
			console.log('Answer ID:', answerId);
			console.log('Question ID:', questionId);
			console.log('Question Label:', questionLabel);
			
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

			console.log('=== GUIDELINE_TYPEAHEAD_INPUT DEBUG ===');
			console.log('Search text:', text);
			console.log('Answer ID:', answerId);
			console.log('Text length:', text ? text.length : 'text is null/undefined');
			console.log('Full action payload:', action.payload);
			console.log('Action type:', action.type);

			updateState({
				relationshipTypeaheadText: text,
				selectedRelationshipQuestion: null // Clear any selected guideline
			});

			// Only search after 3 characters
			if (text && text.length >= 3) {
				console.log('=== TRIGGERING GUIDELINE SEARCH ===');
				console.log('Search text passed to SEARCH_GUIDELINES:', text);
				console.log('Answer ID passed to SEARCH_GUIDELINES:', answerId);

				dispatch('SEARCH_GUIDELINES', {
					searchText: text,
					answerId: answerId
				});
			} else {
				console.log('=== NOT SEARCHING ===');
				console.log('Reason: text length is', text ? text.length : 'text is null/undefined');
				updateState({
					relationshipTypeaheadResults: []
				});
			}
		},
		'SEARCH_GUIDELINES': (coeffects) => {
			const {action, dispatch, updateState} = coeffects;
			const {searchText, answerId} = action.payload;

			console.log('=== SEARCH_GUIDELINES DEBUG ===');
			console.log('Searching for:', searchText);
			console.log('Answer ID in SEARCH_GUIDELINES:', answerId);
			console.log('Action payload:', action.payload);

			const requestBody = JSON.stringify({
				searchText: searchText
			});

			console.log('=== REQUEST BODY BEING SENT ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));
			console.log('Request body keys:', Object.keys(JSON.parse(requestBody)));
			console.log('searchText value:', JSON.parse(requestBody).searchText);
			console.log('searchText type:', typeof JSON.parse(requestBody).searchText);
			console.log('searchText length:', JSON.parse(requestBody).searchText ? JSON.parse(requestBody).searchText.length : 'undefined');

			updateState({
				relationshipTypeaheadLoading: true,
				currentGuidelineSearchAnswerId: answerId // Store answerId in state
			});

			console.log('=== DISPATCHING HTTP REQUEST ===');
			console.log('About to dispatch MAKE_GUIDELINE_SEARCH_REQUEST');
			console.log('Meta object:', {
				searchText: searchText,
				answerId: answerId
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

			console.log('=== FETCH_PROBLEM_DETAILS ACTION TRIGGERED ===');
			console.log('Fetching details for problem:', problemId);

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

			console.log('=== FETCH PROBLEM DETAILS REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

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

			console.log('=== GET_PROBLEM_DETAILS_SUCCESS ===');
			console.log('API Response:', action.payload);

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
						tooltip: action.payload.tooltip || ''
					}
				});
			} else {
				// Fallback to cached data if API didn't return proper details
				console.warn('API returned incomplete problem details, using fallback data');
				updateState({
					editingProblemData: state.problemDetailsFallback || {
						label: '',
						alternative_wording: '',
						tooltip: ''
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
				modalSystemMessages: state.relationshipModalOpen ? [
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

			console.log('=== DELETE_PROBLEM_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Deleting problem:', problemName, 'ID:', problemId, 'from answer:', answerId);

			// AUTO-DELETE: Immediately call API
			const requestBody = JSON.stringify({
				problemId: problemId
			});

			console.log('=== DELETE PROBLEM REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

			dispatch('MAKE_DELETE_PROBLEM_RELATIONSHIP_REQUEST', {
				requestBody: requestBody,
				meta: {
					problemId: problemId,
					problemName: problemName,
					answerId: answerId
				}
			});

			// Show system message about deletion
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Deleting problem relationship from backend...',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'DELETE_PROBLEM_RELATIONSHIP_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== DELETE_PROBLEM_RELATIONSHIP_SUCCESS ===');
			console.log('API Response:', action.payload);
			console.log('Response type:', typeof action.payload);

			const meta = action.meta || {};
			const {problemName, answerId} = meta;

			// Handle 204 No Content response (null/empty payload is expected and indicates success)
			if (action.payload === null || action.payload === undefined) {
				console.log('API returned 204 No Content - this is expected for successful DELETE operations');
			}

			const successMessage = {
				type: 'success',
				message: `Problem relationship deleted successfully! Refreshing data...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), successMessage],
				modalSystemMessages: state.relationshipModalOpen ? [
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
			const {problemName} = meta;

			const errorMessage = {
				type: 'error',
				message: `Failed to delete problem "${problemName}": ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), errorMessage],
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'LOAD_PROBLEM_GOALS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {problemId, guidelineTemplateId} = action.payload;

			console.log('=== LOAD_PROBLEM_GOALS ACTION TRIGGERED ===');
			console.log('Loading goals for problem:', problemId);
			console.log('Guideline Template ID:', guidelineTemplateId);

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

			console.log('=== LOAD PROBLEM GOALS REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

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

			console.log('=== LOAD_PROBLEM_GOALS_SUCCESS ===');
			console.log('API Response:', action.payload);

			// Use stored problemId from state instead of meta (meta not working reliably)
			const problemId = state.currentGoalsLoadingProblemId;
			console.log('Using stored problemId from state:', problemId);

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

			console.log(`Loaded ${goalsData.length} goals for problem:`, problemId);
		},

		'SAVE_GOAL_TO_PROBLEM': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {problemId, goalText, selectedGoal, answerId} = action.payload;

			console.log('=== SAVE_GOAL_TO_PROBLEM ===');
			console.log('Problem ID:', problemId);
			console.log('Goal text:', goalText);
			console.log('Selected goal:', selectedGoal);
			console.log('Answer ID:', answerId);

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
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					savingMessage
				] : state.modalSystemMessages
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
			console.log('=== PRE-SAVE EXACT MATCH CHECK ===');
			console.log('Searching for exact match of:', goalText);

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

			console.log('=== SAVE_GOAL_TO_PROBLEM_AFTER_CHECK ===');
			console.log('Final save with goal:', selectedGoal);

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
				meta: {problemId: problemId}
			});
		},

		'ADD_GOAL_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== ADD_GOAL_SUCCESS ===');
			console.log('Response:', action.payload);

			// Get original data from response payload
			const originalRequest = action.payload?.originalRequest || {};
			const {answerId, goalText} = originalRequest;

			console.log('Goal processing for answer:', answerId, 'goal:', goalText);

			// Show success or backend message
			let systemMessage = `Goal "${goalText}" processed! Refreshing data...`;
			let messageType = 'success';

			// Surface any backend detail messages to user (like duplicate warnings)
			if (action.payload && action.payload.detail) {
				systemMessage = action.payload.detail;
				// Classify message type based on content
				if (systemMessage.toLowerCase().includes('duplicate') ||
					systemMessage.toLowerCase().includes('already')) {
					messageType = 'warning'; // Informational, not error
				}
			}

			const newMessage = {
				type: messageType,
				message: systemMessage,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					newMessage
				],
				// Also add to modal messages if modal is open
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					newMessage
				] : state.modalSystemMessages
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipModalOpen && state.relationshipModalAnswerId === answerId) {
				console.log('Refreshing relationships for modal:', answerId);
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});

				// Also refresh goals for any expanded problems to show the new goal
				const expandedProblems = Object.keys(state.expandedProblems || {});
				expandedProblems.forEach(problemId => {
					if (state.expandedProblems[problemId] === true) {
						console.log('Refreshing goals for expanded problem:', problemId);
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

			updateState({
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

			console.log('=== SAVE_INTERVENTION_TO_GOAL ===');
			console.log('Goal ID:', goalId);
			console.log('Intervention text:', interventionText);
			console.log('Category:', category);
			console.log('Selected intervention:', selectedIntervention);
			console.log('Answer ID:', answerId);

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
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					savingMessage
				] : state.modalSystemMessages
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
				console.log('Intervention already selected from dropdown - proceeding directly');
				dispatch('SAVE_INTERVENTION_TO_GOAL_AFTER_CHECK', {
					goalId: goalId,
					interventionText: interventionText,
					category: category,
					selectedIntervention: selectedIntervention,
					answerId: answerId
				});
				return;
			}

			console.log('=== PRE-SAVE EXACT MATCH CHECK ===');
			console.log('Searching for exact match of:', interventionText);

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

			console.log('=== SAVE_INTERVENTION_TO_GOAL_AFTER_CHECK ===');
			console.log('Final save with intervention:', selectedIntervention);

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

		'MAKE_ADD_INTERVENTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-intervention', {
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

			console.log('=== ADD_INTERVENTION_SUCCESS ===');
			console.log('Response:', action.payload);

			// Get original data from meta
			const meta = action.meta || {};
			const {answerId, interventionText, goalId} = meta;

			console.log('Intervention processing for answer:', answerId, 'intervention:', interventionText, 'goalId:', goalId);
			console.log('Meta information:', meta);

			// Show success or backend message
			let systemMessage = `Intervention "${interventionText}" processed! Refreshing data...`;
			let messageType = 'success';

			// Surface any backend detail messages to user (like duplicate warnings)
			if (action.payload && action.payload.detail) {
				systemMessage = action.payload.detail;
				// Classify message type based on content
				if (systemMessage.toLowerCase().includes('duplicate') ||
					systemMessage.toLowerCase().includes('already')) {
					messageType = 'warning'; // Informational, not error
				}
			}

			const newMessage = {
				type: messageType,
				message: systemMessage,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					newMessage
				],
				// Also add to modal messages if modal is open
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					newMessage
				] : state.modalSystemMessages
			});

			// If we're in a modal context, refresh the relationships for immediate feedback
			if (answerId && state.relationshipModalOpen && state.relationshipModalAnswerId === answerId) {
				console.log('Refreshing relationships for modal:', answerId);
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});

				// CRITICAL: Refresh interventions for the SPECIFIC goal that was just updated
				// This follows the same pattern as goal editing success
				if (goalId && state.currentAssessmentId) {
					console.log('Refreshing interventions for specific goal:', goalId);
					dispatch('LOAD_GOAL_INTERVENTIONS', {
						goalId: goalId,
						guidelineTemplateId: state.currentAssessmentId
					});
				}
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

			updateState({
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

			console.log('=== DELETE_GOAL ACTION TRIGGERED ===');
			console.log('Deleting goal:', goalName, 'ID:', goalId, 'from problem:', problemId);

			// AUTO-DELETE: Immediately call API
			const requestBody = JSON.stringify({
				goalId: goalId
			});

			console.log('=== DELETE GOAL REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

			dispatch('MAKE_DELETE_GOAL_REQUEST', {
				requestBody: requestBody,
				meta: {
					goalId: goalId,
					goalName: goalName,
					answerId: answerId,
					problemId: problemId
				}
			});

			// Show system message about deletion
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: `Deleting goal "${goalName}"...`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'DELETE_GOAL_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== DELETE_GOAL_SUCCESS ===');
			console.log('API Response:', action.payload);
			console.log('Response type:', typeof action.payload);

			const meta = action.meta || {};
			const {goalName, answerId, problemId} = meta;

			// Handle 204 No Content response (null/empty payload is expected and indicates success)
			if (action.payload === null || action.payload === undefined) {
				console.log('API returned 204 No Content - this is expected for successful DELETE operations');
			}

			// Debug modal state
			console.log('Modal state check:');
			console.log('- answerId from meta:', answerId);
			console.log('- state.relationshipModalOpen:', state.relationshipModalOpen);
			console.log('- state.relationshipModalAnswerId:', state.relationshipModalAnswerId);
			console.log('- Match check:', answerId === state.relationshipModalAnswerId);

			updateState({
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
			if (state.relationshipModalOpen && state.relationshipModalAnswerId) {
				console.log('Refreshing relationships for modal:', state.relationshipModalAnswerId);
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: state.relationshipModalAnswerId
				});

				// Also refresh goals for any expanded problems to show the deletion
				const expandedProblems = Object.keys(state.expandedProblems || {});
				expandedProblems.forEach(problemId => {
					if (state.expandedProblems[problemId] === true) {
						console.log('Refreshing goals for expanded problem after deletion:', problemId);
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
			const {goalName} = meta;

			updateState({
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

			console.log('=== DELETE_INTERVENTION ACTION TRIGGERED ===');
			console.log('Deleting intervention:', interventionName, 'ID:', interventionId, 'from goal:', goalId);

			// Store goalId for success handler refresh (using working state-based pattern)
			updateState({
				lastDeletedInterventionGoalId: goalId
			});

			// AUTO-DELETE: Immediately call API
			const requestBody = JSON.stringify({
				interventionId: interventionId,
				goalId: goalId
			});

			console.log('=== DELETE INTERVENTION REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

			dispatch('MAKE_DELETE_INTERVENTION_REQUEST', {
				requestBody: requestBody,
				meta: {
					interventionId: interventionId,
					interventionName: interventionName,
					answerId: answerId,
					goalId: goalId
				}
			});

			// Show deleting message (both windows)
			const deletingMessage = {
				type: 'info',
				message: `Deleting intervention "${interventionName}"...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					deletingMessage
				],
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					deletingMessage
				] : state.modalSystemMessages
			});
		},

		'DELETE_INTERVENTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== DELETE_INTERVENTION_SUCCESS ===');
			console.log('API Response:', action.payload);

			const meta = action.meta || {};
			const {interventionName, answerId} = meta;

			// Show success message (both windows)
			const successMessage = {
				type: 'success',
				message: `Intervention "${interventionName}" deleted successfully! Refreshing data...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					successMessage
				],
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					successMessage
				] : state.modalSystemMessages
			});

			// CRITICAL: Refresh intervention data using stored goalId (same pattern as add)
			const goalId = state.lastDeletedInterventionGoalId;
			console.log('DELETE_INTERVENTION_SUCCESS - Goal ID from stored state:', goalId);
			console.log('DELETE_INTERVENTION_SUCCESS - Assessment ID:', state.currentAssessmentId);
			if (goalId && state.currentAssessmentId) {
				console.log('Auto-refreshing interventions for goal after delete:', goalId);
				// Clear the stored ID after use
				updateState({
					lastDeletedInterventionGoalId: null
				});
				dispatch('LOAD_GOAL_INTERVENTIONS', {
					goalId: goalId,
					guidelineTemplateId: state.currentAssessmentId
				});
			} else {
				console.log('PROBLEM: Cannot auto-refresh after delete - missing stored goalId or assessmentId');
			}

			// If modal is open, refresh the relationship data
			if (answerId && state.relationshipModalOpen && state.relationshipModalAnswerId === answerId) {
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
			const {interventionName} = meta;

			// Show error message (both windows)
			const errorMessage = {
				type: 'error',
				message: `Failed to delete intervention "${interventionName}": ${action.payload?.error || 'Unknown error'}`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					errorMessage
				],
				modalSystemMessages: state.relationshipModalOpen ? [
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

			console.log('=== GENERIC_TYPEAHEAD_SEARCH ===');
			console.log('Search text:', searchText);
			console.log('Content type:', type);
			console.log('Problem ID:', problemId);
			console.log('Goal ID:', goalId);
			console.log('Is pre-save check:', isPreSaveCheck);

			if (!searchText || (searchText.length < 3 && !isPreSaveCheck)) {
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

		'MAKE_GENERIC_TYPEAHEAD_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/generic-typeahead', {
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

			console.log('=== GENERIC_TYPEAHEAD_SUCCESS ===');
			console.log('Response payload:', action.payload);
			console.log('Meta information:', action.meta);

			const results = action.payload?.results || [];

			// Use stored context from state instead of meta
			const goalSearchContext = state.currentGoalSearchContext;
			const interventionSearchContext = state.currentInterventionSearchContext;
			const preSaveGoalContext = state.preSaveGoalContext;
			const preSaveProblemContext = state.preSaveProblemContext;
			console.log('Stored goal search context:', goalSearchContext);
			console.log('Stored intervention search context:', interventionSearchContext);
			console.log('Stored pre-save goal context:', preSaveGoalContext);
			console.log('Stored pre-save problem context:', preSaveProblemContext);

			console.log('Found results:', results.length);

			// Check if this is a pre-save exact match check for goals
			if (preSaveGoalContext && preSaveGoalContext.isPreSaveCheck) {
				console.log('=== PRE-SAVE EXACT MATCH CHECK RESULTS (GOALS) ===');
				console.log('Checking for exact matches in results...');

				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					console.log('EXACT MATCH FOUND:', exactMatch);
					console.log('Using library goal with master_id:', exactMatch.master_id);

					// Use the exact match as selectedGoal with library data
					const selectedGoal = {
						id: exactMatch.id,
						name: exactMatch.name,
						master_id: exactMatch.master_id
					};

					// Get pending save data and proceed with library goal
					const pendingGoalSave = state.pendingGoalSave;
					if (pendingGoalSave) {
						console.log('Proceeding with library goal save...');
						dispatch('SAVE_GOAL_TO_PROBLEM_AFTER_CHECK', {
							problemId: pendingGoalSave.problemId,
							goalText: pendingGoalSave.goalText,
							selectedGoal: selectedGoal,  // Use exact match
							answerId: pendingGoalSave.answerId
						});
					}
				} else {
					console.log('NO EXACT MATCH FOUND - proceeding as new goal');

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
				console.log('=== PRE-SAVE EXACT MATCH CHECK RESULTS (PROBLEMS) ===');
				console.log('Checking for exact matches in results...');

				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					console.log('EXACT MATCH FOUND:', exactMatch);
					console.log('Using library problem with master_id:', exactMatch.master_id);

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
						console.log('Proceeding with library problem save...');
						dispatch('ADD_PROBLEM_RELATIONSHIP', {
							answerId: pendingProblemSave.answerId,
							problemId: selectedProblem.id,
							problemName: selectedProblem.name || selectedProblem.label,
							problemMasterId: selectedProblem.master_id
						});
					}
				} else {
					console.log('NO EXACT MATCH FOUND - proceeding as new problem creation');

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
				console.log('=== PRE-SAVE EXACT MATCH CHECK RESULTS (INTERVENTIONS) ===');
				console.log('Checking for exact matches in results...');

				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					console.log('EXACT MATCH FOUND:', exactMatch);
					console.log('Using library intervention with master_id:', exactMatch.master_id);

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
						console.log('Proceeding with library intervention save...');
						dispatch('SAVE_INTERVENTION_TO_GOAL_AFTER_CHECK', {
							goalId: pendingInterventionSave.goalId,
							interventionText: pendingInterventionSave.interventionText,
							category: pendingInterventionSave.category,
							selectedIntervention: selectedIntervention,  // Use exact match
							answerId: pendingInterventionSave.answerId
						});
					}
				} else {
					console.log('NO EXACT MATCH FOUND - proceeding as new intervention');

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

			// Check if this is a pre-save exact match check for sections
			const preSaveSectionContext = state.preSaveSectionContext;
			if (preSaveSectionContext && preSaveSectionContext.isPreSaveCheck) {
				console.log('=== PRE-SAVE EXACT MATCH CHECK RESULTS (SECTIONS) ===');
				console.log('Checking for exact matches in results...');

				// Look for exact match
				const exactMatch = results.find(result => result.exact_match === true);

				if (exactMatch) {
					console.log('EXACT MATCH FOUND:', exactMatch);
					console.log('Using library section with master_id:', exactMatch.master_id);

					// Get pending save data and proceed with library section
					const pendingSectionSave = state.pendingSectionSave;
					if (pendingSectionSave) {
						console.log('Proceeding with library section save...');

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
					console.log('NO EXACT MATCH FOUND - proceeding as new section');

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

			// Normal typeahead UI flow (not pre-save check)
			if (goalSearchContext && goalSearchContext.contentType === 'goal' && goalSearchContext.problemId) {
				const problemId = goalSearchContext.problemId;
				console.log('Routing to goal typeahead for problem:', problemId);

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
				console.log('Routing to intervention typeahead for goal:', goalId);

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
			} else {
				console.log('Routing to relationship typeahead');
				// Default to relationship typeahead
				updateState({
					relationshipTypeaheadResults: results,
					relationshipTypeaheadLoading: false
				});
			}
		},

		'GENERIC_TYPEAHEAD_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.log('=== GENERIC_TYPEAHEAD_ERROR ===');
			console.error('Error payload:', action.payload);

			// Use stored context from state instead of meta
			const goalSearchContext = state.currentGoalSearchContext;
			const interventionSearchContext = state.currentInterventionSearchContext;

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
			} else {
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

'MAKE_GUIDELINE_SEARCH_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/guideline-typeahead', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'GUIDELINE_SEARCH_SUCCESS',
			errorActionType: 'GUIDELINE_SEARCH_ERROR',
			metaParam: 'meta'
		}),

'MAKE_QUESTION_SEARCH_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/question-typeahead', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'QUESTION_SEARCH_SUCCESS',
			errorActionType: 'QUESTION_SEARCH_ERROR'
		}),

		'MAKE_LIBRARY_QUESTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/get-library-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'LIBRARY_QUESTION_SUCCESS',
			errorActionType: 'LIBRARY_QUESTION_ERROR',
			metaParam: 'meta'
		}),

		'MAKE_ANSWER_SEARCH_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/answer-typeahead', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ANSWER_SEARCH_SUCCESS',
			errorActionType: 'ANSWER_SEARCH_ERROR'
		}),

		'MAKE_LIBRARY_ANSWER_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/library-answer-details', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'LIBRARY_ANSWER_SUCCESS',
			errorActionType: 'LIBRARY_ANSWER_ERROR',
			metaParam: 'meta'
		}),

		'QUESTION_SEARCH_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.log('=== QUESTION_SEARCH_SUCCESS ===');
			console.log('Response:', action.payload);
			console.log('Response type:', typeof action.payload);
			console.log('Response keys:', Object.keys(action.payload || {}));
			console.log('action.payload.results:', action.payload.results);

			const results = action.payload.results || [];
			console.log('Found questions:', results.length);

			// Check if this is for relationship modal or inline editing
			if (state.relationshipModalOpen && state.relationshipTypeaheadLoading) {
				console.log('=== FILTERING RESULTS FOR RELATIONSHIP MODAL ===');

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
						console.log('Filtering out current question:', question.label);
						return false;
					}
					// Don't show already related questions
					if (existingQuestionIds.includes(question.id)) {
						console.log('Filtering out existing relationship:', question.label);
						return false;
					}
					return true;
				});

				console.log(`Filtered questions: ${filteredResults.length} out of ${results.length}`);

				updateState({
					relationshipTypeaheadResults: filteredResults,
					relationshipTypeaheadLoading: false
				});
			} else {
				// Inline editing context - use existing logic
				updateState({
					questionTypeaheadResults: results,
					questionTypeaheadLoading: false
				});

				console.log('After QUESTION_SEARCH_SUCCESS - State check:');
				console.log('questionTypeaheadVisible:', state.questionTypeaheadVisible);
				console.log('editingQuestionId:', state.editingQuestionId);
				console.log('Results length:', results.length);
			}
		},

		'QUESTION_SEARCH_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('QUESTION_SEARCH_ERROR:', action.payload);

			updateState({
				questionTypeaheadResults: [],
				questionTypeaheadLoading: false,
				currentQuestionSearchSectionId: null,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Error searching questions: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'LIBRARY_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== LIBRARY_QUESTION_SUCCESS ===');
			console.log('Response:', action.payload);

			// Debug library question structure
			if (action.payload.answers) {
				console.log('=== LIBRARY QUESTION ANSWERS DEBUG ===');
				action.payload.answers.forEach((answer, index) => {
					console.log(`Answer ${index + 1}:`, answer);
					console.log(`  - id: ${answer.id}`);
					console.log(`  - master_id: ${answer.master_id}`);
					console.log(`  - label: ${answer.label || answer.text}`);
				});
			}

			console.log('Meta:', action.meta);
			console.log('Meta keys:', Object.keys(action.meta || {}));
			console.log('Meta values:', action.meta);
			console.log('targetQuestionId from meta:', action.meta?.targetQuestionId);

			const libraryQuestion = action.payload;
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
			console.log('Replacing question ID:', targetQuestionId, 'with library question (from state)');
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

		'ANSWER_SEARCH_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.log('=== ANSWER_SEARCH_SUCCESS ===');
			console.log('Response:', action.payload);
			console.log('Response type:', typeof action.payload);
			console.log('Response keys:', Object.keys(action.payload));
			console.log('action.payload.results:', action.payload.results);

			const results = action.payload.results || [];
			console.log('Found answers:', results.length);

			updateState({
				answerTypeaheadResults: results,
				answerTypeaheadLoading: false,
				answerTypeaheadVisible: true
			});

			console.log('After ANSWER_SEARCH_SUCCESS - State check:');
			console.log('answerTypeaheadVisible:', true);
			console.log('editingAnswerId:', state.editingAnswerId);
			console.log('Results length:', results.length);
		},

		'ANSWER_SEARCH_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('ANSWER_SEARCH_ERROR:', action.payload);

			updateState({
				answerTypeaheadResults: [],
				answerTypeaheadLoading: false,
				answerTypeaheadVisible: false,
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Error searching answers: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'LIBRARY_ANSWER_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== LIBRARY_ANSWER_SUCCESS ===');
			console.log('Response:', action.payload);

			// Debug library answer structure
			console.log('=== LIBRARY ANSWER DEBUG ===');
			console.log('Library Answer ID:', action.payload.id);
			console.log('Library Answer Label:', action.payload.label);
			console.log('Library Answer Tooltip:', action.payload.tooltip);
			console.log('Library Answer Secondary Input:', action.payload.secondary_input_type);

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
			console.log('Replacing answer ID:', targetAnswerId, 'with library answer (from state)');
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

			console.log('=== ADD_LIBRARY_QUESTION_TO_SECTION ===');
			console.log('Section ID:', sectionId);
			console.log('Library Question:', libraryQuestion);

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
						libraryAnswerId: libraryAnswer.master_id || libraryAnswer.id
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
					libraryAnswerId: answer.libraryAnswerId,
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

			console.log('=== LIBRARY QUESTION ADDED SUCCESSFULLY ===');
			console.log('Question ID:', newQuestionId);
			console.log('Library Question ID:', newQuestion.libraryQuestionId);
			console.log('Number of library answers:', newQuestion.answers.length);
		},

		'REPLACE_QUESTION_WITH_LIBRARY': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {targetQuestionId, libraryQuestion} = action.payload;

			console.log('=== REPLACE_QUESTION_WITH_LIBRARY ===');
			console.log('Target Question ID:', targetQuestionId);
			console.log('Library Question:', libraryQuestion);

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
			console.log('Found target question:', currentQuestion.label);

			// Create replacement question with library data
			const replacementQuestion = {
				ids: { id: targetQuestionId }, // Keep the same ID
				label: libraryQuestion.label || libraryQuestion.name,
				required: libraryQuestion.required || false,
				type: libraryQuestion.type || 'Single Select',
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
						libraryAnswerId: libraryAnswer.master_id || libraryAnswer.id
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
					libraryAnswerId: answer.libraryAnswerId,
					libraryStatus: 'unmodified',  // Track modification status
					originalLibraryData: {  // Store original library answer data
						label: originalLibraryAnswer.text || originalLibraryAnswer.label,
						tooltip: originalLibraryAnswer.tooltip || '',
						alternative_wording: originalLibraryAnswer.alternative_wording || '',
						secondary_input_type: originalLibraryAnswer.secondary_input_type || null,
						mutually_exclusive: originalLibraryAnswer.mutually_exclusive || false,
						sort_order: originalLibraryAnswer.sort_order || (index + 1)
					},
					libraryAnswerId: answer.libraryAnswerId,
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

			console.log('=== QUESTION REPLACED SUCCESSFULLY ===');
			console.log('Replaced Question ID:', targetQuestionId);
			console.log('Library Question ID:', replacementQuestion.libraryQuestionId);
			console.log('Number of library answers:', replacementQuestion.answers.length);
		},

		'GUIDELINE_SEARCH_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.log('=== GUIDELINE_SEARCH_SUCCESS DEBUG ===');
			console.log('SUCCESS HANDLER CALLED!');
			console.log('Response payload:', action.payload);
			console.log('Response payload type:', typeof action.payload);
			console.log('Response payload keys:', action.payload ? Object.keys(action.payload) : 'payload is null');
			console.log('Full action object:', action);
			console.log('Action meta:', action.meta);
			console.log('Action payload meta:', action.payload ? action.payload.meta : 'no payload meta');
			
			const results = action.payload.results || [];
			// Try different ways to access the answerId, including from state
			const answerId = action.meta?.answerId || action.payload.meta?.answerId || action.answerId || state.currentGuidelineSearchAnswerId;
			
			console.log('Found guidelines:', results.length);
			console.log('Filtering for answer ID:', answerId);
			
			// Filter out guidelines that are already added to this answer
			let filteredResults = results;
			
			console.log('=== DEBUGGING GUIDELINE FILTERING ===');
			console.log('Answer ID for filtering:', answerId);
			console.log('Available answerRelationships keys:', Object.keys(state.answerRelationships || {}));
			console.log('Full answerRelationships structure for this answer:', state.answerRelationships[answerId]);
			console.log('Guidelines section:', state.answerRelationships[answerId]?.guidelines);
			console.log('Raw search results before filtering:', results.map(g => ({id: g.id, name: g.name})));
			
			if (answerId && state.answerRelationships[answerId]) {
				// Check if guidelines exist in the relationship data
				const relationshipData = state.answerRelationships[answerId];
				console.log('Relationship data keys:', Object.keys(relationshipData));
				
				// Look for guidelines in different possible locations
				let existingGuidelineIds = [];
				
				if (relationshipData.guidelines?.guidelines) {
					existingGuidelineIds = relationshipData.guidelines.guidelines.map(g => g.id);
					console.log('Found existing guideline IDs for filtering:', existingGuidelineIds);
					console.log('Existing guideline details:', relationshipData.guidelines.guidelines.map(g => ({id: g.id, label: g.label})));
				} else {
					console.log('No existing guidelines found - no filtering will occur');
				}
				
				if (existingGuidelineIds.length > 0) {
					console.log('Existing guideline IDs:', existingGuidelineIds);
					
					filteredResults = results.filter(guideline => {
						const notAlreadyAdded = !existingGuidelineIds.includes(guideline.id);
						if (!notAlreadyAdded) {
							console.log(`✅ FILTERING OUT: "${guideline.name}" (${guideline.use_case_category?.name}) - ID: ${guideline.id} already exists`);
						} else {
							console.log(`✅ KEEPING: "${guideline.name}" (${guideline.use_case_category?.name}) - ID: ${guideline.id} not found in existing`);
						}
						return notAlreadyAdded;
					});

					console.log('Filtered results count:', filteredResults.length, 'out of', results.length, 'total');
				}
			}

			// Also filter out the current assessment itself
			const currentAssessmentId = state.currentAssessmentId;
			if (currentAssessmentId) {
				const beforeCurrentFilter = filteredResults.length;
				filteredResults = filteredResults.filter(guideline => {
					const isCurrentAssessment = guideline.id === currentAssessmentId;
					if (isCurrentAssessment) {
						console.log(`Filtering out current assessment "${guideline.name}" - can't trigger itself`);
					}
					return !isCurrentAssessment;
				});
				console.log(`Filtered out current assessment: ${beforeCurrentFilter} -> ${filteredResults.length} guidelines`);
			}

			console.log('Filtered guidelines:', filteredResults.length);
			console.log('=== FINAL FILTERED RESULTS FOR UI ===');
			filteredResults.forEach((guideline, index) => {
				console.log(`Guideline ${index + 1}:`, {
					id: guideline.id,
					name: guideline.name,
					label: guideline.label,
					title: guideline.title,
					allKeys: Object.keys(guideline),
					fullObject: guideline
				});
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

			console.log('=== GUIDELINE_SEARCH_ERROR DEBUG ===');
			console.log('ERROR HANDLER CALLED!');
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

			console.log('=== QUESTION_TYPEAHEAD_INPUT DEBUG ===');
			console.log('Search text:', text);
			console.log('Section ID:', sectionId);
			console.log('Answer ID:', answerId);
			console.log('Text length:', text ? text.length : 'text is null/undefined');
			console.log('Context: ', answerId ? 'Relationship Modal' : 'Inline Editing');

			if (answerId) {
				// Relationship modal context
				updateState({
					relationshipTypeaheadText: text,
					selectedQuestion: null // Clear any selected question
				});

				// Only search after 3 characters
				if (text && text.length >= 3) {
					console.log('=== FILTERING LOCAL QUESTIONS FOR RELATIONSHIP MODAL ===');
					console.log('Search text:', text);
					console.log('Answer ID:', answerId);

					// Get current section questions
					const allQuestions = state.currentQuestions?.questions || [];
					console.log('All questions in current section:', allQuestions.length);

					// Find the current question (the one this answer belongs to)
					const currentQuestion = allQuestions.find(q =>
						q.answers?.some(a => a.ids.id === answerId)
					);
					const currentQuestionId = currentQuestion?.ids?.id;
					console.log('Current question ID to exclude:', currentQuestionId);

					// Get existing triggered questions for this answer
					const existingQuestionIds = state.answerRelationships[answerId]?.questions?.questions?.map(q => q.id) || [];
					console.log('Existing triggered question IDs to exclude:', existingQuestionIds);

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

						console.log(`Question "${question.label}": matches="${matchesSearch}", current="${isCurrentQuestion}", existing="${isExistingTriggered}", sortOrder="${question.sort_order}", currentSortOrder="${currentQuestion?.sort_order}", higherSort="${hasHigherSortOrder}"`);

						return matchesSearch && !isCurrentQuestion && !isExistingTriggered && hasHigherSortOrder;
					});

					console.log(`Filtered questions: ${filteredQuestions.length} out of ${allQuestions.length}`);

					updateState({
						relationshipTypeaheadResults: filteredQuestions,
						relationshipTypeaheadLoading: false
					});
				} else {
					console.log('=== NOT SEARCHING ===');
					console.log('Reason: text length is', text ? text.length : 'text is null/undefined');
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
				if (text && text.length >= 3) {
					console.log('Triggering question search for inline editing:', text);
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

			console.log('=== SEARCH_QUESTIONS ===');
			console.log('Searching for:', searchText);
			console.log('Section ID in SEARCH_QUESTIONS:', sectionId);

			const requestBody = JSON.stringify({
				searchText: searchText
			});

			updateState({
				questionTypeaheadLoading: true,
				currentQuestionSearchSectionId: sectionId
			});

			console.log('Question search request body:', requestBody);
			dispatch('MAKE_QUESTION_SEARCH_REQUEST', {requestBody: requestBody});
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
				console.log('=== RELATIONSHIP MODAL QUESTION SEARCH ===');
				console.log('Searching for questions to add to relationship:', searchText);

				dispatch('RELATIONSHIP_QUESTION_SEARCH', {
					searchText: searchText,
					answerId: state.relationshipModalAnswerId
				});
			}
		},

		'RELATIONSHIP_QUESTION_SEARCH': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {searchText, answerId} = action.payload;

			console.log('=== RELATIONSHIP_QUESTION_SEARCH ===');
			console.log('Searching for questions to add as relationship:', searchText);
			console.log('Answer ID:', answerId);

			if (searchText.length >= 3) {
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
				editingQuestionId: null
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

			console.log('=== SELECT_LIBRARY_QUESTION ===');
			console.log('Replacing question ID:', questionId);
			console.log('With library question:', libraryQuestion);

			// Hide typeahead dropdown but keep question visible during fetch
			updateState({
				questionTypeaheadVisible: false,
				questionTypeaheadResults: [],
				questionTypeaheadSelectedIndex: -1,
				pendingLibraryQuestionReplacementId: questionId,  // Store for later use
				libraryQuestionLoading: questionId  // Show loading state on specific question
			});

			// Fetch the full library question details including answers
			console.log('Fetching library question details for:', libraryQuestion.id);
			dispatch('FETCH_LIBRARY_QUESTION', {
				libraryQuestionId: libraryQuestion.id,
				targetQuestionId: questionId
			});
		},

		'FETCH_LIBRARY_QUESTION': (coeffects) => {
			const {action, updateState, dispatch} = coeffects;
			const {libraryQuestionId, targetQuestionId} = action.payload;

			console.log('=== FETCH_LIBRARY_QUESTION ===');
			console.log('Fetching library question ID:', libraryQuestionId);
			console.log('To replace target question ID:', targetQuestionId);

			const requestBody = JSON.stringify({
				questionId: libraryQuestionId
			});

			updateState({
				questionTypeaheadLoading: true
			});

			console.log('Library question request body:', requestBody);
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

			console.log('=== SELECT_RELATIONSHIP_GUIDELINE ===');
			console.log('Selected guideline ID:', guidelineId);
			console.log('Selected guideline master_id:', guidelineMasterId);
			console.log('Selected guideline name:', guidelineName);
			console.log('Answer ID:', answerId);

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

			console.log('=== CONFIRM_ADD_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Action payload:', action.payload);
			console.log('Answer ID:', answerId);
			console.log('Current state.selectedRelationshipQuestion:', state.selectedRelationshipQuestion);

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

			console.log('Selected item details:', selectedItem);
			console.log('Relationship type:', relationshipType);
			console.log('=== DEBUGGING SELECTED ITEM PROPERTIES ===');
			console.log('selectedItem keys:', Object.keys(selectedItem));
			console.log('selectedItem.id:', selectedItem.id);
			console.log('selectedItem.master_id:', selectedItem.master_id);
			console.log('selectedItem.uuid:', selectedItem.uuid);
			console.log('selectedItem.ids:', selectedItem.ids);

			// Use master_id for guidelines, id for questions
			const targetId = relationshipType === 'guideline' ? selectedItem.master_id : selectedItem.id;

			// Generate a unique key for this relationship change
			const relationshipKey = `${answerId}_${relationshipType}_${targetId}`;

			console.log('Generated relationship key:', relationshipKey);
			console.log('Using targetId:', targetId, 'for relationshipType:', relationshipType);

			// AUTO-SAVE: For guidelines, immediately dispatch the save action instead of queuing
			if (relationshipType === 'guideline') {
				console.log('Dispatching ADD_GUIDELINE_RELATIONSHIP for immediate save');
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
				console.log('Dispatching ADD_BRANCH_QUESTION for immediate save');
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
			console.log('Adding relationship change with data:', {
				action: 'add',
				answerId: answerId,
				relationshipType: relationshipType,
				targetId: targetId,
				targetLabel: selectedItem.category ? `${selectedItem.label} - ${selectedItem.category}` : selectedItem.label
			});
			
			// Immediately add relationship to local answer data for instant feedback
			console.log('=== UPDATING LOCAL RELATIONSHIPS ===');
			console.log('Adding', relationshipType + ':', targetId, 'to answer:', answerId);
			console.log('Selected item details:', selectedItem);
			
			let updatedQuestions = state.currentQuestions.questions;
			
			if (relationshipType === 'question') {
				// Handle triggered questions
				updatedQuestions = state.currentQuestions.questions.map(question => {
					return {
						...question,
						answers: question.answers.map(answer => {
							if (answer.ids.id === answerId) {
								const currentTriggered = answer.triggered_questions || [];
								console.log('Current triggered questions for answer:', currentTriggered);
								
								if (!currentTriggered.includes(targetId)) {
									const newTriggered = [...currentTriggered, targetId];
									console.log('Updated triggered questions:', newTriggered);
									return {
										...answer,
										triggered_questions: newTriggered
									};
								} else {
									console.log('Question already in triggered list, skipping');
								}
							}
							return answer;
						})
					};
				});
			}

			console.log('=== UPDATED QUESTIONS STRUCTURE ===');
			updatedQuestions.forEach((q, qIndex) => {
				q.answers?.forEach((a, aIndex) => {
					if (a.triggered_questions && a.triggered_questions.length > 0) {
						console.log(`Question ${qIndex + 1}, Answer ${aIndex + 1} (${a.label}): triggered_questions =`, a.triggered_questions);
					}
				});
			});
			
			// Clear the add relationship UI and show success message
			updateState({
				addingRelationship: null,
				selectedRelationshipType: null,
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				selectedRelationshipQuestion: null,
				// Update the local question data to show triggered question immediately
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				// Add to relationship changes tracking
				relationshipChanges: {
					...state.relationshipChanges,
					[relationshipKey]: {
						action: 'add',
						answerId: answerId,
						relationshipType: relationshipType,
						targetId: targetId,
						targetLabel: selectedItem.category ? `${selectedItem.label} - ${selectedItem.category}` : selectedItem.label,
						timestamp: new Date().toISOString()
					}
				},
				// Add to system messages to show it's been queued for save
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'success',
						message: `Triggered question "${selectedItem.label}" queued for save. Click "Save Changes" to apply.`,
						timestamp: new Date().toISOString()
					}
				]
			});
			
			console.log('=== CONFIRM_ADD_RELATIONSHIP - State updated successfully ===');
			console.log('Relationship should now be queued for save');
		},
		'REMOVE_TRIGGERED_QUESTION': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, questionId, questionLabel} = action.payload;
			
			console.log('=== REMOVE_TRIGGERED_QUESTION ACTION TRIGGERED ===');
			console.log('Removing question:', questionId, 'from answer:', answerId);
			console.log('Question label:', questionLabel);
			
			// Immediately remove triggered question from local answer data
			const updatedQuestions = state.currentQuestions.questions.map(question => {
				return {
					...question,
					answers: question.answers.map(answer => {
						if (answer.ids.id === answerId) {
							// Remove the triggered question from this answer's triggered_questions array
							const currentTriggered = answer.triggered_questions || [];
							const updatedTriggered = currentTriggered.filter(id => id !== questionId);
							console.log('Current triggered questions:', currentTriggered);
							console.log('Updated triggered questions:', updatedTriggered);
							
							return {
								...answer,
								triggered_questions: updatedTriggered
							};
						}
						return answer;
					})
				};
			});
			
			// Generate a unique key for this relationship change (same format as add)
			const relationshipKey = `${answerId}_question_${questionId}`;
			
			// Also remove from answerRelationships display data for immediate UI feedback
			const updatedAnswerRelationships = { ...state.answerRelationships };
			if (updatedAnswerRelationships[answerId]?.questions?.questions) {
				updatedAnswerRelationships[answerId] = {
					...updatedAnswerRelationships[answerId],
					questions: {
						...updatedAnswerRelationships[answerId].questions,
						questions: updatedAnswerRelationships[answerId].questions.questions.filter(q => q.id !== questionId),
						questions_quantity: updatedAnswerRelationships[answerId].questions.questions.filter(q => q.id !== questionId).length
					}
				};
			}
			
			// Track the deletion in relationshipChanges
			updateState({
				// Update local question data immediately
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				// Update relationship display data immediately
				answerRelationships: updatedAnswerRelationships,
				// Track the delete operation for save
				relationshipChanges: {
					...state.relationshipChanges,
					[relationshipKey]: {
						action: 'delete',
						answerId: answerId,
						relationshipType: 'question',
						targetId: questionId,
						targetLabel: questionLabel,
						timestamp: new Date().toISOString()
					}
				},
				// Show success message indicating it's queued for save
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'success',
						message: `Triggered question "${questionLabel}" queued for deletion. Click "Save Changes" to apply.`,
						timestamp: new Date().toISOString()
					}
				]
			});
			
			console.log('=== REMOVE_TRIGGERED_QUESTION - State updated successfully ===');
			console.log('Relationship deletion should now be queued for save');
		},

		'REMOVE_GUIDELINE_RELATIONSHIP': (coeffects) => {
			const {action, state, dispatch, updateState} = coeffects;
			const {answerId, guidelineId, guidelineName} = action.payload;

			console.log('=== REMOVE_GUIDELINE_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Removing guideline:', guidelineId, 'from answer:', answerId);
			console.log('Guideline name:', guidelineName);

			// Call backend API to delete guideline relationship immediately (like DELETE_BRANCH_QUESTION)
			const requestBody = JSON.stringify({
				answerId: answerId,
				guidelineId: guidelineId,
				guidelineName: guidelineName
			});

			console.log('About to dispatch with meta:', {
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
			
			console.log('=== ADD_BRANCH_QUESTION ACTION TRIGGERED ===');
			console.log('Adding branch question:', questionId, 'to answer:', answerId);
			
			const requestBody = JSON.stringify({
				answerId: answerId,
				questionId: questionId
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

			console.log('=== ADD_GUIDELINE_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Auto-saving guideline relationship immediately:', guidelineId, 'to answer:', answerId);
			console.log('Full payload:', action.payload);
			console.log('answerID type:', typeof answerId, 'value:', answerId);
			console.log('guidelineId type:', typeof guidelineId, 'value:', guidelineId);
			console.log('guidelineName type:', typeof guidelineName, 'value:', guidelineName);

			// AUTO-SAVE: Immediately call API like sections do
			const requestBody = JSON.stringify({
				answerId: answerId,
				guidelineId: guidelineId
			});

			console.log('=== REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));
			console.log('Request body keys:', Object.keys(JSON.parse(requestBody)));
			console.log('=== POSTMAN COMPARISON ===');
			console.log('Postman used answerId: a8d8c56f-c1b3-483f-b473-57cca992b652');
			console.log('Postman used guidelineId: d965087e-f596-492b-97c1-68eeb82970dc');
			console.log('Frontend sending answerId:', answerId);
			console.log('Frontend sending guidelineId:', guidelineId);
			console.log('IDs MATCH Postman?', answerId === 'a8d8c56f-c1b3-483f-b473-57cca992b652' && guidelineId === 'd965087e-f596-492b-97c1-68eeb82970dc');

			dispatch('MAKE_ADD_GUIDELINE_RELATIONSHIP_REQUEST', {
				requestBody: requestBody,
				meta: {
					answerId: answerId,
					guidelineId: guidelineId,
					guidelineName: guidelineName
				}
			});

			// Show system message about auto-save
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Saving guideline relationship to backend...',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'ADD_BARRIER_RELATIONSHIP': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, barrierId, barrierName, barrierMasterId} = action.payload;

			console.log('=== ADD_BARRIER_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Auto-saving barrier relationship immediately:', barrierName, 'to answer:', answerId);
			console.log('Full payload:', action.payload);
			console.log('Using library barrier with ID:', barrierId);

			// Calculate sort_order based on existing barriers
			const existingBarriers = state.answerRelationships?.[answerId]?.barriers?.barriers || [];
			const sortOrder = existingBarriers.length + 1;

			// AUTO-SAVE: Immediately call API
			const requestBody = JSON.stringify({
				answerId: answerId,
				barrierName: barrierName,
				barrierId: barrierId, // Will be used as library_id in backend if exists
				sortOrder: sortOrder,
				guidelineTemplateId: state.currentAssessmentId
			});

			console.log('=== BARRIER REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

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

			console.log('=== CREATE_NEW_BARRIER ACTION TRIGGERED ===');
			console.log('Creating new barrier:', barrierName, 'for answer:', answerId);
			console.log('Full payload:', action.payload);

			// Calculate sort_order based on existing barriers
			const existingBarriers = state.answerRelationships?.[answerId]?.barriers?.barriers || [];
			const sortOrder = existingBarriers.length + 1;

			// AUTO-SAVE: Immediately call API (no barrierId means new barrier)
			const requestBody = JSON.stringify({
				answerId: answerId,
				barrierName: barrierName,
				sortOrder: sortOrder,
				guidelineTemplateId: state.currentAssessmentId
				// No barrierId means create new barrier (no library_id in payload)
			});

			console.log('=== NEW BARRIER REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

			dispatch('MAKE_ADD_BARRIER_RELATIONSHIP_REQUEST', {
				requestBody: requestBody
			});

			// Show system message about auto-save
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'info',
						message: 'Creating new barrier and saving to backend...',
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'ADD_PROBLEM_RELATIONSHIP': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, problemId, problemName, problemMasterId} = action.payload;

			console.log('=== ADD_PROBLEM_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Auto-saving problem relationship immediately:', problemName, 'to answer:', answerId);
			console.log('Full payload:', action.payload);

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

			console.log('=== EXISTING PROBLEM REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

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

			console.log('=== CREATE_NEW_PROBLEM ACTION TRIGGERED ===');
			console.log('Creating new problem:', problemName, 'for answer:', answerId);
			console.log('Full payload:', action.payload);

			// Show saving message
			const savingMessage = {
				type: 'info',
				message: `Creating new problem "${problemName}"...`,
				timestamp: new Date().toISOString()
			};

			updateState({
				systemMessages: [...(state.systemMessages || []), savingMessage],
				modalSystemMessages: state.relationshipModalOpen ? [
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
			console.log('=== PRE-SAVE EXACT MATCH CHECK FOR PROBLEMS ===');
			console.log('Searching for exact match of:', problemName);

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

			console.log('=== CREATE_NEW_PROBLEM_AFTER_CHECK ===');
			console.log('Answer ID:', answerId);
			console.log('Problem name:', problemName);

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

			console.log('=== NEW PROBLEM REQUEST BODY DEBUG ===');
			console.log('Raw request body string:', requestBody);
			console.log('Parsed request body:', JSON.parse(requestBody));

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
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					creatingMessage
				] : state.modalSystemMessages
			});
		},

		'GET_GOAL_DETAILS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {goalId, problemId} = action.payload;

			console.log('=== GET_GOAL_DETAILS ACTION TRIGGERED ===');
			console.log('Fetching details for goal:', goalId);
			console.log('Problem ID:', problemId);

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

			console.log('=== GET_GOAL_DETAILS_SUCCESS ===');
			console.log('API Response:', action.payload);

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
						tooltip: action.payload.tooltip || ''
					}
				});
			} else {
				// Fallback to cached data if API didn't return proper details
				console.warn('API returned incomplete goal details, using fallback data');
				updateState({
					editingGoalData: state.goalDetailsFallback || {
						label: '',
						alternative_wording: '',
						tooltip: ''
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
				modalSystemMessages: state.relationshipModalOpen ? [
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

			console.log('=== SAVE_GOAL_EDITS ACTION TRIGGERED ===');
			console.log('Saving edits for goal:', goalId);
			console.log('Goal data:', goalData);

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
				modalSystemMessages: state.relationshipModalOpen ? [
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

			console.log('=== UPDATE_GOAL_SUCCESS ===');
			console.log('API Response:', action.payload);
			console.log('Response type:', typeof action.payload);
			console.log('Meta data:', action.meta);

			// Handle 204 No Content response (null/empty payload is expected and indicates success)
			if (action.payload === null || action.payload === undefined) {
				console.log('API returned 204 No Content - this is expected for successful PATCH operations');

				const successMessage = {
					type: 'success',
					message: 'Goal updated successfully! Refreshing data...',
					timestamp: new Date().toISOString()
				};

				updateState({
					systemMessages: [...(state.systemMessages || []), successMessage],
					modalSystemMessages: state.relationshipModalOpen ? [
						...(state.modalSystemMessages || []),
						successMessage
					] : state.modalSystemMessages
				});

				// Refresh just the goals for the specific problem using stored ID
				const problemId = state.lastEditedGoalProblemId;
				console.log('UPDATE_GOAL_SUCCESS - problemId from state:', problemId);
				console.log('UPDATE_GOAL_SUCCESS - currentAssessmentId:', state.currentAssessmentId);
				console.log('UPDATE_GOAL_SUCCESS - condition met?', problemId && state.currentAssessmentId);

				if (problemId && state.currentAssessmentId) {
					console.log('Refreshing goals for problem:', problemId);

					// Clear the stored problem ID and refresh goals
					updateState({
						lastEditedGoalProblemId: null
					});

					dispatch('LOAD_PROBLEM_GOALS', {
						problemId: problemId,
						guidelineTemplateId: state.currentAssessmentId
					});
				} else {
					console.log('NOT refreshing goals - missing problemId or assessmentId');
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
					modalSystemMessages: state.relationshipModalOpen ? [
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
				modalSystemMessages: state.relationshipModalOpen ? [
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
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		// Intervention editing action handlers (same pattern as goals)
		'GET_INTERVENTION_DETAILS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {interventionId, goalId} = action.payload;

			console.log('=== GET_INTERVENTION_DETAILS ACTION TRIGGERED ===');
			console.log('Fetching details for intervention:', interventionId);
			console.log('Goal ID:', goalId);

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

			console.log('Sending GET_INTERVENTION_DETAILS request:', requestBody);

			// Make the API call
			dispatch('MAKE_GET_INTERVENTION_DETAILS_REQUEST', {
				requestBody: requestBody
			});
		},

		'GET_INTERVENTION_DETAILS_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.log('=== GET_INTERVENTION_DETAILS_SUCCESS ===');
			console.log('API Response:', action.payload);

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
						category: action.payload.category || 'assist'
					}
				});
			} else {
				// Fallback to cached data if API didn't return proper details
				console.warn('API returned incomplete intervention details, using fallback data');
				updateState({
					editingInterventionData: state.interventionDetailsFallback || {
						label: '',
						alternative_wording: '',
						tooltip: '',
						category: 'assist'
					},
					interventionDetailsFallback: null
				});
			}

			console.log('Intervention editing data set:', state.editingInterventionData);
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
				modalSystemMessages: state.relationshipModalOpen ? [
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

			console.log('=== SAVE_INTERVENTION_EDITS ACTION TRIGGERED ===');
			console.log('Saving edits for intervention:', interventionId);
			console.log('Intervention data:', interventionData);

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
				modalSystemMessages: state.relationshipModalOpen ? [
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
				goal_id: goalId
			});

			console.log('Sending UPDATE_INTERVENTION request:', requestBody);

			// Make the API call
			dispatch('MAKE_UPDATE_INTERVENTION_REQUEST', {
				requestBody: requestBody,
				meta: {goalId: goalId} // Pass goalId for success handler
			});
		},

		'UPDATE_INTERVENTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== UPDATE_INTERVENTION_SUCCESS ===');
			console.log('Full action payload:', action.payload);

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
				modalSystemMessages: state.relationshipModalOpen ? [
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
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					errorMessage
				] : state.modalSystemMessages
			});
		},

		'ADD_QUESTION_RELATIONSHIP': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {answerId, questionId, questionLabel} = action.payload;

			console.log('=== ADD_QUESTION_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Forwarding to ADD_BRANCH_QUESTION:', questionId, 'to answer:', answerId);

			// Just forward to the existing ADD_BRANCH_QUESTION action
			dispatch('ADD_BRANCH_QUESTION', {
				answerId: answerId,
				questionId: questionId,
				questionLabel: questionLabel
			});
		},

		'OPEN_EDIT_MODAL': (coeffects) => {
			const {action, updateState} = coeffects;
			const {type, itemId, text} = action.payload;
			
			console.log('Opening edit modal:', type, itemId, text);
			
			updateState({
				modalOpen: true,
				modalType: type,
				modalItemId: itemId,
				modalText: text,
				modalOriginalText: text
			});
		},

		'UPDATE_MODAL_TEXT': (coeffects) => {
			const {action, updateState} = coeffects;
			const {text} = action.payload;
			
			updateState({
				modalText: text
			});
		},

		'CLOSE_MODAL': (coeffects) => {
			const {updateState} = coeffects;
			
			updateState({
				modalOpen: false,
				modalType: null,
				modalItemId: null,
				modalText: '',
				modalOriginalText: ''
			});
		},

		'SAVE_MODAL_TEXT': (coeffects) => {
			const {action, updateState, state} = coeffects;
			
			console.log('Saving modal text:', state.modalType, state.modalItemId, state.modalText);
			
			if (state.modalType === 'question') {
				// Update question label
				const updatedQuestions = state.currentQuestions.questions.map(question => 
					question.ids.id === state.modalItemId 
						? {...question, label: state.modalText}
						: question
				);
				
				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					},
					modalOpen: false,
					modalType: null,
					modalItemId: null,
					modalText: '',
					modalOriginalText: ''
				});
			} else if (state.modalType === 'answer') {
				// Update answer label
				const updatedQuestions = state.currentQuestions.questions.map(question => ({
					...question,
					answers: question.answers?.map(answer => 
						answer.ids.id === state.modalItemId 
							? {...answer, label: state.modalText}
							: answer
					) || []
				}));
				
				updateState({
					currentQuestions: {
						...state.currentQuestions,
						questions: updatedQuestions
					},
					modalOpen: false,
					modalType: null,
					modalItemId: null,
					modalText: '',
					modalOriginalText: ''
				});
			} else if (state.modalType === 'section') {
				// Update section label and mark as changed for saving
				const updatedSections = state.currentAssessment.sections.map(section => ({
					...section,
					subsections: section.subsections?.map(subsection => 
						subsection.id === state.modalItemId 
							? {...subsection, label: state.modalText}
							: subsection
					) || []
				}));
				
				// Track this section as changed so it gets saved
				const newSectionChanges = {
					...state.sectionChanges,
					[state.modalItemId]: {
						id: state.modalItemId,
						label: state.modalText,
						tooltip: '', // Keep existing or default
						alternative_wording: '',
						required: false,
						custom_attributes: {},
						sort_order: 0
					}
				};
				
				updateState({
					currentAssessment: {
						...state.currentAssessment,
						sections: updatedSections
					},
					sectionChanges: newSectionChanges,
					modalOpen: false,
					modalType: null,
					modalItemId: null,
					modalText: '',
					modalOriginalText: ''
				});
			}
		},

		'ADD_SECTION': (coeffects) => {
			const {updateState, state} = coeffects;

			console.log('ADD_SECTION action triggered - creating parent section');

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

			console.log('ADD_CHILD_SECTION action triggered for parent:', parentSectionId);

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
			console.log('Existing subsections for sort_order calculation:', existingSubsections.map(s => ({ label: s.label, sort_order: s.sort_order })));

			const sortOrders = existingSubsections.map(s => s.sort_order || 0);
			const maxSortOrder = sortOrders.length > 0 ? Math.max(...sortOrders) : 0;
			const nextSortOrder = maxSortOrder + 1;

			console.log('Calculated next sort_order:', nextSortOrder, 'from existing:', sortOrders);

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

			console.log('=== EDIT_SECTION_NAME DEBUG ===');
			console.log('Original Section ID:', sectionId);
			console.log('Original Section Label:', sectionLabel);
			console.log('Is temp ID?', sectionId.startsWith('temp_'));

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
			
			console.log('Saving section name:', sectionLabel);
			console.log('Selected library_id:', state.selectedSectionLibraryId);
			
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
			
			// Check if this section name already exists in the current assessment
			const existingSections = [];
			if (state.currentAssessment?.sections) {
				state.currentAssessment.sections.forEach(section => {
					if (section.subsections) {
						section.subsections.forEach(subsection => {
							// Don't compare with itself
							if (subsection.id !== sectionId) {
								existingSections.push(subsection.label.toLowerCase().trim());
							}
						});
					}
				});
			}
			
			const currentSectionName = sectionLabel.toLowerCase().trim();
			if (existingSections.includes(currentSectionName)) {
				updateState({
					systemMessages: [
					...(state.systemMessages || []),
						
						{
							type: 'error',
							message: `Section "${sectionLabel}" already exists in this assessment. Please use a different name.`,
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
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

			console.log('=== CHECK_SECTION_LIBRARY_MATCH ===');
			console.log('Searching for exact library match of:', sectionLabel);

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

			console.log('=== PROCEED_WITH_SECTION_SAVE DEBUG ===');
			console.log('Section checkmark clicked - auto-saving all changes!');
			console.log('Section ID at save time:', sectionId);
			console.log('Is temp ID?', sectionId.startsWith('temp_'));

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

			console.log('=== SAVE_SECTION_IMMEDIATELY DEBUG ===');
			console.log('Section ID:', sectionId);
			console.log('Section Label:', sectionLabel);
			console.log('Library ID:', libraryId);
			console.log('Is temp ID?', sectionId.startsWith('temp_'));

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
				console.log('🆕 Treating as NEW section - will use ADD_SECTION_API');
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

				console.log('Found section data:', {
					id: actualSection.id,
					label: actualSection.label,
					sort_order: actualSection.sort_order,
					isParentSection: isParentSection,
					parentSectionId: parentSectionId
				});

				// Check if parent section has temp ID - need to save parent first
				if (parentSectionId && parentSectionId.startsWith('temp_')) {
					console.log('Child section needs parent saved first. Parent ID:', parentSectionId);
					console.log('Queuing child section save after parent save completes');

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
					console.log('Saving parent section first:', parentSection.label);
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
				console.log('🔄 Treating as EXISTING section - will use UPDATE_SECTION_API');
				// Existing section - use UPDATE API
				const sectionData = {
					sectionId: sectionId,
					label: sectionLabel
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
			const {action, updateState, state, dispatch} = coeffects;
			const {sectionId, sectionName} = action.payload;
			
			console.log('Deleting section:', sectionName);
			
			if (confirm(`Are you sure you want to delete section "${sectionName}"?`)) {
				let updatedSections;
				let isParentSection = false;

				// Check if this is a parent section (top level)
				const parentSectionToDelete = state.currentAssessment.sections.find(section => section.id === sectionId);

				if (parentSectionToDelete) {
					// This is a parent section - remove it completely from the sections array
					isParentSection = true;
					console.log('Deleting parent section:', sectionName);
					updatedSections = state.currentAssessment.sections.filter(section => section.id !== sectionId);
				} else {
					// This is a child section - remove it from parent sections' subsections
					console.log('Deleting child section:', sectionName);
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
					console.log('Calling backend API to delete section:', sectionId);
					dispatch('DELETE_SECTION_API', {
						sectionId: sectionId
					});
				} else {
					console.log('Skipping backend API call - temp section:', sectionId);
					// Show immediate success message for temp sections
					updateState({
						systemMessages: [
					...(state.systemMessages || []),
							
							{
								type: 'success',
								message: 'Section removed successfully!',
								timestamp: new Date().toISOString()
							}
						]
					});
				}
			}
		},

		'ADD_SECTION_API': (coeffects) => {
			const {action, dispatch, state} = coeffects;
			const {sectionData} = action.payload;

			console.log('Calling add section API with data:', sectionData);

			// Get config and access token like other APIs
			const config = state.careiqConfig;
			const accessToken = state.accessToken;

			// Send fields directly - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				app: config.app,
				region: config.region,
				version: config.version,
				accessToken: accessToken,
				gt_id: state.currentAssessmentId,
				parent_section_id: sectionData.parent_section_id, // Use the correct parent_section_id from sectionData
				label: sectionData.label,
				sort_order: sectionData.sort_order,
				library_id: sectionData.library_id
			});

			console.log('Add section request body:', requestBody);
			dispatch('MAKE_ADD_SECTION_REQUEST', {requestBody: requestBody});
		},

		'UPDATE_SECTION_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {sectionData} = action.payload;

			console.log('Calling update section API with data:', sectionData);

			// Send fields directly - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				sectionId: sectionData.sectionId,
				label: sectionData.label,
				library_id: sectionData.library_id,
				sort_order: sectionData.sort_order
			});

			console.log('Update section request body:', requestBody);
			dispatch('MAKE_SECTION_UPDATE_REQUEST', {requestBody: requestBody, sectionId: sectionData.sectionId});
		},

		'DELETE_SECTION_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {sectionId} = action.payload;
			
			console.log('Calling delete section API for:', sectionId);
			
			const requestBody = JSON.stringify({
				sectionId: sectionId
			});
			
			console.log('Delete section request body (simplified):', requestBody);
			dispatch('MAKE_DELETE_SECTION_REQUEST', {requestBody: requestBody});
		},

		'MAKE_DELETE_SECTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-section', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_SECTION_SUCCESS',
			errorActionType: 'DELETE_SECTION_ERROR'
		}),

		'DELETE_SECTION_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.log('Section deleted successfully:', action.payload);

			// The section was already removed locally by DELETE_SECTION handler
			// Just confirm the backend operation succeeded
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'success',
						message: 'Section deleted successfully! No refresh needed.',
						timestamp: new Date().toISOString()
					}
				]
			});

			console.log('Section delete confirmed by backend - no refresh needed (already updated locally)');
		},

		'DELETE_SECTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Section delete error:', action.payload);
			
			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to delete section';
			
			updateState({
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
			
			console.log('Starting drag for section:', sectionId, 'at index:', sectionIndex);
			
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

		'DROP_SECTION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {targetSectionId, targetIndex} = action.payload;
			const draggingSection = state.draggingSection;
			const draggingIndex = state.draggingSectionIndex;
			
			console.log('Dropping section:', draggingSection, 'onto:', targetSectionId);
			console.log('Moving from index:', draggingIndex, 'to index:', targetIndex);
			
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
					console.log('Auto-saving reordered sections:', reorderedSection.subsections.map(s => ({ id: s.id, label: s.label, sort_order: s.sort_order })));

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
						console.log(`Saving section ${subsection.label} with sort_order: ${subsection.sort_order}`);
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
			
			console.log('Editing tooltip for question:', questionId, 'Current tooltip:', currentTooltip);
			
			updateState({
				editingTooltip: true,
				editingTooltipText: currentTooltip,
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
			
			if (questionId) {
				console.log('Saving tooltip for question:', questionId, 'New tooltip:', newTooltip);
				
				// Update the question in the current questions data and mark as unsaved
				const updatedQuestions = {
					...state.currentQuestions,
					questions: state.currentQuestions.questions.map(question =>
						question.ids.id === questionId
							? {...question, tooltip: newTooltip, isUnsaved: true}
							: question
					)
				};

				updateState({
					currentQuestions: updatedQuestions,
					editingTooltip: null,
					editingTooltipText: null,
					editingTooltipQuestionId: null,
					editingTooltipAnswerId: null,
					// Track question change for save
					questionChanges: {
						...state.questionChanges,
						[questionId]: {
							action: 'update',
							questionId: questionId,
							tooltip: newTooltip
						}
					}
				});
			} else if (answerId) {
				console.log('Saving tooltip for answer:', answerId, 'New tooltip:', newTooltip);

				// Update the answer in the current questions data and mark question as unsaved
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
							// Mark question as unsaved if it contains the updated answer
							isUnsaved: hasAnswerToUpdate ? true : question.isUnsaved
						};
					})
				};

				updateState({
					currentQuestions: updatedQuestions,
					editingTooltip: null,
					editingTooltipText: null,
					editingTooltipQuestionId: null,
					editingTooltipAnswerId: null,
					// Track answer change for save
					answerChanges: {
						...state.answerChanges,
						[answerId]: {
							action: 'update',
							answerId: answerId,
							tooltip: newTooltip
						}
					}
				});
			}
		},

		'CANCEL_TOOLTIP_EDIT': (coeffects) => {
			const {updateState} = coeffects;
			
			updateState({
				editingTooltip: null,
				editingTooltipText: null,
				editingTooltipQuestionId: null,
				editingTooltipAnswerId: null
			});
		},

		'UPDATE_ANSWER_LABEL': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, newLabel} = action.payload;

			console.log('Updating answer label:', answerId, 'New label:', newLabel);

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
						label: newLabel
					}
				}
			});
		},

		'UPDATE_ANSWER_SECONDARY_INPUT': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, newSecondaryInputType} = action.payload;

			console.log('Updating answer secondary input:', answerId, 'New type:', newSecondaryInputType);

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

			console.log('Updating answer mutually_exclusive:', answerId, 'to:', mutually_exclusive);

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
			
			console.log('Editing tooltip for answer:', answerId, 'Current tooltip:', currentTooltip);
			
			updateState({
				editingTooltip: true,
				editingTooltipText: currentTooltip,
				editingTooltipAnswerId: answerId
			});
		},

		'SAVE_ALL_CHANGES': async (coeffects) => {
			const {updateState, state, dispatch} = coeffects;

			// console.log('=== SAVE_ALL_CHANGES HANDLER TRIGGERED ===');
			// console.log('Saving all changes to backend');
			// console.log('Section changes:', state.sectionChanges);
			// console.log('Question changes:', state.questionChanges);
			console.log('Answer changes:', state.answerChanges); // Keep for delete debugging
			// console.log('Relationship changes:', state.relationshipChanges);

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
			console.log('=== CAPTURED CHANGES FOR SAVE ===');
			console.log('Section changes:', sectionChanges.length, sectionChanges);
			console.log('Question changes:', questionChanges.length, questionChanges);
			console.log('Answer changes:', answerChanges.length, answerChanges);
			console.log('Relationship changes:', relationshipChanges.length, relationshipChanges);
			console.log('Answer changes data:', answerChangesData);
			console.log('================================');

			// IMMEDIATELY clear change tracking to prevent duplicate calls
			updateState({
				sectionChanges: {},
				questionChanges: {},
				answerChanges: {},
				relationshipChanges: {},
				// Clear isUnsaved flags from all questions to hide save buttons
				currentQuestions: state.currentQuestions ? {
					...state.currentQuestions,
					questions: state.currentQuestions.questions.map(q => ({
						...q,
						isUnsaved: false
					}))
				} : state.currentQuestions
			});

			// FIRST: Run all deduplication checks before any save operations

			// Check for duplicate questions
			if (questionChanges.length > 0) {
				const duplicateQuestions = [];
				questionChanges.forEach(questionId => {
					const questionData = questionChangesData[questionId];
					if (questionData.action === 'add') {
						// Check if this question already exists in the current section
						const existingQuestions = [];
						if (state.currentQuestions?.questions) {
							state.currentQuestions.questions.forEach(existingQuestion => {
								// Don't compare with itself (in case it's a temp ID)
								if (existingQuestion.ids.id !== questionId) {
									existingQuestions.push(existingQuestion.label.toLowerCase().trim());
								}
							});
						}

						const currentQuestionLabel = questionData.label.toLowerCase().trim();
						if (existingQuestions.includes(currentQuestionLabel)) {
							duplicateQuestions.push(questionData.label);
						}
					}
				});

				// If duplicates found, show error and stop saving
				if (duplicateQuestions.length > 0) {
					const duplicateList = duplicateQuestions.join(', ');
					updateState({
						systemMessages: [
					...(state.systemMessages || []),
							
							{
								type: 'error',
								message: `Question(s) already exist in this section: ${duplicateList}. Please use different names.`,
								timestamp: new Date().toISOString()
							}
						]
					});
					return; // Stop the entire save process
				}
			}

			// Check for duplicate answers
			if (answerChanges.length > 0) {
				const duplicateAnswers = [];
				answerChanges.forEach(answerId => {
					const answerData = answerChangesData[answerId];
					if (answerData.action === 'add' || answerData.action === 'library_replace') {
						// Find which question this answer belongs to
						let targetQuestion = null;
						if (state.currentQuestions?.questions) {
							for (let question of state.currentQuestions.questions) {
								if (question.answers) {
									const foundAnswer = question.answers.find(ans => ans.ids.id === answerId);
									if (foundAnswer) {
										targetQuestion = question;
										break;
									}
								}
							}
						}

						if (targetQuestion) {
							// Check if this answer already exists in the target question
							const existingAnswers = [];
							targetQuestion.answers.forEach(existingAnswer => {
								// Don't compare with itself
								if (existingAnswer.ids.id !== answerId) {
									existingAnswers.push(existingAnswer.label.toLowerCase().trim());
								}
							});

							const currentAnswerLabel = answerData.label.toLowerCase().trim();
							if (existingAnswers.includes(currentAnswerLabel)) {
								duplicateAnswers.push(`"${answerData.label}" in question "${targetQuestion.label}"`);
							}
						}
					}
				});

				// If duplicates found, show error and stop saving
				if (duplicateAnswers.length > 0) {
					const duplicateList = duplicateAnswers.join(', ');
					updateState({
						systemMessages: [
					...(state.systemMessages || []),
							
							{
								type: 'error',
								message: `Answer(s) already exist: ${duplicateList}. Please use different answer text.`,
								timestamp: new Date().toISOString()
							}
						]
					});
					return; // Stop the entire save process
				}
			}

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
						console.log('Deleting section:', sectionId);
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
					for (const section of state.currentAssessment.sections) {
						if (section.id === sectionId) {
							isParentSection = true;
							break;
						}
					}

					if (isParentSection) {
						parentSections.push({sectionId, sectionData});
					} else {
						childSections.push({sectionId, sectionData});
					}
				});

				// Save parent sections first
				parentSections.forEach(({sectionId, sectionData}) => {
					console.log('Saving parent section:', sectionId, sectionData);
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
					console.log('Saving question:', questionId, questionData);

					// Handle new questions with ADD API
					if (questionData.action === 'add') {
						console.log('Adding new question:', questionId);
						// Prepare data for backend API
						const backendQuestionData = {
							label: questionData.label,
							type: questionData.type,
							tooltip: questionData.tooltip || '',
							alternative_wording: '',
							answers: questionData.answers.map(answer => ({
								label: answer.label,
								tooltip: answer.tooltip || '',
								alternative_wording: '',
								secondary_input_type: answer.secondary_input_type,
								mutually_exclusive: answer.mutually_exclusive || false,
								custom_attributes: {},
								required: answer.required || false
							})),
							guideline_template_id: questionData.guideline_template_id,
							section_id: questionData.section_id,
							sort_order: questionData.sort_order,
							custom_attributes: {},
							voice: 'CaseManager',
							required: questionData.required || false,
							available: false
						};
						
						dispatch('ADD_QUESTION_API', {
							questionData: backendQuestionData,
							sectionId: questionData.sectionId
						});
					} else if (questionData.action === 'delete') {
						console.log('Deleting question:', questionId);
						
						// Skip if the question has a temp ID (was never saved to backend)
						if (questionId.startsWith('temp_')) {
							console.log('Skipping delete for temp question - was never saved to backend');
							return;
						}
						
						dispatch('DELETE_QUESTION_API', {
							questionId: questionId
						});
					} else if (questionData.action === 'library_replace') {
						console.log('=== LIBRARY QUESTION SAVE DEBUG ===');
						console.log('Library question ID:', questionId);
						console.log('Question data from changes:', questionData);
						console.log('Current assessment ID:', state.currentAssessmentId);
						console.log('Selected section ID:', state.selectedSection);

						// Find the current question to get actual UI values
						let currentQuestion = null;
						if (state.currentQuestions && state.currentQuestions.questions) {
							currentQuestion = state.currentQuestions.questions.find(q => q.ids.id === questionId);
							console.log('Found current question:', currentQuestion);
						}

						if (!currentQuestion) {
							console.error('CRITICAL ERROR: Current question not found for library save!');
							return;
						}

						// Get all library answers for this question
						const questionAnswers = currentQuestion.answers || [];
						console.log('Question answers count:', questionAnswers.length);
						console.log('Question answers:', questionAnswers);

						// Use 2-step process for library questions to handle answers correctly
						console.log('Using 2-step process for library question');

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

						console.log('Library question using standard ADD_QUESTION_TO_SECTION_API flow');

						dispatch('ADD_QUESTION_TO_SECTION_API', {
							questionData: libraryQuestionData,
							sectionId: state.selectedSection,
							pendingAnswers: questionAnswers // Raw answers - will be processed by API handler
						});
					} else if (questionData.action === 'update') {
						console.log('Updating question:', questionId);

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
			
			// Save answer changes - First check for exact library matches
			if (answerChanges.length > 0) {
				console.log('=== CHECKING ANSWERS FOR EXACT LIBRARY MATCHES ===');
				console.log('Answer changes to check:', answerChanges);
				console.log('Answer changes data:', answerChangesData);

				// Check each answer against library for exact matches
				for (let answerId of answerChanges) {
					const answerData = answerChangesData[answerId];
					if (answerData && answerData.label && answerData.label.trim()) {
						console.log('Checking answer for library match:', answerData.label);
						console.log('Making typeahead API call for:', answerData.label.trim());

						// Make synchronous call to typeahead API to check for exact match
						try {
							const typeaheadResponse = await fetch('/api/x_cadal_careiq_b_0/careiq_api/answer-typeahead', {
								method: 'POST',
								headers: {
									'Content-Type': 'application/json'
								},
								body: JSON.stringify({
									searchText: answerData.label.trim()
								})
							});

							if (typeaheadResponse.ok) {
								const typeaheadData = await typeaheadResponse.json();
								console.log('Typeahead response for', answerData.label, ':', typeaheadData);

								if (typeaheadData.results && typeaheadData.results.length > 0) {
									console.log('Found', typeaheadData.results.length, 'typeahead results');
									console.log('Typeahead results:', typeaheadData.results);

									// Check for exact match (case insensitive)
									const exactMatch = typeaheadData.results.find(result => {
										if (!result || !result.name) {
											console.log('Skipping result with missing name:', result);
											return false;
										}
										console.log('Comparing:', result.name.toLowerCase().trim(), 'vs', answerData.label.toLowerCase().trim());
										return result.name.toLowerCase().trim() === answerData.label.toLowerCase().trim();
									});

									console.log('Exact match result:', exactMatch);

									if (exactMatch) {
										console.log('Found exact library match for:', answerData.label, 'Library ID:', exactMatch.id);

										// Update the answer to use library reference
										const updatedAnswerData = {
											...answerData,
											action: 'library_replace',
											libraryAnswerId: exactMatch.id,
											originalLibraryData: exactMatch
										};
										answerChangesData[answerId] = updatedAnswerData;

										console.log('Updated answer data to library reference:', updatedAnswerData);

										// Add system message about using library answer
										updateState({
											systemMessages: [
												...(state.systemMessages || []),
												{
													type: 'info',
													message: `Found existing library answer for "${answerData.label}", using library version`,
													timestamp: new Date().toISOString()
												}
											]
										});
									}
								}
							}
						} catch (error) {
							console.warn('Error checking answer against library:', error);
							// Continue with normal processing if typeahead fails
						}
					}
				}

				console.log('=== LIBRARY CHECK COMPLETE, PROCESSING SAVES ===');
				console.log('Final answer changes data after library check:', answerChangesData);
			}

			// Save answer changes - Group by question and action type
			if (answerChanges.length > 0) {
				// Group answers by question ID and action type
				const answersGroupedByQuestion = {};
				const individualAnswers = [];

				answerChanges.forEach(answerId => {
					const answerData = answerChangesData[answerId];
					console.log('Processing answer change:', answerId, answerData);

					if (answerData.action === 'add' || answerData.action === 'library_replace') {
						// Skip if the question is also new (temp ID) - will be handled with question creation
						if (answerData.question_id && answerData.question_id.startsWith('temp_')) {
							console.log('Skipping answer for new question - will be created with question');
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
							console.log('Grouped answer for bulk API:', answerId, 'action:', answerData.action, 'to question:', questionId);
						}
					} else {
						// Individual operations (update, delete, library_add, etc.)
						individualAnswers.push({ answerId, answerData });
					}
				});

				// Process grouped new answers first (use bulk ADD_ANSWERS_TO_QUESTION API)
				Object.keys(answersGroupedByQuestion).forEach(questionId => {
					const answersForQuestion = answersGroupedByQuestion[questionId];
					console.log('Adding', answersForQuestion.length, 'answers to question:', questionId);

					// Prepare answers array for bulk API
					const answersArray = answersForQuestion.map(({ answerId, answerData }) => {
						// Handle library answers differently - use library ID instead of creating new answer
						if (answerData.action === 'library_replace') {
							console.log('Adding library answer with ID:', answerData.libraryAnswerId);

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
								library_id: answerData.libraryAnswerId, // Use library ID for library answers
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

							return {
								label: currentAnswer ? currentAnswer.label : answerData.label,
								sort_order: currentAnswer ? currentAnswer.sort_order : 0, // Required field
								tooltip: currentAnswer ? (currentAnswer.tooltip || '') : (answerData.tooltip || ''),
								alternative_wording: answerData.alternative_wording || '',
								secondary_input_type: currentAnswer ? currentAnswer.secondary_input_type : answerData.secondary_input_type,
								mutually_exclusive: currentAnswer ? (currentAnswer.mutually_exclusive || false) : (answerData.mutually_exclusive || false),
								custom_attributes: answerData.custom_attributes || {},
								required: answerData.required || false
							};
						}
					});

					// Call bulk ADD_ANSWERS_TO_QUESTION API
					const requestBody = JSON.stringify({
						questionId: questionId,
						guideline_template_id: state.currentAssessmentId,
						answers: answersArray
					});

					console.log('Dispatching MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST for question:', questionId);
					console.log('Request body:', requestBody);

					dispatch('MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST', { requestBody });
				});

				// Process individual answer operations
				individualAnswers.forEach(({ answerId, answerData }) => {
					console.log('Processing individual answer operation:', answerId, answerData.action);

					if (answerData.action === 'delete') {
						console.log('Deleting answer:', answerId);

						// Skip if the answer has a temp ID (was never saved to backend)
						if (answerId.startsWith('temp_')) {
							console.log('Skipping delete for temp answer - was never saved to backend');
							return;
						}

						dispatch('DELETE_ANSWER_API', {
							answerId: answerId,
							suppressMessage: true // Suppress individual success message during bulk save
						});
					} else if (answerData.action === 'update') {
						console.log('Updating answer:', answerId);
						
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
					console.log('Saving relationship:', relationshipKey, relationshipData);
					
					if (relationshipData.action === 'add' && relationshipData.relationshipType === 'question') {
						console.log('Adding branch question relationship:', relationshipData.answerId, relationshipData.targetId);
						
						dispatch('ADD_BRANCH_QUESTION', {
							answerId: relationshipData.answerId,
							questionId: relationshipData.targetId,
							questionLabel: relationshipData.targetLabel
						});
					} else if (relationshipData.action === 'delete' && relationshipData.relationshipType === 'question') {
						console.log('Deleting branch question relationship:', relationshipData.answerId, relationshipData.targetId);
						
						dispatch('DELETE_BRANCH_QUESTION', {
							answerId: relationshipData.answerId,
							questionId: relationshipData.targetId,
							questionLabel: relationshipData.targetLabel
						});
					} else if (relationshipData.action === 'add' && relationshipData.relationshipType === 'guideline') {
						console.log('=== DEBUGGING GUIDELINE RELATIONSHIP SAVE ===');
						console.log('relationshipData:', relationshipData);
						console.log('relationshipData.answerId:', relationshipData.answerId);
						console.log('relationshipData.targetId:', relationshipData.targetId);
						console.log('typeof relationshipData.targetId:', typeof relationshipData.targetId);
						console.log('relationshipData.targetId === null:', relationshipData.targetId === null);
						console.log('relationshipData.targetId === undefined:', relationshipData.targetId === undefined);

						const requestBody = JSON.stringify({
							answerId: relationshipData.answerId,
							guidelineId: relationshipData.targetId
						});

						console.log('DANNY- guidelineId being passed:', relationshipData.targetId);
						console.log('Final request body:', requestBody);
						console.log('Parsed request body:', JSON.parse(requestBody));

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

		'SAVE_SECTION': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {sectionId, sectionData, config, accessToken} = action.payload;
			
			console.log('SAVE_SECTION handler called for section:', sectionId);
			console.log('Section data:', sectionData);
			console.log('Config:', config);
			console.log('Access token exists:', !!accessToken);
			console.log('gt_id value:', sectionData.gt_id);
			console.log('parent_section_id value:', sectionData.parent_section_id);
			
			// Check if this is a new section (add) or existing section (update)
			// New sections have either action='add' or temp IDs starting with 'temp_'
			if (sectionData.action === 'add' || sectionId.startsWith('temp_')) {
				console.log('This is a new section - calling add section API (simplified)');
				console.log('DEBUG - sectionData object:', sectionData);
				console.log('DEBUG - sort_order:', sectionData.sort_order);
				console.log('DEBUG - gt_id:', sectionData.gt_id);
				console.log('DEBUG - label:', sectionData.label);
				console.log('DEBUG - parent_section_id:', sectionData.parent_section_id);
				console.log('DEBUG - library_id:', sectionData.library_id);
				
				const requestBody = JSON.stringify({
					sort_order: sectionData.sort_order || 1,
					gt_id: sectionData.gt_id,
					label: sectionData.label || '',
					parent_section_id: sectionData.parent_section_id,
					library_id: sectionData.library_id || null
				});
				
				console.log('Add section request body (simplified):', requestBody);
				dispatch('MAKE_ADD_SECTION_REQUEST', {requestBody: requestBody});
				
			} else {
				console.log('This is an existing section - calling update section API');
				
				const requestBody = JSON.stringify({
					sectionId: sectionId,
					label: sectionData.label || '',
					tooltip: sectionData.tooltip || '',
					alternative_wording: sectionData.alternative_wording || '',
					required: sectionData.required || false,
					custom_attributes: sectionData.custom_attributes || {},
					sort_order: sectionData.sort_order || 0
				});
				
				console.log('Update section request body (simplified):', requestBody);
				dispatch('MAKE_SECTION_UPDATE_REQUEST', {requestBody: requestBody, sectionId: sectionId});
			}
		},

		'MAKE_SECTION_UPDATE_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/update-section', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'SECTION_UPDATE_SUCCESS',
			errorActionType: 'SECTION_UPDATE_ERROR',
			metaParam: 'sectionId'
		}),

		'MAKE_ADD_SECTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-section', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_SECTION_SUCCESS',
			errorActionType: 'ADD_SECTION_ERROR'
		}),

		'ADD_QUESTION_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {questionData} = action.payload;
			
			console.log('ADD_QUESTION_API handler called');
			console.log('Question data:', questionData);
			
			// CORRECT: Send fields directly - ServiceNow HTTP framework adds data wrapper automatically
			const requestBody = JSON.stringify({
				label: questionData.label,
				type: questionData.type,
				tooltip: questionData.tooltip,
				alternative_wording: questionData.alternative_wording,
				answers: questionData.answers,
				guideline_template_id: questionData.guideline_template_id,
				section_id: questionData.section_id,
				sort_order: questionData.sort_order,
				custom_attributes: questionData.custom_attributes,
				voice: questionData.voice,
				required: questionData.required,
				available: questionData.available
			});
			
			console.log('Add Question request body:', requestBody);
			
			dispatch('MAKE_ADD_QUESTION_REQUEST', {requestBody: requestBody});
		},

		'ADD_QUESTION_TO_SECTION_API': (coeffects) => {
			const {action, dispatch, state, updateState} = coeffects;
			const {questionData, sectionId, pendingAnswers} = action.payload;

			console.log('ADD_QUESTION_TO_SECTION_API handler called');
			console.log('Question data:', questionData);
			console.log('Section ID:', sectionId);
			console.log('Pending answers:', pendingAnswers);

			// Store pending answers in state for later use in success handler
			if (pendingAnswers && pendingAnswers.length > 0) {
				// Process pending answers to add library_id for library answers ONLY
				const processedPendingAnswers = pendingAnswers.map((answer, index) => {
					console.log('=== PROCESSING PENDING ANSWER ===');
					console.log('Answer index:', index);
					console.log('Answer object:', answer);
					console.log('isLibraryAnswer:', answer.isLibraryAnswer);
					console.log('libraryAnswerId:', answer.libraryAnswerId);

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
					if (answer.isLibraryAnswer && answer.libraryAnswerId) {
						answerPayload.library_id = answer.libraryAnswerId;
						console.log('✅ Added library_id for library answer:', answer.libraryAnswerId);
					} else {
						console.log('⚪ Non-library answer - no library_id added');
					}

					console.log('Final answer payload:', answerPayload);
					return answerPayload;
				});

				updateState({
					pendingQuestionAnswers: processedPendingAnswers
				});
				console.log('Stored processed pending answers:', processedPendingAnswers.length);
			}

			// Send fields directly - ServiceNow adds data wrapper automatically
			const requestBodyData = {
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

			// Add library_id for library questions
			if (questionData.library_id) {
				requestBodyData.library_id = questionData.library_id;
				console.log('Adding library_id to request:', questionData.library_id);
			}

			const requestBody = JSON.stringify(requestBodyData);

			console.log('Add Question to Section request body:', requestBody);
			dispatch('MAKE_ADD_QUESTION_TO_SECTION_REQUEST', {requestBody: requestBody});
		},

		'ADD_ANSWER_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {answerData} = action.payload;
			
			console.log('ADD_ANSWER_API handler called');
			console.log('Answer data:', answerData);
			
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
			
			console.log('Add Answer request body:', requestBody);
			
			dispatch('MAKE_ADD_ANSWER_REQUEST', {requestBody: requestBody});
		},

		'DELETE_ANSWER_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {answerId, suppressMessage} = action.payload;

			console.log('DELETE_ANSWER_API handler called');
			console.log('Answer ID to delete:', answerId);

			// Prepare request body following the established pattern (direct fields, no data wrapper)
			const requestBody = JSON.stringify({
				answerId: answerId
			});

			console.log('Delete Answer request body:', requestBody);

			dispatch('MAKE_DELETE_ANSWER_REQUEST', {
				requestBody: requestBody
			});
		},

		'UPDATE_ANSWER_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {answerData} = action.payload;
			
			console.log('UPDATE_ANSWER_API handler called');
			console.log('Answer data to update:', answerData);
			
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
			
			console.log('Update Answer request body:', requestBody);
			
			dispatch('MAKE_UPDATE_ANSWER_REQUEST', {requestBody: requestBody});
		},

		'MAKE_UPDATE_ANSWER_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/update-answer', {
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
			console.log('Answer updated successfully:', action.payload);
			
			// Store the current section to re-select after refresh
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			// Add success message
			updateState({
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'success',
						message: 'Answer updated successfully! Refreshing data...',
						timestamp: new Date().toISOString()
					}
				]
			});
			
			// Set pending reselection data
			updateState({
				pendingReselectionSection: currentSection
			});
			
			// Trigger data refresh with proper reselection
			dispatch('FETCH_ASSESSMENT_DETAILS', {
				assessmentId: state.currentAssessment.ids.id,
				assessmentTitle: state.currentAssessment.title
			});
		},

		'UPDATE_ANSWER_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Update answer failed - Full error object:', action.payload);
			console.error('Error status:', action.payload?.status);
			console.error('Error response:', action.payload?.response);
			console.error('Error message:', action.payload?.error?.message);
			
			const errorMessage = action.payload?.error?.message || action.payload?.message || action.payload?.response || 'Failed to update answer';
			
			console.error('Final error message:', errorMessage);
			
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'error',
						message: `Failed to update answer: ${errorMessage}`,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'DELETE_QUESTION_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {questionId} = action.payload;
			
			console.log('DELETE_QUESTION_API handler called');
			console.log('Question ID to delete:', questionId);
			
			// Prepare request body following the established pattern (direct fields, no data wrapper)
			const requestBody = JSON.stringify({
				questionId: questionId
			});
			
			console.log('Delete Question request body:', requestBody);
			
			dispatch('MAKE_DELETE_QUESTION_REQUEST', {requestBody: requestBody});
		},

		'UPDATE_QUESTION_API': (coeffects) => {
			const {action, dispatch} = coeffects;
			const {questionData} = action.payload;
			
			console.log('UPDATE_QUESTION_API handler called');
			console.log('Question data to update:', questionData);
			
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
			
			console.log('Update Question request body:', requestBody);
			
			dispatch('MAKE_UPDATE_QUESTION_REQUEST', {requestBody: requestBody});
		},

		'MAKE_UPDATE_QUESTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/update-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'UPDATE_QUESTION_SUCCESS',
			errorActionType: 'UPDATE_QUESTION_ERROR'
		}),

		'UPDATE_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.log('Question updated successfully:', action.payload);

			// Just show success message - no refresh needed
			updateState({
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
			
			updateState({
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

		'MAKE_ADD_QUESTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_QUESTION_SUCCESS',
			errorActionType: 'ADD_QUESTION_ERROR'
		}),

		'MAKE_ADD_QUESTION_TO_SECTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-question-to-section', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_QUESTION_TO_SECTION_SUCCESS',
			errorActionType: 'ADD_QUESTION_TO_SECTION_ERROR'
		}),

		'MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-answers-to-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_ANSWERS_TO_QUESTION_SUCCESS',
			errorActionType: 'ADD_ANSWERS_TO_QUESTION_ERROR'
		}),

		'ADD_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			console.log('Question added successfully:', action.payload);
			console.log('Full action.payload structure:', JSON.stringify(action.payload, null, 2));

			// Log the question UUID to console
			if (action.payload && action.payload.id) {
				console.log('=== QUESTION CREATED SUCCESSFULLY ===');
				console.log('New Question UUID:', action.payload.id);
				console.log('=====================================');
			}

			// Check for backend messages (like duplicate prevention)
			let systemMessage = 'Question created successfully! Refreshing data...';
			let messageType = 'success';

			// Debug: Check all possible locations for the message
			console.log('Checking for backend messages:');
			console.log('action.payload.detail:', action.payload?.detail);
			console.log('action.payload.message:', action.payload?.message);
			console.log('action.payload.data?.detail:', action.payload?.data?.detail);

			// Surface any backend detail messages to user
			if (action.payload && action.payload.detail) {
				systemMessage = action.payload.detail;
				messageType = 'warning';
				console.log('Found detail message:', systemMessage);
			} else if (action.payload && action.payload.data && action.payload.data.detail) {
				systemMessage = action.payload.data.detail;
				messageType = 'warning';
				console.log('Found data.detail message:', systemMessage);
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

			// Refresh the questions for the current section
			if (state.selectedSection) {
				console.log('Refreshing questions for section:', state.selectedSection);
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
			
			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to add question';
			
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

		'ADD_QUESTION_TO_SECTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			console.log('Question added to section successfully:', action.payload);

			// Handle different response formats
			let newQuestionId = action.payload.id;
			let isLibraryResponse = false;

			// Check if this is a library question response (might have detail instead of id)
			if (!newQuestionId && action.payload.detail) {
				console.log('Library question response detected:', action.payload.detail);
				isLibraryResponse = true;
				// For library questions, we might need to generate a temporary ID or handle differently
				// The backend should still provide some way to identify the created question
			}

			console.log('New Question ID received:', newQuestionId);
			console.log('Is library response:', isLibraryResponse);

			// Find and update the temp question with the real ID locally
			const updatedQuestions = state.currentQuestions.questions.map(question => {
				// If this is the temp question being saved, replace with real data
				if (question.isUnsaved && question.ids.id.startsWith('temp_')) {
					console.log('Replacing temp question:', question.ids.id, 'with real ID:', newQuestionId);
					return {
						...question,
						ids: { id: newQuestionId || question.ids.id }, // Keep temp ID if no real ID provided
						isUnsaved: false // Remove the unsaved flag
					};
				}
				return question;
			});

			// Check if there are pending answers to add (for Single Select/Multiselect questions)
			const pendingAnswers = state.pendingQuestionAnswers;
			console.log('=== CHECKING FOR PENDING ANSWERS ===');
			console.log('newQuestionId:', newQuestionId);
			console.log('pendingAnswers:', pendingAnswers);
			console.log('pendingAnswers type:', typeof pendingAnswers);
			console.log('pendingAnswers length:', pendingAnswers?.length);

			if (pendingAnswers && pendingAnswers.length > 0) {
				console.log('Step 2: Adding answers to newly created question');
				console.log('Pending answers:', pendingAnswers);

				// Handle library questions that might not return a real question ID
				if (!newQuestionId && isLibraryResponse) {
					console.log('Library question without ID - skipping answer addition (backend should handle library answers)');
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

					// CRITICAL: Preserve library_id for library answers
					if (answer.library_id) {
						apiAnswer.library_id = answer.library_id;
						console.log('🔥 PRESERVING library_id in final payload:', answer.library_id);
					}

					return apiAnswer;
				});

				console.log('=== ADD ANSWERS REQUEST DEBUG ===');
				console.log('questionId for request:', newQuestionId);
				console.log('answersForAPI:', answersForAPI);
				console.log('answersForAPI length:', answersForAPI.length);

				// Create request body for add answers API
				// Don't add data wrapper - ServiceNow adds it automatically
				const requestBody = JSON.stringify({
					questionId: newQuestionId,
					answers: answersForAPI
				});

				console.log('ADD ANSWERS requestBody:', requestBody);

				// Dispatch the add answers request
				dispatch('MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST', { requestBody });

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
					// Clear pending answers since we're using them now
					pendingQuestionAnswers: null
				});
			} else {
				// No answers to add, just update state
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
					]
				});
			}
		},

		'ADD_QUESTION_TO_SECTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Question add to section error:', action.payload);

			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to add question to section';

			updateState({
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
			const {action, updateState, state} = coeffects;
			console.log('Answers added to question successfully:', action.payload);

			// The response should contain array of answer UUIDs
			const newAnswerIds = action.payload;
			console.log('New Answer IDs received:', newAnswerIds);

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
		},

		'ADD_ANSWERS_TO_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Add answers to question error:', action.payload);

			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to add answers to question';

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'error',
						message: 'Error adding answers to question: ' + errorMessage,
						timestamp: new Date().toISOString()
					}
				]
			});
		},

		'MAKE_ADD_ANSWER_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-answer', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_ANSWER_SUCCESS',
			errorActionType: 'ADD_ANSWER_ERROR'
		}),

		'MAKE_DELETE_ANSWER_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-answer', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_ANSWER_SUCCESS',
			errorActionType: 'DELETE_ANSWER_ERROR'
		}),

		'DELETE_ANSWER_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.log('Answer deleted successfully:', action.payload);

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
				console.log('Refreshing questions for section after delete:', state.selectedSection);
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

		'MAKE_DELETE_QUESTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/delete-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'DELETE_QUESTION_SUCCESS',
			errorActionType: 'DELETE_QUESTION_ERROR'
		}),

		'DELETE_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.log('Question deleted successfully:', action.payload);

			// The question was already removed locally by DELETE_QUESTION handler
			// Just confirm the backend operation succeeded
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					
					{
						type: 'success',
						message: 'Question deleted successfully! No refresh needed.',
						timestamp: new Date().toISOString()
					}
				]
			});

			console.log('Question delete confirmed by backend - no refresh needed (already updated locally)');
		},

		'DELETE_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Question delete error:', action.payload);
			
			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to delete question';
			
			updateState({
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
			console.log('Answer added successfully:', action.payload);
			
			// Log the answer UUID to console
			if (action.payload && action.payload.id) {
				console.log('=== ANSWER CREATED SUCCESSFULLY ===');
				console.log('New Answer UUID:', action.payload.id);
				console.log('=====================================');
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
				console.log('Refreshing questions for section:', state.selectedSection);
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
			
			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to add answer';
			
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
			const {action, updateState, state} = coeffects;
			console.log('Section update success:', action.payload);
			console.log('Section update action meta:', action.meta);

			// The section was already updated locally by SAVE_SECTION_IMMEDIATELY or reordering
			// Just confirm the backend operation succeeded
			updateState({
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
				console.log('Processing pending child sections after update:', state.pendingChildSections.length);

				// Save all pending child sections
				state.pendingChildSections.forEach(({sectionId, sectionData}) => {
					console.log('Saving child section:', sectionId, sectionData);
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

			console.log('Section update confirmed by backend - no refresh needed (already updated locally)');
		},

		'SECTION_UPDATE_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Section update error:', action.payload);
			
			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to update section';
			
			updateState({
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
			console.log('Add section success:', action.payload);

			// The response contains the new section ID: { "id": "uuid" }
			const newSectionId = action.payload.id;

			console.log('Updating temp section with real ID:', newSectionId);

			// Find and update the temp section with the real ID locally
			const updatedSections = state.currentAssessment.sections.map(section => ({
				...section,
				subsections: section.subsections?.map(subsection => {
					// If this is the temp section (marked as isNew), replace with real data
					if (subsection.isNew && subsection.id.startsWith('temp_')) {
						console.log('Replacing temp section:', subsection.id, 'with real ID:', newSectionId);
						return {
							...subsection,
							id: newSectionId,
							isNew: false // Remove the temp flag
						};
					}
					return subsection;
				}) || []
			}));

			updateState({
				currentAssessment: {
					...state.currentAssessment,
					sections: updatedSections
				},
				systemMessages: [
					...(state.systemMessages || []),

					{
						type: 'success',
						message: 'Section added successfully! No refresh needed.',
						timestamp: new Date().toISOString()
					}
				],
				// Clear the pending child section save since parent is now saved
				pendingChildSectionSave: null
			});

			// Check if there's a pending child section save and save it now that parent has real UUID
			const pendingChildSave = state.pendingChildSectionSave;
			if (pendingChildSave) {
				console.log('Parent section saved successfully. Now saving pending child section:', pendingChildSave);
				// Save the child section now that the parent has a real UUID
				setTimeout(() => {
					dispatch('SAVE_SECTION_IMMEDIATELY', {
						sectionId: pendingChildSave.sectionId,
						sectionLabel: pendingChildSave.sectionLabel,
						libraryId: pendingChildSave.libraryId
					});
				}, 100); // Small delay to ensure state updates are processed
			}

			// Check if there are pending child sections to save after parent sections are done
			if (state.pendingChildSections && state.pendingChildSections.length > 0) {
				console.log('Processing pending child sections:', state.pendingChildSections.length);

				// Save all pending child sections
				state.pendingChildSections.forEach(({sectionId, sectionData}) => {
					console.log('Saving child section:', sectionId, sectionData);
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
			const {updateState, state, dispatch} = coeffects;
			
			console.log('Canceling all local changes');
			
			if (confirm('Are you sure you want to cancel all unsaved changes? This action cannot be undone.')) {
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
				
				// Show warning message
				updateState({
					systemMessages: [
					...(state.systemMessages || []),
						...state.systemMessages,
						{
							type: 'warning',
							message: 'All unsaved changes have been canceled.',
							timestamp: new Date().toISOString()
						}
					]
				});
			}
		},

		// Typeahead functionality for sections
		'SECTION_TYPEAHEAD_INPUT_CHANGE': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {searchText, debounce = true} = action.payload;
			
			console.log('Section typeahead input change:', searchText);
			
			// Clear existing timeout
			if (state.sectionTypeaheadDebounceTimeout) {
				clearTimeout(state.sectionTypeaheadDebounceTimeout);
			}
			
			// Update query and hide dropdown if search is too short
			if (searchText.length < 3) {
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
					console.log('Typeahead request body:', requestBody);
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
				console.log('Typeahead request body:', requestBody);
				dispatch('SECTION_TYPEAHEAD_SEARCH', { requestBody });
			}
		},

		'SECTION_TYPEAHEAD_SEARCH': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/generic-typeahead', {
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
			console.log('Section typeahead search success:', action.payload);
			console.log('Response type:', typeof action.payload);
			console.log('Raw response:', JSON.stringify(action.payload));
			
			const response = action.payload;
			const results = response.results || [];
			console.log('Extracted results:', results);
			console.log('Results length:', results.length);
			
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

			console.log('Section typeahead selected:', selectedItem);

			// Update the editing section name with selected item
			updateState({
				editingSectionName: selectedItem.name,
				sectionTypeaheadVisible: false,
				sectionTypeaheadQuery: selectedItem.name,
				sectionTypeaheadResults: [],
				// Store the master_id for use as library_id when creating the section
				selectedSectionLibraryId: selectedItem.master_id
			});
		},

		'SEARCH_ANSWERS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {searchText, answerId} = action.payload;

			console.log('=== SEARCH_ANSWERS ===');
			console.log('Searching for:', searchText);
			console.log('Answer ID in SEARCH_ANSWERS:', answerId);

			const requestBody = JSON.stringify({
				searchText: searchText
			});

			updateState({
				answerTypeaheadLoading: true,
				currentAnswerSearchQuestionId: answerId
			});

			dispatch('MAKE_ANSWER_SEARCH_REQUEST', {
				requestBody: requestBody
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
				answerTypeaheadVisible: searchText.length >= 3
			});
		},

		'SELECT_LIBRARY_ANSWER': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {answerId, libraryAnswer} = action.payload;

			console.log('=== SELECT_LIBRARY_ANSWER ===');
			console.log('Replacing answer ID:', answerId);
			console.log('With library answer:', libraryAnswer);

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

			console.log('=== REPLACE_ANSWER_WITH_LIBRARY ===');
			console.log('Replacing answer:', answerId, 'with library data:', libraryAnswerData);

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
							libraryAnswerId: libraryAnswerData.id,
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
					libraryAnswerId: libraryAnswerData.id,
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
				currentAnswerSearchQuestionId: null
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

		// Relationship Modal Actions
		'OPEN_RELATIONSHIP_MODAL': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {answerId} = action.payload;

			console.log('Opening relationship modal for answer:', answerId);

			updateState({
				relationshipModalOpen: true,
				relationshipModalAnswerId: answerId,
				relationshipModalActiveTab: 'guidelines',
				modalSystemMessages: [],  // Initialize empty modal messages
				modalSystemMessagesCollapsed: true,  // Start collapsed
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

			// Auto-load relationships if they don't exist yet
			if (answerId && !state.answerRelationships[answerId] && !state.relationshipsLoading[answerId]) {
				console.log('Relationships not loaded yet, loading them now...');
				dispatch('LOAD_ANSWER_RELATIONSHIPS', {
					answerId: answerId
				});
			} else {
				console.log('Modal opened, relationships already available');
			}
		},

		'CLOSE_RELATIONSHIP_MODAL': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			const answerId = state.relationshipModalAnswerId;

			console.log('Closing relationship modal for answer:', answerId);

			updateState({
				relationshipModalOpen: false,
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
				console.log('Refreshing section questions to update relationship badges');
				dispatch('FETCH_SECTION_QUESTIONS', {
					sectionId: state.selectedSection,
					sectionLabel: state.selectedSectionLabel
				});
			}
		},

		// Intervention Action Handlers (following goals pattern)
		'LOAD_GOAL_INTERVENTIONS': (coeffects) => {
			const {action, state, updateState, dispatch} = coeffects;
			const {goalId, guidelineTemplateId} = action.payload;

			console.log('=== LOAD_GOAL_INTERVENTIONS ACTION TRIGGERED ===');
			console.log('Loading interventions for goal:', goalId);
			console.log('Guideline Template ID:', guidelineTemplateId);

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

			console.log('=== LOAD_GOAL_INTERVENTIONS_SUCCESS ===');
			console.log('API Response:', action.payload);

			// Use stored goalId from state instead of meta (meta not working reliably)
			const goalId = state.currentInterventionsLoadingGoalId;
			console.log('Using stored goalId from state:', goalId);

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

			console.log('Loaded', interventionsData.length, 'interventions for goal:', goalId);
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

		'ADD_INTERVENTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;

			console.log('=== ADD_INTERVENTION_SUCCESS ===');
			console.log('Response:', action.payload);

			// Show success message
			let systemMessage = 'Intervention created successfully! Refreshing data...';
			let messageType = 'success';

			// Surface any backend detail messages to user
			if (action.payload && action.payload.detail) {
				systemMessage = action.payload.detail;
				if (systemMessage.toLowerCase().includes('duplicate') ||
					systemMessage.toLowerCase().includes('already')) {
					messageType = 'warning';
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
				],
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					{
						type: messageType,
						message: systemMessage,
						timestamp: new Date().toISOString()
					}
				] : state.modalSystemMessages
			});

			// Clear typeahead state after successful intervention creation
			const answerId = state.relationshipModalAnswerId;
			if (answerId) {
				updateState({
					interventionTypeaheadText: {},
					interventionTypeaheadResults: {},
					selectedInterventionData: {},
					currentInterventionSearchContext: null
				});
			}

			// CRITICAL: Refresh intervention data using stored goalId (meta params unreliable in ServiceNow)
			const goalId = state.lastAddedInterventionGoalId;
			console.log('ADD_INTERVENTION_SUCCESS - Goal ID from stored state:', goalId);
			console.log('ADD_INTERVENTION_SUCCESS - Assessment ID:', state.currentAssessmentId);
			if (goalId && state.currentAssessmentId) {
				console.log('Auto-refreshing interventions for goal:', goalId);
				// Clear the stored ID after use
				updateState({
					lastAddedInterventionGoalId: null
				});
				dispatch('LOAD_GOAL_INTERVENTIONS', {
					goalId: goalId,
					guidelineTemplateId: state.currentAssessmentId
				});
			} else {
				console.log('PROBLEM: Cannot auto-refresh - missing stored goalId or assessmentId');
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

			console.error('ADD_INTERVENTION_ERROR:', action.payload);

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'error',
						message: `Failed to add intervention: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				],
				modalSystemMessages: state.relationshipModalOpen ? [
					...(state.modalSystemMessages || []),
					{
						type: 'error',
						message: `Failed to add intervention: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				] : state.modalSystemMessages
			});
		},

		'TOGGLE_GOAL_EXPANSION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {goalId} = action.payload;

			console.log('Toggling expansion for goal:', goalId);

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
				console.log('Goal expanded and interventions not loaded yet - loading interventions for:', goalId);
				dispatch('LOAD_GOAL_INTERVENTIONS', {
					goalId: goalId,
					guidelineTemplateId: state.currentAssessmentId
				});
			}
		},

		'TOGGLE_PROBLEM_EXPANSION': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {problemId} = action.payload;

			console.log('Toggling expansion for problem:', problemId);

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
				console.log('Problem expanded and goals not loaded yet - loading goals for:', problemId);
				dispatch('LOAD_PROBLEM_GOALS', {
					problemId: problemId,
					guidelineTemplateId: state.currentAssessmentId
				});
			}
		},

		'SET_RELATIONSHIP_TAB': (coeffects) => {
			const {action, updateState} = coeffects;
			const {tab} = action.payload;

			console.log('Setting relationship modal tab to:', tab);

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

			console.log('Hiding relationship typeahead');

			updateState({
				relationshipTypeaheadText: '',
				relationshipTypeaheadResults: [],
				relationshipTypeaheadLoading: false
			});
		},

		'SAVE_RELATIONSHIP_CHANGES': (coeffects) => {
			const {dispatch} = coeffects;

			console.log('Saving relationship changes');

			// For now, just close the modal. In the future, this would save changes to backend
			dispatch('CLOSE_RELATIONSHIP_MODAL');

			// TODO: Implement actual save logic to backend when needed
		},

		'TOGGLE_MODAL_SYSTEM_MESSAGES': (coeffects) => {
			const {updateState, state} = coeffects;
			updateState({
				modalSystemMessagesCollapsed: !state.modalSystemMessagesCollapsed
			});
		},

	},
	reducers: {}
});