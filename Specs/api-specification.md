# RuneWorks Text-to-Speech Service
# REST API Specification

**Version:** 1.0  
**API base path:** `/api`  
**Technology:** Node.js, TypeScript, MySQL  
**Authentication:** RuneWorks Auth and Keys  
**Scope:** Tenant → Space → Project  
**Response format:** JSON, except binary audio responses and streaming

---

## 1. API Design Principles

The TTS API follows standard REST and HTTP conventions.

- `GET` retrieves resources without changing them.
- `POST` creates resources or initiates processing.
- `PATCH` updates selected properties of existing resources.
- `PUT` replaces a resource or its complete editable content.
- `DELETE` removes or deactivates resources.
- HTTP status codes communicate success or failure.
- Successful responses contain the requested resource directly, without `success`, `data`, or `message` wrappers.
- Resource IDs exposed through the API are UUIDs. Internal auto-increment database IDs remain private.
- All dates are ISO 8601 UTC timestamps.
- Request and response properties use camelCase.
- Missing resources, including inaccessible resources belonging to another tenant or space, return `404 Not Found`.
- All database operations use tenant and space scoping, including lookups involving internal IDs.
- File content is owned and managed directly by the TTS service.

### 1.1 HTTP status codes

| Code | Meaning |
|---|---|
| 200 | Successful retrieval, update, or completed generation |
| 201 | Resource created |
| 202 | Processing accepted but not completed |
| 204 | Successful deletion; no response body |
| 400 | Invalid or malformed request |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but insufficient permissions |
| 404 | Resource not found or inaccessible |
| 409 | Conflicting resource state |
| 413 | Uploaded file or request too large |
| 415 | Unsupported media type |
| 422 | Valid request structure but invalid content |
| 429 | Rate limit or usage limit exceeded |
| 500 | Unexpected server error |
| 503 | Generation service unavailable |

Authentication failures return `401`. Insufficient roles in an accessible space return `403`. Resources outside the current user's tenant or accessible spaces return `404` to avoid revealing their existence.

### 1.2 Standard request headers

```typescript
interface AuthHeaders {
  Authorization: `Bearer ${string}`;
  "X-Tenant-ID": string;
  "Content-Type"?: string;
}

interface ApiKeyHeaders {
  "X-Tenant-ID": string;
  "X-API-Key": string;
  "X-Space-ID"?: string;
}
```

JWT authentication is used for authenticated user operations. API keys may be used for authorized application operations according to the permissions and space restrictions enforced by RuneWorks Keys.

A valid API key must never implicitly grant space-owner permissions. Service credentials must have explicitly authorized scopes and must not bypass membership checks where user membership is required.

### 1.3 Error response

```typescript
interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}
```

Example:

```json
{
  "error": {
    "code": "VOICE_NOT_FOUND",
    "message": "The requested voice was not found."
  }
}
```

### 1.4 Common types

```typescript
type UUID = string;
type ISODate = string;

type SpaceRole = "owner" | "editor" | "viewer";
type SpaceStatus = "active" | "deleted";

type InviteStatus =
  | "pending"
  | "accepted"
  | "revoked"
  | "expired";

type VoiceType = "preset" | "cloned";

type VoiceStatus =
  | "processing"
  | "active"
  | "failed"
  | "deleted";

type ProjectStatus =
  | "active"
  | "archived"
  | "deleted";

type ScriptStatus = "draft" | "final" | "archived";

type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

type AudioFormat = "mp3" | "wav" | "ogg";

interface VoiceSettings {
  speed?: number;
  pitch?: number;
  volume?: number;
}

interface PageQuery {
  limit?: number;
  cursor?: string;
}

interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

interface AuthProfile {
  userId: string;
  username: string | null;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
}
```

Voice settings are validated against the capabilities of the selected speech engine. Unsupported native controls may be implemented through audio post-processing where appropriate.

---

# 2. User and Space Management

## 2.1 Refresh authenticated user

**Method:** `POST`  
**Route:** `/api/users/refresh`

**Authentication:** JWT  
**Space role:** None required

```typescript
type RefreshUserRequest = Record<string, never>;

interface RefreshUserResponse {
  user: AuthProfile;
  acceptedInvites: {
    inviteId: UUID;
    role: SpaceRole;
    space: Space;
  }[];
  spaces: Space[];
}
```

**Description**

This endpoint synchronizes the authenticated user's current profile with their existing space memberships and processes eligible invitations. The request contains no user identity or profile information; those values are obtained from the trusted RuneWorks authentication service.

The service updates the profile fields stored in all memberships belonging to the authenticated user within the current tenant. It then finds pending invitations matching the user's verified email address and accepts valid invitations for active spaces.

Existing roles must not be overwritten by historical invitations. Revoked memberships may only be reactivated through a valid new invitation.

The response includes the current user profile, newly accepted invitations, and accessible spaces. Repeated requests must be idempotent and must not create duplicate memberships.

## 2.2 List spaces

**Method:** `GET`  
**Route:** `/api/spaces`

**Authentication:** JWT  
**Space role:** Any active membership

```typescript
type ListSpacesRequest = PageQuery;

interface Space {
  id: UUID;
  name: string;
  description: string | null;
  role: SpaceRole;
  status: SpaceStatus;
  createdAt: ISODate;
  modifiedAt: ISODate;
}

type ListSpacesResponse = PageResult<Space>;
```

**Description**

Returns the spaces within the current tenant where the authenticated user has an active membership.

The endpoint must not return spaces owned by other users unless the current user is an authorized member. Revoked memberships and deleted spaces are excluded.

Each returned space includes the user's effective role so the consuming application can determine which operations should be available.

