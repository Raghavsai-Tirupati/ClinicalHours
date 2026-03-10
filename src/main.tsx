import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// @ts-ignore - font packages have no type declarations
import "@fontsource-variable/inter";
// @ts-ignore
import "@fontsource-variable/dm-sans";
// @ts-ignore
import "@fontsource-variable/plus-jakarta-sans";
// @ts-ignore
import "@fontsource-variable/geist-mono";

createRoot(document.getElementById("root")!).render(<App />);
