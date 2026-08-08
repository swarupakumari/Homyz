import React from "react";
import { BsRobot } from "react-icons/bs";
import "./AiSearch.css";

// Floating entry point for the AI Search modal. Hidden while the modal is
// open so it doesn't sit on top of it.
const AiSearchButton = ({ isOpen, onClick }) => {
  if (isOpen) return null;

  return (
    <button
      type="button"
      className="ai-search-button"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label="Open AI property search"
    >
      <span className="ai-search-button-ring" aria-hidden="true" />
      <BsRobot size={20} aria-hidden="true" />
      <span className="ai-search-button-label">Ask AI</span>
    </button>
  );
};

export default AiSearchButton;
