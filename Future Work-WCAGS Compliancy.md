# Future Work: WCAG 2.1 Compliance for CareIQ Builder

**Document Created:** November 6, 2025
**Component:** CareIQ Builder (ServiceNow UI Component)
**Current Status:** Does NOT meet WCAG 2.1 Level A
**Goal:** Achieve WCAG 2.1 Level AA compliance

---

## EXECUTIVE SUMMARY

**Estimated Effort with Claude:** 4-6 hours of focused work
**Estimated Effort Solo:** 8-10 developer days

**Current State:**
- ✅ Good foundation: semantic HTML, focus states, keyboard handlers present
- ❌ 6 Critical issues block keyboard/screen reader users
- ⚠️ 9 High severity issues impact accessibility significantly
- ℹ️ 5 Medium/Low issues for refinement

**Target State:** WCAG 2.1 Level AA compliant component usable by all users

---

## QUICK START GUIDE

### When Ready to Begin:

1. **Read Phase 1 section below** (Critical fixes - 2 hours)
2. **Ask Claude:** "Let's start Phase 1 WCAG compliance work for CareIQ Builder"
3. **Claude will:**
   - Find all instances with Grep
   - Make pattern-based edits
   - Apply consistent fixes across codebase
4. **You will:**
   - Review changes
   - Test with keyboard navigation
   - Test with screen reader (optional but recommended)

### Files You'll Modify:
- `src/cadal-careiq-builder/index.js` (main component - 21,434 lines)
- Possibly `src/cadal-careiq-builder/styles.scss` (if focus states need adjustment)

---

## PHASE 1: CRITICAL FIXES (2 hours) 🔴

**Goal:** Make component usable by keyboard and screen reader users

### 1. Convert Clickable Divs/Spans to Buttons (30 min)

**Problem:** Divs and spans with onclick are not keyboard accessible or recognized by screen readers.

**Locations to Fix:**

#### A. Expand/Collapse Icons (Lines ~493-504, 889, 1383)
**Current Code:**
```javascript
<span
  className="expand-icon"
  onclick={(event) => {
    event.stopPropagation();
    dispatch('TOGGLE_VERSION_EXPAND', {assessmentId});
  }}
>
  {isExpanded ? '−' : '+'}
</span>
```

**Fixed Code:**
```javascript
<button
  className="expand-icon"
  aria-label={isExpanded ? 'Collapse versions' : 'Expand versions'}
  aria-expanded={isExpanded}
  onclick={(event) => {
    event.stopPropagation();
    dispatch('TOGGLE_VERSION_EXPAND', {assessmentId});
  }}
  onkeydown={(event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      dispatch('TOGGLE_VERSION_EXPAND', {assessmentId});
    }
  }}
>
  {isExpanded ? '−' : '+'}
</button>
```

**Other Expand Icons:**
- Line 889: Section panel expand/collapse
- Line 1383: Questions panel expand/collapse
- Lines 980-1006: Expand sections button in sidebar

#### B. PGI Badges (Lines ~2732-2754, 3622-3630)
**Current Code:**
```javascript
<span
  className="pgi-badge clickable"
  onclick={(e) => {
    e.stopPropagation();
    dispatch('OPEN_PGI_MODAL', {answerId, answerLabel});
  }}
  title="Click to manage PGI relationships"
>
  🎯 {pgiCount}
</span>
```

**Fixed Code:**
```javascript
<button
  className="pgi-badge"
  aria-label={`Manage ${pgiCount} PGI relationships for ${answerLabel}`}
  onclick={(e) => {
    e.stopPropagation();
    dispatch('OPEN_PGI_MODAL', {answerId, answerLabel});
  }}
  title="Click to manage PGI relationships"
>
  🎯 {pgiCount}
</button>
```

#### C. Assessment Cards (Lines ~472-534)
**Current Code:**
```javascript
<div
  className={`assessment-card clickable ${isExpanded ? 'expanded' : ''}`}
  onclick={() => dispatch('OPEN_ASSESSMENT_BUILDER', {assessmentId, assessmentTitle})}
>
  {/* card content */}
</div>
```

**Fixed Code:**
```javascript
<button
  className={`assessment-card ${isExpanded ? 'expanded' : ''}`}
  onclick={() => dispatch('OPEN_ASSESSMENT_BUILDER', {assessmentId, assessmentTitle})}
  aria-label={`Open assessment: ${assessmentTitle}`}
>
  {/* card content */}
</button>
```

