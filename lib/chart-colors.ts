/**
 * Fixed-order categorical palette, validated for CVD-safe adjacent contrast
 * (see the dataviz skill). Assign by rank within a single chart (largest
 * slice gets slot 1, etc.) -- the palette's fixed order is only guaranteed
 * distinct across adjacent slots, not across an unbounded number of ids, so
 * hashing a category id into these 8 buckets collides well before 8
 * categories are on screen.
 */
export const CATEGORICAL_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

/** Muted gray for a rolled-up "Other" slice — never one of the series hues. */
export const OTHER_SLICE_COLOR = "#898781";
