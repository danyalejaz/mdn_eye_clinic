import { cookies, password, testPlatform } from "./platform";

export async function startVisit(platform: Awaited<ReturnType<typeof testPlatform>>) {
  const { request, env } = platform;
  const reception = await platform.staff("receptionist");
  const doctor = await platform.staff("doctor", "doc_demo_a");
  const api = "/api/v1";
  const post = (path: string, body: object, cookie = reception.cookie, key?: string) => request(`${api}${path}`, {
    cookie, body, headers: key ? { "Idempotency-Key": key } : undefined,
  });
  async function created(response: Response) {
    if (!response.ok) throw new Error(`Visit setup failed (${response.status}): ${JSON.stringify(await response.json())}`);
    return (await response.json<{ data: { id: string } }>()).data.id;
  }
  const patientId = await created(await post("/patients", { displayName: "Fictional Visit Patient" }));
  const email = "visit-patient@example.test";
  const patientUser = await platform.account(email, "patient");
  await env.DB.prepare("UPDATE patients SET user_id = ? WHERE id = ?").bind(patientUser, patientId).run();
  const patientCookie = cookies(await request("/api/auth/sign-in/email", {
    body: { email, password }, headers: { "CF-Connecting-IP": "192.0.2.100" },
  }));
  const appointmentId = await created(await post("/appointments/walk-in", { patientId, doctorId: "doc_demo_a" }, reception.cookie, "walkin-visit"));
  const queueId = await created(await post(`/appointments/${appointmentId}/check-in`, {}, reception.cookie, "checkin-visit"));
  await created(await post(`/queue/${queueId}/call`, { expectedVersion: 1 }));
  const encounterId = await created(await post(`/queue/${queueId}/start`, { expectedVersion: 2 }, doctor.cookie));
  return { post, reception, doctor, patientCookie, patientId, appointmentId, encounterId, queueId };
}
