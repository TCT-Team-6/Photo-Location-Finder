# Published sample analytics verification

Checked on 2026-11-03 at approximately 09:00 UTC, after the owner confirmed
republishing with analytics enabled. This is a snapshot of real aggregate
production reporting, not a local tracker mock or UI-test result.

## Deployment and access

- `checkProjectAnalyticsAccess()` returned `access: authorized`.
- `getDeploymentInfo()` returned `success: true`, `isDeployed: true`,
  `hasSuccessfulBuild: true`, `visibility: public`.
- Published URL: https://photo-location-finder-v-3.replit.app
- No publish, production configuration change, synthetic event submission, or
  personal-data collection was performed during this verification.

## Observed report

Read-only `queryAppAnalytics` queries covered the trailing seven days. The root
Whereabouts artifact was selected, excluding the slide artifact's
`/whereabouts-project-deck` path and children.

| Event | Collected occurrences | Custom property rows | Unexpected property rows |
| --- | ---: | ---: | ---: |
| `demo_sample_open` | 3 | 3 | 0 |
| `demo_sample_run` | 3 | 3 | 0 |

Both events had exactly one reported custom property key: `scenario_id`, stored
as a string (`data_type = 1`). No other custom property keys or unrecognized
scenario values were returned.

| Fixed scenario ID | Open occurrences | Run occurrences |
| --- | ---: | ---: |
| `sample-child-separated` | 1 | 0 |
| `sample-grandparent` | 1 | 2 |
| `sample-lost-hiker` | 1 | 1 |

All three fixed identifiers are distinguishable in collected open events.
Both event names have reached production reporting. A child-separated run was
not present in this snapshot; this report does not claim that all three
scenario/event combinations have been exercised.

## Privacy scope

The two call sites in
`artifacts/whereabouts/src/components/demo-experience.tsx` pass only
`{ scenario_id: sample.investigation.id }`. Their source is the fixed fictional
records loaded by `artifacts/whereabouts/src/lib/demo-samples.ts`, rather than
user input. The shared wrapper in `artifacts/whereabouts/src/lib/analytics.ts`
forwards that payload without adding custom properties.

The recorded custom properties contain no names, uploaded photos, coordinates,
free-form text, or personal case content. This conclusion concerns these two
events' custom payloads, not the analytics platform's automatic pageview or
client metadata.

## Reproducible delivery check

Read the `project-analytics` skill and its query reference before repeating.
Check analytics access first. These read-only queries verify server-side
collection rather than relying on a successful browser call to `track()`.

Event counts:

```sql
SELECT event_name, count() AS occurrences
FROM website_event
WHERE created_at >= now() - INTERVAL 7 DAY
  AND event_type = 2
  AND event_name IN ('demo_sample_open', 'demo_sample_run')
  AND NOT (
    url_path = '/whereabouts-project-deck'
    OR startsWith(url_path, '/whereabouts-project-deck/')
  )
GROUP BY event_name
ORDER BY event_name
LIMIT 2
```

Property audit (does not return unknown property values):

```sql
SELECT
  event_name,
  data_key,
  data_type,
  count() AS property_occurrences,
  countIf(
    data_key != 'scenario_id'
    OR data_type != 1
    OR ifNull(string_value, '') NOT IN (
      'sample-lost-hiker', 'sample-grandparent', 'sample-child-separated'
    )
  ) AS unexpected_properties,
  groupUniqArrayIf(3)(
    string_value,
    data_key = 'scenario_id'
    AND string_value IN (
      'sample-lost-hiker', 'sample-grandparent', 'sample-child-separated'
    )
  ) AS known_scenario_ids
FROM event_data
WHERE created_at >= now() - INTERVAL 7 DAY
  AND event_name IN ('demo_sample_open', 'demo_sample_run')
  AND NOT (
    url_path = '/whereabouts-project-deck'
    OR startsWith(url_path, '/whereabouts-project-deck/')
  )
GROUP BY event_name, data_key, data_type
ORDER BY event_name, data_key
LIMIT 20
```

Known scenario breakdown:

```sql
SELECT event_name, string_value AS scenario_id, count() AS occurrences
FROM event_data
WHERE created_at >= now() - INTERVAL 7 DAY
  AND event_name IN ('demo_sample_open', 'demo_sample_run')
  AND data_key = 'scenario_id'
  AND data_type = 1
  AND string_value IN (
    'sample-lost-hiker', 'sample-grandparent', 'sample-child-separated'
  )
  AND NOT (
    url_path = '/whereabouts-project-deck'
    OR startsWith(url_path, '/whereabouts-project-deck/')
  )
GROUP BY event_name, string_value
ORDER BY event_name, scenario_id
LIMIT 6
```

No new browser pass was needed: the owner exercised the published app and the
production aggregate results directly establish event ingestion. Local tests
cannot substitute for this check. Future sample-flow regression work is already
covered by the existing queued task; no overlapping follow-up was proposed.
