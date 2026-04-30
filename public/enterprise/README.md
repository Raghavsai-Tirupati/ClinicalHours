# Enterprise demo assets

The `/enterprise` landing page renders a hero image and four demo video tiles. Each slot probes its public path on mount; if the file isn't there (or doesn't return the right `Content-Type`), it shows a styled placeholder. Drop the asset at the exact filename below and the placeholder is replaced on the next reload.

## File layout

| Path                                              | Where it appears                              | Type    | Notes               |
| ------------------------------------------------- | --------------------------------------------- | ------- | ------------------- |
| `/public/enterprise/hero-image.jpg`               | Hero, right column (4:5 portrait)             | Image   | Moody architectural |
| `/public/enterprise/applicant-tracking.mp4`       | Platform section, feature 1                   | Video   | 20–30s, silent      |
| `/public/enterprise/credentialing-automation.mp4` | Platform section, feature 2 (centerpiece)     | Video   | 30–45s, silent      |
| `/public/enterprise/compliance-dashboard.mp4`     | Platform section, feature 3                   | Video   | ~20s, silent        |
| `/public/enterprise/student-network.mp4`          | Platform section, feature 4                   | Video   | ~15s, silent        |

## hero-image.jpg

The right column of the hero is a 4:5 portrait photograph that does the heavy visual lifting (Rogo-style). Two good directions:

1. **Moody architectural** — interior of a community health clinic, lit from a single window, low-key cinematic exposure. Wide angle, asymmetric composition. Drop a long shadow from a clinician moving through the frame if you can stage one.
2. **Product-frame composite** — a screenshot of the credentialing dashboard or the compliance hero metrics, set into a darkened photographic backdrop the way Rogo composites their UI tiles over the skyscraper photos.

**Encoding:** JPEG, sRGB, 1200×1500 minimum (the slot upscales gracefully). Compress aggressively (~150–250 KB target). The hero loads `eager` so file size matters for LCP. If shooting yourself, export from Lightroom at quality 75 with chroma subsampling on.

If you don't have a real photograph yet, the placeholder gradient is intentional — it reads as "moody architectural still rendering" and is fine to ship for an early YC/Pear preview.

## Demo videos — encoding spec

- **Resolution:** 1920×1080 (16:9). Will be displayed up to ~720p — record at native, let the browser scale down.
- **Codec:** H.264, MP4 container.
- **Audio:** none — videos autoplay muted. If you record with audio, strip it on export to save bytes.
- **Target size:** under **5 MB per file**. The four feature videos are all `preload="metadata"` so they don't block first paint, but the user pays the bytes when they reach the platform section.
- **Bitrate guidance:** ~3–5 Mbps for the 30-second clips. `ffmpeg -i in.mov -c:v libx264 -crf 23 -preset slow -an out.mp4` is a single-knob default that hits the targets.
- **Captions:** burn captions directly into the video (no `<track>` files). All clips are silent; captions explain what's happening on screen.
- **Frame rate:** 30 fps is fine. 60 fps doubles file size for no visible benefit.

## What to record

### `applicant-tracking.mp4` — 20–30 s

Open Applications hub → filter the list → click into one application → change status to Accepted → show the auto-promote into the team table. Captions explain each step.

### `credentialing-automation.mp4` — 30–45 s (centerpiece)

Open a credentialing case → click "Upload PDF & extract" on the HIPAA row → Claude's extracted fields populate → enter an NPI number → live NPPES verification fires → green Primary-Source-Verified badge appears. Caption every transition.

### `compliance-dashboard.mp4` — 20 s

Open the compliance page → hover the three hero metric cards (let the numbers settle) → click "Run Daily Checks" → click "Export CSV". Captions, no voiceover.

### `student-network.mp4` — 15 s

Show the Applications hub with the network-stats line ("1,247 students in network · 24 applications this month · 5 active positions") → scroll the table of incoming applicants. Caption: "Built-in supply of pre-credentialed candidates."

## Recording tips

- Record at 1.5× natural pace and export, or use CleanShot's "speed up" toggle. The 30s spec assumes brisk pacing — if the natural take feels slow, speed it up rather than cutting content.
- Hide your cursor unless a click matters; CleanShot, Screen Studio, and QuickTime all support this.
- Record in dark mode to match the page's aesthetic. The app forces `dark` theme already.
- Use the seeded `admin@bcshealthclinic.org` account so the data on screen looks plausibly populated.

## Local preview without assets

The page works without any asset files — every slot falls back to its placeholder (moody gradient for the hero image, shimmer + play-icon for each video). Drop the files in this directory and reload to flip them on.
