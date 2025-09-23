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

### CRITICAL: Complete Data Flow Pattern (Component → ServiceNow → CareIQ)
**The MOST IMPORTANT pattern to understand for avoiding "Missing required fields" errors**

#### Full Data Flow:
1. **Component Action** → Creates request payload
2. **HTTP Effect** → Sends to ServiceNow API
3. **ServiceNow API** → Processes and forwards to CareIQ platform
4. **CareIQ Platform** → Returns response
5. **ServiceNow API** → Returns response to component
6. **Component** → Processes response

#### Critical Pattern Rules:

**STEP 1 - Component to ServiceNow API (HTTP Effect Body):**
```javascript
// Component dispatch - NEVER use data wrapper
const requestBody = JSON.stringify({
    answerId: answerId,           // Direct fields in root
    guidelineId: guidelineId,     // NO data: {} wrapper!
    // ... other fields directly in root
});

dispatch('MAKE_API_REQUEST', {requestBody});
```

**STEP 2 - ServiceNow API receives and processes:**
```javascript
// ServiceNow API - ALWAYS use request.body.data
var requestData = request.body.data;  // ServiceNow wraps in .data

// Validate fields are in requestData
if (!requestData.answerId || !requestData.guidelineId) {
    // Missing required fields error
}
```

**STEP 3 - ServiceNow to CareIQ platform (varies by API):**
```javascript
// Most APIs: Direct field pattern (NO data wrapper)
var careiqPayload = {
    answerId: requestData.answerId,
    guidelineId: requestData.guidelineId
    // Direct fields - check existing working APIs!
};

// Some newer APIs: Data wrapper pattern
var careiqPayload = {
    data: {
        answerId: requestData.answerId,
        guidelineId: requestData.guidelineId
    }
};
```

#### The "Missing required fields" Error Explained:
This error occurs when Step 1 (component) uses wrong pattern. Common mistakes:

❌ **WRONG - Using data wrapper in component:**
```javascript
const requestBody = JSON.stringify({
    data: {  // THIS CAUSES THE ERROR!
        answerId: answerId,
        guidelineId: guidelineId
    }
});
// Result: ServiceNow receives {data: {data: {fields}}}
// Server accesses request.body.data.data.answerId (undefined!)
```

✅ **CORRECT - Direct fields in component:**
```javascript
const requestBody = JSON.stringify({
    answerId: answerId,        // Direct in root
    guidelineId: guidelineId   // ServiceNow will wrap in .data
});
// Result: ServiceNow receives {data: {answerId, guidelineId}}
// Server accesses request.body.data.answerId (works!)
```

#### Pattern Summary:
- **Component**: Direct fields `{field: value}`
- **ServiceNow receives**: Wrapped `{data: {field: value}}`
- **ServiceNow accesses**: `request.body.data.field`
- **To CareIQ**: Check existing APIs for pattern (usually direct fields)

### CareIQ Services Script Include Pattern
**CRITICAL**: When calling CareIQ Services Script Include from Scripted REST APIs:

- **Correct instantiation**: `var careiqServices = new x_1628056_careiq.CareIQServices();`
- **Application scope**: All CareIQ Script Includes are in the `x_1628056_careiq` scope
- **Pattern for refactored APIs**: Instead of duplicating API call logic, call Script Include methods

### Example:
```javascript
// In Scripted REST API
var careiqServices = new x_1628056_careiq.CareIQServices();
var responseBody = careiqServices.getBuilderSectionQuestions(gtId, sectionId);
response.getStreamWriter().writeString(responseBody);
```

**This pattern eliminates**: Config passing, token management, URL building, error handling - all handled by Script Include.

### Relationship Editing State Reset Pattern
When refreshing assessment data (like in `ASSESSMENT_DETAILS_SUCCESS`), always reset relationship editing state to return to clean UI:

```javascript
// Reset relationship editing state after refresh - return to original state
showRelationships: false,                    // Unchecks "Edit Relationships" button
answerRelationships: {},                    // Clear all expanded relationship data - closes panels
relationshipsLoading: {},                   // Clear loading states
relationshipVisibility: {},                 // Clear visibility tracking
selectedRelationshipQuestion: null,         // Clears selected relationship
selectedRelationshipType: null,             // Clears relationship type
relationshipTypeaheadText: '',              // Clears typeahead input
relationshipTypeaheadResults: [],           // Clears typeahead results
relationshipTypeaheadLoading: false,        // Stops loading state
currentGuidelineSearchAnswerId: null        // Clears cached answer ID
```

