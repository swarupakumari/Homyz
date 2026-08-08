import React from "react";
import { motion } from "framer-motion";

const dotTransition = (delay) => ({
  duration: 0.9,
  repeat: Infinity,
  delay,
  ease: "easeInOut",
});

// "AI is thinking" bubble shown between the user's message and the
// assistant's reply while the request is in flight.
const TypingIndicator = () => (
  <div className="ai-typing-indicator" role="status" aria-label="AI is thinking">
    {[0, 0.15, 0.3].map((delay, i) => (
      <motion.span
        key={i}
        animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
        transition={dotTransition(delay)}
      />
    ))}
  </div>
);

export default TypingIndicator;
