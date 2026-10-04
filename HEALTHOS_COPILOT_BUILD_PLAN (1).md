# HealthOS — End-to-End Project Plan & Build Instructions

## 0. Role

You are GitHub Copilot working inside VS Code as a senior full-stack architect, product engineer, security engineer, database designer, UI/UX engineer, QA engineer, and DevOps engineer.

Build the project described in this document end-to-end.

Do not treat this as a demo or toy CRUD application. Build it as a production-style portfolio project with clean architecture, strong security, clear separation of concerns, tests, documentation, and a polished user experience.

The project must be developed incrementally and remain runnable after every major phase.

---

# 1. Product

## Product name

**HealthOS**

## Tagline

**Your health, organized in one place.**

## Product concept

HealthOS is a personal and family healthcare management platform.

The core problem is that healthcare information is fragmented across paper prescriptions, PDFs, WhatsApp messages, lab reports, hospital portals, medicine boxes, appointment apps, and different healthcare providers.

HealthOS brings the user's healthcare information and follow-up activities into one organized system.

The application should help users:

- maintain a personal health profile
- manage family members
- store medical records
- manage prescriptions
- manage medicines
- track appointments
- organize lab reports
- maintain a chronological health timeline
- create and track treatment plans
- share selected health information with trusted people or healthcare providers
- receive reminders and notifications
- maintain a secure audit trail

HealthOS is an **organization and coordination platform**, not a diagnostic or treatment-prescribing system.

Do not make medical diagnoses or recommend treatment decisions.

---

# 2. Primary users

Design the system around these roles.

## Patient

A normal individual using HealthOS.

Capabilities:

- manage own profile
- manage own medical records
- manage medicines
- manage appointments
- manage health timeline
- manage treatment plans
- manage family members where permitted
- create controlled sharing links
- view notifications

## Family Caregiver

A person authorized by another user to help manage healthcare information.

Capabilities should be permission-based.

Examples:

- view records
- add appointments
- manage medicines
- upload documents

Do not automatically give caregivers full access.

## Healthcare Provider

A doctor or healthcare professional who has been explicitly granted temporary access.

The provider should only see the data the patient has shared.

Access should be time-limited and revocable.

## Platform Admin

Internal platform administrator.

Capabilities:

- manage users
- suspend/reactivate accounts
- inspect system activity
- manage platform configuration
- view audit information

The admin must not automatically receive unrestricted access to sensitive patient data.

Use least privilege.

---

# 3. Product principles

Follow these principles throughout development.

1. Security first.
2. Privacy by design.
3. Least privilege.
4. Clear ownership of healthcare data.
5. Explicit consent for sharing.
6. Time-limited access where appropriate.
7. Audit important security and data-access events.
8. Never expose sensitive data unnecessarily.
9. Never put secrets in frontend code.
10. Never store passwords directly.
11. Never use localStorage for sensitive authentication tokens if an HttpOnly secure-cookie approach can be used.
12. Do not build fake medical diagnosis functionality.
13. Prefer maintainable architecture over clever code.
14. Keep frontend and backend contracts explicit.
15. Every important feature must have tests.

---

# 4. Required technology stack

Use the following technologies.

## Frontend

- Next.js
- React
- TypeScript
- JavaScript where appropriate
- Redux Toolkit
- HTML
- CSS
- Tailwind CSS

Use Next.js with TypeScript.

Use React Server Components where appropriate, but do not force server components when client-side interactivity or Redux requires client components.

Use Redux Toolkit for application state that genuinely benefits from centralized client state.

Do not put every piece of UI state into Redux.

Use local component state for local UI concerns.

## Backend

- Python
- Django
- Django REST Framework
- PostgreSQL

Use Django as the primary backend framework.

Use Django REST Framework for APIs.

Use PostgreSQL as the primary database.

## Supporting technologies

Use these when they provide real value:

- Redis
- Celery
- Docker
- Docker Compose
- object/file storage abstraction
- email service abstraction
- background jobs
- OpenAPI documentation
- pytest
- Django testing tools
- frontend testing tools
- ESLint
- Prettier
- Ruff
- Black
- pre-commit

