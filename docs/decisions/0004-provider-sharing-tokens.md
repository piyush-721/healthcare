# ADR-0004: Provider sharing through scoped tokens

**Status:** Accepted

## Context
Doctors must see what the patient chose, for a limited time, without creating an account.

## Decision
- A `DataShare` carries the profile, scopes, expiry and revocation state, plus an HMAC of a
  256-bit token.
- The link puts the token in the URL fragment. The recipient page sends it in `X-Share-Token`.
- Read-only recipient endpoints check token → revoked → expired → scope on every request, and log
  every attempt.
- Only profile owners can create shares. Caregivers can't re-share.

## Alternatives considered
- **Provider accounts with grants:** stronger identity, but much heavier onboarding. This can be
  layered on later, for example by binding a share to a verified provider email.
- **Token in the query string:** rejected, because it leaks through logs and `Referer` headers.
