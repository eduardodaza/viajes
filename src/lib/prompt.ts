// src/lib/prompt.ts
import type { TripFormData } from "./types";

export function buildItineraryPrompt(form: TripFormData): string {
  const sd = new Date(form.startDate + "T12:00:00");
  const ed = new Date(form.endDate + "T12:00:00");
  const days = Math.round((ed.getTime() - sd.getTime()) / 86400000) + 1;
  const locale = form.locale ?? "es";

  const dateStr = sd.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
  const dateEndStr = ed.toLocaleDateString(locale === "es" ? "es-ES" : locale, {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return `You are an expert travel planner. Generate a COMPLETE, DETAILED tourist itinerary.
Respond ONLY in ${locale === "es" ? "Spanish" : locale === "fr" ? "French" : locale === "de" ? "German" : locale === "pt" ? "Portuguese" : locale === "it" ? "Italian" : "English"}.

Trip details:
- City: ${form.city}, ${form.country}
- Dates: ${dateStr} to ${dateEndStr} (${days} days)
- Travelers: ${form.travelers} (${form.travelerType})
- Budget: ${form.budget}
- Interests: ${form.interests.join(", ")}

Respond ONLY with valid JSON (no backticks, no markdown, no comments). Use exactly this schema:

{
  "city": "city name",
  "country": "country name",
  "tagline": "inspiring phrase max 10 words",
  "summary": "2-sentence trip overview",
  "weather": {
    "maxTemp": 27,
    "minTemp": 18,
    "seaTemp": 24,
    "description": "sunny Mediterranean summer"
  },
  "estimatedBudgetPerDay": "€80–130",
  "days": [
    {
      "dayNum": 1,
      "theme": "Day theme",
      "date": "Sunday, July 12",
      "zone": "Main zones / neighborhoods",
      "items": [
        {
          "id": "d1i1",
          "time": "09:00",
          "type": "sight|food|transport|event|alert|beach|night",
          "name": "Place or activity name",
          "description": "Useful tourist description in 2 sentences",
          "duration": "1h 30min",
          "transport": "walking / metro / bus / taxi",
          "transportTime": "10 min",
          "price": "$ / $$ / $$$ / $$$$",
          "rating": "4.5",
          "tip": "insider tip"
        }
      ]
    }
  ],
  "restaurants": [
    {
      "name": "name",
      "type": "cuisine type",
      "priceRange": "$ / $$ / $$$ / $$$$",
      "rating": "4.3",
      "specialty": "signature dish",
      "zone": "neighborhood",
      "source": "TripAdvisor / Google Maps / Yelp",
      "address": "street address if known"
    }
  ],
  "events": [
    {
      "name": "event name",
      "type": "festival|concert|permanent|sport|market|cinema",
      "when": "dates or 'permanent'",
      "description": "brief description",
      "price": "free / approximate price",
      "venue": "venue name"
    }
  ],
  "alerts": [
    {
      "level": "alto|medio|bajo",
      "zone": "zone name",
      "description": "what to watch out for",
      "tip": "practical safety tip"
    }
  ]
}

Rules:
- Include 6-8 activities per day, well distributed from morning to night
- Group nearby attractions to minimize travel
- Restaurants must be real and well-known in the city
- Events must consider if there are festivals/seasons on the given dates
- Alerts must be realistic for the destination
- All transport times between places must be realistic
- Include at least 2-3 restaurants per price tier
- The JSON must be strictly valid`;
}