Use Redis + Celery for asynchronous work such as:

- email notifications
- reminders
- document processing
- scheduled jobs
- notification delivery

Do not add infrastructure merely to make the stack look impressive.

---

# 5. Repository structure

Use a monorepo.

Recommended structure:

```text
healthos/
│
├── README.md
├── LICENSE
├── .gitignore
├── .env.example
├── docker-compose.yml
├── Makefile
│
├── frontend/
│   ├── package.json
│   ├── next.config.ts
│   ├── tsconfig.json
│   ├── tailwind.config.ts
│   ├── postcss.config.mjs
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── services/
│   │   ├── store/
│   │   ├── types/
│   │   └── styles/
│   └── public/
│
├── backend/
│   ├── manage.py
│   ├── requirements/
│   ├── config/
│   ├── apps/
│   │   ├── accounts/
│   │   ├── profiles/
│   │   ├── family/
│   │   ├── records/
│   │   ├── medications/
│   │   ├── appointments/
│   │   ├── treatments/
│   │   ├── labs/
│   │   ├── sharing/
│   │   ├── notifications/
│   │   ├── audit/
│   │   └── common/
│   └── tests/
│
├── docs/
│   ├── architecture/
│   ├── api/
│   ├── database/
│   ├── security/
│   └── decisions/
│
└── scripts/
```

Adjust this structure if there is a strong architectural reason.

---

# 6. Architecture

Use this high-level architecture:

```text
                         Browser
                            │
                            ▼
                    Next.js Frontend
                            │
                    REST API / JSON
                            │
                            ▼
                   Django REST API
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
         PostgreSQL       Redis        File Storage
              │             │
              │             ▼
              │          Celery
              │             │
              │             ▼
              │      Background Jobs
              │
              ▼
        Audit / Business Data
```

Keep responsibilities clear.

Frontend:

- presentation
- client interaction
- API consumption
- client state
- form handling
- validation for UX

Backend:

- authentication
- authorization
- business rules
- validation
- database access
- sharing permissions
- audit logging
- notifications
- file metadata
- background jobs

PostgreSQL:

- durable application data

Redis:

- caching where justified
- Celery broker/result backend where appropriate
- rate limiting support if needed

Celery:

- asynchronous work

---

# 7. Authentication

Implement secure authentication.

Required flows:

- signup
- login
- logout
- refresh session
- email verification
- forgot password
- reset password
- change password
- account deactivation
- account reactivation where appropriate

Prefer:

- short-lived access token
- secure HttpOnly refresh/session cookie
- token rotation
- refresh-token/session revocation
- CSRF protection where cookie authentication requires it
- rate limiting
- secure password hashing

Do not store access or refresh tokens in localStorage.

Use environment variables for secrets.

Implement account security events in the audit log.

---

# 8. Authorization

Implement role-based access control plus resource-level ownership.

Do not rely only on frontend role checks.

Every sensitive API endpoint must enforce authorization server-side.

Examples:

```text
Patient A cannot access Patient B's records.

Caregiver can only access records explicitly shared with them.

Provider can only access records included in the current consent.

Expired sharing access must stop working.

Revoked sharing access must stop working immediately.

Admin permissions must be separate from patient-data access.
```

Use explicit permission checks.

Document authorization rules.

Add automated tests for authorization boundaries.

---

# 9. Core data model

Design the database carefully.

At minimum, consider the following entities.

## Identity

- User
- Role
- Permission
- UserRole

## Profile

- PatientProfile
- EmergencyContact
- Allergy
- MedicalCondition
- VitalRecord
- VaccinationRecord

## Family

- FamilyRelationship
- CaregiverAccess
- FamilyGroup if useful

## Medical records

- MedicalRecord
- MedicalDocument
- Prescription
- PrescriptionItem
- Doctor
- HealthcareProvider

## Medications

- Medication
- MedicationSchedule
- MedicationLog
- MedicationReminder

## Appointments

- Appointment
- AppointmentNote
- AppointmentReminder

