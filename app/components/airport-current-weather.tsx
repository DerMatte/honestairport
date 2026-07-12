import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudMoon,
  CloudRain,
  CloudRainWind,
  CloudSnow,
  CloudSun,
  Moon,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { getAirportWeather } from "@/lib/airport-weather";

function weatherIcon(symbolCode: string): React.ReactNode {
  const [base, variant] = symbolCode.split("_");
  const night = variant === "night";

  let Icon: LucideIcon = Cloud;
  if (base.includes("thunder")) Icon = CloudLightning;
  else if (base.includes("sleet")) Icon = CloudHail;
  else if (base.includes("snow")) Icon = CloudSnow;
  else if (base.includes("heavyrain")) Icon = CloudRainWind;
  else if (base.includes("lightrain")) Icon = CloudDrizzle;
  else if (base.includes("rain")) Icon = CloudRain;
  else if (base === "fog") Icon = CloudFog;
  else if (base === "fair" || base === "partlycloudy") Icon = night ? CloudMoon : CloudSun;
  else if (base === "clearsky") Icon = night ? Moon : Sun;

  return <Icon className="size-4" aria-hidden="true" />;
}

/**
 * One quiet line of current conditions at the airport (met.no). Renders
 * nothing when the forecast is unavailable, so it never blocks the header.
 */
export async function AirportCurrentWeather({ iata }: { iata: string }) {
  const weather = await getAirportWeather(iata);

  if (!weather) {
    return null;
  }

  const celsius = Math.round(weather.temperatureC);
  const fahrenheit = Math.round((weather.temperatureC * 9) / 5 + 32);

  return (
    <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
      {weatherIcon(weather.symbolCode)}
      <span className="font-mono text-foreground">{celsius}°C</span>
      <span className="font-mono text-muted-foreground/70">/ {fahrenheit}°F</span>
      <span aria-hidden="true">·</span>
      <span>{weather.condition} right now</span>
    </p>
  );
}