**Note:** May need CSS updates to make button look like card:
```scss
.assessment-card {
  background: none;
  border: 1px solid #ddd;
  padding: 16px;
  text-align: left;
  width: 100%;
  cursor: pointer;

  &:hover {
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  }
}
```

#### D. Version Cards (Lines ~541-579)
Same pattern as assessment cards.

**Search Pattern for Claude:**
```
Find all: className.*clickable.*onclick
Find all: <span.*onclick
Find all: <div.*onclick
```

---

### 2. Add aria-labels to Icon-Only Buttons (30 min)

**Problem:** Buttons with only emojis/icons don't announce their purpose to screen readers.

**Locations to Fix:**

#### A. Info Toggle Button (Line ~205)
**Current:**
```javascript
<button
  style={{...}}
  onclick={() => dispatch('TOGGLE_SYSTEM_MESSAGES')}
  title={state.systemMessagesCollapsed ? 'Show message history' : 'Hide message history'}
>
  ℹ️
</button>
```

**Fixed:**
```javascript
<button
  style={{...}}
  onclick={() => dispatch('TOGGLE_SYSTEM_MESSAGES')}
  aria-label={state.systemMessagesCollapsed ? 'Show message history' : 'Hide message history'}
  title={state.systemMessagesCollapsed ? 'Show message history' : 'Hide message history'}
>
  ℹ️
</button>
```

#### B. Tooltip Icon (Line ~1712)
**Current:**
```javascript
<span
  className="tooltip-icon"
  onclick={() => dispatch('OPEN_TOOLTIP_MODAL', {questionId})}
  title="Click to edit tooltip"
>
  ⓘ
</span>
```

**Fixed:**
```javascript
<button
  className="tooltip-icon"
  onclick={() => dispatch('OPEN_TOOLTIP_MODAL', {questionId})}
  aria-label="Edit tooltip for this question"
  title="Click to edit tooltip"
>
  ⓘ
</button>
```

#### C. Custom Attributes "CA" Button (Line ~1783)
**Current:**
```javascript
<button
  onclick={() => dispatch('OPEN_CUSTOM_ATTRIBUTES_MODAL', {questionId})}
  title="Custom Attributes"
>
  CA
</button>
```

**Fixed:**
```javascript
<button
  onclick={() => dispatch('OPEN_CUSTOM_ATTRIBUTES_MODAL', {questionId})}
  aria-label="Edit custom attributes for this question"
  title="Custom Attributes"
>
  CA
</button>
```

#### D. Delete Buttons (Multiple locations)
**Search for all delete buttons and add aria-label:**
- Line ~1845: Delete question button
- Line ~2204: Delete answer button
- Multiple delete section buttons

**Pattern:**
```javascript
<button
  onclick={() => dispatch('DELETE_QUESTION', {questionId})}
  aria-label="Delete this question permanently"
  title="Delete"
>
  🗑️
</button>
```

**Search Pattern for Claude:**
```
Find buttons with only: emoji, single letter, or icon
Look for: <button.*onclick.*>[\s]*[🗑️✏️✓✗ⓘℹ️📋⚙️]+[\s]*</button>
Check all title attributes without aria-label
```

---

### 3. Fix Typeahead Keyboard Navigation (45 min)

**Problem:** Typeahead dropdowns use divs instead of semantic lists, preventing proper keyboard navigation.

**Locations to Fix:**

#### A. Question Typeahead (Lines ~1657-1691)

**Current Structure:**
```javascript
<div className="typeahead-dropdown">
  {results.map((question, index) => (
    <div
      className={`typeahead-item ${index === state.questionTypeaheadSelectedIndex ? 'selected' : ''}`}
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch('SELECT_LIBRARY_QUESTION', {question});
      }}
    >
      <strong>{question.label}</strong>
      <div>{question.type}</div>
    </div>
  ))}
</div>
```

**Fixed Structure:**
```javascript
<ul
  className="typeahead-dropdown"
  role="listbox"
  aria-label="Question suggestions"
>
  {results.map((question, index) => (
    <li
      className={`typeahead-item ${index === state.questionTypeaheadSelectedIndex ? 'selected' : ''}`}
      role="option"
      aria-selected={index === state.questionTypeaheadSelectedIndex}
      tabindex={index === state.questionTypeaheadSelectedIndex ? "0" : "-1"}
      onclick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        dispatch('SELECT_LIBRARY_QUESTION', {question});
      }}
      onkeydown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          dispatch('SELECT_LIBRARY_QUESTION', {question});
        }
      }}
    >
      <strong>{question.label}</strong>
      <div>{question.type}</div>
    </li>
  ))}
</ul>
```

