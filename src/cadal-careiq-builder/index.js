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
														<div key={version.id} className="version-card">
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
								{state.currentAssessment ? state.currentAssessment.title : 'Assessment Builder'}
							</h2>
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
								// Individual save buttons will be shown per question instead of holistic save
							] : null}
							{state.currentAssessment?.status === 'published' ? (
								<span className="published-indicator">
									📋 Published Version - Read Only
								</span>
							) : null}
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
													<span className="section-label">{section.label}</span>
													<span className="section-info">
														({section.questions_quantity || 0} questions)
													</span>
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
												console.log('Question render debug:', {
													builderMode: state.builderMode,
													assessmentStatus: state.currentAssessment?.status,
													isEditable: isEditable,
													questionId: question.ids.id,
													voice: question.voice,
													label: question.label
												});
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
																					<div className="typeahead-item-title">{result.name}</div>
																					<div className="typeahead-item-meta">
																						{result.exact_match ? 'Exact Match' : 'Partial Match'}
																					</div>
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
																				<input 
																					type="text"
																					className="answer-label-input"
																					value={answer.label}
																					placeholder="Enter answer text..."
																					oninput={(e) => {
																						dispatch('UPDATE_ANSWER_LABEL', {
																							answerId: answer.ids.id,
																							newLabel: e.target.value
																						});
																					}}
																				/>
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
																					{!state.answerRelationships[answer.ids.id] && !state.relationshipsLoading[answer.ids.id] ? (
																						<button 
																							className="load-relationships-btn"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('LOAD_ANSWER_RELATIONSHIPS', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							{(() => {
																								if (!answer.counts) return 'Add Relationships';
																								
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
																									
																								return displayCounts.length > 0 ? displayCounts.join(' ') : 'Add Relationships';
																							})()}
																						</button>
																					) : state.relationshipsLoading[answer.ids.id] ? (
																						<div className="relationships-loading">
																							⏳ Loading relationships...
																						</div>
																					) : null}
																				</div>
																			)}
																			
																			{/* Relationship display (shown when loaded) */}
																			{isEditable && state.showRelationships && state.answerRelationships[answer.ids.id] && (
																				<div className="relationships-display">
																					<div className="relationships-header">
																						🔍 <strong>Relationships for "{answer.label}"</strong>
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
																			{/* Loading state */}
																			{isEditable && state.showRelationships && state.relationshipsLoading[answer.ids.id] && (
																				<div className="relationships-loading">
																					⏳ Loading relationships...
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
																				<input 
																					type="text"
																					className="answer-label-input"
																					value={answer.label}
																					placeholder="Enter answer text..."
																					oninput={(e) => {
																						dispatch('UPDATE_ANSWER_LABEL', {
																							answerId: answer.ids.id,
																							newLabel: e.target.value
																						});
																					}}
																				/>
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
																					{!state.answerRelationships[answer.ids.id] && !state.relationshipsLoading[answer.ids.id] ? (
																						<button 
																							className="load-relationships-btn"
																							on={{
																								click: (e) => {
																									e.stopPropagation();
																									dispatch('LOAD_ANSWER_RELATIONSHIPS', {
																										answerId: answer.ids.id
																									});
																								}
																							}}
																						>
																							{(() => {
																								if (!answer.counts) return 'Add Relationships';
																								
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
																									
																								return displayCounts.length > 0 ? displayCounts.join(' ') : 'Add Relationships';
																							})()}
																						</button>
																					) : state.relationshipsLoading[answer.ids.id] ? (
																						<div className="relationships-loading">
																							⏳ Loading relationships...
																						</div>
																					) : null}
																				</div>
																			)}
																			
																			{/* Relationship display (shown when loaded) */}
																			{isEditable && state.showRelationships && state.answerRelationships[answer.ids.id] && (
																				<div className="relationships-display">
																					<div className="relationships-header">
																						🔍 <strong>Relationships for "{answer.label}"</strong>
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
																			{/* Loading state */}
																			{isEditable && state.showRelationships && state.relationshipsLoading[answer.ids.id] && (
																				<div className="relationships-loading">
																					⏳ Loading relationships...
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
		selectedSectionLibraryId: null
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
			console.log('Mobile view check - window.innerWidth:', window.innerWidth, 'isMobile:', isMobile);
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
			console.log('About to dispatch FETCH_ASSESSMENTS with config and token');
			dispatch('FETCH_ASSESSMENTS', {
				config: state.careiqConfig,
				accessToken: token,
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
			console.log('USE_CASE_CATEGORIES_SUCCESS - Full Response:', action.payload);
			console.log('Response type:', typeof action.payload);
			console.log('Response keys:', Object.keys(action.payload || {}));
			
			// Check if response has use_case_categories
			const categories = action.payload?.use_case_categories;
			console.log('Categories found:', categories);
			console.log('Categories type:', typeof categories);
			console.log('Categories length:', Array.isArray(categories) ? categories.length : 'not array');
			
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
			const {config, accessToken, offset, limit, latestVersionOnly, searchValue} = action.payload;
			
			console.log('FETCH_ASSESSMENTS handler called');
			
			updateState({assessmentsLoading: true});
			
			const requestBody = JSON.stringify({
				app: config.app,
				region: config.region,
				version: config.version,
				accessToken: accessToken,
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

		'MAKE_ASSESSMENTS_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/guideline-templates', {
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
			console.log('ASSESSMENTS_SUCCESS - Full Response:', action.payload);
			
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
			console.log('Create new assessment clicked');
			// TODO: Implement new assessment creation
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
				config: state.careiqConfig,
				accessToken: state.accessToken,
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
				app: state.careiqConfig.app,
				region: state.careiqConfig.region,
				version: state.careiqConfig.version,
				accessToken: state.accessToken,
				assessmentId: assessmentId
			});
			
			console.log('Assessment details request body:', requestBody);
			
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
			console.log('ASSESSMENT_DETAILS_SUCCESS - Full Response:', action.payload);
			
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
			console.log('SECTION_QUESTIONS_SUCCESS - Full Response:', action.payload);
			console.log('SECTION_QUESTIONS_SUCCESS - Response type:', typeof action.payload);
			console.log('SECTION_QUESTIONS_SUCCESS - Response keys:', Object.keys(action.payload || {}));
			console.log('SECTION_QUESTIONS_SUCCESS - Questions array:', action.payload?.questions);
			
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
			const {action, updateState, state} = coeffects;
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

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				}
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

			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				}
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

			// Check if this is a temp question (add) or real question (update)
			if (questionId.startsWith('temp_')) {
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
			
			// Build request body for simplified API call
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
				visibleQuestions: visibleQuestions
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

		'CLOSE_ANSWER_RELATIONSHIPS': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId} = action.payload;
			
			console.log('Closing answer relationships for:', answerId);
			
			const updatedRelationships = {...state.answerRelationships};
			delete updatedRelationships[answerId];
			
			updateState({
				answerRelationships: updatedRelationships
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

			// Store current section for reselection after refresh
			const currentSection = state.selectedSection;

			// Clear all change tracking arrays and reset UI state for fresh start
			updateState({
				relationshipChanges: {},
				sectionChanges: {},
				pendingReselectionSection: currentSection,
				systemMessages: [
					...state.systemMessages,
					{
						type: 'success',
						message: `Successfully added guideline relationship! Refreshing data...`,
						timestamp: new Date().toISOString()
					}
				]
			});

			// Refresh complete assessment structure following Save and Refresh Pattern
			if (state.currentAssessmentId) {
				console.log('Refreshing complete assessment data after guideline relationship add');
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessmentId
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
					...state.systemMessages,
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
			console.log('API Response:', action.payload);
			console.log('Original action data:', action.meta);
			
			// Get original data from meta (passed through HTTP effect)
			const {answerId, questionId, questionLabel} = action.meta || {};
			
			console.log('Branch question added successfully:', questionId, 'to answer:', answerId);
			
			// Follow CLAUDE.md refresh pattern - store current section for reselection
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			// Clear all change tracking arrays and reset UI state for fresh start
			updateState({
				relationshipChanges: {},
				sectionChanges: {},
				systemMessages: [
					...state.systemMessages,
					{
						type: 'success',
						message: `Successfully added triggered question "${questionLabel}" to answer relationship! Refreshing data...`,
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
			
			// Dispatch FETCH_ASSESSMENT_DETAILS to reload complete assessment structure
			dispatch('FETCH_ASSESSMENT_DETAILS', {
				assessmentId: state.currentAssessmentId
			});
		},

		'ADD_BRANCH_QUESTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			
			console.error('ADD_BRANCH_QUESTION_ERROR:', action.payload);
			
			updateState({
				systemMessages: [
					...state.systemMessages,
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
			errorActionType: 'DELETE_BRANCH_QUESTION_ERROR'
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
					...state.systemMessages,
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
					...state.systemMessages,
					{
						type: 'error',
						message: `Failed to delete triggered question: ${action.payload?.error || 'Unknown error'}`,
						timestamp: new Date().toISOString()
					}
				]
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
			
			console.log('=== GUIDELINE_TYPEAHEAD_INPUT ===');
			console.log('Search text:', text);
			console.log('Answer ID:', answerId);
			console.log('Text length:', text.length);
			
			updateState({
				relationshipTypeaheadText: text,
				selectedRelationshipQuestion: null // Clear any selected guideline
			});
			
			// Only search after 3 characters
			if (text.length >= 3) {
				console.log('Triggering guideline search for:', text);
				
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
			
			console.log('=== SEARCH_GUIDELINES ===');
			console.log('Searching for:', searchText);
			console.log('Answer ID in SEARCH_GUIDELINES:', answerId);
			
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

		'QUESTION_SEARCH_SUCCESS': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.log('=== QUESTION_SEARCH_SUCCESS ===');
			console.log('Response:', action.payload);
			console.log('Response type:', typeof action.payload);
			console.log('Response keys:', Object.keys(action.payload || {}));
			console.log('action.payload.results:', action.payload.results);

			const results = action.payload.results || [];
			console.log('Found questions:', results.length);

			updateState({
				questionTypeaheadResults: results,
				questionTypeaheadLoading: false
			});

			console.log('After QUESTION_SEARCH_SUCCESS - State check:');
			console.log('questionTypeaheadVisible:', state.questionTypeaheadVisible);
			console.log('editingQuestionId:', state.editingQuestionId);
			console.log('Results length:', results.length);
		},

		'QUESTION_SEARCH_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;

			console.error('QUESTION_SEARCH_ERROR:', action.payload);

			updateState({
				questionTypeaheadResults: [],
				questionTypeaheadLoading: false,
				currentQuestionSearchSectionId: null,
				systemMessages: [
					...state.systemMessages,
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
					...state.systemMessages,
					{
						type: 'error',
						message: `Error fetching library question: ${action.payload?.error || 'Unknown error'}`,
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
			
			console.log('=== GUIDELINE_SEARCH_SUCCESS ===');
			console.log('Response:', action.payload);
			console.log('Full action object:', action);
			console.log('Action meta:', action.meta);
			console.log('Action payload meta:', action.payload.meta);
			
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
			
			console.error('GUIDELINE_SEARCH_ERROR:', action.payload);
			
			updateState({
				relationshipTypeaheadResults: [],
				relationshipTypeaheadLoading: false,
				currentGuidelineSearchAnswerId: null, // Clear on error
				systemMessages: [
					...state.systemMessages,
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
			const {text, sectionId} = action.payload;

			console.log('=== QUESTION_TYPEAHEAD_INPUT ===');
			console.log('Search text:', text);
			console.log('Section ID:', sectionId);
			console.log('Text length:', text.length);

			updateState({
				questionTypeaheadText: text,
				currentQuestionSearchSectionId: sectionId
			});

			// Only search after 3 characters
			if (text.length >= 3) {
				console.log('Triggering question search for:', text);
				dispatch('SEARCH_QUESTIONS', {
					searchText: text,
					sectionId: sectionId
				});
			} else {
				updateState({
					questionTypeaheadResults: []
				});
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
			const {action, updateState, state} = coeffects;
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
				alert('Error: No relationship selected to confirm');
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
			} else if (relationshipType === 'guideline') {
				// Handle guidelines - these don't modify the question structure but are stored separately
				console.log('Guideline relationship added to local state');
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
						message: `${relationshipType === 'question' ? 'Triggered question' : 'Guideline relationship'} "${selectedItem.label}" queued for save. Click "Save Changes" to apply.`,
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
			const {action, updateState, state} = coeffects;
			const {answerId, guidelineId, guidelineName} = action.payload;
			
			console.log('=== REMOVE_GUIDELINE_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Removing guideline:', guidelineId, 'from answer:', answerId);
			console.log('Guideline name:', guidelineName);
			
			// Generate the unique key for this relationship (same format as add)
			const relationshipKey = `${answerId}_guideline_${guidelineId}`;
			
			console.log('Removing relationship key:', relationshipKey);
			
			// Remove from relationship changes tracking
			const updatedRelationshipChanges = { ...state.relationshipChanges };
			delete updatedRelationshipChanges[relationshipKey];
			
			console.log('Updated relationship changes:', updatedRelationshipChanges);
			
			// Clear the add relationship UI and show success message
			updateState({
				relationshipChanges: updatedRelationshipChanges,
				// Add to system messages to show it's been removed
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'warning',
						message: `Guideline relationship "${guidelineName}" removed from queue.`,
						timestamp: new Date().toISOString()
					}
				]
			});
			
			console.log('=== REMOVE_GUIDELINE_RELATIONSHIP - State updated successfully ===');
			console.log('Guideline relationship removed from queue');
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
			const {action, state, updateState} = coeffects;
			const {answerId, guidelineId, guidelineName} = action.payload;

			console.log('=== ADD_GUIDELINE_RELATIONSHIP ACTION TRIGGERED ===');
			console.log('Adding guideline to change tracking:', guidelineId, 'to answer:', answerId);

			// ONLY update change tracking - API call happens during SAVE_ALL_CHANGES
			updateState({
				relationshipChanges: {
					...state.relationshipChanges,
					[`${answerId}_${guidelineId}`]: {
						action: 'add',
						answerId: answerId,
						targetId: guidelineId,
						targetLabel: guidelineName,
						relationshipType: 'guideline'
					}
				}
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
			
			console.log('ADD_SECTION action triggered - adding locally');
			
			// Get the parent section (first section)
			const parentSection = state.currentAssessment.sections?.[0];
			if (!parentSection) {
				console.error('No parent section found');
				updateState({
					systemMessages: [
						...(state.systemMessages || []),
						{
							type: 'error',
							message: 'No parent section found to add subsection to',
							timestamp: new Date().toISOString()
						}
					]
				});
				return;
			}
			
			// Calculate next sort_order to place new section at the end
			const existingSubsections = parentSection.subsections || [];
			console.log('Existing subsections for sort_order calculation:', existingSubsections.map(s => ({ label: s.label, sort_order: s.sort_order })));

			// Get all existing sort_order values, defaulting to 0 for null/undefined, and find the max
			const sortOrders = existingSubsections.map(s => s.sort_order || 0);
			const maxSortOrder = sortOrders.length > 0 ? Math.max(...sortOrders) : 0;
			const nextSortOrder = maxSortOrder + 1;

			console.log('Calculated next sort_order:', nextSortOrder, 'from existing:', sortOrders);
			
			// Create a new section object with temporary ID
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
			
			// Add to the parent section's subsections locally
			const updatedSections = [...state.currentAssessment.sections];
			const parentSectionIndex = updatedSections.findIndex(s => s.id === parentSection.id);
			if (parentSectionIndex !== -1) {
				updatedSections[parentSectionIndex] = {
					...updatedSections[parentSectionIndex],
					subsections: [...(updatedSections[parentSectionIndex].subsections || []), newSection]
				};
			}
			
			// Track the new section in sectionChanges for save operation
			const newSectionChanges = {
				...state.sectionChanges,
				[newSectionId]: {
					...newSection,
					parent_section_id: parentSection.id,
					gt_id: state.currentAssessmentId,
					library_id: null,
					action: 'add' // Track that this needs to be added to backend
				}
			};
			
			updateState({
				currentAssessment: {
					...state.currentAssessment,
					sections: updatedSections
				},
				sectionChanges: newSectionChanges,
				editingSectionId: newSectionId, // Auto-edit the new section
				editingSectionName: '', // Start with empty name for editing
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Section added locally - click Save to persist changes',
						timestamp: new Date().toISOString()
					}
				]
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
				alert('Section name cannot be blank. Please enter a section name.');
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
				alert(`Section "${sectionLabel}" already exists in this assessment. Please use a different name.`);
				return;
			}
			
			// No duplicate found, proceed with saving
			dispatch('PROCEED_WITH_SECTION_SAVE', {
				sectionId,
				sectionLabel
			});
		},


		'PROCEED_WITH_SECTION_SAVE': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			const {sectionId, sectionLabel} = action.payload;

			console.log('Section checkmark clicked - auto-saving all changes!');

			// Update the section label in the assessment
			const updatedSections = state.currentAssessment.sections.map(section => ({
				...section,
				subsections: section.subsections?.map(subsection =>
					subsection.id === sectionId
						? {...subsection, label: sectionLabel}
						: subsection
				) || []
			}));

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
					editingSectionId: null,
					editingSectionName: null,
					// Clear typeahead state
					sectionTypeaheadVisible: false,
					sectionTypeaheadResults: [],
					sectionTypeaheadQuery: '',
					sectionTypeaheadSelectedIndex: -1,
					selectedSectionLibraryId: null,
					systemMessages: [
						...state.systemMessages,
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
			const {action, dispatch, state} = coeffects;
			const {sectionId, sectionLabel, libraryId} = action.payload;

			console.log('Auto-saving section immediately:', sectionLabel);

			// Determine if this is a new section (temp ID) or existing section
			if (sectionId.startsWith('temp_')) {
				// New section - find the actual section data to get the correct sort_order
				let actualSection = null;
				for (const section of state.currentAssessment.sections) {
					if (section.subsections) {
						const foundSubsection = section.subsections.find(sub => sub.id === sectionId);
						if (foundSubsection) {
							actualSection = foundSubsection;
							break;
						}
					}
				}

				if (!actualSection) {
					console.error('Could not find section data for temp section:', sectionId);
					return;
				}

				console.log('Found actual section data with sort_order:', actualSection.sort_order);

				const sectionData = {
					label: sectionLabel,
					guideline_template_id: state.currentAssessmentId,
					sort_order: actualSection.sort_order  // Use the actual sort_order from the section
				};

				if (libraryId) {
					sectionData.library_id = libraryId;
				}

				dispatch('ADD_SECTION_API', {
					sectionData: sectionData
				});
			} else {
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
				// Remove the section from all parent sections
				const updatedSections = state.currentAssessment.sections.map(section => ({
					...section,
					subsections: section.subsections?.filter(subsection => subsection.id !== sectionId) || []
				}));
				
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

			// Send fields directly - ServiceNow adds data wrapper automatically
			const requestBody = JSON.stringify({
				gt_id: state.currentAssessmentId,
				parent_section_id: state.currentAssessment?.sections?.[0]?.id, // Use first parent section
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
					editingTooltipAnswerId: null
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
					editingTooltipAnswerId: null
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
				currentQuestions: updatedQuestions
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

		'SAVE_ALL_CHANGES': (coeffects) => {
			const {updateState, state, dispatch} = coeffects;
			
			console.log('=== SAVE_ALL_CHANGES HANDLER TRIGGERED ===');
			console.log('Saving all changes to backend');
			console.log('Section changes:', state.sectionChanges);
			console.log('Question changes:', state.questionChanges);
			console.log('Answer changes:', state.answerChanges);
			console.log('Relationship changes:', state.relationshipChanges);
			
			// Check what needs to be saved
			const sectionChanges = Object.keys(state.sectionChanges || {});
			const questionChanges = Object.keys(state.questionChanges || {});
			const answerChanges = Object.keys(state.answerChanges || {});
			const relationshipChanges = Object.keys(state.relationshipChanges || {});
			
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
			
			// Save section changes first
			if (sectionChanges.length > 0) {
				sectionChanges.forEach(sectionId => {
					const sectionData = state.sectionChanges[sectionId];
					console.log('Saving section:', sectionId, sectionData);
					
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
					
					dispatch('SAVE_SECTION', {
						sectionId: sectionId,
						sectionData: sectionData,
						config: state.careiqConfig,
						accessToken: state.accessToken
					});
				});
			}
			
			// Save question changes
			if (questionChanges.length > 0) {
				questionChanges.forEach(questionId => {
					const questionData = state.questionChanges[questionId];
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
						const questionData = {
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
							questionData: questionData,
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
			
			// Save answer changes
			if (answerChanges.length > 0) {
				answerChanges.forEach(answerId => {
					const answerData = state.answerChanges[answerId];
					console.log('Saving answer:', answerId, answerData);
					
					// Handle new answers with ADD API
					if (answerData.action === 'add') {
						console.log('Adding new answer:', answerId);
						
						// Skip if the question is also new (temp ID) - will be handled with question creation
						if (answerData.question_id.startsWith('temp_')) {
							console.log('Skipping answer for new question - will be created with question');
							return;
						}
						
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
							label: currentAnswer ? currentAnswer.label : answerData.label,
							tooltip: currentAnswer ? (currentAnswer.tooltip || '') : (answerData.tooltip || ''),
							alternative_wording: answerData.alternative_wording || 'string',
							secondary_input_type: currentAnswer ? currentAnswer.secondary_input_type : answerData.secondary_input_type,
							mutually_exclusive: currentAnswer ? (currentAnswer.mutually_exclusive || false) : (answerData.mutually_exclusive || false),
							custom_attributes: answerData.custom_attributes || {},
							required: answerData.required || false,
							sort_order: answerData.sort_order,
							question_id: answerData.question_id, // Must be real UUID
							guideline_template_id: answerData.guideline_template_id
						};
						
						dispatch('ADD_ANSWER_API', {
							answerData: backendAnswerData,
							questionId: answerData.questionId
						});
					} else if (answerData.action === 'delete') {
						console.log('Deleting answer:', answerId);
						
						// Skip if the answer has a temp ID (was never saved to backend)
						if (answerId.startsWith('temp_')) {
							console.log('Skipping delete for temp answer - was never saved to backend');
							return;
						}
						
						dispatch('DELETE_ANSWER_API', {
							answerId: answerId
						});
					} else if (answerData.action === 'library_add') {
						console.log('Skipping library answer - will be saved with parent library question:', answerId);
						// Library answers are now saved as part of the library question (ADD_QUESTION_API)
						return;
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
					const relationshipData = state.relationshipChanges[relationshipKey];
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
			const {answerId} = action.payload;
			
			console.log('DELETE_ANSWER_API handler called');
			console.log('Answer ID to delete:', answerId);
			
			// Prepare request body following the established pattern (direct fields, no data wrapper)
			const requestBody = JSON.stringify({
				answerId: answerId
			});
			
			console.log('Delete Answer request body:', requestBody);
			
			dispatch('MAKE_DELETE_ANSWER_REQUEST', {requestBody: requestBody});
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
			
			// Clear ALL changes since we're doing a full refresh
			updateState({
				sectionChanges: {},
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
			const {action, updateState, state, dispatch} = coeffects;
			console.log('Question updated successfully:', action.payload);
			
			// Store the current section to re-select after refresh
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			// Clear ALL changes since we're doing a full refresh
			updateState({
				sectionChanges: {},
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Question updated successfully! Refreshing data...',
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

			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: `${newAnswerIds.length} answer(s) added to question successfully!`,
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
			const {action, updateState, state, dispatch} = coeffects;
			console.log('Answer deleted successfully:', action.payload);
			
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Answer deleted successfully! Refreshing data...',
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
			const {action, updateState, state} = coeffects;
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
				]
			});
		},

		'ADD_SECTION_ERROR': (coeffects) => {
			const {action, updateState, state} = coeffects;
			console.error('Add section error:', action.payload);
			
			const errorMessage = action.payload?.error || action.payload?.message || 'Failed to add section';
			
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
					...state.systemMessages,
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

	},
	reducers: {}
});