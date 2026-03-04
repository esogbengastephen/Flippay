# Modifications for Local Development

This file documents temporary modifications made to the codebase to facilitate UI/UX development without a backend.

## Modified Files

### 1. app/auth/page.tsx
- Added mock authentication flow to bypass email verification
- Added test user data for UI testing
- Added USE_MOCK_AUTH flag set to true
- Modified handleSendCode function to use mock authentication
- Modified handleVerifyCode function to use mock authentication
- Modified handlePasskeyLogin function to use mock authentication
- Modified handleResendCode function to use mock authentication
- Modified handleRecoverPasskey function to use mock authentication
- Modified checkPasskeyForEmail function to use mock authentication
- Modified handleVerifyRecoveryCode function to use mock authentication

### 2. app/page.tsx
- Added USE_MOCK_AUTH flag set to true
- Modified verifyUser function to handle mock authentication
- Modified user verification to skip backend check for mock users

### 3. app/passkey-setup/page.tsx
- Added USE_MOCK_AUTH flag set to true
- Modified handleSetupPasskey function to handle mock authentication
- Modified checkExistingPasskey function to handle mock authentication

### 4. lib/supabase.ts
- Modified error messages to warnings for missing Supabase keys when using mock authentication

### 5. Admin auth bypass (for admin UI/UX development)
- **lib/admin-permissions.ts**: Added `USE_MOCK_ADMIN_AUTH` flag set to true
- **components/AdminAuthGuard.tsx**: When flag is true, bypasses wallet auth and grants access immediately
- **app/admin/layout.tsx**: When flag is true, sets role to `super_admin` so all admin pages and nav items are visible without API call

## Important Notes

- These modifications are for LOCAL DEVELOPMENT only
- DO NOT PUSH these changes to the main repository
- Revert all changes before committing and pushing to GitHub
- Ensure all backend-dependent functionality works properly before merging

## To Revert Before Pushing

1. Restore the original authentication flow in app/auth/page.tsx
2. Remove all mock data and test user implementations
3. Set USE_MOCK_AUTH flag to false or remove it entirely (auth, page, passkey-setup)
4. Set USE_MOCK_ADMIN_AUTH to false in lib/admin-permissions.ts
5. Re-enable backend API calls
6. Test with actual backend before pushing