## Laboratory

- LabReport
- LabResult
- LabTestDefinition

## Treatment

- TreatmentPlan
- TreatmentTask
- TreatmentFollowUp

## Sharing

- DataShare
- DataSharePermission
- ShareAccessLog

## Notifications

- Notification
- NotificationPreference

## Security

- AuditLog
- LoginEvent
- Session

Do not blindly create every table above.

Normalize the model where appropriate.

Avoid premature overengineering.

Document important relationships.

---

# 10. Health timeline

The health timeline is a major product feature.

It should combine important healthcare events into chronological order.

Example:

```text
Oct 04
│
├── Doctor consultation
│
├── Prescription created
│
├── Blood test ordered
│
Oct 07
│
├── Blood report uploaded
│
Oct 14
│
└── Follow-up appointment
```

Design the backend so timeline events can be derived from domain entities.

Do not duplicate the same information unnecessarily into a timeline table unless there is a clear reason.

The frontend should provide:

- chronological view
- filters
- event type filters
- date filtering
- search
- record navigation

---

# 11. Medical documents

Users should be able to upload documents such as:

- prescriptions
- lab reports
- discharge summaries
- medical bills
- vaccination records
- scan reports

Requirements:

- secure upload
- file type validation
- file size limits
- safe filenames
- malware scanning abstraction
- private storage
- authorization before download
- metadata storage
- upload audit event
- delete/archive support

Never expose private files through predictable public URLs.

Prefer signed/temporary URLs when object storage is introduced.

For local development, use a local/private storage implementation.

Create a storage abstraction so cloud storage can be added later.

---

# 12. Lab reports

Version 1:

Users can upload and manually record lab results.

Example:

```text
Test: Hemoglobin
Value: 13.2
Unit: g/dL
Reference range: 12.0 - 16.0
Date: 2026-10-04
```

Provide trend visualization.

Do not make medical diagnosis claims.

Later architecture may support document extraction/OCR.

If OCR is implemented later:

- extraction must be clearly marked as machine-generated
- user must review extracted data
- original document must remain available
- extracted data must not silently overwrite user-entered data

---

# 13. Medication management

Users should be able to:

- add medication
- specify dosage
- specify frequency
- set start/end dates
- pause medication
- record doses
- configure reminders
- view adherence history

Example:

```text
Medication
Metformin

Dosage
500 mg

Frequency
Twice daily

Schedule
08:00
20:00
```

Do not recommend medication or dosage changes.

Do not claim that a medication is medically appropriate.

---

# 14. Appointment management

Support:

- appointment creation
- appointment update
- cancellation
- reminder
- notes
- doctor/provider
- hospital/clinic
- date/time
- reason
- follow-up date

The UI should clearly distinguish:

```text
Upcoming
Completed
Cancelled
Missed
```

Use background jobs for reminders.

---

# 15. Treatment plans

A treatment plan should be an organizational workflow.

Example:

```text
Treatment Plan
----------------------------

Title:
Post-consultation follow-up

Tasks:
✓ Blood test
✓ Upload report
○ Follow-up consultation

Next review:
Oct 14
```

Do not use treatment plans to prescribe treatment automatically.

---

# 16. Family management

This should be one of the strongest features.

A user should be able to add family members and define appropriate access.

Example:

```text
Family

Mother
  Access: Caregiver

Father
  Access: Caregiver

Child
  Access: Guardian
```

Permissions should be explicit.

Example:

```text
VIEW_PROFILE
VIEW_MEDICATIONS
MANAGE_MEDICATIONS
VIEW_APPOINTMENTS
MANAGE_APPOINTMENTS
VIEW_DOCUMENTS
UPLOAD_DOCUMENTS
VIEW_LAB_RESULTS
```

Avoid one giant permission such as:

```text
FULL_ACCESS
```

unless there is a clear reason.

---

# 17. Healthcare provider sharing

Implement consent-based sharing.

Example:

```text
Share health information

Recipient:
Dr. Sharma

Data:
[x] Profile
[x] Medications
[x] Lab reports
[ ] Financial records

Duration:
24 hours
```

