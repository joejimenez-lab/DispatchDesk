# DispatchDesk UI Guidelines

## Visual thesis

DispatchDesk is a practical fleet-management product. The interface combines a focused operations-workspace structure with a light lavender and white palette. It should feel capable, calm, and polished without becoming dark, sterile, or decorative.

The interface should feel calm under pressure. Density is useful when hierarchy is unmistakable. Data modules belong to one continuous workspace instead of floating as decorative cards.

## Foundations

- Canvas: `#edeef8` — pale lavender workspace background.
- Surface: translucent white — primary content surface.
- Ink: `#24263a` — headings and primary text.
- Muted ink: `#76798d` — supporting copy and labels.
- Rule: `#dfe1ed` — default separation.
- Signal: `#6757e8` — primary actions and active navigation.
- Signal dark: `#5143c2` — hover/pressed state.
- Positive: `#15803d`; warning: `#b45309`; danger: `#b42318`; information: `#6757e8`.

Typography uses IBM Plex Sans throughout the interface, including headings and numeric values. Numeric data uses tabular figures.

## Composition

- Global navigation is a persistent left workspace rail on desktop and a readable horizontal rail on compact screens.
- A slim workspace bar keeps the current section and primary load action visible on desktop.
- Main content uses the remaining working viewport instead of a centered marketing-style column.
- Show only the most important KPI summaries at the top of the dashboard; place secondary figures in their related sections.
- Use one compact metric strip at the top of the dashboard; supporting operational panels remain light and quieter below it.
- Tables and lists are primary product surfaces. Give their headers strong hierarchy and keep rows compact.
- Use 8–12px radii for controls and 12–16px radii for primary surfaces. Shadows remain subtle and support hierarchy.
- Use spacing to group related controls before adding another box.

## Interaction

- Primary action: violet, short literal label, no gradient.
- Active navigation: solid violet with white text and restrained depth.
- Status: small dot + restrained tinted text/background where necessary.
- Focus rings are high-contrast and visible on every interactive element.
- Motion is limited to 120–180ms feedback and respects reduced-motion preferences.

## Responsive rules

- The sidebar becomes a horizontal navigation rail on compact widths; destinations are never hidden behind an unlabeled icon-only menu.
- Metric summaries use a two-column grid on compact screens.
- Dense tables keep horizontal scrolling and frozen visual hierarchy rather than collapsing into ambiguous cards.
- Primary actions remain near their page title and use full-width controls only when space requires it.

## Hard bans

- No gradient glows or ambient blobs.
- No floating KPI-card soup.
- No pill-everything styling.
- No fake AI insights, fake live indicators, or decorative charts without an operational decision.
- No marketing copy inside authenticated workflows.
