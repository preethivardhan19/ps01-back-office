# PS-01 — The One-Person Back Office

A simple financial back-office web app for a solo Indian freelance designer or home tutor to track invoices, pending payments, upcoming bills and cash flow; identify overdue payments; and forecast cash position over 30–90 days.

## 1. Problem Statement

Solo freelancers struggle to track invoices, pending payments, upcoming bills and cash flow. This leads to missed follow-ups, surprise cash shortfalls, and no clear view of their true financial position.

## 2. Target Users

- Solo Indian freelance designers.
- Solo Indian home tutors.

## 3. Requirements / Goals

- Show the user's current financial position at a glance.
- Identify overdue payments and support follow-up.
- Forecast cash position 30–90 days ahead, including what-if scenarios.

## 4. Screens

- **S1 Overview & Alerts:** total income, pending payments, overdue invoices, available cash, important financial alerts.
- **S2 Invoices & Follow-Ups:** invoices, clients, amounts (INR), due dates, payment status, follow-up reminders.
- **S3 30–90 Day Cash Forecast + What-If Simulator:** projected cash flow from synthetic data; simulate delayed payments and additional expenses.
- **S4 Upcoming Bills:** upcoming expenses, due dates, amounts, payment status.

## 5. Features by Screen

**S1 Overview & Alerts**
- Summary cards: total income, pending payments, overdue invoice count and value, available cash.
- Alert list for overdue invoices and bills due soon.

**S2 Invoices & Follow-Ups**
- Invoice list with client, description, amount (INR), issue and due dates, and status.
- Filter by status (draft, sent, paid, overdue).
- Client view showing outstanding balance per client.
- Follow-up log per invoice (date, channel, note) and reminder indicators.

**S3 Cash Forecast + What-If Simulator**
- Day-by-day projected cash balance over a selectable 30, 60 or 90 day horizon.
- Projection built from open invoices (expected payment dates), upcoming bills and current balance.
- Simulator controls: delay payments by N days for selected invoices; add one-off or recurring expenses; view the revised forecast and minimum balance point.

**S4 Upcoming Bills**
- Bill list with name, category, amount (INR), due date, recurrence and status (upcoming, paid, overdue).
- Totals for the next 30 days.

## 6. Data Model (synthetic only)

- **Client:** id, name, type (design | tutoring), city, contact (placeholder).
- **Invoice:** id, clientId, description, amountINR, issueDate, dueDate, status (draft | sent | paid | overdue), paidDate (optional).
- **Payment:** id, invoiceId, amountINR, receivedDate.
- **Bill / Expense:** id, name, category, amountINR, dueDate, status (upcoming | paid | overdue), recurrence.
- **CashAccount / Balance:** id, label, balanceINR, asOfDate.
- **FollowUp:** id, invoiceId, date, note, channel.

All currency is displayed as ₹ INR with Indian digit grouping (e.g. ₹1,25,000).

## 7. Synthetic Data

- Realistic Indian names, Indian cities (e.g. Pune, Bengaluru, Jaipur, Kochi, Chandigarh).
- Plausible rupee amounts for design work and tutoring fees.
- No real banking, tax, or personal data.
- Seed data stored locally in the app.

## 8. Tech Stack

- React + Vite + TypeScript + Tailwind CSS.
- No backend; local seed data only.

## 9. Scope Limitations (Cut List)

Out of scope:
- Live bank feeds.
- GST filing.
- Live WhatsApp API integration (follow-ups are logged manually).
- Payment gateway integration.
- Enterprise features: authentication, multi-user, teams, roles.

## 10. Delivery Plan

- **Slice 0:** Spec and scaffold (this step).
- **Slice 1 onward:** To be defined after user review of this spec and the scaffold.
