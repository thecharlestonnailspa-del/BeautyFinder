import unittest

from app.domains.auth.repository import AuthRepository
from app.domains.bookings.repository import BookingsRepository
from app.domains.payments.repository import PaymentsRepository


class _EmptyResult(list):
    def mappings(self):
        return self

    def first(self):
        return None


class _SpyDB:
    def __init__(self) -> None:
        self.calls: list[dict[str, object]] = []

    def execute(self, statement, params=None):
        self.calls.append(
            {
                "sql": str(statement),
                "params": {} if params is None else dict(params),
            },
        )
        return _EmptyResult()


class RepositoryQuerySafetyTests(unittest.TestCase):
    def test_auth_repository_binds_email_parameter(self) -> None:
        db = _SpyDB()
        repository = AuthRepository(db)  # type: ignore[arg-type]
        payload = "ava@beautyfinder.app' OR 1=1 --"

        repository.get_user_by_email(payload)

        self.assertEqual(len(db.calls), 1)
        self.assertIn('WHERE "email" = :email', db.calls[0]["sql"])
        self.assertNotIn(payload, db.calls[0]["sql"])
        self.assertEqual(db.calls[0]["params"], {"email": payload})

    def test_bookings_repository_binds_scope_parameter(self) -> None:
        db = _SpyDB()
        repository = BookingsRepository(db)  # type: ignore[arg-type]
        payload = "user-customer-1' OR 1=1 --"

        repository.list_bookings(payload, "customer")

        self.assertEqual(len(db.calls), 1)
        self.assertIn('appointment."customerId" = :user_id', db.calls[0]["sql"])
        self.assertNotIn(payload, db.calls[0]["sql"])
        self.assertEqual(db.calls[0]["params"], {"user_id": payload})

    def test_payments_repository_binds_scope_parameter(self) -> None:
        db = _SpyDB()
        repository = PaymentsRepository(db)  # type: ignore[arg-type]
        payload = "user-owner-1' OR 1=1 --"

        repository.list_payments(payload, "owner")

        self.assertEqual(len(db.calls), 1)
        self.assertIn('appointment."ownerId" = :user_id', db.calls[0]["sql"])
        self.assertNotIn(payload, db.calls[0]["sql"])
        self.assertEqual(db.calls[0]["params"], {"user_id": payload})


if __name__ == "__main__":
    unittest.main()
