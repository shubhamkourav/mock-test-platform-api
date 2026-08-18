# MongoDB Data Model

## Collections

- `users`
- `exams`
- `sections`
- `questions`
- `tests`
- `testquestions`
- `attempts`
- `attemptanswers`

## Why this is not a direct SQL conversion

Questions are reusable documents. Test membership/order is stored in `testquestions`. Attempts and answers remain separate because answer rows can grow to millions/billions at platform scale.

## Important invariants

- A test cannot contain the same question twice.
- A test question has a stable order.
- Correct answers are never returned by public question/test endpoints.
- Attempt answers store a question snapshot so historical results survive question edits.
- Retiring a question uses `isActive`; it does not delete historical answer references.
