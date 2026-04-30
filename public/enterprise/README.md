# Enterprise demo videos

The `/enterprise` landing page renders five demo video slots. Each `<VideoSlot />` does a `HEAD` request against the file path on mount; if the file isn't there (or 404s), it shows a shimmer placeholder. Drop the recording at the exact filename below and the placeholder is replaced on the next reload.

## File layout

| Path                                            | Where it appears                              | Length      |
| ----------------------------------------------- | --------------------------------------------- | ----------- |
| `/public/enterprise/hero-loop.mp4`              | Below the hero CTAs (full-width 16:9 tile)    | ~10s, loop  |
| `/public/enterprise/applicant-tracking.mp4`     | Platform section, feature 1                   | 20–30s      |
| `/public/enterprise/credentialing-automation.mp4` | Platform section, feature 2 (centerpiece)   | 30–45s      |
| `/public/enterprise/compliance-dashboard.mp4`   | Platform section, feature 3                   | ~20s        |
| `/public/enterprise/student-network.mp4`        | Platform section, feature 4                   | ~15s        |

## Encoding spec

- **Resolution:** 1920×1080 (16:9). Will be displayed up to ~720p — record at native, let the browser scale down.
- **Codec:** H.264, MP4 container.
- **Audio:** none — videos autoplay muted. If you record with audio, strip it on export to save bytes.
- **Target size:** under **5 MB per file**. The hero loop is loaded eagerly; the four feature videos are `preload="metadata"`. Big files = slow Largest Contentful Paint.
- **Bitrate guidance:** ~3–5 Mbps for the 30-second clips, ~6 Mbps for the 10s hero loop. Use ffmpeg with `-crf 23 -preset slow` if you want a single knob.
- **Captions:** burn captions directly into the video (no `<track>` files). All five clips should be silent; captions explain what's happening on screen.
- **Frame rate:** 30 fps is fine. 60 fps doubles the file size for no visible benefit.

## What to record

### `hero-loop.mp4` — 10 s silent loop

Cinematic loop showing the credentialing dashboard scrolling, then the compliance dashboard, then a credential case being approved with the green PSV badge animating in. No words, no narration, no captions. Pure motion. Loops cleanly — first frame ≈ last frame.

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
- Record in dark mode to match the page's aesthetic. Set `forcedTheme="dark"` is already on for the app.
- Use the seeded `admin@bcshealthclinic.org` account so the data on screen looks plausibly populated.

## Local preview without videos

The page already works without any video files — every slot falls back to the "Demo video — recording in progress" shimmer placeholder. Drop the files in this directory and reload to flip them on.
