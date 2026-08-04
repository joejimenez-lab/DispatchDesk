type StatusViewer = {
  id: string;
  email?: string | null;
};

type StatusAccessEnvironment = {
  STATUS_PAGE_ALLOWED_EMAILS?: string;
  STATUS_PAGE_ALLOWED_USER_IDS?: string;
};

function parseList(value: string | undefined, normalize: (entry: string) => string) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => normalize(entry.trim()))
      .filter(Boolean),
  );
}

export function isStatusViewerAllowed(
  viewer: StatusViewer,
  env: StatusAccessEnvironment = {
    STATUS_PAGE_ALLOWED_EMAILS: process.env.STATUS_PAGE_ALLOWED_EMAILS,
    STATUS_PAGE_ALLOWED_USER_IDS: process.env.STATUS_PAGE_ALLOWED_USER_IDS,
  },
) {
  const emails = parseList(env.STATUS_PAGE_ALLOWED_EMAILS, (entry) => entry.toLowerCase());
  const userIds = parseList(env.STATUS_PAGE_ALLOWED_USER_IDS, (entry) => entry);
  const email = viewer.email?.trim().toLowerCase();

  return userIds.has(viewer.id) || Boolean(email && emails.has(email));
}
