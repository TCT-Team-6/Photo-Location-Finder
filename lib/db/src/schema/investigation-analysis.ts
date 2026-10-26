/** Sanitized, optional metadata reported by Image Locator; not independent verification. */
export type InvestigationAnalysis = {
  media_type?: "video" | "image";
  video?: {
    duration_s?: number;
    fps?: number;
    frames_analyzed?: number;
    embedded_gps?: { latitude: number; longitude: number };
  };
  contributing_frames?: {
    index?: number;
    timestamp_s?: number;
    candidates?: string[];
    clues_found?: boolean;
  }[];
  latitude?: number;
  longitude?: number;
  map_url?: string;
  address?: string;
  confidence?: number;
  source?: string;
  verified?: string;
  warning?: string;
  meets_defined_radius?: boolean;
  defined_radius_km?: number;
  precision_m?: number;
  elevation_m?: number;
  search_areas?: {
    rank?: number;
    name?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    search_radius_km?: number;
    score?: number;
    map_status?: string;
  }[];
  rejected?: { name?: string; reason?: string }[];
  nearby_places?: { title?: string; distance_km?: number }[];
  forensics?: {
    has_gps?: boolean;
    authenticity?: string;
    edited?: boolean;
    is_screenshot?: boolean;
    metadata_stripped?: boolean;
    notes?: string[];
  };
  reasoning_trace?: {
    stage?: string;
    details?: string[];
    step?: string;
    detail?: string;
  }[];
  details?: { exif?: { timestamp?: string } };
};
