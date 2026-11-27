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

const apiBase = import.meta.env.API_URL ?? "http://127.0.0.1:8787";

async function read<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(new URL(path, apiBase));
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function list<T extends { slug: string }>(path: string): Promise<T[]> {
  const rows: T[] = [];
  let cursor = "";
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({ limit: "100" });
    if (cursor) params.set("cursor", cursor);
    const body = await read<{ data: T[]; meta: { nextCursor: string | null } }>(`${path}?${params}`);
    if (!body) return rows;
    rows.push(...body.data);
    if (!body.meta.nextCursor) break;
    cursor = body.meta.nextCursor;
  }
  return rows;
}

export async function loadCatalog() {
  const [clinicBody, doctors, services] = await Promise.all([
    read<{ data: ClinicProfile }>("/api/v1/public/clinic"),
    list<PublicDoctor>("/api/v1/public/doctors"),
    list<PublicService>("/api/v1/public/services"),
  ]);
  return { clinic: clinicBody?.data ?? null, doctors, services };
}

export function formatFee(minor: number) {
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(minor / 100);
}
