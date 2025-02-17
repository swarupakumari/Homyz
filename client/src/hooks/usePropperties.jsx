import React from "react";
import { useQuery } from "react-query";
import { getAllProperties } from "../utils/api";

const usePropperties = () => {
  const { data, isError, isLoading, refetch } = useQuery(
    "allProperties",
    getAllProperties,
    { refetchOnWindowFocus: false }
  );

  // Exclude property with ID "67b20502979dea1763c186cb"
  const filteredData = data
    ? data.filter((prop) => prop.id !== "67b20502979dea1763c186cb")
    : [];

  return {
    data: filteredData, // Return filtered data
    isError,
    isLoading,
    refetch,
  };
};

export default usePropperties;
