// src/pages/api/debug.ts — BORRAR DESPUÉS
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const city     = (req.query.city as string)     ?? "Madrid";
  const checkin  = (req.query.checkin as string)  ?? "2026-06-01";
  const checkout = (req.query.checkout as string) ?? "2026-06-04";
  const adults   = (req.query.adults as string)   ?? "2";

  try {
    const destRes  = await fetch(
      `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=${encodeURIComponent(city)}`,
      { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "", "x-rapidapi-host": "booking-com15.p.rapidapi.com" } }
    );
    const destData = await destRes.json();
    const cityResult = destData?.data?.find((d: any) => d.dest_type === "city") ?? destData?.data?.[0];
    const destId   = cityResult?.dest_id;

    const params = new URLSearchParams({
      dest_id: destId, search_type: "CITY",
      arrival_date: checkin, departure_date: checkout,
      adults, room_qty: "1", currency_code: "USD", languagecode: "en-us", page_number: "1",
    });

    const hotelRes  = await fetch(
      `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels?${params}`,
      { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "", "x-rapidapi-host": "booking-com15.p.rapidapi.com" } }
    );
    const hotelData = await hotelRes.json();
    const rawHotels = hotelData?.data?.hotels ?? [];

    // Mostrar cuántos hay y los primeros 3 sin filtros
    return res.status(200).json({
      totalHotels: rawHotels.length,
      first3: rawHotels.slice(0, 3).map((h: any) => ({
        name: h.property?.name,
        stars: h.property?.propertyClass,
        reviewScore: h.property?.reviewScore,
        price: h.property?.priceBreakdown?.grossPrice?.value,
        currency: h.property?.priceBreakdown?.grossPrice?.currency,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
