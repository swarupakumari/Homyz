import { useQuery } from "react-query";
import { searchProperties } from "../utils/api";

// Backend-driven property search (replaces fetch-all + Array.filter).
// `filters` may include: city, country, minPrice, maxPrice, bedrooms,
// bathrooms, keyword. The query key includes filters so each distinct
// filter combination is cached/refetched independently.
const useSearchProperties = (filters = {}) => {
  const { data, isError, isLoading, refetch } = useQuery(
    ["searchProperties", filters],
    () => searchProperties(filters),
    { refetchOnWindowFocus: false, keepPreviousData: true }
  );

  return {
    data: data?.data ?? [],
    total: data?.total ?? 0,
    isError,
    isLoading,
    refetch,
  };
};

export default useSearchProperties;
