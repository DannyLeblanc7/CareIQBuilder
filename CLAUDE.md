# Claude Code Context for CareIQ Builder

## Project Overview
ServiceNow UI component that integrates with the CareIQ platform for creating and maintaining assessments. Uses @servicenow/ui-core framework with snabbdom renderer.

## Key Architecture Decisions

### Server-Side API Pattern
- **Always use server-side Scripted REST APIs** for CareIQ platform calls (never direct client-side calls for security)
- **ServiceNow endpoints use POST** even if the backend CareIQ calls are GET
- **Use `request.body.data` pattern** for all server-side APIs
- **Stash request data immediately**: `var requestData = request.body.data;` to avoid consumption issues

### Error Handling in ServiceNow
- **Never access `e.message` or `e.stack`** in catch blocks (ServiceNow security restrictions)
- **Use safe error handling**:
  ```javascript
  var errorMsg = 'Unexpected server error occurred';
  try {
      if (e && typeof e.toString === 'function') {
          errorMsg = e.toString();
      }
  } catch (innerE) {
      errorMsg = 'Server error occurred';
  }
  ```

### API Call Pattern
- **NEVER use direct `fetch()` calls** - All API calls must use ServiceNow HTTP effects (createHttpEffect)
- Use the established HTTP effect pattern: `dispatch('MAKE_*_REQUEST', {requestBody})`

### CRITICAL: Question and Answer Creation Pattern
**ALWAYS use the 2-step API pattern for creating questions:**

1. **Step 1: Create question** using `ADD_QUESTION_TO_SECTION_API`
   - Endpoint: `/api/x_cadal_careiq_b_0/careiq_api/add-question-to-section`
   - Calls: `builderAddQuestionToSection()` in CareIQ Services
   - CareIQ Backend: `POST /builder/section/{sectionId}/questions`
   - Does NOT include answers in this call

2. **Step 2: Add answers** (automatically triggered by SUCCESS handler)
   - SUCCESS handler receives question ID from backend
   - Checks for `state.pendingQuestionAnswers`
   - Dispatches `MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST` with question ID
   - Endpoint: `/api/x_cadal_careiq_b_0/careiq_api/add-answers-to-question`

**DEPRECATED: DO NOT USE**
- ❌ `ADD_QUESTION_API` action (REMOVED)
- ❌ `MAKE_ADD_QUESTION_REQUEST` HTTP effect (REMOVED)
- ❌ Endpoint: `/api/x_cadal_careiq_b_0/careiq_api/add-question` (OLD API)
- ❌ `builderAddQuestion()` method that sends question + answers in one call

**Why This Pattern:**
- Backend expects separate API calls for question and answers
- Question must be created first to get the question ID
- Answers require the question ID to be associated correctly

### Component to ServiceNow Data Flow
**Component sends direct fields (no data wrapper):**
```javascript
const requestBody = JSON.stringify({
    answerId: answerId,           // Direct fields in root
    guidelineId: guidelineId      // NO data: {} wrapper!
});
dispatch('MAKE_API_REQUEST', {requestBody});
```

**ServiceNow API receives and accesses:**
```javascript
var requestData = request.body.data;  // ServiceNow wraps in .data automatically
```

### CareIQ Services Script Include Pattern
- **Correct instantiation**: `var careiqServices = new x_1628056_careiq.CareIQServices();`
- **Application scope**: All CareIQ Script Includes are in the `x_1628056_careiq` scope
- **Use `Delta CareIQ Services - Consolidated.js`** as single source of truth for new methods

### CRITICAL: Save/Cancel Button Display Fix
**PROBLEM**: Save/Cancel buttons don't disappear after saving question changes, even though `questionChanges` state is cleared correctly.

**ROOT CAUSE**: Buttons are rendered based on `question.isUnsaved` property (line ~1461), NOT `state.questionChanges`:
```javascript
{question.isUnsaved && [
    <button onclick={() => dispatch('SAVE_QUESTION_IMMEDIATELY', {questionId: question.ids.id})}>💾 Save</button>
    <button onclick={() => dispatch('CANCEL_QUESTION_CHANGES', {questionId: question.ids.id})}>↶ Cancel</button>
]}
```

**SOLUTION**: In `SAVE_QUESTION_IMMEDIATELY` action handler, clear BOTH the change tracking AND the `isUnsaved` flag on the question object:
```javascript
'SAVE_QUESTION_IMMEDIATELY': (coeffects) => {
    // ... validation and checks ...

    // Clear change tracking
    const updatedQuestionChanges = {...state.questionChanges};
    const updatedAnswerChanges = {...state.answerChanges};
    delete updatedQuestionChanges[questionId];
    // ... remove answer changes ...

    // CRITICAL: Clear isUnsaved flag on the question object itself
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

    dispatch('UPDATE_QUESTION_API', {...});
}
```