**CSS Updates Needed:**
```scss
.typeahead-dropdown {
  list-style: none;
  padding: 0;
  margin: 0;

  li.typeahead-item {
    padding: 8px 12px;
    cursor: pointer;

    &:hover, &.selected, &:focus {
      background-color: #e5e7eb;
    }

    &:focus {
      outline: 2px solid #3b82f6;
      outline-offset: -2px;
    }
  }
}
```

#### B. Other Typeaheads to Fix (Same Pattern)
- Lines 2100-2150: Answer typeahead
- Lines 2545-2600: Guideline typeahead (scoring panel)
- Lines 5450-5500: Goal typeahead
- Lines 5550-5600: Intervention typeahead

**Pattern to Apply:**
1. Change `<div className="typeahead-dropdown">` to `<ul role="listbox" aria-label="...">`
2. Change `<div className="typeahead-item">` to `<li role="option">`
3. Add `aria-selected` based on selection state
4. Add `tabindex` (0 for selected, -1 for others)
5. Add `onkeydown` handler for Enter key
6. Update CSS to use `li` selectors

**Search Pattern for Claude:**
```
Find: className.*typeahead-dropdown
Find: className.*typeahead-item
Context: Look for .map() loops rendering items
```

---

### 4. Add Modal ARIA Attributes (15 min)

**Problem:** Modals lack proper ARIA attributes to announce they're modals.

**Locations to Fix:**

#### A. Tooltip Editing Modal (Line ~3773)
**Current:**
```javascript
<div className="modal-overlay" onclick={() => dispatch('CLOSE_TOOLTIP_MODAL')}>
  <div className="modal-content" onclick={(e) => e.stopPropagation()}>
    <div className="modal-header">
      <h3 className="modal-title">Edit Tooltip</h3>
      <button className="modal-close" onclick={() => dispatch('CLOSE_TOOLTIP_MODAL')}>×</button>
    </div>
    {/* modal body */}
  </div>
</div>
```

**Fixed:**
```javascript
<div
  className="modal-overlay"
  onclick={() => dispatch('CLOSE_TOOLTIP_MODAL')}
  role="dialog"
  aria-modal="true"
  aria-labelledby="tooltip-modal-title"
>
  <div className="modal-content" onclick={(e) => e.stopPropagation()}>
    <div className="modal-header">
      <h3 id="tooltip-modal-title" className="modal-title">Edit Tooltip</h3>
      <button
        className="modal-close"
        onclick={() => dispatch('CLOSE_TOOLTIP_MODAL')}
        aria-label="Close modal"
      >
        ×
      </button>
    </div>
    {/* modal body */}
  </div>
</div>
```

#### B. Other Modals to Fix (Same Pattern)
- Line 3814: Create version modal → `aria-labelledby="version-modal-title"`
- Line 4299: Custom attributes modal → `aria-labelledby="attributes-modal-title"`
- Line 4308: New assessment modal → `aria-labelledby="new-assessment-modal-title"`
- Line 5529: PGI modal → `aria-labelledby="pgi-modal-title"`

**Pattern to Apply:**
1. Add `role="dialog"` to modal overlay
2. Add `aria-modal="true"` to modal overlay
3. Add unique `id` to modal title (h3 element)
4. Add `aria-labelledby="[id-from-step-3]"` to modal overlay
5. Add `aria-label="Close modal"` to close button

**Search Pattern for Claude:**
```
Find: className.*modal-overlay
Look for: <h3.*modal-title
Ensure each modal has unique ID
```

---

## PHASE 2: HIGH PRIORITY FIXES (2-4 hours) 🟡

**Goal:** Achieve WCAG 2.1 Level A compliance

### 5. Implement Focus Trap in Modals (1 hour)

**Problem:** Focus can escape modal, confusing keyboard users.

**Solution:** Create reusable focus management utility.

#### A. Create Focus Trap Utility

Add to `src/cadal-careiq-builder/index.js` near the top (after imports):

```javascript
// Focus trap utility for modals
const focusTrapManager = {
  activeElement: null,

  trapFocus: function(modalElement) {
    // Store element that had focus before modal opened
    this.activeElement = document.activeElement;

    // Get all focusable elements in modal
    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (focusableElements.length === 0) return;

    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    // Focus first element
    firstFocusable.focus();

    // Trap tab key
    modalElement.addEventListener('keydown', function(e) {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    });
  },

  releaseFocus: function() {
    // Return focus to element that opened modal
    if (this.activeElement && this.activeElement.focus) {
      this.activeElement.focus();
    }
    this.activeElement = null;
  }
};
```

