# Iteration 3 Non-Chat Acceptance Checklist

Scope: pickup lifecycle and collected-state locking (chat implementation excluded).

## Demo Flow Checklist

1. Donor creates listing
- Action: Submit a new listing from donor workspace (`/donor/post`).
- Expected result: Listing is created with status `available`.
- Evidence: UI screenshot of new card + network response for `POST /listings`.

2. Organisation claims listing
- Action: Claim the listing from org board (`/org/listings`) with valid quantity.
- Expected result: Claim succeeds and listing moves into claimed flow.
- Evidence: UI screenshot of claim success + network response for `POST /listings/{id}/claim` including `claim_id`.

3. Listing status changes to Claimed
- Action: Refresh donor and org listing views.
- Expected result: Status shown as `claimed` in both API and UI status views.
- Evidence: Screenshot on donor card + org card + `GET /listings?...status=claimed` response.

4. Claiming organisation sees Mark as Collected
- Action: Open claiming org card/details for the claimed listing.
- Expected result: `Mark as Collected` action is visible only for the claiming organisation.
- Evidence: Screenshot for claiming org; screenshot showing absence/disabled action for non-claiming org.

5. Claiming organisation marks as Collected
- Action: Click `Mark as Collected`.
- Expected result: API accepts request only for claiming org.
- Evidence: Network response for `PATCH /listings/{id}/pickup` (status `collected`).

6. Listing status changes to Collected
- Action: Reload listing data.
- Expected result: Public-facing status is `collected` (not `picked_up`).
- Evidence: API response from `GET /listings/{id}` and `GET /listings?status=collected`.

7. Donor side shows Collected
- Action: Open donor “My listings”.
- Expected result: Card/status tab shows collected final state clearly.
- Evidence: Donor UI screenshot with collected pill and collected summary tab.

8. Organisation side shows Collected
- Action: Open organisation board and status filters.
- Expected result: Card/status tab shows collected final state clearly.
- Evidence: Org UI screenshot with collected pill and collected summary tab.

9. Donor and organisation can no longer edit/cancel/claim
- Action: Attempt edit/delete from donor side, claim/unclaim from org side, and re-claim attempts.
- Expected result: Collected listing is locked; mutating actions are blocked by UI and backend.
- Evidence: Blocked UI screenshot + failed API response codes/messages:
  - update/delete blocked
  - claim blocked when status is collected
  - unclaim blocked unless listing is still claimed

10. History/status view keeps final collected state
- Action: Navigate to list/history/status cards and filters after collection.
- Expected result: Final state remains collected and appears in collected views.
- Evidence: Screenshot of collected status in history/status card and collected filter counts.

## Suggested API Log Captures

- `POST /listings`
- `POST /listings/{id}/claim`
- `PATCH /listings/{id}/pickup`
- `GET /listings/{id}`
- `GET /listings?status=claimed`
- `GET /listings?status=collected`

## Pass/Fail Rule

All 10 steps pass with matching evidence, and no public-facing surface shows `picked_up` as final status wording.
