// src/pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { buildItineraryPrompt } from "@/lib/prompt";
import type { TripFormData, ItineraryData, Hotel } from "@/lib/types";

// ── Helpers ───────────────────────────────────────────────────

function extractJSON(text: string): string {
  let s = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a > -1 && b > a) s = s.substring(a, b + 1);
  return s;
}

// Builds dynamic links to major review/booking platforms — no API key needed
function buildRestaurantLinks(name: string, city: string, country: string) {
  const q    = encodeURIComponent(`${name} ${city}`);
  const qFull = encodeURIComponent(`${name} ${city} ${country}`);
  return {
    googleMaps:  `https://www.google.com/maps/search/${q}`,
    tripAdvisor: `https://www.tripadvisor.com/Search?q=${qFull}`,
    yelp:        `https://www.yelp.com/search?find_desc=${encodeURIComponent(name)}&find_loc=${encodeURIComponent(city)}`,
    theFork:     `https://www.thefork.com/search?cityName=${encodeURIComponent(city)}&searchQuery=${encodeURIComponent(name)}`,
  };
}

// Builds dynamic links for attractions — no API key needed
function buildAttractionLinks(name: string, city: string) {
  const q = encodeURIComponent(`${name} ${city}`);
  return {
    googleMaps:  `https://www.google.com/maps/search/${q}`,
    tripAdvisor: `https://www.tripadvisor.com/Search?q=${q}`,
    wikipedia:   `https://en.wikipedia.org/wiki/Special:Search?search=${q}`,
    viator:      `https://www.viator.com/searchResults/all?text=${q}`,
  };
}

function buildHotelUrl(
  hotelName: string, city: string,
  startDate: string, endDate: string, travelers: number
): string {
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName + " " + city)}&checkin=${startDate}&checkout=${endDate}&group_adults=${travelers}&selected_currency=USD`;
}

// ── Groq call ─────────────────────────────────────────────────

async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Groq error ${res.status}: ${JSON.stringify(err)}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`Empty Groq response: ${JSON.stringify(data)}`);
  return text;
}

// ── Wikidata SPARQL — attractions, no API key ─────────────────

async function fetchWikidataAttractions(city: string): Promise<{
  name: string; description: string; lat?: number; lon?: number;
}[]> {
  try {
    // Query: tourist attractions, museums, monuments linked to the city
    const sparql = `
SELECT DISTINCT ?place ?placeLabel ?desc ?coord WHERE {
  {
    ?place wdt:P131 ?loc .
    ?loc rdfs:label "${city}"@en .
  } UNION {
    ?place wdt:P131 ?loc .
    ?loc rdfs:label "${city}"@es .
  }
  ?place wdt:P31 ?type .
  VALUES ?type {
    wd:Q570116 wd:Q33506 wd:Q4989906 wd:Q23413
    wd:Q839954 wd:Q1248784 wd:Q24398318
  }
  OPTIONAL { ?place schema:description ?desc . FILTER(LANG(?desc)="en") }
  OPTIONAL { ?place wdt:P625 ?coord }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,es" }
}
LIMIT 8`.trim();

    const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json", "User-Agent": "TripCraftAI/1.0" },
    });

    if (!res.ok) return [];
    const data = await res.json();
    const bindings = data?.results?.bindings ?? [];

    return bindings.map((b: Record<string, { value: string }>) => {
      const coord = b.coord?.value ?? "";
      let lat: number | undefined, lon: number | undefined;
      const m = coord.match(/Point\(([+-]?\d+\.?\d*)\s([+-]?\d+\.?\d*)\)/);
      if (m) { lon = parseFloat(m[1]); lat = parseFloat(m[2]); }
      return {
        name:        b.placeLabel?.value ?? "",
        description: b.desc?.value ?? "",
        lat, lon,
      };
    }).filter((p: { name: string }) => p.name && !p.name.startsWith("Q"));
  } catch {
    return [];
  }
}

// ── Wikipedia — description enrichment, no API key ───────────

async function fetchWikipediaDescription(placeName: string): Promise<string> {
  try {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(placeName)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "TripCraftAI/1.0" },
    });
    if (!res.ok) return "";
    const data = await res.json();
    return data?.extract ? data.extract.slice(0, 200) + "…" : "";
  } catch {
    return "";
  }
}

// ── OpenWeather ───────────────────────────────────────────────

async function fetchWeather(city: string, country: string) {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const geoRes = await fetch(
      `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city + "," + country)}&limit=1&appid=${key}`
    );
    const geo = await geoRes.json();
    if (!geo?.[0]) return null;
    const { lat, lon } = geo[0];
    const wxRes = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${key}&units=metric&cnt=7`
    );
    const wx = await wxRes.json();
    const item = wx?.list?.[0];
    if (!item) return null;
    return {
      maxTemp:     Math.round(item.main.temp_max),
      minTemp:     Math.round(item.main.temp_min),
      description: item.weather?.[0]?.description ?? "",
    };
  } catch { return null; }
}