#### B. Apply to Modals

**For each modal, update action handlers:**

```javascript
// When modal opens
'OPEN_TOOLTIP_MODAL': (coeffects) => {
  const {updateState, state} = coeffects;

  updateState({
    tooltipModalOpen: true,
    // ... other state
  });

  // Focus trap after DOM updates
  setTimeout(() => {
    const modal = document.querySelector('.modal-overlay[role="dialog"]');
    if (modal) {
      focusTrapManager.trapFocus(modal);
    }
  }, 100);
},

// When modal closes
'CLOSE_TOOLTIP_MODAL': (coeffects) => {
  const {updateState} = coeffects;

  updateState({
    tooltipModalOpen: false
  });

  // Release focus trap
  focusTrapManager.releaseFocus();
},
```

**Modals to Update:**
- OPEN_TOOLTIP_MODAL / CLOSE_TOOLTIP_MODAL
- OPEN_CUSTOM_ATTRIBUTES_MODAL / CLOSE_CUSTOM_ATTRIBUTES_MODAL
- OPEN_NEW_ASSESSMENT / CANCEL_NEW_ASSESSMENT
- OPEN_PGI_MODAL / CLOSE_PGI_MODAL
- CREATE_VERSION_MODAL actions

**Alternative:** Use a library like `focus-trap` npm package if preferred.

---

### 6. Add aria-live for System Messages (15 min)

**Problem:** Dynamic messages not announced to screen readers.

**Locations to Fix:**

#### A. System Messages History (Lines ~306-399)
**Current:**
```javascript
<div className="system-messages-history">
  {(state.systemMessages || []).map((msg, index) => (
    <div className={`system-message ${msg.type}`}>
      {msg.message}
    </div>
  ))}
</div>
```

**Fixed:**
```javascript
<div
  className="system-messages-history"
  role="status"
  aria-live="polite"
  aria-atomic="false"
>
  {(state.systemMessages || []).map((msg, index) => (
    <div className={`system-message ${msg.type}`}>
      {msg.message}
    </div>
  ))}
</div>
```

#### B. Current Message Ticker (Lines ~167-304)
**Current:**
```javascript
<div className="system-messages-ticker">
  <span className="message-text">{currentMessage.message}</span>
</div>
```

**Fixed:**
```javascript
<div
  className="system-messages-ticker"
  role="status"
  aria-live="polite"
>
  <span className="message-text">{currentMessage.message}</span>
</div>
```

#### C. Loading Overlays (Lines ~1451, 2740, 5516+)
**Pattern to Apply:**
```javascript
<div
  className="loading-overlay"
  role="status"
  aria-live="polite"
>
  <div className="spinner"></div>
  <span>{loadingMessage}</span>
</div>
```

**Note:** Use `aria-live="polite"` for status updates, `aria-live="assertive"` only for critical errors.

---

### 7. Add Keyboard Alternative for Drag-and-Drop (2-3 hours)

**Problem:** Drag-and-drop is mouse-only. Keyboard users cannot reorder.

**Solution:** Add up/down arrow buttons next to drag handles.

This is the most time-consuming fix. Three implementations needed:
1. Section reordering
2. Question reordering
3. Answer reordering (multiselect)

#### A. Section Reordering (Lines ~910-1000)

**Current Structure:**
```javascript
<div
  className="section-item"
  draggable="true"
  ondragstart={(e) => dispatch('SECTION_DRAG_START', {sectionId})}
  ondragend={() => dispatch('SECTION_DRAG_END')}
>
  <span className="drag-handle">⋮⋮</span>
  <span className="section-label">{section.label}</span>
</div>
```

**Enhanced Structure:**
```javascript
<div className="section-item">
  <div className="reorder-controls">
    <span className="drag-handle" title="Drag to reorder">⋮⋮</span>
    <div className="keyboard-reorder">
      <button
        onclick={() => dispatch('MOVE_SECTION_UP', {sectionId})}
        disabled={isFirst}
        aria-label="Move section up"
        title="Move up"
      >
        ↑
      </button>
      <button
        onclick={() => dispatch('MOVE_SECTION_DOWN', {sectionId})}
        disabled={isLast}
        aria-label="Move section down"
        title="Move down"
      >
        ↓
      </button>
    </div>
  </div>
  <span className="section-label">{section.label}</span>
</div>
```

