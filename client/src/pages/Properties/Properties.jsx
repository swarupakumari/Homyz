import React, { useState } from "react";
import SearchBar from "../../components/SearchBar/SearchBar";
import "./Properties.css";
import useSearchProperties from "../../hooks/useSearchProperties";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { PuffLoader } from "react-spinners";
import PropertyCard from "../../components/PropertyCard/PropertyCard";

const Properties = () => {
  const [filter, setFilter] = useState("");
  const debouncedKeyword = useDebouncedValue(filter, 400);

  // Filtering now happens on the backend (GET /api/residency/search) instead
  // of downloading every property and running Array.filter in the browser.
  const { data, isError, isLoading } = useSearchProperties({
    keyword: debouncedKeyword,
  });

  if (isError) {
    return (
      <div className="wrapper">
        <span>Error while fetching data</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="wrapper flexCenter" style={{ height: "60vh" }}>
        <PuffLoader
          height="80"
          width="80"
          radius={1}
          color="#4066ff"
          aria-label="puff-loading"
        ></PuffLoader>
      </div>
    );
  }

  return (
    <div className="wrapper">
      <div className="flexColCenter paddings innerWidth properties-container">
        <SearchBar filter={filter} setFilter={setFilter}></SearchBar>
        <div className="paddings flexCenter properties">
          {data.map((card, i) => (
            <PropertyCard card={card} key={i}></PropertyCard>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Properties;