The result is paginated and ordered consistently, with newly created spaces appearing first by default. Pagination must not expose information from other tenants.

An authenticated user who has not joined or created any spaces receives an empty collection rather than an error.

## 2.3 Create space

**Method:** `POST`  
**Route:** `/api/spaces`

**Authentication:** JWT  
**Space role:** None required

```typescript
interface CreateSpaceRequest {
  name: string;
  description?: string;
}

type CreateSpaceResponse = Space;
```

**Description**

Creates a new space within the current tenant and assigns the authenticated user as its initial owner.

The name is required and must be between one and one hundred characters after trimming. The description is optional.

Space creation and initial owner membership creation must occur within a single database transaction. A space must never exist without its initial owner because of partial processing failure.

The endpoint must verify the customer's subscription allowance for additional spaces before committing the transaction.

The response returns the new space with its public UUID and the creator's owner role. The UUID is generated by the server and cannot be supplied by the caller.

## 2.4 Get space

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}`

**Authentication:** JWT  
**Space role:** Viewer, editor, owner

```typescript
interface GetSpaceRequest {
  spaceId: UUID;
}

type GetSpaceResponse = Space;
```

**Description**

Retrieves information about an individual space.

The API resolves the supplied public space identifier within the authenticated tenant and confirms that the current user has an active membership.

The response includes the space name, description, status, creation information, and the requesting user's effective role.

This endpoint does not return project contents, voice files, invitations, or the complete membership list. Those resources are available through their dedicated endpoints.

If the space does not exist, has been deleted, belongs to another tenant, or the user is not an active member, the endpoint returns `404`.

## 2.5 Update space

**Method:** `PATCH`  
**Route:** `/api/spaces/{spaceId}`

**Authentication:** JWT  
**Space role:** Owner

```typescript
interface UpdateSpaceRequest {
  name?: string;
  description?: string | null;
}

type UpdateSpaceResponse = Space;
```

**Description**

Updates the name or description of an existing space.

Only an active owner may perform this operation. Editors and viewers receive `403` after their membership has been established.

The endpoint validates provided fields and updates only those fields explicitly included in the request.

Space ownership, tenant identity, creation information, and membership records cannot be modified through this endpoint.

The modification timestamp is updated following a successful change. The response returns the updated space.

Updates must be transactional and scoped to the current tenant to prevent a customer from modifying another tenant's resources using a known identifier.

## 2.6 Delete space

**Method:** `DELETE`  
**Route:** `/api/spaces/{spaceId}`

**Authentication:** JWT  
**Space role:** Owner

```typescript
interface DeleteSpaceRequest {
  spaceId: UUID;
}

type DeleteSpaceResponse = void;
```

**Description**

Deletes a space and makes its associated resources inaccessible.

The space is initially marked as deleted, preventing new projects, voice profiles, memberships, and generation requests from being created.

Existing generation jobs belonging to the space must be cancelled where possible. Stored projects, scripts, outputs, cloned voices, and files are scheduled for cleanup according to the established retention and deletion policies.

The operation must not allow previously issued invitations to restore access to the deleted space.

A successful request returns `204 No Content`. Filesystem cleanup may continue internally after the database state has been updated.

---

# 3. Space Membership and Invitations

## 3.1 List space members

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/users`

**Authentication:** JWT  
**Space role:** Viewer, editor, owner

```typescript
interface SpaceUser {
  userId: string;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  role: SpaceRole;
  status: "active" | "revoked";
  email?: string | null;
  joinedAt: ISODate | null;
}

type ListSpaceUsersRequest = PageQuery;
type ListSpaceUsersResponse = PageResult<SpaceUser>;
```

**Description**

Returns the members of the selected space.

All active members may view the names and roles of other active members. Email addresses and revoked membership history are restricted to space owners.

The API applies this filtering before producing the response so private membership information cannot be exposed by requesting a different pagination position or query option.

Member identities originate from RuneWorks Auth and are synchronized into the local membership records.

The endpoint must validate current membership rather than relying on previously cached permissions, ensuring that users whose access has been revoked cannot continue viewing space information.

## 3.2 Update member role

**Method:** `PATCH`  
**Route:** `/api/spaces/{spaceId}/users/{userId}`

**Authentication:** JWT  
**Space role:** Owner

```typescript
interface UpdateSpaceUserRequest {
  role: SpaceRole;
}

type UpdateSpaceUserResponse = SpaceUser;
```

**Description**

Changes an existing member's role within the selected space.

Only owners may change roles. The target must already have an active membership, and the updated role must be one of owner, editor, or viewer.

The endpoint must prevent removing the final active owner by demotion. Concurrent ownership changes must be serialized to ensure that two simultaneous requests cannot independently remove the last owner.

Role changes take effect immediately for subsequent requests. Existing authenticated sessions do not retain permissions that have been removed.

The response contains the updated membership with the resulting role.

## 3.3 Remove member or leave space

**Method:** `DELETE`  
**Route:** `/api/spaces/{spaceId}/users/{userId}`

**Authentication:** JWT  
**Space role:** Owner, or the targeted member for self-removal

```typescript
interface RemoveSpaceUserRequest {
  spaceId: UUID;
  userId: string;
}

type RemoveSpaceUserResponse = void;
```

**Description**

Revokes a user's membership in the selected space.

Owners may remove other members, while any member may remove themselves. Editors and viewers cannot remove other users.

The operation changes the membership status to revoked and records the revocation time and responsible user.

The final active owner cannot be removed until another active owner has been assigned.

Revocation immediately prevents access to space resources, including projects, audio outputs, and cloned voices.

The membership record is retained for audit purposes. Rejoining requires a new valid invitation. Successful removal returns `204 No Content`.

