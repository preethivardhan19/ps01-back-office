// Synthetic data model for PS-01 (see PROJECT_SPEC.md section 6).
// All dates are ISO calendar dates "YYYY-MM-DD"; all money is INR as a number.

export type ClientType = "design" | "tutoring";

export interface Client {
  id: string;
  name: string;
  type: ClientType;
  city: string;
  contact: string; // placeholder only
}

export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";

export interface Invoice {
  id: string;
  clientId: string;
  description: string;
  amountINR: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidDate?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amountINR: number;
  receivedDate: string;
}

export type BillStatus = "upcoming" | "paid" | "overdue";

export type Recurrence = "one-time" | "monthly" | "quarterly" | "yearly";

export interface Bill {
  id: string;
  name: string;
  category: string;
  amountINR: number;
  dueDate: string;
  status: BillStatus;
  recurrence: Recurrence;
}

export interface CashAccount {
  id: string;
  label: string;
  balanceINR: number;
  asOfDate: string;
}

export type FollowUpChannel = "email" | "whatsapp" | "phone" | "in-person";

export interface FollowUp {
  id: string;
  invoiceId: string;
  date: string;
  note: string;
  channel: FollowUpChannel;
}
