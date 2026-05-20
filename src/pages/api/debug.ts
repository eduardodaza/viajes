// src/pages/api/debug.ts — BORRAR DESPUÉS
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const city      = (req.query.city as string)      ?? "Madrid";
  const checkin   = (req.query.checkin as string)   ?? "2026-06-01";
  const checkout  = (req.query.checkout as string)  ?? "2026-06-04";
  const adults    = (req.query.adults as string)    ?? "2";

  try {
    // Step 1: dest_id
    const destRes  = await fetch(
      `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=${encodeURIComponent(city)}`,
      { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "", "x-rapidapi-host": "booking-com15.p.rapidapi.com" } }
    );
    const destData = await destRes.json();
    const destId   = destData?.data?.[0]?.dest_id;
    const destType = destData?.data?.[0]?.dest_type ?? "city";

    if (!destId) return res.status(200).json({ error: "No dest_id found", destData });

    // Step 2: hotels
    const hotelUrl = `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels?dest_id=${destId}&dest_type=${destType}&checkin_date=${checkin}&checkout_date=${checkout}&adults_number=${adults}&room_number=1&units=metric&currency_code=USD&languagecode=en-us&page_number=1`;
    const hotelRes = await fetch(hotelUrl, {
      headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "", "x-rapidapi-host": "booking-com15.p.rapidapi.com" }
    });
    const hotelText = await hotelRes.text();

    return res.status(200).json({
      destId,
      destType,
      hotelStatus: hotelRes.status,
      hotelResponse: JSON.parse(hotelText.slice(0, 2000)),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
