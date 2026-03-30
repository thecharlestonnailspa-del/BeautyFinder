import unittest

from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_legacy_password,
    hash_password,
    needs_password_rehash,
    supports_scrypt,
    verify_password,
)


class SecurityTests(unittest.TestCase):
    def test_can_issue_and_decode_access_token(self) -> None:
        bundle = create_access_token(
            user_id="user-1",
            role="customer",
            secret="top-secret",
            issuer="beauty-finder-api",
            ttl_seconds=3600,
            now_in_seconds=1_700_000_000,
        )

        claims = decode_access_token(
            bundle["token"],
            "top-secret",
            "beauty-finder-api",
            now_in_seconds=1_700_000_100,
        )

        self.assertEqual(claims["sub"], "user-1")
        self.assertEqual(claims["role"], "customer")
        self.assertEqual(claims["iss"], "beauty-finder-api")

    def test_access_token_preserves_admin_access_claims(self) -> None:
        bundle = create_access_token(
            user_id="user-owner-1",
            role="owner",
            secret="top-secret",
            issuer="beauty-finder-api",
            ttl_seconds=900,
            now_in_seconds=1_700_000_000,
            extra_claims={
                "adminAccess": {
                    "adminUserId": "user-admin-1",
                    "adminName": "Mason Lee",
                    "startedAt": "2026-03-30T16:00:00.000Z",
                    "targetUserId": "user-owner-1",
                },
            },
        )

        claims = decode_access_token(
            bundle["token"],
            "top-secret",
            "beauty-finder-api",
            now_in_seconds=1_700_000_100,
        )

        self.assertEqual(claims["adminAccess"]["adminUserId"], "user-admin-1")
        self.assertEqual(claims["adminAccess"]["targetUserId"], "user-owner-1")

    def test_legacy_password_hash_requires_rehash(self) -> None:
        legacy_hash = hash_legacy_password("mock-password")

        self.assertTrue(verify_password("mock-password", legacy_hash))
        self.assertTrue(needs_password_rehash(legacy_hash))

    def test_scrypt_password_hashing_when_supported(self) -> None:
        if not supports_scrypt():
            self.skipTest("hashlib.scrypt is not available in this Python build")

        new_hash = hash_password("mock-password")

        self.assertTrue(verify_password("mock-password", new_hash))
        self.assertFalse(needs_password_rehash(new_hash))


if __name__ == "__main__":
    unittest.main()
