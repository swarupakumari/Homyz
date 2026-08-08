// Deterministic scoring rules for the Recommendation Engine. Every
// function here is a pure function of (filters, property) — no LLM
// involved anywhere in this file, per Sprint 3's requirement that ranking
// must never be delegated to a model.
//
// Each scorer returns:
//   { applicable, matched, weight, reasons }
// - applicable: whether this criterion could be evaluated at all (the
//   user specified the relevant filter AND the property has the relevant
//   data). If not applicable, it contributes no points and is excluded
//   from the denominator when normalizing the final percentage.
// - matched:    whether the property actually satisfies the criterion.
// - reasons:    human-readable strings, only ever added when matched is
//   true and drawn directly from real property/filter values — never
//   fabricated.
export const WEIGHTS = {
  budget: 35,
  bedrooms: 20,
  bathrooms: 10,
  city: 15,
  amenities: 20,
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const isNonEmptyString = (value) =>
  typeof value === "string" && value.trim().length > 0;

// Budget Match
export const scoreBudget = (filters, property) => {
  const { minPrice, maxPrice } = filters;
  const weight = WEIGHTS.budget;

  if (minPrice === undefined && maxPrice === undefined) {
    return { applicable: false, matched: false, weight, reasons: [] };
  }

  const price = toNumber(property.price);
  if (price === null) {
    return { applicable: false, matched: false, weight, reasons: [] };
  }

  const withinMin = minPrice === undefined || price >= minPrice;
  const withinMax = maxPrice === undefined || price <= maxPrice;
  const matched = withinMin && withinMax;

  return {
    applicable: true,
    matched,
    weight,
    reasons: matched ? ["Within your budget"] : [],
  };
};

// Bedroom Match
export const scoreBedrooms = (filters, property) => {
  const weight = WEIGHTS.bedrooms;

  if (filters.bedrooms === undefined) {
    return { applicable: false, matched: false, weight, reasons: [] };
  }

  const actual = toNumber(property.facilities?.bedrooms);
  if (actual === null) {
    return { applicable: false, matched: false, weight, reasons: [] };
  }

  const matched = actual === toNumber(filters.bedrooms);
  return {
    applicable: true,
    matched,
    weight,
    reasons: matched ? ["Matches requested bedrooms"] : [],
  };
};

// Bathroom Match
export const scoreBathrooms = (filters, property) => {
  const weight = WEIGHTS.bathrooms;

  if (filters.bathrooms === undefined) {
    return { applicable: false, matched: false, weight, reasons: [] };
  }

  const actual = toNumber(property.facilities?.bathrooms);
  if (actual === null) {
    return { applicable: false, matched: false, weight, reasons: [] };
  }

  const matched = actual === toNumber(filters.bathrooms);
  return {
    applicable: true,
    matched,
    weight,
    reasons: matched ? ["Matches requested bathrooms"] : [],
  };
};

// City Match
export const scoreCity = (filters, property) => {
  const weight = WEIGHTS.city;

  if (!isNonEmptyString(filters.city) || !isNonEmptyString(property.city)) {
    return { applicable: false, matched: false, weight, reasons: [] };
  }

  const matched = property.city
    .toLowerCase()
    .includes(filters.city.toLowerCase());

  return {
    applicable: true,
    matched,
    weight,
    reasons: matched ? ["Located in requested city"] : [],
  };
};

// Keyword Match + Amenities Match share one weighted bucket: the Residency
// schema has no dedicated "amenities" field beyond `facilities.parking`
// (also seen written as `facilities.parkings` on some records — real,
// pre-existing data inconsistency, not a typo), and free-text keyword
// matching is the only other amenity-like signal available. Both checks
// are still evaluated independently and can each contribute their own
// reason string, but the bucket's weight is only ever awarded once.
export const scoreAmenities = (filters, property) => {
  const weight = WEIGHTS.amenities;
  const reasons = [];
  let applicable = false;
  let matched = false;

  if (isNonEmptyString(filters.keyword)) {
    applicable = true;
    const haystack = [property.title, property.description, property.address]
      .filter(isNonEmptyString)
      .join(" ")
      .toLowerCase();
    if (haystack.includes(filters.keyword.toLowerCase())) {
      matched = true;
      reasons.push(`Matches your search for "${filters.keyword}"`);
    }
  }

  const parking = property.facilities?.parking ?? property.facilities?.parkings;
  const hasParking =
    parking !== undefined && parking !== null && Number(parking) > 0;
  if (hasParking) {
    applicable = true;
    matched = true;
    reasons.push("Parking available");
  }

  return { applicable, matched, weight, reasons };
};

export const SCORERS = [
  scoreBudget,
  scoreBedrooms,
  scoreBathrooms,
  scoreCity,
  scoreAmenities,
];
