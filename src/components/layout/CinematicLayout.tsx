import { ReactNode } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";

interface CinematicLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export default function CinematicLayout({ title, subtitle, children }: CinematicLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-background relative overflow-hidden">
      {/* Cinematic gradient mesh background */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-violet-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(120,119,198,0.08),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(59,130,246,0.06),transparent_50%)]" />
        {/* Subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <Navigation />

      <main className="flex-1 relative z-10 pt-24 pb-12">
        <div className="container mx-auto px-4">
          {/* Stage panel */}
          <div className="max-w-6xl mx-auto">
            <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm shadow-lg overflow-hidden">
              {/* Stage header */}
              <div className="border-b border-border/40 bg-card/80 px-6 py-5">
                <h1 className="text-2xl font-bold text-foreground font-heading">{title}</h1>
                {subtitle && (
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>

              {/* Stage content */}
              <div className="p-6">{children}</div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
