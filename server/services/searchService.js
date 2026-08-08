import { prisma } from "../config/prismaConfig.js";

// Escapes regex metacharacters so user input can't break the $regex match
// or be used to inject an unintended pattern.
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const containsInsensitive = (value) => ({
  $regex: escapeRegex(value),
  $options: "i",
});

// Builds a native MongoDB match document from validated filter values.
// Kept separate from the query execution so it can be unit-tested on its own.
export const buildSearchFilter = ({
  city,
  country,
  minPrice,
  maxPrice,
  bedrooms,
  bathrooms,
  keyword,
} = {}) => {
  const match = {};

  if (city) match.city = containsInsensitive(city);
  if (country) match.country = containsInsensitive(country);

  if (minPrice !== undefined || maxPrice !== undefined) {
    match.price = {};
    if (minPrice !== undefined) match.price.$gte = minPrice;
    if (maxPrice !== undefined) match.price.$lte = maxPrice;
  }

  // `facilities` is stored as an untyped Json blob. Existing records are
  // inconsistent about whether bedrooms/bathrooms are saved as strings
  // ("4") or numbers (4), so match both representations — Mongo equality
  // is type-sensitive and would otherwise silently miss half the data.
  // Prisma also doesn't support JSON path filtering on the mongodb
  // connector, so these two fields are matched via a raw aggregation
  // instead of prisma.residency.findMany's `where`.
  if (bedrooms !== undefined) {
    match["facilities.bedrooms"] = { $in: [String(bedrooms), bedrooms] };
  }
  if (bathrooms !== undefined) {
    match["facilities.bathrooms"] = { $in: [String(bathrooms), bathrooms] };
  }

  if (keyword) {
    const regex = containsInsensitive(keyword);
    match.$or = [{ title: regex }, { description: regex }, { address: regex }];
  }

  return match;
};

// Raw Mongo documents come back in MongoDB Extended JSON shape
// (_id: {$oid}, createdAt: {$date}); normalize to the same shape the rest
// of the API (getAllResidencies/getResidency) already returns.
const normalizeResidency = (doc) => ({
  id: doc._id?.$oid ?? doc._id,
  title: doc.title,
  description: doc.description,
  price: doc.price,
  address: doc.address,
  city: doc.city,
  country: doc.country,
  image: doc.image,
  facilities: doc.facilities,
  userEmail: doc.userEmail,
  createdAt: doc.createdAt?.$date ?? doc.createdAt,
  updatedAt: doc.updatedAt?.$date ?? doc.updatedAt,
});

// Executes the search entirely at the database level: filtering, matching,
// and sorting all happen inside MongoDB's aggregation pipeline, so no
// full-collection scan into application memory ever occurs.
export const searchResidencies = async (filters) => {
  const match = buildSearchFilter(filters);

  const results = await prisma.residency.aggregateRaw({
    pipeline: [{ $match: match }, { $sort: { createdAt: -1 } }],
  });

  const data = results.map(normalizeResidency);

  return { data, total: data.length };
};
