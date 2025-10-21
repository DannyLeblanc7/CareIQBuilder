# Troubleshooting and Best Practices

## Overview

This section provides solutions to common issues, optimization tips, and best practices for using CareIQ Builder effectively. Use this as a reference when encountering problems or looking to improve your workflow.

---

## Common Issues and Solutions

### Connection Issues

#### "Not Connected to CareIQ Platform"

**Symptoms:**
- Error message at top of screen
- Cannot load assessments
- Cannot save changes
- API calls failing

**Possible Causes:**
- Network connectivity issue
- ServiceNow session expired
- CareIQ backend unavailable
- Authentication token expired

**Solutions:**
1. **Check Network Connection**
   - Verify internet connectivity
   - Try accessing other websites
   - Check if other ServiceNow apps work

2. **Refresh the Page**
   - Press F5 or Ctrl+R
   - System may reconnect automatically
   - Watch for "Connected" message

3. **Re-login to ServiceNow**
   - Log out and log back in
   - Refreshes authentication
   - Renews session

4. **Clear Browser Cache**
   - Clear cache and cookies
   - Reload CareIQ Builder
   - May resolve stale data issues

5. **Contact Administrator**
   - If issue persists
   - May be backend service issue
   - Administrator can check CareIQ platform status

---

### Loading Issues

#### Assessment List Won't Load

**Symptoms:**
- Blank screen
- Spinning loading indicator indefinitely
- No assessments display

**Solutions:**
1. **Wait**: Initial load may take time with many assessments
2. **Refresh**: Try reloading the page
3. **Check System Messages**: Look for error messages at top
4. **Browser Console**: Press F12, check Console tab for errors
5. **Different Browser**: Try Chrome, Firefox, or Edge
6. **Contact Administrator**: Report with any error messages

---

#### Builder Won't Open Assessment

**Symptoms:**
- Clicking "Open" does nothing
- Partial loading then stops
- Builder interface doesn't appear

**Solutions:**
1. **Check Assessment Status**: Verify assessment is accessible
2. **Refresh Page**: Clear any stuck state
3. **Try Different Assessment**: Verify system is working
4. **Clear Browser Cache**: Remove cached data
5. **Check Permissions**: Verify you have access rights
6. **Report Issue**: Contact administrator with assessment ID

---

### Saving Issues

#### Changes Not Saving

**Symptoms:**
- Click Save but changes don't persist
- Reload page and changes are gone
- No success message appears

**Possible Causes:**
- Network interruption during save
- Session timeout
- Validation errors
- Backend error

**Solutions:**
1. **Check System Messages**
   - Look for error messages
   - Read specific error details
   - Address validation issues

2. **Verify Connection Status**
   - Confirm "Connected" message visible
   - If disconnected, reconnect

3. **Check Required Fields**
   - Ensure all required fields filled
   - Verify data formats are correct

4. **Try Again**
   - Make change again
   - Click Save
   - Watch for success message

5. **Document Changes**
   - If issue persists, save work externally
   - Copy question/answer text to document
   - Can re-enter after issue resolved

---

#### "Unsaved Changes" Warning Stuck

**Symptoms:**
- Save/Cancel buttons won't disappear
- Keep showing after clicking Save
- Changes appear to save but buttons remain

**This is a known issue** - See CLAUDE.md for save button pattern.

**Solutions:**
1. **Refresh the Page**
   - Reload to clear stuck state
   - Changes should be saved (check after reload)

2. **Check Actual Save Status**
   - Navigate away and back to section
   - If changes persisted, they saved correctly
   - UI may be out of sync

3. **Contact Administrator**
   - If this happens frequently
   - May indicate code issue needing fix

---

### Display Issues

#### Elements Not Showing Correctly

**Symptoms:**
- Buttons missing
- Text overlapping
- Layout broken
- Controls not visible

**Solutions:**
1. **Check Browser Zoom**
   - Should be 100%
   - Press Ctrl+0 to reset zoom

2. **Increase Window Size**
   - Minimum 1400px width recommended
   - Maximize browser window