## 3.4 List invitations

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/invites`

**Authentication:** JWT  
**Space role:** Owner

```typescript
interface SpaceInvite {
  id: UUID;
  email: string;
  role: SpaceRole;
  status: InviteStatus;
  invitedBy: string;
  expiresAt: ISODate;
  acceptedAt: ISODate | null;
  createdAt: ISODate;
}

type ListInvitesRequest = PageQuery;
type ListInvitesResponse = PageResult<SpaceInvite>;
```

**Description**

Returns invitations associated with the selected space.

Only owners may view this collection because invitation records include recipient email addresses and historical membership activity.

Results include pending, accepted, expired, and revoked invitations, allowing owners to review previous sharing activity.

The API must check current invitation validity when returning results and ensure that expired invitations cannot subsequently be accepted.

Invitation records remain scoped to the tenant and space. Pagination uses a stable order.

The endpoint does not send invitation emails or modify memberships; it only returns stored invitation information.

## 3.5 Create invitation

**Method:** `POST`  
**Route:** `/api/spaces/{spaceId}/invites`

**Authentication:** JWT  
**Space role:** Owner

```typescript
interface CreateInviteRequest {
  email: string;
  role?: SpaceRole;
}

type CreateInviteResponse = SpaceInvite;
```

**Description**

Creates an invitation for another user to join the selected space.

Only owners may invite members. The email is validated, trimmed, and normalized consistently with authenticated user emails. The default invitation role is viewer.

The service rejects invitations for users who are already active members.

An existing invitation for the same email and space may be reopened with updated invitation details rather than creating duplicate records.

Pending invitations expire after the configured validity period.

Where the existing RuneWorks authentication contract supports verified identification of a known user, immediate membership may be granted safely. Otherwise the invitation remains pending until authenticated refresh.

Email delivery is a separate integration and is not implied by successful invitation creation.

## 3.6 Revoke invitation

**Method:** `DELETE`  
**Route:** `/api/spaces/{spaceId}/invites/{inviteId}`

**Authentication:** JWT  
**Space role:** Owner

```typescript
interface RevokeInviteRequest {
  spaceId: UUID;
  inviteId: UUID;
}

type RevokeInviteResponse = void;
```

**Description**

Revokes an outstanding invitation before it is accepted.

Only space owners may perform this operation. The invitation must belong to the selected space and must currently be pending.

Revocation records the time of withdrawal and prevents subsequent acceptance.

An already accepted invitation cannot be revoked through this endpoint because the resulting membership is a separate resource. The owner must remove the member instead.

Requests targeting invitations that are already accepted, expired, or revoked return `409 Conflict`.

Successful revocation returns `204 No Content` and does not remove any existing memberships.

---

# 4. Voice Management

Voices are either globally available presets or custom cloned voices belonging to a space.

Viewer access permits reading voice metadata and using voices for permitted non-mutating operations. Creating or modifying space-owned voices requires editor or owner permissions.

## 4.1 List available voices

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/voices`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface Voice {
  id: UUID;
  name: string;
  description: string | null;
  type: VoiceType;
  language: string;
  gender: "male" | "female" | "other" | "unknown";
  accent: string | null;
  status: VoiceStatus;
  settings: VoiceSettings;
  createdAt: ISODate;
}

interface ListVoicesRequest extends PageQuery {
  type?: VoiceType;
  language?: string;
}

type ListVoicesResponse = PageResult<Voice>;
```

**Description**

Returns the voices available to a particular space.

The response combines globally available preset voices with custom cloned voices owned by the selected space.

Customers cannot discover voices belonging to other spaces, even if they know a voice identifier.

The result may be filtered by type or language. Only voices permitted by the customer's subscription are included.

Private storage paths, reference recordings, and internal model files are never returned.

Voice metadata includes supported characteristics so consuming applications can present appropriate voice choices. Pagination is applied after tenant and space filtering.

## 4.2 Create cloned voice

**Method:** `POST`  
**Route:** `/api/spaces/{spaceId}/voices`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner  
**Content type:** `multipart/form-data`

```typescript
interface CreateVoiceRequest {
  name: string;
  description?: string;
  language?: string;
  referenceAudio: File;
  consentConfirmed: true;
}

interface CreateVoiceResponse {
  id: UUID;
  jobId: UUID;
  status: "processing";
}
```

**Description**

Creates a new custom voice using an uploaded reference recording.

The caller must have editing permission in the selected space and sufficient subscription capacity for an additional voice.

The API validates the recording's format, size, duration, and integrity before placing it in private local storage.

The caller must explicitly confirm authorization to reproduce the recorded voice. The confirmation and authenticated identity are recorded for auditing.

A new voice record and cloning job are created, and processing is queued for the single speech worker.

The response returns `202 Accepted` with the new voice identifier and processing job. The voice becomes usable only after successful processing.

## 4.3 Get voice

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/voices/{voiceId}`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface GetVoiceRequest {
  voiceId: UUID;
}

type GetVoiceResponse = Voice;
```

**Description**

Retrieves metadata for an individual voice available to the current space.

The service first checks space membership and then resolves the requested voice.

Preset voices are accessible according to subscription permissions. Cloned voices must belong to the selected space.

The response includes identifying information, current processing status, language, accent, and configurable voice characteristics.

The endpoint does not disclose reference recordings or internal voice representation files.

If a voice is still processing, its status is returned accordingly. Failed voices remain identifiable to authorized members until deleted.

Unauthorized or nonexistent voice identifiers return `404`.

## 4.4 Update voice

**Method:** `PATCH`  
**Route:** `/api/spaces/{spaceId}/voices/{voiceId}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface UpdateVoiceRequest {
  name?: string;
  description?: string | null;
  settings?: VoiceSettings;
}

