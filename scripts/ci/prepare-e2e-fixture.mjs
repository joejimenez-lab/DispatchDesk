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