// ── Ticketmaster — real events with ticket links ───────────────

async function fetchTicketmaster(city: string, startDate: string, endDate: string) {
  const key = process.env.TICKETMASTER_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(city)}&startDateTime=${startDate}T00:00:00Z&endDateTime=${endDate}T23:59:59Z&size=8&apikey=${key}`
    );
    const data = await res.json();
    return (data?._embedded?.events ?? []).map((ev: Record<string, unknown>) => ({
      name:      ev.name as string,
      type:      (ev.classifications as Record<string,unknown>[])?.[0]?.segment?.name === "Music" ? "concert" : "festival",
      when:      (ev.dates as Record<string,unknown>)?.start?.localDate as string ?? startDate,
      description: (ev.info as string) ?? (ev.pleaseNote as string) ?? "",
      price:     (ev.priceRanges as Record<string,number>[])?.[0]?.min
                   ? `From $${(ev.priceRanges as Record<string,number>[])[0].min}`
                   : "See website",
      venue:     ((ev._embedded as Record<string,unknown>)?.venues as Record<string,unknown>[])?.[0]?.name as string ?? "",
      ticketUrl: ev.url as string ?? "",
      source:    "Ticketmaster",
    }));
  } catch { return []; }
}

// ── Eventbrite — local cultural events ───────────────────────

async function fetchEventbrite(city: string, startDate: string, endDate: string) {
  const key = process.env.EVENTBRITE_API_KEY;
  if (!key) return [];
  try {
    const res = await fetch(
      `https://www.eventbriteapi.com/v3/events/search/?q=${encodeURIComponent(city)}&start_date.range_start=${startDate}T00:00:00Z&start_date.range_end=${endDate}T23:59:59Z&expand=venue&page_size=5&sort_by=date`,
      { headers: { Authorization: `Bearer ${key}` } }
    );
    const data = await res.json();
    return (data?.events ?? [])
      .filter((ev: Record<string,unknown>) => ev.name?.text)
      .map((ev: Record<string,unknown>) => ({
        name:        (ev.name as Record<string,string>)?.text ?? "",
        type:        ev.category_id === "103" ? "concert"
                   : ev.category_id === "108" ? "sport"
                   : "festival",
        when:        (ev.start as Record<string,string>)?.local?.split("T")[0] ?? startDate,
        description: (ev.description as Record<string,string>)?.text?.slice(0, 150)
                     ?? (ev.summary as string) ?? "",
        price:       ev.is_free ? "Free"
                   : (ev.ticket_availability as Record<string,Record<string,string>>)
                       ?.minimum_ticket_price?.display ?? "See website",
        venue:       (ev.venue as Record<string,string>)?.name ?? "",
        ticketUrl:   ev.url as string ?? "",
        source:      "Eventbrite",
      }));
  } catch { return []; }
}

// ── Booking.com via RapidAPI — hotels ────────────────────────

