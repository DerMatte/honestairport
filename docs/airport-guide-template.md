# Airport Guide Template

A standard structure for creating Airportist airport pages that feel practical, current, and specific rather than like a static directory. The long-term goal is a Grokipedia-style guide layer where facts, live status, and traveler tips are continuously refreshed and clearly sourced.

## Markdown Frontmatter

Airport guide markdown is the source of truth for guide-specific page content. Keep structured frontmatter concise and sourced:

- `iata`, `name`, `city`, `country`, `lastUpdated`
- `sources`: official airport, transport, security, and operator URLs used by the guide
- `quickFacts`: short facts surfaced in the Overview tab
- `bentoTips`: up to four high-priority tip cards for "Know before you go"

Each `bentoTips` item should include `category` (`timing`, `terminal`, `food`, or `status`), `label`, `title`, `summary`, and optional `detail`.

The airport detail tabs also read short bullet summaries from these level-two guide headings when present:

- `## Best Airport Tricks & Hacks` for the Traveler Tips tab
- `## Terminals & Navigation` for the Getting There tab
- `## Ground Transport & Parking` for the Getting There tab

Keep those sections as scannable markdown bullet lists. Nested bullets are okay, but each bullet should stand alone when surfaced as a compact card.

## 1. Quick Snapshot

- Airport name, IATA/ICAO codes, city, country, timezone
- Terminals, runways, annual passengers
- Best known for: fast connections, great food, bad delays, confusing layout, etc.
- Airportist Score with badges like `Best Food`, `Fast Security`, `Budget Friendly`, `Long Walks`
- Current status: delays, strikes, weather, construction, disruptions
- Official links: website, app, terminal maps, lost luggage, accessibility

## 2. Live Airport Status

This should feel like the constantly updated layer.

- Live flight disruption level: normal, minor delays, major delays
- Bad weather alerts: storms, snow, fog, wind, heat
- Security wait times, if available
- Border control / immigration wait notes
- Construction alerts
- Strike or staffing disruption notices
- Airport operational notices from official sources
- Timestamp: `Updated 14 minutes ago`
- Source labels: official airport, flight API, weather API, user report, editorial review

## 3. Time Budget Matrix

A signature feature for reducing traveler anxiety.

- Curb to check-in
- Check-in to security
- Security to nearest gates
- Security to farthest gates
- Terminal-to-terminal transfer time
- Domestic connection minimum
- International connection minimum
- Schengen to non-Schengen transfer time
- Non-Schengen to Schengen transfer time
- Arrival gate to baggage claim
- Baggage claim to train/taxi/rideshare

Example guidance:

- Safe domestic arrival: 90 minutes before departure
- Safe international arrival: 2.5 hours before departure
- Tight connection warning: Terminal 1 to Terminal 3 can take 25-40 minutes

## 4. Getting There & Away

- Distance and average time to city center
- Train, metro, bus, shuttle options
- Taxi and rideshare pickup locations
- Typical fares and surge warnings
- Parking rates, EV charging, valet
- Car rental location and tips
- Hotel shuttles
- Accessibility transport
- Cheapest reliable way into the city
- Fastest reliable way into the city

## 5. Terminal & Navigation Guide

- Terminal map
- Airlines by terminal
- Schengen vs non-Schengen zones where relevant
- Domestic vs international areas
- Security checkpoint locations
- Fastest security checkpoint tips
- Customs and immigration notes
- Baggage claim layout
- Inter-terminal transport
- Long-walk warnings
- Common confusion points
- Hidden shortcuts

## 6. Lounges

Each lounge should include:

- Name
- Terminal / concourse / gate area
- Schengen or non-Schengen where relevant
- Access: airline status, business class, Priority Pass, credit cards, paid entry
- Opening hours
- Food quality
- Shower availability
- Quietness
- Work-friendliness
- Best for: families, sleep, food, calls, quick stop
- Verdict: worth it or skip it

## 7. Food & Drink

Break this down by terminal and security zone.

- Best overall food
- Best quick meal
- Best local food
- Best coffee
- Best breakfast
- Best late-night option
- Cheapest decent meal
- Cheapest water
- Free water refill stations
- Places to avoid
- Good options near far gates
- Vegetarian/vegan/gluten-free notes

## 8. Budget Traveler Tips

- Cheapest water
- Free refill locations
- Cheapest food that is still decent
- Free seating areas
- Free quiet zones
- Best place to sleep without paying
- Free WiFi details
- Cheapest way to city center
- Avoidable fees or tourist traps

## 9. Work, Rest & Comfort

- Best work areas
- Charging station locations
- WiFi speed and login method
- Quiet zones
- Sleeping pods / nap rooms
- Showers
- Spas
- Prayer rooms
- Smoking areas
- Medical/pharmacy
- ATMs and currency exchange
- Best bathrooms / cleanest areas if known

## 10. Traveler Type Guides

Create short tailored summaries for:

- Business travelers
- Families
- Budget travelers
- Digital nomads
- Seniors
- Travelers with disabilities
- Pet owners
- Long layovers
- Tight connections
- First-time visitors

## 11. Insider Tips & Tricks

This should be the standout section.

- Best security checkpoint at peak times
- Worst terminal bottleneck
- Best food near each gate cluster
- Quietest charging area
- Best place to wait during delays
- Where to refill water
- Where to sleep
- Which lounge is overrated
- Which terminal has the best bathrooms
- How early to arrive
- What to avoid during peak hours
- Seasonal warnings
- Construction changes
- Missed connection advice
- `If you only remember one thing...` summary

## 12. Reviews & Community Signals

- Overall rating
- Ratings by category: navigation, security, food, lounges, cleanliness, staff, WiFi, value
- AI-summarized pros and cons
- Recent traveler quotes
- User-submitted tips
- Photo verification
- Recently confirmed notes

## 13. Nearby & Bonus Info

- Nearby airport hotels
- Best overnight option
- Alternative airports nearby
- Things to do on a long layover
- Airport tours
- City transfer warning notes
- Emergency contacts
- Lost and found
- Accessibility assistance

## Page Features To Add

- Live status card for delays, weather, strikes, construction
- Time calculator for hotel-to-gate or gate-to-gate planning
- Terminal filter for food, lounges, bathrooms, water, charging
- Schengen / non-Schengen toggle
- Budget mode
- Family mode
- Business traveler mode
- Tight connection mode
- Updated recently badges
- Confidence score per tip
- Report outdated info button
- Submit a tip button
- Verified by official source / traveler / editor labels

## MVP Page Structure

Start every airport page with:

1. Quick Snapshot
2. Live Status
3. Time Budget Matrix
4. Getting There & Away
5. Terminal Navigation
6. Food, Water & Lounges
7. Insider Tips
8. Reviews & Pros/Cons
