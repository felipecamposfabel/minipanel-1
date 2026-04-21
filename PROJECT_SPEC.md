# MiniPanel — Project Specification

## Overview

MiniPanel is a self-hosted analytics platform for product teams. It helps them understand user behavior by collecting events from their applications and providing tools to explore, visualize, and analyze that data. Think of it as "Mixpanel, but you can run it on your laptop."

## Users

| Role             | Core job                                                                 |
| ---------------- | ------------------------------------------------------------------------ |
| Product Analyst  | Understand how users interact with features. Trends, breakdowns, funnels |
| Growth Manager   | See where users drop off in a flow. Optimize conversion                  |
| Developer        | Verify events are flowing correctly. Raw event feed, not charts          |
| Support Lead     | Look up a user's complete activity history including anonymous events     |

## Core Domain

### Events

An event represents something that happened in the user's product. Every event has a name (what happened), a timestamp (when it happened), and an identity (who did it). Events may carry arbitrary properties.

Properties vary by event type. A "Purchase Completed" event might carry `amount` and `currency`. A "Page Viewed" event might carry `url` and `referrer`. Properties can be strings, numbers, or booleans.

### Identity

Users interact with products across devices and sessions. Before login, they are anonymous (device-level UUID). After login, they have a known identity (email or database ID).

MiniPanel follows a simplified identity merge model (inspired by Mixpanel):

* Each event carries a device identity, a user identity, or both.
* When an event carries both, the system creates a permanent mapping: that device belongs to that user.
* Once a mapping exists, all past and future events from that device are attributed to the known user. The merge is retroactive.
* Multiple devices can map to the same user.
* A device can only belong to one user.
* The resolved identity is used everywhere: charts, funnels, user counts, profiles, event explorer.

**This is the most important architectural decision. If identity resolution is wrong, every number is wrong.**

---

## Requirements

### Tier 1 — Foundation

#### BR-100: Event collection

The system accepts events from external applications and stores them.

* The system MUST provide a network API that accepts events.
* Each event MUST include the event name.
* Each event MUST include at least one identity (device or user).
* The system MUST persist events so they survive a restart.
* The system MUST reject events missing required fields and return a clear error.
* Events MAY include a timestamp. If omitted, the system MUST use the current server time.
* Events MAY include arbitrary key-value properties.

#### BR-101: Identity resolution

The system stitches anonymous and known identities into a single user.

* The system MUST maintain a mapping of device identities to user identities.
* When an event contains both a device identity and a user identity, the system MUST create or confirm this mapping.
* The merge MUST be retroactive: events previously recorded under an anonymous device MUST be attributed to the known user once the mapping exists.
* All read operations (queries, aggregations, counts, user lookups) MUST use the resolved identity.
* A device identity MUST NOT map to more than one user identity.
* Multiple device identities MAY map to the same user identity.

How to verify:

1. Send an anonymous event for device X. Send 3 more anonymous events for device X. Send an identified event linking device X to user Y. Query events for user Y. All 5 events MUST appear.
2. Send anonymous events for device A and device B. Link both devices to user Z in separate events. Query events for user Z. Events from both devices MUST appear.

#### BR-102: Sample data

The system ships with realistic demo data so it's useful out of the box.

* The system MUST include a way to populate it with sample data.
* The sample data MUST include at least 5 distinct event types.
* The sample data MUST include at least 50 resolved users and at least 10,000 events spread over 30 days.
* The distribution MUST NOT be uniform. Some users SHOULD be more active. Some events SHOULD be more common.
* The sample data MUST include identity resolution scenarios: users who start anonymous and later identify, users with multiple devices, and users who never identify.
* Events MUST include both string properties (page names, button labels, plan types) and numeric properties (amounts, durations, quantities).

#### BR-103: Application shell

The system is a web application that starts with one command.

* The system MUST be a web application with navigation between its main areas.
* The system MUST start with a single documented command.
* The system MUST NOT require external services, API keys, or cloud infrastructure.

How to verify:

1. Clone the repo. Follow only the README. Run the start command. The application MUST work.

---

### Tier 2 — MVP

#### BR-200: Event exploration

The developer and analyst can browse raw events.

* The user MUST be able to see events in reverse chronological order.
* Each event MUST display its timestamp, name, resolved identity, and properties.
* The user MUST be able to filter events by event name.
* The system MUST handle large volumes without loading everything at once.

How to verify:

1. The developer sends an event via the API, then finds it in the explorer by filtering on the event name.

#### BR-201: Trend analysis

