# Submission pack

## Email draft

**To:** ozair.shaikh@datastraw.in, aryan.jaiswal@datastraw.in
**CC:** talent@datastraw.in
**Subject:** Smart Roster Management System Assignment - Garvit Juneja

> Hi Ozair and Aryan,
>
> Please find my Smart Roster Management System assignment submission below.
>
> 1. Application URL: https://garvit027.github.io/smart-roster/
> 2. GitHub repository: https://github.com/garvit027/smart-roster
> 3. LinkedIn profile: https://www.linkedin.com/in/<your-handle>/  ← replace before sending
> 4. Demo video: <attach the recorded walkthrough>
>
> Approach note (short version): I modelled the scheduling problem around a brand-process "allocation" that owns its own operating calendar and minimum coverage, then built a deterministic two-phase engine — generate the matrix, then validate it independently. Mandatory client coverage always outranks employee preferences, and every unsatisfied requirement is reported with its exact cause and ranked backup options. The UI provides company, pod, brand, process and employee views plus a change simulator that shows the before/after impact of an absence.
>
> The full approach note, architecture and assumptions are in the README. Happy to walk through any part of it.
>
> Regards,
> Garvit Juneja

⚠️ Replace the LinkedIn URL and attach the video before sending.

## Demo video script (3–5 minutes)

Record at 1280×720 or higher. Use the default December 2026 month. Keep the cursor movements slow and narrate the reasoning, not just the clicks.

### 0:00–0:30 — Setup and problem framing
- Open the live URL. On **Overview**, point out 32 employees, 25 brands, 64 allocations and the four pods.
- Say: *"80% of brands here are single-resource; the rest have two or three people, some sharing a process. Each brand-process pair carries its own operating calendar."*
- Show the **Operating calendar mix** card — 365-day, daily-minus-holidays, Mon–Sat and Mon–Fri rules all coexisting.

### 0:30–1:15 — Generation
- Click **Generate roster** in the top bar.
- Point to the coverage gauge (≈98%) and explain that the remaining gap is intentional and explained in the conflicts report.
- Mention the engine is deterministic, fills the most constrained allocations first, and balances shifts via scoring.

### 1:15–2:15 — Different brand schedules
- Go to **Roster views → Brand-wise**. Select **Aurora Lifestyle** (brand B01).
- Show that one employee covers CS, ACC and RET, and note the three different operating rules in the allocation list.
- Show the daily coverage grid: green = covered, red = shortfall, grey = process closed on Sundays/holidays.
- Switch to a three-employee brand such as **Willow Goods** to show a shared process with `minCoverage = 2`.
- Switch to **Process-wise → NDR** to show the same process across multiple brands with different calendars.

### 2:15–3:15 — Conflict detection and backup assignment
- Go to **Conflicts**. The default filter is Mandatory.
- Open a shortfall caused by a planned leave on a single-resource brand; read the detail: *"unavailable: Aarav Sharma (planned: Personal work)"*.
- Open a shortfall caused by a cross-brand clash; explain the "covering another brand" reason.
- Expand a conflict that has **Ranked backup options**. Explain the three tiers: same allocation, same process, cross-trained.
- Click **Assign** on a backup. Show the toast confirming revalidation and the conflict count dropping by one.
- Mention that preference conflicts are kept in a separate filter so mandatory issues are not drowned out.

### 3:15–4:15 — Handling a change
- Go to **Change simulator**.
- Pick a single-resource brand employee (e.g. Priya Nair, who owns Bloom & Co), set a date such as 2026-12-16, and click **Simulate absence**.
- Show the three impact numbers: cells changed, new mandatory conflicts, active overrides.
- Show the before/after diff for that employee.
- Expand a new gap: the app explains that Bloom & Co is single-resource and suggests a comp-off swap, cross-training or a client exception.
- Click **Revert to previous plan** to show the original plan is restored.

### 4:15–4:45 — Configuration and closing
- Open **Setup & data → Allocations** briefly to show that employees, coverage rules and calendars are editable without code changes.
- Open **Approach** and expand the first answer to point to the written reasoning.
- Close on the live URL and repository name.

## Recording tips
- Clear browser localStorage before recording (`DevTools → Application → Local Storage → clear`) so the demo starts from the exact seed data described above.
- If you accidentally assign a backup during the recording, click **Reset** in the top bar before the next take.
- Keep the total under 5 minutes; the assignment asks for 3–5.