After expiration:

```text
Access denied
This sharing permission has expired.
```

Patient should be able to revoke access.

Track:

- who created the share
- who received it
- what was shared
- when
- expiry
- revocation
- access attempts

This is a major security feature.

---

# 18. Audit logging

Audit security-sensitive and healthcare-data-sensitive events.

Examples:

```text
LOGIN
LOGOUT
PASSWORD_CHANGED
ACCOUNT_DEACTIVATED
DOCUMENT_UPLOADED
DOCUMENT_VIEWED
RECORD_CREATED
RECORD_UPDATED
RECORD_DELETED
SHARE_CREATED
SHARE_REVOKED
SHARED_RECORD_ACCESSED
ROLE_CHANGED
```

Audit logs should contain enough context to investigate activity without unnecessarily storing sensitive content.

Never store passwords or raw authentication tokens.

---

# 19. Notifications

Create a notification system supporting:

- in-app notifications
- email abstraction
- appointment reminders
- medication reminders
- sharing notifications
- account/security notifications

Design notification preferences.

Example:

```text
Appointment reminders
Email: ON
In-app: ON

Medication reminders
Email: OFF
In-app: ON
```

Use Celery for asynchronous delivery.

---

# 20. Frontend design

The UI must look like a modern healthcare SaaS product.

Avoid:

- generic Bootstrap-looking interfaces
- excessive gradients
- cluttered dashboards
- huge unnecessary cards
- poor mobile responsiveness
- inaccessible color combinations

Use Tailwind CSS.

Use a clean design system:

- consistent spacing
- typography hierarchy
- reusable buttons
- reusable form controls
- cards
- dialogs
- tables
- tabs
- badges
- alerts
- empty states
- loading states
- error states

Use responsive design from the beginning.

Mobile layout matters because healthcare users may access the application from phones.

---

# 21. Required frontend pages

Create at minimum:

## Public

- landing page
- login
- signup
- email verification
- forgot password
- reset password

## Authenticated

- dashboard
- profile
- health profile
- medical records
- medical document detail
- medications
- medication detail
- appointments
- appointment detail
- lab reports
- lab report detail
- treatment plans
- treatment plan detail
- health timeline
- family
- family member detail
- sharing
- notifications
- security/settings

## Admin

- admin dashboard
- user management
- user detail
- audit logs

---

# 22. Dashboard

The dashboard should answer:

> "What do I need to know or do about my health today?"

Include:

- upcoming appointments
- today's medication tasks
- pending treatment tasks
- recent reports
- recent timeline events
- family overview
- notifications
- quick actions

Avoid presenting unverified medical interpretations.

---

# 23. Redux architecture

Use Redux Toolkit.

Suggested slices:

```text
authSlice
userSlice
notificationsSlice
appointmentsSlice
medicationsSlice
familySlice
recordsSlice
sharingSlice
```

Do not put every server response permanently into Redux.

Use a sensible server-state strategy.

If Redux Toolkit Query is used, prefer it for API/server state.

Keep UI-only state local.

---

# 24. API architecture

Use REST APIs.

Prefix APIs:

```text
/api/v1/
```

Example:

```text
POST   /api/v1/auth/register/
POST   /api/v1/auth/login/
POST   /api/v1/auth/logout/
POST   /api/v1/auth/refresh/

GET    /api/v1/profile/
PATCH  /api/v1/profile/

GET    /api/v1/medications/
POST   /api/v1/medications/
GET    /api/v1/medications/{id}/
PATCH  /api/v1/medications/{id}/
DELETE /api/v1/medications/{id}/

GET    /api/v1/appointments/
POST   /api/v1/appointments/

GET    /api/v1/records/
POST   /api/v1/records/

GET    /api/v1/timeline/

GET    /api/v1/family/
POST   /api/v1/family/

GET    /api/v1/shares/
POST   /api/v1/shares/
POST   /api/v1/shares/{id}/revoke/
```

Use consistent response and error formats.

Add pagination.

Add filtering where appropriate.

