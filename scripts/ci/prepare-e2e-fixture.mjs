const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

if (!apiUrl || !serviceRoleKey || !email || !password) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, E2E_EMAIL, and E2E_PASSWORD are required.",
  );
}

const url = new URL(apiUrl);
const loopbackHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

if (url.protocol !== "http:" || !loopbackHosts.has(url.hostname)) {
  throw new Error(`Refusing to prepare browser fixtures outside local Supabase: ${url.origin}`);
}

const headers = {
  apikey: serviceRoleKey,
  Authorization: `Bearer ${serviceRoleKey}`,
  "Content-Type": "application/json",
};

async function checkedFetch(path, init = {}) {
  const response = await fetch(`${url.origin}${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Local fixture request failed (${response.status} ${path}): ${detail}`);
  }
  return response;
}

const usersResponse = await checkedFetch("/auth/v1/admin/users?per_page=1000");
const existingUser = (await usersResponse.json()).users.find((user) => user.email === email);
const userResponse = existingUser
  ? await checkedFetch(`/auth/v1/admin/users/${existingUser.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    })
  : await checkedFetch("/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
const user = await userResponse.json();
if (user.email !== email) throw new Error("Local browser identity email did not match the fixture.");

console.log(`Prepared local browser identity ${email}.`);

// Fictional crossover loads verify that accounting follows the carrier.
const session = await (await checkedFetch("/auth/v1/token?grant_type=password", {
  method: "POST", body: JSON.stringify({ email, password }),
})).json();
headers.Authorization = `Bearer ${session.access_token}`;
const memberships = await (await checkedFetch(`/rest/v1/organization_members?user_id=eq.${user.id}&select=organization_id`)).json();
const organizationId = memberships[0]?.organization_id;
if (!organizationId) throw new Error("Browser fixture identity has no organization.");
const fixtureUnits = [
  { id: "40000000-0000-4000-8000-000000000101", unit_number: "E2E-DC-TRUCK", unit_type: "Truck", company: "DC", organization_id: organizationId },
  { id: "40000000-0000-4000-8000-000000000102", unit_number: "E2E-RD-TRUCK", unit_type: "Truck", company: "RD", organization_id: organizationId },
];
await checkedFetch("/rest/v1/fleet_units?on_conflict=id", {
  method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify(fixtureUnits),
});
const fixtureLoads = [
  { id: "40000000-0000-4000-8000-000000000201", load_number: "E2E-DC-CROSS", carrier_company: "DC GEMS CORP", fleet_company: "RD", truck_unit_id: fixtureUnits[1].id, load_rate: 1200 },
  { id: "40000000-0000-4000-8000-000000000202", load_number: "E2E-RD-CROSS", carrier_company: "RD FREIGH", fleet_company: "DC", truck_unit_id: fixtureUnits[0].id, load_rate: 2200 },
];
await checkedFetch("/rest/v1/loads?on_conflict=id", {
  method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
  body: JSON.stringify(fixtureLoads.map((load) => ({ ...load, organization_id: organizationId, pickup_location: "Fictional pickup", delivery_location: "Fictional delivery", status: "Booked", pickup_date: "2026-09-09", delivery_date: "2026-09-10", driver_pay: 500, dispatcher_fee: 50, fuel_cost: 100, driver_pay_known: true, dispatcher_fee_known: true, fuel_cost_known: true }))),
});
for (const load of fixtureLoads) {
  await checkedFetch(`/rest/v1/payments?load_id=eq.${load.id}`, {
    method: "PATCH", body: JSON.stringify({ invoice_status: null, invoice_number: null, invoice_sent: false }),
  });
}
console.log("Prepared fictional DC/RD crossover loads for accounting verification.");
