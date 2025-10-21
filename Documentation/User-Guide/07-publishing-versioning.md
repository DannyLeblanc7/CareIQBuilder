# Publishing and Versioning

## Overview

Publishing finalizes an assessment and makes it available for use. Versioning allows you to create new iterations of assessments while preserving previous versions. This section covers the publication process, version management, and best practices.

---

## Understanding Assessment Status

### Draft Status

Draft assessments are works in progress:

**Characteristics:**
- **Editable**: Can add, modify, and delete content
- **Not Final**: Content may change
- **Testing Phase**: Used for building and testing
- **Badge Color**: Green "Draft" badge
- **Actions Available**: Edit, Publish

**When to Use Draft:**
- Initial assessment creation
- Building sections and questions
- Adding relationships
- Testing conditional logic
- Making revisions before publication

---

**Screenshot Placeholder 61**: Draft assessment badge and actions

---

### Published Status

Published assessments are finalized and active:

**Characteristics:**
- **Read-Only**: Cannot be modified
- **Finalized**: Content is locked
- **Active Use**: Available for actual assessments
- **Badge Color**: Blue "Published" badge
- **Actions Available**: View, Create New Version

**When Assessment is Published:**
- Content is complete and tested
- Ready for clinical use
- Approved by relevant stakeholders
- All relationships configured
- Quality assurance complete

---

**Screenshot Placeholder 62**: Published assessment badge and actions

---

## Publishing an Assessment

### Prerequisites for Publishing

Before publishing, ensure:

- [ ] All sections are complete
- [ ] All questions are properly configured
- [ ] All answers are added and tested
- [ ] Conditional logic is working correctly
- [ ] All relationships are established
- [ ] Assessment has been thoroughly tested in Preview mode
- [ ] Content reviewed by appropriate stakeholders
- [ ] Spelling and grammar checked
- [ ] Clinical accuracy verified

---

### Publishing Process

#### Step 1: Final Review

1. **Open the Assessment**
   - Ensure assessment is in Draft status
   - Open in builder

2. **Complete Final Testing**
   - Switch to Preview mode
   - Test all conditional logic
   - Verify all questions display correctly
   - Complete full walkthrough as end user would

3. **Return to Edit Mode**
   - Make any final corrections
   - Save all changes

---

#### Step 2: Publish the Assessment

1. **Locate Publish Button**
   - In the top bar of the builder interface
   - Look for **"Publish"** or **"Publish Assessment"** button
   - Only visible when assessment is in Draft status

---

**Screenshot Placeholder 63**: Publish button location

---

2. **Click Publish Button**
   - Confirmation dialog appears
   - Dialog explains consequences of publishing

---

**Screenshot Placeholder 64**: Publish confirmation dialog

---

3. **Review Confirmation Message**
   - Typical message: "Are you sure you want to publish this assessment? Once published, it cannot be edited. You will need to create a new version to make changes."
   - Read carefully
   - Understand that this action is final

4. **Confirm Publication**
   - Click **"Publish"** or **"Confirm"** button
   - Or click **"Cancel"** to abort

5. **Publication Processing**
   - Backend processes the request
   - May take a few moments
   - Loading indicator may appear

6. **Publication Complete**
   - Success message appears: "Assessment published successfully!"
   - Assessment status changes to "Published"
   - Badge color changes from green to blue
   - Edit controls become unavailable
   - Publish button changes to "Create New Version"

---

**Screenshot Placeholder 65**: Success message after publishing

---

### What Happens When You Publish?

When an assessment is published:

**Backend Changes:**
- Assessment status updated in database
- Assessment marked as active and available
- Timestamp recorded for publication date
- Assessment becomes available for use in care workflows

**UI Changes:**
- Status badge changes to "Published"
- Edit mode disabled
- Cannot add, modify, or delete content
- Cannot change relationships
- Can only view in Preview mode
- "Publish" button replaced with "Create New Version"

**Workflow Changes:**
- Assessment can be deployed to end users
- Can be assigned to patients or care plans
- Results can be recorded and tracked
- Becomes part of active assessment library

---

## Understanding Versioning

### Why Versions?

Versioning allows you to:

- **Update Content**: Modify questions, answers, or relationships
- **Improve Assessments**: Refine based on user feedback
- **Reflect Guideline Changes**: Update to match new clinical guidelines
- **Fix Issues**: Correct errors or unclear questions
- **Track Changes**: Maintain history of assessment evolution

### Version Numbering

Versions follow a sequential numbering pattern:

- **First Version**: v1.0
- **Second Version**: v2.0
- **Third Version**: v3.0
- And so on...

Each new version increments the major version number.

---

**Screenshot Placeholder 66**: Assessment versions list showing v1.0, v2.0, v3.0

---

### Version Relationships

Versions are linked together:

- All versions share a common **Master ID**
- Master ID groups related versions
- Expanding an assessment card shows all versions
- Each version is independent but related

---

## Creating a New Version

### When to Create a New Version

Create a new version when you need to:

- Update questions or answers in a published assessment
- Add new sections or questions
- Modify conditional logic
- Update relationships
- Correct errors or unclear content
- Align with updated clinical guidelines
- Incorporate user feedback

**Important**: You cannot edit a published assessment directly. You must create a new version.

---

### Creating a New Version Process

#### Step 1: Locate Published Assessment

1. **Find the Assessment**
   - In the assessment list, locate the published assessment
   - Status badge should show "Published"

2. **Expand to View Versions** (Optional)
   - Click expand icon to see all versions
   - Identify which version you want to base new version on
   - Usually the most recent published version

---

#### Step 2: Create New Version

1. **Click "Create New Version" Button**
   - On the assessment card
   - Button only appears for published assessments

---

**Screenshot Placeholder 67**: Create New Version button location

---

2. **Confirmation Dialog**
   - Dialog appears asking for confirmation
   - Message explains a new draft will be created

3. **Confirm Creation**
   - Click **"Create Version"** or **"Confirm"**
   - Or **"Cancel"** to abort

4. **Version Creation Processing**
   - Backend copies the published assessment
   - Creates new version with incremented number
   - May take a moment for large assessments
   - Loading indicator appears

5. **New Version Created**
   - Success message: "New version created successfully!"
   - New assessment appears in list
   - Version number incremented (e.g., v1.0 → v2.0)
   - Status is **Draft**
   - Automatically opens in builder (or available to open)

---

**Screenshot Placeholder 68**: New version created message

---

### What Gets Copied?

When you create a new version, the following are copied:

**Copied Content:**
- All sections (structure and names)
- All questions (text, type, voice)
- All answers (text, settings, secondary inputs)
- All relationships (triggered questions, guidelines, PGI)
- Assessment metadata (name, category, policy number)

**What Changes:**
- **Version number**: Increments (v1.0 → v2.0)
- **Status**: New version is Draft (editable)
- **Created date**: Shows current date
- **Assessment ID**: New unique ID generated

**Not Copied:**
- Actual assessment results (patient responses)
- Usage statistics
- Deployment configurations

---

### Editing the New Version

Once the new version is created:

1. **Open in Builder**
   - Click **"Open"** on the new version card
   - Builder loads in Edit mode

2. **Make Changes**
   - Add, modify, or delete sections
   - Update questions and answers
   - Modify relationships
   - Make any necessary improvements

3. **Test Changes**
   - Switch to Preview mode
   - Test all modifications
   - Verify conditional logic still works

4. **Save Changes**
   - Save all modifications
   - Complete testing

5. **Publish When Ready**
   - Follow publishing process
   - New version becomes active

---

## Managing Multiple Versions

### Viewing Version History

To see all versions of an assessment:

1. **Locate the Assessment**
   - Find any version in the assessment list
   - All versions share the same base name

2. **Click Expand Icon**
   - Expand icon (▼) appears on assessment card
   - Click to expand

3. **View All Versions**
   - All versions display
   - Listed chronologically (newest first or oldest first)
   - Each shows version number, status, and dates

---

**Screenshot Placeholder 69**: Expanded version history

---

### Version Information

Each version card shows:

- **Version Number**: v1.0, v2.0, etc.
- **Status**: Draft or Published
- **Created Date**: When version was created
- **Ended Date**: When version was superseded (if applicable)
- **Action Buttons**: Open, Create Version, etc.