type UpdateVoiceResponse = Voice;
```

**Description**

Updates editable metadata and default settings for an existing cloned voice.

Only cloned voices belonging to the selected space may be modified. Global preset voices are read-only.

The endpoint supports updating the voice name, description, and compatible default settings.

Changing these properties does not retrain or regenerate the underlying voice representation.

Existing audio recordings remain unchanged. Future generation requests use the updated defaults unless the caller provides explicit overrides.

Updates are validated against the supported settings of the associated speech model.

The response returns the complete updated voice metadata.

## 4.5 Delete voice

**Method:** `DELETE`  
**Route:** `/api/spaces/{spaceId}/voices/{voiceId}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface DeleteVoiceRequest {
  voiceId: UUID;
}

type DeleteVoiceResponse = void;
```

**Description**

Deletes a custom cloned voice belonging to the selected space.

Preset voices cannot be deleted by customers.

The endpoint marks the voice as deleted and prevents its selection for new speech-generation requests.

Projects that previously referenced the voice retain their scripts and historical audio outputs. Existing recordings are not regenerated or deleted simply because the original voice becomes unavailable.

The service removes stored voice representations and source recordings according to the applicable deletion policy.

Queued generation jobs dependent on the deleted voice must be cancelled or marked invalid before processing.

Successful deletion returns `204 No Content`.

---

# 5. Project Management

Projects belong to one space. All active space members can view projects, while editors and owners may create or modify them.

A project contains its scripts, speaker assignments, and generated audio outputs.

## 5.1 List projects

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/projects`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface Project {
  id: UUID;
  spaceId: UUID;
  name: string;
  description: string | null;
  language: string;
  defaultVoiceId: UUID | null;
  defaultAudioFormat: AudioFormat;
  defaultSettings: VoiceSettings;
  status: ProjectStatus;
  createdBy: string;
  createdAt: ISODate;
  modifiedAt: ISODate;
}

interface ListProjectsRequest extends PageQuery {
  status?: ProjectStatus;
}

type ListProjectsResponse = PageResult<Project>;
```

**Description**

Returns projects belonging to the selected space.

Every active space member can view the project's basic information, regardless of who originally created it.

The service filters projects by tenant and space before applying pagination or requested status filters.

Deleted projects are excluded by default. Archived projects may be included or excluded using the status filter.

The response contains project metadata but does not include complete scripts or audio files.

Because projects inherit sharing permissions from their space, no separate project membership check is required.

Customers cannot retrieve projects from other spaces by manipulating identifiers.

## 5.2 Create project

**Method:** `POST`  
**Route:** `/api/spaces/{spaceId}/projects`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface CreateProjectRequest {
  name: string;
  description?: string;
  language?: string;
  defaultVoiceId?: UUID;
  defaultAudioFormat?: AudioFormat;
  defaultSettings?: VoiceSettings;
}

type CreateProjectResponse = Project;
```

**Description**

Creates a new project within the selected space.

The caller must have editor or owner permissions. The API validates the requested name, language, optional default voice, and output settings.

If a default voice is provided, it must be a globally available preset or an active cloned voice belonging to the same space.

The new project is assigned a server-generated UUID and the current authenticated user is recorded as its creator.

A project initially has no script versions, generated recordings, or speaker assignments.

The endpoint verifies any applicable subscription project limits before creating the record.

Returns `201 Created`.

## 5.3 Get project

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface GetProjectRequest {
  projectId: UUID;
}

type GetProjectResponse = Project;
```

**Description**

Returns the metadata and current configuration of a specific project.

The API verifies that the project belongs to the requested space and that the caller has an active membership with sufficient read permissions.

The response contains the project name, description, language, default voice, output format, and status.

Scripts, speaker assignments, and generated audio are retrieved through separate endpoints to avoid unnecessarily large responses.

The endpoint must not allow a caller to use a valid project UUID to bypass the selected space.

Archived projects remain readable. Deleted projects return `404`.

## 5.4 Update project

**Method:** `PATCH`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface UpdateProjectRequest {
  name?: string;
  description?: string | null;
  language?: string;
  defaultVoiceId?: UUID | null;
  defaultAudioFormat?: AudioFormat;
  defaultSettings?: VoiceSettings;
  status?: "active" | "archived";
}

type UpdateProjectResponse = Project;
```

**Description**

Updates a project's metadata and default generation settings.

Editors and owners may modify projects within their space, including projects created by other members.

Only supplied fields are changed. Voice references must be validated against voices available to the same space.

Changing the project's default voice or audio format does not modify existing scripts or previously generated recordings.

The endpoint can also archive or reactivate a project. Archived projects remain readable but cannot accept new generation requests until reactivated.

The API records the modifying user and update timestamp.

The response contains the updated project.

## 5.5 Delete project

**Method:** `DELETE`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface DeleteProjectRequest {
  projectId: UUID;
}

type DeleteProjectResponse = void;
```

**Description**

Deletes a project and removes it from normal access.

The project is first marked as deleted, preventing further script modifications and generation requests.

Any queued jobs associated with the project are cancelled where possible. Active processing is allowed to finish or is interrupted safely according to worker capabilities.

The associated scripts, speaker assignments, recordings, segments, and file references are scheduled for cleanup under the configured retention policy.

Custom voices belonging to the space remain available because they may be used by other projects.

Successful deletion returns `204 No Content`.

---

# 6. Project Scripts

Each project can contain multiple script versions. Scripts are stored as structured dialogue, supporting both single-speaker narration and multi-speaker conversations.

## 6.1 List script versions

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}/scripts`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface ScriptSummary {
  id: number;
  version: number;
  title: string | null;
  status: ScriptStatus;
  createdBy: string;
  createdAt: ISODate;
  modifiedAt: ISODate;
}

