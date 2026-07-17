import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

describe("location search route", () => {
  const originalPhotonApiUrl = process.env.PHOTON_API_URL;

  beforeEach(() => {
    process.env.PHOTON_API_URL = "http://photon.internal:2322/api";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalPhotonApiUrl === undefined) {
      delete process.env.PHOTON_API_URL;
    } else {
      process.env.PHOTON_API_URL = originalPhotonApiUrl;
    }
  });

  it("does not call Photon for short queries", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/api/locations/search?q=ab"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ locations: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a configuration error when the Photon endpoint is missing", async () => {
    delete process.env.PHOTON_API_URL;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/api/locations/search?q=Portland"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      locations: [],
      message: "Location lookup is not configured.",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps and deduplicates Photon features", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        features: [
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-122.6765, 45.5231] },
            properties: {
              osm_id: 186579,
              osm_type: "R",
              osm_key: "place",
              osm_value: "city",
              name: "Portland",
              city: "Portland",
              state: "Oregon",
              country: "United States",
            },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-122.67, 45.52] },
            properties: {
              osm_id: 999,
              osm_type: "N",
              osm_value: "city",
              name: "Portland",
              city: "Portland",
              state: "Oregon",
              country: "United States",
            },
          },
          {
            type: "Feature",
            geometry: { type: "Point", coordinates: [-122.68, 45.51] },
            properties: {
              osm_id: 123,
              osm_type: "W",
              osm_key: "highway",
              osm_value: "residential",
              name: "North Lombard Street",
              housenumber: "10",
              street: "North Lombard Street",
              city: "Portland",
              state: "Oregon",
              postcode: "97203",
              country: "United States",
            },
          },
        ],
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(new Request("http://localhost/api/locations/search?q=Portland%20OR"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.locations).toEqual([
      {
        id: "R:186579",
        label: "Portland, Oregon",
        fullLabel: "Portland, Oregon, United States",
        type: "city",
      },
      {
        id: "W:123",
        label: "10 North Lombard Street, Portland, Oregon, 97203",
        fullLabel: "North Lombard Street, 10 North Lombard Street, Portland, Oregon, 97203, United States",
        type: "residential",
      },
    ]);

    const requestedUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(requestedUrl.origin + requestedUrl.pathname).toBe("http://photon.internal:2322/api");
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      q: "Portland OR",
      limit: "6",
      countrycode: "US",
      lang: "en",
    });
  });

  it("handles upstream failures and invalid payloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(Response.json({ unexpected: true }))
      .mockRejectedValueOnce(new Error("timeout"));
    vi.stubGlobal("fetch", fetchMock);
    const request = new Request("http://localhost/api/locations/search?q=Portland");

    const upstreamFailure = await GET(request);
    const invalidPayload = await GET(request);
    const timeout = await GET(request);

    expect(upstreamFailure.status).toBe(502);
    expect(invalidPayload.status).toBe(502);
    expect(timeout.status).toBe(504);
    await expect(timeout.json()).resolves.toEqual({
      locations: [],
      message: "Location lookup is temporarily unavailable.",
    });
  });
});
