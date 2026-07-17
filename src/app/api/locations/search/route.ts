import { NextResponse } from "next/server";
import { z } from "zod";

const PHOTON_TIMEOUT_MS = 5_000;
const PHOTON_RESULT_LIMIT = 6;
const PHOTON_DEVELOPMENT_API_URL = "https://photon.komoot.io/api";
const MANUAL_ENTRY_MESSAGE = "Autocomplete is unavailable. Enter the location manually.";

const photonResponseSchema = z.object({
  features: z.array(
    z.object({
      geometry: z
        .object({
          coordinates: z.tuple([z.number(), z.number()]),
        })
        .optional(),
      properties: z
        .object({
          osm_id: z.union([z.number(), z.string()]).optional(),
          osm_type: z.string().optional(),
          osm_key: z.string().optional(),
          osm_value: z.string().optional(),
          name: z.string().optional(),
          housenumber: z.string().optional(),
          street: z.string().optional(),
          locality: z.string().optional(),
          district: z.string().optional(),
          city: z.string().optional(),
          county: z.string().optional(),
          state: z.string().optional(),
          postcode: z.string().optional(),
          country: z.string().optional(),
        })
        .passthrough(),
    }),
  ),
});

type PhotonFeature = z.infer<typeof photonResponseSchema>["features"][number];

function uniqueParts(parts: Array<string | undefined>) {
  const seen = new Set<string>();

  return parts.filter((part): part is string => {
    const value = part?.trim();
    if (!value) return false;

    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatLocation(feature: PhotonFeature) {
  const properties = feature.properties;
  const street = uniqueParts([properties.housenumber, properties.street]).join(" ");
  const locality = properties.city ?? properties.locality ?? properties.district ?? properties.county;
  const labelParts = street
    ? [street, locality, properties.state, properties.postcode]
    : [properties.name, locality, properties.state, properties.postcode];
  const fullLabelParts = [
    properties.name,
    street,
    locality,
    properties.state,
    properties.postcode,
    properties.country,
  ];

  const label = uniqueParts(labelParts).join(", ");
  const fullLabel = uniqueParts(fullLabelParts).join(", ");

  return {
    label: label || fullLabel,
    fullLabel: fullLabel || label,
  };
}

function getPhotonApiUrl() {
  const configuredUrl = process.env.PHOTON_API_URL?.trim()
    || (process.env.NODE_ENV === "development" ? PHOTON_DEVELOPMENT_API_URL : "");
  if (!configuredUrl) return null;

  try {
    const url = new URL(configuredUrl);
    if (!(["http:", "https:"] as string[]).includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

function unavailableResponse(status: 502 | 503 | 504, message = "Location lookup is temporarily unavailable.") {
  return NextResponse.json(
    { locations: [], message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json({ locations: [] }, { headers: { "Cache-Control": "private, max-age=60" } });
  }

  const url = getPhotonApiUrl();
  if (!url) {
    return unavailableResponse(503, MANUAL_ENTRY_MESSAGE);
  }

  url.searchParams.set("q", query);
  url.searchParams.set("limit", String(PHOTON_RESULT_LIMIT));
  url.searchParams.set("countrycode", "US");
  url.searchParams.set("lang", "en");

  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(PHOTON_TIMEOUT_MS),
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch {
    return unavailableResponse(504);
  }

  if (!response.ok) {
    return unavailableResponse(502);
  }

  let parsed: z.infer<typeof photonResponseSchema>;

  try {
    parsed = photonResponseSchema.parse(await response.json());
  } catch {
    return unavailableResponse(502);
  }

  const seen = new Set<string>();
  const locations = parsed.features.flatMap((feature) => {
    const { label, fullLabel } = formatLocation(feature);
    if (!label) return [];

    const key = label.toLowerCase();
    if (seen.has(key)) return [];
    seen.add(key);

    const properties = feature.properties;
    const coordinateId = feature.geometry?.coordinates.join(":");
    const id = properties.osm_id
      ? `${properties.osm_type ?? "osm"}:${properties.osm_id}`
      : coordinateId ?? key;

    return [{
      id,
      label,
      fullLabel,
      type: properties.osm_value ?? properties.osm_key ?? "location",
    }];
  });

  return NextResponse.json(
    { locations },
    { headers: { "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" } },
  );
}