type ListScriptsRequest = PageQuery;
type ListScriptsResponse = PageResult<ScriptSummary>;
```

**Description**

Returns the available script versions associated with a project.

The service verifies that the project belongs to the selected space and the caller has permission to read it.

Scripts are listed by version, with the most recent version appearing first by default.

The response contains summary information rather than complete dialogue content.

This endpoint allows consuming applications to display revision history and select earlier script versions.

Archived scripts remain accessible, while deleted projects are inaccessible.

Version identifiers are local to each project and must always be resolved together with the project and space identifiers.

## 6.2 Create script version

**Method:** `POST`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}/scripts`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface DialogueLine {
  speaker: string;
  text: string;
  pauseAfterMs?: number;
  startMs?: number;
  /** Start this many ms before the previous line (plus its pause) ends, so speakers overlap. Ignored when startMs is set. */
  overlapMs?: number;
  voiceSettings?: VoiceSettings;
}

interface ScriptContent {
  lines: DialogueLine[];
}

interface CreateScriptRequest {
  title?: string;
  script: ScriptContent;
  status?: ScriptStatus;
}

interface ProjectScript extends ScriptSummary {
  projectId: UUID;
  script: ScriptContent;
}

type CreateScriptResponse = ProjectScript;
```

**Description**

Creates a new script version for an existing project.

The request contains structured dialogue with one or more lines. Each line identifies the speaker and the text to be spoken, with optional timing and voice settings.

The API validates the structure, text length, number of lines, and supported settings before saving.

The next version number is assigned automatically using a transaction-safe sequence so simultaneous edits cannot create duplicate version numbers.

The script is stored independently of audio generation. Creating a script does not automatically generate recordings.

The response returns the newly created version with `201 Created`.

## 6.3 Get script

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}/scripts/{scriptId}`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface GetScriptRequest {
  scriptId: number;
}

type GetScriptResponse = ProjectScript;
```

**Description**

Retrieves the complete content of a particular project script version.

The service resolves the script through its parent project and selected space, preventing access to scripts belonging to other projects.

The response contains the title, version, status, author information, and structured dialogue.

Speaker names in the script are resolved against the project's speaker assignments during generation, not during retrieval.

Previous script versions remain available even after newer versions have been created.

The endpoint does not initiate synthesis or modify the script.

A missing script or a script belonging to another project returns `404`.

## 6.4 Update script

**Method:** `PUT`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}/scripts/{scriptId}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface UpdateScriptRequest {
  title?: string;
  script: ScriptContent;
  status: ScriptStatus;
}

type UpdateScriptResponse = ProjectScript;
```

**Description**

Replaces the editable content of an existing draft script.

Only scripts in draft status may have their dialogue replaced. Final and archived scripts are preserved to maintain reliable links between generated audio and the original source content.

The API validates every dialogue entry and ensures the request belongs to the selected project.

Scripts currently referenced by an active generation job cannot be changed until processing completes. For finalized work, customers should create another script version instead.

The modifying user and modification timestamp are recorded.

Successful replacement returns the updated script using `200 OK`.

---

# 7. Project Speaker Assignments

## 7.1 List project speakers

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}/speakers`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface ProjectSpeaker {
  key: string;
  name: string;
  voiceId: UUID;
  voiceSettings: VoiceSettings;
}

type ListSpeakersRequest = Record<string, never>;
type ListSpeakersResponse = ProjectSpeaker[];
```

**Description**

Returns the speaker definitions associated with a project.

Each speaker has a stable key, display name, selected voice, and optional voice settings.

The service validates project membership and returns only speaker assignments belonging to that project.

Voice identifiers reference either global preset voices or custom voices belonging to the same space.

Speaker definitions are independent of script versions, allowing several script revisions to reuse consistent voice assignments.

The response is used by applications when editing dialogue or preparing audio generation.

If a referenced voice has been deleted, its assignment remains visible but cannot be used for new generation until replaced.

## 7.2 Create or replace speaker

**Method:** `PUT`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}/speakers/{speakerKey}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface PutSpeakerRequest {
  name: string;
  voiceId: UUID;
  voiceSettings?: VoiceSettings;
}

type PutSpeakerResponse = ProjectSpeaker;
```

**Description**

Creates or replaces a speaker assignment using a stable speaker key.

The selected voice must be active and available to the current space. The service rejects voices belonging to another space or unavailable under the current subscription.

If the speaker key does not exist, a new assignment is created and the endpoint returns `201 Created`.

If the key already exists, its display name, voice, and default voice settings are replaced, returning `200 OK`.

Changing a speaker assignment affects future generation requests but does not modify previously generated audio or historical job configurations.

## 7.3 Delete speaker

**Method:** `DELETE`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}/speakers/{speakerKey}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface DeleteSpeakerRequest {
  speakerKey: string;
}

type DeleteSpeakerResponse = void;
```

**Description**

Removes a speaker assignment from a project.

The endpoint verifies editor or owner permissions and confirms the speaker exists within the selected project.

Removing an assignment does not delete the underlying voice profile, because that voice may be shared across several projects.

Existing scripts are not rewritten. If a script references the removed speaker, future generation requests must supply a replacement assignment or fail validation.

Previously generated audio remains unchanged.

The endpoint deletes only the project's speaker mapping and returns `204 No Content`.

---

# 8. Speech and Conversation Generation

Generation requests create persistent jobs. All model execution runs through the single TTS worker.