3. **Clear Browser Cache**
   - Remove cached stylesheets
   - Reload page

4. **Try Different Browser**
   - Test in Chrome, Firefox, or Edge
   - May be browser-specific issue

5. **Disable Browser Extensions**
   - Ad blockers may interfere
   - Try incognito/private mode

---

#### Dropdown Menus Not Opening

**Symptoms:**
- Click dropdown, nothing happens
- Dropdown opens but immediately closes
- Cannot select from dropdown

**Solutions:**
1. **Click Directly on Dropdown Arrow**
   - Not the label, the arrow/icon

2. **Wait for Page to Fully Load**
   - Ensure loading indicators complete

3. **Check JavaScript Errors**
   - Press F12, check Console tab
   - Look for errors

4. **Try Different Browser**
   - May be browser compatibility issue

---

### Typeahead Search Issues

#### Typeahead Not Showing Results

**Symptoms:**
- Type in search box
- No dropdown appears
- No results shown

**Solutions:**
1. **Type More Characters**
   - May need 3+ characters
   - Try typing more of the search term

2. **Wait for Debounce**
   - Search may be delayed (300-500ms)
   - Wait a moment after typing

3. **Try Different Search Terms**
   - Use different keywords
   - Try partial words

4. **Check Connection**
   - Verify "Connected" message
   - May be backend search issue

5. **Escape and Retry**
   - Press Escape to close
   - Click in field and try again

---

#### Typeahead Results Wrong

**Symptoms:**
- Results don't match search
- Seeing results for wrong content type
- Results from different assessment

**Solutions:**
1. **Clear Search Field**
   - Delete text and start over

2. **Verify Context**
   - Ensure you're in correct section/question
   - Check you're searching right content type

3. **Refresh Page**
   - Clear any stuck state
   - Try search again

---

### Relationship Issues

#### Cannot Add Relationship

**Symptoms:**
- Select item but doesn't add
- Click Add/Confirm, nothing happens
- Relationship doesn't appear in list

**Solutions:**
1. **Ensure Answer is Saved**
   - Can't add relationships to unsaved answers
   - Save question first, then add relationships

2. **Check for Duplicates**
   - May already have that relationship
   - Look through existing relationships

3. **Verify Connection**
   - Check connection status
   - May be network issue

4. **Try Closing and Reopening Modal**
   - Close relationship modal
   - Reopen and try again

---

#### PGI Tree Won't Expand

**Symptoms:**
- Click problem/goal, doesn't expand
- Loading spinner indefinitely
- No child items load

**Solutions:**
1. **Wait**: May take a moment to load
2. **Check Connection**: Verify backend connection
3. **Try Different Item**: Test if issue is specific to one item
4. **Refresh Page**: Clear stuck state
5. **Check System Messages**: Look for errors

---

### Performance Issues

#### Slow Loading

**Symptoms:**
- Page takes long time to load
- Responses are slow
- Operations laggy

**Solutions:**
1. **Check Network Speed**
   - Test internet connection
   - Close bandwidth-heavy applications

2. **Reduce Browser Load**
   - Close unnecessary tabs
   - Clear browser cache
   - Disable extensions

3. **Section Size**
   - Very large sections (30+ questions) may be slow
   - Consider breaking into smaller sections

4. **Browser Resources**
   - Restart browser
   - Restart computer if necessary
   - Ensure adequate RAM available

---

#### Browser Freezing

**Symptoms:**
- Browser becomes unresponsive
- Cannot click anything
- Page frozen

**Solutions:**
1. **Wait**: May resolve itself (give it 30 seconds)
2. **Check Task Manager**: Look for high CPU/memory usage
3. **Close Other Tabs**: Free up resources
4. **Refresh Page**: May lose unsaved work
5. **Report Issue**: Note what you were doing when it froze

---

## Best Practices

### Assessment Design

#### Plan Before Building

**Steps:**
1. **Define Purpose**
   - What information do you need?
   - Who will complete the assessment?
   - How will data be used?