**Critical**: The key to closing relationship panels is `answerRelationships: {}` - panels are open when `state.answerRelationships[answerId]` exists.

### Version Management
- **Always increment the last digit** in package.json version when making changes
- Current pattern: 0.0.xxx (increment xxx)
- **CRITICAL: Update version after EVERY development cycle** - after completing any set of changes (even if just 1 change), always update package.json version before finishing
- **TIMING: Increment version at the END of work, not the beginning** - Only increment after changes are completed and verified to work

### CareIQ API Integration
- **Dynamic URL building** using client-provided parameters:
  - Token Exchange: `https://{app}.{region}.careiq.cadalysapp.com/api/{version}/auth/token`
  - Use Case Categories: `https://{app}.{region}.careiq.cadalysapp.com/api/{version}/builder/use-case-category?use_case={useCase}`
- **Required system properties** (prefix: `x_1628056_careiq.careiq.platform.`):
  - apikey, app, id, otoken, region, version
- **Authentication flow**: Config → Token Exchange → API calls with Bearer token

## UI/UX Patterns

### System Messages Window
- **Fixed height container** (250px) with scroll for overflow
- **Header**: "System Messages"
- **Message types**: loading, success, warning, error with specific styling
- **Custom scrollbar styling** for webkit browsers

### Component State Management
- Use ServiceNow UI-Core action handlers pattern
- HTTP effects with start/success/error action types
- State updates via `updateState()` method

### Flex Input Layout Fix Pattern
**CRITICAL**: When inputs are truncated in flex containers, apply this complete fix pattern.

**Problem**: Input fields in flex layouts don't extend to available space, appearing truncated before adjacent elements (like tooltip icons).

**Solution**: Apply flex properties to BOTH container and input:
```scss
.container {
  flex: 1;           // Take remaining space in parent flex
  width: 100%;       // Full width within flex item
  min-width: 0;      // Allow shrinking below content width
}

.input {
  flex: 1;           // Take remaining space in container
  width: 100%;       // Full width within container
  min-width: 0;      // Allow shrinking below content width
  box-sizing: border-box; // Include padding in width calculation
}
```

**Key Insight**: Both `flex: 1` AND `width: 100%` are needed. `flex: 1` alone is insufficient for input elements to extend fully.

**Applied to**: `.typeahead-container` and `.question-label-input` classes

### Typeahead Dropdown Close Pattern
**CRITICAL**: For consistent UX, all typeahead dropdowns must implement click-outside and Escape key behavior.

**Required Implementation**:
1. **Create HIDE action**: `[NAME]_TYPEAHEAD_HIDE` action that clears dropdown results and search state
2. **Input event handlers**:
   ```javascript
   onkeydown={(e) => {
       if (e.key === 'Escape') {
           dispatch('[NAME]_TYPEAHEAD_HIDE');
       }
   }}
   onblur={(e) => {
       // Hide after delay to allow item selection
       setTimeout(() => {
           dispatch('[NAME]_TYPEAHEAD_HIDE');
       }, 150);
   }}
   ```

