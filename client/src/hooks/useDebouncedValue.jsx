import { useEffect, useState } from "react";

// Delays updating the returned value until `value` has stopped changing
// for `delay` ms — used to avoid firing a network request on every keystroke.
const useDebouncedValue = (value, delay = 400) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeoutId);
  }, [value, delay]);

  return debouncedValue;
};

export default useDebouncedValue;
