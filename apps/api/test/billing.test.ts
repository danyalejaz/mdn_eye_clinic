import { afterAll, expect, it } from "vitest";
import { testPlatform } from "./platform";
import { startVisit } from "./visit";

let platform: Awaited<ReturnType<typeof testPlatform>>;
afterAll(async () => { await platform?.dispose(); });

it("atomically limits payments and refunds, with scoped receipts and daily totals", async () => {
  platform = await testPlatform(["public-catalog.sql"]);
  const visit = await startVisit(platform);
  const { request } = platform;
  const admin = await platform.staff("admin");
  const invoice = await visit.post("/invoices", { appointmentId: visit.appointmentId });
  expect(invoice.status).toBe(201);
  const { data: { id } } = await invoice.json<{ data: { id: string } }>();
  const path = `/invoices/${id}`;
  const record = (key: string, amountMinor = 100000) =>
    visit.post(`${path}/payments`, { amountMinor, method: "cash" }, visit.reception.cookie, key);
  const results = await Promise.all([record("payment-001"), record("payment-002")]);
  expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  const first = results[0].status === 201;
  const recorded = await results[first ? 0 : 1].json<{ data: { id: string } }>();
  expect((await record(first ? "payment-001" : "payment-002")).status).toBe(200);
  expect((await record(first ? "payment-001" : "payment-002", 50000)).status).toBe(409);
  const { data: { id: paymentId } } = recorded;
  const refundPath = `/payments/${paymentId}/refunds`;
  expect((await visit.post(refundPath, { amountMinor: 1000, reason: "Fictional correction" }, visit.reception.cookie, "refund-001")).status).toBe(403);
  expect((await visit.post(refundPath, { amountMinor: 100001, reason: "Fictional correction" }, admin.cookie, "refund-002")).status).toBe(409);
  expect((await visit.post(refundPath, { amountMinor: 25000, reason: "Fictional correction" }, admin.cookie, "refund-003")).status).toBe(201);
  const detail = await request(`/api/v1${path}`, { cookie: visit.patientCookie });
  expect(await detail.json()).toMatchObject({
    data: { totalMinor: 150000, paidMinor: 75000, balanceMinor: 75000, receipts: [{ receiptId: paymentId }] },
  });
  expect((await request(`/api/v1${path}`, { cookie: visit.doctor.cookie })).status).toBe(403);
  const receipt = await request(`/api/v1/receipts/${paymentId}/pdf`, { cookie: visit.patientCookie });
  expect(receipt.headers.get("Content-Type")).toBe("application/pdf");
  expect((await receipt.text()).startsWith("%PDF-")).toBe(true);
  expect(await (await request("/api/v1/billing/collections", { cookie: visit.reception.cookie })).json()).toMatchObject({
    data: { methods: [{ method: "cash", grossMinor: 100000, refundedMinor: 25000, netMinor: 75000 }] },
  });
}, 20_000);
