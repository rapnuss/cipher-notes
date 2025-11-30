# Password-Protected Notes Implementation

## Overview

This document summarizes the implementation plan, architecture decisions, and key learnings from the password-protected notes feature development.

## Original Requirements

1. **Single Password**: One password protects all protected notes
2. **Hidden Until Unlocked**: Protected notes are completely hidden until the password is entered
3. **Client-Side Encryption**: Notes are encrypted with a password-derived key in Dexie DB
4. **Double Encryption**: When syncing to server, protected notes are encrypted twice:
   - First with the password-derived master key (stored in Dexie)
   - Then again with the server sync key (sent to backend)
5. **Password Change**: Users can change the password, which re-encrypts and re-syncs all protected notes
6. **No Recovery**: If the password is forgotten, there is no recovery mechanism
7. **Protected Files**: Files can also be protected (blob and title encrypted)

## Architecture

### Encryption Strategy

- **PBKDF2**: Password-Based Key Derivation Function 2
  - 100,000 iterations
  - SHA-256
  - 256-bit AES-GCM key
- **AES-GCM**: Advanced Encryption Standard in Galois/Counter Mode
  - 256-bit key
  - 12-byte unique IV per operation
- **Master Salt**: Unique salt per user for PBKDF2 key derivation
- **Verifier**: Encrypted known string to validate password correctness
- **Per-Note IV**: Each protected note/file has its own unique IV (`protected_iv`)

### Data Flow

```
User Password
    ↓
PBKDF2 (with master_salt)
    ↓
Master Key (in memory when unlocked)
    ↓
AES-GCM Encryption (with per-note IV)
    ↓
Encrypted Content (stored in Dexie)
    ↓
Server Sync Key Encryption
    ↓
Double-Encrypted Content (sent to server)
```

### Sync Architecture

**Dexie as Source of Truth**: The 3-way sync (Memory ↔ Dexie ↔ Server) treats Dexie as the single source of truth.

- **Memory**: Decrypted view of notes (only when unlocked)
- **Dexie**: Encrypted storage (always encrypted for protected notes)
- **Server**: Double-encrypted storage (unaware of protection status)

### Protected Notes Config Sync

The protected notes configuration (master salt, verifier) is synced via the main sync endpoint (`/sync-notes`), not a dedicated endpoint:

- **Optional Field**: `protected_notes_config` is optional in sync request/response
- **Sync Up**: Only when client config is newer than server config
- **Sync Down**: Only when server config is newer than client config
- **Backward Compatible**: Old clients continue to work (field is optional)

## Implementation Details

### Frontend

#### State Management (`frontend/src/state/protectedNotes.ts`)

- **Unlock Status**: Tracks whether protected notes are currently unlocked
- **Derived Key**: Stores the master key in memory (null when locked)
- **Config State**: Tracks whether user has configured protected notes
- **Dialog State**: Manages setup, unlock, and change password dialogs

#### Encryption (`frontend/src/business/protectedNotesEncryption.ts`)

- **`encryptNoteForStorage`**: Encrypts note content (text or todos) and stores in `txt` field
- **`decryptNoteFromStorage`**: Decrypts note content and reconstructs original type
- **`encryptFileTitle`**: Encrypts file title
- **`decryptFileTitle`**: Decrypts file title
- **`protected_type`**: Field indicating original note type ('note' or 'todo') before encryption

#### Database Schema (`frontend/src/db.ts`)

- **Notes Table**: Added `protected`, `protected_iv`, `protected_type` fields
- **Files Table**: Added `protected`, `protected_iv` fields
- **Protected Notes Config Table**: Stores master salt, verifier, verifier IV, updated_at, state

#### Sync (`frontend/src/state/notes.ts`)

- Loads local `protected_notes_config` before sync
- If config is dirty, includes it in sync request
- After sync, if server config is newer, updates local config and locks notes
- Closes any open protected notes when config changes (password changed elsewhere)

#### Conflict Resolution (`frontend/src/business/misc.ts`)

- **Identical Encrypted Content**: If `dirtyNote.txt === serverConflict.txt`, merge proceeds (no conflict)
- **Different Encrypted Content**: If content differs AND either note is protected, return `null` (unresolvable conflict)
- **Protected Files**: Same conflict resolution logic applies

### Backend

#### Schema (`backend/src/db/schema.ts`)

```sql
CREATE TABLE "protected_notes_config" (
  "user_id" bigint PRIMARY KEY NOT NULL,
  "master_salt" varchar(24) NOT NULL,
  "verifier" text NOT NULL,
  "verifier_iv" varchar(16) NOT NULL,
  "updated_at" bigint NOT NULL
);
```

#### Sync Endpoint (`backend/src/endpoints/syncNotes.ts`)

- Accepts optional `protected_notes_config` in request
- Compares `updated_at` timestamps to determine which config is newer
- Updates server config if client config is newer
- Returns server config if it's newer than client config
- Backend remains unaware of which notes/files are protected (flag embedded in encrypted payload)

## Key Learnings

### 1. Content Change Detection

**Problem**: Protected notes were being re-encrypted on every `storeOpenNote` call, even when content hadn't changed, causing false conflicts.

**Solution**: Decrypt the stored note and compare decrypted content with `openNote` before re-encrypting. Only re-encrypt if there's an actual change.

