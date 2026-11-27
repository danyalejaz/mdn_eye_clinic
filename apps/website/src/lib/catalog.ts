export type ClinicProfile = {
  name: string;
  address: string;
  phone: string | null;
  hoursSummary: string | null;
  timezone: "Asia/Karachi";
  currency: "PKR";
};

export type PublicDoctor = {
  id: string;
  slug: string;
  displayName: string;
  specialty: string;
  qualifications: string | null;
  photoUrl: string | null;
  feeMinor: number;
  currency: "PKR";
  departmentSlug: string;
  departmentName: string;
};

export type PublicService = {
  slug: string;
  name: string;
  description: string | null;
  feeMinor: number;
  currency: "PKR";
  departmentSlug: string;
  departmentName: string;
};

export async function loadCatalog() {
  return {
    clinic: { name: "Mardan Eye Clinic", address: "", phone: "0937-867538", hoursSummary: null, timezone: "Asia/Karachi" as const, currency: "PKR" as const },
    doctors: [] as PublicDoctor[],
    services: [] as PublicService[],
  };
}

export function formatFee(minor: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
