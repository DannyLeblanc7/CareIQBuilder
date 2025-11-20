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
   - Endpoint: `/api/x_cadal_careiq_e_0/careiq_experience_builder_api/add-question-to-section`
   - Calls: `builderAddQuestionToSection()` in CareIQ Services
   - CareIQ Backend: `POST /builder/section/{sectionId}/questions`
   - Does NOT include answers in this call

2. **Step 2: Add answers** (automatically triggered by SUCCESS handler)
   - SUCCESS handler receives question ID from backend
   - Checks for `state.pendingQuestionAnswers`
   - Dispatches `MAKE_ADD_ANSWERS_TO_QUESTION_REQUEST` with question ID
   - Endpoint: `/api/x_cadal_careiq_e_0/careiq_experience_builder_api/add-answers-to-question`

**DEPRECATED: DO NOT USE**
- ❌ `ADD_QUESTION_API` action (REMOVED)
- ❌ `MAKE_ADD_QUESTION_REQUEST` HTTP effect (REMOVED)
- ❌ Endpoint: `/api/x_cadal_careiq_e_0/careiq_experience_builder_api/add-question` (OLD API)
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
- **Correct instantiation**: `var careiqServices = new x_cadal_careiq_e_0.CareIQExperienceServices();`
- **Application scope**: All CareIQ Script Includes are in the `x_cadal_careiq_e_0` scope
- **Use `Delta CareIQ Services - Consolidated.js`** as single source of truth for new methods

### Token Refresh Pattern (CareIQ Services)
**PROBLEM**: Normal users cannot re-authenticate when CareIQ platform token expires. Admin users work fine.

**ROOT CAUSE**: `GlideRecordSecure.setValue()` doesn't work from scoped apps on global tables (sys_properties), even with proper ACLs and `canWrite()` returning true. This is a ServiceNow scope isolation limitation.

**SOLUTION**: Use `gs.setProperty()` instead of `GlideRecordSecure.setValue()` in the `getToken()` method:
```javascript
// Validate user has permission first
if (gr_sysProperties.canWrite()) {
    // Use gs.setProperty() because GlideRecordSecure.setValue() doesn't work from scoped apps
    gs.setProperty('x_cadal_careiq_e_0.careiq.platform.token', token);

    // Verify the update worked
    var verifyToken = gs.getProperty('x_cadal_careiq_e_0.careiq.platform.token');
    if (verifyToken === token) {
        return true;
    }
}
```

**APP REVIEW NOTES**:
- Must request exception for `gs.setProperty()` usage
- Remove `getRowCount()` calls to avoid scalability warnings
- Comprehensive logging added for diagnostics

**STATUS (2025-11-11)**: Fix applied to `CareIQ Services.js`. Awaiting app review approval for gs.setProperty() usage.

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

### CRITICAL: Duplicate Custom Attributes Fix Pattern (2025-11-20)
**PROBLEM**: JavaScript objects can't have duplicate keys - when user types a duplicate key, the first entry disappears because objects merge duplicate keys.

**SOLUTION**: Use array storage during editing, convert to object for API calls.

**✅ VERIFIED WORKING PATTERN** (Applied to Problems custom attributes v1.0.077):

#### 1. Data Loading - Convert Object to Array
In `GET_PROBLEM_DETAILS_SUCCESS` handler (lines ~13475-13501):
```javascript
// Convert custom_attributes from object to array for UI handling
const customAttrsObj = action.payload.custom_attributes || {};
const customAttrsArray = Object.entries(customAttrsObj).map(([key, value]) => ({key, value}));

updateState({
    editingProblemData: {
        label: action.payload.label || '',
        custom_attributes: customAttrsArray  // Array instead of object
    }
});
```

#### 2. UI Rendering - Array-Based Handlers
**Empty Check**: `state.editingProblemData.custom_attributes.length > 0`

**Map Function**: `state.editingProblemData.custom_attributes.map((attr, index) => (`