The product analyst can see how event volume changes over time.

* The user MUST be able to select an event type and see its volume over time.
* The system MUST support at least two measures: total event count and unique user count (using resolved identities).
* The results MUST be displayed as a time series chart.
* The user MUST be able to adjust time granularity. At minimum: daily and weekly.
* The user MUST be able to select a date range. The system MUST offer presets (last 7 days, last 30 days, last 90 days) and custom input.
* The default view SHOULD show the last 30 days at daily granularity.

How to verify:

1. The analyst sees that "Purchase Completed" events increased after a specific date by looking at the trend chart.
2. The unique users count for an event is lower than the total event count when some users performed the event multiple times.

---

### Tier 3 — MMP (Minimum Marketable Product)

#### BR-300: Numeric aggregations

The analyst can measure properties, not just count events.

* When events carry numeric properties (like amount or duration), the user MUST be able to aggregate by sum, average, minimum, and maximum.
* The system SHOULD detect which properties are numeric and offer appropriate options.
* The system MUST NOT offer numeric aggregations for non-numeric properties.

How to verify:

1. The analyst selects "Purchase Completed" and measures "sum of amount." The chart shows correct daily revenue totals.

#### BR-301: Comparative visualization

The analyst can see data in the format that best fits their question.

* The user SHOULD be able to switch between different chart types for the same data.
* The system SHOULD support at minimum: line chart, bar chart, and one additional type (area, pie, or data table).
* The system SHOULD choose sensible defaults. Line for time series. Pie only when showing proportions.

#### BR-302: Dimensional breakdown

The analyst can slice any analysis by a property.

* The user MUST be able to break down any analysis by a property value.
* Breakdowns MUST work with all available measures (counts, unique users, numeric aggregations).
* The system SHOULD limit breakdowns to the top values and group the rest.

How to verify:

1. The analyst breaks down "Page Viewed" by page. The chart shows separate series for the top pages.

#### BR-303: Funnel analysis

The growth manager can see where users drop off in a flow.

* The user MUST be able to define a sequence of 2 to 5 events.
* The system MUST compute the conversion rate between each consecutive pair and the overall rate.
* The results MUST be displayed visually, showing where users drop off.
* Funnels MUST use resolved identities. A user who performs step 1 anonymously and step 2 after login MUST count as one user.
* Step order MUST be respected by timestamp within the selected date range.

How to verify:

1. The growth manager builds a funnel: "Page Viewed" → "Signup Completed" → "Purchase Completed." A user who viewed the page anonymously and signed up with a known identity appears as one user, not a dropout.

#### BR-304: User profiles

The support lead can look up any user and see their full history.

* The user MUST be able to look up an individual by their identity.
* The profile MUST show all events attributed to this person, including anonymous events merged via identity resolution.
* The profile MUST display the identity cluster: all device identities and the user identity linked together.
* The profile SHOULD show first seen and last seen timestamps.

How to verify:

1. The support lead searches for "charlie@example.com" and sees events from both their phone (device A) and laptop (device B) in a single timeline.

#### BR-305: Typography and layout

The system uses a professional typographic hierarchy and spatial system.

* The application MUST use Inter as the primary font family. Load via `@fontsource/inter` or Google Fonts. Fallback: `-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`.
* Headings (page titles) MUST use Inter SemiBold (600) at 24px.
* Section headings MUST use Inter Medium (500) at 16px.
* Body text MUST use Inter Regular (400) at 14px.
* Small/secondary text (timestamps, labels, metadata) MUST use Inter Regular (400) at 12px with reduced opacity or a muted color.
* Monospace text (event names, property keys, device IDs, JSON) MUST use `"JetBrains Mono", "Fira Code", "Cascadia Code", monospace` at 13px.
* Line height MUST be 1.5 for body text and 1.3 for headings.
* The sidebar navigation MUST be 240px wide, fixed position, full height.
* Page content area MUST have 24px padding on all sides.
* Cards and panels MUST have 16px internal padding and 8px border-radius.
* Spacing between sections MUST use an 8px grid (8, 16, 24, 32, 48px).
* Tables MUST have 12px vertical padding and 16px horizontal padding per cell.
* Tables MUST alternate row backgrounds for readability (use `fafafa` / `ffffff` in light, `1a1a2e` / `16162a` in dark).

#### BR-306: Color system and theming

The system supports light and dark themes with a controlled palette.

