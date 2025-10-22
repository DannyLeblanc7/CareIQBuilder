// Utility functions for CareIQ Builder Component

// Group assessments by master_id
export const groupAssessmentsByMasterId = (assessments) => {
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
export const paginateAssessments = (assessments, currentPage, pageSize) => {
	if (!assessments || assessments.length === 0) return [];

	const startIndex = currentPage * pageSize;
	const endIndex = startIndex + pageSize;

	return assessments.slice(startIndex, endIndex);
};

// Load CareIQ config using dispatch action
export const loadCareIQConfig = (dispatch) => {
	dispatch('LOAD_CAREIQ_CONFIG');
};

// Check if answer has any relationships
export const hasRelationships = (counts) => {
	if (!counts) return false;

	return (counts.triggered_guidelines > 0) ||
		   (counts.problems > 0) ||
		   (counts.triggered_questions > 0) ||
		   (counts.evidence > 0) ||
		   (counts.barriers > 0);
};

// Calculate which questions should be visible based on selected answers and their relationships
export const calculateVisibleQuestions = (selectedAnswers, currentQuestions, answerRelationships = {}) => {
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

	// Add questions that should be shown based on triggered_questions relationships
	// CRITICAL: Check BOTH the answer's triggered_questions array AND the answerRelationships
	// This ensures we don't miss triggers from either source
	Object.keys(selectedAnswers).forEach(questionId => {
		const selectedAnswerIds = selectedAnswers[questionId];
		selectedAnswerIds.forEach(answerId => {
			// Find the answer in the questions using correct UUID paths
			const question = currentQuestions.find(q => q.ids.id === questionId);
			const answer = question?.answers?.find(a => a.ids.id === answerId);

			// Check if the answer has triggered_questions in the section data
			if (answer?.triggered_questions && Array.isArray(answer.triggered_questions)) {
				answer.triggered_questions.forEach(triggeredQuestionId => {
					if (!visibleQuestions.includes(triggeredQuestionId)) {
						visibleQuestions.push(triggeredQuestionId);
					}
				});
			}

			// ALSO check if we have relationship data for this answer
			// Use 'if' instead of 'else if' to check BOTH sources
			if (answerRelationships[answerId] && answerRelationships[answerId].questions?.questions?.length > 0) {
				answerRelationships[answerId].questions.questions.forEach(triggeredQuestion => {
					if (!visibleQuestions.includes(triggeredQuestion.id)) {
						visibleQuestions.push(triggeredQuestion.id);
					}
				});
			}
		});
	});

	// CRITICAL: Remove triggered questions whose parent question is no longer visible
	// This handles cascading visibility: if Q1-A1 triggers Q2, and Q2-A1 triggers Q3,
	// then deselecting Q1-A1 should hide both Q2 AND Q3
	let changed = true;
	while (changed) {
		changed = false;
		const questionsToRemove = [];

		visibleQuestions.forEach(questionId => {
			const question = currentQuestions.find(q => q.ids.id === questionId);

			// Check if this question was triggered by an answer
			// We need to verify that the triggering question is still visible
			let hasVisibleTrigger = false;

			// If question is not hidden by default, it's always visible
			if (question && !question.hidden) {
				hasVisibleTrigger = true;
			} else {
				// Check all selected answers to see if any of them trigger this question
				Object.keys(selectedAnswers).forEach(parentQuestionId => {
					// Only count triggers from visible questions
					if (visibleQuestions.includes(parentQuestionId)) {
						const selectedAnswerIds = selectedAnswers[parentQuestionId];
						selectedAnswerIds.forEach(answerId => {
							const parentQuestion = currentQuestions.find(q => q.ids.id === parentQuestionId);
							const answer = parentQuestion?.answers?.find(a => a.ids.id === answerId);

							// Check triggered_questions array
							if (answer?.triggered_questions && answer.triggered_questions.includes(questionId)) {
								hasVisibleTrigger = true;
							}

							// Check answerRelationships
							if (answerRelationships[answerId]?.questions?.questions?.some(tq => tq.id === questionId)) {
								hasVisibleTrigger = true;
							}
						});
					}
				});
			}

			// If no visible trigger found, mark for removal
			if (!hasVisibleTrigger && question?.hidden) {
				questionsToRemove.push(questionId);
				changed = true;
			}
		});

		// Remove questions without visible triggers
		questionsToRemove.forEach(questionId => {
			const index = visibleQuestions.indexOf(questionId);
			if (index > -1) {
				visibleQuestions.splice(index, 1);
			}
		});
	}

	return visibleQuestions;
};