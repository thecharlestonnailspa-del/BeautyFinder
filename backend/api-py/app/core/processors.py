from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable, Mapping, Optional, Protocol, Sequence


@dataclass(frozen=True)
class PaymentBreakdown:
    subtotal: float
    discount_percent: float
    discount: float
    taxable_subtotal: float
    tax: float
    tip: float
    total: float


@dataclass(frozen=True)
class CustomerPageViewSignal:
    customer_id: str
    customer_name: str
    customer_email: str
    business_id: str
    business_name: str
    business_category: str
    selected_service_name: Optional[str]
    dwell_seconds: int
    note: Optional[str]
    color_signals: tuple[str, ...]
    created_at: datetime


@dataclass(frozen=True)
class CustomerFavoriteSignal:
    customer_id: str
    customer_name: str
    customer_email: str
    business_id: str
    business_name: str
    business_category: str
    created_at: datetime


@dataclass(frozen=True)
class CustomerBookingSignal:
    customer_id: str
    customer_name: str
    customer_email: str
    business_id: str
    business_name: str
    business_category: str
    service_name: str
    note: Optional[str]
    created_at: datetime


@dataclass(frozen=True)
class RankedPreference:
    label: str
    score: float


@dataclass(frozen=True)
class CustomerPreferenceProfile:
    customer_id: str
    customer_name: str
    customer_email: str
    favorite_colors: tuple[RankedPreference, ...]
    top_services: tuple[RankedPreference, ...]
    top_categories: tuple[RankedPreference, ...]
    preferred_experience: str
    average_business_page_dwell_seconds: int
    total_business_page_views: int
    total_favorite_businesses: int
    total_bookings: int
    engagement_score: float
    last_seen_at: Optional[datetime]


@dataclass(frozen=True)
class CustomerPreferenceReport:
    generated_at: datetime
    total_customers: int
    total_tracked_page_views: int
    color_trends: tuple[RankedPreference, ...]
    service_trends: tuple[RankedPreference, ...]
    experience_trends: tuple[RankedPreference, ...]
    customers: tuple[CustomerPreferenceProfile, ...]


class HomepageSortable(Protocol):
    featured_on_homepage: bool
    homepage_rank: int
    rating: float
    review_count: int
    name: str