---

### Active vs. Inactive Versions

**Active Versions:**
- Most recent published version
- Used for new assessments
- Recommended for current use

**Inactive Versions:**
- Previous published versions
- Historical record
- May still be in use for existing assessments
- Available for reference

**Draft Versions:**
- Work in progress
- Not yet available for clinical use
- Can have multiple draft versions simultaneously (though not recommended)

---

## Version Control Best Practices

### Planning Version Changes

Before creating a new version:

1. **Document Required Changes**
   - List all modifications needed
   - Note why each change is necessary
   - Prioritize changes

2. **Review with Stakeholders**
   - Get input from clinical staff
   - Verify changes align with guidelines
   - Ensure consensus on modifications

3. **Plan Testing**
   - Identify what needs to be tested
   - Assign testing responsibilities
   - Set testing timeline

---

### Making Changes in New Version

**Organized Approach:**

1. **Work Systematically**
   - Complete one section at a time
   - Don't skip around randomly
   - Reduces chance of missing changes

2. **Track Changes**
   - Keep notes of what you modified
   - Document reason for each change
   - Helps with version notes and training

3. **Test Incrementally**
   - Test after each major change
   - Don't wait until all changes are made
   - Easier to identify issues

---

### Documenting Version Changes

**Create Version Notes:**

Maintain a change log for each version:

```
Version 2.0 - Changes
- Added section "Medication Review"
- Updated diabetes screening questions per 2024 ADA guidelines
- Modified conditional logic for smoking assessment
- Fixed typo in Question 15
- Added barrier relationships for transportation questions

Version 3.0 - Changes
- Removed deprecated "Legacy Care Plan" section
- Added new questions for social determinants of health
- Updated PGI relationships based on new care protocols
- Improved question clarity based on user feedback
```

**Share Version Notes:**
- Include in training materials
- Notify end users of changes
- Document in your organization's knowledge base

---

### Version Timing

**When to Publish New Versions:**

**Good Times:**
- After thorough testing complete
- When clinical guidelines update
- During scheduled maintenance windows
- When significant issues are identified
- Based on regular review cycle (annual, bi-annual)

**Avoid Publishing:**
- During peak usage times
- Before major holidays
- When support staff unavailable
- Before adequate testing
- Without stakeholder approval

---

### Multiple Draft Versions

**General Rule**: Avoid having multiple draft versions simultaneously.

**Why:**
- Confusing to track which draft is current
- Risk of editing wrong version
- Difficult to merge changes
- Complicates version control

**If You Have Multiple Drafts:**
1. Decide which one to keep
2. Delete or publish the others
3. Consolidate changes into single draft
4. Communicate status to team

---

## Rollback and Recovery

### No Built-In Rollback

**Important**: CareIQ Builder does not have automatic rollback functionality.

**What This Means:**
- Once published, version is final
- Cannot "unpublish" a version
- Cannot revert to previous version automatically

---

### Manual "Rollback" Process

If you need to revert to a previous version:

1. **Locate Previous Version**
   - Find the earlier version you want to revert to
   - Must be a published version

2. **Create New Version from Previous**
   - Click "Create New Version" on the older version
   - This creates a new draft based on the old version

3. **Verify Content**
   - Open the new draft
   - Confirm it contains the desired content
   - Make any necessary adjustments

4. **Publish New Version**
   - Test thoroughly
   - Publish when ready
   - This becomes the new active version (with a higher version number)

**Example:**
- v1.0 (Published) - Original
- v2.0 (Published) - Has issues, need to revert
- v3.0 (Draft) - Created from v1.0, publish this to "rollback"

---

### Preventing Issues

**Best Practices to Avoid Needing Rollback:**

1. **Thorough Testing**
   - Test exhaustively before publishing
   - Use test cases and checklists
   - Have multiple people test

2. **Staged Deployment**
   - Pilot with small group first
   - Gather feedback
   - Make corrections before wide release

3. **Backup Draft**
   - Create new version
   - Make changes
   - Test completely
   - Only delete old draft after new version published and verified

---

## Archiving and Deleting Versions

### Archiving Old Versions

CareIQ Builder doesn't have a separate "archive" function, but you can:

**Option 1: Leave Inactive**
- Published versions remain in the system
- Not deleted, just not actively promoted
- Available for reference and historical record

**Option 2: Work with Administrator**
- Request archival of very old versions
- May require backend database work
- Consult with ServiceNow administrator

---

### Deleting Draft Versions

If you have an unwanted draft version:

**Note**: Deletion capability depends on your permissions and system configuration.

**Typical Process:**
1. Confirm draft is not needed
2. Look for delete option on draft assessment
3. May need administrator assistance
4. Deletion is permanent - cannot be undone

**Before Deleting:**
- Confirm no one else is working on it
- Verify no valuable changes will be lost
- Communicate with team

---

## Transitioning to New Versions

### Communicating Changes

When publishing a new version:

1. **Notify End Users**
   - Send announcement of new version
   - Highlight major changes
   - Provide timeline for transition

2. **Provide Training**
   - Offer training sessions if changes are significant
   - Create quick reference guides
   - Make version notes available

3. **Support During Transition**
   - Be available for questions
   - Monitor for issues
   - Gather feedback

---

### Phased Rollout

For major changes:

1. **Pilot Group**
   - Deploy to small group first
   - Gather feedback and identify issues
   - Make refinements

2. **Expand Gradually**
   - Roll out to larger groups
   - Monitor usage and issues
   - Continue making improvements

3. **Full Deployment**
   - Deploy to all users
   - Continue monitoring
   - Be prepared for questions

---

## Troubleshooting

### Cannot Publish Assessment

**Possible causes:**
- Assessment already published
- Don't have publish permissions
- Assessment has validation errors
- Backend connection issue

**Solutions:**
1. Verify assessment status is Draft
2. Check with administrator for permissions
3. Review system messages for specific errors
4. Try refreshing the page
5. Contact administrator if problem persists

---

### Publish Button Not Visible

**Possible causes:**
- Assessment is already published
- Don't have appropriate permissions
- Builder in Preview mode

**Solutions:**
1. Check assessment status badge
2. Ensure you're in Edit mode
3. Verify permissions with administrator

---

### Cannot Create New Version

**Possible causes:**
- Assessment is not published
- Already have a draft version
- Don't have version creation permissions
- System limitation on number of versions

**Solutions:**
1. Verify source assessment is published
2. Check if draft version already exists
3. Verify permissions with administrator
4. Consult administrator about version limits

---

### New Version Missing Content

**Possible causes:**
- Copy process incomplete
- Source version had issues
- Backend synchronization problem

**Solutions:**
1. Immediately check what's missing
2. Compare to source version
3. Don't make additional changes until issue resolved
4. Contact administrator
5. May need to delete and recreate version

---

### Multiple Drafts Exist

**Possible causes:**
- Created new version multiple times
- Multiple users created versions
- Previous draft wasn't deleted

**Solutions:**
1. Identify which draft is current/correct
2. Communicate with team
3. Consolidate changes if needed
4. Delete or publish extra drafts
5. Establish process to prevent in future

---

## Best Practices Summary

### Before Publishing

- [ ] Complete all content
- [ ] Test thoroughly in Preview mode
- [ ] Review with stakeholders
- [ ] Check spelling and grammar
- [ ] Verify clinical accuracy
- [ ] Document any known limitations
- [ ] Create version notes

### Publishing Process

- [ ] Final review
- [ ] Confirm intent to publish
- [ ] Verify success message
- [ ] Check status changed to Published
- [ ] Test published version in Preview mode
- [ ] Notify relevant parties

### Version Management

- [ ] Document changes for each version
- [ ] Create new version when updates needed
- [ ] Test new version thoroughly
- [ ] Avoid multiple simultaneous drafts
- [ ] Communicate version changes to users
- [ ] Maintain version history records

### Quality Assurance

- [ ] Follow testing checklist
- [ ] Get peer review
- [ ] Verify conditional logic
- [ ] Check all relationships
- [ ] Ensure accessibility
- [ ] Confirm performance

---

## Next Steps

After publishing:
- Monitor assessment usage
- Gather user feedback
- Track any issues reported
- Plan future updates based on feedback
- Schedule regular reviews
- Consider creating **troubleshooting guides** for end users

