/** Debounced symbol search; network transport is delegated to marketService. */
import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeInput } from "../lib/utils";
import { searchSymbols } from "../services/marketService";

export function useStockSearch() {
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const timer = useRef(null);

  const runSearch = useCallback(value => {
    const term = normalizeInput(value);
    setInput(value);
    clearTimeout(timer.current);
    if (term.length < 2) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const data = await searchSymbols(term);
        setSuggestions(data.results || []);
      } catch {
        setSuggestions([]);
      }
    }, 250);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  const searchNow = useCallback(async value => {
    const term = normalizeInput(value);
    if (term.length < 2) {
      setSuggestions([]);
      return [];
    }
    try {
      const data = await searchSymbols(term);
      const results = data.results || [];
      setSuggestions(results);
      return results;
    } catch {
      setSuggestions([]);
      return [];
    }
  }, []);

  const clearSearch = useCallback(() => {
    setInput("");
    setSuggestions([]);
  }, []);

  return { input, suggestions, runSearch, searchNow, clearSearch };
}