Add sorting where appropriate.

Document APIs using OpenAPI.

---

# 25. API error format

Use a consistent structure.

Example:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request contains invalid data.",
    "fields": {
      "email": [
        "Enter a valid email address."
      ]
    }
  }
}
```

Do not expose internal stack traces to users.

---

# 26. Validation

Frontend validation:

- improve user experience
- provide immediate feedback

Backend validation:

- authoritative
- always required

Never trust frontend validation.

Validate:

- file types
- file sizes
- IDs
- permissions
- ownership
- dates
- relationships
- request payloads

---

# 27. Security requirements

Implement:

- password hashing
- CSRF protection as appropriate
- secure cookies
- CORS configuration
- rate limiting
- authorization checks
- object-level permissions
- input validation
- file validation
- secure headers
- environment-based secrets
- session invalidation
- audit logs
- least privilege
- protection against IDOR
- protection against mass assignment
- protection against insecure direct object references
- safe error messages

Never expose:

- passwords
- password hashes
- refresh tokens
- secret keys
- private storage URLs
- unnecessary medical information

---

# 28. Database requirements

Use PostgreSQL.

Use Django migrations.

Use:

- foreign keys
- indexes
- unique constraints
- check constraints where useful
- timestamps
- soft deletion only where justified

Use UUIDs for externally exposed identifiers where appropriate.

Do not expose sequential internal database IDs unnecessarily.

Create indexes for common queries.

Document important indexing decisions.

---

# 29. Environment configuration

Provide:

```text
.env.example
```

Never commit:

```text
.env
```

Example configuration:

```text
DJANGO_SECRET_KEY=
DJANGO_DEBUG=
DATABASE_URL=
REDIS_URL=
CORS_ALLOWED_ORIGINS=
FRONTEND_URL=
EMAIL_HOST=
EMAIL_PORT=
EMAIL_HOST_USER=
EMAIL_HOST_PASSWORD=
DEFAULT_FROM_EMAIL=
```

Use environment-specific settings.

---

# 30. Docker

Provide Docker Compose for local development.

Services should include:

```text
frontend
backend
postgres
redis
worker
```

Only add services when actually required.

The project should be runnable using documented commands.

---

# 31. Testing

Testing is mandatory.

## Backend

Test:

- authentication
- authorization
- permissions
- models
- API endpoints
- file upload security
- sharing
- expiry
- revocation
- audit logging
- notification creation
- Celery tasks

Important authorization tests:

```text
User A cannot access User B's record.

Caregiver cannot access unshared data.

Provider cannot access expired share.

Provider cannot access revoked share.

Patient cannot modify another patient's record.

