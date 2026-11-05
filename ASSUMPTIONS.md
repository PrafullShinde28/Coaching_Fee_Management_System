# Assumptions and decisions

1. **Demo date:** business dates use `DEMO_TODAY` (default `2026-11-02`) through an injectable clock. Production defaults to the system clock only when `DEMO_TODAY` is unset.
2. **Currency:** all persisted monetary amounts are integer paise. Seeded rupee amounts are converted to paise at the seed boundary.
3. **Instalment sample interpretation:** the three supplied rows are treated as one current instalment each. Their stated paid amounts are preserved exactly.
4. **GST:** fee plan totals are GST-inclusive at 18% for receipt/refund calculations, as specified in the engineering brief. This is a configurable plan field, not tax advice.
5. **Refund policy (ASSUMPTION):** `max(0, paid - usedShare - processingFee)`, where `usedShare = totalFee × clampedDaysUsed / termDays`; processing fee is the lesser of 5% of total fee and ₹5,000. Refund deadline is `leftOn + 10 days`. The UI and TDD must label this as an assumed policy pending client/legal approval.
6. **OTP:** development/demo mode uses the fixed `DEMO_OTP`; production must use a real OTP adapter. OTPs are short-lived, one-time and rate-limited.
7. **Parent identity:** a parent account is linked to students by `parentUserId`; authorization is based on this relationship, never on a client-supplied student ID alone.
8. **Parental consent:** first-login consent records the authenticated user as `givenBy`, timestamp, and policy version. The demo consent is not treated as proof of real-world verifiable consent.
9. **Mock integrations:** payment, OTP and messaging providers are adapters. Phase 1 implements the OTP adapter and persistence models; payment and message adapters arrive in later phases.
10. **Sample people and phones:** names required by the brief are retained; all phone numbers and additional seed identities are synthetic reserved demo values.
11. **Scale:** indexes are added for the expected query paths, but production capacity, backup, retention and audit requirements need load/security review before rollout.
