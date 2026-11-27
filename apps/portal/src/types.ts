export type Role = "patient" | "receptionist" | "doctor" | "admin";

export type Actor = {
  userId: string;
  role: Role;
  patientId: string | null;
  doctorId: string | null;
};

export type Appointment = {
  id: string;
  reference: string;
  patientId: string;
  doctorId: string;
  slotId: string | null;
  scheduledAt: string;
  feeMinor: number;
  currency: string;
  status: string;
  source: string;
  version: number;
  patientName?: string;
  mrn?: string;
  doctorName?: string;
  specialty?: string;
};

export type OpenSlot = {
  slotId: string;
  doctorId: string;
  startAt: string;
  endAt: string;
  feeMinor: number;
  currency: string;
};

export type PublicDoctor = {
  id: string;
  slug: string;
  displayName: string;
  specialty: string;
  feeMinor: number;
  departmentName: string;
};

export type QueueEntry = {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  patientName: string;
  mrn: string;
  tokenNumber: number;
  status: string;
  version: number;
  arrivedAt: string;
  roomId: string | null;
  encounterId: string | null;
  encounterStatus: string | null;
  encounterVersion: number | null;
};

