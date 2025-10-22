// HTTP Effects for CareIQ Builder Component
import {createHttpEffect} from '@servicenow/ui-effect-http';

// Common headers for most requests
const defaultHeaders = {
	'Content-Type': 'application/json'
};

// System configuration effects - Only fetch region, version, app (no credentials)
export const LOAD_CAREIQ_CONFIG = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-careiq-config', {
	method: 'GET',
	startActionType: 'CAREIQ_CONFIG_FETCH_START',
	successActionType: 'CAREIQ_CONFIG_FETCH_SUCCESS',
	errorActionType: 'CAREIQ_CONFIG_FETCH_ERROR'
});

// Category and Assessment Management effects
export const MAKE_USE_CASE_CATEGORIES_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/use-case-categories', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'USE_CASE_CATEGORIES_FETCH_START',
	successActionType: 'USE_CASE_CATEGORIES_SUCCESS',
	errorActionType: 'USE_CASE_CATEGORIES_ERROR'
});

export const MAKE_ASSESSMENTS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-assessments', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ASSESSMENTS_FETCH_START',
	successActionType: 'ASSESSMENTS_SUCCESS',
	errorActionType: 'ASSESSMENTS_ERROR'
});

// Assessment CRUD effects
export const MAKE_CREATE_ASSESSMENT_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/create-assessment', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'CREATE_ASSESSMENT_START',
	successActionType: 'CREATE_ASSESSMENT_SUCCESS',
	errorActionType: 'CREATE_ASSESSMENT_ERROR'
});

export const MAKE_CREATE_VERSION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/create-version', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'CREATE_VERSION_START',
	successActionType: 'CREATE_VERSION_SUCCESS',
	errorActionType: 'CREATE_VERSION_ERROR'
});

export const MAKE_UPDATE_ASSESSMENT_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-assessment', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'UPDATE_ASSESSMENT_START',
	successActionType: 'UPDATE_ASSESSMENT_SUCCESS',
	errorActionType: 'UPDATE_ASSESSMENT_ERROR'
});

export const MAKE_PUBLISH_ASSESSMENT_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/publish-assessment', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'PUBLISH_ASSESSMENT_START',
	successActionType: 'PUBLISH_ASSESSMENT_SUCCESS',
	errorActionType: 'PUBLISH_ASSESSMENT_ERROR'
});

export const MAKE_UNPUBLISH_ASSESSMENT_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/unpublish-assessment', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'UNPUBLISH_ASSESSMENT_START',
	successActionType: 'UNPUBLISH_ASSESSMENT_SUCCESS',
	errorActionType: 'UNPUBLISH_ASSESSMENT_ERROR'
});

// Assessment details and sections
export const MAKE_ASSESSMENT_DETAILS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-sections', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ASSESSMENT_DETAILS_START',
	successActionType: 'ASSESSMENT_DETAILS_SUCCESS',
	errorActionType: 'ASSESSMENT_DETAILS_ERROR'
});

export const MAKE_SECTION_QUESTIONS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-section-questions', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'SECTION_QUESTIONS_START',
	successActionType: 'SECTION_QUESTIONS_SUCCESS',
	errorActionType: 'SECTION_QUESTIONS_ERROR'
});

export const MAKE_SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-section-questions', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_START',
	successActionType: 'SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_SUCCESS',
	errorActionType: 'SECTION_QUESTIONS_FOR_DUPLICATE_CHECK_ERROR'
});

export const MAKE_DELETE_SECTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-section', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_SECTION_START',
	successActionType: 'DELETE_SECTION_SUCCESS',
	errorActionType: 'DELETE_SECTION_ERROR'
});

export const MAKE_SECTION_UPDATE_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-section', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'SECTION_UPDATE_START',
	successActionType: 'SECTION_UPDATE_SUCCESS',
	errorActionType: 'SECTION_UPDATE_ERROR'
});

export const MAKE_ADD_SECTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-section', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_SECTION_START',
	successActionType: 'ADD_SECTION_SUCCESS',
	errorActionType: 'ADD_SECTION_ERROR'
});

// Question CRUD effects
export const MAKE_UPDATE_QUESTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-question', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'UPDATE_QUESTION_START',
	successActionType: 'UPDATE_QUESTION_SUCCESS',
	errorActionType: 'UPDATE_QUESTION_ERROR'
});

export const MAKE_ADD_QUESTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-question', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_QUESTION_START',
	successActionType: 'ADD_QUESTION_SUCCESS',
	errorActionType: 'ADD_QUESTION_ERROR'
});

export const MAKE_ADD_QUESTION_TO_SECTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-question-to-section', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_QUESTION_TO_SECTION_START',
	successActionType: 'ADD_QUESTION_TO_SECTION_SUCCESS',
	errorActionType: 'ADD_QUESTION_TO_SECTION_ERROR'
});

export const MAKE_DELETE_QUESTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-question', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_QUESTION_START',
	successActionType: 'DELETE_QUESTION_SUCCESS',
	errorActionType: 'DELETE_QUESTION_ERROR'
});

