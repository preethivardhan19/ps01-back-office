# ACE Builders Hackathon 2026 — PS-01 "The One-Person Back Office"

A frontend-only demo app for a solo operator to see invoices, follow-ups, bills and cash position in one place. The application is **feature-frozen after Slice 08**. This README documents only what is implemented in the repository.

## 1. Overview and problem statement

**Problem.** Solo operators — the project spec names Indian freelance designers and home tutors — handle invoicing, client follow-ups, recurring bills and cash planning without any back-office support. Money is often late, bills recur on different dates, and it is hard to tell how much cash will be available in the next 30–90 days.

**What the app does.** It presents four screens over a synthetic dataset:
- **Overview** — confirmed cash, total overdue, amount due in the next 14 days, upcoming bills, and an alerts panel.
- **Invoices and Follow-Ups** — invoice list with status filter tabs and a detail view with follow-up history.
- **Cash Forecast** — 30, 60 or 90 day projected daily cash balance, plus a What-If simulator.
- **Bills** — add recurring bills, record bill payments against cash accounts.

**Scope boundaries (from the project spec's cut list).** No bank feeds, GST handling, WhatsApp messaging, payment gateway, or authentication/teams. There is no backend; all data lives in the browser.

## 2. Features implemented across Slices 01–08

The commit history labels only some slices. Commit subjects, oldest first:

| Commit | Subject (verbatim) | What it delivered (per source) |
|---|---|---|
| `b1b6e0b` | chore: project spec and clean scaffold | Project spec and scaffold |
| `5d95105` | feat: complete slice 01 overview dashboard | Overview dashboard |
| `0b52d8e` | feat: implement invoices and follow-up screen | Invoices and Follow-Ups screen (no slice label in the subject) |
| `d849f36` | feat: complete slice 03 cash forecast | 30/60/90 day cash forecast |
| `c3a27f4` | feat: add what-if cash forecast simulator | What-If simulator (no slice label) |
| `83c3810` | feat: add actionable alerts engine | Alerts rules (no slice label) |
| `64a8ce4` | feat: complete slice 06 bills management and demo reset | Bills management and demo reset |
| `081e0c1` | style: complete slice 07 senior fintech visual polish | Visual polish |
| `81666c8` | test: complete slice 08 reliability hardening | Persistence notices, Error Boundary, persistence and component tests |

The spec does not define slice contents. Slices 02, 04 and 05 are not labelled in any commit subject; mapping the unlabelled commits above to slice numbers is not documented in the repository.

## 3. Technology stack and architecture

**Stack**
- React 19 (`react`, `react-dom` ^19.1.0)
- TypeScript ~5.8, strict mode
- Vite 6 (dev server and production bundler)
- Tailwind CSS v4 via `@tailwindcss/vite`
- Vitest 3 for unit tests
- `@playwright/test` is listed in devDependencies, but the repository has no Playwright config, no end-to-end tests and no script that runs it.

**Architecture**
- **No router.** The active screen is held in `useState` in the app root.
- **State.** A React Context (`AppState`) backed by `useReducer`. Reducer actions: `addBill`, `payBill` (carries `billId`, `accountId`, `paymentId`) and `reset`.
- **Pure logic.** Alerts, bills, cash forecast and What-If calculations are pure functions under `src/utils/`, covered by unit tests beside them.
- **Persistence.** A state effect writes bills, bill payments, cash accounts, invoices and payments to browser `localStorage` whenever they change. No backend.
- **Error handling.** An Error Boundary wraps the whole app, including the state provider.

## 4. Main folders and important files

| Path | Purpose |
|---|---|
| `src/App.tsx` | App root: screen switching, navigation, reset control |
| `src/screens/` | Screen components; includes `Invoices.tsx` |
| `src/components/` | Shared UI; includes `ReminderDrawer.tsx` |
| `src/utils/` | Pure business logic (alerts, bills, cash forecast, What-If, formatting), with tests such as `alerts.test.ts`, `bills.test.ts`, `cashForecast.test.ts`, `cashForecastAnchor.test.ts`, `whatIfForecast.test.ts`, `format.test.ts` |
| `src/state/` | App state and persistence; includes `persistence.test.ts` |
| `package.json` | Scripts and dependencies |
| `package-lock.json` | Locked dependency versions |
| `dist/` | Production build output, created by `npm run build` |

Vite and TypeScript configuration files sit at the project root.

## 5. Business logic

**Invoices.** Each invoice has a status from seed data. Status is **not** derived from dates, and no reducer action changes invoice status, payments or follow-ups. Drafts are excluded from cash forecast inflows.

**Alerts rules**
- Overdue invoice — high
- Sent invoice due within 14 days — medium
- Bill due within 7 days — high
- Bill due within 30 days — medium
- Overdue bill — high
- Projected negative cash — one critical alert

**Bill payments.** Paying a bill validates the input through a pure utility and returns a boolean. The payment is recorded with `paidDate` set to a fixed constant `TODAY` (`2025-06-15`), not the real current date. `payBill` does **not** check the account balance, so an account can go negative. Payment IDs are generated from `Date.now()` plus `Math.random()`.

**Recurring bills.** Each occurrence's due date is computed from the bill's original anchor date, so a bill anchored on the 31st does not drift. The day is clamped to the length of the target month. Occurrences before the bill's current due date count as already settled. For an overdue bill, its past occurrences are expected on the forecast start date.

**Cash forecast.** Horizons are 30, 60 and 90 days; any other horizon throws a `RangeError`. Inflows include only **sent** and **overdue** invoices. Inflows dated before the forecast start date are moved to the start date. The result is a projected daily cash balance.

**What-If simulator.** Local component state only; not persisted. It supports a "Delay in days" control and further client-delay and expense controls. The bad-day scenario selects up to 5 distinct clients from eligible invoices, ordered by placement date, and applies delays from each invoice's placement date.

**Validation.** Amounts are checked against the pattern `/^\d+(\.\d{1,2})?$/` (`PLAIN_AMOUNT`, `src/utils/bills.ts:51`) and must then be greater than zero (`src/utils/bills.ts:133`). Accepted amounts are positive decimals with a leading digit and at most two decimal places, such as `5`, `5.5` and `500.50`. Rejected inputs include zero, negative values, exponent notation, `.5`, `500.` and any amount with more than two decimal places. Dates are checked for real calendar validity.

## 6. Persistence, reset and Error Boundary

**Persisted to localStorage:** bills, bill payments, cash accounts, invoices, payments.
**Not persisted:** follow-ups and the reset counter (`resetCount`) — these reset on page load.

**Storage notices.** If storage is unavailable, or the saved data is corrupt, a `PersistenceNotice` appears in one of three variants: unavailable; corrupt with backup; corrupt without backup. "Dismiss storage notice" only hides the notice for the current session; it does not repair the stored data. Dismissal is keyed by message text.

**Reset ("Reset Demo Data", shown in two places).** After a confirmation prompt warning that user-added bills and payments will be removed, reset:
1. clears the main storage key (it does **not** clear the corrupt-backup key),
2. clears the storage notice,
3. restores the seed dataset and writes it back to storage immediately.

**Error Boundary.** On an unrecoverable render error it shows "Something went wrong" with a "Try again" button. "Try again" only clears the boundary and re-renders the children; it cannot repair state, so a persistent error will reappear.

## 7. Install, run, test and build

**Prerequisites:** Node.js and npm. `package.json` does not declare an `engines` field.

```
npm install          # install dependencies (package-lock.json is present)
npm run dev          # start the Vite dev server; open the URL it prints
npm run build        # runs `tsc --noEmit` then `vite build`; output in dist/
npm run preview      # serve the production build from dist/
npm test             # runs `vitest run` (unit tests)
```

Available scripts are exactly `dev`, `build`, `preview` and `test`. There is no lint or end-to-end script.

**Verification status.** The production build was verified to pass on Windows. Automated tests: 167 tests passed in an earlier verification run. Subsequent test runs could not start reliably because of environment-level Node.js process and memory errors. The latest test status is therefore unconfirmed.

## 8. Demo instructions and known limitations

**Demo walkthrough**
1. Run `npm run dev` and open the printed URL.
2. **Overview** — check the stat cards and the alerts panel.
3. **Invoices** — use the status tabs and select an invoice to see its detail and follow-up history.
4. **Cash Forecast** — switch between 30, 60 and 90 days; use the What-If "Delay in days" control to see the effect on projected cash.
5. **Bills** — add a bill, then record a payment against a cash account.
6. **Reset Demo Data** — restores the seed data (confirm the prompt).

All demo data is synthetic. Client contacts are placeholders (`placeholder-NN` or `*.example.com`). Seed dates are relative to `2025-06-15`.

**Known limitations**
- Frontend only; no backend, authentication, bank feeds, GST, WhatsApp or payment gateway.
- Invoice status is static seed data; it does not change with dates or with payments.
- Follow-ups are not persisted and there is no action to add a follow-up.
- `payBill` does not check the account balance; accounts can go negative.
- `payBill` uses the fixed `TODAY` constant (`2025-06-15`) rather than the real date.
- Payment IDs use `Date.now()` plus `Math.random()`, not a guaranteed-unique generator.
- Reset does not clear the corrupt-backup storage key.
- Playwright is declared in devDependencies with no configuration or tests.
- The `language` field in `package.json` says "javascript", although the source is TypeScript.
- A `Placeholder` screen exists in the source but is not used by the app.
- Automated tests: 167 tests passed in an earlier verification run. Subsequent test runs could not start reliably because of environment-level Node.js process and memory errors. The latest test status is therefore unconfirmed.
