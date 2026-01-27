import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocation } from "react-router-dom";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  // Theme is permanently set to dark mode - no toggle needed
  // Keeping this component for potential future use
  return null;
}

