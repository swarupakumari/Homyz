import React from "react";
import "./GetStarted.css";

export const GetStarted = () => {
  return (
    <section className="g-wrapper">
      <div className="paddings innerWidth g-container">
        <div className="flexColCenter inner-container">
          <span className="primaryText">Get started with Homyz</span>
          <span className="secodaryText">
            Subscribe and find super attractive price quotes from us.
            <br />
            Find your residence soon
          </span>
          <span>
            <button className="button">
              <a href="mailto:swarupakumari126@gmail.com">Get Started</a>
            </button>
          </span>
        </div>
      </div>
    </section>
  );
};
