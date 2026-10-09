// Local test provider. Production discovery always uses the configured Overpass service.
import { createServer } from "node:http";
import { URL, URLSearchParams } from "node:url";
const server = createServer(async (request, response) => {
  if (request.url === "/health") {
    response.end("ok");
    return;
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  const query =
    new URL(request.url, "http://localhost").searchParams.get("data") ||
    new URLSearchParams(body).get("data") ||
    "";
  if (query.includes(",0,0)")) {
    response.writeHead(503);
    response.end("Temporarily unavailable");
    return;
  }
  const elements = [
    {
      type: "node",
      id: 990005,
      lat: 14.5592,
      lon: 121.0245,
      tags: {
        name: "Fixture Heritage Museum",
        tourism: "museum",
        "addr:city": "Makati",
      },
    },
    {
      type: "node",
      id: 990001,
      lat: 14.5571,
      lon: 121.0242,
      tags: {
        name: "Fixture Garden Kitchen",
        amenity: "restaurant",
        cuisine: "filipino",
        "addr:city": "Makati",
        "addr:street": "Fixture Street",
      },
    },
    {
      type: "way",
      id: 990002,
      center: { lat: 14.558, lon: 121.023 },
      tags: {
        name: "Fixture Coffee House",
        amenity: "cafe",
        opening_hours: "Mo-Su 08:00-20:00",
      },
    },
    {
      type: "node",
      id: 990003,
      lat: 14.559,
      lon: 121.024,
      tags: { amenity: "restaurant" },
    },
    {
      type: "way",
      id: 990004,
      tags: { name: "Missing coordinates", amenity: "restaurant" },
    },
  ];
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify({ elements }));
});
server.listen(3101, "127.0.0.1", () =>
  console.log("Discovery test provider ready"),
);
