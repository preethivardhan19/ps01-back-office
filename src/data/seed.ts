import type {
  Bill,
  CashAccount,
  Client,
  FollowUp,
  Invoice,
  Payment,
} from "../types";
import { addDays } from "../utils/format";

// Fixed "today" so the demo is stable. Every other date below is relative to it.
export const TODAY = "2025-06-15";

// Synthetic data only: no real people, banks, or tax identifiers.

export const clients: Client[] = [
  { id: "C-01", name: "Kaveri Textiles Pvt Ltd", type: "design", city: "Jaipur", contact: "accounts@kaveri.example.com" },
  { id: "C-02", name: "Sunita Kapoor", type: "tutoring", city: "Chandigarh", contact: "placeholder-02" },
  { id: "C-03", name: "Brightpath Edtech Pvt Ltd", type: "design", city: "Bengaluru", contact: "hello@brightpath.example.com" },
  { id: "C-04", name: "Meera Iyer", type: "design", city: "Bengaluru", contact: "placeholder-04" },
  { id: "C-05", name: "Vikram Choudhury", type: "tutoring", city: "Pune", contact: "placeholder-05" },
  { id: "C-06", name: "Greenleaf Organics LLP", type: "design", city: "Kochi", contact: "ops@greenleaf.example.com" },
  { id: "C-07", name: "Priya Sharma", type: "tutoring", city: "Chandigarh", contact: "placeholder-07" },
];

export const invoices: Invoice[] = [
  // Paid
  { id: "INV-001", clientId: "C-01", description: "Packaging label redesign - Milestone 3, final artwork approved", amountINR: 85000, issueDate: addDays(TODAY, -60), dueDate: addDays(TODAY, -45), status: "paid", paidDate: addDays(TODAY, -40) },
  { id: "INV-002", clientId: "C-02", description: "Class 10 Maths tutoring, May", amountINR: 24000, issueDate: addDays(TODAY, -50), dueDate: addDays(TODAY, -35), status: "paid", paidDate: addDays(TODAY, -36) },
  { id: "INV-013", clientId: "C-07", description: "Weekend art tutoring, April", amountINR: 16000, issueDate: addDays(TODAY, -45), dueDate: addDays(TODAY, -30), status: "paid", paidDate: addDays(TODAY, -32) },
  // Overdue (status 'overdue' always has dueDate before TODAY)
  { id: "INV-003", clientId: "C-03", description: "Learning app UI kit - Milestone 2, wireframes approved", amountINR: 185000, issueDate: addDays(TODAY, -75), dueDate: addDays(TODAY, -60), status: "overdue" },
  { id: "INV-004", clientId: "C-04", description: "Brand identity - logo and guidelines, Milestone 3", amountINR: 120000, issueDate: addDays(TODAY, -40), dueDate: addDays(TODAY, -25), status: "overdue" },
  { id: "INV-005", clientId: "C-05", description: "JEE Physics tutoring, May batch", amountINR: 18000, issueDate: addDays(TODAY, -30), dueDate: addDays(TODAY, -10), status: "overdue" },
  { id: "INV-006", clientId: "C-06", description: "Website landing page design - Milestone 1, sitemap approved", amountINR: 96000, issueDate: addDays(TODAY, -20), dueDate: addDays(TODAY, -5), status: "overdue" },
  // Sent, due within the next 14 days
  { id: "INV-007", clientId: "C-07", description: "Weekend art tutoring, June", amountINR: 16000, issueDate: addDays(TODAY, -10), dueDate: addDays(TODAY, 3), status: "sent" },
  { id: "INV-008", clientId: "C-01", description: "Catalogue cover design - Milestone 2, concepts approved", amountINR: 62000, issueDate: addDays(TODAY, -5), dueDate: addDays(TODAY, 9), status: "sent" },
  { id: "INV-009", clientId: "C-04", description: "Social media creative pack - June retainer", amountINR: 45000, issueDate: addDays(TODAY, -2), dueDate: addDays(TODAY, 12), status: "sent" },
  // Sent, due later
  { id: "INV-010", clientId: "C-02", description: "Class 12 Chemistry tutoring, June", amountINR: 24000, issueDate: addDays(TODAY, 0), dueDate: addDays(TODAY, 20), status: "sent" },
  // Draft
  { id: "INV-011", clientId: "C-03", description: "Onboarding illustration set - Milestone 1, style frames", amountINR: 140000, issueDate: addDays(TODAY, 0), dueDate: addDays(TODAY, 30), status: "draft" },
  { id: "INV-012", clientId: "C-06", description: "Packaging mockups - Milestone 4, 3D renders", amountINR: 72000, issueDate: addDays(TODAY, 0), dueDate: addDays(TODAY, 25), status: "draft" },
];

export const payments: Payment[] = [
  { id: "P-001", invoiceId: "INV-001", amountINR: 85000, receivedDate: addDays(TODAY, -40) },
  { id: "P-002", invoiceId: "INV-002", amountINR: 24000, receivedDate: addDays(TODAY, -36) },
  { id: "P-003", invoiceId: "INV-013", amountINR: 16000, receivedDate: addDays(TODAY, -32) },
];

export const bills: Bill[] = [
  { id: "B-01", name: "Office rent - Indiranagar, Bengaluru", category: "Workspace", amountINR: 12000, dueDate: addDays(TODAY, 7), status: "upcoming", recurrence: "monthly" },
  { id: "B-02", name: "Adobe Creative Cloud", category: "Software", amountINR: 4230, dueDate: addDays(TODAY, 4), status: "upcoming", recurrence: "monthly" },
  { id: "B-03", name: "Health insurance premium", category: "Insurance", amountINR: 18500, dueDate: addDays(TODAY, 22), status: "upcoming", recurrence: "yearly" },
  { id: "B-04", name: "Laptop EMI", category: "Loan", amountINR: 7800, dueDate: addDays(TODAY, 45), status: "upcoming", recurrence: "monthly" },
  { id: "B-05", name: "Fibre internet - office broadband", category: "Utilities", amountINR: 999, dueDate: addDays(TODAY, -3), status: "paid", recurrence: "monthly" },
  { id: "B-06", name: "Mobile plan - business SIM", category: "Utilities", amountINR: 749, dueDate: addDays(TODAY, -8), status: "paid", recurrence: "monthly" },
];

export const cashAccounts: CashAccount[] = [
  { id: "CA-01", label: "Business savings account", balanceINR: 412500, asOfDate: TODAY },
  { id: "CA-02", label: "Business current account", balanceINR: 96800, asOfDate: TODAY },
  { id: "CA-03", label: "Cash and UPI wallet", balanceINR: 8450, asOfDate: TODAY },
];

export const followUps: FollowUp[] = [
  { id: "FU-01", invoiceId: "INV-003", date: addDays(TODAY, -45), note: "Sent first payment reminder with invoice PDF", channel: "email" },
  { id: "FU-02", invoiceId: "INV-003", date: addDays(TODAY, -30), note: "Client said payment is in the next vendor approval cycle", channel: "whatsapp" },
  { id: "FU-03", invoiceId: "INV-004", date: addDays(TODAY, -12), note: "Called accounts team; promised NEFT payment by month end", channel: "phone" },
];
