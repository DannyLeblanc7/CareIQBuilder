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
						<h2>
							{state.currentAssessment ? state.currentAssessment.title : 'Assessment Builder'}
						</h2>
						<div className="builder-controls">
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
								// Show Save/Cancel buttons when there are unsaved changes
								...(Object.keys(state.sectionChanges || {}).length > 0 || 
								   Object.keys(state.questionChanges || {}).length > 0 || 
								   Object.keys(state.answerChanges || {}).length > 0 ? [
									<button 
										key="save-btn"
										className="save-changes-btn"
										onclick={() => dispatch('SAVE_ALL_CHANGES')}
									>
										💾 Save Changes
									</button>,
									<button 
										key="cancel-btn"
										className="cancel-changes-btn"
										onclick={() => dispatch('CANCEL_ALL_CHANGES')}
									>
										🚫 Cancel Changes
									</button>
								] : [])
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
						<div className="builder-content">
							<div className="sections-sidebar">
								<div className="sections-header">
									<h3>Sections</h3>
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
																		<input
																			type="text"
																			className="section-name-edit-input"
																			value={state.editingSectionName !== null ? state.editingSectionName : subsection.label}
																			oninput={(e) => dispatch('UPDATE_SECTION_NAME', {
																				sectionName: e.target.value
																			})}
																			onkeydown={(e) => {
																				if (e.key === 'Enter') {
																					dispatch('SAVE_SECTION_NAME', {
																						sectionId: subsection.id,
																						sectionLabel: state.editingSectionName !== null ? state.editingSectionName : subsection.label
																					});
																				} else if (e.key === 'Escape') {
																					dispatch('CANCEL_SECTION_EDIT');
																				}
																			}}
																			autoFocus
																		/>
																		<div className="section-edit-buttons">
																			<button
																				className="section-edit-save-btn"
																				onclick={() => dispatch('SAVE_SECTION_NAME', {
																					sectionId: subsection.id,
																					sectionLabel: state.editingSectionName !== null ? state.editingSectionName : subsection.label
																				})}
																				title="Save changes"
																			>
																				✓
																			</button>
																			<button
																				className="section-edit-cancel-btn"
																				onclick={() => dispatch('CANCEL_SECTION_EDIT')}
																				title="Cancel changes"
																			>
																				✕
																			</button>
																		</div>
																	</div>
																) : (
																	<span 
																		className="subsection-label"
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
																	>
																		{state.builderMode && state.currentAssessment?.status === 'draft' && (
																			<span 
																				className="edit-icon"
																				title="Edit section text"
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
																				onclick={(e) => {
																					e.stopPropagation();
																					dispatch('OPEN_EDIT_MODAL', {
																						type: 'section',
																						itemId: subsection.id,
																						text: subsection.label
																					});
																				}}
																			>
																				🔍
																			</span>
																		)}
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
																		{state.sectionChanges[subsection.id] && (
																			<span className="unsaved-indicator" title="Unsaved changes">●</span>
																		)}
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
														<div className="question-edit-header">
															<div className="question-number">{qIndex + 1}.</div>
															<div className="question-single-line">
																<select 
																	className="voice-select"
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
																<input 
																	type="text" 
																	className="question-label-input"
																	value={question.label}
																	placeholder="Enter question text..."
																/>
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
															<div className="question-controls">
																<label className="checkbox-control">
																	<input 
																		type="checkbox" 
																		checked={question.required}
																	/>
																	Required
																</label>
																<select className="question-type-select" onchange={(e) => {
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
																<button className="delete-question-btn" title="Delete Question">🗑️</button>
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
																				<div className="answer-controls">
																					<select 
																						className="secondary-input-select" 
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
																					<button className="delete-answer-btn" title="Delete Answer">🗑️</button>
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
																								<span key={triggerIndex} className="triggered-question-label">
																									→ {triggeredQuestion?.label || `Question ${triggeredId.substring(0, 8)}...`}
																								</span>
																							);
																						})}
																					</div>
																				</div>
																			)}
																			
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
																										<span key={qIndex} className="relationship-item">
																											→ {question.label}
																										</span>
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
																											→ {guideline.label || guideline.name}
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
																				<div className="answer-controls">
																					<label className="checkbox-control">
																						<input 
																							type="checkbox" 
																							checked={answer.mutually_exclusive}
																						/>
																						Exclusive
																					</label>
																					<select 
																						className="secondary-input-select" 
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
																					<button className="delete-answer-btn" title="Delete Answer">🗑️</button>
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
																								<span key={triggerIndex} className="triggered-question-label">
																									→ {triggeredQuestion?.label || `Question ${triggeredId.substring(0, 8)}...`}
																								</span>
																							);
																						})}
																					</div>
																				</div>
																			)}
																			
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
																										<span key={qIndex} className="relationship-item">
																											→ {question.label}
																										</span>
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
																											→ {guideline.label || guideline.name}
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
		// Modal state for editing long text
		modalOpen: false,
		modalType: null, // 'question' or 'answer'
		modalItemId: null,
		modalText: '',
		modalOriginalText: '',
		// Section editing state
		editingSectionId: null,
		editingSectionName: null,
		sectionChanges: {},
		// Change tracking for all components
		questionChanges: {},
		answerChanges: {},
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
		editingTooltipAnswerId: null
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
				pendingReselectionSectionLabel: null
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
				questionChanges: {},
				answerChanges: {}
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
			const {action, updateState, state} = coeffects;
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
			
			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				}
			});
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
			const nextSortOrder = state.currentQuestions.questions.length + 1;
			
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
				]
			};
			
			const updatedQuestions = [...state.currentQuestions.questions, newQuestion];
			
			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				questionChanges: {
					...state.questionChanges,
					[newQuestionId]: {
						action: 'add',
						type: newQuestion.type,
						label: newQuestion.label,
						required: newQuestion.required,
						tooltip: newQuestion.tooltip,
						sort_order: newQuestion.sort_order,
						answers: newQuestion.answers,
						sectionId: sectionId,
						guideline_template_id: state.currentAssessmentId,
						section_id: sectionId
					}
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
					const updatedQuestion = {...question, type: newType};
					
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
				questionChanges: {
					...state.questionChanges,
					[questionId]: {
						...state.questionChanges[questionId],
						action: state.questionChanges[questionId]?.action || (questionId.startsWith('temp_') ? 'add' : 'update'),
						type: newType
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
			
			// Generate the new answer ID outside the map function so we can track it
			const newAnswerId = 'temp_answer_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			let newAnswer = null;
			
			const updatedQuestions = state.currentQuestions.questions.map(question => {
				if (question.ids.id === questionId) {
					const nextSortOrder = question.answers ? question.answers.length + 1 : 1;
					
					newAnswer = {
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
						answers: [...(question.answers || []), newAnswer]
					};
				}
				return question;
			});
			
			updateState({
				currentQuestions: {
					...state.currentQuestions,
					questions: updatedQuestions
				},
				answerChanges: {
					...state.answerChanges,
					[newAnswerId]: {
						action: 'add',
						questionId: questionId,
						label: newAnswer.label,
						sort_order: newAnswer.sort_order,
						secondary_input_type: newAnswer.secondary_input_type,
						mutually_exclusive: newAnswer.mutually_exclusive,
						tooltip: newAnswer.tooltip,
						triggered_questions: newAnswer.triggered_questions,
						// Additional fields needed for backend API
						alternative_wording: 'string',
						custom_attributes: {},
						required: false,
						guideline_template_id: state.currentAssessmentId,
						question_id: questionId // Real question ID (may be temp for new questions)
					}
				}
			});
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
			console.log('Assessment structure:', state.currentAssessment);
			console.log('Assessment IDs:', state.currentAssessment.ids);
			console.log('Assessment id:', state.currentAssessment.id);
			
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
			
			// Calculate next sort_order
			const existingSubsections = parentSection.subsections || [];
			const nextSortOrder = Math.max(...existingSubsections.map(s => s.sort_order || 0), 0) + 1;
			
			// Create a new section object with temporary ID
			const newSectionId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
			const newSection = {
				id: newSectionId,
				label: 'New Section',
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
			const {action, updateState, state} = coeffects;
			const {sectionId, sectionLabel} = action.payload;
			
			console.log('Saving section name:', sectionLabel);
			
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
				sectionChanges: {
					...state.sectionChanges,
					[sectionId]: {
						...state.sectionChanges[sectionId],
						label: sectionLabel
					}
				}
			});
		},

		'CANCEL_SECTION_EDIT': (coeffects) => {
			const {updateState} = coeffects;
			
			updateState({
				editingSectionId: null,
				editingSectionName: null
			});
		},

		'DELETE_SECTION': (coeffects) => {
			const {action, updateState, state} = coeffects;
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
					selectedSectionLabel: state.selectedSection === sectionId ? null : state.selectedSectionLabel,
					sectionChanges: {
						...state.sectionChanges,
						[sectionId]: {
							deleted: true
						}
					}
				});
			}
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
			const {action, updateState, state, dispatch} = coeffects;
			console.log('Section deleted successfully:', action.payload);
			
			// Store the current section to re-select after refresh (if not the deleted one)
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			// Clear ALL changes since we're doing a full refresh
			updateState({
				sectionChanges: {},
				questionChanges: {},
				answerChanges: {},
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Section deleted successfully! Refreshing data...',
						timestamp: new Date().toISOString()
					}
				]
			});
			
			// Refresh the entire assessment from server
			console.log('Refreshing entire assessment from server after delete');
			console.log('- Will re-select section (if still exists):', currentSection, currentSectionLabel);
			
			if (state.currentAssessment?.ids?.id) {
				// Store section to re-select in state temporarily (if it still exists)
				updateState({
					pendingReselectionSection: currentSection,
					pendingReselectionSectionLabel: currentSectionLabel
				});
				
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessment.ids.id,
					assessmentTitle: state.currentAssessment.title
				});
			}
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
			const {action, updateState, state} = coeffects;
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
				
				// Track which sections had their sort_order changed
				const reorderedSection = updatedSections.find(section => 
					section.subsections?.some(sub => sub.id === draggingSection || sub.id === targetSectionId)
				);
				
				const newSectionChanges = {...state.sectionChanges};
				if (reorderedSection && reorderedSection.subsections) {
					reorderedSection.subsections.forEach(subsection => {
						// Store complete section data for all reordered sections
						newSectionChanges[subsection.id] = {
							label: subsection.label,
							tooltip: subsection.tooltip || '',
							alternative_wording: subsection.alternative_wording || '',
							required: subsection.required || false,
							custom_attributes: subsection.custom_attributes || {},
							sort_order: subsection.sort_order
						};
					});
				}
				
				updateState({
					currentAssessment: {
						...state.currentAssessment,
						sections: updatedSections
					},
					sectionChanges: newSectionChanges,
					draggingSection: null,
					dragOverSection: null,
					draggingSectionIndex: null
				});
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
				
				// Update the question in the current questions data
				const updatedQuestions = {
					...state.currentQuestions,
					questions: state.currentQuestions.questions.map(question =>
						question.ids.id === questionId
							? {...question, tooltip: newTooltip}
							: question
					)
				};
				
				updateState({
					currentQuestions: updatedQuestions,
					editingTooltip: null,
					editingTooltipText: null,
					editingTooltipQuestionId: null,
					editingTooltipAnswerId: null,
					// Track question changes for save functionality
					questionChanges: {
						...state.questionChanges,
						[questionId]: {
							...(state.questionChanges[questionId] || {}),
							tooltip: newTooltip
						}
					}
				});
			} else if (answerId) {
				console.log('Saving tooltip for answer:', answerId, 'New tooltip:', newTooltip);
				
				// Update the answer in the current questions data
				const updatedQuestions = {
					...state.currentQuestions,
					questions: state.currentQuestions.questions.map(question => ({
						...question,
						answers: question.answers?.map(answer =>
							answer.ids.id === answerId
								? {...answer, tooltip: newTooltip}
								: answer
						) || []
					}))
				};
				
				updateState({
					currentQuestions: updatedQuestions,
					editingTooltip: null,
					editingTooltipText: null,
					editingTooltipQuestionId: null,
					editingTooltipAnswerId: null,
					// Track answer changes for save functionality
					answerChanges: {
						...state.answerChanges,
						[answerId]: {
							...(state.answerChanges[answerId] || {}),
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
			
			// Update the answer in the current questions data
			const updatedQuestions = {
				...state.currentQuestions,
				questions: state.currentQuestions.questions.map(question => ({
					...question,
					answers: question.answers?.map(answer =>
						answer.ids.id === answerId
							? {...answer, label: newLabel}
							: answer
					) || []
				}))
			};
			
			updateState({
				currentQuestions: updatedQuestions
			});
		},

		'UPDATE_ANSWER_SECONDARY_INPUT': (coeffects) => {
			const {action, updateState, state} = coeffects;
			const {answerId, newSecondaryInputType} = action.payload;
			
			console.log('Updating answer secondary input:', answerId, 'New type:', newSecondaryInputType);
			
			// Update the answer in the current questions data
			const updatedQuestions = {
				...state.currentQuestions,
				questions: state.currentQuestions.questions.map(question => ({
					...question,
					answers: question.answers?.map(answer =>
						answer.ids.id === answerId
							? {...answer, secondary_input_type: newSecondaryInputType}
							: answer
					) || []
				}))
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
			
			console.log('Saving all changes to backend');
			console.log('Section changes:', state.sectionChanges);
			console.log('Question changes:', state.questionChanges);
			console.log('Answer changes:', state.answerChanges);
			
			// Check what needs to be saved
			const sectionChanges = Object.keys(state.sectionChanges || {});
			const questionChanges = Object.keys(state.questionChanges || {});
			const answerChanges = Object.keys(state.answerChanges || {});
			
			const hasChanges = sectionChanges.length > 0 || questionChanges.length > 0 || answerChanges.length > 0;
			
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
					}
					// TODO: Handle question updates and deletions
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
					}
					// TODO: Handle answer updates and deletions
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
					label: sectionData.label || 'New Section',
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
			
			// Prepare request body following the established pattern (direct fields, no data wrapper)
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

		'MAKE_ADD_QUESTION_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-question', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_QUESTION_SUCCESS',
			errorActionType: 'ADD_QUESTION_ERROR'
		}),

		'ADD_QUESTION_SUCCESS': (coeffects) => {
			const {action, updateState, state, dispatch} = coeffects;
			console.log('Question added successfully:', action.payload);
			
			// Log the question UUID to console
			if (action.payload && action.payload.id) {
				console.log('=== QUESTION CREATED SUCCESSFULLY ===');
				console.log('New Question UUID:', action.payload.id);
				console.log('=====================================');
			}
			
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Question created successfully! Refreshing data...',
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

		'MAKE_ADD_ANSWER_REQUEST': createHttpEffect('/api/x_cadal_careiq_b_0/careiq_api/add-answer', {
			method: 'POST',
			dataParam: 'requestBody',
			headers: {
				'Content-Type': 'application/json'
			},
			successActionType: 'ADD_ANSWER_SUCCESS',
			errorActionType: 'ADD_ANSWER_ERROR'
		}),

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
			const {action, updateState, state, dispatch} = coeffects;
			console.log('Section update success:', action.payload);
			console.log('Section update action meta:', action.meta);
			
			// Store the current section to re-select after refresh
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			// Clear ALL changes since we're doing a full refresh
			updateState({
				sectionChanges: {},
				questionChanges: {},
				answerChanges: {},
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Changes saved successfully! Refreshing data...',
						timestamp: new Date().toISOString()
					}
				]
			});
			
			// Refresh the entire assessment from server
			console.log('Refreshing entire assessment from server after save');
			console.log('- Will re-select section:', currentSection, currentSectionLabel);
			
			if (state.currentAssessment?.ids?.id) {
				// Store section to re-select in state temporarily
				updateState({
					pendingReselectionSection: currentSection,
					pendingReselectionSectionLabel: currentSectionLabel
				});
				
				dispatch('FETCH_ASSESSMENT_DETAILS', {
					assessmentId: state.currentAssessment.ids.id,
					assessmentTitle: state.currentAssessment.title
				});
			}
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
			
			// Store the current section to re-select after refresh
			const currentSection = state.selectedSection;
			const currentSectionLabel = state.selectedSectionLabel;
			
			updateState({
				systemMessages: [
					...(state.systemMessages || []),
					{
						type: 'success',
						message: 'Section added successfully',
						timestamp: new Date().toISOString()
					}
				]
			});
			
			// Refresh the assessment data to get the updated sections
			const assessmentId = state.currentAssessmentId;
			console.log('ADD_SECTION_SUCCESS - currentAssessment:', state.currentAssessment);
			console.log('ADD_SECTION_SUCCESS - assessmentId from stored ID:', assessmentId);
			
			dispatch('FETCH_ASSESSMENT_DETAILS', {
				assessmentId: assessmentId,
				assessmentTitle: state.currentAssessment.title
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

	},
	reducers: {}
});