* The application MUST support both light and dark themes with a user-accessible toggle.
* The toggle MUST persist the choice to localStorage and default to the OS preference on first load.
* Light theme base colors:
  - Background: `#ffffff`
  - Surface (cards, panels): `#f9fafb`
  - Border: `#e5e7eb`
  - Primary text: `#111827`
  - Secondary text: `#6b7280`
  - Primary accent: `#7c3aed` (violet-600)
* Dark theme base colors:
  - Background: `#0f0f1a`
  - Surface: `#1a1a2e`
  - Border: `#2d2d44`
  - Primary text: `#e5e7eb`
  - Secondary text: `#9ca3af`
  - Primary accent: `#a78bfa` (violet-400)
* Interactive elements (buttons, links, selected states) MUST use the primary accent color.
* Hover states MUST shift the accent by one shade lighter.
* The color palette for chart series MUST use exactly these 8 colors in order: `#7c3aed`, `#2563eb`, `#0891b2`, `#059669`, `#ca8a04`, `#ea580c`, `#dc2626`, `#9333ea`. In dark mode: `#a78bfa`, `#60a5fa`, `#22d3ee`, `#34d399`, `#fbbf24`, `#fb923c`, `#f87171`, `#c084fc`.
* Success states MUST use green (`#059669` light / `#34d399` dark).
* Error states MUST use red (`#dc2626` light / `#f87171` dark).
* Warning states MUST use amber (`#d97706` light / `#fbbf24` dark).

#### BR-307: Chart and data visualization standards

Charts are clear, labeled, and readable at a glance.

* All charts MUST include an x-axis label and a y-axis label.
* Time-series x-axes MUST format dates as "MMM D" (e.g., "Jan 5") for daily and "MMM D–D" for weekly.
* Y-axes MUST use abbreviated numbers: 1,000 → "1K", 1,000,000 → "1M".
* Y-axes MUST start at zero unless all values are far from zero (in which case, the axis break MUST be visually indicated).
* Chart tooltips MUST appear on hover and show: the exact value, the date, and the series name.
* Tooltips MUST use a dark background with white text, 8px border-radius, and a subtle shadow.
* Line charts MUST use 2px stroke width with 4px circle markers on data points.
* Area charts MUST use 10% opacity fill under the line.
* Bar charts MUST have 4px border-radius on top corners.
* Funnel charts MUST show the percentage drop between each step and the absolute count.
* Funnel bars MUST use a gradient from the accent color (first step) fading to a muted color (last step).
* Pie/donut charts MUST show the percentage label inside or adjacent to each segment. Segments below 5% MUST be grouped into "Other".
* Legend items MUST use a 12px circle swatch next to the series name, not a line or square.
* Charts with no data MUST show a centered empty state: a muted icon and the text "No data for the selected range" — never a blank canvas.
* Charts in loading state MUST show a skeleton placeholder matching the chart's approximate shape (not a spinner).

#### BR-308: Empty states, loading, and errors

Every view handles missing data, loading, and failure gracefully.

* Every data-dependent view MUST have three states: loading, empty, and error.
* Loading: skeleton placeholders that match the layout shape. No spinners except in buttons.
* Empty: centered illustration or icon + descriptive text + suggested action (e.g., "No events yet. Send your first event via the API."). MUST NOT be a blank white/dark page.
* Error: red-tinted banner at the top of the content area with the error summary. MUST NOT show raw stack traces, JSON error objects, or `undefined`.
* Form validation errors MUST appear inline below the field, not as alerts or toasts.
* Network errors MUST offer a retry action.

---

### Tier 4 — Nice to Have

**BR-400: Saved analyses** — The analyst MAY save an Insights query or funnel with a name and reload it later.

**BR-401: Input assistance** — Event and property selectors MAY support search and autocomplete.

**BR-402: Multi-event comparison** — The analyst MAY place multiple event types on the same chart.

---

## Hard Constraints

* The system MUST run locally on a single machine.
* The system MUST start with a single documented command.
* The system MUST NOT require external API keys, paid services, or third-party accounts.
* The system MUST NOT require user authentication.
* The codebase MUST include at least one automated test that verifies identity resolution.

## Success Criteria

1. Clone → README → one command → working app with sample data.
2. Send event via API → find it in explorer.
3. Trend chart shows identity-resolved unique user counts correctly.
4. Funnel correctly attributes anonymous-then-identified user as one person.
5. User profile shows cross-device event history.
6. Toggle light/dark mode — all charts, tables, and text remain readable.
7. Every chart shows tooltip on hover with exact values.
8. Every empty view shows a descriptive empty state, not a blank page.