2. **Outline Structure**
   - Sketch section hierarchy
   - Group related questions
   - Plan question flow

3. **Identify Conditional Logic**
   - Which questions depend on others?
   - Map trigger relationships
   - Avoid circular dependencies

4. **Review with Stakeholders**
   - Clinical staff
   - End users
   - Subject matter experts

---

#### Keep It Simple

**Guidelines:**
- **Clear Questions**: Use simple language
- **Logical Flow**: Questions in natural order
- **Manageable Length**: Not too long (30-45 minutes max)
- **Appropriate Detail**: Enough depth, not overwhelming

**Example - Simple is Better:**
- ❌ "Have you experienced any episodes of acute dyspnea particularly during nocturnal hours?"
- ✅ "Do you have shortness of breath at night?"

---

#### Use Consistent Formatting

**Consistency Helps Users:**
- Question phrasing style
- Answer format (parallel structure)
- Voice selection (consistent per section)
- Capitalization and punctuation

**Example - Consistent Answers:**
```
Good:
- Never
- Rarely
- Sometimes
- Often
- Always

Bad:
- Never
- Rare
- It happens sometimes
- Frequently occurring
- All the time
```

---

### Question Writing

#### Best Practices

**Do:**
- ✅ One question, one concept
- ✅ Use simple, clear language
- ✅ Avoid double negatives
- ✅ Be specific
- ✅ Include context if needed

**Don't:**
- ❌ Combine multiple questions
- ❌ Use jargon without explanation
- ❌ Ask leading questions
- ❌ Make assumptions
- ❌ Use ambiguous terms

---

#### Examples

**Poor Question:**
"Do you not disagree that smoking cessation is unimportant for your health?"
- Double negative, confusing, leading

**Better:**
"How important is quitting smoking to you?"
- Answers: Very important, Somewhat important, Not important

**Poor Question:**
"Do you exercise and eat a healthy diet?"
- Two questions in one

**Better:**
"How often do you exercise?"
"How would you describe your diet?"
- Separate questions

---

### Answer Design

#### Complete Answer Sets

**Include All Options:**
- Cover full range of possibilities
- Add "Other (please specify)" for unlisted options
- Include "Prefer not to answer" when appropriate
- Add "Unknown" or "Not sure" if relevant

**Example - Complete Set:**
```
How often do you exercise?
- Daily
- 3-5 times per week
- 1-2 times per week
- Less than once per week
- Never
- Prefer not to answer
```

---

#### Mutually Exclusive Options

**Use mutually exclusive flag for:**
- "None of the above"
- "Not applicable"
- "Decline to answer"

**Don't use for:**
- Regular answer options
- Items that can coexist

---

#### Secondary Inputs

**When to Use:**

**Text Input:**
- "Other (please specify)"
- "If yes, please describe"
- Open-ended follow-up

**Date Input:**
- "If yes, when?"
- "Date of diagnosis"
- "Last occurrence"

**Numeric Input:**
- "How many?"
- "What dose?"
- "Number of times"

---

### Conditional Logic

#### Keep It Manageable

**Guidelines:**
- **Limit Depth**: Maximum 2-3 levels of conditional questions
- **Avoid Circular Logic**: Question A triggers B triggers A = bad
- **Test Thoroughly**: Every combination
- **Document**: Map complex logic

---

#### Logical Triggers

**Good Use Cases:**
- Yes/No follow-up: "If yes, when?"
- Detail gathering: "If other, specify"
- Risk assessment: "If high risk, complete full evaluation"

**Avoid:**
- Too many layers (confusing)
- Triggers that rarely apply
- Complex multi-conditional logic

---

### Relationship Management

#### Strategic Linking

**Link Relationships When:**
- Clinically meaningful
- Supports care workflow
- Enables reporting
- Triggers interventions

**Don't Link Just Because:**
- Avoid over-linking
- Every relationship should have purpose
- More relationships = more complexity

---

#### PGI Best Practices