**New Action Handlers Needed:**
```javascript
'MOVE_SECTION_UP': (coeffects) => {
  const {action, updateState, state, dispatch} = coeffects;
  const {sectionId} = action.payload;

  // Find current section
  const sections = state.currentQuestions?.sections || [];
  const currentIndex = sections.findIndex(s => s.id === sectionId);

  if (currentIndex <= 0) return; // Already at top

  // Swap with previous section
  const newSections = [...sections];
  [newSections[currentIndex - 1], newSections[currentIndex]] =
    [newSections[currentIndex], newSections[currentIndex - 1]];

  // Update sort_order for both sections
  newSections[currentIndex - 1].sort_order = currentIndex - 1;
  newSections[currentIndex].sort_order = currentIndex;

  // Update state
  updateState({
    currentQuestions: {
      ...state.currentQuestions,
      sections: newSections
    }
  });

  // Mark sections as changed for save
  updateState({
    sectionChanges: {
      ...state.sectionChanges,
      [newSections[currentIndex - 1].id]: {sort_order: currentIndex - 1},
      [newSections[currentIndex].id]: {sort_order: currentIndex}
    }
  });
},

'MOVE_SECTION_DOWN': (coeffects) => {
  // Similar to MOVE_SECTION_UP but swap with next section
  // Check currentIndex < sections.length - 1
},
```

**CSS for Reorder Buttons:**
```scss
.reorder-controls {
  display: flex;
  align-items: center;
  gap: 4px;

  .keyboard-reorder {
    display: flex;
    flex-direction: column;
    gap: 2px;

    button {
      padding: 2px 4px;
      font-size: 12px;
      line-height: 1;
      border: 1px solid #ddd;
      background: white;
      cursor: pointer;

      &:hover:not(:disabled) {
        background: #e5e7eb;
      }

      &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }

      &:focus {
        outline: 2px solid #3b82f6;
        outline-offset: -2px;
      }
    }
  }
}
```

#### B. Question Reordering (Lines ~1500-1547)

**Same pattern as sections:**
1. Add up/down buttons next to drag handle
2. Create `MOVE_QUESTION_UP` and `MOVE_QUESTION_DOWN` actions
3. Update `questionChanges` state to track reordering
4. Disable buttons when at first/last position

**Calculate isFirst/isLast:**
```javascript
const visibleQuestions = state.currentQuestions?.questions?.filter(q =>
  state.visibleQuestions.includes(q.ids.id)
) || [];
const currentIndex = visibleQuestions.findIndex(q => q.ids.id === question.ids.id);
const isFirst = currentIndex === 0;
const isLast = currentIndex === visibleQuestions.length - 1;
```

#### C. Answer Reordering (Lines ~2842-2872)

**Same pattern as questions:**
1. Add up/down buttons
2. Create `MOVE_ANSWER_UP` and `MOVE_ANSWER_DOWN` actions
3. Update `answerChanges` state
4. Handle multiselect vs other answer types

**Note:** Answers are per-question, so reordering is scoped to question's answers.

---

### 8. Add aria-required to Required Fields (15 min)

**Problem:** Required fields marked with asterisk visually but not announced to screen readers.

**Locations to Fix:**

#### A. New Assessment Form (Lines ~4355-4650)
**All fields with `<span style={{color: 'red'}}>*</span>`:**

**Pattern:**
```javascript
// Before
<input
  type="text"
  value={state.newAssessmentForm.guidelineName}
  oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {...})}
/>

// After
<input
  type="text"
  value={state.newAssessmentForm.guidelineName}
  oninput={(e) => dispatch('UPDATE_NEW_ASSESSMENT_FIELD', {...})}
  aria-required="true"
  required
/>
```

**Fields to Update:**
- Guideline Name (line ~4360)
- Use Case Category (line ~4380) - select element
- Usage (line ~4412) - select element
- Content Source (line ~4434)
- Code/Policy Number (line ~4454)

#### B. Question Required Checkbox (Line ~1519)
**Already has label, just add context:**
```javascript
<label className="checkbox-control">
  <input
    type="checkbox"
    checked={question.required}
    aria-label="Mark this question as required for users"
  />
  Required
</label>
```

**Search Pattern for Claude:**
```
Find: <span.*color.*red.*>\*</span>
Context: Find nearest input/select
Add aria-required="true" to those inputs
```

---

## PHASE 3: MEDIUM PRIORITY (2 hours) 🟢

**Goal:** Achieve WCAG 2.1 Level AA compliance

### 9. Fix Form Label Associations (30 min)

#### A. Page Size Select (Lines ~419-430)
**Current:**
```javascript
<label className="page-size-label">Show:</label>
<select className="page-size-select" value={pageSize} onchange={...}>
  <option value="10">10</option>
  <option value="25">25</option>
  <option value="50">50</option>
</select>
<span className="page-size-label">per page</span>
```

