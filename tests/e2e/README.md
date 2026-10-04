# End-to-End Tests (`tests/e2e`)

Complete user-journey dialogue tests testing end-to-end booking, cancellation, and support flows.

## Scenarios
1. **Egyptian Arabic Booking Flow:**
   - Multi-turn conversation booking an afternoon appointment with a cardiologist.
2. **Rescheduling Flow:**
   - Looking up an appointment, proposing alternate slots, and validating state change.
3. **Emergency Escalation Flow:**
   - Safety keyword trigger resulting in immediate `transfer_to_human`.
