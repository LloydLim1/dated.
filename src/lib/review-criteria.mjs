export const CRITERIA = {
  Café: [
    "Food & drinks",
    "Service",
    "Ambiance & comfort",
    "Cleanliness",
    "Value for money",
  ],
  Restaurant: [
    "Food & drinks",
    "Service",
    "Ambiance & comfort",
    "Cleanliness",
    "Value for money",
  ],
  Museum: [
    "Exhibits",
    "Presentation",
    "Educational value",
    "Accessibility & comfort",
    "Value for money",
  ],
  Cinema: [
    "Screen quality",
    "Sound quality",
    "Seating comfort",
    "Cleanliness",
    "Value for money",
  ],
};
export const LEGACY_CRITERIA = {
  Café: ["Coffee & drinks", "Atmosphere", "Service", "Value"],
  Restaurant: ["Food", "Atmosphere", "Service", "Value"],
  Museum: ["Exhibits", "Accessibility", "Experience", "Value"],
  Cinema: ["Picture & sound", "Comfort", "Cleanliness", "Value"],
};
export const CRITERION_IDS = {
  "Food & drinks": "food_drinks",
  Service: "service",
  "Ambiance & comfort": "ambiance_comfort",
  Cleanliness: "cleanliness",
  "Value for money": "value_money",
  Exhibits: "exhibits",
  Presentation: "presentation",
  "Educational value": "educational_value",
  "Accessibility & comfort": "accessibility_comfort",
  "Screen quality": "screen_quality",
  "Sound quality": "sound_quality",
  "Seating comfort": "seating_comfort",
};
export function criteriaVersion(category, ratings, notApplicable = []) {
  const keys = Object.keys(ratings);
  const active = CRITERIA[category];
  if (
    !active ||
    keys.length < 1 ||
    keys.length + notApplicable.length > 5 ||
    new Set([...keys, ...notApplicable]).size !==
      keys.length + notApplicable.length
  )
    return 0;
  if (
    !Object.values(ratings).every(
      (value) => Number.isInteger(value) && value >= 1 && value <= 5,
    )
  )
    return 0;
  if (
    active.every((key) => keys.includes(key) || notApplicable.includes(key)) &&
    [...keys, ...notApplicable].every((key) => active.includes(key))
  )
    return 2;
  const legacy = LEGACY_CRITERIA[category];
  if (
    !notApplicable.length &&
    keys.length === legacy.length &&
    legacy.every((key) => keys.includes(key))
  )
    return 1;
  return 0;
}