Admin cannot bypass healthcare-data access rules accidentally.
```

## Frontend

Test:

- important components
- forms
- authentication states
- loading states
- error states
- permission-dependent UI
- critical user flows

## Integration

Test important end-to-end workflows:

```text
Signup
→ Verify email
→ Login
→ Add medication
→ Add appointment
→ Upload document
→ Create share
→ Access shared record
→ Revoke share
→ Confirm access denied
```

---

# 32. Accessibility

Follow good accessibility practices.

Use:

- semantic HTML
- labels
- keyboard navigation
- focus states
- accessible dialogs
- accessible forms
- sufficient contrast
- meaningful error messages
- screen-reader-friendly labels

Do not rely on color alone.

---

# 33. Performance

Build with performance in mind.

Frontend:

- Next.js code splitting
- optimized images
- lazy loading where appropriate
- avoid unnecessary client components
- avoid unnecessary Redux state

Backend:

- select_related/prefetch_related
- pagination
- database indexes
- caching where useful
- asynchronous jobs

Do not optimize prematurely.

Measure before adding complexity.

---

# 34. Observability

Prepare the architecture for production monitoring.

At minimum:

- structured backend logging
- request IDs/correlation IDs
- error logging
- background job logging
- health endpoint

Example:

```text
GET /api/v1/health/
```

Return a safe health response.

Do not expose database credentials or infrastructure details.

---

# 35. Documentation

Create:

```text
README.md
docs/architecture/overview.md
docs/architecture/frontend.md
docs/architecture/backend.md
docs/database/schema.md
docs/security/security.md
docs/api/api.md
docs/decisions/
```

README must include:

- product overview
- features
- architecture
- technology stack
- prerequisites
- environment setup
- local development
- database setup
- migrations
- running frontend
- running backend
- running Celery
- running tests
- Docker instructions
- API documentation
- security notes

---

# 36. Development phases

Do not attempt to build the entire application in one giant uncontrolled change.

Build in phases.

## Phase 0 — Project foundation

Create:

- monorepo
- frontend
- backend
- PostgreSQL configuration
- Redis configuration
- Docker Compose
- environment files
- linting
- formatting
- basic CI
- README

Verify everything starts successfully.

---

## Phase 1 — Backend foundation

Implement:

- Django configuration
- PostgreSQL connection
- base app structure
- DRF
- API versioning
- health endpoint
- exception handling
- common response patterns
- OpenAPI documentation
- testing foundation

---

## Phase 2 — Authentication & accounts

Implement:

- custom User model
- signup
- login
- logout
- session/token handling
- email verification
- password reset
- change password
- account deactivation
- security events

Write comprehensive tests.

---

## Phase 3 — Profile & health information

Implement:

- patient profile
- emergency contacts
- allergies
- conditions
- vaccinations
- vitals

Create frontend pages.

---

## Phase 4 — Medical records

Implement:

- records
- documents
- private file storage
- upload/download
- document metadata
- permissions
- audit events

---

## Phase 5 — Medications

Implement:

- medication management
- schedules
- dose logging
- reminders
- adherence history

---

## Phase 6 — Appointments

Implement:

- appointment CRUD
- reminders
- notes
- appointment status
- calendar-oriented UI

---

## Phase 7 — Lab reports

Implement:

- lab reports
- test results
- manual data entry
- trend charts
- document association

---

## Phase 8 — Treatment plans

Implement:

- treatment plans
- tasks
- follow-ups
- progress

---

## Phase 9 — Family management

Implement:

- family members
- relationships
- caregiver permissions
- access control

---

## Phase 10 — Sharing & consent

Implement:

- temporary access
- selected permissions
- expiry
- revocation
- provider access
- share access logs

This phase requires especially strong security testing.

---

## Phase 11 — Notifications

Implement:

- in-app notifications
- email abstraction
- Celery
- Redis
- scheduled reminders
- notification preferences

---

## Phase 12 — Health timeline

Implement unified timeline.

Support:

- filters
- date ranges
- event types
- search
- navigation to source records

---

## Phase 13 — Admin

Implement:

- admin dashboard
- user management
- account status
- audit log viewer
- safe administrative permissions

---

## Phase 14 — Quality & production hardening

Review:

- security
- performance
- accessibility
- tests
- database indexes
- error handling
- logging
- documentation
- Docker
- CI

Perform a complete authorization audit.

---

# 37. Future features

Do not implement these in the initial MVP unless the architecture is ready and there is a clear reason.

Potential future features:

- OCR for medical documents
- AI-assisted document extraction
- ABDM interoperability
- insurance tracking
- healthcare expense tracking
- provider directory
- referral workflows
- hospital integration
- appointment booking
- wearable integrations
- health data import/export
- emergency health card
- FHIR-compatible interoperability

AI must not be presented as a medical professional.

Any AI-generated extraction or summary must clearly indicate that it is generated and should be verified.

---

# 38. Git strategy

Initialize Git.

Use meaningful commits.

Example:

```text
feat: initialize healthos monorepo
feat: add django backend foundation
feat: add authentication
feat: add patient profile
feat: add medical records
feat: add medication management
feat: add appointments
feat: add family access control
feat: add secure health sharing
test: add authorization coverage
docs: document architecture
```

Do not commit:

```text
.env
node_modules
__pycache__
*.pyc
coverage
build artifacts
local databases
secret keys
```

---

# 39. Coding standards

## TypeScript

Use strict TypeScript.

Avoid:

```typescript
any
```

unless there is a documented reason.

Prefer:

```typescript
unknown
```

with proper narrowing.

Use reusable types.

Keep API types synchronized with backend contracts where practical.

## Python

Use:

- type hints
- clear naming
- small functions
- service-layer organization where useful
- serializers for API validation
- Django ORM properly
- transactions where required

Follow PEP 8.

Use Ruff/Black.

---

# 40. UI/UX requirements

Every screen must handle:

```text
Loading
Success
Empty
Error
Unauthorized
Not found
```

Example empty state:

```text
No medical records yet.