async function fetchHotels(form: TripFormData): Promise<Hotel[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];
  try {
    const destRes = await fetch(
      `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=${encodeURIComponent(form.city)}`,
      { headers: { "x-rapidapi-key": key, "x-rapidapi-host": "booking-com15.p.rapidapi.com" } }
    );
    const destData = await destRes.json();
    const cityResult = destData?.data?.find((d: Record<string,string>) => d.dest_type === "city")
                    ?? destData?.data?.[0];
    const destId = cityResult?.dest_id;
    if (!destId) return [];

    const params = new URLSearchParams({
      dest_id: destId, search_type: "CITY",
      arrival_date: form.startDate, departure_date: form.endDate,
      adults: String(form.travelers), room_qty: "1",
      units: "metric", currency_code: "USD",
      languagecode: "en-us", page_number: "1",
    });

    const hotelRes = await fetch(
      `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels?${params}`,
      { headers: { "x-rapidapi-key": key, "x-rapidapi-host": "booking-com15.p.rapidapi.com" } }
    );
    const hotelData = await hotelRes.json();

    return (hotelData?.data?.hotels ?? [])
      .filter((h: Record<string, Record<string,unknown>>) => (h.property?.reviewScore ?? 0) >= 7)
      .sort((a: Record<string, Record<string,unknown>>, b: Record<string, Record<string,unknown>>) => {
        const pa = (a.property?.priceBreakdown as Record<string,Record<string,number>>)?.grossPrice?.value ?? 999999;
        const pb = (b.property?.priceBreakdown as Record<string,Record<string,number>>)?.grossPrice?.value ?? 999999;
        return (pa as number) - (pb as number);
      })
      .slice(0, 5)
      .map((h: Record<string, Record<string,unknown>>) => {
        const p = h.property ?? {};
        return {
          name:               p.name as string ?? "Hotel",
          stars:              p.propertyClass as number ?? 0,
          reviewScore:        p.reviewScore as number ?? 0,
          reviewCount:        p.reviewCount as number ?? 0,
          pricePerNight:      (p.priceBreakdown as Record<string,Record<string,number>>)?.grossPrice?.value
                                ? String(Math.round((p.priceBreakdown as Record<string,Record<string,number>>).grossPrice.value))
                                : "N/A",
          currency:           (p.priceBreakdown as Record<string,Record<string,string>>)?.grossPrice?.currency ?? "USD",
          address:            p.address as string ?? form.city,
          url:                buildHotelUrl(p.name as string ?? "", form.city, form.startDate, form.endDate, form.travelers),
          photoUrl:           Array.isArray(p.photoUrls) ? p.photoUrls[0] as string : undefined,
          distanceFromCenter: p.distanceToCC
                                ? `${parseFloat(p.distanceToCC as string).toFixed(1)} km from center`
                                : undefined,
        };
      });
  } catch { return []; }
}

// ── Google Places — rating enrichment (optional) ──────────────

async function enrichRestaurantRatings(
  restaurants: ItineraryData["restaurants"],
  city: string
) {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) return;
  try {
    for (const resto of restaurants.slice(0, 4)) {
      const res = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(resto.name + " " + city)}&key=${key}`
      );
      const data = await res.json();
      const place = data?.results?.[0];
      if (place) {
        if (place.rating)             resto.rating  = String(place.rating);
        if (place.formatted_address)  resto.address = place.formatted_address;
      }
    }
  } catch { /* silent */ }
}

// ── Geoapify — POIs reales (optional) ────────────────────────

async function enrichWithGeoapify(itinerary: ItineraryData, form: TripFormData) {
  const key = process.env.GEOAPIFY_API_KEY;
  if (!key) return;
  try {
    const geoRes = await fetch(
      `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(form.city + ", " + form.country)}&limit=1&apiKey=${key}`
    );
    const geoData = await geoRes.json();
    const coords = geoData?.features?.[0]?.geometry?.coordinates;
    if (!coords) return;

    const [lon, lat] = coords;
    const poiRes = await fetch(
      `https://api.geoapify.com/v2/places?categories=tourism.attraction,tourism.sights,entertainment.museum&filter=circle:${lon},${lat},5000&limit=6&apiKey=${key}`
    );
    const poiData = await poiRes.json();
    const places = poiData?.features ?? [];

    if (places.length > 0 && itinerary.days?.[0]) {
      for (const place of places.slice(0, 3)) {
        const props = place.properties;
        const name = props?.name;
        if (!name) continue;
        const alreadyIn = itinerary.days[0].items.some(
          item => item.name.toLowerCase() === name.toLowerCase()
        );
        if (!alreadyIn) {
          itinerary.days[0].items.push({
            id:            `geo_${props.place_id?.slice(0, 8) ?? Math.random().toString(36).slice(2)}`,
            time:          "18:00",
            type:          "sight",
            name,
            description:   props.datasource?.raw?.description ?? `${props.categories?.[0] ?? "Attraction"} in ${form.city}.`,
            duration:      "1h",
            transport:     "walking",
            transportTime: "varies",
            price:         "$",
            priceDetail:   "",
            rating:        props.datasource?.raw?.rating ?? "",
            tip:           props.website ? `Visit: ${props.website}` : "",
            links:         buildAttractionLinks(name, form.city),
          });
        }
      }
    }
  } catch { /* silent */ }
}

