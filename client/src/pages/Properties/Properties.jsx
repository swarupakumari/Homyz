import React, { useState } from "react";
import SearchBar from "../../components/SearchBar/SearchBar";
import "./Properties.css";
import usePropperties from "../../hooks/usePropperties";
import { PuffLoader } from "react-spinners";
import PropertyCard from "../../components/PropertyCard/PropertyCard";
import { property } from "lodash";

const Properties = () => {
  const { data, isError, isLoading } = usePropperties();
  const [filter, setFilter] = useState("");
  console.log(data);

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
          {
            //data.map((card, i) => (<PropertyCard card={card} key={i}></PropertyCard>))

            data
              .filter(
                (property) =>
                  property.title
                    .toLowerCase()
                    .includes(filter.toLocaleLowerCase()) ||
                  property.city
                    .toLowerCase()
                    .includes(filter.toLocaleLowerCase()) ||
                  property.country
                    .toLowerCase()
                    .includes(filter.toLocaleLowerCase())
              )
              .map((card, i) => (
                <PropertyCard card={card} key={i}></PropertyCard>
              ))
          }
        </div>
      </div>
    </div>
  );
};

export default Properties;
