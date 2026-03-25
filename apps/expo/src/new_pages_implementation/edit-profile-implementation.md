# Edit Profile Page Implementation

## Current Status

The Edit Profile page exists at `apps/expo/src/app/settings/edit-profile.tsx` with hardcoded user data, non-functional save button, and placeholder avatar.

## Backend Dependencies

- **Profile data**: Needs tRPC endpoint (`trpc.user.profile.get`).
- **Save changes**: Needs tRPC mutation (`trpc.user.profile.update`).
- **Change photo**: Needs image picker and upload to storage (S3/Cloudflare R2).
- **Validation**: Username format, email format, uniqueness check via backend.
- **Avatar initials**: Should derive from user's actual name.

## Implementation Without Backend

### Immediate Fixes (No Backend):

1. **Local profile storage**:
   - Use `AsyncStorage` to store user profile fields (name, username, email, bio).
   - Load initial values from storage, fallback to defaults.

2. **Save changes locally**:
   - On "Save Changes", store updated fields to local storage.
   - Show success feedback (toast) and navigate back.

3. **Avatar initials**:
   - Compute initials from name (first letter of first and last name).
   - Display as text in avatar circle.

4. **Client-side validation**:
   - Validate username format (alphanumeric, dots, underscores, no spaces).
   - Validate email format with regex.
   - Show error messages under fields.

5. **Change photo with local image picker**:
   - Use `expo-image-picker` to select image from gallery/camera.
   - Store image as local file URI and display in avatar.
   - Optionally compress and store as base64 in AsyncStorage (size limit).

### Local Storage Alternative:

- Store profile object in `AsyncStorage` under key `@billion/user_profile`.
- Store avatar image as file URI or base64 string.
- Use `expo-secure-store` for sensitive data (email?).

### Migration Path to Backend:

- Sync local profile to backend when user logs in.
- Upload avatar to cloud storage and store URL in backend.
- Add server-side validation and uniqueness checks.

## Priority: 🟢 High (Basic user identity)

**Can ship with**: Local profile storage, image picker, client validation.
**Blockers**: None for local implementation.
