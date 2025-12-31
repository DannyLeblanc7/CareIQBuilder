# CareIQ Builder - Complete Architecture Documentation

**Version:** 1.0.112
**Last Updated:** 2025-12-09
**Component:** `cadal-careiq-builder`
**Framework:** ServiceNow UI Core with Snabbdom Renderer

---

## Table of Contents

1. [Overview](#overview)
2. [File Structure](#file-structure)
3. [Component Entry Point](#component-entry-point)
4. [Imports and Dependencies](#imports-and-dependencies)
5. [View Function and UI Components](#view-function-and-ui-components)
6. [Initial State](#initial-state)
7. [Action Handlers](#action-handlers)
   - [Bootstrap and Configuration](#bootstrap-and-configuration)
   - [Assessment Management](#assessment-management)
   - [Assessment Builder](#assessment-builder)
   - [Section CRUD Operations](#section-crud-operations)
   - [Question CRUD Operations](#question-crud-operations)
   - [Answer CRUD Operations](#answer-crud-operations)
   - [Problem-Goal-Intervention (PGI)](#problem-goal-intervention-pgi)
   - [Scoring Models](#scoring-models)
   - [Typeahead and Search](#typeahead-and-search)
8. [HTTP Effects](#http-effects)
9. [Server-Side Integration](#server-side-integration)
10. [Critical Patterns](#critical-patterns)

---

## Overview

The CareIQ Builder is a comprehensive ServiceNow UI component (22,991 lines) that provides a full-featured assessment authoring environment. It integrates with the CareIQ platform for healthcare assessment management, allowing users to:

- Browse and search assessments
- Create new assessments and versions
- Build assessment structure (sections, questions, answers)
- Link assessment responses to clinical content (Problems, Goals, Interventions)
- Configure scoring models
- Preview assessments as end-users would see them

**Key Metrics:**
- **303+ action handlers** for state management
- **229 state properties** tracking UI and data
- **50+ HTTP effects** for API communication
- **75+ server-side Scripted REST API** endpoints

**Architecture Pattern:**
- **Local-change-then-save**: All edits update local state immediately; backend calls only on explicit save
- **Change tracking**: Separate state objects track unsaved modifications
- **State-based refresh**: After saves, assessment data reloads from backend

---

## File Structure

```
src/cadal-careiq-builder/
├── index.js              (22,991 lines) - Main component
├── effects.js            (483 lines) - HTTP effect definitions
├── core-actions.js       (51 lines) - Mobile view and panel toggles
├── config-actions.js     (131 lines) - Configuration loading
├── utils.js              (158 lines) - Utility functions
├── styles.scss           (4,974 lines) - Component styling
└── __tests__/
    └── index.js          - Test suite

Root Server-Side Files:
├── CareIQ Services.js    (2,489 lines) - Main Script Include
├── Delta CareIQ Services.js - Additional service methods
└── 75+ Scripted REST API files (one per endpoint)
```

---

## Component Entry Point

**File:** `src/cadal-careiq-builder/index.js`
**Lines:** 22,991

The component is registered using ServiceNow's `createCustomElement` API at the bottom of the file:

```javascript
createCustomElement('cadal-careiq-builder', {
    renderer: {type: snabbdom},
    view,                      // Main render function
    styles,                    // SCSS styles
    initialState: {...},       // 229 properties
    actionHandlers: {...}      // 303+ action handlers
});
```

---

## Imports and Dependencies

**Lines:** 0-16

```javascript
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
```

**Key Dependencies:**
- `@servicenow/ui-core` - ServiceNow Next Experience framework
- `@servicenow/ui-renderer-snabbdom` - Virtual DOM renderer
- `@servicenow/ui-effect-http` - HTTP effect creation
- Custom utility modules for assessment grouping, pagination, config loading

---

## View Function and UI Components

**Lines:** 19-8794

The view function is a massive JSX function that renders the entire UI. It includes inline component definitions for reusability.

### Reusable Icon Components

**Lines:** 21-53

```javascript
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
```

**Purpose:**
- CheckIcon: Used for checkboxes, success indicators, confirmation buttons
- XIcon: Used for close buttons, delete actions, cancel operations
- SpinnerIcon: Animated loading indicator with configurable size

### LoadingOverlay Component

**Lines:** 55-104

```javascript
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
```

**Purpose:**
- Display loading state during async operations
- Two modes: `isModal` for full-screen blocking overlays, or local overlays for specific sections
- Prevents user interaction during critical operations (question moves, version creation)

**Used by:**
- `state.movingQuestion` - Moving questions between sections
- `state.creatingVersion` - Creating assessment versions
- `state.publishingAssessment` - Publishing assessments

### ConfirmationModal Component

**Lines:** 106-184

```javascript
// Confirmation Modal Component - reusable confirmation dialog
const ConfirmationModal = ({message, onConfirm, onCancel, confirmText = "Confirm", cancelText = "Cancel"}) => (
    <div
        style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 999999,
            pointerEvents: "auto"
        }}
        onclick={(e) => {
            e.stopPropagation();
            e.preventDefault();
        }}
    >
        <div style={{
            backgroundColor: "#fff",
            padding: "24px",
            borderRadius: "12px",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            minWidth: "400px",
            maxWidth: "500px"
        }}>
            <div style={{
                fontSize: "16px",
                color: "#111827",
                lineHeight: "1.5"
            }}>
                {message}
            </div>
            <div style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end"
            }}>
                <button
                    onclick={onCancel}
                    style={{
                        padding: "8px 16px",
                        borderRadius: "6px",
                        border: "1px solid #d1d5db",
                        backgroundColor: "#fff",
                        color: "#374151",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer"
                    }}
                >
                    {cancelText}
                </button>
                <button
                    onclick={onConfirm}
                    style={{
                        padding: "8px 16px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: "#dc3545",
                        color: "#fff",
                        fontSize: "14px",
                        fontWeight: "500",
                        cursor: "pointer"
                    }}
                >
                    {confirmText}
                </button>
            </div>
        </div>
    </div>
);
```

**Purpose:**
- Confirm destructive actions (delete section, discard unsaved changes, etc.)
- Customizable message and button text
- Blocks user interaction until confirmed or canceled

**Used by:**
- `state.showSectionEditConfirmation` - Confirm discard section edits
- `state.confirmationDialogOpen` - Generic confirmation dialog with `confirmationDialogMessage` and `confirmationDialogPendingAction`

### Helper Functions

**Lines:** 186-254

```javascript
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

// Check if the currently selected section is a parent section
// Parent sections have a 'subsections' property (even if empty array)
const isParentSection = (state) => {
    if (!state.selectedSection || !state.currentAssessment?.sections) {
        return false;
    }

    // Find the section in the parent sections list
    const section = state.currentAssessment.sections.find(s => s.id === state.selectedSection);

    // If found and has 'subsections' property, it's a parent section
    // This works even for newly created parent sections that don't have subsections yet
    if (section && section.hasOwnProperty('subsections')) {
        return true;
    }

    return false;
};

// Check if the currently selected section is unsaved (not yet persisted to backend)
// Unsaved sections have temp IDs or isNew property
const isUnsavedSection = (state) => {
    if (!state.selectedSection || !state.currentAssessment?.sections) {
        return false;
    }

    const sectionId = state.selectedSection;

    // Quick check: if ID starts with 'temp_', it's definitely unsaved
    if (sectionId.startsWith('temp_')) {
        return true;
    }

    // Find the section - could be a parent section or a child section (subsection)
    let section = state.currentAssessment.sections.find(s => s.id === sectionId);

    // If not found in parent sections, search subsections
    if (!section) {
        for (const parentSection of state.currentAssessment.sections) {
            if (parentSection.subsections) {
                const foundSubsection = parentSection.subsections.find(sub => sub.id === sectionId);
                if (foundSubsection) {
                    section = foundSubsection;
                    break;
                }
            }
        }
    }

    // Check if section has isNew property
    if (section && section.isNew === true) {
        return true;
    }

    return false;
};
```

**Purpose:**
- `hasAnyUnsavedChanges()`: Determines if Save/Cancel buttons should be displayed
- `isParentSection()`: Checks if selected section can have child sections
- `isUnsavedSection()`: Identifies sections not yet persisted (temp IDs or `isNew` flag)

### System Messages Auto-Scroll

**Lines:** 256-262

```javascript
// Auto-scroll system message box to bottom after render
setTimeout(() => {
    const systemWindows = document.querySelectorAll('.careiq-builder .system-window');
    systemWindows.forEach(window => {
        window.scrollTop = window.scrollHeight;
    });
}, 10); // Reduced delay for better responsiveness
```

**Purpose:**
- Automatically scrolls system message log to show most recent messages
- Executes after render to ensure DOM elements exist
- 10ms delay for optimal responsiveness

---

## Initial State

**Lines:** 8795-9022

The initial state contains **229 properties** organized into logical groups:

### Configuration and Authentication

```javascript
loading: true,                    // Initial loading state
error: null,                      // Global error message
careiqConfig: null,               // CareIQ platform configuration
configLoadAttempted: false,       // Track config load attempt
accessToken: null,                // CareIQ platform access token
```

### Assessment List State

```javascript
useCaseCategories: null,          // Available categories (e.g., "Chronic Care")
categoriesLoading: false,         // Loading state for categories
assessments: null,                // All fetched assessments
assessmentsLoading: false,        // Loading state for assessments
assessmentsPagination: {
    total: 0,
    apiOffset: 0,
    apiLimit: 1000,               // Fetch 1000 assessments at a time
    displayPage: 0,
    displayPageSize: 10,          // Show 10 per page in UI
    totalPages: 0
},
searchTerm: '',                   // Search filter text
filteredAssessments: null,        // Assessments after search/MCG filter
expandedAssessments: {},          // Track expanded version rows {assessmentId: boolean}
assessmentVersions: {},           // Cached versions {assessmentId: [versions]}
currentRequest: null,             // Track request context
includeMcgAssessments: false,     // Filter MCG assessments toggle
```

### Assessment Builder State

```javascript
builderView: false,               // true = builder view, false = list view
currentAssessment: null,          // Currently opened assessment data
currentAssessmentId: null,        // Stored assessment ID for API calls
assessmentDetailsLoading: false,  // Loading sections
selectedSection: null,            // Currently selected section ID
selectedSectionLabel: null,       // Section name for display
currentQuestions: null,           // Questions for selected section
questionsLoading: false,          // Loading questions
builderMode: true,                // true = edit mode, false = preview mode
```

### Preview Mode State

```javascript
selectedAnswers: {},              // {questionId: [answerId1, answerId2, ...]}
visibleQuestions: [],             // Questions shown based on selected answers
```

### Answer Relationships State

```javascript
answerRelationships: {},          // {answerId: {problems: [], barriers: [], guidelines: [], questions: []}}
relationshipsLoading: {},         // {answerId: boolean}
```

### UI State

```javascript
systemMessagesCollapsed: true,    // System message history toggle
showRelationships: false,         // Relationship buttons visibility
scoringPanelOpen: false,          // Scoring models side panel
scoringModels: null,              // Array of scoring models
scoringModelsLoading: false,      // Loading scoring models
selectedScoringModel: null,       // Currently editing model
showCreateScoringModel: false,    // Create model form toggle
newScoringModelLabel: '',         // New model label input
creatingScoringModel: false,      // Creating model loading state
isMobileView: false,              // Window size < 1400px
sectionsPanelExpanded: false,     // Mobile sections panel
questionsPanelExpanded: false,    // Mobile questions panel
scoringChanges: {},               // Unsaved score edits {answerId: {modelId: score}}
savingScoringChanges: false,      // Saving scores loading state
pendingScoringChanges: 0,         // Count of pending saves
```

### Relationship Panel State

```javascript
relationshipPanelOpen: false,     // Relationship panel visibility
pgiModalOpen: false,              // PGI preview modal
pgiModalAnswerId: null,           // Answer ID for PGI modal
addingRelationship: null,         // Answer ID being edited
selectedRelationshipType: null,   // 'question', 'problem', 'barrier', 'guideline'
relationshipTypeaheadText: '',    // Search text
relationshipTypeaheadResults: [], // Search results
relationshipTypeaheadLoading: false,
selectedRelationshipQuestion: null, // {id, label}
```

### Question Typeahead State

```javascript
questionTypeaheadResults: [],
questionTypeaheadLoading: false,
questionTypeaheadQuery: '',
questionTypeaheadVisible: false,
questionTypeaheadSelectedIndex: -1,
questionTypeaheadDebounceTimeout: null,
selectedQuestionLibraryId: null,
pendingLibraryQuestionReplacementId: null,
libraryQuestionLoading: null,
```

### New Assessment Modal State

```javascript
newAssessmentModalOpen: false,
newAssessmentForm: {
    guidelineName: '',
    useCaseCategory: 'Chronic Care',
    type: 'Assessment Only',
    contentSource: '',
    codePolicyNumber: '',
    effectiveDate: '',
    endDate: '',
    reviewDate: '',
    nextReviewDate: '',
    responseLogging: 'Use Org Default',
    allowMcgContent: false,
    validationError: null
},
```

### Section Editing State

```javascript
editingSectionId: null,           // Section being edited
editingSectionName: null,         // Section name input
showSectionEditConfirmation: false, // Discard changes confirmation
```

### Question Editing State

```javascript
editingQuestionId: null,          // Question being edited
editingQuestionName: null,        // Question label input
editingQuestion: null,            // {questionId, hasChanges}
originalAssessmentData: null,     // Backup for cancel
pendingReselectionSection: null,  // Section to reselect after save
pendingReselectionSectionLabel: null,
```

### Drag and Drop State

```javascript
draggingSection: null,            // Section being dragged
dragOverSection: null,            // Section being dragged over
draggingSectionIndex: null,       // Original position
```

### Tooltip Editing State

```javascript
editingTooltip: null,             // 'question' or 'answer'
editingTooltipText: null,         // Current tooltip text
editingTooltipOriginalText: null, // Original for comparison
editingTooltipQuestionId: null,   // Question ID
editingTooltipAnswerId: null,     // Answer ID (if answer tooltip)
```

### Section Typeahead State

```javascript
sectionTypeaheadResults: [],
sectionTypeaheadLoading: false,
sectionTypeaheadQuery: '',
sectionTypeaheadVisible: false,
sectionTypeaheadSelectedIndex: -1,
sectionTypeaheadDebounceTimeout: null,
selectedSectionLibraryId: null,
```

### Answer Typeahead State

```javascript
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
```

### Relationship Modal State

```javascript
relationshipModalAnswerId: null,       // Answer being edited
relationshipModalActiveTab: 'guidelines', // Active tab
selectedGuideline: null,               // Selected guideline
selectedQuestion: null,                // Selected question
modalSystemMessages: [],               // Modal-specific messages
modalSystemMessagesCollapsed: true,    // Modal messages toggle
```

### Pre-save Context State

```javascript
preSaveProblemContext: null,           // Prevent duplicate problems
pendingProblemSave: null,              // Pending problem save data
```

### Goal Editing State

```javascript
editingGoalId: null,                   // Goal being edited
editingGoalData: null,                 // Goal data
goalDetailsLoading: null,              // Loading goal details
goalDetailsFallback: null,             // Fallback if API fails
editingGoalProblemId: null,            // Parent problem ID
lastEditedGoalProblemId: null,         // For success handler
```

### Intervention Editing State

```javascript
editingInterventionId: null,           // Intervention being edited
editingInterventionData: null,         // Intervention data
interventionDetailsLoading: null,      // Loading intervention details
interventionDetailsFallback: null,     // Fallback if API fails
editingInterventionGoalId: null,       // Parent goal ID
lastEditedInterventionGoalId: null,    // For success handler
currentInterventionsLoadingGoalId: null, // Track loading
lastDeletedQuestionContext: null,      // Deleted question context
```

### Operation Loading States

**Per-Item Loading Tracking Pattern:**

```javascript
// Section operations
deletingSections: {},     // {sectionId: true}
updatingSections: {},     // {sectionId: true}
addingSection: false,

// Question operations
deletingQuestions: {},    // {questionId: true}
updatingQuestions: {},    // {questionId: true}
addingQuestion: false,
savingQuestions: {},      // {questionId: true}
cancelingQuestions: {},   // {questionId: true}

// Answer operations
deletingAnswers: {},      // {answerId: true}
updatingAnswers: {},      // {answerId: true}
addingAnswer: false,

// Problem operations
deletingProblems: {},     // {problemId: true}
updatingProblems: {},     // {problemId: true}
addingProblem: false,
savingProblem: false,

// Goal operations
deletingGoals: {},        // {goalId: true}
updatingGoals: {},        // {goalId: true}
addingGoal: false,
savingGoals: {},          // {problemId: true}

// Intervention operations
deletingInterventions: {}, // {interventionId: true}
updatingInterventions: {}, // {interventionId: true}
addingIntervention: false,
savingInterventions: {},   // {goalId: true}

// Relationship operations
deletingBranchQuestions: {}, // {questionId: true}
deletingGuidelines: {},      // {guidelineId: true}
deletingBarriers: {},        // {barrierId: true}
addingBranchQuestion: false,
addingGuideline: false,
addingBarrier: false,
```

**Purpose:** Track loading states for individual items to show spinners only on affected items during concurrent operations.

### Confirmation Dialog State

```javascript
confirmationDialogOpen: false,         // Is dialog visible
confirmationDialogMessage: '',         // Message text
confirmationDialogPendingAction: null, // Action to execute on confirm
```

### Long Operation Loading States

```javascript
creatingVersion: false,                // Creating new version
publishingAssessment: false,           // Publishing assessment
```

### Error Context State

```javascript
pendingNewerGtError: null,             // {originalMessage, gtId} for "newer GTs" errors
```

### Toast Notifications State

```javascript
toastNotifications: []                 // [{id, type, message, timestamp}]
```

---

## Action Handlers

**Lines:** 9023-22,991

The component implements **303+ action handlers** organized by feature area. Each handler receives a `coeffects` object containing:

```javascript
{
    action,        // Dispatched action with payload
    state,         // Current component state
    updateState,   // Function to update state
    dispatch       // Function to dispatch new actions
}
```

### Bootstrap and Configuration

#### COMPONENT_BOOTSTRAPPED

**Lines:** 9024-9048

```javascript
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
```

**Purpose:**
- Triggered when component first loads
- Loads CareIQ platform configuration
- Sets up responsive layout listeners (resize, orientation, visibility)
- Uses multiple listener strategies for reliability (ResizeObserver, interval, event listeners)

**Related Actions:**
- `LOAD_CAREIQ_CONFIG` - Fetch platform credentials and settings
- `CHECK_MOBILE_VIEW` - Check if window width < 1400px

---

### Assessment Management

#### FETCH_ASSESSMENTS

**Lines:** 9172-9195

```javascript
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
        latestVersionOnly: latestVersionOnly !== false,
        searchValue: searchValue || ''
    });
    dispatch('MAKE_ASSESSMENTS_REQUEST', {requestBody: requestBody});
},
```

**Purpose:**
- Load assessments from CareIQ platform
- Sets loading state and adds system message
- Constructs request body with pagination and filters
- Dispatches HTTP effect `MAKE_ASSESSMENTS_REQUEST`

**Parameters:**
- `offset`: API pagination offset
- `limit`: Number of assessments to fetch (typically 1000)
- `latestVersionOnly`: Filter to only latest versions
- `searchValue`: Optional search term

#### ASSESSMENTS_SUCCESS

**Lines:** 9071-9130

```javascript
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

        // Client-side filtering: exclude MCG assessments unless checkbox is checked
        const filteredAssessments = state.includeMcgAssessments
            ? sortedAssessments
            : sortedAssessments.filter(a => a.content_source !== 'MCG');

        updateState({
            assessments: sortedAssessments,  // Keep all assessments in state
            assessmentsLoading: false,
            filteredAssessments: filteredAssessments,  // Only show filtered assessments
            assessmentsPagination: {
                ...state.assessmentsPagination,
                total: total,
                apiOffset: offset,
                apiLimit: limit,
                displayPage: 0,
                totalPages: Math.ceil(filteredAssessments.length / state.assessmentsPagination.displayPageSize)
            },
            systemMessages: [
                ...(state.systemMessages || []),
                {
                    type: 'success',
                    message: `Loaded ${filteredAssessments.length} assessments` + (state.includeMcgAssessments ? '' : ' (MCG filtered out)'),
                    timestamp: new Date().toISOString()
                }
            ]
        });
    }
},
```

**Purpose:**
- Handle successful assessment fetch
- Two modes: version fetch (for expanding versions) or normal fetch
- Sorts assessments alphabetically
- Filters MCG assessments based on `includeMcgAssessments` toggle
- Updates pagination state
- Adds success message to system log

**Key Pattern:**
- Uses `state.currentRequest` to differentiate between version fetch and normal fetch
- Maintains both `assessments` (all) and `filteredAssessments` (MCG filtered) in state

#### CREATE_NEW_ASSESSMENT

**Lines:** 9197-9216

```javascript
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
```

**Purpose:**
- Open new assessment modal
- Reset form fields to default values
- Sets default category to 'Chronic Care'

---

### Assessment Builder

#### OPEN_ASSESSMENT_BUILDER

**Purpose:**
- Switch from assessment list view to builder view
- Load assessment details (sections)
- Store assessment ID for future API calls

**Pattern:**
```javascript
updateState({
    builderView: true,
    currentAssessment: assessment,
    currentAssessmentId: assessment.id,  // Store ID separately for API calls
    selectedSection: null,
    currentQuestions: null
});
dispatch('FETCH_ASSESSMENT_DETAILS', {assessmentId: assessment.id});
```

#### TOGGLE_BUILDER_MODE

**Purpose:**
- Switch between edit mode and preview mode
- Preview mode allows selecting answers to see cascading visible questions

**Pattern:**
```javascript
updateState({
    builderMode: !state.builderMode,
    selectedAnswers: {},  // Clear selections when switching
    visibleQuestions: []
});
```

---

### Section CRUD Operations

Sections form the hierarchical structure of assessments. They can be parent sections (containing subsections) or child sections (containing questions).

#### ADD_SECTION

**Lines:** 17688-17735

**Purpose:**
- Add a new parent section to the assessment
- Generate temporary ID
- Calculate next sort_order
- Auto-enter edit mode

**Code:**
```javascript
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
        subsections: [],  // Parent sections have subsections
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
        selectedSection: newSectionId,
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
```

**Key Features:**
- Temporary ID format: `temp_{timestamp}_{random}`
- Auto-increments sort_order
- Adds `subsections: []` property (identifies as parent section)
- Immediately enters edit mode with empty label
- Tracks in `sectionChanges` with `action: 'add'`

#### ADD_CHILD_SECTION

**Lines:** 17737-17807

**Purpose:**
- Add a child section (subsection) to a parent section
- Similar pattern to ADD_SECTION but targets parent's subsections array

**Code:**
```javascript
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
        questions_quantity: 0,  // Child sections have questions, not subsections
        tooltip: '',
        alternative_wording: '',
        required: false,
        custom_attributes: {},
        isNew: true
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
        selectedSection: newSectionId,
        editingSectionId: newSectionId,
        editingSectionName: '',
        sectionChanges: {
            ...state.sectionChanges,
            [newSectionId]: {
                action: 'add',
                ...newSection,
                parent_section_id: parentSectionId,  // Links to parent
                gt_id: state.currentAssessmentId,
                library_id: null
            }
        }
    });
},
```

**Key Difference from Parent Sections:**
- Has `questions_quantity` instead of `subsections`
- Stores `parent_section_id` in change tracking
- Added to parent's subsections array

#### SAVE_SECTION_NAME

**Lines:** 17827-17835

**Purpose:**
- Validate and save section label
- Triggers duplicate check before saving

**Code:**
```javascript
'SAVE_SECTION_NAME': (coeffects) => {
    const {action, updateState, state, dispatch} = coeffects;
    const {sectionId, sectionLabel} = action.payload;
    // First check for exact matches using typeahead API
    dispatch('CHECK_SECTION_DUPLICATE', {
        sectionId,
        sectionLabel
    });
},
```

**Validation Rules:**
- Parent sections: Must be unique across all parents
- Child sections: Must be unique within the same parent only
- Blank labels not allowed

#### DELETE_SECTION

**Lines:** 18303-18317

**Purpose:**
- Confirm and delete section
- Prevents accidental deletion

**Pattern:**
```javascript
'DELETE_SECTION': (coeffects) => {
    const {action, updateState, state} = coeffects;
    const {sectionId, sectionName} = action.payload;

    updateState({
        confirmationDialogOpen: true,
        confirmationDialogMessage: `Are you sure you want to delete section "${sectionName}"?`,
        confirmationDialogPendingAction: {
            type: 'CONFIRM_DELETE_SECTION',
            payload: {sectionId, sectionName}
        }
    });
},
```

**Delete Flow:**
1. User clicks delete → Show confirmation dialog
2. User confirms → Dispatch `CONFIRM_DELETE_SECTION`
3. Dispatch `DELETE_SECTION_API` → Call backend
4. On success → Reload assessment data

---

### Question CRUD Operations

Questions are the core content of assessments. They support multiple types: Text, Date, Numeric, Single Select, and Multiselect.

#### ADD_QUESTION

**Lines:** 11404-11492

**Purpose:**
- Add new question to the selected section
- Generate temporary ID
- Create default answer for select types
- Mark as unsaved immediately

**Code:**
```javascript
'ADD_QUESTION': (coeffects) => {
    const {action, updateState, state} = coeffects;
    const {sectionId} = action.payload;
    if (!state.currentQuestions?.questions) {
        return;
    }

    // CRITICAL: Prevent adding questions to parent sections
    // Parent sections should only contain subsections, not questions
    if (state.currentAssessment?.sections) {
        const section = state.currentAssessment.sections.find(s => s.id === sectionId);
        if (section && section.hasOwnProperty('subsections')) {
            // This is a parent section - don't allow adding questions
            return;
        }
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
        voice: 'Patient', // Set default voice for new questions
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
        answerTypeaheadLoading: false,
        answerTypeaheadVisible: false,
        answerTypeaheadResults: [],
        editingAnswerId: null
    });
},
```

**Critical Features:**
- **Parent section check**: Uses `hasOwnProperty('subsections')` to identify parent sections
- **Temporary IDs**: Questions get `temp_{timestamp}_{random}`, answers get `temp_answer_{timestamp}_{index}`
- **Immediate tracking**: Added to `questionChanges` with `action: 'add'` immediately
- **Default values**: Type = 'Single Select', Voice = 'Patient', one blank answer
- **`isUnsaved` flag**: Set to `true` so Save/Cancel buttons appear immediately

#### UPDATE_QUESTION_TYPE

**Lines:** 11494-11551

**Purpose:**
- Change question type
- Adjust answers based on type (select types need answers, text types don't)

**Code:**
```javascript
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
```

**Type-Specific Logic:**
- **Text/Date/Numeric**: Clear all answers (free-text input)
- **Single Select/Multiselect**: Ensure at least one answer exists

**Action Preservation:**
- Maintains `'add'` action for new questions
- Maintains `'library_replace'` action for library questions
- Changes to `'update'` for existing questions

#### SAVE_QUESTION_IMMEDIATELY

**Lines:** 11943-12192

**Purpose:**
- Validate and save question
- Check for duplicates, blank labels, blank answers
- Handle both new questions (ADD) and existing questions (UPDATE)

**Validation Steps:**

1. **Blank Label Check:**
```javascript
// Validate question label is not blank - check questionChanges first
const currentLabel = state.questionChanges?.[questionId]?.label !== undefined
    ? state.questionChanges?.[questionId]?.label
    : question.label;
if (!currentLabel || currentLabel.trim() === '') {
    updateState({
        systemMessages: [..., {
            type: 'error',
            message: 'Question text cannot be blank. Please enter a question.',
            timestamp: new Date().toISOString()
        }]
    });
    return;
}
```

2. **Duplicate Answer Check:**
```javascript
// Check for duplicate answers within this question
if (question.answers && question.answers.length > 1) {
    const answerLabels = [];
    const duplicates = [];

    question.answers.forEach(answer => {
        const trimmedLabel = answer.label.toLowerCase().trim();
        if (answerLabels.includes(trimmedLabel)) {
            if (!duplicates.includes(answer.label)) {
                duplicates.push(answer.label);
            }
        } else {
            answerLabels.push(trimmedLabel);
        }
    });

    if (duplicates.length > 0) {
        updateState({
            systemMessages: [..., {
                type: 'error',
                message: `Duplicate answer(s) found: "${duplicates.join('", "')}". Each answer must be unique within the question.`,
                timestamp: new Date().toISOString()
            }]
        });
        return;
    }
}
```

3. **Blank Answer Check (Select Types):**
```javascript
// Validate Single Select and Multiselect questions have at least 1 answer with text
if (question.type === 'Single Select' || question.type === 'Multiselect') {
    if (question.answers && question.answers.length > 0) {
        const blankAnswers = question.answers.filter(a =>
            !a.isDeleted && (!a.label || a.label.trim() === '')
        );

        if (blankAnswers.length > 0) {
            updateState({
                questionValidationErrors: {
                    ...(state.questionValidationErrors || {}),
                    [questionId]: 'Answer text cannot be blank. Please enter text for all answers or delete the blank answer.'
                }
            });
            return;
        }
    }
}
```

4. **Minimum Answer Count Check:**
```javascript
// Count active answers (not deleted) that have non-blank labels
const activeAnswersWithText = question.answers?.filter(a => !a.isDeleted && a.label && a.label.trim() !== '') || [];
if (activeAnswersWithText.length === 0) {
    updateState({
        questionValidationErrors: {
            ...(state.questionValidationErrors || {}),
            [questionId]: `${question.type} questions must have at least 1 answer. Please add an answer before saving.`
        }
    });
    return;
}
```

**Save Flow for New Questions:**

```javascript
// Check if this is a temp question (add) or real question (update)
if (questionId.startsWith('temp_')) {
    // PRE-SAVE LIBRARY DETECTION: Check if this matches a library question
    if (!question.isLibraryQuestion) {
        // Search for exact library matches using generic typeahead
        dispatch('GENERIC_TYPEAHEAD_SEARCH', {
            searchText: question.label,
            type: 'question',
            isPreSaveCheck: true  // Flag to identify this as pre-save library check
        });
        return; // Stop normal save process, let the search result handler continue
    }

    // New question - use 2-step process
    if (question.type === 'Text' || question.type === 'Date' || question.type === 'Numeric') {
        // Step 1: Add question to section (no answers needed)
        const currentVoice = state.questionChanges?.[questionId]?.voice || question.voice || 'Patient';
        const currentTooltip = state.questionChanges?.[questionId]?.tooltip !== undefined
            ? state.questionChanges?.[questionId]?.tooltip
            : (question.tooltip || '');
        const currentCustomAttributes = state.questionChanges?.[questionId]?.custom_attributes !== undefined
            ? state.questionChanges?.[questionId]?.custom_attributes
            : (question.custom_attributes || {});

        const questionData = {
            label: state.questionChanges?.[questionId]?.label !== undefined ? state.questionChanges?.[questionId]?.label : question.label,
            type: question.type,
            required: question.required,
            tooltip: currentTooltip,
            voice: currentVoice,
            sort_order: question.sort_order,
            alternative_wording: '',
            custom_attributes: currentCustomAttributes,
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
    }
    // ... (similar logic for Single Select/Multiselect with answers)
}
```

**Critical Pattern - Check questionChanges FIRST:**

The code always checks `state.questionChanges?.[questionId]?.field` before falling back to `question.field`:

```javascript
const currentVoice = state.questionChanges?.[questionId]?.voice || question.voice || 'Patient';
const currentTooltip = state.questionChanges?.[questionId]?.tooltip !== undefined
    ? state.questionChanges?.[questionId]?.tooltip
    : (question.tooltip || '');
```

**Why:** User edits are stored in `questionChanges` first, then synced to the question object. At save time, `questionChanges` has the most recent values.

#### DELETE_QUESTION

**Lines:** 11812-11879

**Purpose:**
- Confirm and delete question
- Shows confirmation dialog to prevent accidental deletion

**Pattern:**
```javascript
'DELETE_QUESTION': (coeffects) => {
    const {action, updateState, state} = coeffects;
    const {questionId, questionLabel} = action.payload;

    updateState({
        confirmationDialogOpen: true,
        confirmationDialogMessage: `Are you sure you want to delete question "${questionLabel}"?`,
        confirmationDialogPendingAction: {
            type: 'CONFIRM_DELETE_QUESTION',
            payload: {questionId}
        }
    });
},

'CONFIRM_DELETE_QUESTION': (coeffects) => {
    const {updateState, state} = coeffects;
    const questionId = state.confirmationDialogPendingAction?.payload?.questionId;

    // Close dialog
    updateState({confirmationDialogOpen: false});

    // Dispatch API call
    dispatch('DELETE_QUESTION_API', { questionId });
},
```

**Delete Flow:**
1. User clicks delete → Show confirmation dialog
2. User confirms → Close dialog and call backend
3. On success → Reload section questions

---

### Answer CRUD Operations

Answers are the response options for Single Select and Multiselect questions. They support features like tooltips, secondary inputs, mutual exclusivity, and branch questions.

#### ADD_ANSWER

**Lines:** 11662-11724

**Purpose:**
- Add new answer to a question
- Generate temporary ID
- Track in answerChanges for save

**Code:**
```javascript
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

    // Track this new answer in answerChanges for save logic
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

    // Clear any validation error for this question when adding an answer
    const updatedValidationErrors = {...(state.questionValidationErrors || {})};
    delete updatedValidationErrors[questionId];

    updateState({
        currentQuestions: {
            ...state.currentQuestions,
            questions: updatedQuestions
        },
        answerChanges: answerChanges, // Track the new answer for save
        questionValidationErrors: updatedValidationErrors // Clear validation error
    });
},
```

**Key Features:**
- **Temporary ID**: Format `temp_answer_{timestamp}_{random}`
- **Immediate tracking**: Added to `answerChanges` with `action: 'add'`
- **Mark question unsaved**: Sets `isUnsaved: true` on parent question
- **Clear validation errors**: Removes validation errors when answer added

#### DELETE_ANSWER

**Lines:** 11726-11811

**Purpose:**
- Delete answer from question
- Smart detection: Unsaved temp answers removed immediately, persisted answers marked for deletion

**Code:**
```javascript
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
        // This is a persisted answer - mark for deletion and hide from UI
        const updatedQuestions = state.currentQuestions.questions.map(question => {
            if (question.ids.id === questionId) {
                return {
                    ...question,
                    answers: question.answers?.map(answer => {
                        if (answer.ids.id === answerId) {
                            return {...answer, isDeleted: true}; // Mark as deleted
                        }
                        return answer;
                    }) || [],
                    isUnsaved: true
                };
            }
            return question;
        });

        // Track the deletion
        const answerChanges = {
            ...state.answerChanges,
            [answerId]: {
                ...(state.answerChanges?.[answerId] || {}),
                action: 'delete',
                question_id: questionId
            }
        };

        updateState({
            currentQuestions: {
                ...state.currentQuestions,
                questions: updatedQuestions
            },
            answerChanges: answerChanges
        });
    }
},
```

**Smart Detection Logic:**
- **Unsaved temp answers** (`temp_` ID + `action: 'add'`): Remove from UI immediately, no backend call
- **Persisted answers**: Mark with `isDeleted: true`, track in `answerChanges` with `action: 'delete'`

**Why:** Prevents unnecessary API calls for answers that were never saved to backend.

#### UPDATE_ANSWER_LABEL

**Lines:** 19285-19329

**Purpose:**
- Update answer text
- Track changes for save

**Pattern:**
```javascript
'UPDATE_ANSWER_LABEL': (coeffects) => {
    const {action, updateState, state} = coeffects;
    const {answerId, newLabel, questionId} = action.payload;

    // Update the answer in UI
    const updatedQuestions = state.currentQuestions.questions.map(question => {
        if (question.ids.id === questionId) {
            return {
                ...question,
                answers: question.answers?.map(answer => {
                    if (answer.ids.id === answerId) {
                        return {...answer, label: newLabel};
                    }
                    return answer;
                }) || [],
                isUnsaved: true
            };
        }
        return question;
    });

    // Track the change
    const existingAnswerChange = state.answerChanges?.[answerId] || {};
    const answerChanges = {
        ...state.answerChanges,
        [answerId]: {
            ...existingAnswerChange,
            action: existingAnswerChange.action === 'add' ? 'add' : 'update',
            label: newLabel,
            questionId: questionId
        }
    };

    updateState({
        currentQuestions: {...state.currentQuestions, questions: updatedQuestions},
        answerChanges: answerChanges
    });
},
```

**Action Preservation:** Maintains `'add'` action for new answers, changes to `'update'` for existing answers.

---

### Problem-Goal-Intervention (PGI) Operations

The PGI system links assessment answers to clinical content: Problems, Goals, and Interventions. This creates a hierarchical relationship structure for care planning.

**Hierarchy:**
```
Answer
  └─ Problems
       └─ Goals
            └─ Interventions
```

#### ADD_PROBLEM_RELATIONSHIP

**Purpose:**
- Link an answer to a problem from the CareIQ content library
- Automatically refreshes relationships and badge counts

**Flow:**
1. User searches for problem using typeahead
2. User selects problem from results
3. Dispatch `ADD_PROBLEM_RELATIONSHIP` with answer ID and problem data
4. Backend creates relationship
5. Success handler refreshes relationships and section questions

#### ADD_PROBLEM_RELATIONSHIP_SUCCESS

**Lines:** 13048-13112

**Purpose:**
- Handle successful problem link
- Surface backend messages (including duplicates)
- Refresh UI data

**Code:**
```javascript
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
```

**Key Features:**
- **Intelligent message classification**: Detects duplicates, errors, warnings from backend `detail` field
- **Dual message display**: Updates both main system messages and modal messages
- **Automatic refresh**: Reloads relationships and section questions to update UI
- **Badge counts**: Section refresh updates problem/goal/intervention count badges

#### DELETE_PROBLEM_RELATIONSHIP

**Lines:** 14119-14158

**Purpose:**
- Remove link between answer and problem
- Auto-delete without confirmation (can be undone by re-adding)

**Code:**
```javascript
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
```

**Loading State Pattern:**
- Sets `deletingProblems[problemId]: true` for spinner display
- Clears loading state in success/error handlers
- Allows multiple concurrent deletes

#### DELETE_PROBLEM_RELATIONSHIP_SUCCESS

**Lines:** 14160-14207

**Purpose:**
- Handle successful problem deletion
- Refresh relationships and badge counts

**Code:**
```javascript
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
```

**Note:** 204 No Content responses (null payload) are expected and indicate success.

#### ADD_GOAL

**Purpose:**
- Add a goal to a problem
- Goals are sub-items of problems in the hierarchy

**Pattern:**
```javascript
dispatch('MAKE_ADD_GOAL_REQUEST', {
    requestBody: JSON.stringify({
        problemId: problemId,
        goalText: goalText,
        guidelineTemplateId: state.currentAssessmentId
    }),
    meta: {problemId: problemId, answerId: answerId, goalText: goalText}
});
```

#### ADD_GOAL_SUCCESS

**Lines:** 14374-14445

**Purpose:**
- Handle successful goal addition
- Refresh expanded problem goals

**Code:**
```javascript
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
```

**Expanded Problem Refresh:**
- Iterates through `state.expandedProblems`
- Reloads goals for any expanded problems
- Ensures new goals appear immediately in UI without manual refresh

**Similar patterns apply to:**
- `ADD_INTERVENTION` / `ADD_INTERVENTION_SUCCESS` - Adding interventions to goals
- `DELETE_GOAL` / `DELETE_GOAL_SUCCESS` - Removing goals
- `DELETE_INTERVENTION` / `DELETE_INTERVENTION_SUCCESS` - Removing interventions
- `UPDATE_GOAL` / `UPDATE_GOAL_SUCCESS` - Editing goal details
- `UPDATE_INTERVENTION` / `UPDATE_INTERVENTION_SUCCESS` - Editing intervention details

**State-Based Context Pattern:**
All PGI operations use state-based context storage instead of relying on HTTP effect `meta` parameters:

```javascript
// Before API call - store context
updateState({
    lastAddedInterventionGoalId: goalId
});

// In success handler - use stored context
const goalId = state.lastAddedInterventionGoalId;
if (goalId) {
    dispatch('LOAD_GOAL_INTERVENTIONS', {goalId});
    updateState({lastAddedInterventionGoalId: null});
}
```

---

### Scoring Models

Scoring models allow assessment authors to define scoring logic for assessments. Multiple models can exist per assessment with different scoring types.

#### CREATE_SCORING_MODEL

**Lines:** 13521-13536

**Purpose:**
- Create a new scoring model for an assessment
- Specify label and scoring type

**Code:**
```javascript
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
```

#### CREATE_SCORING_MODEL_SUCCESS

**Lines:** 13548-13571

**Purpose:**
- Handle successful scoring model creation
- Refresh scoring models list

**Code:**
```javascript
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
```

**Scoring Workflow:**
1. User opens scoring panel
2. Clicks "Create New Scoring Model"
3. Enters label and selects scoring type
4. Model created in backend
5. Model list refreshes automatically
6. User can assign scores to answers within the model

**Score Assignment:**
- Stored in `state.scoringChanges: {answerId: {modelId: score}}`
- Multiple models can assign different scores to the same answer
- Batch save with `SAVE_SCORING_CHANGES` action

---

### Typeahead and Search

The component implements 5 different typeahead systems for searching library content. All use debounced search (150-300ms delay) and keyboard navigation.

#### Generic Typeahead

**Lines:** 14990-15069

**Purpose:**
- Multi-purpose search for problems, goals, interventions, barriers, questions
- Used throughout PGI and relationship features

**Code:**
```javascript
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
```

**State-Based Context Pattern:**
- **Problem**: HTTP effect `meta` parameters can be undefined
- **Why**: CRITICAL - Need reliable context in success handler
- **Solution**: Store context in state before dispatch, check stored value in success handler

**Supported Types:**
- `problem` - Search problems
- `goal` - Search goals for a specific problem
- `intervention` - Search interventions for a specific goal
- `barrier` - Search barriers
- `question` - Search questions (library matching)
- `guideline` - Search guidelines

**Per-Item Loading States:**
- Goals: `goalTypeaheadLoading: {[problemId]: true}`
- Interventions: `interventionTypeaheadLoading: {[goalId]: true}`
- Allows multiple concurrent searches without UI conflicts

#### Question Typeahead

**Purpose:**
- Search library questions for matching
- Pre-save duplicate detection
- Keyboard navigation support

**State Properties:**
```javascript
questionTypeaheadResults: [],
questionTypeaheadLoading: false,
questionTypeaheadQuery: '',
questionTypeaheadVisible: false,
questionTypeaheadSelectedIndex: -1,
questionTypeaheadDebounceTimeout: null,
selectedQuestionLibraryId: null
```

**Keyboard Support:**
- Arrow Up/Down: Navigate results
- Enter: Select highlighted result
- Escape: Close dropdown

#### Answer Typeahead

**Purpose:**
- Search library answers for matching to questions
- Auto-match based on answer text

**State Properties:**
```javascript
answerTypeaheadResults: [],
answerTypeaheadLoading: false,
answerTypeaheadQuery: '',
answerTypeaheadVisible: false,
answerTypeaheadSelectedIndex: -1,
answerTypeaheadDebounceTimeout: null,
editingAnswerId: null,
currentAnswerSearchQuestionId: null,
libraryAnswerLoading: null
```

**Pattern - Stored Context:**
```javascript
// Before search
updateState({
    answerTypeaheadLoading: true,
    currentAnswerSearchContext: {
        contentType: 'answer',
        answerId: answerId,
        searchText: searchText
    }
});

// In success handler
const answerSearchContext = state.currentAnswerSearchContext;
if (answerSearchContext && answerSearchContext.contentType === 'answer') {
    updateState({
        answerTypeaheadResults: results,
        answerTypeaheadLoading: false,
        answerTypeaheadVisible: true
    });
}
```

#### Section Typeahead

**Purpose:**
- Search library sections
- Duplicate detection before save

**Close Events:**
- Click outside: 150ms delay (allows item selection)
- Escape key: Immediate close
- HIDE action: Clear results and context

---

### Server-Side Methods - Extended

**File:** `CareIQ Services.js`

#### builderAddSection

**Lines:** 973-1000

**Purpose:**
- Add new section to assessment
- Supports both parent sections and child sections (subsections)

**Parameters:**
- `sort_order`: Position in section list
- `gt_id`: Guideline template (assessment) ID
- `label`: Section name
- `parent_section_id`: null for parent sections, parent ID for child sections
- `library_id`: Optional library section ID for matching

#### getBuilderSectionQuestions

**Lines:** 955-972

**Purpose:**
- Fetch all questions for a section
- Returns questions with answers, relationships, and metadata

**Endpoint:** `GET /builder/section/{sectionId}`

#### queryRecords

**Lines:** 801-953

**Purpose:**
- Generic query method for ServiceNow tables
- Scoped to application tables only (security)
- Supports field selection, filtering, ordering, and limits

**Security:**
- Table name must start with `x_cadal_careiq_e_0_` (application scope)
- Uses `GlideRecordSecure` for ACL enforcement
- Validates table existence before querying

**Example Usage:**
```javascript
var fieldsObject = {
    fields: ['name', 'description'],
    query: {status: 'active'},
    orderBy: 'name',
    limit: 10
};
var result = careiqServices.queryRecords('x_cadal_careiq_e_0_my_table', fieldsObject);
```

#### createRecord

**Lines:** 708-799

**Purpose:**
- Create new records in ServiceNow tables
- Scoped to application tables only
- Validates fields before insertion

**Security Features:**
- Table must start with application scope prefix
- Uses `GlideRecordSecure` for ACL enforcement
- Validates each field exists before setting value
- Returns structured success/error responses

---

## HTTP Effects

**File:** `src/cadal-careiq-builder/effects.js`
**Lines:** 1-484

All HTTP effects follow a consistent pattern using ServiceNow's `createHttpEffect` API:

```javascript
export const EFFECT_NAME = createHttpEffect(
    '/api/x_cadal_careiq_e_0/careiq_experience_builder_api/endpoint-name',
    {
        method: 'POST',  // Always POST for ServiceNow endpoints
        dataParam: 'requestBody',
        headers: {
            'Content-Type': 'application/json'
        },
        startActionType: 'EFFECT_NAME_START',
        successActionType: 'EFFECT_NAME_SUCCESS',
        errorActionType: 'EFFECT_NAME_ERROR'
    }
);
```

### Configuration Effects

**Lines:** 10-15

```javascript
// System configuration effects - Only fetch region, version, app (no credentials)
export const LOAD_CAREIQ_CONFIG = createHttpEffect(
    '/api/x_cadal_careiq_e_0/careiq_experience_builder_api/get-careiq-config',
    {
        method: 'GET',
        startActionType: 'CAREIQ_CONFIG_FETCH_START',
        successActionType: 'CAREIQ_CONFIG_FETCH_SUCCESS',
        errorActionType: 'CAREIQ_CONFIG_FETCH_ERROR'
    }
);
```

**Purpose:** Load CareIQ platform configuration (region, version, app) without credentials.

### Assessment Management Effects

**Lines:** 18-80

```javascript
export const MAKE_USE_CASE_CATEGORIES_REQUEST = createHttpEffect(...);
export const MAKE_ASSESSMENTS_REQUEST = createHttpEffect(...);
export const MAKE_CREATE_ASSESSMENT_REQUEST = createHttpEffect(...);
export const MAKE_CREATE_VERSION_REQUEST = createHttpEffect(...);
export const MAKE_UPDATE_ASSESSMENT_REQUEST = createHttpEffect(...);
export const MAKE_PUBLISH_ASSESSMENT_REQUEST = createHttpEffect(...);
export const MAKE_UNPUBLISH_ASSESSMENT_REQUEST = createHttpEffect(...);
```

**Endpoints:**
- `/use-case-categories` - Get available categories
- `/get-assessments` - Fetch assessments
- `/create-assessment` - Create new assessment
- `/create-version` - Create new version of assessment
- `/update-assessment` - Update assessment metadata
- `/publish-assessment` - Publish assessment
- `/unpublish-assessment` - Unpublish assessment

### Section Effects

**Lines:** 82-135

```javascript
export const MAKE_ASSESSMENT_DETAILS_REQUEST = createHttpEffect(
    '/api/x_cadal_careiq_e_0/careiq_experience_builder_api/get-sections',
    ...
);
export const MAKE_SECTION_QUESTIONS_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_SECTION_REQUEST = createHttpEffect(...);
export const MAKE_SECTION_UPDATE_REQUEST = createHttpEffect(...);
export const MAKE_ADD_SECTION_REQUEST = createHttpEffect(...);
```

**Endpoints:**
- `/get-sections` - Fetch assessment structure
- `/get-section-questions` - Fetch questions for a section
- `/delete-section` - Remove section
- `/update-section` - Update section label
- `/add-section` - Create new section

### Question Effects

**Lines:** 137-172

```javascript
export const MAKE_UPDATE_QUESTION_REQUEST = createHttpEffect(...);
export const MAKE_ADD_QUESTION_TO_SECTION_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_QUESTION_REQUEST = createHttpEffect(...);
```

**Critical Pattern - 2-Step Question Creation:**

1. **Add Question to Section** (without answers):
```javascript
MAKE_ADD_QUESTION_TO_SECTION_REQUEST → builderAddQuestionToSection()
```

2. **Add Answers** (triggered by success handler):
```javascript
ADD_QUESTION_TO_SECTION_SUCCESS → check pendingQuestionAnswers → MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST
```

**Why Separate:**
- CareIQ backend requires question ID before adding answers
- Prevents orphaned answers without parent questions

### Answer Effects

**Lines:** 174-209

```javascript
export const MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST = createHttpEffect(...);
export const MAKE_ADD_ANSWER_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_ANSWER_REQUEST = createHttpEffect(...);
export const MAKE_UPDATE_ANSWER_REQUEST = createHttpEffect(...);
```

### Relationship Effects

**Lines:** 211-274

```javascript
export const MAKE_ANSWER_RELATIONSHIPS_REQUEST = createHttpEffect(...);
export const MAKE_ADD_BRANCH_QUESTION_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_BRANCH_QUESTION_REQUEST = createHttpEffect(...);
export const MAKE_ADD_GUIDELINE_RELATIONSHIP_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_GUIDELINE_RELATIONSHIP_REQUEST = createHttpEffect(...);
export const MAKE_ADD_BARRIER_RELATIONSHIP_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_BARRIER_RELATIONSHIP_REQUEST = createHttpEffect(...);
```

### Problem-Goal-Intervention (PGI) Effects

**Lines:** 276-401

```javascript
// Problem operations
export const MAKE_ADD_PROBLEM_RELATIONSHIP_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_PROBLEM_RELATIONSHIP_REQUEST = createHttpEffect(...);
export const MAKE_SAVE_PROBLEM_EDITS_REQUEST = createHttpEffect(...);
export const MAKE_GET_PROBLEM_DETAILS_REQUEST = createHttpEffect(...);
export const MAKE_LOAD_PROBLEM_GOALS_REQUEST = createHttpEffect(...);

// Goal operations
export const MAKE_ADD_GOAL_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_GOAL_REQUEST = createHttpEffect(...);
export const MAKE_GET_GOAL_DETAILS_REQUEST = createHttpEffect(...);
export const MAKE_UPDATE_GOAL_REQUEST = createHttpEffect(...);
export const MAKE_LOAD_GOAL_INTERVENTIONS_REQUEST = createHttpEffect(...);

// Intervention operations
export const MAKE_ADD_INTERVENTION_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_INTERVENTION_REQUEST = createHttpEffect(...);
export const MAKE_GET_INTERVENTION_DETAILS_REQUEST = createHttpEffect(...);
export const MAKE_UPDATE_INTERVENTION_REQUEST = createHttpEffect(...);
```

### Scoring Model Effects

**Lines:** 403-438

```javascript
export const MAKE_CREATE_SCORING_MODEL_REQUEST = createHttpEffect(...);
export const MAKE_GET_SCORING_MODELS_REQUEST = createHttpEffect(...);
export const MAKE_DELETE_SCORING_MODEL_REQUEST = createHttpEffect(...);
export const MAKE_SAVE_SCORING_MODEL_REQUEST = createHttpEffect(...);
```

### Search and Typeahead Effects

**Lines:** 440-484

```javascript
export const MAKE_GENERIC_TYPEAHEAD_REQUEST = createHttpEffect(...);
export const MAKE_GUIDELINE_SEARCH_REQUEST = createHttpEffect(...);
export const MAKE_LIBRARY_QUESTION_REQUEST = createHttpEffect(...);
export const MAKE_LIBRARY_ANSWER_REQUEST = createHttpEffect(...);
export const SECTION_TYPEAHEAD_SEARCH = createHttpEffect(...);
```

**Generic Typeahead:**
- Used for multi-purpose searches (problems, goals, interventions, barriers)
- Uses stored context pattern in state (`currentAnswerSearchContext`)
- More reliable than passing context via `meta` parameter

---

## Server-Side Integration

**File:** `CareIQ Services.js`
**Lines:** 0-2,489

The server-side Script Include handles all backend communication with the CareIQ platform.

### Class Structure

**Lines:** 0-1

```javascript
var CareIQExperienceServices = Class.create();
CareIQExperienceServices.prototype = Object.extendsObject(global.AbstractAjaxProcessor, {
```

**Pattern:** Extends ServiceNow's `AbstractAjaxProcessor` for AJAX-based server-side scripting.

### Debug Logging

**Lines:** 3-22

```javascript
_isDebugEnabled: function() {
    return gs.getProperty('x_cadal_careiq_e_0.careiq.platform.globalDebug') === 'true';
},

_log: function(message, isError) {
    // ONLY log if debug is enabled OR it's an error message
    if (this._isDebugEnabled() || isError) {
        if (isError) {
            gs.error('[CareIQ] ' + message);
        } else {
            gs.info('[CareIQ] ' + message);
        }
    }
},

_logError: function(message) {
    // Always log errors regardless of debug setting
    gs.error('[CareIQ] ' + message);
},
```

**Purpose:**
- Conditional logging controlled by system property
- Debug logs only when `x_cadal_careiq_e_0.careiq.platform.globalDebug` is 'true'
- Errors always logged regardless of debug setting

### Configuration Management

**Lines:** 24-59

```javascript
_getConfig: function() {
    var config = {
        token: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.token'),
        app: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.app'),
        region: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.region'),
        version: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.version'),
        clientId: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.id'),
        oToken: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.otoken'),
        apiKey: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.apikey'),
        careIQPlatformStaticURL: gs.getProperty('x_cadal_careiq_e_0.careiq.platform.staticurl')
    };

    return config;
},

_validateConfig: function(config, requiredFields) {
    var missing = [];

    requiredFields.forEach(function(field) {
        if (!config[field]) {
            missing.push(field);
        }
    });

    if (missing.length > 0) {
        this._logError('Missing required configuration values: ' + missing.join(', '));
        return false;
    }

    return true;
},

_buildEndpoint: function(path) {
    var config = this._getConfig();
    return 'https://' + config.app + '.' + config.region + config.careIQPlatformStaticURL + config.version + path;
},
```

**Purpose:**
- `_getConfig()`: Retrieve CareIQ platform credentials from ServiceNow system properties
- `_validateConfig()`: Ensure required fields are present before API calls
- `_buildEndpoint()`: Construct full CareIQ API URLs

**Example URL:** `https://app.region.careiq.com/api/v1/careflow/guideline-template`

### REST Message Creation

**Lines:** 61-76

```javascript
_createRESTMessage: function(name, endpoint) {
    var r = new sn_ws.RESTMessageV2('x_cadal_careiq_e_0.CareIQ Experience REST Calls', name);
    r.setEndpoint(endpoint);
    return r;
},

_setAuthHeaders: function(request, sessionToken) {
    var config = this._getConfig();
    request.setRequestHeader('Authorization', 'Bearer ' + config.token);

    if (sessionToken) {
        request.setRequestHeader('token', sessionToken);
    }

    return request;
},
```

**Purpose:**
- Create ServiceNow REST Message objects
- Set Authorization header with Bearer token
- Optionally add session token header for session-based operations

### Request Execution with Retry Logic

**Lines:** 78-152

```javascript
_executeRequestWithRetry: function(request, logContext, sessionToken) {
    var maxAttempts = 3;
    var currentAttempt = 1;
    var lastStatusCode = null;
    var lastError = null;

    while (currentAttempt <= maxAttempts) {
        try {
            this._log(logContext + ' - Attempt ' + currentAttempt + ' of ' + maxAttempts, false);

            // Set auth headers (they might have changed if token was refreshed)
            this._setAuthHeaders(request, sessionToken);

            // Execute the request
            var response = request.execute();
            var statusCode = response.getStatusCode();
            lastStatusCode = statusCode;

            // If successful, return the response
            if (statusCode >= 200 && statusCode < 300) {
                return response;
            }

            // If unauthorized (401), refresh token and try again
            if (statusCode === 401) {
                this._log(logContext + ' - Received 401 Unauthorized, refreshing token', true);
                this.getToken(); // Refresh the token
                currentAttempt++; // Increment attempt counter
                continue; // Try again with new token
            }

            // For other errors, log and return response to be handled by the caller
            this._logError(logContext + ' - Request failed with status code: ' + statusCode);
            this._logError(logContext + ' - Error response: ' + response.getBody());
            return response;

        } catch (attemptError) {
            lastError = attemptError;
            this._logError(logContext + ' - Error in attempt ' + currentAttempt + ': ' + attemptError);
            currentAttempt++; // Increment attempt counter

            // Only retry if we haven't reached max attempts
            if (currentAttempt <= maxAttempts) {
                this._log(logContext + ' - Refreshing token and retrying', false);
                this.getToken(); // Refresh token before retry
            } else {
                throw new Error('Failed after ' + maxAttempts + ' attempts. Last error: ' + attemptError.message);
            }
        }
    }

    // This should never be reached due to the throw in the catch block
    throw new Error('Failed after ' + maxAttempts + ' attempts. Last status: ' + lastStatusCode);
},
```

**Purpose:**
- Automatic retry on failure (up to 3 attempts)
- Automatically refreshes authentication token on 401 Unauthorized
- Provides detailed logging for debugging

**Pattern:**
1. Try request
2. If 401 Unauthorized → refresh token → retry
3. If other error → log and retry up to 3 times
4. If all attempts fail → throw error

### Token Refresh (CRITICAL FIX)

**Lines:** 187-351

```javascript
getToken: function() {
    try {
        // Log who is calling this and their context
        this._log('======== AUTH TOKEN REFRESH START ========', true);
        this._log('Auth - User: ' + gs.getUserName() + ' (ID: ' + gs.getUserID() + ')', true);
        this._log('Auth - User roles: ' + gs.getUser().getRoles(), true);

        var config = this._getConfig();

        // Log current token for comparison
        if (config.token) {
            this._log('Auth - Current token prefix: ' + config.token.substring(0, 10) + '...', true);
        }

        // Validate required values
        if (!this._validateConfig(config, ['app', 'region', 'version', 'apiKey', 'oToken', 'clientId'])) {
            this._logError('Auth - Config validation FAILED');
            return false;
        }

        // Build the full endpoint URL
        var endpoint = this._buildEndpoint('/auth/token');

        // Create REST message
        var r = new sn_ws.RESTMessageV2();
        r.setHttpMethod('post');
        r.setEndpoint(endpoint);
        r.setRequestHeader('x-api-key', config.apiKey);
        r.setRequestHeader('o-token', config.oToken);
        r.setRequestHeader('x-client-id', config.clientId);

        // Execute the callout
        var response = this._executeRequest(r, 'Auth');
        var status = response.getStatusCode();

        // Handle success
        if (status === 200) {
            var responseBody = response.getBody();
            var json = JSON.parse(responseBody);
            var token = json.access_token;

            if (token) {
                // Validate permissions before updating
                var gr_sysProperties = new GlideRecordSecure('sys_properties');

                if (gr_sysProperties.isValid()) {
                    gr_sysProperties.addQuery('name', 'x_cadal_careiq_e_0.careiq.platform.token');
                    gr_sysProperties.query();

                    if (gr_sysProperties.next()) {
                        // Check if user can update this record
                        if (gr_sysProperties.canWrite()) {
                            this._log('Auth - canWrite() returned TRUE - user has permission to update', true);
                        } else {
                            this._logError('Auth - canWrite() returned FALSE - USER DOES NOT HAVE PERMISSION');
                            return false;
                        }

                        // CRITICAL FIX: Use gs.setProperty() because GlideRecordSecure.setValue()
                        // doesn't work from scoped apps on global tables
                        try {
                            gs.setProperty('x_cadal_careiq_e_0.careiq.platform.token', token);
                            this._log('Auth - gs.setProperty() completed without error', true);

                            // Verify the update worked by reading it back
                            var verifyToken = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.token');

                            if (verifyToken === token) {
                                this._log('Auth - VERIFICATION PASSED: Token updated successfully', true);
                                return true;
                            } else {
                                this._logError('Auth - VERIFICATION FAILED: Saved token does not match new token');
                                return false;
                            }

                        } catch (updateEx) {
                            this._logError('Auth - EXCEPTION during gs.setProperty(): ' + updateEx.message);
                            return false;
                        }

                    } else {
                        this._logError('Auth - Token property NOT FOUND in sys_properties table');
                        return false;
                    }
                } else {
                    this._logError('Auth - GlideRecordSecure.isValid() returned FALSE');
                    return false;
                }
            }
        }
    } catch (ex) {
        this._logError('Auth - EXCEPTION occurred during token refresh');
        this._logError('Auth - Exception message: ' + ex.message);
        return false;
    }
},
```

**CRITICAL FIX:**
- **Problem**: Normal users could not refresh tokens because `GlideRecordSecure.setValue()` doesn't work from scoped apps on global tables
- **Solution**: Use `gs.setProperty()` instead after validating user has permission via `canWrite()`
- **Why**: ServiceNow scope isolation prevents scoped apps from updating global table records directly
- **Status**: App review exception requested for `gs.setProperty()` usage

---

## Critical Patterns

### 1. Local-Change-Then-Save Pattern

**All edits update local state immediately; backend calls only on explicit "Save" action.**

**Question Edit Example:**

```javascript
// User edits question label - updates state immediately
'EDIT_QUESTION_LABEL': (coeffects) => {
    const {action, state, updateState} = coeffects;
    const {questionId, newLabel} = action.payload;

    const updatedQuestions = state.currentQuestions.questions.map(q =>
        q.ids.id === questionId ? {...q, label: newLabel, isUnsaved: true} : q
    );

    updateState({
        currentQuestions: {
            ...state.currentQuestions,
            questions: updatedQuestions
        },
        questionChanges: {
            ...state.questionChanges,
            [questionId]: {
                ...state.questionChanges[questionId],
                label: newLabel,
                action: 'update'
            }
        }
    });
},

// User clicks "Save" - makes backend API call
'SAVE_QUESTION_IMMEDIATELY': (coeffects) => {
    // ... validation ...
    dispatch('MAKE_UPDATE_QUESTION_REQUEST', {requestBody});
},

// On success - reload assessment data
'UPDATE_QUESTION_SUCCESS': (coeffects) => {
    updateState({questionChanges: {}});
    dispatch('FETCH_ASSESSMENT_DETAILS', {assessmentId: state.currentAssessmentId});
},
```

### 2. Change Tracking for Save/Cancel Buttons

**Questions track changes using TWO mechanisms:**

1. **`questionChanges` state object:**
```javascript
questionChanges: {
    [questionId]: {
        action: 'add' | 'update' | 'delete' | 'library_replace',
        label: string,
        tooltip: string,
        required: boolean,
        // ... other changed fields
    }
}
```

2. **`isUnsaved` flag on question object:**
```javascript
{
    ids: {id: '...', ...},
    label: 'Question text',
    isUnsaved: true,  // Show Save/Cancel buttons
    // ... other properties
}
```

**CRITICAL:** After save, BOTH must be cleared:

```javascript
'SAVE_QUESTION_IMMEDIATELY': (coeffects) => {
    // ... save logic ...

    // Clear change tracking
    const updatedQuestionChanges = {...state.questionChanges};
    delete updatedQuestionChanges[questionId];

    // Clear isUnsaved flag on question object
    const updatedQuestions = state.currentQuestions.questions.map(q =>
        q.ids.id === questionId ? {...q, isUnsaved: false} : q
    );

    updateState({
        questionChanges: updatedQuestionChanges,
        currentQuestions: {
            ...state.currentQuestions,
            questions: updatedQuestions
        }
    });
},
```

**Why:** UI checks `question.isUnsaved` for button display, not `state.questionChanges`.

### 3. Two-Step Question and Answer Creation

**CareIQ backend requires question ID before adding answers.**

**Step 1: Create Question**

```javascript
'ADD_QUESTION_TO_SECTION_API': (coeffects) => {
    const requestBody = JSON.stringify({
        guidelineTemplateId: state.currentAssessmentId,
        sectionId: sectionId,
        questionLabel: questionData.label,
        questionType: questionData.type,
        // ... other question fields
        // NO ANSWERS in this call
    });

    // Store answers for later
    updateState({
        pendingQuestionAnswers: questionData.answers
    });

    dispatch('MAKE_ADD_QUESTION_TO_SECTION_REQUEST', {requestBody});
},
```

**Step 2: Add Answers (Auto-triggered on Success)**

```javascript
'ADD_QUESTION_TO_SECTION_SUCCESS': (coeffects) => {
    const {action, state, dispatch} = coeffects;
    const newQuestionId = action.payload.id;  // Backend returns question ID

    // Check if there are pending answers
    if (state.pendingQuestionAnswers && state.pendingQuestionAnswers.length > 0) {
        const requestBody = JSON.stringify({
            questionId: newQuestionId,
            answers: state.pendingQuestionAnswers
        });

        dispatch('MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST', {requestBody});
    }

    // Clear pending answers
    updateState({pendingQuestionAnswers: null});
},
```

### 4. State-Based Refresh for PGI Operations

**HTTP effect `meta` parameters are unreliable - use state-based context storage.**

**Problem:**
```javascript
// ❌ UNRELIABLE - meta can be undefined
dispatch('MAKE_ADD_INTERVENTION_REQUEST', {
    requestBody: requestBody,
    meta: {goalId: goalId}  // May not be available in success handler
});
```

**Solution:**
```javascript
// ✅ RELIABLE - Store context in state before dispatch
'SAVE_INTERVENTION_TO_GOAL': (coeffects) => {
    updateState({
        lastAddedInterventionGoalId: goalId  // Store for success handler
    });
    dispatch('MAKE_ADD_INTERVENTION_REQUEST', {requestBody});
},

'ADD_INTERVENTION_SUCCESS': (coeffects) => {
    const goalId = state.lastAddedInterventionGoalId;  // Use stored value
    if (goalId && state.currentAssessmentId) {
        updateState({lastAddedInterventionGoalId: null});
        dispatch('LOAD_GOAL_INTERVENTIONS', {
            goalId: goalId,
            guidelineTemplateId: state.currentAssessmentId
        });
    }
}
```

### 5. Action Preservation for Library Questions

**Library questions must maintain `action: 'library_replace'` through all edit operations.**

**Problem:**
```javascript
// ❌ WRONG - Changes action to 'update', sends to wrong API endpoint
action: state.questionChanges?.[questionId]?.action === 'add' ? 'add' : 'update',
```

**Solution:**
```javascript
// ✅ CORRECT - Preserves 'library_replace' action
action: (state.questionChanges?.[questionId]?.action === 'add' ||
         state.questionChanges?.[questionId]?.action === 'library_replace')
    ? state.questionChanges?.[questionId]?.action
    : 'update',
```

**Why:** Library questions with temp IDs go through `ADD_QUESTION_TO_SECTION_API`, not `UPDATE_QUESTION_API`.

### 6. Duplicate Custom Attributes Fix

**JavaScript objects can't have duplicate keys - use array storage during editing.**

**Load: Object → Array**
```javascript
'GET_PROBLEM_DETAILS_SUCCESS': (coeffects) => {
    const customAttrsObj = action.payload.custom_attributes || {};
    const customAttrsArray = Object.entries(customAttrsObj).map(([key, value]) => ({key, value}));

    updateState({
        editingProblemData: {
            label: action.payload.label || '',
            custom_attributes: customAttrsArray  // Array for editing
        }
    });
},
```

**Edit: Array-Based Updates**
```javascript
// Update key
oninput={(e) => {
    const newKey = e.target.value;
    const updatedAttrs = [...state.editingProblemData.custom_attributes];
    updatedAttrs[index] = {key: newKey, value: attr.value};
    updateState({
        editingProblemData: {
            ...state.editingProblemData,
            custom_attributes: updatedAttrs
        }
    });
}}
```

**Save: Array → Object**
```javascript
'SAVE_PROBLEM_EDITS': (coeffects) => {
    const customAttrsArray = editData.custom_attributes || [];

    // Validate duplicates
    const keys = customAttrsArray.map(item => item.key).filter(k => k !== '');
    const hasDuplicates = keys.length !== new Set(keys).size;
    if (hasDuplicates) {
        // Show error
        return;
    }

    // Convert to object
    const customAttrsObj = customAttrsArray.reduce((acc, item) => {
        if (item.key !== '') {
            acc[item.key] = item.value;
        }
        return acc;
    }, {});

    const requestBody = JSON.stringify({
        problemId: problemId,
        custom_attributes: customAttrsObj,  // Send object to API
    });

    dispatch('MAKE_UPDATE_PROBLEM_REQUEST', {requestBody});
}
```

---

## Summary

This document provides comprehensive documentation of the CareIQ Builder codebase with actual code examples from the implementation. The component is a sophisticated healthcare assessment authoring tool with **303+ action handlers** managing **229 state properties**, integrating with **50+ HTTP effects** and **75+ server-side API endpoints**.

### Key Architectural Patterns

1. **Local-Change-Then-Save Pattern**: All edits are local until explicit save
   - Changes tracked in `questionChanges`, `answerChanges`, `sectionChanges`
   - Backend calls only on user-initiated save actions
   - Auto-refresh after successful saves

2. **Change Tracking**: Separate state objects track unsaved modifications
   - Questions tracked with `action: 'add' | 'update' | 'delete' | 'library_replace'`
   - Answers tracked with `action: 'add' | 'update' | 'delete'`
   - Sections tracked with `action: 'add' | 'update'`

3. **Two-Step Question/Answer Creation**: Questions and answers created in separate API calls
   - Step 1: `ADD_QUESTION_TO_SECTION_API` creates question, returns question ID
   - Step 2: `ADD_ANSWERS_TO_QUESTION` automatically triggered with question ID
   - Required by CareIQ backend architecture

4. **State-Based Context Storage**: Store context in state, not HTTP effect meta parameters
   - Problem: `meta` parameters can be undefined in success handlers
   - Solution: Store context before dispatch, retrieve from state in handlers
   - Example: `lastAddedInterventionGoalId`, `currentAnswerSearchContext`

5. **Action Preservation for Library Questions**: Maintain `action: 'library_replace'` through all edits
   - Library questions use temp IDs but go through ADD API, not UPDATE API
   - Must preserve action type when editing tooltip, custom_attributes, etc.
   - Failure to preserve causes wrong API endpoint selection

6. **Array Storage for Duplicate Detection**: Custom attributes use arrays during edit
   - Load: Convert object → array `Object.entries()`
   - Edit: Index-based updates on array
   - Save: Convert array → object `reduce()` with duplicate validation

### Component Statistics

**Lines of Code:**
- `index.js`: 22,991 lines
- `effects.js`: 483 lines
- `CareIQ Services.js`: 2,489 lines
- `styles.scss`: 4,974 lines
- **Total**: ~31,000 lines

**State Management:**
- 229 state properties
- 303+ action handlers
- 50+ HTTP effects
- Change tracking for sections, questions, answers, scoring

**Server-Side:**
- 75+ Scripted REST API endpoints
- 50+ builder-specific methods
- Token refresh with retry logic
- Scoped table security validation

### Feature Areas Documentation Reference

| Feature | Lines (index.js) | Key Actions | State Properties |
|---------|------------------|-------------|------------------|
| **Bootstrap & Config** | 9024-9230 | COMPONENT_BOOTSTRAPPED, LOAD_CAREIQ_CONFIG | careiqConfig, configLoadAttempted |
| **Assessment Management** | 9071-9320 | FETCH_ASSESSMENTS, CREATE_NEW_ASSESSMENT | assessments, filteredAssessments |
| **Section CRUD** | 17688-18451 | ADD_SECTION, ADD_CHILD_SECTION, DELETE_SECTION | currentAssessment.sections, sectionChanges |
| **Question CRUD** | 11404-12242 | ADD_QUESTION, SAVE_QUESTION_IMMEDIATELY | currentQuestions, questionChanges |
| **Answer CRUD** | 11662-20243 | ADD_ANSWER, DELETE_ANSWER, UPDATE_ANSWER_LABEL | answerChanges, answerTypeaheadResults |
| **PGI Relationships** | 13048-14467 | ADD_PROBLEM, ADD_GOAL, ADD_INTERVENTION | answerRelationships, expandedProblems |
| **Scoring Models** | 13521-13803 | CREATE_SCORING_MODEL, SAVE_SCORING_CHANGES | scoringModels, scoringChanges |
| **Typeaheads** | 14990-15197 | GENERIC_TYPEAHEAD_SEARCH | *TypeaheadResults, *TypeaheadLoading |

### Quick Reference - Common Operations

**Adding a New Question:**
```javascript
// 1. User clicks "Add Question" button
dispatch('ADD_QUESTION', {sectionId});

// 2. User fills in question details and clicks "Save"
dispatch('SAVE_QUESTION_IMMEDIATELY', {questionId});

// 3. Backend: ADD_QUESTION_TO_SECTION_API → ADD_ANSWERS_TO_QUESTION
// 4. Success: Reload section questions to show new question
```

**Linking Answer to Problem:**
```javascript
// 1. User searches for problem via typeahead
dispatch('GENERIC_TYPEAHEAD_SEARCH', {searchText, type: 'problem'});

// 2. User selects problem from results
dispatch('ADD_PROBLEM_RELATIONSHIP', {answerId, problemData});

// 3. Success: Refresh relationships and badge counts
dispatch('LOAD_ANSWER_RELATIONSHIPS', {answerId});
dispatch('FETCH_SECTION_QUESTIONS', {sectionId});
```

**Editing Custom Attributes:**
```javascript
// 1. Load: Object → Array
const customAttrsArray = Object.entries(obj).map(([key, value]) => ({key, value}));

// 2. Edit: Index-based updates
updatedAttrs[index] = {key: newKey, value: attr.value};

// 3. Save: Array → Object with validation
const customAttrsObj = array.reduce((acc, item) => {
    if (item.key !== '') acc[item.key] = item.value;
    return acc;
}, {});
```

### Critical Fixes & Patterns Documented

1. **Token Refresh Fix** (Lines 187-351): Use `gs.setProperty()` instead of `GlideRecordSecure.setValue()`
2. **Save/Cancel Button Fix** (Lines 11943-12192): Clear both `questionChanges` AND `question.isUnsaved`
3. **Library Question Custom Attributes** (Lines 19490, CareIQ Services 1455): Include custom_attributes in library question payloads
4. **Duplicate Custom Attributes** (v1.0.077): Array storage pattern for real-time validation
5. **State-Based PGI Refresh** (Lines 14374-14445): Store context before dispatch, use in success handler

### Error Handling Patterns

**ServiceNow Safe Error Pattern:**
```javascript
try {
    // ... operation ...
} catch (e) {
    var errorMsg = 'Unexpected server error occurred';
    try {
        if (e && typeof e.toString === 'function') {
            errorMsg = e.toString();
        }
    } catch (innerE) {
        errorMsg = 'Server error occurred';
    }
    // Never access e.message or e.stack (ServiceNow security)
}
```

**Backend Message Classification:**
```javascript
if (action.payload?.detail) {
    const lowerDetail = action.payload.detail.toLowerCase();
    if (lowerDetail.includes('duplicate') || lowerDetail.includes('already')) {
        messageType = 'warning';  // Informational
    } else if (lowerDetail.includes('error') || lowerDetail.includes('failed')) {
        messageType = 'error';
    }
}
```

### Development Guidelines

**Adding New Features:**
1. Read existing code first - understand patterns before modifying
2. Use local-change-then-save pattern for all data modifications
3. Track changes in appropriate `*Changes` state object
4. Add loading states for async operations (`saving*`, `deleting*`)
5. Refresh data after successful saves
6. Surface backend `detail` messages to users

**Testing:**
1. Test with both new items (temp IDs) and existing items (real IDs)
2. Test save, cancel, and delete flows
3. Verify change tracking cleared after saves
4. Check loading spinners appear and disappear correctly
5. Verify badge counts update after relationship changes

**Server-Side:**
1. Always use `request.body.data` pattern (stash immediately)
2. Never access `e.message` or `e.stack` in catch blocks
3. Use POST for ServiceNow endpoints even if backend uses GET
4. Validate table names start with application scope prefix
5. Use `GlideRecordSecure` for ACL enforcement

---

## Document Information

**Created:** 2025-12-09
**Component Version:** 1.0.112
**Framework:** ServiceNow UI Core 24.1.1 with Snabbdom
**Total Documentation Lines:** 3,356

**Coverage:**
- ✅ Complete: Initial state, action handlers, HTTP effects, server-side methods
- ✅ Complete: Section, Question, Answer CRUD operations
- ✅ Complete: PGI (Problem-Goal-Intervention) relationships
- ✅ Complete: Scoring models, typeaheads, critical patterns
- ✅ Complete: Real code samples with line number references

**For specific implementation details, refer to the line numbers provided throughout this document.**

---

*End of Documentation*
