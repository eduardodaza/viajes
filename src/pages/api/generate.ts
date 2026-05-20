// src/pages/api/generate.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { buildItineraryPrompt } from "@/lib/prompt";
import type { TripFormData, ItineraryData, Hotel } from "@/lib/types";

function extractJSON(text: string): string {
  let jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const firstBrace = jsonStr.indexOf("{");
  const lastBrace = jsonStr.lastIndexOf("}");
  if (firstBrace > -1 && lastBrace > -1) {
    jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
  }
  return jsonStr;
}

async function callGroq(prompt: string, maxTokens: number): Promise<string> {
  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!groqRes.ok) {
    const errBody = await groqRes.json().catch(() => ({}));
    throw new Error(`Groq API error ${groqRes.status}: ${JSON.stringify(errBody)}`);
  }

  const groqData = await groqRes.json();
  const text: string = groqData?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error(`Empty response from Groq: ${JSON.stringify(groqData)}`);
  return text;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const form: TripFormData = req.body;

  if (!form.city || !form.country || !form.startDate || !form.endDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    // ── 1. Groq AI — core itinerary ────────────────────────────
    const prompt = buildItineraryPrompt(form);
    let rawText = await callGroq(prompt, 6000);
    let jsonStr = extractJSON(rawText);

    let itinerary: ItineraryData;
    try {
      itinerary = JSON.parse(jsonStr);
    } catch {
      const fixPrompt = `The following JSON is incomplete or malformed. Return ONLY the corrected, complete, valid JSON with no explanation or markdown:\n\n${jsonStr}`;
      const fixedText = await callGroq(fixPrompt, 6000);
      const fixedJson = extractJSON(fixedText);
      itinerary = JSON.parse(fixedJson);
    }

    // ── 2. Booking.com via RapidAPI (hotels) ───────────────────
    const rapidKey = process.env.RAPIDAPI_KEY;
    console.log("[Booking] RAPIDAPI_KEY present:", !!rapidKey);

    if (rapidKey) {
      try {
        // Step 1: buscar destino
        const destUrl = `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=${encodeURIComponent(form.city)}`;
        console.log("[Booking] destUrl:", destUrl);

        const destRes = await fetch(destUrl, {
          headers: {
            "x-rapidapi-key": rapidKey,
            "x-rapidapi-host": "booking-com15.p.rapidapi.com",
          },
        });

        const destRaw = await destRes.text();
        console.log("[Booking] destStatus:", destRes.status);
        console.log("[Booking] destRaw:", destRaw.slice(0, 500));

        const destData = JSON.parse(destRaw);
        const destId = destData?.data?.[0]?.dest_id;
        const destType = destData?.data?.[0]?.dest_type ?? "city";
        console.log("[Booking] destId:", destId, "destType:", destType);

        if (destId) {
          // Step 2: buscar hoteles
          const hotelUrl = `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels?dest_id=${destId}&dest_type=${destType}&checkin_date=${form.startDate}&checkout_date=${form.endDate}&adults_number=${form.travelers}&room_number=1&units=metric&currency_code=USD&languagecode=en-us&filter_by_currency=USD&page_number=1&include_adjacency=true`;
          console.log("[Booking] hotelUrl:", hotelUrl);

          const hotelRes = await fetch(hotelUrl, {
            headers: {
              "x-rapidapi-key": rapidKey,
              "x-rapidapi-host": "booking-com15.p.rapidapi.com",
            },
          });

          const hotelRaw = await hotelRes.text();
          console.log("[Booking] hotelStatus:", hotelRes.status);
          console.log("[Booking] hotelRaw:", hotelRaw.slice(0, 800));

          const hotelData = JSON.parse(hotelRaw);
          const rawHotels = hotelData?.data?.hotels ?? [];
          console.log("[Booking] rawHotels count:", rawHotels.length);

          if (rawHotels.length > 0) {
            console.log("[Booking] first hotel keys:", JSON.stringify(Object.keys(rawHotels[0])));
            console.log("[Booking] first hotel property:", JSON.stringify(rawHotels[0]?.property ?? rawHotels[0]).slice(0, 500));
          }

          const minStars: Record<string, number> = {
            economico: 0, moderado: 2, premium: 3, lujo: 4,
          };
          const min = minStars[form.budget] ?? 0;

          const hotels: Hotel[] = rawHotels
            .filter((h: any) => (h.property?.reviewScore ?? 0) >= 6)
            .filter((h: any) => (h.property?.propertyClass ?? 0) >= min)
            .slice(0, 5)
            .map((h: any) => {
              const p = h.property ?? h;
              const hotelId = p?.id ?? p?.hotelId ?? "";
              const bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(form.city)}&checkin=${form.startDate}&checkout=${form.endDate}&group_adults=${form.travelers}`;
              return {
                name: p?.name ?? "Hotel",
                stars: p?.propertyClass ?? 0,
                reviewScore: p?.reviewScore ?? 0,
                reviewCount: p?.reviewCount ?? 0,
                pricePerNight: p?.priceBreakdown?.grossPrice?.value
                  ? Math.round(p.priceBreakdown.grossPrice.value).toString()
                  : "N/A",
                currency: p?.priceBreakdown?.grossPrice?.currency ?? "USD",
                address: p?.address ?? p?.wishlistName ?? form.city,
                url: bookingUrl,
                photoUrl: Array.isArray(p?.photoUrls) ? p.photoUrls[0] : (p?.photoUrls ?? undefined),
                distanceFromCenter: p?.distanceToCC
                  ? `${parseFloat(p.distanceToCC).toFixed(1)} km from center`
                  : undefined,
              };
            });

          console.log("[Booking] mapped hotels count:", hotels.length);
          if (hotels.length > 0) itinerary.hotels = hotels;
        }
      } catch (bookingErr) {
        console.error("[Booking] ERROR:", bookingErr);
      }
    }

    // ── 3. OpenWeather ─────────────────────────────────────────
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
      } catch { }
    }

    // ── 4. Ticketmaster ────────────────────────────────────────
    if (process.env.TICKETMASTER_API_KEY) {
      try {
        const tmRes = await fetch(
          `https://app.ticketmaster.com/discovery/v2/events.json?city=${encodeURIComponent(form.city)}&startDateTime=${form.startDate}T00:00:00Z&endDateTime=${form.endDate}T23:59:59Z&size=5&apikey=${process.env.TICKETMASTER_API_KEY}`
        );
        const tmData = await tmRes.json();
        const tmEvents = tmData?._embedded?.events ?? [];
        for (const ev of tmEvents) {
          const existing = itinerary.events.find(e => e.name.toLowerCase() === ev.name.toLowerCase());
          if (!existing) {
            itinerary.events.unshift({
              name: ev.name,
              type: ev.classifications?.[0]?.segment?.name === "Music" ? "concert" : "festival",
              when: ev.dates?.start?.localDate ?? form.startDate,
              description: ev.info ?? ev.pleaseNote ?? "",
              price: ev.priceRanges ? `From €${ev.priceRanges[0].min}` : "See website",
              venue: ev._embedded?.venues?.[0]?.name ?? "",
              ticketUrl: ev.url ?? "",
            });
          }
        }
      } catch { }
    }

    // ── 5. Google Places ───────────────────────────────────────
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
      } catch { }
    }

    return res.status(200).json(itinerary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[generate] Error:", message);
    return res.status(500).json({ error: "Failed to generate itinerary", detail: message });
  }
}
