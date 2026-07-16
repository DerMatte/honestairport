import { Badge } from "@/components/ui/badge";
import { getAirportWeather } from "@/lib/airport-weather";

function weatherEmoji(symbolCode: string): string {
  const [base, variant] = symbolCode.split("_");
  const night = variant === "night";

  if (base.includes("thunder")) return "⛈️";
  if (base.includes("sleet")) return "🌨️";
  if (base.includes("snow")) return "❄️";
  if (base.includes("heavyrain")) return "🌧️";
  if (base.includes("lightrain")) return "🌦️";
  if (base.includes("rain")) return "🌧️";
  if (base === "fog") return "🌫️";
  if (base === "fair") return night ? "🌙" : "🌤️";
  if (base === "partlycloudy") return night ? "☁️" : "⛅";
  if (base === "clearsky") return night ? "🌙" : "☀️";
  if (base === "cloudy") return "☁️";
  return "🌡️";
}

/**
 * Compact current-conditions label (met.no). Renders nothing when the
 * forecast is unavailable, so it never blocks the header.
 */
export async function AirportCurrentWeather({ iata }: { iata: string }) {
  const weather = await getAirportWeather(iata);

  if (!weather) {
    return null;
  }

  const celsius = Math.round(weather.temperatureC);

  return (
    <Badge
      variant="outline"
      className="gap-1 font-normal"
      aria-label={`${weather.condition}, ${celsius} degrees Celsius`}
    >
      <span aria-hidden="true">{weatherEmoji(weather.symbolCode)}</span>
      <span className="font-mono">{celsius}°C</span>
    </Badge>
  );
}