Upload your first medical document to start building
your health history.
```

Avoid blank screens.

Forms must have:

- clear labels
- validation
- helpful errors
- disabled/loading states
- success feedback

Destructive operations require confirmation.

---

# 41. Responsive design

Support:

- desktop
- tablet
- mobile

Desktop can use:

```text
Sidebar
Main content
```

Mobile can use:

```text
Top navigation
Bottom navigation / compact menu
```

Do not simply shrink the desktop UI.

Design mobile layouts intentionally.

---

# 42. Important product safety boundaries

HealthOS must NOT:

- diagnose diseases
- prescribe medication
- change medication dosage
- tell users to stop medication
- replace a doctor
- make emergency medical decisions
- present uncertain AI output as fact

For emergency-related content, direct users toward appropriate emergency services or healthcare professionals rather than attempting to manage emergencies.

---

# 43. Copilot working rules

Before implementing a phase:

1. Inspect the existing repository.
2. Understand current architecture.
3. Identify dependencies.
4. Check whether the requested functionality already exists.
5. Avoid unnecessary rewrites.
6. Preserve working functionality.
7. Implement the smallest coherent change.
8. Add tests.
9. Run relevant checks.
10. Fix failures.
11. Update documentation.
12. Summarize the changes.

Do not blindly overwrite files.

Do not create duplicate models, services, components, or utilities.

Prefer extending existing architecture.

---

# 44. Do not make assumptions silently

If a decision materially affects architecture, security, database design, or product behavior:

- inspect existing conventions first
- choose a sensible production-grade default
- document the decision
- avoid blocking the entire implementation for minor decisions

Only ask for clarification when the decision cannot reasonably be made without the user's input.

---

# 45. Definition of done

A feature is not complete when the code compiles.

A feature is complete only when:

```text
✓ Backend implemented
✓ Frontend implemented
✓ Database migrations created
✓ Validation implemented
✓ Authorization implemented
✓ Error handling implemented
✓ Loading/empty/error UI implemented
✓ Tests added
✓ Tests passing
✓ Linting passing
✓ Formatting passing
✓ Documentation updated
✓ Security implications reviewed
```

---

# 46. Final acceptance criteria

The final application should allow a new user to:

```text
1. Create an account
2. Verify their email
3. Log in
4. Complete their health profile
5. Add a family member
6. Add a medication
7. Create an appointment
8. Upload a medical document
9. Add lab results
10. Create a treatment plan
11. View the unified health timeline
12. Create a limited health-data share
13. Access the shared data through the authorized flow
14. Revoke the share
15. Confirm revoked access is denied
16. Receive notifications
17. Review security activity
18. Log out securely
```

The complete system should be:

- secure
- maintainable
- responsive
- testable
- documented
- Docker-friendly
- production-oriented
- suitable for a serious software engineering portfolio

---

# 47. Start here

Start by inspecting the current VS Code workspace.

If the workspace is empty, initialize the project from scratch.

If files already exist, do not delete or rewrite them without understanding their purpose.

First create a project implementation plan based on this document.

Then implement **Phase 0 only**.

After Phase 0 is complete:

- run all available checks
- verify frontend starts
- verify backend starts
- verify PostgreSQL connectivity
- verify Redis connectivity if configured
- verify Docker Compose
- verify repository structure
- update README

Then proceed phase-by-phase.

Do not skip tests.

Do not skip security.

Do not create fake placeholder functionality that looks complete but does not work.

The goal is a real, working HealthOS application.
