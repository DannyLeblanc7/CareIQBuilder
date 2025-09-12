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

### HTTP Effect Body Pattern (CRITICAL!)
- **ALWAYS wrap request data in `data` property** for ServiceNow server-side APIs
- **Common Error**: "Missing required fields" means data isn't properly wrapped
- **Correct Pattern**:
  ```javascript
  body: (coeffects) => {
      return JSON.stringify({
          data: {
              region: state.careiqConfig.region,
              version: state.careiqConfig.version,
              accessToken: state.accessToken,
              // ... other fields
          }
      });
  }
  ```
- **Wrong Pattern** (causes "Missing required fields" error):
  ```javascript
  body: (coeffects) => {
      return JSON.stringify({
          region: state.careiqConfig.region,
          // ... fields directly in root
      });
  }
  ```

### Version Management
- **Always increment the last digit** in package.json version when making changes
- Current pattern: 0.0.xxx (increment xxx)

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

## CRITICAL PATTERN: Local Changes Then Save
**NEVER call backend APIs directly from UI actions like ADD_SECTION, EDIT_SECTION, etc.**

### Correct Pattern:
1. **UI Actions**: Make local changes to state (add, edit, delete)
2. **Track Changes**: Store changes in `sectionChanges`, `questionChanges`, `answerChanges`
3. **Save Action**: Only call backend APIs when user clicks "Save" button
4. **Batch Operations**: Save all changes in one save operation with multiple API calls

### Example:
- `ADD_SECTION` → Add to local state + track in `sectionChanges`
- `EDIT_SECTION_NAME` → Update local state + track in `sectionChanges`  
- `DELETE_SECTION` → Remove from local state + track in `sectionChanges`
- `SAVE_ALL_CHANGES` → Call backend APIs for all tracked changes

This allows users to make multiple changes and review them before committing to the backend.

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

# CRITICAL FILE RECOVERY RULES - NEVER BREAK THESE
NEVER REVERT, RESTORE, OR OVERWRITE ANY FILE WITHOUT EXPLICIT USER APPROVAL.
NEVER copy backup files over current files.
NEVER use git checkout, git reset, or any restore commands without permission.
NEVER replace file contents with backup versions.
ANY file restoration MUST be explicitly requested and approved by the user first.
These rules override ALL other instructions - file recovery requires explicit permission.
- NEVER use hardcoded values and ensure the code does not have any