**Problem Selection:**
- Use standardized terminologies
- Be specific enough to be actionable
- Align with care planning systems

**Goal Setting:**
- Measurable goals
- Realistic timeframes
- Relevant to problem

**Interventions:**
- Evidence-based
- Actionable by care team
- Specific enough to implement

---

### Testing Strategy

#### Comprehensive Testing

**Test Checklist:**
- [ ] Each question type functions
- [ ] All answer selections work
- [ ] Every triggered question appears/disappears correctly
- [ ] Secondary inputs function
- [ ] Mutually exclusive answers work
- [ ] Section navigation works
- [ ] All relationships configured
- [ ] Cross-section triggers work
- [ ] Performance acceptable
- [ ] Multiple browsers tested

---

#### User Acceptance Testing

**Include End Users:**
- Have actual users test
- Observe them completing assessment
- Note confusion points
- Gather feedback
- Make improvements

**Questions to Ask Testers:**
- Was the purpose clear?
- Were questions understandable?
- Was anything confusing?
- How long did it take?
- What would you change?

---

### Workflow Optimization

#### Efficient Editing

**Tips:**
1. **Work Section by Section**
   - Complete one section fully before moving to next
   - Easier to maintain focus

2. **Use Library Content**
   - Leverage pre-built questions and answers
   - Faster than creating from scratch
   - Already validated

3. **Batch Similar Tasks**
   - Add all sections first
   - Then add all questions
   - Then configure relationships
   - More efficient than switching contexts

4. **Save Frequently**
   - Don't make too many changes before saving
   - Reduces risk of lost work

---

#### Keyboard Shortcuts

Learn and use shortcuts:
- **Ctrl+R or F5**: Refresh page
- **Tab**: Navigate between fields
- **Enter**: Confirm/Save (in some fields)
- **Escape**: Cancel/Close dropdown
- **Ctrl+0**: Reset zoom to 100%

---

### Version Control

#### Documentation

**Maintain Change Log:**
```
Version 2.0 - March 2024
- Added section "Social Determinants"
- Updated diabetes questions per ADA 2024
- Fixed typo in Question 23
- Removed deprecated medication list
- Added 5 new barrier relationships

Version 3.0 - June 2024
- Enhanced PGI relationships
- Improved conditional logic for pain assessment
- Added secondary inputs to 8 questions
- Updated based on pilot user feedback
```

---

#### Change Management

**Process:**
1. **Document Need**: Why is change needed?
2. **Plan Changes**: What specifically will change?
3. **Review**: Get stakeholder approval
4. **Create Version**: Make new draft version
5. **Implement**: Make changes systematically
6. **Test**: Thoroughly test new version
7. **Document**: Record what changed
8. **Communicate**: Notify users
9. **Publish**: Make new version active
10. **Monitor**: Watch for issues

---

### Collaboration

#### Multi-User Environments

**Best Practices:**
- **Communicate**: Let team know when you're editing
- **One Editor at a Time**: Avoid simultaneous editing
- **Save Often**: Reduce conflict risk
- **Check Before Editing**: Ensure no one else is working on it
- **Document Changes**: Help others track modifications

---

#### Handoffs

**When Handing Off to Another User:**
1. **Save All Work**
2. **Document What You Did**
3. **Note Any Issues**
4. **List What's Left to Do**
5. **Communicate Directly**

---

## Security and Compliance

### Data Protection

**Remember:**
- Don't include PHI (Protected Health Information) in assessment questions as examples
- Don't test with real patient data
- Follow your organization's data policies
- Understand who has access to assessments

---

### Access Control

**Best Practices:**
- Use appropriate permissions
- Don't share login credentials
- Log out when finished
- Report unauthorized access
- Follow organizational security policies

---

### Audit Trail

**System Tracks:**
- Who created assessments
- Who published versions
- When changes were made
- Who made modifications

**Best Practices:**
- Don't use shared accounts
- Your actions are logged
- Be thoughtful with edits
- Follow change management process

---

## Getting Help

### Self-Service Resources

