/**
 * Shared accessibility behavior for modal dialogs.
 *
 * Handles what every modal needs and previously implemented ad hoc or not at all:
 * - Escape closes the dialog
 * - Focus moves into the dialog when it opens
 * - Tab/Shift+Tab is trapped inside the dialog while it is open
 * - Focus returns to the element that opened the dialog when it closes
 * - Background page scroll is suspended while the dialog is open
 */
import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function useModalA11y(active, onClose) {
  const containerRef = useRef(null);
  const previouslyFocused = useRef(null);

  useEffect(() => {
    if (!active) return;

    previouslyFocused.current = document.activeElement;

    const focusables = () =>
      Array.from(containerRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) ?? []);

    // Move focus into the dialog on open so keyboard/screen-reader users land
    // somewhere meaningful instead of the page continuing to hold focus.
    const initial = focusables()[0];
    (initial ?? containerRef.current)?.focus();

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = e => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose?.();
        return;
      }
      if (e.key !== "Tab") return;

      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = originalOverflow;
      // Return focus to whatever opened the dialog (e.g. the card's detail button).
      if (previouslyFocused.current instanceof HTMLElement) {
        previouslyFocused.current.focus();
      }
    };
  }, [active, onClose]);

  return containerRef;
}