**KEY INSIGHT**: Clearing `state.questionChanges` only affects the change tracking state, but the UI buttons check the `question.isUnsaved` property directly. Both must be cleared for buttons to disappear.

### Version Management
- **Always increment the last digit** in package.json version when making changes
- Current pattern: 0.0.xxx (increment xxx)
- **TIMING: Increment version at the END of work** - Only increment after changes are completed and verified

## UI/UX Patterns

### ServiceNow UI Core - Select Element Pattern
**CRITICAL**: Use `selected` attributes on options, not `value` on select element.

```javascript
<select onchange={...}>
  <option value="Single Select" selected={question.type === 'Single Select'}>Single Select</option>
  <option value="Multiselect" selected={question.type === 'Multiselect'}>Multiselect</option>
</select>
```

### JSX Fragment Syntax Not Supported
**ServiceNow's snabbdom renderer does NOT support JSX fragments (`<>...</>`).**

```javascript
// ❌ WRONG
return (<><div>A</div><div>B</div></>);

// ✅ CORRECT
return [<div>A</div>, <div>B</div>];
```

### Typeahead Dropdown Close Pattern
All typeahead dropdowns must implement:
- **Click outside**: Close with 150ms delay (allows item selection)
- **Escape key**: Close immediately
- **HIDE action**: Clear dropdown results and search context

```javascript
onkeydown={(e) => {
    if (e.key === 'Escape') {
        dispatch('[NAME]_TYPEAHEAD_HIDE');
    }
}}
onblur={(e) => {
    setTimeout(() => {
        dispatch('[NAME]_TYPEAHEAD_HIDE');
    }, 150);
}}
```

### Typeahead Stored Context Pattern (CRITICAL)
**All typeaheads using `MAKE_GENERIC_TYPEAHEAD_REQUEST` must use stored context pattern.**

This is the **WORKING PATTERN** used by question, answer, goal, and intervention typeaheads:

```javascript
// 1. Store context in state before dispatching
'SEARCH_ANSWERS': (coeffects) => {
    const answerSearchContext = {
        contentType: 'answer',
        answerId: answerId,
        searchText: searchText
    };

    updateState({
        answerTypeaheadLoading: true,
        currentAnswerSearchContext: answerSearchContext  // Store context
    });

    dispatch('MAKE_GENERIC_TYPEAHEAD_REQUEST', {
        requestBody: requestBody,
        meta: { contentType: 'answer', answerId: answerId }
    });
},

// 2. Check stored context in GENERIC_TYPEAHEAD_SUCCESS
'GENERIC_TYPEAHEAD_SUCCESS': (coeffects) => {
    const answerSearchContext = state.currentAnswerSearchContext;

    if (answerSearchContext && answerSearchContext.contentType === 'answer') {
        updateState({
            answerTypeaheadResults: results,
            answerTypeaheadLoading: false,
            answerTypeaheadVisible: true
        });
        // DON'T clear context - let blur/escape events handle it
    }
},

// 3. Clear context in error handler
'GENERIC_TYPEAHEAD_ERROR': (coeffects) => {
    const answerSearchContext = state.currentAnswerSearchContext;

    if (answerSearchContext && answerSearchContext.contentType === 'answer') {
        updateState({
            answerTypeaheadLoading: false,
            answerTypeaheadVisible: false,
            currentAnswerSearchContext: null  // Clear context
        });
    }
}
```

**Why This Pattern Works:**
- State-based context is reliable (meta parameters can be undefined)
- Prevents stuck loading states
- Used by all working typeaheads (questions, answers, goals, interventions)

## State Management Patterns

### Local Changes Then Save
**NEVER call backend APIs directly from UI actions.**

1. **UI Actions**: Make local changes to state (add, edit, delete)
2. **Track Changes**: Store changes in `sectionChanges`, `questionChanges`, `answerChanges`
3. **Save Action**: Only call backend APIs when user clicks "Save" button
4. **Auto-refresh**: After save completes, reload the assessment data

### Save/Cancel Button Display
**Any action that changes data must update change tracking:**

```javascript
'ACTION_NAME': (coeffects) => {
    updateState({
        questionChanges: {
            ...state.questionChanges,
            [itemId]: { /* track what changed */ }
        }
    });
}
```

### Post-Save Reload Pattern
**ALWAYS reload assessment data after ANY save operation:**

