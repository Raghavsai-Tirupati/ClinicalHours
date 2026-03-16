import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when user is typing in inputs, textareas, or contenteditable elements
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        (target.tagName === "BUTTON" && target.getAttribute("type") !== "button")
      ) {
        return;
      }

      shortcuts.forEach((shortcut) => {
        const matchesKey = e.key === shortcut.key || e.key.toLowerCase() === shortcut.key.toLowerCase();
        const matchesCtrl = shortcut.ctrlKey === undefined ? true : e.ctrlKey === shortcut.ctrlKey;
        const matchesShift = shortcut.shiftKey === undefined ? true : e.shiftKey === shortcut.shiftKey;
        const matchesAlt = shortcut.altKey === undefined ? true : e.altKey === shortcut.altKey;

        if (matchesKey && matchesCtrl && matchesShift && matchesAlt) {
          e.preventDefault();
          shortcut.action();
        }
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [shortcuts]);
}

// Common keyboard shortcuts for the app
export function useAppKeyboardShortcuts() {
  const navigate = useNavigate();

  useKeyboardShortcuts([
    {
      key: "/",
      action: () => {
        // Focus search input if available
        const searchInput = document.querySelector('input[type="text"][placeholder*="Search"], input[placeholder*="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      },
      description: "Focus search",
    },
    {
      key: "Escape",
      action: () => {
        // Close any open dialogs/modals
        const closeButtons = document.querySelectorAll('[aria-label*="Close"], [aria-label*="close"], button[aria-label*="Cancel"]');
        const lastCloseButton = Array.from(closeButtons).pop() as HTMLElement;
        if (lastCloseButton) {
          lastCloseButton.click();
        }
      },
      description: "Close dialog/modal",
    },
    {
      key: "h",
      ctrlKey: true,
      action: () => navigate("/"),
      description: "Go to home",
    },
    {
      key: "d",
      ctrlKey: true,
      action: () => navigate("/dashboard"),
      description: "Go to dashboard",
    },
    {
      key: "o",
      ctrlKey: true,
      action: () => navigate("/opportunities"),
      description: "Go to opportunities",
    },
    {
      key: "p",
      ctrlKey: true,
      action: () => navigate("/settings"),
      description: "Go to settings",
    },
  ]);
}

