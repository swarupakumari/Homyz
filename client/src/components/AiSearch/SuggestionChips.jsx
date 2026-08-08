import React from "react";

const SUGGESTIONS = [
  { emoji: "🏡", label: "Apartments under ₹80 lakh", prompt: "Apartments under ₹80 lakh" },
  { emoji: "🏠", label: "3 Bedroom Houses", prompt: "3 bedroom houses" },
  { emoji: "🐶", label: "Pet Friendly Homes", prompt: "Pet friendly homes" },
  { emoji: "🏊", label: "Swimming Pool", prompt: "Homes with a swimming pool" },
  { emoji: "🚗", label: "Parking", prompt: "Homes with parking" },
  { emoji: "📍", label: "Near City Center", prompt: "Homes near the city center" },
];

// Quick-action prompts shown before the user has typed anything, so a new
// user immediately sees what kind of requests the AI search understands.
const SuggestionChips = ({ onSelect, disabled }) => (
  <div className="ai-suggestion-chips" role="group" aria-label="Suggested searches">
    {SUGGESTIONS.map(({ emoji, label, prompt }) => (
      <button
        key={label}
        type="button"
        className="ai-suggestion-chip"
        onClick={() => onSelect(prompt)}
        disabled={disabled}
      >
        <span aria-hidden="true">{emoji}</span> {label}
      </button>
    ))}
  </div>
);

export default SuggestionChips;