```typescript
if (note.protected === 1 && note.protected_iv) {
  const decrypted = await tryDecryptNote(note)
  if (decrypted) {
    contentChanged = decrypted.title !== openNote.title || ...
  }
}
```

### 2. Conflict Resolution for Encrypted Data

**Problem**: Three-way merge was being attempted on encrypted base64 content, corrupting the data.

**Solution**:
- If encrypted content is identical → no conflict, proceed with merge
- If encrypted content differs AND note is protected → unresolvable conflict (requires manual resolution)

```typescript
if (dirtyNote.txt === serverConflict.txt) {
  txt = dirtyNote.txt // Identical encrypted content
} else if (dirtyNote.protected === 1 || serverConflict.protected === 1) {
  return null // Unresolvable conflict
}
```

### 3. Selection Position Clamping

**Problem**: When note content was updated from sync, cursor positions could be outside document bounds, causing CodeMirror crashes.

**Solution**: Clamp selection positions to valid document bounds when applying updates.

```typescript
const clamp = (n: number) => Math.max(0, Math.min(n, docLen))
trSpec.selection = EditorSelection.create(
  selections.map((s) => EditorSelection.range(clamp(s.anchor), clamp(s.head)))
)
```

### 4. Protected Files Display

**Problem**: Protected files showed encrypted titles and thumbnails in the grid.

**Solution**:
- Decrypt file titles when displaying (only when unlocked)
- Don't show thumbnails for protected files (show lock icon instead)
- Skip thumbnail generation for protected files

### 5. Todo Notes Encryption

**Problem**: Initially, todo notes weren't being encrypted properly.

**Solution**: Store encrypted todo content in the `txt` field (same as text notes) and use `protected_type` to indicate the original type.

### 6. Import/Export

**Export**: Protected notes are exported with encrypted content, `protected`, `protected_iv`, and `protected_type` fields.

**Import**:
- User must enter the old password to decrypt imported protected notes
- Notes are re-encrypted with the current user's password (if unlocked) or converted to unprotected

### 7. Sync Payload Serialization

**Problem**: Protected status was being lost during sync because `protected`, `protected_iv`, and `protected_type` weren't included in the sync payload.

**Solution**: Include these fields in the `TextPutTxt` schema and extract them in `putToNote`/`putToFile`.

### 8. Password Change Detection

**Current Limitation**: If two clients change the password offline, the last one to sync wins (data loss scenario for the other client).

**Potential Solution**: Keep old config as backup, detect password change, and prompt user to re-enter password. (Not yet implemented)

## UI/UX Decisions

1. **Settings vs. Commands**: Protected notes UI moved from Settings dialog to CommandCenter as separate commands
2. **Unlock Location**: Protected notes are unlocked via a settings menu option
3. **File Protection Prompt**: When adding files while protected notes are unlocked, user is prompted "Protect this file?"
4. **Hidden When Locked**: Protected notes/files are completely hidden from the list when locked
5. **Lock Icon**: Protected files show a generic lock icon instead of thumbnails

## File Structure

### Frontend

- `frontend/src/state/protectedNotes.ts` - State management for protected notes
- `frontend/src/business/protectedNotesEncryption.ts` - Encryption/decryption functions
- `frontend/src/components/ProtectedNotesDialog.tsx` - Setup, unlock, change password dialogs
- `frontend/src/components/ProtectFilesDialog.tsx` - Prompt when adding files
- `frontend/src/components/CommandCenter.tsx` - Commands for protected notes operations
- `frontend/src/util/pbkdf2.ts` - PBKDF2 key derivation

### Backend

- `backend/src/db/schema.ts` - Database schema including `protected_notes_config` table
- `backend/src/endpoints/syncNotes.ts` - Sync endpoint with protected notes config handling

## Security Considerations

1. **No Recovery**: If password is forgotten, protected notes cannot be recovered
2. **Master Key in Memory**: The derived master key is only stored in memory when unlocked
3. **Double Encryption**: Server never sees unencrypted content (even with sync key compromise)
4. **Per-Note IV**: Each note/file has unique IV, preventing pattern analysis
5. **Backend Unawareness**: Backend doesn't know which notes are protected (flag embedded in encrypted payload)

## Known Limitations

1. **Offline Password Change Conflict**: If two clients change password offline, last sync wins (data loss for other client)
2. **No Thumbnails for Protected Files**: Protected files don't generate thumbnails (security/privacy)
3. **Manual Conflict Resolution**: Protected note conflicts require manual resolution (no automatic merge)

## Testing Considerations

1. **Multi-Client Sync**: Test password changes across multiple clients
2. **Conflict Scenarios**: Test protected note conflicts with identical vs. different encrypted content
3. **Import/Export**: Test importing protected notes with correct/incorrect password
4. **Lock/Unlock**: Test that protected notes are properly hidden when locked
5. **File Protection**: Test file encryption and decryption flow

## Future Improvements

1. **Password Change Conflict Resolution**: Implement backup config strategy to handle offline password changes
2. **Protected Notes Conflict UI**: Build UI for manually resolving protected note conflicts
3. **Performance**: Optimize decryption of multiple protected notes (already using `Promise.all`)
4. **Error Handling**: Improve error messages for decryption failures
