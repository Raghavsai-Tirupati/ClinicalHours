# Skill: programmatic_seo

## Purpose
Design and generate scalable SEO page templates that drive student discovery. Each template can be repeated across cities, universities, or specialties to create dozens or hundreds of indexed pages with minimal manual effort.

## Inputs Needed
- Site URL (clinicalhours.org)
- Any existing content categories or location data
- Tech stack context: Next.js + Supabase (dynamic routing is possible)

## What This Skill Produces
1. 3–5 programmatic page types with rationale
2. URL structure and H1 template for each
3. Content block outline (what goes on each page)
4. Priority ranking by search volume potential vs. build difficulty
5. Implementation notes for Next.js dynamic routing

---

## Proposed Page Types

### 1. City-Level Opportunity Pages
**URL template:** `/opportunities/[city]`
**H1 template:** "Clinical Volunteer Opportunities in [City]"
**Target queries:** "clinical volunteer opportunities dallas," "pre-med volunteer houston"
**Content blocks:**
- Intro (2 sentences about clinical hours + city)
- List of open positions in that city (pulled from Supabase)
- "No positions listed yet? Sign up and we'll notify you."
- CTA to sign up
**Priority:** High — high search intent, directly tied to your core product
**Build difficulty:** Medium — requires location data in Supabase and dynamic routing

### 2. University-Specific Pages
**URL template:** `/students/[university]`
**H1 template:** "Clinical Hours Tracker for [University] Pre-Med Students"
**Target queries:** "clinical hours texas a&m pre-med," "clinical volunteer UT Austin pre-med"
**Content blocks:**
- Intro specific to that school's pre-med program
- How ClinicalHours helps students at that school
- Nearby opportunities (link to city page)
- Social proof (if any students from that school are on platform)
- CTA
**Priority:** High — very targeted, low competition, high conversion intent
**Build difficulty:** Low-Medium — mostly static content, can seed with top 20 Texas schools first

### 3. AMCAS Activity Type Pages
**URL template:** `/guide/[activity-type]`
**H1 template:** "How to Log [Activity Type] Hours for AMCAS"
**Examples:** clinical-volunteering, scribing, medical-assisting, hospice
**Target queries:** "how to log scribing hours AMCAS," "does medical assistant count as clinical AMCAS"
**Content blocks:**
- Definition and AMCAS classification
- What counts and what doesn't
- How to write the activity description
- ClinicalHours tracker CTA
**Priority:** High — strong search volume, evergreen, positions ClinicalHours as the authority
**Build difficulty:** Low — mostly static content, no dynamic data needed

### 4. Competency-Specific Pages
**URL template:** `/competencies/[competency-name]`
**H1 template:** "How to Demonstrate [AAMC Competency] as a Pre-Med"
**Examples:** service-orientation, interpersonal-skills, resilience-adaptability
**Target queries:** "AAMC service orientation examples," "how to show teamwork medical school application"
**Content blocks:**
- What the competency means per AAMC
- Clinical activities that demonstrate it
- How to track it (ClinicalHours competency tracker plug)
- Example activity description snippet
**Priority:** Medium — lower search volume but high relevance to premium conversion
**Build difficulty:** Low — static content, 15 competencies total

### 5. Specialty / Clinic Type Pages
**URL template:** `/opportunities/[specialty]`
**H1 template:** "Clinical Volunteer Opportunities in [Specialty]"
**Examples:** pediatrics, emergency-medicine, oncology, family-medicine
**Target queries:** "volunteer cardiology clinic pre-med," "pediatric volunteer opportunities pre-med"
**Content blocks:**
- Why this specialty matters for med school
- What clinical hours in this specialty look like
- Open positions in this specialty (from Supabase)
- CTA
**Priority:** Medium — good long-tail coverage, grows as clinic inventory grows
**Build difficulty:** Medium — requires specialty tagging in Supabase

---

## Implementation Notes (Next.js)
- Use `getStaticPaths` + `getStaticProps` for city and university pages (ISR for updates)
- University and competency pages can be fully static at build time
- City and specialty pages should revalidate on a schedule as positions update
- Add `sitemap.xml` generation to include all programmatic URLs
- Each page needs unique meta title and description — template them with the variable (city/university/etc.)

---

## Priority Order to Build
1. University pages (Texas schools first — TAMU, UT, UH, TCU, Baylor)
2. AMCAS activity type pages (evergreen, no data dependency)
3. City pages (BCS and DFW first, expand as clinic network grows)
4. Competency pages (15 total, low effort)
5. Specialty pages (build as Supabase data supports it)

---

## How to Run This Skill
1. Read `student_positioning.md` for audience context
2. Take site URL and any existing data as input
3. Select which page types to prioritize
4. Output: full content outline for each page type + URL structure + implementation notes