## 8.1 Generate speech

**Method:** `POST`  
**Route:** `/api/spaces/{spaceId}/speech`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface GenerateSpeechRequest {
  projectId?: UUID;
  scriptId?: number;
  text: string;
  voiceId: UUID;

  language?: string;
  voiceSettings?: VoiceSettings;

  output: {
    format: AudioFormat;
    retentionDays?: number;
  };

  delivery?: "sync" | "async" | "stream";
}

interface GenerationAcceptedResponse {
  jobId: UUID;
  status: JobStatus;
}

interface GenerationCompletedResponse {
  jobId: UUID;
  status: "completed";
  audio: AudioOutput;
}
```

**Description**

Generates speech from a single text input using a selected voice.

The service validates the caller's space permissions, selected voice, text length, language, requested settings, and subscription allowance.

The request may optionally associate the generated speech with a project and script. These references must belong to the selected space.

The job is persisted and queued before synthesis begins.

Asynchronous requests return `202 Accepted` with the job identifier. Synchronous requests return a completed result when processing finishes within the configured timeout; otherwise they return the accepted job reference.

Streaming requests use a streaming audio response when worker capacity permits. Otherwise the service returns `503` or a documented busy response rather than silently changing the requested delivery mode.

## 8.2 Generate conversation

**Method:** `POST`  
**Route:** `/api/spaces/{spaceId}/conversations`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface GenerateConversationRequest {
  projectId: UUID;
  scriptId?: number;

  dialogue?: DialogueLine[];

  speakers?: Record<string, {
    voiceId: UUID;
    voiceSettings?: VoiceSettings;
  }>;

  output: {
    format: AudioFormat;
    combine: boolean;
    includeSegments: boolean;
    retentionDays?: number;
  };

  delivery?: "sync" | "async" | "stream";
}

type GenerateConversationResponse =
  | GenerationAcceptedResponse
  | GenerationCompletedResponse;
```

**Description**

Creates a multi-speaker audio recording from a structured dialogue or an existing project script.

The service resolves speaker assignments from the supplied overrides and the project's saved speaker definitions. Every speaker must reference an authorized, active voice.

The dialogue is validated before the job is accepted. The service calculates an initial usage reservation and creates a persistent conversation job.

The worker generates each segment sequentially, applies voice settings, inserts pauses, and mixes overlapping segments where requested.

The completed output may contain a combined recording, individual segments, or both.

Generation uses the same synchronous, asynchronous, and streaming rules as single-speaker synthesis. The worker remains limited to one active synthesis operation.

---

# 9. Generation Job Management

## 9.1 List generation jobs

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/jobs`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface GenerationJob {
  id: UUID;
  projectId: UUID | null;
  type: "speech" | "conversation" | "voice_clone";
  status: JobStatus;
  progressPercent: number;
  createdAt: ISODate;
  startedAt: ISODate | null;
  completedAt: ISODate | null;
  errorCode: string | null;
  errorMessage: string | null;
}

interface ListJobsRequest extends PageQuery {
  projectId?: UUID;
  status?: JobStatus;
}

type ListJobsResponse = PageResult<GenerationJob>;
```

**Description**

Returns generation jobs belonging to the selected space.

Authorized members may inspect job progress, completion states, and errors for projects they can access.

Results can be filtered by project or status. Jobs are ordered by creation time, newest first by default.

The endpoint excludes internal worker credentials, private file paths, and sensitive execution details.

A job's public identifier does not grant access to its contents. Every result is scoped to the authenticated tenant and selected space.

The response supports monitoring queued requests and retrieving historical generation activity without contacting the speech worker directly.

## 9.2 Get generation job

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/jobs/{jobId}`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface GetJobRequest {
  jobId: UUID;
}

interface GetJobResponse extends GenerationJob {
  outputs: AudioOutput[];
}
```

**Description**

Returns the current state of an individual generation job.

The API verifies that the job belongs to the requested space and is accessible to the caller.

Queued jobs report their queued status. Processing jobs report available progress information. Completed jobs include references to generated audio outputs.

Failed jobs include a meaningful error code and safe diagnostic message.

The endpoint reads persistent job state rather than relying on worker memory, ensuring that requests remain trackable after process restarts.

No generation processing is triggered by retrieving job information.

Unknown or inaccessible jobs return `404`.

## 9.3 Cancel generation job

**Method:** `DELETE`  
**Route:** `/api/spaces/{spaceId}/jobs/{jobId}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface CancelJobRequest {
  jobId: UUID;
}

type CancelJobResponse = void;
```

**Description**

Requests cancellation of a queued or currently processing generation job.

Queued jobs can be cancelled before execution. Processing jobs are marked for cancellation, and the worker attempts to stop safely at the next supported interruption point.

Completed jobs cannot be cancelled through this endpoint. Their generated audio remains available until deleted separately or expired.

Cancellation releases unused subscription reservations and removes unnecessary temporary files.

The operation must safely handle simultaneous worker completion and cancellation requests so a job cannot become both completed and cancelled.

A successful cancellation request returns `204 No Content`.

---

# 10. Audio Output Management

## 10.1 List project audio

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/projects/{projectId}/audio`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface AudioOutput {
  id: UUID;
  projectId: UUID;
  jobId: UUID;
  scriptId: number | null;
  name: string | null;
  type: "speech" | "conversation" | "segment";
  format: AudioFormat;
  durationMs: number | null;
  expiresAt: ISODate | null;
  createdAt: ISODate;
}

type ListAudioRequest = PageQuery;
type ListAudioResponse = PageResult<AudioOutput>;
```

**Description**

Returns generated audio outputs associated with a specific project.

