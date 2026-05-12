# Iteration 3 Chat Integration Contract (From Non-Chat Scope)

This note defines only the integration contract needed by chat implementation.
It does **not** introduce new chat architecture.

## Status Contract

- Final listing lifecycle is:
  - `available -> claimed -> collected`
- Public-facing status should use `collected`.
- Legacy `picked_up` may exist internally for compatibility only.

## Thread Close Contract

- When listing status becomes `collected`, the related claim thread should become closed/read-only.
- Chat send actions should reject writes to closed threads.

## Minimum Field Contract for Donor/Org Views

Pages should expose or be able to pass:

- `claimId`
- `listingId`
- `donorId` (or donor org code used by current model)
- `organisationId` (claiming org code/id)
- `threadId` (if available and distinct from claim id)
- `lastMessageAt` (if available)
- `unreadCount` (if available)

## Privacy / Contact Constraint

- Pickup coordination should not require personal phone number or email exchange.
- In-app anonymous coordination flow should remain compatible with postcode/org-code identity model.