// Answer CRUD effects
export const MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-answers-to-question', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_ANSWERS_TO_QUESTION_START',
	successActionType: 'ADD_ANSWERS_TO_QUESTION_SUCCESS',
	errorActionType: 'ADD_ANSWERS_TO_QUESTION_ERROR'
});

export const MAKE_ADD_ANSWER_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-answer', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_ANSWER_START',
	successActionType: 'ADD_ANSWER_SUCCESS',
	errorActionType: 'ADD_ANSWER_ERROR'
});

export const MAKE_DELETE_ANSWER_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-answer', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_ANSWER_START',
	successActionType: 'DELETE_ANSWER_SUCCESS',
	errorActionType: 'DELETE_ANSWER_ERROR'
});

export const MAKE_UPDATE_ANSWER_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-answer', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'UPDATE_ANSWER_START',
	successActionType: 'UPDATE_ANSWER_SUCCESS',
	errorActionType: 'UPDATE_ANSWER_ERROR'
});

// Relationship effects
export const MAKE_ANSWER_RELATIONSHIPS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/answer-relationships', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ANSWER_RELATIONSHIPS_START',
	successActionType: 'ANSWER_RELATIONSHIPS_SUCCESS',
	errorActionType: 'ANSWER_RELATIONSHIPS_ERROR'
});

export const MAKE_ADD_BRANCH_QUESTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-branch-question', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_BRANCH_QUESTION_START',
	successActionType: 'ADD_BRANCH_QUESTION_SUCCESS',
	errorActionType: 'ADD_BRANCH_QUESTION_ERROR'
});

export const MAKE_DELETE_BRANCH_QUESTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-branch-question', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_BRANCH_QUESTION_START',
	successActionType: 'DELETE_BRANCH_QUESTION_SUCCESS',
	errorActionType: 'DELETE_BRANCH_QUESTION_ERROR'
});

export const MAKE_ADD_GUIDELINE_RELATIONSHIP_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-guideline-relationship', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_GUIDELINE_RELATIONSHIP_START',
	successActionType: 'ADD_GUIDELINE_RELATIONSHIP_SUCCESS',
	errorActionType: 'ADD_GUIDELINE_RELATIONSHIP_ERROR'
});

export const MAKE_DELETE_GUIDELINE_RELATIONSHIP_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-guideline-relationship', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_GUIDELINE_RELATIONSHIP_START',
	successActionType: 'DELETE_GUIDELINE_RELATIONSHIP_SUCCESS',
	errorActionType: 'DELETE_GUIDELINE_RELATIONSHIP_ERROR'
});

// Barrier relationship effects
export const MAKE_ADD_BARRIER_RELATIONSHIP_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-barrier-relationship', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_BARRIER_RELATIONSHIP_START',
	successActionType: 'ADD_BARRIER_RELATIONSHIP_SUCCESS',
	errorActionType: 'ADD_BARRIER_RELATIONSHIP_ERROR'
});

export const MAKE_DELETE_BARRIER_RELATIONSHIP_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-barrier-relationship', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_BARRIER_RELATIONSHIP_START',
	successActionType: 'DELETE_BARRIER_RELATIONSHIP_SUCCESS',
	errorActionType: 'DELETE_BARRIER_RELATIONSHIP_ERROR'
});

// Problem-Goal-Intervention (PGI) effects
export const MAKE_ADD_PROBLEM_RELATIONSHIP_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-problem-relationship', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_PROBLEM_RELATIONSHIP_START',
	successActionType: 'ADD_PROBLEM_RELATIONSHIP_SUCCESS',
	errorActionType: 'ADD_PROBLEM_RELATIONSHIP_ERROR'
});

export const MAKE_DELETE_PROBLEM_RELATIONSHIP_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-problem-relationship', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_PROBLEM_RELATIONSHIP_START',
	successActionType: 'DELETE_PROBLEM_RELATIONSHIP_SUCCESS',
	errorActionType: 'DELETE_PROBLEM_RELATIONSHIP_ERROR'
});

export const MAKE_SAVE_PROBLEM_EDITS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/save-problem-edits', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'SAVE_PROBLEM_EDITS_START',
	successActionType: 'SAVE_PROBLEM_EDITS_SUCCESS',
	errorActionType: 'SAVE_PROBLEM_EDITS_ERROR'
});

export const MAKE_GET_PROBLEM_DETAILS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-problem-details', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'GET_PROBLEM_DETAILS_START',
	successActionType: 'GET_PROBLEM_DETAILS_SUCCESS',
	errorActionType: 'GET_PROBLEM_DETAILS_ERROR'
});

export const MAKE_LOAD_PROBLEM_GOALS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-problem-goals', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'LOAD_PROBLEM_GOALS_START',
	successActionType: 'LOAD_PROBLEM_GOALS_SUCCESS',
	errorActionType: 'LOAD_PROBLEM_GOALS_ERROR'
});