Every active member of the containing space may access the project's audio metadata.

The endpoint returns output identifiers, formats, durations, creation dates, and retention information without transferring audio content.

Expired or deleted recordings are excluded.

The response may include complete conversations, single-speaker recordings, and separately stored dialogue segments.

Results are paginated and ordered consistently.

Audio generated by other projects or spaces must never appear in the response, even when the same voice profile was used.

## 10.2 Get audio metadata

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/audio/{audioId}`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface GetAudioRequest {
  audioId: UUID;
}

type GetAudioResponse = AudioOutput;
```

**Description**

Retrieves metadata for a generated audio recording.

The API confirms that the recording belongs to the selected space and has not expired or been deleted.

The response includes its associated project, generation job, script version, file format, duration, and retention deadline.

This endpoint does not transfer the underlying audio file.

The metadata allows client applications to display recording details and determine whether the output remains available.

If the database record exists but the physical file is unavailable, the service must record the storage inconsistency and return an appropriate storage error when a download is attempted.

## 10.3 Download audio

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/audio/{audioId}/download`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface DownloadAudioRequest {
  audioId: UUID;
}

type DownloadAudioResponse = ArrayBuffer;
```

**Description**

Streams the requested audio file from the TTS service's private local storage.

The API first verifies authentication, space membership, recording ownership, and retention status.

File paths are resolved exclusively from trusted database metadata. Customer-supplied paths are never accepted.

The response contains the binary audio data with the appropriate `Content-Type`, `Content-Length`, and `Content-Disposition` headers.

Large recordings are transferred using file streaming rather than loading the entire recording into Node.js memory.

HTTP range requests may be supported to enable seeking and resumable playback.

Expired, deleted, or unauthorized files return `404`.

## 10.4 Delete audio

**Method:** `DELETE`  
**Route:** `/api/spaces/{spaceId}/audio/{audioId}`

**Authentication:** JWT or authorized API key  
**Space role:** Editor, owner

```typescript
interface DeleteAudioRequest {
  audioId: UUID;
}

type DeleteAudioResponse = void;
```

**Description**

Deletes an individual generated recording from the selected space.

Editors and owners may remove audio created by any authorized member of their space.

The service marks the recording as deleted and schedules its associated physical file for removal.

Deleting an output does not delete its parent project, script, voice profile, or historical generation job.

If multiple metadata records reference the same physical file, the storage manager must avoid deleting the file while another active reference remains.

Deleted recordings are immediately unavailable for download.

The operation returns `204 No Content`.

---

# 11. Subscription and Usage

## 11.1 Get subscription limits

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/limits`

**Authentication:** JWT or authorized API key  
**Space role:** Viewer, editor, owner

```typescript
interface SubscriptionLimits {
  plan: string;
  maxSpaces: number | null;
  maxProjects: number | null;
  maxClonedVoices: number | null;
  maxStorageBytes: number | null;
  maxMonthlyAudioMs: number | null;
  maxRequestCharacters: number | null;
  maxConversationLines: number | null;
  maxRetentionDays: number | null;
  allowedFormats: AudioFormat[];
}

type GetLimitsRequest = Record<string, never>;
type GetLimitsResponse = SubscriptionLimits;
```

**Description**

Returns the effective subscription limits applicable to the selected space.

The service retrieves the customer's current entitlements from RuneWorks Subscriptions, using a validated subscription identity rather than trusting values supplied by the caller.

The response includes limits for projects, cloned voices, storage, generated audio duration, request sizes, and retention periods where those limits are defined.

A `null` limit means no numerical limit is imposed for that property by the current plan, although infrastructure safety limits still apply.

The endpoint does not modify subscription information or usage records.

Permissions and restrictions returned here are also enforced independently when executing operations.

## 11.2 Get usage

**Method:** `GET`  
**Route:** `/api/spaces/{spaceId}/usage`

**Authentication:** JWT or authorized API key  
**Space role:** Owner

```typescript
interface GetUsageRequest {
  periodStart?: string;
  periodEnd?: string;
}

interface UsageResponse {
  periodStart: ISODate;
  periodEnd: ISODate;

  generatedAudioMs: number;
  reservedAudioMs: number;
  charactersProcessed: number;
  processingMs: number;

  projectCount: number;
  clonedVoiceCount: number;
  storageBytes: number;
}
```

**Description**

Returns usage statistics for the selected space.

Only space owners may retrieve aggregated billing-related information by default.

The service calculates usage from locally recorded generation activity and combines this with current storage and resource counts.

Completed generation is reported separately from reserved usage associated with pending jobs.

Failed and cancelled jobs must not permanently consume unused allowances.

The requested reporting period must fall within supported date boundaries.

Usage is scoped to the selected space, while subscription-level enforcement may also consider consumption across other spaces owned by the same subscription.

The response contains measured usage rather than estimated pricing.

---

# 12. Service Health

## 12.1 Liveness

**Method:** `GET`  
**Route:** `/health`

**Authentication:** None

```typescript
type HealthRequest = Record<string, never>;

interface HealthResponse {
  status: "ok";
}
```

**Description**

Provides a lightweight liveness check for the Node.js API process.

The endpoint confirms that the application is running and able to respond to HTTP requests.

It does not perform database queries, contact RuneWorks services, initialize speech models, or perform expensive filesystem operations.

This endpoint is intended for process monitoring and reverse-proxy health checks.

The response must avoid exposing version details, infrastructure addresses, environment variables, or customer information.

A running application returns `200 OK`. If the process cannot respond, the external monitoring system detects the failure independently.

## 12.2 Readiness

**Method:** `GET`  
**Route:** `/health/ready`

**Authentication:** None

```typescript
type ReadinessRequest = Record<string, never>;