**Fixed:**
```javascript
<label htmlFor="page-size-select" className="page-size-label">Show:</label>
<select
  id="page-size-select"
  className="page-size-select"
  value={pageSize}
  onchange={...}
  aria-label="Items per page"
>
  <option value="10">10</option>
  <option value="25">25</option>
  <option value="50">50</option>
</select>
<span className="page-size-label">per page</span>
```

#### B. All Form Fields in Modals
**Verify each input has associated label:**
- Either: `<label htmlFor="input-id">` + `<input id="input-id">`
- Or: `<label><input /></label>` wrapped structure
- Or: `aria-label` or `aria-labelledby` on input

**Search Pattern:**
```
Find all: <input (without immediately preceding <label or aria-label)
Find all: <select (without label association)
Find all: <textarea (without label association)
```

---

### 10. Verify and Fix Color Contrast (30 min)

**Test these color combinations:**

#### A. Status Badges (Lines ~515-523)
- **Published:** `#065f46` text on `#d1fae5` background
- **Draft:** `#1e40af` text on `#dbeafe` background
- **Unpublished:** Similar pattern

**Tool:** https://webaim.org/resources/contrastchecker/

**Requirement:**
- Normal text: 4.5:1 ratio (Level AA)
- Large text (18px+): 3:1 ratio (Level AA)

**If fails:** Darken text color or lighten background until ratio meets standard.

#### B. Error Messages (Lines ~271-279)
- Error red: `#dc3545`
- Warning yellow: `#f59e0b`
- Success green: `#10b981`
- Info blue: `#3b82f6`

**Verify on white background.**

#### C. Button Colors (Lines ~194-198)
- Verify all button text/background combinations

**Fix Example:**
```javascript
// If contrast fails
const errorColor = '#c62828'; // Darker red for better contrast
const warningColor = '#d97706'; // Darker yellow
```

---

### 11. Add Confirmation for Destructive Actions (30 min)

**Problem:** Delete buttons don't warn users of permanent action.

**Solution:** Add confirmation dialog or improve aria-labels.

#### A. Option 1: Confirmation Dialog (Recommended)
**Create confirmation modal:**
```javascript
'REQUEST_DELETE_QUESTION': (coeffects) => {
  const {action, updateState} = coeffects;
  const {questionId, questionLabel} = action.payload;

  updateState({
    deleteConfirmationModal: {
      isOpen: true,
      itemType: 'question',
      itemId: questionId,
      itemLabel: questionLabel,
      message: `Are you sure you want to delete the question "${questionLabel}"? This action cannot be undone.`
    }
  });
},

'CONFIRM_DELETE': (coeffects) => {
  const {state, dispatch, updateState} = coeffects;
  const {itemType, itemId} = state.deleteConfirmationModal;

  // Close modal
  updateState({
    deleteConfirmationModal: {isOpen: false}
  });

  // Perform delete
  if (itemType === 'question') {
    dispatch('DELETE_QUESTION', {questionId: itemId});
  }
  // ... other types
},
```

**Add confirmation modal to view:**
```javascript
{state.deleteConfirmationModal?.isOpen && (
  <div
    className="modal-overlay"
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="confirm-delete-title"
    aria-describedby="confirm-delete-desc"
  >
    <div className="modal-content">
      <h3 id="confirm-delete-title">Confirm Delete</h3>
      <p id="confirm-delete-desc">{state.deleteConfirmationModal.message}</p>
      <div className="modal-buttons">
        <button
          onclick={() => dispatch('CONFIRM_DELETE')}
          className="btn-danger"
        >
          Delete
        </button>
        <button
          onclick={() => updateState({deleteConfirmationModal: {isOpen: false}})}
          className="btn-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  </div>
)}
```

#### B. Option 2: Improved ARIA Labels (Simpler)
**Just improve button labels to warn:**
```javascript
<button
  onclick={() => dispatch('DELETE_QUESTION', {questionId})}
  aria-label="Delete question permanently - this cannot be undone"
  title="Delete"
  className="btn-delete"
>
  🗑️
</button>
```

---

### 12. Associate Error Messages with Inputs (30 min)

**Problem:** Error messages displayed but not programmatically associated with inputs.

**Pattern to Apply:**
```javascript
// Add error ID to state
const errorId = `error-${fieldName}`;

// Input with error
<input
  id={fieldName}
  value={value}
  aria-describedby={hasError ? errorId : undefined}
  aria-invalid={hasError ? "true" : "false"}
/>

// Error message
{hasError && (
  <div
    id={errorId}
    className="error-message"
    role="alert"
  >
    {errorMessage}
  </div>
)}
```