```javascript
'[OPERATION]_SUCCESS': (coeffects) => {
    // 1. Clear change tracking
    updateState({
        sectionChanges: {},
        questionChanges: {},
        answerChanges: {}
    });

    // 2. Reload assessment data
    if (state.currentAssessmentId) {
        dispatch('FETCH_ASSESSMENT_DETAILS', {
            assessmentId: state.currentAssessmentId
        });
    }
}
```

### Assessment ID Access
**Store assessment ID separately** - use `state.currentAssessmentId` for API calls.

```javascript
// Store ID in OPEN_ASSESSMENT_BUILDER
updateState({ currentAssessmentId: assessmentId });

// Use stored ID for API calls
gt_id: state.currentAssessmentId  // NOT state.currentAssessment.id
```

### UUID vs Temporary ID Handling
**Backend APIs expect real UUIDs, not temporary IDs.**

```javascript
if (sectionData.action === 'add' || sectionId.startsWith('temp_')) {
    // Use ADD API - don't send temp ID
    dispatch('MAKE_ADD_SECTION_REQUEST', {requestBody});
} else {
    // Use UPDATE API - send real UUID
    dispatch('MAKE_SECTION_UPDATE_REQUEST', {requestBody, sectionId});
}
```

## PGI (Problem-Goal-Intervention) Patterns

### State-Based Refresh for PGI Operations
**HTTP effect meta parameters don't work reliably - use state-based refresh.**

```javascript
// Store context before API call
'SAVE_INTERVENTION_TO_GOAL': (coeffects) => {
    updateState({
        lastAddedInterventionGoalId: goalId  // Store for success handler
    });
    dispatch('MAKE_ADD_INTERVENTION_REQUEST', {requestBody});
},

// Use stored context in success handler
'ADD_INTERVENTION_SUCCESS': (coeffects) => {
    const goalId = state.lastAddedInterventionGoalId;
    if (goalId && state.currentAssessmentId) {
        updateState({ lastAddedInterventionGoalId: null });
        dispatch('LOAD_GOAL_INTERVENTIONS', {
            goalId: goalId,
            guidelineTemplateId: state.currentAssessmentId
        });
    }
}
```

### PGI Creation Refresh Pattern
After creating PGI items, refresh BOTH modal relationships AND hierarchical data:

```javascript
'ADD_GOAL_SUCCESS': (coeffects) => {
    // 1. Refresh modal relationships
    if (answerId) {
        dispatch('LOAD_ANSWER_RELATIONSHIPS', {answerId});
    }

    // 2. Refresh hierarchical data for expanded items
    Object.keys(state.expandedProblems || {}).forEach(problemId => {
        if (state.expandedProblems[problemId] === true) {
            dispatch('LOAD_PROBLEM_GOALS', {
                problemId: problemId,
                guidelineTemplateId: state.currentAssessmentId
            });
        }
    });
}
```

## System Message Pattern
**Always surface backend messages to users:**

```javascript
'ACTION_SUCCESS': (coeffects) => {
    let systemMessage = 'Operation completed successfully!';
    let messageType = 'success';

    if (action.payload && action.payload.detail) {
        systemMessage = action.payload.detail;
        if (systemMessage.toLowerCase().includes('duplicate')) {
            messageType = 'warning';
        }
    }

    updateState({
        systemMessages: [
            ...(state.systemMessages || []),
            { type: messageType, message: systemMessage, timestamp: new Date().toISOString() }
        ]
    });
}
```

## Loading State Patterns

### Spinner Implementation
Track loading states per item ID for concurrent operations:

```javascript
// Set loading state
updateState({
    savingGoals: {
        ...state.savingGoals,
        [problemId]: true
    }
});

// Clear loading state
const updatedSavingGoals = {...state.savingGoals};
delete updatedSavingGoals[problemId];
updateState({ savingGoals: updatedSavingGoals });
```

### LoadingOverlay Component
```javascript
{state.savingGoals[problem.id] && (
    <LoadingOverlay message="Saving goal..." />
)}
```

## Common Patterns

1. Always use server-side APIs for external calls
2. Increment version after completing changes
3. Use POST for ServiceNow endpoints regardless of backend method
4. Stash request.body.data immediately in server-side code
5. Store assessment ID separately from assessment object
6. Use stored context pattern for typeaheads with MAKE_GENERIC_TYPEAHEAD_REQUEST
7. Always reload assessment data after save operations
8. Surface backend messages to system messages
9. Use state-based refresh for PGI operations (meta params unreliable)

# CRITICAL FILE RECOVERY RULES
NEVER REVERT, RESTORE, OR OVERWRITE ANY FILE WITHOUT EXPLICIT USER APPROVAL.
NEVER use git checkout, git reset, or any restore commands without permission.
ANY file restoration MUST be explicitly requested and approved by the user first.