**Key Input Handler**:
```javascript
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

**Value Input Handler**:
```javascript
oninput={(e) => {
    const newValue = e.target.value;
    const updatedAttrs = [...state.editingProblemData.custom_attributes];
    updatedAttrs[index] = {key: attr.key, value: newValue};
    updateState({
        editingProblemData: {
            ...state.editingProblemData,
            custom_attributes: updatedAttrs
        }
    });
}}
```

**Remove Button**:
```javascript
onclick={(e) => {
    e.stopPropagation();
    const updatedAttrs = state.editingProblemData.custom_attributes.filter((_, idx) => idx !== index);
    updateState({
        editingProblemData: {
            ...state.editingProblemData,
            custom_attributes: updatedAttrs
        }
    });
}}
```

**Add Button**:
```javascript
onclick={() => {
    updateState({
        editingProblemData: {
            ...state.editingProblemData,
            custom_attributes: [
                ...state.editingProblemData.custom_attributes,
                {key: '', value: ''}
            ]
        }
    });
}}
```

#### 3. Duplicate Detection - Real-time Visual Feedback
**Red Border on Key Input**:
```javascript
style={{
    flex: '1',
    padding: '6px 8px',
    border: (() => {
        const isDuplicate = state.editingProblemData.custom_attributes.some((item, idx) =>
            idx !== index && item.key === attr.key && attr.key !== ''
        );
        return isDuplicate ? '2px solid #dc3545' : '1px solid #d1d5db';
    })(),
    borderRadius: '4px',
    fontSize: '12px'
}}
```

**Inline Error Message** (after remove button):
```javascript
{(() => {
    const isDuplicate = state.editingProblemData.custom_attributes.some((item, idx) =>
        idx !== index && item.key === attr.key && attr.key !== ''
    );
    return isDuplicate ? (
        <span style={{color: '#dc3545', fontSize: '11px', marginLeft: '8px', fontWeight: '500'}}>
            ⚠️ Duplicate key
        </span>
    ) : null;
})()}
```

**Warning Banner** (before Add Attribute button):
```javascript
{(() => {
    const attrs = state.editingProblemData.custom_attributes || [];
    const hasDuplicates = attrs.some((item1, idx1) =>
        attrs.some((item2, idx2) =>
            idx1 !== idx2 && item1.key !== '' && item1.key === item2.key
        )
    );
    return hasDuplicates ? (
        <div style={{
            color: '#dc3545',
            fontSize: '12px',
            marginBottom: '8px',
            fontWeight: '500',
            padding: '8px',
            backgroundColor: '#fee2e2',
            borderRadius: '4px',
            border: '1px solid #dc3545'
        }}>
            ⚠️ Duplicate keys detected. Please fix before saving or adding more attributes.
        </div>
    ) : null;
})()}
```

**Disabled Add Button**:
```javascript
<button
    disabled={(() => {
        const attrs = state.editingProblemData.custom_attributes || [];
        return attrs.some((item1, idx1) =>
            attrs.some((item2, idx2) =>
                idx1 !== idx2 && item1.key !== '' && item1.key === item2.key
            )
        );
    })()}
    style={{
        background: (() => {
            const attrs = state.editingProblemData.custom_attributes || [];
            const hasDuplicates = attrs.some((item1, idx1) =>
                attrs.some((item2, idx2) =>
                    idx1 !== idx2 && item1.key !== '' && item1.key === item2.key
                )
            );
            return hasDuplicates ? '#94a3b8' : '#3b82f6';
        })(),
        cursor: (() => {
            const attrs = state.editingProblemData.custom_attributes || [];
            const hasDuplicates = attrs.some((item1, idx1) =>
                attrs.some((item2, idx2) =>
                    idx1 !== idx2 && item1.key !== '' && item1.key === item2.key
                )
            );
            return hasDuplicates ? 'not-allowed' : 'pointer';
        })(),
        // ... other static styles
    }}
