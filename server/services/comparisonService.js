// Deterministic, LLM-free comparison across the top-ranked search results.
//
// Input is exactly what the existing Recommendation Engine already
// produced (server/services/recommendationService.js's `scoreProperties`:
// { score, reasons, property }, sorted descending by score) — this service
// never re-scores, re-ranks, or re-queries anything. It only picks labeled
// winners from data that's already fully decided.

const TOP_N = 5;

const priceOf = (entry) => entry.property.price;
const bedroomsOf = (entry) => Number(entry.property.facilities?.bedrooms) || 0;

const pickMax = (entries, valueFn) =>
  entries.reduce((best, entry) => (valueFn(entry) > valueFn(best) ? entry : best), entries[0]);

const pickMin = (entries, valueFn) =>
  entries.reduce((best, entry) => (valueFn(entry) < valueFn(best) ? entry : best), entries[0]);

// Compares the top 5 already-ranked results and labels five winners:
//  - overallBest:     rank #1 by score (the Recommendation Engine's own order)
//  - bestValue:        highest score-per-rupee among the top 5
//  - luxuryChoice:      highest price among the top 5
//  - mostAffordable:    lowest price among the top 5
//  - bestFamilyHome:    most bedrooms among the top 5 (ties favor the higher-scored one,
//                       since `rankedResults` is already sorted by score and reduce()
//                       keeps the first entry on a tie)
export const compareTopProperties = (rankedResults) => {
  const top5 = rankedResults.slice(0, TOP_N);

  if (top5.length === 0) {
    return {
      top5: [],
      overallBest: null,
      bestValue: null,
      luxuryChoice: null,
      mostAffordable: null,
      bestFamilyHome: null,
    };
  }

  const overallBest = top5[0];
  const bestValue = pickMax(top5, (entry) => (priceOf(entry) > 0 ? entry.score / priceOf(entry) : 0));
  const luxuryChoice = pickMax(top5, priceOf);
  const mostAffordable = pickMin(top5, priceOf);
  const bestFamilyHome = pickMax(top5, bedroomsOf);

  return { top5, overallBest, bestValue, luxuryChoice, mostAffordable, bestFamilyHome };
};
