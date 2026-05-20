// src/pages/api/debug.ts — BORRAR DESPUÉS
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const city     = (req.query.city as string)    ?? "Madrid";
  const checkin  = (req.query.checkin as string) ?? "2026-06-10";
  const checkout = (req.query.checkout as string)?? "2026-06-14";

  const destRes  = await fetch(
    `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=${encodeURIComponent(city)}`,
    { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "", "x-rapidapi-host": "booking-com15.p.rapidapi.com" } }
  );
  const destData = await destRes.json();
  const cityResult = destData?.data?.find((d: any) => d.dest_type === "city") ?? destData?.data?.[0];

  const params = new URLSearchParams({
    dest_id: cityResult?.dest_id, search_type: "CITY",
    arrival_date: checkin, departure_date: checkout,
    adults: "2", room_qty: "1", currency_code: "USD", languagecode: "en-us", page_number: "1",
  });

  const hotelRes  = await fetch(
    `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchHotels?${params}`,
    { headers: { "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "", "x-rapidapi-host": "booking-com15.p.rapidapi.com" } }
  );
  const hotelData = await hotelRes.json();
  const first = hotelData?.data?.hotels?.[0];

  // Mostrar todos los campos del primer hotel para encontrar el ID correcto
  return res.status(200).json({
    hotelKeys: Object.keys(first ?? {}),
    propertyKeys: Object.keys(first?.property ?? {}),
    hotelId: first?.hotelId,
    propertyId: first?.property?.id,
    accessibilityLabel: first?.accessibilityLabel?.slice(0, 100),
    name: first?.property?.name,
  });
}