>
```

#### 4. Save Validation - Array to Object Conversion
In `SAVE_PROBLEM_EDITS` handler (lines ~12724-12834):
```javascript
'SAVE_PROBLEM_EDITS': (coeffects) => {
    const customAttrsArray = editData.custom_attributes || [];

    // Validation: Check for duplicates
    const keys = customAttrsArray.map(item => item.key).filter(k => k !== '');
    const hasDuplicates = keys.length !== new Set(keys).size;
    if (hasDuplicates) {
        updateState({
            systemMessages: [...(state.systemMessages || []), {
                type: 'error',
                message: 'Cannot save: Duplicate custom attribute keys detected.',
                timestamp: new Date().toISOString()
            }]
        });
        return;
    }

    // Validation: Check for empty keys
    const hasEmptyKeys = customAttrsArray.some(item => item.key === '');
    if (hasEmptyKeys) {
        updateState({
            systemMessages: [...(state.systemMessages || []), {
                type: 'error',
                message: 'Cannot save: Custom attributes cannot have empty keys.',
                timestamp: new Date().toISOString()
            }]
        });
        return;
    }

    // Conversion: Array to Object for API
    const customAttrsObj = customAttrsArray.reduce((acc, item) => {
        if (item.key !== '') {
            acc[item.key] = item.value;
        }
        return acc;
    }, {});

    const requestBody = JSON.stringify({
        problemId: problemId,
        custom_attributes: customAttrsObj,  // Send object to API
        // ... other fields
    });

    dispatch('MAKE_UPDATE_PROBLEM_REQUEST', {requestBody});
}
```

**KEY INSIGHTS**:
- Arrays allow duplicate keys to coexist for validation UI
- Convert Object → Array on load, Array → Object on save
- Use index-based updates, not key-based
- IIFE functions in JSX for real-time duplicate detection
- Defense in depth: UI validation + save handler validation

**NEXT STEPS**: Apply same pattern to Goals and Interventions custom attributes.

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

### CRITICAL: Library Question Update Pattern
**PROBLEM**: When editing tooltip or custom_attributes on library questions, changes fail to save with error:
```
Error: Input should be a valid UUID, invalid character: expected an optional prefix of `urn:uuid:` followed by [0-9a-fA-F-], found `t` at 1
Input: "temp_1762896771467_1pvx8dxqp"
```

**KEY OBSERVATION**: Editing "required" field works, but tooltip/custom_attributes fail!

**ROOT CAUSE**: Action preservation inconsistency!
- Library questions get `action: 'library_replace'` in `questionChanges` state
- Library questions have temp IDs (`temp_xxx`) and go through ADD_QUESTION_TO_SECTION_API
- `UPDATE_QUESTION_REQUIRED` handler (line ~11134) preserves BOTH 'add' AND 'library_replace' actions
- `SAVE_TOOLTIP_EDIT` handler (line ~17995) only preserved 'add', NOT 'library_replace'
- `SAVE_CUSTOM_ATTRIBUTES` handler (line ~18201) only preserved 'add', NOT 'library_replace'

**RESULT**: When tooltip/custom_attributes changed, action changed from 'library_replace' to 'update', causing library questions to go through UPDATE_QUESTION_API (wrong path) instead of ADD_QUESTION_TO_SECTION_API (correct path).

**SOLUTION**: Update action preservation in both handlers to match UPDATE_QUESTION_REQUIRED pattern:
```javascript
// BEFORE (wrong - loses 'library_replace'):
action: state.questionChanges?.[questionId]?.action === 'add' ? 'add' : 'update',

// AFTER (correct - preserves 'library_replace'):
action: (state.questionChanges?.[questionId]?.action === 'add' || state.questionChanges?.[questionId]?.action === 'library_replace')
    ? state.questionChanges?.[questionId]?.action
    : 'update',
```

**LOCATIONS FIXED**:
1. Line ~17996 in `SAVE_TOOLTIP_EDIT` handler
2. Line ~18205 in `SAVE_CUSTOM_ATTRIBUTES` handler

**ERROR HANDLING**: Also improved `UPDATE_QUESTION_ERROR` handler to properly extract backend validation errors from FastAPI/Pydantic `detail` array format.

**AFFECTED OPERATIONS**: Editing tooltip or custom_attributes on newly added library questions (with temp IDs).

**ADDITIONAL FIX 1**: Custom attributes were hardcoded to empty objects `{}` in all ADD_QUESTION_TO_SECTION_API calls. Fixed 6 locations to use `question.custom_attributes || {}` instead:
1. Line ~11577 in SAVE_QUESTION_IMMEDIATELY (Text/Date/Numeric)
2. Line ~11616 in SAVE_QUESTION_IMMEDIATELY (Single Select/Multiselect)
3. Line ~15186 in CONTINUE_QUESTION_SAVE_AFTER_CHECK (Text/Date/Numeric)
4. Line ~15201 in CONTINUE_QUESTION_SAVE_AFTER_CHECK (Single Select/Multiselect)
5. Line ~18988 in SAVE_ALL_CHANGES (action === 'add')
6. Line ~19032 in SAVE_ALL_CHANGES (action === 'library_replace')

**ADDITIONAL FIX 2**: When building questionData payload, tooltip and custom_attributes were read directly from `question` object, but should check `questionChanges` FIRST like the working `voice` field pattern:
```javascript
// WORKING PATTERN (voice):
const currentVoice = state.questionChanges?.[questionId]?.voice || question.voice || 'Patient';

