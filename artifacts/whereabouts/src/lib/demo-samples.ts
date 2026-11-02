import type { Investigation } from "@workspace/api-client-react";

export type DemoSample = {
  scenario: string;
  imageUrl: string;
  sourceImageUrl: string;
  investigation: Investigation;
};

const mapsUrl = (latitude: number, longitude: number) =>
  `https://www.google.com/maps/search/?api=1&query=${latitude}%2C${longitude}`;

const sampleWarning =
  "Fictional demonstration data. This result describes scenery in the sample photograph; it does not locate or verify a person.";

const sampleBasePath = import.meta.env?.BASE_URL ?? "/";
const createdAt = "2026-08-01T12:00:00.000Z";

export const demoSamples: DemoSample[] = [
  {
    scenario: "Lost hiker",
    imageUrl: `${sampleBasePath}demo-samples/lost-hiker.jpg`,
    sourceImageUrl:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b",
    investigation: {
      id: "sample-lost-hiker",
      title: "Mountain valley trail",
      desk: "original",
      originalName: "mountain-valley-sample.jpg",
      contentType: "image/jpeg",
      context:
        "Fictional scenario: a hiking group is trying to identify the landscape in a trail photograph. The sample only demonstrates scenery-based location research.",
      shotAt: null,
      summary:
        "A broad alpine valley with snow-covered peaks, dense conifers, and a pale braided river. These visual features form a fictional location-search example.",
      status: "done",
      candidates: [
        {
          place: "Chugach State Park",
          region: "Alaska",
          country: "United States",
          confidence: 0.82,
          rationale:
            "The broad glacial valley, forested slopes, and high mountain skyline are a plausible visual match in this fictional example.",
          clues: ["Alpine ridgeline", "Conifer forest", "Braided valley floor"],
          mapsUrl: mapsUrl(61.108, -149.683),
        },
        {
          place: "Banff National Park",
          region: "Alberta",
          country: "Canada",
          confidence: 0.68,
          rationale:
            "The mountain scale and evergreen-covered lower slopes resemble several valleys in the Canadian Rockies.",
          clues: ["Snow-capped peaks", "Evergreen slopes"],
          mapsUrl: mapsUrl(51.1784, -115.5708),
        },
        {
          place: "Fiordland National Park",
          region: "Southland",
          country: "New Zealand",
          confidence: 0.53,
          rationale:
            "The steep forested terrain and distant high peaks are a secondary landscape comparison.",
          clues: ["Steep valley walls", "Mountain skyline"],
          mapsUrl: mapsUrl(-45.414, 167.718),
        },
      ],
      clues: [
        {
          label: "Snow-covered ridgeline",
          observation:
            "Several high, snow-covered peaks form a continuous skyline beyond the valley.",
          significance:
            "A high alpine setting is more likely than a lowland or coastal trail.",
        },
        {
          label: "Dense conifer forest",
          observation:
            "Dark evergreen forest covers the lower slopes and valley edges.",
          significance:
            "The vegetation is consistent with a cool mountain environment.",
        },
        {
          label: "Braided valley floor",
          observation:
            "A pale, winding channel crosses the broad valley in the distance.",
          significance:
            "The open glacial-valley shape is a useful landscape feature to compare.",
        },
      ],
      analysis: {
        media_type: "image",
        latitude: 61.108,
        longitude: -149.683,
        map_url: mapsUrl(61.108, -149.683),
        confidence: 0.82,
        source: "Illustrative precomputed sample",
        verified: "Not independently verified",
        warning: sampleWarning,
        search_areas: [
          {
            rank: 1,
            name: "Chugach State Park",
            country: "United States",
            latitude: 61.108,
            longitude: -149.683,
            search_radius_km: 30,
            score: 0.82,
            map_status: "sample coordinates",
          },
          {
            rank: 2,
            name: "Banff National Park",
            country: "Canada",
            latitude: 51.1784,
            longitude: -115.5708,
            search_radius_km: 30,
            score: 0.68,
            map_status: "sample coordinates",
          },
          {
            rank: 3,
            name: "Fiordland National Park",
            country: "New Zealand",
            latitude: -45.414,
            longitude: 167.718,
            search_radius_km: 30,
            score: 0.53,
            map_status: "sample coordinates",
          },
        ],
      },
      createdAt,
      updatedAt: createdAt,
    },
  },
  {
    scenario: "Missing grandparent",
    imageUrl: `${sampleBasePath}demo-samples/grandparent.jpg`,
    sourceImageUrl:
      "https://images.unsplash.com/photo-1516483638261-f4dbaf036963",
    investigation: {
      id: "sample-grandparent",
      title: "Ligurian harbor town",
      desk: "original",
      originalName: "ligurian-harbor-sample.jpg",
      contentType: "image/jpeg",
      context:
        "Fictional scenario: relatives are reviewing a vacation photo to identify the town shown. The example searches for visible place features only; it does not track a person.",
      shotAt: null,
      summary:
        "Colorful homes rise above a rocky harbor, with a compact waterfront and Mediterranean coastline. The saved sample compares the visible townscape with nearby coastal villages.",
      status: "done",
      candidates: [
        {
          place: "Manarola",
          region: "Liguria",
          country: "Italy",
          confidence: 0.79,
          rationale:
            "The stacked waterfront buildings and steep rocky shoreline are the strongest fictional visual comparison.",
          clues: ["Colorful hillside homes", "Rocky harbor", "Mediterranean coast"],
          mapsUrl: mapsUrl(44.1073, 9.729),
        },
        {
          place: "Vernazza",
          region: "Liguria",
          country: "Italy",
          confidence: 0.69,
          rationale:
            "The compact harbor and dense village buildings are similar coastal features.",
          clues: ["Compact harbor", "Hillside village"],
          mapsUrl: mapsUrl(44.1352, 9.6845),
        },
        {
          place: "Riomaggiore",
          region: "Liguria",
          country: "Italy",
          confidence: 0.61,
          rationale:
            "A nearby village with comparable colorful architecture and a narrow waterfront.",
          clues: ["Colorful architecture", "Narrow waterfront"],
          mapsUrl: mapsUrl(44.0998, 9.738),
        },
      ],
      clues: [
        {
          label: "Colorful hillside homes",
          observation:
            "Closely spaced, warm-colored buildings climb the slope above the water.",
          significance:
            "The dense hillside arrangement narrows the comparison to steep coastal settlements.",
        },
        {
          label: "Rocky harbor",
          observation:
            "A small waterfront is enclosed by exposed rock rather than a broad sandy beach.",
          significance:
            "The shoreline shape is a useful feature for comparing nearby villages.",
        },
        {
          label: "Mediterranean coastline",
          observation:
            "The scene shows a sheltered harbor opening onto blue coastal water.",
          significance:
            "The architecture and shoreline together suggest a Mediterranean setting.",
        },
      ],
      analysis: {
        media_type: "image",
        latitude: 44.1073,
        longitude: 9.729,
        map_url: mapsUrl(44.1073, 9.729),
        confidence: 0.79,
        source: "Illustrative precomputed sample",
        verified: "Not independently verified",
        warning: sampleWarning,
        search_areas: [
          {
            rank: 1,
            name: "Manarola",
            country: "Italy",
            latitude: 44.1073,
            longitude: 9.729,
            search_radius_km: 8,
            score: 0.79,
            map_status: "sample coordinates",
          },
          {
            rank: 2,
            name: "Vernazza",
            country: "Italy",
            latitude: 44.1352,
            longitude: 9.6845,
            search_radius_km: 8,
            score: 0.69,
            map_status: "sample coordinates",
          },
          {
            rank: 3,
            name: "Riomaggiore",
            country: "Italy",
            latitude: 44.0998,
            longitude: 9.738,
            search_radius_km: 8,
            score: 0.61,
            map_status: "sample coordinates",
          },
        ],
      },
      createdAt,
      updatedAt: createdAt,
    },
  },
  {
    scenario: "Child separated",
    imageUrl: `${sampleBasePath}demo-samples/child-separated.jpg`,
    sourceImageUrl:
      "https://images.unsplash.com/photo-1519331379826-f10be5486c6f",
    investigation: {
      id: "sample-child-separated",
      title: "Tree-lined city park",
      desk: "original",
      originalName: "tree-lined-park-sample.jpg",
      contentType: "image/jpeg",
      context:
        "Fictional scenario: a family is identifying a park from a landscape photo after becoming separated during an outing. This sample compares scenery only; it does not identify or locate a child.",
      shotAt: null,
      summary:
        "A paved path passes beneath mature trees beside an open lawn and park benches. The sample result compares these general park features with public urban parks.",
      status: "done",
      candidates: [
        {
          place: "Golden Gate Park",
          region: "California",
          country: "United States",
          confidence: 0.76,
          rationale:
            "The tree canopy, open lawns, and long walking paths are a plausible fictional comparison for a large urban park.",
          clues: ["Mature tree canopy", "Paved path", "Open lawn"],
          mapsUrl: mapsUrl(37.7694, -122.4862),
        },
        {
          place: "Stanley Park",
          region: "British Columbia",
          country: "Canada",
          confidence: 0.67,
          rationale:
            "The combination of mature trees and broad public walking paths also fits this park setting.",
          clues: ["Tree-lined walkway", "Public park landscape"],
          mapsUrl: mapsUrl(49.3043, -123.1443),
        },
        {
          place: "Luxembourg Gardens",
          region: "Paris",
          country: "France",
          confidence: 0.58,
          rationale:
            "A secondary comparison based on established park paths, mature trees, and benches.",
          clues: ["Park benches", "Established tree cover"],
          mapsUrl: mapsUrl(48.8462, 2.3372),
        },
      ],
      clues: [
        {
          label: "Tree-lined walkway",
          observation:
            "A broad paved path runs beneath a canopy of mature trees.",
          significance:
            "The path and canopy suggest a managed public park rather than a remote trail.",
        },
        {
          label: "Open lawn",
          observation:
            "A large grassy area opens on one side of the walkway.",
          significance:
            "The combination of open lawn and tree cover is common in urban parks.",
        },
        {
          label: "Park seating",
          observation:
            "A bench sits beside the path, with no readable signs or identifying text.",
          significance:
            "The furniture supports a public-park interpretation but is not unique to one location.",
        },
      ],
      analysis: {
        media_type: "image",
        latitude: 37.7694,
        longitude: -122.4862,
        map_url: mapsUrl(37.7694, -122.4862),
        confidence: 0.76,
        source: "Illustrative precomputed sample",
        verified: "Not independently verified",
        warning: sampleWarning,
        search_areas: [
          {
            rank: 1,
            name: "Golden Gate Park",
            country: "United States",
            latitude: 37.7694,
            longitude: -122.4862,
            search_radius_km: 10,
            score: 0.76,
            map_status: "sample coordinates",
          },
          {
            rank: 2,
            name: "Stanley Park",
            country: "Canada",
            latitude: 49.3043,
            longitude: -123.1443,
            search_radius_km: 10,
            score: 0.67,
            map_status: "sample coordinates",
          },
          {
            rank: 3,
            name: "Luxembourg Gardens",
            country: "France",
            latitude: 48.8462,
            longitude: 2.3372,
            search_radius_km: 10,
            score: 0.58,
            map_status: "sample coordinates",
          },
        ],
      },
      createdAt,
      updatedAt: createdAt,
    },
  },
];

export function getDemoSample(id: string | null | undefined) {
  return demoSamples.find((sample) => sample.investigation.id === id);
}
