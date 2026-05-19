// src/pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import Anthropic from "@anthropic-ai/sdk";
import { buildItineraryPrompt } from "@/lib/prompt";
import type { TripFormData, ItineraryData } from "@/lib/types";

const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
  { method: "POST", body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) }
);

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    let jsonStr = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace > -1) jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);

    const itinerary: ItineraryData = JSON.parse(jsonStr);

    // ── 2. OpenWeather (optional enrichment) ──────────────────
    if (process.env.OPENWEATHER_API_KEY) {
      try {
        const geoRes = await fetch(
          `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(form.city + "," + form.country)}&limit=1&appid=${process.env.OPENWEATHER_API_KEY}`
        );
        const geoData = await geoRes.json();
        if (geoData && geoData[0]) {
          const { lat, lon } = geoData[0];
          const wxRes = await fetch(
            `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHER_API_KEY}&units=metric&cnt=7`
          );
          const wxData = await wxRes.json();
          if (wxData?.list?.[0]) {
            itinerary.weather = {
              maxTemp: Math.round(wxData.list[0].main.temp_max),
              minTemp: Math.round(wxData.list[0].main.temp_min),
              description: wxData.list[0].weather[0].description,
            };
          }
        }
      } catch {
        // Weather enrichment failed silently — non-critical
      }
    }

    // ── 3. Ticketmaster events (optional enrichment) ───────────
    if (process.env.TICKETMASTER_API_KEY) {
      try {
        const tmRes = await fetch(
          `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(form.city)}&startDateTime=${form.startDate}T00:00:00Z&endDateTime=${form.endDate}T23:59:59Z&size=5&apikey=${process.env.TICKETMASTER_API_KEY}`
        );
        const tmData = await tmRes.json();
        const tmEvents = tmData?._embedded?.events ?? [];

        for (const ev of tmEvents) {
          const existing = itinerary.events.find(
            (e) => e.name.toLowerCase() === ev.name.toLowerCase()
          );
          if (!existing) {
            itinerary.events.unshift({
              name: ev.name,
              type: ev.classifications?.[0]?.segment?.name === "Music" ? "concert" : "festival",
              when: ev.dates?.start?.localDate ?? form.startDate,
              description: ev.info ?? ev.pleaseNote ?? "",
              price: ev.priceRanges
                ? `From €${ev.priceRanges[0].min}`
                : "See website",
              venue: ev._embedded?.venues?.[0]?.name ?? "",
              ticketUrl: ev.url ?? "",
            });
          }
        }
      } catch {
        // Ticketmaster enrichment failed silently
      }
    }

    // ── 4. Google Places restaurant ratings (optional) ────────
    // Kept server-side to protect API key
    if (process.env.GOOGLE_PLACES_API_KEY) {
      try {
        for (const resto of itinerary.restaurants.slice(0, 4)) {
          const searchRes = await fetch(
            `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(resto.name + " " + form.city)}&key=${process.env.GOOGLE_PLACES_API_KEY}`
          );
          const searchData = await searchRes.json();
          const place = searchData?.results?.[0];
          if (place) {
            if (place.rating) resto.rating = String(place.rating);
            if (place.formatted_address) resto.address = place.formatted_address;
          }
        }
      } catch {
        // Google Places enrichment failed silently
      }
    }

    return res.status(200).json(itinerary);
  } catch (err) {
    console.error("[generate] Error:", err);
    return res.status(500).json({ error: "Failed to generate itinerary" });
  }
}
