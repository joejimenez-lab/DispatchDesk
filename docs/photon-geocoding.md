# Self-hosted Photon geocoding

DispatchDesk uses [Photon](https://github.com/komoot/photon) for US address search and autocomplete. The browser calls the app's `/api/locations/search` route; only the server communicates with Photon, so the Photon endpoint is not exposed in the client bundle.

## Run Photon

Photon requires Java 21 or newer and an OpenStreetMap search database. Follow Photon's official [installation and usage instructions](https://github.com/komoot/photon#installation) to download a release and the geographic data needed for the deployment. A worldwide database has substantial disk and memory requirements, so use a regional import when the deployment only needs US results.

Once the database directory is in place, Photon can be started from its parent directory:

```bash
java -jar photon-*.jar serve
```

Photon listens on `http://localhost:2322` by default. Confirm that the service and its data are ready:

```bash
curl http://127.0.0.1:2322/status
curl 'http://127.0.0.1:2322/api?q=Portland&countrycode=US&limit=1'
```

For production, run Photon as a supervised service, keep its data on persistent SSD storage, restrict direct network access to the application or private network, and put TLS at a reverse proxy when traffic crosses hosts.

## Configure DispatchDesk

Set the full Photon search endpoint in the server environment:

```bash
PHOTON_API_URL=http://127.0.0.1:2322/api
```

The value may point to a private hostname or a reverse-proxy path, for example `https://photon.internal.example/api`. It must use HTTP or HTTPS and must not contain credentials. Restart the Next.js server after changing it.

`PHOTON_API_URL` is required in production. When it is omitted during local development, DispatchDesk uses Photon's public demo for low-volume testing. The fallback is intentionally disabled in production because the demo has no availability guarantee and may throttle requests.

The application adds these search parameters on each request:

- `q`: the user's search text
- `limit=6`
- `countrycode=US`
- `lang=en`

Requests time out after five seconds. Successful query responses are cached for one day in Next.js and in the browser's private cache. Upstream failures, timeouts, invalid responses, and missing configuration return an empty result with a user-safe message and are not cached.

## Operations

- Monitor Photon's `/status` endpoint and application responses from `/api/locations/search`.
- Keep the Photon release and OpenStreetMap data current using the upstream update guidance.
- Size CPU, memory, and storage against the imported region and expected autocomplete traffic.
- Do not substitute the public Nominatim server or a public Photon demo for a production deployment. Public services can throttle or change without notice and are not an availability dependency for this application.
