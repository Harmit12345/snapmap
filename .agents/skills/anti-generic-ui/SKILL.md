---
name: anti-generic-ui
description: Use whenever building or restyling a web UI, landing page, dashboard, or app. Kills the recognizable "AI-coded" look — generic gradients, default component patterns, boilerplate marketing copy, stock layouts — by naming the specific tells and forcing a deliberate alternative before any code is written.
---

# Anti-Generic UI — Kill the "Vibe Coded" Look

## The actual problem this solves

"Looks AI-generated" isn't one thing. It's the sum of dozens of default choices that any model reaches for when nothing in the brief overrides them — because those defaults are statistically the most common patterns in training data. Fixing one (swap the color) doesn't fix the rest. Treat this as a checklist to run against BEFORE writing code, not a vibe to aim for.

If the brief doesn't specify real content, real copy, real product details — stop and ask for them or pull from the actual project (README, existing site, memory of prior conversations about this project). Inventing placeholder content and then styling it well still reads as generic, because the copy tells are as strong as the visual tells.

## Visual tells — check every one against your current plan

**Color**
- Cream/off-white (~#F4F1EA) + high-contrast serif + terracotta/clay accent (~#D97757) — this exact combo is a known AI-default, not a style choice
- Near-black background + single acid-green or vermilion accent
- Default shadcn/Tailwind palette left untouched: indigo/violet primary (#6366F1, #8B5CF6), blue-600 (#2563EB) CTA buttons, slate grays for everything else
- Purple-to-pink or blue-to-purple gradient backgrounds/text — reach for this only if the brief's actual subject matter justifies gradients (rare)
- If none of these is wrong for the brief, fine — but you should be able to say *why* this palette and not another, tied to the actual subject

**Layout**
- Hero: eyebrow badge ("✨ New") → big centered headline → subhead → two buttons (primary + "Learn more") → dashboard/app screenshot mockup floating below. This exact stack is the single most recognizable AI pattern in existence.
- Feature section: exactly 3 or 4 cards in a row, each with a colored rounded-square icon on top, bold heading, one-sentence description
- Testimonial carousel with 5-star ratings and circular stock-photo avatars
- "Trusted by" logo strip with invented company names
- Stats bar: "10,000+ users / 99.9% uptime / 24/7 support" with no real numbers behind them
- FAQ accordion bolted onto the bottom regardless of whether the content needs one
- Footer: 4 generic columns (Product / Company / Resources / Legal) with links that go nowhere

None of these are wrong in principle. They're wrong when used because they're the default rather than because the content actually calls for that structure.

**Components & polish**
- Everything at `rounded-2xl` / `rounded-3xl`, every card with the same `drop-shadow-lg`
- Glassmorphism (backdrop-blur + translucent white cards) applied with no reason tied to the subject
- Blob-shaped SVG background decorations, floating gradient orbs
- Lucide icon set used at default size/stroke with no customization, one icon per feature no matter the fit
- Scroll-triggered fade-in-and-slide-up on every single section, same easing, same duration — motion applied uniformly instead of where it earns attention

**Typography**
- Inter or system-ui for both display and body text, no pairing decision made at all
- No real type scale — headings sized by "whatever looked right" rather than a defined ratio

## Copy tells — as recognizable as the visual ones

Flag and rewrite any of these if they appear in your own draft copy:
- "Unlock / Empower / Elevate / Revolutionize / Supercharge / Seamlessly"
- "Everything you need to [X]"
- "Built for the modern [X]"
- Three-word abstract taglines with no concrete noun in them
- CTA pairs: "Get Started" + "Learn More" with no product-specific verb
- Claims of scale or trust with no real number or name behind them

Write copy the way the docs skill/design-writing standard does: name what the user actually controls, describe what a thing does rather than selling it, keep the same term for the same action across the whole flow.

## Process — do this before touching code

1. State the actual subject, audience, and the page's one job — in one line, specific to this project, not generic
2. Define a real token set: 4–6 named hex colors (with a reason each is there), a display/body font pairing (not the same faces you'd pick for any other project), a defined type scale
3. Pick ONE signature element — the thing this page will be remembered for. Spend your risk-budget there; keep everything else disciplined and quiet
4. Before writing code, re-read your own plan and ask: could this be pasted onto a different project with the words swapped and still make sense? If yes, revise the specific part that's generic and say what you changed
5. Build. Then screenshot and self-critique against the tells list above — this catches things that were invisible in the plan but obvious once rendered

## Self-check before calling it done

- Does anything on this page look like it could belong to any product, in any category, doing any job? Name the specific element if so, and fix it.
- Is there exactly one bold risk, with everything else restrained around it — or did boldness get spread thin across five half-committed ideas?
- Mobile responsive, visible keyboard focus states, reduced-motion respected — a quality floor, not a differentiator, but skipping it is its own tell
- Would a person who's seen a lot of AI-generated sites this month clock this as one within 5 seconds? If you can't honestly say no, something on the tells list above is still present.
