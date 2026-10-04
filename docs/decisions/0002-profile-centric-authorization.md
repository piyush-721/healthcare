# ADR-0002: Profile-centric authorization

**Status:** Accepted

## Context
Data must be accessible to its owner, a guardian (for a child), and caregivers with specific
permissions, but never automatically to admins. A role-only model (`Patient`, `Caregiver`) can't
express "Rohan may manage his mother's medications but only view her labs".

## Decision
- `PatientProfile` is the subject of all health data. Every account has one self profile, and a
  guardian owns dependent profiles.
- Access is resolved per (user, profile): owner → all permissions; caregiver → the explicit
  permission set on an active, unexpired `CaregiverAccess`; otherwise none.
- The only platform-level role is `ADMIN`, and it confers no health-data access.
- One base viewset (`ProfileScopedViewSet`) implements list scoping, 404-for-foreign objects,
  403-for-view-only writes, create-time profile checks and audit events. A
  `ProfileRelatedField` blocks cross-profile foreign keys.
- The plan's `Role/Permission/UserRole` tables were **not** created. Permissions are a closed enum
  stored on the grant (`ArrayField`), which is simpler and fully indexable.

## Consequences
- New health domains get correct authorization by subclassing the base viewset and declaring two
  permissions.
- A parametrized test matrix exercises every endpoint × role combination.