**Behavior Requirements**:
- ✅ **Click outside**: Close with 150ms delay (allows item selection)
- ✅ **Escape key**: Close immediately
- ✅ **Empty input**: Keep open (don't close on empty)
- ✅ **While focused**: Keep open while typing
- ✅ **Tab switching**: Close when switching contexts
- ✅ **Item selection**: Close when item is selected

**State Cleanup**: HIDE action must clear both dropdown results and any stored search context (e.g., `currentGuidelineSearchAnswerId`)

**Example**: See guideline typeahead implementation with `GUIDELINE_TYPEAHEAD_HIDE` action

## File Structure
- `src/cadal-careiq-builder/index.js` - Main component
- `src/cadal-careiq-builder/styles.scss` - Component styles
- `token-exchange-fixed.js` - Server-side token exchange API
- `use-case-categories-api.js` - Server-side use case categories API
- `package.json` - Package configuration and version

## Development Commands
- No specific build/test commands configured yet
- Ask user for lint/typecheck commands if needed

## ServiceNow UI Core - Select Element Pattern
**CRITICAL**: ServiceNow's snabbdom virtual DOM has issues with select element `value` attribute binding. 

**Correct Pattern for Dropdowns**:
```javascript
<select onchange={...}>
  <option value="Single Select" selected={question.type === 'Single Select'}>Single Select</option>
  <option value="Multiselect" selected={question.type === 'Multiselect'}>Multiselect</option>
</select>
```

**Incorrect Pattern** (doesn't work in ServiceNow):
```javascript
<select value={question.type} onchange={...}>
  <option value="Single Select">Single Select</option>
</select>
```

Use `selected` attributes on individual options with boolean conditions instead of `value` on the select element.

## Debug Settings
- Global debug flag: `x_1628056_careiq.careiq.platform.globalDebug`
- When enabled, logs detailed request/response information

## Common Patterns to Follow
1. Always use server-side APIs for external calls
2. Increment version on any changes
3. Use POST for ServiceNow endpoints regardless of backend method
4. Stash request.body.data immediately in server-side code
5. Use safe error handling patterns
6. Follow existing UI component patterns for state management
7. Use dynamic URL building for CareIQ endpoints
8. **ALWAYS wrap HTTP effect body data in `data` property** - this prevents "Missing required fields" errors
9. **Store assessment ID separately** - use `state.currentAssessmentId` for API calls, not `state.currentAssessment.id`
10. **Do not add "simplified" suffix to endpoint URLs** - keep endpoint names clean (e.g., `/update-section` not `/update-section-simplified`)

## CRITICAL PATTERN: Local Changes Then Save
**NEVER call backend APIs directly from UI actions like ADD_SECTION, EDIT_SECTION, etc.**

### Correct Pattern:
1. **UI Actions**: Make local changes to state (add, edit, delete)
2. **Track Changes**: Store changes in `sectionChanges`, `questionChanges`, `answerChanges`
3. **Save Action**: Only call backend APIs when user clicks "Save" button
4. **Batch Operations**: Save all changes in one save operation with multiple API calls
5. **Auto-refresh**: After all queued actions complete successfully, reload the assessment data

### Example:
- `ADD_SECTION` → Add to local state + track in `sectionChanges`
- `EDIT_SECTION_NAME` → Update local state + track in `sectionChanges`  
- `DELETE_SECTION` → Remove from local state + track in `sectionChanges`
- `SAVE_ALL_CHANGES` → Call backend APIs for all tracked changes

This allows users to make multiple changes and review them before committing to the backend.

### Save and Refresh Pattern:
After successful save operations, the assessment data must be refreshed to reflect server state:
```javascript
// In ALL SUCCESS action handlers (SECTION_UPDATE_SUCCESS, DELETE_SECTION_SUCCESS, etc.):
1. Store current section for reselection: const currentSection = state.selectedSection;
2. Clear all change tracking arrays: sectionChanges: {}, questionChanges: {}, answerChanges: {}
3. Update success message indicating refresh: "Changes saved successfully! Refreshing data..."
4. Store pending reselection data: pendingReselectionSection: currentSection
5. Dispatch FETCH_ASSESSMENT_DETAILS to reload complete assessment structure
```

**Critical**: The refresh ensures the UI displays server state after all operations complete, including any server-side processing, ID updates, or validation changes.

**Pattern Must Be Applied To**: Every success handler for CRUD operations (UPDATE_SUCCESS, DELETE_SUCCESS, ADD_SUCCESS) to maintain UI consistency with server state.

## CRITICAL PATTERN: Save/Cancel Button Display
**ALWAYS update change tracking when adding new functionality that modifies assessment data.**

### Rule: Any Action That Changes Data Must Update Change Tracking
When implementing any action that modifies assessment data, you MUST:

1. **Update the appropriate change tracking object** (`sectionChanges`, `questionChanges`, `answerChanges`)
2. **Ensure save/cancel buttons appear** by checking if tracking objects have changes
3. **Test that save button works** after implementing new functionality

### Examples of Actions That Must Update Tracking:
- `ADD_QUESTION` → Update `questionChanges`
- `ADD_ANSWER` → Update `answerChanges` 
- `UPDATE_QUESTION_TYPE` → Update `questionChanges`
- `EDIT_SECTION_NAME` → Update `sectionChanges`
- `DELETE_QUESTION` → Update `questionChanges`
- `REORDER_QUESTIONS` → Update `questionChanges`

### Save Button Display Logic:
```javascript
// Save button appears when ANY change tracking object has changes
{(Object.keys(state.sectionChanges || {}).length > 0 || 
  Object.keys(state.questionChanges || {}).length > 0 || 
  Object.keys(state.answerChanges || {}).length > 0) && (
  <button onclick={() => dispatch('SAVE_ALL_CHANGES')}>Save Changes</button>
)}
```

### Change Tracking Pattern:
```javascript
'ACTION_NAME': (coeffects) => {
    // 1. Perform the data change
    updateState({ /* update main data */ });
    
    // 2. ALWAYS update change tracking
    updateState({
        questionChanges: {
            ...state.questionChanges,
            [itemId]: {
                ...state.questionChanges[itemId],
                // track what changed
            }
        }
    });
}
```

**CRITICAL**: If you forget to update change tracking, users won't see the save button and changes will be lost!

## CRITICAL PATTERN: Post-Save Reload (ALWAYS Required)
**ALWAYS reload assessment data after ANY save operation completes successfully.**

### Rule: Every SUCCESS Handler Must Reload
ALL save success handlers must trigger `FETCH_ASSESSMENT_DETAILS` to refresh the entire assessment:

```javascript
'[OPERATION]_SUCCESS': (coeffects) => {
    // 1. Store current context for reselection
    const currentSection = state.selectedSection;

    // 2. Clear change tracking
    updateState({
        sectionChanges: {},
        questionChanges: {},
        answerChanges: {},
        relationshipChanges: {}
    });

    // 3. ALWAYS reload assessment data
    if (state.currentAssessmentId) {
        dispatch('FETCH_ASSESSMENT_DETAILS', {
            assessmentId: state.currentAssessmentId,  // Use stored ID
            assessmentTitle: state.currentAssessment?.title || 'Assessment'
        });
    }
}
```

### Operations That Must Include Reload:
- `DELETE_SECTION_SUCCESS` ✅
- `ADD_SECTION_SUCCESS` ✅
- `SECTION_UPDATE_SUCCESS` ✅
- `ADD_QUESTION_SUCCESS` ⚠️ (currently only refreshes questions)
- `DELETE_QUESTION_SUCCESS`
- `UPDATE_QUESTION_SUCCESS`
- `ADD_ANSWER_SUCCESS`
- `DELETE_ANSWER_SUCCESS`
- `UPDATE_ANSWER_SUCCESS`

### Why Reload Is Critical:
1. **Clears save button** (change tracking reset)
2. **Reflects server state** (including server-side processing)
3. **Updates IDs** (temp IDs become real UUIDs)
4. **Maintains UI consistency** with backend truth

## CRITICAL PATTERN: Section Auto-Save on Checkmark
**Sections have special auto-save behavior**: When user clicks checkmark (✓) to confirm section edit, automatically save ALL pending changes.

### Implementation:
```javascript
'PROCEED_WITH_SECTION_SAVE': (coeffects) => {
    // 1. Update section data locally
    updateState({ /* section updates */ });

    // 2. AUTO-SAVE: Save ALL pending changes immediately
    dispatch('SAVE_ALL_CHANGES');
}
```

### Behavior:
- ✅ **Checkmark click** → Save section + question changes + answer changes + relationship changes
- ✅ **Immediate save** → No separate "Save Changes" button click needed
- ✅ **Full reload** → Assessment data refreshes after save completes
- ✅ **User feedback** → Shows "Saving changes to backend..." message

### Why This Pattern:
- **Better UX**: Section edits feel immediate and committed
- **Reduces confusion**: No pending changes left hanging after section edit
- **Consistent state**: UI always reflects what user just confirmed

## CRITICAL PATTERN: Assessment ID Access
**PROBLEM**: `state.currentAssessment` from API responses does NOT contain the assessment ID.

### Root Cause:
- Assessment cards click with `assessment.id` 
- This ID is passed to `OPEN_ASSESSMENT_BUILDER` and `FETCH_ASSESSMENT_DETAILS`
- But API response for assessment details doesn't include the ID in the payload
- Trying to access `state.currentAssessment.ids?.id` or `state.currentAssessment.id` returns `undefined`

### Correct Pattern:
1. **Store ID separately**: In `OPEN_ASSESSMENT_BUILDER` save `currentAssessmentId: assessmentId`
2. **Use stored ID**: Always use `state.currentAssessmentId` for API calls requiring assessment ID
3. **NEVER use hardcoded fallback values** - this masks the real issue

### Example:
```javascript
// OPEN_ASSESSMENT_BUILDER - Store the ID
updateState({
    currentAssessmentId: assessmentId // Store separately!
});

// Later in ADD_SECTION_SUCCESS - Use stored ID
const assessmentId = state.currentAssessmentId; // NOT state.currentAssessment.id
dispatch('FETCH_ASSESSMENT_DETAILS', {assessmentId});

// In ADD_SECTION - Use stored ID for gt_id
gt_id: state.currentAssessmentId // NOT hardcoded value
```

**This pattern prevents "Missing required fields: assessmentId" errors.**

## UUID vs Temporary ID Handling
**CRITICAL**: Backend APIs expect real UUIDs, not temporary IDs.

### Pattern for New vs Existing Items:
```javascript
// Check if this is new (temp ID) or existing (real UUID)
if (sectionData.action === 'add' || sectionId.startsWith('temp_')) {
    // Use ADD API - don't send temp ID to backend
    dispatch('MAKE_ADD_SECTION_REQUEST', {requestBody});
} else {
    // Use UPDATE API - send real UUID
    dispatch('MAKE_SECTION_UPDATE_REQUEST', {requestBody, sectionId});
}
```

### Common Error:
```json
{
    "type": "uuid_parsing",
    "msg": "Input should be a valid UUID, invalid character: found `t` at 1",
    "input": "temp_1757686753933_al1c9554g"
}
```

### Solution:
- **New items**: Use add APIs, don't send temp IDs in request body or URL path
- **Existing items**: Use update APIs with real UUIDs
- **Always check**: `id.startsWith('temp_')` to identify local temporary items

## HTTP Effect Debugging Pattern
When ServiceNow APIs return "Missing required fields" errors, follow this debugging pattern:

### Common Error Response:
```json
{
    "data": {
        "error": "Missing required fields: region, version, accessToken, app, sectionId, label"
    },
    "status": 400
}
```

### Debugging Steps:
1. **Add detailed logging** to the dispatch handler:
   ```javascript
   console.log('Request body:', requestBody);
   console.log('Dispatch payload:', {requestBody: requestBody, sectionId: sectionId});
   console.log('Parsed request body:', JSON.parse(requestBody));
   ```

2. **Verify data wrapping** - Ensure request body follows the pattern:
   ```javascript
   const requestBody = JSON.stringify({
       data: {
           region: config.region,
           // ... all other fields inside data object
       }
   });
   ```

3. **Check HTTP effect configuration**:
   ```javascript
   'MAKE_API_REQUEST': createHttpEffect('/api/endpoint', {
       method: 'POST',
       dataParam: 'requestBody',  // Must match dispatch payload key
       headers: {'Content-Type': 'application/json'}
   })
   ```

4. **Verify server-side API** has matching field names and proper `request.body.data` access

### Root Causes:
- **MOST COMMON**: Wrong data wrapper pattern - mixing old and new patterns
- Mismatched field names between client and server
- HTTP effect `dataParam` not matching dispatch payload key
- Server-side API not accessing data correctly

## System Message Pattern for Backend Responses
**CRITICAL**: Always surface backend messages to system messages for user visibility.

### Pattern Implementation:
All SUCCESS action handlers should check for backend messages and surface them to users through system messages.

```javascript
'ACTION_SUCCESS': (coeffects) => {
    const {action, updateState, state, dispatch} = coeffects;

    // Default success message
    let systemMessage = 'Operation completed successfully!';
    let messageType = 'success';

    // Surface any backend detail messages to user
    if (action.payload && action.payload.detail) {
        systemMessage = action.payload.detail;
        // Classify message type based on content
        if (systemMessage.toLowerCase().includes('duplicate') ||
            systemMessage.toLowerCase().includes('already')) {
            messageType = 'warning'; // Informational, not error
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
}
```

### Use Cases:
- **Duplicate Prevention**: Backend prevents duplicates → Show as warning message
- **Validation Messages**: Backend validation feedback → Show as error/warning
- **Information Messages**: Backend status updates → Show as info messages
- **Success with Details**: Backend success with additional info → Enhanced success message

### Message Types:
- `success` - Operation completed successfully
- `warning` - Operation completed but with important information (duplicates, etc.)
- `error` - Operation failed
- `info` - General information messages

**Rule**: Never hide backend messages from users. Always surface them through the system messages UI for better user experience and debugging.

## Library Question/Answer Tracking Pattern
**CRITICAL**: Track library questions and answers for different save scenarios.

### Library Status Types:
1. **'unmodified'**: Library content with no changes → Save as library reference
2. **'modified'**: Library content that was changed → Save as new content based on library
3. **New content**: Non-library content → Save as completely new

### Implementation:
```javascript
// When replacing with library question/answer, track original data:
{
    action: 'library_replace', // or 'library_add' for answers
    isLibraryQuestion: true,   // or isLibraryAnswer: true
    libraryQuestionId: 'uuid',
    libraryStatus: 'unmodified',
    originalLibraryData: {
        label: 'original library text',
        type: 'Single Select',
        // ... other original fields
    },
    // ... current values
}

// When user modifies library content, update libraryStatus:
if (newValue !== existingChange.originalLibraryData.field) {
    libraryStatus = 'modified';
}
```

### Save Strategy:
- **Unmodified library**: Reference library ID, minimal API calls
- **Modified library**: Save as new with library metadata
- **New content**: Standard save process

### Visual Indicators:
- **Unmodified library**: Blue badge "📚 LIBRARY"
- **Modified library**: Yellow badge "📚 LIBRARY (MODIFIED)" or "📚 MOD"

## CRITICAL: Two Different API Patterns
There are **TWO DIFFERENT** request body patterns in this codebase:

### Pattern 1: Direct Fields (Most APIs)
```javascript
const requestBody = JSON.stringify({
    region: config.region,
    version: config.version,
    accessToken: accessToken,
    // ... fields directly in root
});
```
**Used by**: token-exchange, use-case-categories, guideline-templates, get-sections, get-section-questions, **update-section**, answer-relationships

### Pattern 2: Data Wrapper (Newer APIs)  
```javascript
const requestBody = JSON.stringify({
    data: {
        region: config.region,
        version: config.version,
        accessToken: accessToken,
        // ... fields wrapped in data object
    }
});
```
**Used by**: add-section, assessment refresh calls

### Rule: Check Existing Working API Calls
**ALWAYS check how existing working APIs format their request body before creating new ones.** Most APIs use Pattern 1 (direct fields).

## Phase 2: Assessment Structure Editor (Current Phase)

### Requirements Overview
Building comprehensive assessment editor with hierarchical structure:
- **Assessments** (top level) → **Sections** → **Questions/Problems**

### Key Features Needed

#### 1. Data Management
- **Pull assessment structure** from CareIQ platform (sections, questions, problems)
- **Allow in-app editing** of all components
- **Save changes back** to CareIQ platform
- **Optimistic UI updates** vs server validation

#### 2. Drag & Drop Functionality
- **Questions drag-and-droppable** for modern UX
- **Reordering within sections**
- **Possibly drag between sections** (clarify scope)
- Need drag-and-drop library (HTML5 drag API or equivalent)

#### 3. Type-ahead Search
- **Check existing content** before adding questions/problems
- **Prevent duplicates** and suggest existing content
- **Debounced API calls** for performance
- **Search existing questions/problems** across platform

#### 4. Assessment Editor UI
- **Section management**: add/edit/delete/reorder sections
- **Question management**: add/edit/delete/drag-drop questions
- **Problem management**: add/edit/delete/drag-drop problems
- **Modern editor interface** with intuitive controls

### Questions to Clarify
- What APIs are available for CRUD operations on sections/questions/problems?
- What is the data structure returned for full assessment details?
- Are there validation rules for sections/questions/problems?
- Should drag-and-drop work between sections or only within sections?
- What triggers type-ahead search (typing in input fields)?
- Are there different question types needing different editors?
- What fields do sections/questions/problems have?

### Technical Implementation Plan
- **State management** for complex nested data structure
- **HTTP effects** for CRUD operations following existing patterns
- **Drag-and-drop library** integration with ServiceNow UI framework
- **Debounced search** with type-ahead functionality
- **Undo/redo functionality** for editor actions
- **Server-side APIs** following established security patterns

## Current Task: Assessment Builder - Sections Display

### API Details
- **Endpoint**: `https://app.stg.careiq.cadalysapp.com/api/v1/builder/guideline-template/{uuid}`
- **Method**: GET (but ServiceNow endpoint will be POST)
- **Response Structure**:
  ```json
  {
    "title": "Assessment Title",
    "sections": [
      {
        "id": "uuid",
        "label": "Parent Section",
        "sort_order": 1,
        "subsections": [
          {
            "id": "uuid", 
            "label": "Subsection",
            "questions_quantity": 6,
            "sort_order": 1,
            "subsections": []
          }
        ]
      }
    ]
  }
  ```

### UI Requirements
- **Click assessment card** → Launch builder view
- **Left sidebar** displays sections hierarchy
- **Parent sections are fixed** (cannot be dragged)
- **Subsections are draggable** for reordering
- **Right side** reserved for questions/answers display

### Implementation Steps
1. ✅ Create server-side API for single assessment fetch
2. ✅ Add click handler to assessment cards  
3. ✅ Design left sidebar layout with sections
4. 🔄 Implement drag-and-drop for subsections only
5. ✅ Update state management for builder view

### Current Implementation Notes
- **View Architecture**: Completely new view (not inline/modal)
- **Section Structure**: Only 1 parent section with slight indentation for hierarchy
- **Section Selection**: Click section → Load questions/answers for that specific section
- **Context**: Work in context of 1 section at a time

## Next Phase: Questions API & Display

### Questions API Details
- **Endpoint**: `https://app.stg.careiq.cadalysapp.com/api/v1/builder/section/{section_id}`
- **Method**: GET (but ServiceNow endpoint will be POST)
- **ServiceNow API**: `/api/x_cadal_careiq_b_0/careiq_api/get-section-questions`

### Question Types & Data Structure
- **Question Types**:
  - `Single Select` - radio buttons with answers array
  - `Multiselect` - checkboxes with answers array  
  - `Text` - text input (no answers array)
  - `Date` - date picker (no answers array)
  - `Numeric` - number input (no answers array)

- **Key Fields**:
  - `label` - question text
  - `required` - boolean
  - `type` - question type
  - `sort_order` - display order
  - `tooltip` - help text
  - `hidden` - visibility
  - `answers[]` - for select types only
    - `label` - answer text
    - `sort_order` - answer order
    - `tooltip` - answer help text
    - `secondary_input_type` - triggers additional input (text/date/numeric)
    - `mutually_exclusive` - for multiselect behavior

### Implementation Requirements
1. **Section click handler** → Load questions for that section
2. **Questions display** with proper question type rendering
3. **Secondary inputs** - show below answer when selected, with visual indicator on answer
4. **Tooltips** - hover-based with info icon for questions and answers
5. **Sort order** - display questions and answers in `sort_order`
6. **Validation** - handle `required` fields
7. **Hidden questions** - show in builder (hidden only applies to assessment filling)
8. **Mutually exclusive** - selecting one deselects others in multiselect

### UI Behavior Details
- **Secondary Input Indicator**: Show small icon/text on answers that have `secondary_input_type`
- **Secondary Input Display**: Only show below selected answer, hide when deselected
- **Tooltips**: Hover over ⓘ icon to show help text
- **Mutually Exclusive**: Auto-deselect conflicting options in multiselect questions

## CRITICAL UNDERSTANDING - Assessment Builder (Not Viewer)

### Primary Purpose: BUILD & MODIFY Assessments
- **Edit everything**: sections, questions, answers, tooltips, order, etc.
- **All payload fields editable**: Any field in the API response should be modifiable
- **Drag & drop reordering**: Questions, answers, sections
- **Add/Edit/Delete**: Create new or modify existing content
- **CRUD operations**: Full create, read, update, delete functionality

### Two View Modes Needed:
1. **Builder Mode** (primary): Edit everything, drag/drop, add/delete
2. **Preview Mode**: Show assessment as it appears when filling out (view-only button)

### Auto-load First Section:
- When opening assessment builder, automatically load questions for first available section
- Don't wait for user to click - show content immediately

### Edit Capabilities Needed:
- **Sections**: Edit label, reorder subsections, add/delete
- **Questions**: Edit label, type, required, tooltip, reorder, add/delete
- **Answers**: Edit label, tooltip, secondary_input_type, reorder, add/delete
- **All metadata**: Everything in the payload should be editable

### UI Updates - Question Relationships:
- **Remove "Hidden" checkbox**: Questions are hidden based on answer relationships, not manual setting
- **Answer relationships**: When questions have triggered_questions in answers, those questions are conditionally shown
- **Tooltip placement**: Move tooltip editing below question text for better layout
- **Answer editing**: Full CRUD for answers (edit text, tooltip, secondary inputs, etc.)

### Drag-and-Drop & Version Control:
- **Question reordering**: Drag-and-drop questions within a section (answers move with questions)
- **Answer reordering**: Drag-and-drop answers within a question
- **Draft-only editing**: Only assessments with status "draft" are editable
- **Published read-only**: Published assessments show in preview mode only, no edit controls
- **Visual drag indicators**: Drag handles, hover states, drop zones

### Interactive Preview Mode:
- **Hidden questions**: Hide questions marked as `hidden: true` unless triggered by answer selection
- **Answer relationships**: Show hidden questions when answers with `triggered_questions` are selected
- **Question hiding**: Hide triggered questions when triggering answer is deselected
- **Secondary inputs**: Display additional input fields when answers with `secondary_input_type` are selected
- **Mutually exclusive**: Automatically deselect other answers when mutually exclusive answer is selected
- **State management**: Track selected answers and their relationships across questions

## CRITICAL PATTERN: Delta CareIQ Services Consolidation
**PROBLEM**: Multiple "Delta CareIQ Services - *" files create confusion and inconsistency.

### Single Source of Truth Pattern:
**ALWAYS use `Delta CareIQ Services - Consolidated.js` as the single source of truth** for all Script Include methods to be added to the main CareIQ Services.js file.

### Rules:
1. **All new Script Include methods** must be added to the consolidated file
2. **Never create new individual delta files** - update the consolidated file instead
3. **Organized by functional groups**:
   - Builder Section Operations
   - Builder Question Operations
   - Builder Answer Operations
   - Typeahead Operations
   - Relationship Operations
4. **Each method must include**:
   - Proper error handling with this._logError()
   - Configuration validation with this._validateConfig()
   - Appropriate HTTP method and endpoint building
   - Consistent parameter naming and structure

### File Organization:
```
Delta CareIQ Services - Consolidated.js (SINGLE SOURCE OF TRUTH)
├── BUILDER - SECTION OPERATIONS
├── BUILDER - QUESTION OPERATIONS
├── BUILDER - ANSWER OPERATIONS
├── TYPEAHEAD OPERATIONS
└── RELATIONSHIP OPERATIONS
```

**This pattern eliminates confusion and ensures all Script Include additions are tracked in one place.**

## PGI (Problem-Goal-Intervention) Relationship System

### Hierarchy Structure
**Answer** → **Problem(s)** → **Goal(s)** → **Intervention(s)**

- **1-to-Many**: Each answer can have multiple problems
- **1-to-Many**: Each problem can have multiple goals
- **1-to-Many**: Each goal can have multiple interventions

### Implementation Plan

#### Phase 1: Problem Creation
1. **Generic typeahead** with `problem` parameter
2. **Add Problem API**: Create new problem under answer
3. **Problem UI**: Collapsed display in relationship modal
4. **Check/X pattern**: User types → typeahead → select/create → ✓ save → refresh

#### Phase 2: Goal Creation
1. **Generic typeahead** with `goal` parameter
2. **Add Goal API**: Create new goal under specific problem
3. **Goal UI**: Expandable under problems
4. **Check/X pattern**: Same as problems but tied to problem ID

#### Phase 3: Intervention Creation
1. **Generic typeahead** with `intervention` parameter
2. **Add Intervention API**: Create new intervention under specific goal
3. **Intervention UI**: Expandable under goals
4. **Check/X pattern**: Same pattern tied to goal ID

### API Endpoints (TBD)
- **Problems**: Separate creation endpoint
- **Goals**: Separate creation endpoint (requires problem ID)
- **Interventions**: Separate creation endpoint (requires goal ID)

### Bundle System
- **Bundles**: Pre-existing problem/goal/intervention combinations
- **Bundle lookup**: After creating problem, use master_id to check for existing bundles
- **Bundle selection**: Separate UI option for users to select complete bundles
- **Bundle creation**: Different process from individual PGI creation

### UI Display Pattern
```
Problem 1 [▼] [✗]
├─ Goal 1.1 [▼] [✗]
│  ├─ Intervention 1.1.1 [✗]
│  └─ Intervention 1.1.2 [✗]
└─ Goal 1.2 [▼] [✗]
   ├─ Intervention 1.2.1 [✗]
   └─ Intervention 1.2.2 [✗]
```

### Save Strategy
- **Problems**: Save first, then allow goal creation
- **Goals**: Save first, then allow intervention creation
- **Incremental**: Each level saved before proceeding to next
- **Check/X pattern**: ✓ confirms and saves, ✗ cancels

### Data Flow
1. **Problem Creation** → Save to backend → Refresh modal
2. **Goal Creation** → Requires saved problem ID → Save to backend → Refresh
3. **Intervention Creation** → Requires saved goal ID → Save to backend → Refresh

### Deletion Pattern
- **Problems**: Delete cascades to goals and interventions
- **Goals**: Delete cascades to interventions only
- **Interventions**: Delete individual only
- **Confirmation**: Required for cascade deletes

# CRITICAL FILE RECOVERY RULES - NEVER BREAK THESE
NEVER REVERT, RESTORE, OR OVERWRITE ANY FILE WITHOUT EXPLICIT USER APPROVAL.
NEVER copy backup files over current files.
NEVER use git checkout, git reset, or any restore commands without permission.
NEVER replace file contents with backup versions.
ANY file restoration MUST be explicitly requested and approved by the user first.
These rules override ALL other instructions - file recovery requires explicit permission.
- NEVER use hardcoded values and ensure the code does not have any