class TextProcessor:
    def sanitize(self, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    def normalize_email(self, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Email is required")
        return normalized


class DateTimeProcessor:
    def parse_iso(self, value: str) -> datetime:
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        return datetime.fromisoformat(normalized)

    def to_utc_iso(self, value: datetime) -> str:
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc).isoformat()


class MoneyProcessor:
    def round_currency(self, amount: float) -> float:
        return round(amount + 1e-9, 2)

    def compute_payment_breakdown(
        self,
        *,
        subtotal: float,
        discount_percent: float,
        tip: float,
        tax_rate: float,
    ) -> PaymentBreakdown:
        normalized_subtotal = self.round_currency(subtotal)
        normalized_discount_percent = max(0.0, discount_percent)
        normalized_tip = self.round_currency(max(0.0, tip))
        discount = self.round_currency(
            (normalized_subtotal * normalized_discount_percent) / 100,
        )
        taxable_subtotal = self.round_currency(max(0.0, normalized_subtotal - discount))
        tax = self.round_currency(taxable_subtotal * max(0.0, tax_rate))
        total = self.round_currency(taxable_subtotal + tax + normalized_tip)
        return PaymentBreakdown(
            subtotal=normalized_subtotal,
            discount_percent=normalized_discount_percent,
            discount=discount,
            taxable_subtotal=taxable_subtotal,
            tax=tax,
            tip=normalized_tip,
            total=total,
        )


class NotificationProcessor:
    _preference_keys = {
        "booking_created": "bookingCreated",
        "booking_confirmed": "bookingConfirmed",
        "message_received": "messageReceived",
        "payment_receipt": "paymentReceipt",
        "review_received": "reviewReceived",
        "system": "system",
    }

    def defaults(self) -> dict[str, bool]:
        return {
            "bookingCreated": True,
            "bookingConfirmed": True,
            "messageReceived": True,
            "paymentReceipt": True,
            "reviewReceived": True,
            "system": True,
        }

    def preference_key(self, notification_type: str) -> str:
        try:
            return self._preference_keys[notification_type]
        except KeyError as exc:
            raise ValueError(f"Unsupported notification type: {notification_type}") from exc

    def merge_preferences(
        self,
        current: Optional[Mapping[str, bool]],
        updates: Mapping[str, Optional[bool]],
    ) -> dict[str, bool]:
        merged = self.defaults()
        if current:
            merged.update({key: bool(value) for key, value in current.items() if key in merged})

        for key, value in updates.items():
            if key in merged and value is not None:
                merged[key] = bool(value)

        return merged

    def should_deliver(
        self,
        notification_type: str,
        preferences: Optional[Mapping[str, bool]],
    ) -> bool:
        resolved_preferences = self.merge_preferences(preferences, {})
        return resolved_preferences[self.preference_key(notification_type)]


class CollectionProcessor:
    def dedupe_preserve_order(self, values: Iterable[str]) -> list[str]:
        seen: set[str] = set()
        ordered: list[str] = []
        for value in values:
            if value not in seen:
                seen.add(value)
                ordered.append(value)
        return ordered

    def sort_homepage_items(self, items: Iterable[HomepageSortable]) -> list[HomepageSortable]:
        return sorted(
            items,
            key=lambda item: (
                0 if item.featured_on_homepage else 1,
                item.homepage_rank,
                -item.rating,
                -item.review_count,
                item.name.lower(),
            ),
        )


class CustomerPreferenceProcessor:
    _color_keywords = {
        "pink": {"pink", "rose", "blush", "fuchsia", "hot pink"},
        "red": {"red", "ruby", "crimson", "cherry", "wine"},
        "orange": {"orange", "tangerine", "amber"},
        "yellow": {"yellow", "gold", "sunshine", "mustard"},
        "green": {"green", "sage", "olive", "mint", "emerald"},
        "blue": {"blue", "navy", "cobalt", "sky"},
        "purple": {"purple", "lavender", "lilac", "violet", "plum"},
        "brown": {"brown", "chocolate", "mocha", "caramel"},
        "black": {"black", "onyx", "charcoal"},
        "white": {"white", "ivory", "cream"},
        "neutral": {"neutral", "nude", "beige", "taupe", "minimal", "minimalist"},
        "metallic": {"metallic", "chrome", "silver", "glitter"},
        "pastel": {"pastel", "soft", "peach", "coral"},
    }
    _experience_patterns = {
        "Quick maintenance": (
            "quick",
            "express",
            "refresh",
            "trim",
            "maintenance",
            "simple",
        ),
        "Statement glam": (
            "acrylic",
            "full set",
            "art",
            "volume",
            "glam",
            "bold",
            "transformation",
        ),
        "Polished natural": (
            "neutral",
            "nude",
            "clean",
            "classic",
            "minimal",
            "natural",
            "soft",
        ),
        "Relaxing self-care": (
            "pedicure",
            "spa",
            "gloss",
            "shine",
            "pamper",
            "relax",
            "self-care",
        ),
        "Precision haircare": (
            "silk press",
            "blowout",
            "haircut",
            "precision",
            "smooth",
            "smoothing",
            "press",
        ),
    }

    def _normalize_color_token(self, value: str) -> Optional[str]:
        normalized = value.strip().lower()
        if not normalized:
            return None

        for label, variants in self._color_keywords.items():
            if normalized == label or normalized in variants:
                return label
        return None

    def extract_color_preferences(
        self,
        *texts: Optional[str],
        explicit_signals: Sequence[str] = (),
    ) -> list[str]:
        extracted: list[str] = []
        for signal in explicit_signals:
            normalized_signal = self._normalize_color_token(signal)
            if normalized_signal:
                extracted.append(normalized_signal)

        for text in texts:
            if not text:
                continue
            lowered = text.lower()
            for label, variants in self._color_keywords.items():
                if label in lowered or any(variant in lowered for variant in variants):
                    extracted.append(label)

        return extracted

    def normalize_color_signals(self, signals: Sequence[str]) -> list[str]:
        normalized = [
            normalized_signal
            for normalized_signal in (
                self._normalize_color_token(signal) for signal in signals
            )
            if normalized_signal
        ]
        return list(dict.fromkeys(normalized))

    def _score_rankings(self, counter: Counter[str], limit: int = 3) -> tuple[RankedPreference, ...]:
        return tuple(
            RankedPreference(label=label, score=round(score, 2))
            for label, score in counter.most_common(limit)
        )

    def _infer_preferred_experience(
        self,
        *,
        service_weights: Counter[str],
        note_texts: Sequence[str],
        category_weights: Counter[str],
        color_weights: Counter[str],
    ) -> str:
        experience_scores: dict[str, float] = defaultdict(float)
        combined_service_text = " ".join(service_weights.keys()).lower()
        combined_notes = " ".join(note_texts).lower()
        combined_categories = " ".join(category_weights.keys()).lower()
        combined_color_text = " ".join(color_weights.keys()).lower()

        for label, keywords in self._experience_patterns.items():
            for keyword in keywords:
                if keyword in combined_service_text:
                    experience_scores[label] += 2.0
                if keyword in combined_notes:
                    experience_scores[label] += 1.5
                if keyword in combined_categories:
                    experience_scores[label] += 0.75
                if keyword in combined_color_text:
                    experience_scores[label] += 0.5

        if category_weights.get("nail", 0) >= category_weights.get("hair", 0):
            experience_scores["Polished natural"] += color_weights.get("neutral", 0) * 0.5
            experience_scores["Statement glam"] += color_weights.get("metallic", 0) * 0.5
        else:
            experience_scores["Precision haircare"] += 1.25

        if not experience_scores:
            return "General beauty discovery"

        return max(experience_scores.items(), key=lambda item: item[1])[0]

    def build_preference_report(
        self,
        *,
        page_views: Sequence[CustomerPageViewSignal],
        favorites: Sequence[CustomerFavoriteSignal],
        bookings: Sequence[CustomerBookingSignal],
    ) -> CustomerPreferenceReport:
        customer_scores: dict[str, dict[str, object]] = {}
        overall_colors: Counter[str] = Counter()
        overall_services: Counter[str] = Counter()
        overall_experiences: Counter[str] = Counter()

        def ensure_customer(customer_id: str, customer_name: str, customer_email: str) -> dict[str, object]:
            return customer_scores.setdefault(
                customer_id,
                {
                    "name": customer_name,
                    "email": customer_email,
                    "colors": Counter(),
                    "services": Counter(),
                    "categories": Counter(),
                    "notes": [],
                    "page_view_count": 0,
                    "page_view_dwell_total": 0,
                    "favorite_count": 0,
                    "booking_count": 0,
                    "last_seen_at": None,
                },
            )

        for page_view in page_views:
            customer = ensure_customer(
                page_view.customer_id,
                page_view.customer_name,
                page_view.customer_email,
            )
            view_weight = max(0.5, min(3.0, page_view.dwell_seconds / 30))
            colors = self.extract_color_preferences(
                page_view.note,
                explicit_signals=page_view.color_signals,
            )
            for color in colors:
                customer["colors"][color] += view_weight
                overall_colors[color] += view_weight

            if page_view.selected_service_name:
                normalized_service_name = page_view.selected_service_name.strip()
                if normalized_service_name:
                    customer["services"][normalized_service_name] += view_weight
                    overall_services[normalized_service_name] += view_weight

            customer["categories"][page_view.business_category] += view_weight
            customer["page_view_count"] += 1
            customer["page_view_dwell_total"] += page_view.dwell_seconds
            if page_view.note:
                customer["notes"].append(page_view.note)
            last_seen_at = customer["last_seen_at"]
            if last_seen_at is None or page_view.created_at > last_seen_at:
                customer["last_seen_at"] = page_view.created_at

        for favorite in favorites:
            customer = ensure_customer(
                favorite.customer_id,
                favorite.customer_name,
                favorite.customer_email,
            )
            customer["favorite_count"] += 1
            customer["categories"][favorite.business_category] += 1.75
            last_seen_at = customer["last_seen_at"]
            if last_seen_at is None or favorite.created_at > last_seen_at:
                customer["last_seen_at"] = favorite.created_at

        for booking in bookings:
            customer = ensure_customer(
                booking.customer_id,
                booking.customer_name,
                booking.customer_email,
            )
            customer["booking_count"] += 1
            customer["services"][booking.service_name] += 3.0
            overall_services[booking.service_name] += 3.0
            customer["categories"][booking.business_category] += 2.5
            if booking.note:
                customer["notes"].append(booking.note)
                for color in self.extract_color_preferences(booking.note):
                    customer["colors"][color] += 2.25
                    overall_colors[color] += 2.25
            last_seen_at = customer["last_seen_at"]
            if last_seen_at is None or booking.created_at > last_seen_at:
                customer["last_seen_at"] = booking.created_at

        customer_profiles: list[CustomerPreferenceProfile] = []
        for customer_id, payload in customer_scores.items():
            color_weights: Counter[str] = payload["colors"]
            service_weights: Counter[str] = payload["services"]
            category_weights: Counter[str] = payload["categories"]
            note_texts: list[str] = payload["notes"]
            page_view_count = int(payload["page_view_count"])
            page_view_dwell_total = int(payload["page_view_dwell_total"])
            favorite_count = int(payload["favorite_count"])
            booking_count = int(payload["booking_count"])
            average_dwell = round(page_view_dwell_total / page_view_count) if page_view_count else 0
            engagement_score = round(
                min(
                    100.0,
                    page_view_count * 6
                    + favorite_count * 12
                    + booking_count * 18
                    + min(page_view_dwell_total / 12, 24),
                ),
                1,
            )
            preferred_experience = self._infer_preferred_experience(
                service_weights=service_weights,
                note_texts=note_texts,
                category_weights=category_weights,
                color_weights=color_weights,
            )
            overall_experiences[preferred_experience] += 1

            customer_profiles.append(
                CustomerPreferenceProfile(
                    customer_id=customer_id,
                    customer_name=str(payload["name"]),
                    customer_email=str(payload["email"]),
                    favorite_colors=self._score_rankings(color_weights),
                    top_services=self._score_rankings(service_weights),
                    top_categories=self._score_rankings(category_weights),
                    preferred_experience=preferred_experience,
                    average_business_page_dwell_seconds=average_dwell,
                    total_business_page_views=page_view_count,
                    total_favorite_businesses=favorite_count,
                    total_bookings=booking_count,
                    engagement_score=engagement_score,
                    last_seen_at=payload["last_seen_at"],
                ),
            )

        customer_profiles.sort(
            key=lambda profile: (
                -profile.engagement_score,
                -(profile.last_seen_at.timestamp() if profile.last_seen_at else 0),
                profile.customer_name.lower(),
            ),
        )

        return CustomerPreferenceReport(
            generated_at=datetime.now(tz=timezone.utc),
            total_customers=len(customer_profiles),
            total_tracked_page_views=len(page_views),
            color_trends=self._score_rankings(overall_colors, limit=6),
            service_trends=self._score_rankings(overall_services, limit=6),
            experience_trends=self._score_rankings(overall_experiences, limit=6),
            customers=tuple(customer_profiles[:20]),
        )


class ProcessingBrain:
    def __init__(self) -> None:
        self.text = TextProcessor()
        self.dates = DateTimeProcessor()
        self.money = MoneyProcessor()
        self.notifications = NotificationProcessor()
        self.collections = CollectionProcessor()
        self.customer_preferences = CustomerPreferenceProcessor()
