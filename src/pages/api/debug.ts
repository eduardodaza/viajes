// src/pages/api/debug.ts — BORRAR DESPUÉS
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const city = (req.query.city as string) ?? "Athens";

  try {
    const destRes = await fetch(
      `https://booking-com15.p.rapidapi.com/api/v1/hotels/searchDestination?query=${encodeURIComponent(city)}`,
      {
        headers: {
          "x-rapidapi-key": process.env.RAPIDAPI_KEY ?? "",
          "x-rapidapi-host": "booking-com15.p.rapidapi.com",
        },
      }
    );
    const destText = await destRes.text();

    return res.status(200).json({
      status: destRes.status,
      headers: Object.fromEntries(destRes.headers.entries()),
      body: destText.slice(0, 1000),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
