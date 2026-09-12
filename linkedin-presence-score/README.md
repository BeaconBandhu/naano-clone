# LinkedIn Presence Score

Scrape a LinkedIn profile through **Apify** and turn its reach + engagement into
one **score out of 100**. No browser, no LinkedIn login, no cookies — a hosted
actor does the scraping for a few cents per run.

Default profile is `https://www.linkedin.com/in/aranyabandhu/`; pass any
`/in/<slug>/` URL as the first argument.

---

## What you get

| Field | Source |
|---|---|
| name, headline, **bio** | `harvestapi/linkedin-profile-scraper` (~$0.004 / profile) |
| **followers**, **connections** | same |
| last N posts — **likes**, comments, reposts, date | `harvestapi/linkedin-profile-posts` (~$0.002 / post) |
| **presence score /100** + grade | computed locally, see below |

A run against one profile with 5 posts costs roughly **$0.02**.

---

## Setup

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Get an Apify API token at <https://console.apify.com/settings/integrations>,
then:

```powershell
copy .env.example .env
#  edit .env  ->  APIFY_TOKEN=apify_api_xxxxxxxxxxxxxxxxxx
```

---

## Usage

```powershell
python scrape_and_score.py                                  # default profile
python scrape_and_score.py https://www.linkedin.com/in/some-slug/
python scrape_and_score.py --posts 10 --out result.json
python scrape_and_score.py --apify-token apify_api_xxx      # instead of .env
```

Output: a table in the terminal **and** `linkedin_presence_result.json` with the
full breakdown (score config, per-post rows, derived stats, notes).

### No-spend alternative

If you already know the numbers (or don't want to pay), skip scraping entirely:

```powershell
python score_manual.py --followers 2369 --connections 2257 --likes 71,20,6,15,10
#  optional:  --comments 2,0,0,0,0  --name "Aranya Bandhu"  --bio "..."
```

---

## Example output

```
================================================================
 LinkedIn Presence Report - Aranya Bandhu
================================================================
 Profile     : https://www.linkedin.com/in/aranyabandhu/
 Headline    : AI Harness and Guardrailing Engineer | Speaker and Project Contributor …
 Bio         : As an experienced and dedicated professional with a proven track record …

 Followers   : 2,369
 Connections : 500+

 Last 5 posts:
   #  type        likes  comments  reposts  posted
   -- --------  ------- --------- --------  ------------
   1  post           71         2      n/a  4d
   2  post           20         0      n/a  3w
   3  post            6         0      n/a  3w
   4  post           15         0      n/a  4w
   5  post           10         0      n/a  1mo

 Total likes over 5 post(s) : 122
 Average likes / post              : 24.4
 Engagement rate (avg likes / followers) : 1.03%

 Score breakdown (points earned / max):
   Followers          21.5 / 30
   Connections        20.0 / 20
   Avg likes/post     15.6 / 30
   Engagement rate     4.1 / 20
----------------------------------------------------------------
 PRESENCE SCORE : 61.2 / 100   (grade C)
----------------------------------------------------------------
```

---

## How the score works

Four components sum to 100. Each has a **weight** (max points) and a **target**
(the input that earns full points). Reach uses a log curve so early growth is
rewarded and huge accounts don't run away with it; ratios are linear.

| Component | Weight | Curve | Full marks at | Why |
|---|:--:|---|---|---|
| Followers | 30 | log₁₀ | 50,000 | audience size, diminishing returns |
| Connections | 20 | linear | 500 | LinkedIn caps the display at "500+" |
| Avg likes / post | 30 | log₁₀ | 500 avg | content reach over the last N posts |
| Engagement rate | 20 | linear | 5.0% | avg likes ÷ followers × 100; ~2–5% is strong |

```
log component    = weight × log10(value + 1) / log10(target + 1)   (capped at weight)
linear component = weight × value / target                          (capped at weight)
```

Components are rounded before summing, so the printed breakdown always adds to
the total. Grades: **A+** ≥ 90, **A** ≥ 80, **B** ≥ 70, **C** ≥ 60, **D** ≥ 50, else **E**.

Everything is data — edit `CONFIG` at the top of
[`linkedin_presence/scoring.py`](linkedin_presence/scoring.py) to re-weight.

---

## Notes

- **"likes" = total reactions.** LinkedIn only publishes a combined count
  (Like + Celebrate + Support + Love + Insightful + Funny); there is no
  Like-only number.
- **"500+" connections** is recorded as 500.
- Automated scraping is against LinkedIn's User Agreement. With Apify the
  scraping (and that exposure) is the provider's, but that is not a licence to
  scrape profiles you have no business scraping.
- Field names come from the HarvestAPI actors; if their output shape changes, a
  value may come back `null` — see `linkedin_presence/apify_client.py`.

---

## Files

```
scrape_and_score.py            CLI: scrape via Apify -> score -> report
score_manual.py                score from hand-entered numbers, no scraping
linkedin_presence/
  apify_client.py              scrape_via_apify()  — the two HarvestAPI actors
  models.py                    ProfileStats, PostStat, URL helpers
  scoring.py                   compute_score() + CONFIG
  report.py                    JSON + text report
tests/test_scoring.py          offline tests (no token needed)
```

## Tests

```powershell
python -m pytest -q          # or:  python tests/test_scoring.py
```
