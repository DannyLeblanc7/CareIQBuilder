// Simplified client-side HTTP effect body pattern
// Replace the existing MAKE_SECTION_QUESTIONS_REQUEST body with this:

// OLD COMPLEX PATTERN (remove this):
/*
body: (coeffects) => {
    return JSON.stringify({
        app: state.careiqConfig.app,
        region: state.careiqConfig.region,
        version: state.careiqConfig.version,
        accessToken: state.accessToken,
        sectionId: sectionId
    });
}
*/

// NEW SIMPLIFIED PATTERN:
body: (coeffects) => {
    return JSON.stringify({
        data: {
            sectionId: sectionId
        }
    });
}

// BENEFITS OF SIMPLIFIED PATTERN:
// ✅ Only pass essential data (sectionId)
// ✅ No config/token management on client
// ✅ Script Include handles all authentication
// ✅ Much cleaner and maintainable
// ✅ Single source of truth for API calls