export const MAKE_ADD_GOAL_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-goal', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_GOAL_START',
	successActionType: 'ADD_GOAL_SUCCESS',
	errorActionType: 'ADD_GOAL_ERROR'
});

export const MAKE_DELETE_GOAL_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-goal', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_GOAL_START',
	successActionType: 'DELETE_GOAL_SUCCESS',
	errorActionType: 'DELETE_GOAL_ERROR'
});

export const MAKE_GET_GOAL_DETAILS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-goal-details', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'GET_GOAL_DETAILS_START',
	successActionType: 'GET_GOAL_DETAILS_SUCCESS',
	errorActionType: 'GET_GOAL_DETAILS_ERROR'
});

export const MAKE_UPDATE_GOAL_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-goal', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'UPDATE_GOAL_START',
	successActionType: 'UPDATE_GOAL_SUCCESS',
	errorActionType: 'UPDATE_GOAL_ERROR'
});

export const MAKE_LOAD_GOAL_INTERVENTIONS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-goal-interventions', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'LOAD_GOAL_INTERVENTIONS_START',
	successActionType: 'LOAD_GOAL_INTERVENTIONS_SUCCESS',
	errorActionType: 'LOAD_GOAL_INTERVENTIONS_ERROR'
});

export const MAKE_ADD_INTERVENTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/add-intervention', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'ADD_INTERVENTION_START',
	successActionType: 'ADD_INTERVENTION_SUCCESS',
	errorActionType: 'ADD_INTERVENTION_ERROR'
});

export const MAKE_DELETE_INTERVENTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-intervention', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_INTERVENTION_START',
	successActionType: 'DELETE_INTERVENTION_SUCCESS',
	errorActionType: 'DELETE_INTERVENTION_ERROR'
});

export const MAKE_GET_INTERVENTION_DETAILS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-intervention-details', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'GET_INTERVENTION_DETAILS_START',
	successActionType: 'GET_INTERVENTION_DETAILS_SUCCESS',
	errorActionType: 'GET_INTERVENTION_DETAILS_ERROR'
});

export const MAKE_UPDATE_INTERVENTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/update-intervention', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'UPDATE_INTERVENTION_START',
	successActionType: 'UPDATE_INTERVENTION_SUCCESS',
	errorActionType: 'UPDATE_INTERVENTION_ERROR'
});

// Scoring model effects
export const MAKE_CREATE_SCORING_MODEL_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/create-scoring-model', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'CREATE_SCORING_MODEL_START',
	successActionType: 'CREATE_SCORING_MODEL_SUCCESS',
	errorActionType: 'CREATE_SCORING_MODEL_ERROR'
});

export const MAKE_GET_SCORING_MODELS_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-scoring-models', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'GET_SCORING_MODELS_START',
	successActionType: 'GET_SCORING_MODELS_SUCCESS',
	errorActionType: 'GET_SCORING_MODELS_ERROR'
});

export const MAKE_DELETE_SCORING_MODEL_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/delete-scoring-model', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'DELETE_SCORING_MODEL_START',
	successActionType: 'DELETE_SCORING_MODEL_SUCCESS',
	errorActionType: 'DELETE_SCORING_MODEL_ERROR'
});

export const MAKE_SAVE_SCORING_MODEL_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/save-scoring-model', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'SAVE_SCORING_MODEL_START',
	successActionType: 'SAVE_SCORING_MODEL_SUCCESS',
	errorActionType: 'SAVE_SCORING_MODEL_ERROR'
});

// Search and typeahead effects
export const MAKE_GENERIC_TYPEAHEAD_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/generic-typeahead', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'GENERIC_TYPEAHEAD_START',
	successActionType: 'GENERIC_TYPEAHEAD_SUCCESS',
	errorActionType: 'GENERIC_TYPEAHEAD_ERROR'
});

export const MAKE_GUIDELINE_SEARCH_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/guideline-typeahead', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'GUIDELINE_SEARCH_START',
	successActionType: 'GUIDELINE_SEARCH_SUCCESS',
	errorActionType: 'GUIDELINE_SEARCH_ERROR'
});

export const MAKE_LIBRARY_QUESTION_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/get-library-question', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'LIBRARY_QUESTION_START',
	successActionType: 'LIBRARY_QUESTION_SUCCESS',
	errorActionType: 'LIBRARY_QUESTION_ERROR'
});

export const MAKE_LIBRARY_ANSWER_REQUEST = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/library-answer-details', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'LIBRARY_ANSWER_START',
	successActionType: 'LIBRARY_ANSWER_SUCCESS',
	errorActionType: 'LIBRARY_ANSWER_ERROR'
});

export const SECTION_TYPEAHEAD_SEARCH = createHttpEffect('/api/x_1628056_careiq/careiq_builder_api/generic-typeahead', {
	method: 'POST',
	dataParam: 'requestBody',
	headers: defaultHeaders,
	startActionType: 'SECTION_TYPEAHEAD_START',
	successActionType: 'SECTION_TYPEAHEAD_SUCCESS',
	errorActionType: 'SECTION_TYPEAHEAD_ERROR'
});