// ── Main handler ──────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form: TripFormData = req.body;
  if (!form.city || !form.country || !form.startDate || !form.endDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ── 1. Groq — core itinerary (main engine) ────────────────
    const prompt  = buildItineraryPrompt(form);
    let rawText   = await callGroq(prompt, 6000);
    let jsonStr   = extractJSON(rawText);

    let itinerary: ItineraryData;
    try {
      itinerary = JSON.parse(jsonStr);
    } catch {
      // Auto-fix malformed JSON with a second Groq call
      const fixText = await callGroq(
        `Fix this JSON and return ONLY the corrected valid JSON, no explanation:\n\n${jsonStr}`,
        6000
      );
      itinerary = JSON.parse(extractJSON(fixText));
    }

    // Ensure arrays exist
    itinerary.events     = itinerary.events     ?? [];
    itinerary.alerts     = itinerary.alerts     ?? [];
    itinerary.restaurants = itinerary.restaurants ?? [];

    // ── 2. Attach dynamic links to every restaurant ───────────
    // No API key needed — works globally for any city in any country
    for (const resto of itinerary.restaurants) {
      resto.links = buildRestaurantLinks(resto.name, form.city, form.country);
    }

    // ── 3. Attach dynamic links to every attraction (sight) ───
    for (const day of itinerary.days ?? []) {
      for (const item of day.items ?? []) {
        if (item.type === "sight" || item.type === "event" || item.type === "beach") {
          item.links = buildAttractionLinks(item.name, form.city);
          // Add Viator booking link for paid attractions
          if (item.price && item.price !== "$" && item.price !== "free") {
            item.viatorUrl = `https://www.viator.com/searchResults/all?text=${encodeURIComponent(item.name + " " + form.city)}`;
          }
        }
      }
    }

    // ── 4. Wikidata — real attractions (no API key) ───────────
    // Run in parallel with other enrichments
    const [
      wikidataAttractions,
      weatherData,
      tmEvents,
      ebEvents,
      hotelResults,
    ] = await Promise.allSettled([
      fetchWikidataAttractions(form.city),
      fetchWeather(form.city, form.country),
      fetchTicketmaster(form.city, form.startDate, form.endDate),
      fetchEventbrite(form.city, form.startDate, form.endDate),
      fetchHotels(form),
    ]);

    // ── 5. Enrich day items with Wikidata descriptions ────────
    if (wikidataAttractions.status === "fulfilled" && wikidataAttractions.value.length > 0) {
      const wdPlaces = wikidataAttractions.value;
      for (const day of itinerary.days ?? []) {
        for (const item of day.items ?? []) {
          if (item.type !== "sight") continue;
          const match = wdPlaces.find(
            p => p.name.toLowerCase().includes(item.name.toLowerCase().split(" ")[0])
              || item.name.toLowerCase().includes(p.name.toLowerCase().split(" ")[0])
          );
          if (match?.description && match.description.length > 20) {
            // Enrich description only if Wikidata has something meaningful
            item.wikidataDescription = match.description;
          }
        }
      }

      // Try to get Wikipedia extract for the city itself
      const cityWiki = await fetchWikipediaDescription(form.city).catch(() => "");
      if (cityWiki) itinerary.cityWikipediaExtract = cityWiki;
    }

    // ── 6. Weather enrichment ────────────────────────────────
    if (weatherData.status === "fulfilled" && weatherData.value) {
      itinerary.weather = {
        ...itinerary.weather,
        ...weatherData.value,
      };
    }

    // ── 7. Ticketmaster events — real events with ticket links ─
    if (tmEvents.status === "fulfilled") {
      const existingNames = new Set(itinerary.events.map(e => e.name.toLowerCase()));
      for (const ev of tmEvents.value) {
        if (!existingNames.has(ev.name.toLowerCase())) {
          itinerary.events.unshift(ev);
          existingNames.add(ev.name.toLowerCase());
        }
      }
    }

    // ── 8. Eventbrite events — local cultural events ─────────
    if (ebEvents.status === "fulfilled") {
      const existingNames = new Set(itinerary.events.map(e => e.name.toLowerCase()));
      for (const ev of ebEvents.value) {
        if (!existingNames.has(ev.name.toLowerCase())) {
          itinerary.events.push(ev);
          existingNames.add(ev.name.toLowerCase());
        }
      }
    }

    // ── 9. Hotels from Booking.com ───────────────────────────
    if (hotelResults.status === "fulfilled" && hotelResults.value.length > 0) {
      itinerary.hotels = hotelResults.value;
    }

    // ── 10. Google Places rating enrichment (optional) ────────
    await enrichRestaurantRatings(itinerary.restaurants, form.city);

    // ── 11. Geoapify POI enrichment (optional) ────────────────
    await enrichWithGeoapify(itinerary, form);

    // ── 12. Tag generation source ─────────────────────────────
    itinerary.generatedBy = "Groq LLaMA 3.3 70B · Wikidata · Wikipedia · Ticketmaster · Eventbrite";

    return res.status(200).json(itinerary);

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate] Error:", message);
    return res.status(500).json({ error: "Failed to generate itinerary", detail: message });
  }
}

export const config = { api: { responseLimit: "10mb" } };