**Locations:**
- New assessment form validation errors (line ~4596-4608)
- Section edit errors (line ~1085-1094 CSS reference)
- Question validation errors
- Assessment details panel errors

---

## PHASE 4: ENHANCEMENTS (1 hour) 🔵

### 13. Document Loading States (15 min)
Add `role="status"` to all loading overlays

### 14. Add Status Updates to Pagination (15 min)
```javascript
<div
  className="pagination-info"
  role="status"
  aria-live="polite"
>
  Showing {startIndex} - {endIndex} of {totalCount}
</div>
```

### 15. Improve Discoverability (30 min)
- Add skip links
- Add landmark regions (role="main", role="navigation")
- Add heading at top of component

---

## TESTING CHECKLIST

### Automated Testing
- [ ] Run axe DevTools scan
- [ ] Run WAVE evaluation
- [ ] Run Lighthouse accessibility audit
- [ ] All automated tests pass with 0 critical issues

### Keyboard Testing (Unplug Mouse)
- [ ] Can tab through all interactive elements
- [ ] Can open/close all modals with keyboard
- [ ] Can select from all dropdowns
- [ ] Can use typeaheads with keyboard only
- [ ] Can reorder sections/questions/answers with keyboard
- [ ] Can submit all forms
- [ ] Focus visible on all elements
- [ ] Focus never gets lost/trapped unintentionally

### Screen Reader Testing (NVDA or VoiceOver)
- [ ] All buttons announce their purpose
- [ ] All form fields announce their labels
- [ ] Required fields announced as required
- [ ] Error messages announced
- [ ] Modal open/close announced
- [ ] Status messages announced
- [ ] Loading states announced
- [ ] Dynamic content changes announced

### Visual Testing
- [ ] All focus indicators visible (2px minimum)
- [ ] Color contrast meets WCAG AA (4.5:1 normal, 3:1 large)
- [ ] Text readable without color (use of icons/labels)
- [ ] Works at 200% zoom
- [ ] Works with Windows High Contrast mode

### Functional Testing
- [ ] Can complete full workflow with keyboard only
- [ ] Can complete full workflow with screen reader
- [ ] All modals properly trap focus
- [ ] All error messages associated with inputs
- [ ] All status updates announced

---

## USEFUL RESOURCES

### WCAG Guidelines
- **Quick Reference:** https://www.w3.org/WAI/WCAG21/quickref/
- **Understanding WCAG:** https://www.w3.org/WAI/WCAG21/Understanding/

### ARIA Patterns
- **APG (ARIA Authoring Practices):** https://www.w3.org/WAI/ARIA/apg/
- **Modal Dialog:** https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
- **Listbox:** https://www.w3.org/WAI/ARIA/apg/patterns/listbox/
- **Combobox:** https://www.w3.org/WAI/ARIA/apg/patterns/combobox/

### Testing Tools
- **axe DevTools:** https://www.deque.com/axe/devtools/ (Chrome/Firefox extension)
- **WAVE:** https://wave.webaim.org/extension/ (Already using)
- **Lighthouse:** Built into Chrome DevTools (F12 → Lighthouse tab)
- **Contrast Checker:** https://webaim.org/resources/contrastchecker/

### Screen Readers (Free)
- **NVDA (Windows):** https://www.nvaccess.org/download/
- **VoiceOver (Mac):** Built-in (Cmd+F5)
- **JAWS (Windows):** https://www.freedomscientific.com/products/software/jaws/ (paid, but has trial)

### Keyboard Testing
- **Tab:** Move forward
- **Shift+Tab:** Move backward
- **Enter/Space:** Activate buttons
- **Arrow keys:** Navigate lists/options
- **Escape:** Close modals/dropdowns
- **Home/End:** Jump to start/end of list

---

## QUICK GREP PATTERNS FOR CLAUDE

When starting work, use these to find instances:

```bash
# Clickable divs/spans
className.*clickable
<span.*onclick
<div.*onclick

# Icon-only buttons needing aria-label
<button[^>]*>[^<]*[🗑️✏️✓✗ⓘℹ️📋⚙️CA]+[^<]*</button>
<button[^>]*title=.*>[^<]+</button> (without aria-label)

# Typeaheads
className.*typeahead-dropdown
className.*typeahead-item

# Modals
className.*modal-overlay
<h3.*modal-title

# Forms without labels
<input(?!.*aria-label)(?!.*id=)
<select(?!.*aria-label)(?!.*id=)

# Required fields
<span.*color.*red.*>\*</span>

# Delete buttons
onclick.*DELETE_QUESTION
onclick.*DELETE_ANSWER
onclick.*DELETE_SECTION
```