interface ReadinessResponse {
  status: "ready" | "degraded";
}
```

**Description**

Reports whether the service is ready to accept normal API requests.

The endpoint checks essential local dependencies, including database connectivity and required storage access.

It must distinguish between the API being unavailable and the speech worker being busy. A busy generation worker does not necessarily make the API unready because asynchronous requests may still be queued.

Critical failures preventing request acceptance return `503 Service Unavailable`.

Detailed dependency failures, tenant information, resource consumption, and internal infrastructure data must not be exposed through the public endpoint.

Operational diagnostics should be recorded internally.

---

# 13. Authorization Matrix

| Resource/action | Viewer | Editor | Owner |
|---|---|---|---|
| View spaces and projects | Yes | Yes | Yes |
| View scripts and audio | Yes | Yes | Yes |
| Create/edit projects | No | Yes | Yes |
| Create/edit scripts | No | Yes | Yes |
| Configure project speakers | No | Yes | Yes |
| Generate speech | No | Yes | Yes |
| Generate conversations | No | Yes | Yes |
| Download generated audio | Yes | Yes | Yes |
| Create cloned voices | No | Yes | Yes |
| Delete custom voices | No | Yes | Yes |
| Delete generated audio | No | Yes | Yes |
| Invite members | No | No | Yes |
| Change member roles | No | No | Yes |
| Remove other members | No | No | Yes |
| Leave space | Yes | Yes | Yes |
| Update/delete space | No | No | Yes |
| View space usage | No | No | Yes |

API-key access must have separately defined capabilities. It must not be treated as owner access merely because the credential is valid.

The backend must enforce the matrix regardless of the permissions displayed by consuming applications.

---

# 14. Resource Scoping Rules

All operations must follow these rules:

1. Identify and validate the tenant before resolving any space or resource.
2. Authenticate the calling user or application.
3. Resolve the selected space within the tenant.
4. Validate active membership or the explicitly authorized application scope.
5. Verify the minimum role required for the operation.
6. Resolve projects within that same tenant and space.
7. Resolve scripts and speakers within the selected project.
8. Resolve cloned voices only within their owning space; global presets are exceptions.
9. Resolve audio and generation jobs only within their owning space.
10. Verify subscription entitlements before creating chargeable resources or accepting generation work.
11. Never use IDs supplied in the request body as authority to change the authenticated tenant or selected space.
12. Ensure role revocation takes effect on subsequent requests without relying on stale authorization caches.

Space creation and user refresh are exceptions to the requirement for an existing space membership because first-time users may not yet belong to any space.

---

# 15. Generation and Concurrency Rules

The TTS worker processes one generation operation at a time.

All requests that require synthesis are recorded as persistent jobs before entering the queue.

A job may generate one audio segment or many segments, but it retains ownership of the worker until its processing operation completes or terminates.

Synchronous and streaming requests must not bypass the single-worker limit.

The system must enforce maximum request sizes and queue lengths to prevent a customer from exhausting available storage or monopolizing processing capacity.

Usage reservations must be made atomically so concurrent API requests cannot collectively exceed a customer's allowance.

Generation jobs must be recoverable after process restarts. Repeated processing must not create duplicate billable usage or duplicate published outputs.

Completed jobs retain references to the model, voice selections, and generation settings used to produce their recordings.

---

# 16. File Security and Retention Rules

The TTS service owns all uploaded and generated files.

Uploaded reference recordings, reusable cloned voice representations, temporary segments, and generated audio must be stored outside publicly served directories.

Each stored file must have an owning tenant and space recorded in the database.

Local filesystem access must use generated storage paths rather than user-controlled filenames.

Files are accessed through authenticated endpoints only.

Temporary files must be removed after processing or recovered and cleaned following an interrupted job.

Generated recordings expire according to the configured retention period, subject to subscription limits.

Voice profiles remain available until explicitly deleted or removed through the applicable space or account lifecycle.

Filesystem deletion and database state changes must be coordinated through recoverable cleanup operations so interrupted cleanup can be retried safely.

---

# 17. Data Consistency and Security Requirements

The database does not use foreign-key constraints. All relationship integrity is enforced by the application.

Every inserted or updated child resource must be validated against its parent tenant, space, and project.

Multi-record operations must use MySQL transactions, particularly for space creation, membership changes, invitation acceptance, script version allocation, generation reservations, and job completion.

The API must never expose internal numeric database IDs for spaces, projects, voices, jobs, or audio resources. Script versions currently use internal numeric IDs in the proposed database and should either receive public UUIDs in a migration or be exposed as project-scoped version numbers.

All uploaded audio must pass file format and integrity validation. Accepted content must be decoded safely rather than relying on filename extensions.

Customer text and voice recordings must not be included in ordinary application logs.

Rate limits must apply to both authenticated users and API keys.

Customer voice-cloning authorization must be recorded and enforced according to the applicable service policies.

Finally, all error responses must follow normal HTTP semantics. For example, a missing file or a cache miss returns `404 Not Found`, not a successful response with an empty result or a custom success flag.

---

# 18. Implementation Scope Summary

This specification covers:

- Authenticated user refresh.
- Spaces and memberships.
- Space invitations.
- Global and cloned voices.
- Projects and script versioning.
- Project speaker assignments.
- Single-speaker speech generation.
- Multi-speaker conversations.
- Persistent generation jobs.
- Generated audio metadata and downloads.
- Subscription limits and usage reporting.
- Service health checks.

All resource operations must remain independent of the chosen speech synthesis model.

The implementation should preserve these API contracts when additional models, languages, or worker infrastructure are introduced.