**Check First:**
1. This user guide
2. System messages (often explain the issue)
3. Browser console (for technical users)
4. Organization's knowledge base

---

### Contact Support

**When to Contact:**
- Issue not resolved by troubleshooting
- System error messages
- Permission issues
- Data integrity concerns
- Feature requests

**Information to Provide:**
1. **Description**: What were you trying to do?
2. **Steps**: Exact steps you took
3. **Expected**: What should have happened?
4. **Actual**: What actually happened?
5. **Error Messages**: Copy exact text
6. **Screenshots**: If helpful
7. **Browser**: Which browser/version
8. **Assessment ID**: If relevant
9. **Timestamp**: When it occurred

---

### ServiceNow Administrator

**Administrator Can:**
- Check backend logs
- Verify permissions
- Investigate errors
- Access system configuration
- Resolve technical issues

**Administrator Cannot:**
- Necessarily provide clinical guidance
- Always resolve third-party (CareIQ) issues
- Recover deleted data (usually)

---

## Tips for Success

### Start Small

**First Assessment:**
- Keep it simple
- Use library content
- Limited conditional logic
- Get comfortable with interface
- Build complexity gradually

---

### Learn from Examples

**Study Existing Assessments:**
- Look at published assessments
- See how questions are structured
- Learn relationship patterns
- Adopt best practices

---

### Iterate and Improve

**Continuous Improvement:**
- Gather user feedback
- Track common issues
- Update regularly
- Refine based on data
- Stay current with guidelines

---

### Stay Organized

**Organization Tips:**
- Use consistent naming conventions
- Maintain documentation
- Keep change logs
- Organize your work
- Plan before building

---

### Training and Education

**Ongoing Learning:**
- Attend training sessions
- Read update notifications
- Learn new features
- Share knowledge with team
- Ask questions

---

## Quick Reference

### Common Actions

| Task | Location | Button/Action |
|------|----------|---------------|
| Create Assessment | Assessment List | + New Assessment |
| Open Assessment | Assessment Card | Open |
| Add Section | Sections Panel | + Add Section |
| Add Question | Questions Area | + Add Question |
| Add Answer | Under Question | + Add Answer |
| Add Relationship | Answer Card | Relationship Icon |
| Preview Mode | Top Bar | Preview Mode Toggle |
| Publish | Top Bar | Publish Button |
| Create Version | Assessment Card | Create New Version |

---

### Key Reminders

- ✅ Save work frequently
- ✅ Test thoroughly before publishing
- ✅ Published assessments are read-only
- ✅ Use Preview mode for testing
- ✅ Document version changes
- ✅ Communicate with team
- ✅ Plan before building
- ✅ Keep questions clear and simple

---

## Glossary

**Assessment**: Complete questionnaire with sections, questions, and answers

**Section**: Organizational unit containing questions

**Question**: Individual item collecting information

**Answer**: Response option for select-type questions

**Triggered Question**: Question appearing based on answer selection (conditional logic)

**Relationship**: Connection between answer and clinical content

**PGI**: Problem-Goal-Intervention hierarchy

**Draft**: Editable assessment status

**Published**: Read-only, finalized assessment status

**Version**: Distinct iteration of an assessment

**Secondary Input**: Additional input required when answer is selected

**Mutually Exclusive**: Answer that excludes all other selections

**Typeahead**: Search-as-you-type functionality

**Voice**: Indicator of who asks/answers (Case Manager, Caregiver, Patient)

---

## Conclusion

This user guide provides comprehensive information about CareIQ Builder. Remember:

- **Plan First**: Think through your assessment before building
- **Build Systematically**: Work methodically section by section
- **Test Thoroughly**: Verify everything works as expected
- **Document Changes**: Keep records of modifications
- **Communicate**: Work with your team
- **Seek Help**: Don't hesitate to ask questions

CareIQ Builder is a powerful tool for creating clinical assessments. Use it thoughtfully, test thoroughly, and focus on creating clear, useful assessments that support quality care.

**Good luck building great assessments!**

