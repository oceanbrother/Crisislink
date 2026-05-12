import importlib.util
import os
from datetime import date, timedelta
from pathlib import Path
import unittest

from fastapi import HTTPException
from starlette.requests import Request


def _load_listing_main():
    module_path = (
        Path(__file__).resolve().parents[1] / "main.py"
    )
    spec = importlib.util.spec_from_file_location("listing_service_main", module_path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test_db")
os.environ.setdefault("ENABLE_AI_RECOGNIZER", "false")
listing_main = _load_listing_main()


class Iteration3NonChatLifecycleTests(unittest.IsolatedAsyncioTestCase):
    def _request(self):
        return Request({"type": "http", "method": "PATCH", "path": "/", "headers": []})

    async def test_org_can_mark_own_claim_as_collected(self):
        calls = {"executed": False, "closed_thread": False}

        async def fake_fetch_one(query, values):
            return {
                "status": "claimed",
                "claim_id": "claim-1",
                "claimed_by_org_code": "ORG-1",
            }

        async def fake_execute(query, values):
            calls["executed"] = True
            self.assertEqual(values["listing_id"], "listing-1")

        async def fake_close_thread(claim_id, _closed_at):
            calls["closed_thread"] = True
            self.assertEqual(claim_id, "claim-1")

        listing_main.database.fetch_one = fake_fetch_one
        listing_main.database.execute = fake_execute
        listing_main.close_claim_thread = fake_close_thread

        payload = listing_main.PickupRequest(orgId="ORG-1")
        result = await listing_main.pickup_listing(self._request(), "listing-1", payload)

        self.assertTrue(result["success"])
        self.assertEqual(result["status"], "collected")
        self.assertIn("collected_at", result)
        self.assertTrue(calls["executed"])
        self.assertTrue(calls["closed_thread"])

    async def test_donor_cannot_mark_collected(self):
        async def fake_fetch_one(query, values):
            return {
                "status": "claimed",
                "claim_id": "claim-1",
                "claimed_by_org_code": "ORG-1",
            }

        listing_main.database.fetch_one = fake_fetch_one
        payload = listing_main.PickupRequest(orgId="DONOR-3163")

        with self.assertRaises(HTTPException) as ctx:
            await listing_main.pickup_listing(self._request(), "listing-1", payload)

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_non_claiming_org_cannot_mark_collected(self):
        async def fake_fetch_one(query, values):
            return {
                "status": "claimed",
                "claim_id": "claim-2",
                "claimed_by_org_code": "ORG-1",
            }

        listing_main.database.fetch_one = fake_fetch_one
        payload = listing_main.PickupRequest(orgId="ORG-2")

        with self.assertRaises(HTTPException) as ctx:
            await listing_main.pickup_listing(self._request(), "listing-2", payload)

        self.assertEqual(ctx.exception.status_code, 403)

    async def test_collected_listing_cannot_be_claimed_again(self):
        async def fake_fetch_listing_row(_listing_id):
            return {
                "status": "collected",
                "quantity": 5.0,
                "source_listing_id": None,
            }

        listing_main.fetch_listing_row = fake_fetch_listing_row
        payload = listing_main.ClaimRequest(orgId="ORG-1", orgName="Org 1", quantity=1)

        with self.assertRaises(HTTPException) as ctx:
            await listing_main.claim_listing(self._request(), "listing-3", payload)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("already collected", str(ctx.exception.detail))

    async def test_collected_listing_is_locked_for_owner_update(self):
        async def fake_ensure_owner(_listing_id, _org_code):
            return {"status": "collected", "has_claims": False}

        listing_main.ensure_owner = fake_ensure_owner
        payload = listing_main.ListingUpdate(
            foodType="Bread",
            category="Baked goods",
            quantity=2,
            unit="items",
            postcode="3163",
            orgCode="DONOR-3163",
            dietary_tags=[],
            description="Updated note",
            photoUrl=None,
            sizeCue=None,
            expiryDate=date.today() + timedelta(days=1),
            allergenTags=["gluten"],
            storageCondition="room_temp",
            pickupWindow="today_morning",
        )

        with self.assertRaises(HTTPException) as ctx:
            await listing_main.update_listing(self._request(), "listing-4", payload)

        self.assertEqual(ctx.exception.status_code, 400)
        self.assertIn("claimed or collected", str(ctx.exception.detail))


if __name__ == "__main__":
    unittest.main()
