export interface Component {
  id: string;
  name: string;
  category: string;
  totalStock: number;
  availableStock: number;
  location: string;
  condition: "Excellent" | "Good" | "Needs Attention";
  description: string;
  schoolId?: string; // Opt-in scoping for multiple schools
}

export interface Checkout {
  id: string;
  componentId: string;
  componentName: string;
  studentName: string;
  studentEmail: string;
  quantity: number;
  checkoutDate: string;
  dueDate: string;
  returnedDate: string | null;
  status: "active" | "returned" | "overdue";
  alertsSent: number;
  lastAlertDate: string | null;
  schoolId?: string; // Opt-in scoping for multiple schools
}

export interface LogEntry {
  id: string;
  timestamp: string;
  type: "checkout" | "return" | "alert" | "inventory" | "system";
  message: string;
  schoolId?: string; // Opt-in scoping for multiple schools
}

export interface School {
  id: string;
  name: string;
  passkey: string;
  firstLogin: boolean;
}

export interface Student {
  id: string;
  name: string;
  email: string;
  code: string;     // Secure Student Code
  passkey: string;  // Student Passkey (PIN-code)
  schoolId: string;
}

export type LabCategory = "Microcontrollers" | "Sensors" | "Actuators" | "Power Supplies" | "Tools" | "Structural";
export type ConditionType = "Excellent" | "Good" | "Needs Attention";
export type AlertTone = "friendly" | "firm" | "parent";