// FIXED PATTERN (custom_attributes):
const currentCustomAttributes = state.questionChanges?.[questionId]?.custom_attributes !== undefined
    ? state.questionChanges?.[questionId]?.custom_attributes
    : (question.custom_attributes || {});
```

**WHY**: `SAVE_CUSTOM_ATTRIBUTES` and `SAVE_TOOLTIP_EDIT` update BOTH the question object in `state.currentQuestions.questions` AND the `state.questionChanges`. When user edits custom attributes on a library question and clicks Save, the most recent values exist in `questionChanges` and must be checked first.

**LOCATIONS FIXED**:
- Lines ~11560-11604 in SAVE_QUESTION_IMMEDIATELY (both Text/Date/Numeric and Single Select/Multiselect)
- Line ~18985 in SAVE_ALL_CHANGES (action === 'add')
- Lines ~19029, ~19032-19034 in SAVE_ALL_CHANGES (action === 'library_replace') - made consistent to check currentQuestion first

**STATUS (2025-11-11)**: ✅ **RESOLVED** - Fixed action preservation, hardcoded empty custom_attributes, and added questionChanges priority check for tooltip/custom_attributes fields.

**CRITICAL DUAL BUG FIX (2025-11-11)**: Both frontend AND server-side were stripping `custom_attributes` for library questions!

**BUG #1 - Frontend (line ~19490 in index.js)**: The `ADD_QUESTION_TO_SECTION_API` action handler built different request payloads:
- **Library questions**: "minimal payload" with NO `custom_attributes`
- **Regular questions**: Full payload WITH `custom_attributes`

**FIX #1**: Added `custom_attributes: questionData.custom_attributes || {}` to line 19490 in the library question requestBodyData.

**BUG #2 - Server-side (line 1455 in CareIQ Services.js)**: The `builderAddQuestionToSection` method also had different payloads:
- **Library questions**: "minimal payload" with NO `custom_attributes`
- **Regular questions**: Full payload WITH `custom_attributes`

**FIX #2**: Added `custom_attributes: custom_attributes || {}` to line 1455 in the library question payload.

**ROOT CAUSE**: Both frontend AND server-side were using "minimal payloads" for library questions that excluded custom_attributes. Postman testing confirmed the CareIQ backend accepts and stores `custom_attributes` correctly - both bugs were in the middleware layers.

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

## Troubleshooting: Edit/Write Tool Issues

### Background
During development session on 2025-11-10, the Edit and Write tools experienced intermittent failures with "File has been unexpectedly modified" errors. This happened even when:
- No editor was open
- No hot-reload/auto-publish processes were running
- No linters or formatters were active
- File contents hadn't actually changed

### Root Cause (Unknown)
The exact cause was never determined. The Edit tool worked fine on this project for months prior, then suddenly started failing consistently for a brief period before recovering.

### Workaround Used
When Edit/Write tools failed, we successfully used:
1. **Node.js scripts** with `fs.readFileSync` and `fs.writeFileSync` for complex edits
2. **sed commands** for simple string replacements (version numbers, single-line changes)
3. **Manual edits** as last resort when tools completely failed

### Resolution
After a period of failures, the Edit/Write tools began working normally again without any changes to the system. The issue appeared to be transient.

### Lessons Learned
- If Edit tool fails 2-3 times in a row, immediately switch to Node/sed approach
- Don't attempt dozens of Edit retries hoping for different results
- Node.js file manipulation is reliable fallback: `fs.readFileSync` → modify → `fs.writeFileSync`
- Keep backup approach ready for future transient tool issues



# CRITICAL FILE RECOVERY RULES
NEVER REVERT, RESTORE, OR OVERWRITE ANY FILE WITHOUT EXPLICIT USER APPROVAL.
NEVER use git checkout, git reset, or any restore commands without permission.
ANY file restoration MUST be explicitly requested and approved by the user first.
# CRITICAL GIT RULES
**NEVER DIRECTLY USE GIT COMMANDS** - User handles all git operations (commit, push, revert, etc.)
- DO NOT run git add, git commit, git push, git checkout, git reset, or any git commands
- User manages their own git workflow and backups
- You can run Node.js scripts and other build/test commands freely without asking
- Only git operations require user approval
