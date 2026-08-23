import type { Metadata } from "next";
import { CalendarDays, Check, History, PackageOpen } from "lucide-react";
import { CURRENT_VERSION, VERSION_HISTORY, type ProductRelease } from "@/lib/version-history";

export const metadata: Metadata = {
  title: "Version history",
  description: "DispatchDesk product release history.",
};

const majorLabels: Record<string, string> = {
  "2": "Current generation",
  "1": "Initial launched generation",
  "0": "Pre-launch development",
};

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}

function groupReleases(releases: readonly ProductRelease[]) {
  return releases.reduce<Map<string, ProductRelease[]>>((groups, release) => {
    const major = release.version.split(".")[0];
    const group = groups.get(major) ?? [];
    group.push(release);
    groups.set(major, group);
    return groups;
  }, new Map());
}

export default function VersionsPage() {
  const groups = groupReleases(VERSION_HISTORY);

  return (
    <div className="version-page">
      <header className="version-page-header">
        <div>
          <div className="page-kicker"><History className="size-4" aria-hidden="true" /> Product releases</div>
          <h1>Version history</h1>
          <p>A curated record of the changes delivered across DispatchDesk releases.</p>
        </div>
        <div className="version-current-card" aria-label={`Current version ${CURRENT_VERSION}`}>
          <span><Check aria-hidden="true" /> Current version</span>
          <strong>v{CURRENT_VERSION}</strong>
        </div>
      </header>

      <div className="version-generation-list">
        {Array.from(groups.entries()).map(([major, releases]) => (
          <section className="version-generation" key={major} aria-labelledby={`version-${major}-heading`}>
            <header className="version-generation-header">
              <div>
                <span>Version {major}.x</span>
                <h2 id={`version-${major}-heading`}>{majorLabels[major]}</h2>
              </div>
              <span>{releases.length} release{releases.length === 1 ? "" : "s"}</span>
            </header>

            <ol className="version-timeline">
              {releases.map((release) => {
                const current = release.version === CURRENT_VERSION;

                return (
                  <li className={current ? "version-release version-release-current" : "version-release"} key={release.version}>
                    <div className="version-release-marker" aria-hidden="true"><span /></div>
                    <article>
                      <div className="version-release-heading">
                        <div>
                          <span className="version-number">v{release.version}</span>
                          <span className="version-kind" data-kind={release.kind}>{release.kind}</span>
                          {current ? <span className="version-current-label">Current</span> : null}
                        </div>
                        <time dateTime={release.date}><CalendarDays aria-hidden="true" /> {formatDate(release.date)}</time>
                      </div>
                      <h3>{release.title}</h3>
                      <p>{release.summary}</p>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>

      <footer className="version-history-note">
        <PackageOpen aria-hidden="true" />
        <p>This page shows product releases only. Internal maintenance and development-only changes remain outside the public history.</p>
      </footer>
    </div>
  );
}
