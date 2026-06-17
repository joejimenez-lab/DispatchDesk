import { NextResponse } from "next/server";

// OpenStreetMap's Nominatim usage policy requires a User-Agent that identifies
// the application and provides a contact (URL or email). Set NOMINATIM_USER_AGENT
// to a real contact before deploying; the fallback is only suitable for local dev.
const NOMINATIM_USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ?? "DispatchDesk/1.0 (local development; set NOMINATIM_USER_AGENT)";

type NominatimResult = {
  place_id: number;
  display_name: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    hamlet?: string;
    state?: string;
    postcode?: string;
    road?: string;
    house_number?: string;
  };
};

function formatLocation(result: NominatimResult) {
  const address = result.address;
  if (!address) return result.display_name;

  const city = address.city ?? address.town ?? address.village ?? address.hamlet;
  const street = [address.house_number, address.road].filter(Boolean).join(" ");

  if (street && city && address.state) {
    return [street, city, address.state, address.postcode].filter(Boolean).join(", ");
  }

  if (city && address.state) {
    return [city, address.state].filter(Boolean).join(", ");
  }

  return result.display_name;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  if (!query || query.length < 3) {
    return NextResponse.json({ locations: [] }, { headers: { "Cache-Control": "private, max-age=60" } });
  }

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "us");

  let response: Response;

  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(5_000),
      headers: {
        "User-Agent": NOMINATIM_USER_AGENT,
        Accept: "application/json",
      },
      next: { revalidate: 60 * 60 * 24 },
    });
  } catch {
    return NextResponse.json(
      { locations: [], message: "Location lookup is temporarily unavailable." },
      { status: 504, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (!response.ok) {
    return NextResponse.json(
      { locations: [], message: "Location lookup is temporarily unavailable." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const results = (await response.json()) as NominatimResult[];
  const seen = new Set<string>();
  const locations = results.flatMap((result) => {
    const label = formatLocation(result);
    const key = label.toLowerCase();

    if (seen.has(key)) return [];
    seen.add(key);

    return [{
      id: String(result.place_id),
      label,
      fullLabel: result.display_name,
      type: result.type ?? "location",
    }];
  });

  return NextResponse.json(
    { locations },
    { headers: { "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" } },
  );
}