---

## VERSION CONTROL STRATEGY

### Branch Naming
```
feature/wcag-phase-1-critical
feature/wcag-phase-2-high
feature/wcag-phase-3-medium
```

### Commit Messages
```
feat(a11y): Convert clickable divs to buttons for keyboard access
feat(a11y): Add aria-labels to all icon-only buttons
feat(a11y): Implement semantic listbox for typeaheads
feat(a11y): Add ARIA attributes to modal dialogs
feat(a11y): Implement focus trap in modals
feat(a11y): Add aria-live regions for status updates
feat(a11y): Add keyboard alternative for drag-and-drop
```

### Testing Before Merge
- Run full automated test suite
- Complete keyboard testing checklist
- Test with screen reader
- Get QA sign-off
- Update WCAG compliance documentation

---

## NOTES FOR FUTURE CLAUDE

### Context to Provide
When starting work, tell Claude:
1. "Let's work on WCAG Phase 1 fixes for CareIQ Builder"
2. "Reference the file 'Future Work-WCAGS Compliancy.md'"
3. "Start with converting clickable divs to buttons"

### What Claude Can Do Automatically
- Find all instances with Grep
- Make consistent pattern-based edits
- Apply same fix across multiple locations
- Write action handlers following existing patterns
- Generate CSS that matches existing styles

### What Requires Human Review
- Testing with actual keyboard navigation
- Testing with screen readers
- Verifying focus indicators are visible enough
- Checking color contrast with actual eyes
- User experience decisions (button placement, wording)

### Important Patterns in This Codebase
- **State updates:** Use `updateState({...})`
- **Dispatching actions:** Use `dispatch('ACTION_NAME', {payload})`
- **CSS classes:** Use className (not class)
- **Event handlers:** Use onclick, onkeydown (lowercase)
- **ServiceNow specifics:** No JSX fragments, use arrays `[<div>, <div>]`

---

## ESTIMATED TIMELINE

### With Claude Assisting
- **Phase 1:** 2 hours
- **Phase 2:** 2-4 hours (drag-drop is bulk of time)
- **Phase 3:** 2 hours
- **Phase 4:** 1 hour
- **Testing:** 2-3 hours
- **Total:** 9-12 hours including testing

### Solo Developer
- **Phase 1:** 1-2 days
- **Phase 2:** 2-3 days
- **Phase 3:** 1 day
- **Phase 4:** 0.5 days
- **Testing:** 1 day
- **Total:** 5.5-7.5 days

### Can Skip Drag-Drop Keyboard Alternative
If drag-drop keyboard alternative (#7) is deferred:
- **With Claude:** 2-4 hours total
- **Achieves:** Most of Level A (with documented gap)

---

## SUCCESS CRITERIA

### Phase 1 Complete
- ✅ All clickable elements are buttons or have proper ARIA
- ✅ All icon buttons have aria-labels
- ✅ All typeaheads keyboard navigable
- ✅ All modals have proper ARIA

### Phase 2 Complete
- ✅ Focus trap works in all modals
- ✅ Status messages announced via aria-live
- ✅ Keyboard alternative exists for drag-and-drop
- ✅ Required fields properly marked

### Phase 3 Complete
- ✅ All form labels associated
- ✅ Color contrast verified (WCAG AA)
- ✅ Delete confirmations in place
- ✅ Error messages associated with inputs

### WCAG Level A Achieved
- ✅ Can use component entirely with keyboard
- ✅ Can use component entirely with screen reader
- ✅ All interactive elements identifiable
- ✅ All form controls labeled
- ✅ No critical automated test failures

### WCAG Level AA Achieved
- ✅ All Level A criteria met
- ✅ Color contrast verified at 4.5:1 minimum
- ✅ Focus indicators highly visible
- ✅ Error prevention for destructive actions

---

## FINAL NOTES

- **Don't overthink it:** Most fixes are pattern-based and repetitive
- **Test early:** Don't wait until all changes are done to test
- **Ask Claude:** If stuck, provide context and ask for help
- **Document gaps:** If something can't be fixed immediately, document why
- **Celebrate wins:** Each phase completion is a major achievement

**Remember:** These changes make the product usable by millions more people. It's worth the effort.

---

**Document Version:** 1.0
**Last Updated:** November 6, 2025
**Next Review:** After Phase 1 completion
