import { compressToEncodedURIComponent } from "lz-string";

const FETCH_TIMEOUT_MS = 12_000;
const LIVE_DATA_REVALIDATE_SECONDS = 3600;

const FAA_NAS_STATUS_URL = "https://nasstatus.faa.gov/api/airport-status-information";
const FLIGHTY_AIRPORTS_URL = "https://flighty.com/airports";
const PORT_AUTHORITY_GRAPHQL_URL = "https://www.jfkairport.com/api/graphql";
const LAX_WAIT_TIMES_URL = "https://www.flylax.com/wait-times";

const PORT_AUTHORITY_AIRPORTS = new Set(["JFK", "EWR", "LGA"]);
const FAA_US_AIRPORTS = new Set(["JFK", "LAX", "EWR", "LGA", "ATL", "ORD", "DFW", "DEN", "SFO", "SEA", "MIA", "BOS", "IAD", "DCA", "PHX", "LAS", "MCO", "CLT", "MSP", "DTW", "PHL", "SLC", "BWI", "SAN", "TPA", "PDX", "STL", "HNL", "AUS", "BNA", "CLE", "PIT", "RDU", "SMF", "SJC", "OAK", "SAT", "IND", "CMH", "MCI", "MSY", "RSW", "PBI", "FLL", "OMA", "OKC", "ABQ", "TUS", "BOI", "GEG", "ANC"]);

export type SecurityLaneType = "standard" | "precheck" | "other";
export type CheckpointStatus = "open" | "closed" | "unknown";
export type DisruptionType =
  | "ground_delay"
  | "ground_stop"
  | "departure_delay"
  | "arrival_delay"
  | "closure"
  | "other";
export type OperationalStatus = "normal" | "delayed" | "closed" | "unknown";

export interface SecurityCheckpoint {
  id: string;
  name: string;
  terminal?: string;
  laneType: SecurityLaneType;
  waitMinutes: number | null;
  displayWait: string;
  status: CheckpointStatus;
  lastUpdated?: string;
}

export interface AirportDisruption {
  type: DisruptionType;
  reason: string;
  minDelay?: string;
  maxDelay?: string;
  trend?: string;
}

export interface AirportLiveData {
  iata: string;
  fetchedAt: string;
  security: {
    supported: boolean;
    checkpoints: SecurityCheckpoint[];
    message?: string;
    source?: string;
    sourceUrl?: string;
  };
  disruptions: {
    supported: boolean;
    status: OperationalStatus;
    items: AirportDisruption[];
    updatedAt?: string;
    message?: string;
    source?: string;
    sourceUrl?: string;
  };
}

interface PortAuthorityWaitRow {
  title?: string;
  terminal?: string;
  queueType?: string;
  isOpen?: boolean;
  waitTime?: number;
  isWaitTimeAvailable?: boolean;
  status?: string;
  lastUpdated?: string;
}

interface PortAuthorityGraphqlResponse {
  data?: {
    securityWaitTimes?: PortAuthorityWaitRow[];
  };
  errors?: Array<{ message?: string }>;
}

function withTimeout(signal?: AbortSignal): AbortSignal {
  return AbortSignal.any([
    AbortSignal.timeout(FETCH_TIMEOUT_MS),
    ...(signal ? [signal] : []),
  ]);
}

function formatWaitMinutes(waitMinutes: number): string {
  if (waitMinutes <= 0) {
    return "No wait";
  }

  if (waitMinutes < 10) {
    return "Less than 10 min";
  }

  return `${waitMinutes} min`;
}

function laneTypeFromQueue(queueType?: string): SecurityLaneType {
  if (queueType === "TSAPre") {
    return "precheck";
  }

  if (queueType === "Reg") {
    return "standard";
  }

  return "other";
}

function laneLabel(laneType: SecurityLaneType): string {
  switch (laneType) {
    case "precheck":
      return "TSA PreCheck";
    case "standard":
      return "General screening";
    default:
      return "Security lane";
  }
}

function parseXmlBlocks(xml: string, blockTag: string): string[] {
  const pattern = new RegExp(`<${blockTag}>([\\s\\S]*?)</${blockTag}>`, "g");
  return [...xml.matchAll(pattern)].map((match) => match[1]);
}

function readXmlValue(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return match?.[1]?.trim();
}

function flightyAirportUrl(iata: string): string {
  return `${FLIGHTY_AIRPORTS_URL}/${iata.toUpperCase()}`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function htmlToVisibleLines(html: string): string[] {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n");

  const lines = decodeHtmlEntities(text)
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  return lines.filter((line, index) => line !== lines[index - 1]);
}

function findLineAfter(
  lines: string[],
  label: string,
  predicate: (line: string) => boolean,
): string | undefined {
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (lines[index] === label && predicate(lines[index + 1])) {
      return lines[index + 1];
    }
  }
}

function flightyStatusFromLabel(
  label: string | undefined,
  items: AirportDisruption[],
): OperationalStatus {
  const normalized = label?.toLowerCase() ?? "";

  if (normalized.includes("closed") || normalized.includes("ground stop")) {
    return "closed";
  }

  if (normalized.includes("issue") || normalized.includes("delay") || items.length > 0) {
    return "delayed";
  }

  if (normalized.includes("normal") || normalized.includes("good")) {
    return "normal";
  }

  return items.length > 0 ? "delayed" : "unknown";
}

function flightyAverageDelay(sentence: string): string | undefined {
  const match = sentence.match(/(\d+\s*(?:m|min|minutes?|h|hr|hours?)) late on average/i);
  return match ? `${match[1].replace(/\s+/g, "")} avg` : undefined;
}

function isAdverseWeatherSummary(summary: string): boolean {
  return /\b(storm|thunder|snow|ice|icing|de-icing|fog|low visibility|wind|gust|hail|rain|freezing)\b/i.test(
    summary,
  );
}

async function fetchPortAuthorityWaitTimes(airportCode: string): Promise<SecurityCheckpoint[]> {
  const query = `query GetSecurityWaitTimes($airportCode: String!, $terminal: String) {
  securityWaitTimes(airportCode: $airportCode, terminal: $terminal) {
    title
    terminal
    gate
    checkPoint
    queueType
    isOpen
    waitTime
    isWaitTimeAvailable
    status
    lastUpdated
  }
}`;

  const payload = {
    operationName: "GetSecurityWaitTimes",
    variables: { airportCode },
    extensions: { clientLibrary: { name: "@apollo/client", version: "4.0.4" } },
    query,
  };

  const response = await fetch(PORT_AUTHORITY_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "content-type": "text/plain",
      accept: "application/graphql-response+json,application/json;q=0.9",
      origin: "https://www.jfkairport.com",
      referer: "https://www.jfkairport.com/",
    },
    body: compressToEncodedURIComponent(JSON.stringify(payload)),
    signal: withTimeout(),
    next: { revalidate: LIVE_DATA_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`Port Authority GraphQL returned ${response.status}`);
  }

  const json = (await response.json()) as PortAuthorityGraphqlResponse;

  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Port Authority GraphQL error");
  }

  const rows = json.data?.securityWaitTimes ?? [];

  return rows.map((row, index) => {
    const laneType = laneTypeFromQueue(row.queueType);
    const isOpen = row.isOpen === true && row.isWaitTimeAvailable !== false;
    const waitMinutes =
      isOpen && typeof row.waitTime === "number" ? Math.max(0, Math.round(row.waitTime)) : null;

    return {
      id: `${airportCode.toLowerCase()}-${row.terminal ?? index}-${row.queueType ?? "lane"}`,
      name: row.title?.trim() || `Terminal ${row.terminal ?? index + 1}`,
      terminal: row.terminal ? `Terminal ${row.terminal}` : undefined,
      laneType,
      waitMinutes,
      displayWait: !isOpen || waitMinutes === null ? "Closed" : formatWaitMinutes(waitMinutes),
      status: !isOpen ? "closed" : "open",
      lastUpdated: row.lastUpdated,
    } satisfies SecurityCheckpoint;
  });
}

function waitTextToMinutes(waitText: string): number | null {
  const normalized = waitText.toLowerCase().trim();

  if (!normalized || normalized.includes("closed") || normalized.includes("n/a")) {
    return null;
  }

  const direct = normalized.match(/(\d+)/);
  return direct ? Number(direct[1]) : null;
}

async function fetchLaxWaitTimes(): Promise<{ checkpoints: SecurityCheckpoint[]; lastUpdated?: string }> {
  const response = await fetch(LAX_WAIT_TIMES_URL, {
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "User-Agent": "TravelGuide/1.0 (+https://github.com/DerMatte/travelguide)",
    },
    signal: withTimeout(),
    next: { revalidate: LIVE_DATA_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`LAX wait page returned ${response.status}`);
  }

  const html = await response.text();
  const rows = [...html.matchAll(/<td>\s*([^<]+)<\/td>\s*<td>\s*([^<]+)<\/td>\s*<td>\s*([^<]+)<\/td>\s*<\/tr>/g)];

  const checkpoints = rows.map((match, index) => {
    const terminal = match[1].trim();
    const boardingType = match[2].trim();
    const displayWait = match[3].trim();
    const laneType = boardingType.toLowerCase().includes("pre") ? "precheck" : "standard";
    const waitMinutes = waitTextToMinutes(displayWait);

    return {
      id: `lax-${index + 1}`,
      name: terminal,
      terminal,
      laneType,
      waitMinutes,
      displayWait: waitMinutes === null ? displayWait : formatWaitMinutes(waitMinutes),
      status: waitMinutes === null ? "unknown" : "open",
    } satisfies SecurityCheckpoint;
  });

  if (checkpoints.length === 0) {
    throw new Error("LAX wait page returned no checkpoint rows");
  }

  const timestampText = html.match(
    /<div[^>]*>\s*Data Last Updated:\s*<\/div>\s*<div[^>]*>\s*([^<]+)<\/div>/,
  )?.[1]?.trim();

  return {
    checkpoints,
    lastUpdated: timestampText,
  };
}

async function fetchSecurityWaitTimes(iata: string): Promise<AirportLiveData["security"]> {
  const code = iata.toUpperCase();

  if (PORT_AUTHORITY_AIRPORTS.has(code)) {
    try {
      const checkpoints = await fetchPortAuthorityWaitTimes(code);

      return {
        supported: true,
        checkpoints,
        source: "Port Authority of NY & NJ",
        sourceUrl: "https://www.jfkairport.com/",
      };
    } catch (error) {
      return {
        supported: false,
        checkpoints: [],
        message: error instanceof Error ? error.message : "Unable to load security wait times.",
        source: "Port Authority of NY & NJ",
        sourceUrl: "https://www.jfkairport.com/",
      };
    }
  }

  if (code === "LAX") {
    try {
      const { checkpoints, lastUpdated } = await fetchLaxWaitTimes();

      return {
        supported: true,
        checkpoints: checkpoints.map((checkpoint) => ({
          ...checkpoint,
          lastUpdated,
        })),
        source: "Los Angeles World Airports",
        sourceUrl: LAX_WAIT_TIMES_URL,
      };
    } catch (error) {
      return {
        supported: false,
        checkpoints: [],
        message: error instanceof Error ? error.message : "Unable to load security wait times.",
        source: "Los Angeles World Airports",
        sourceUrl: LAX_WAIT_TIMES_URL,
      };
    }
  }

  return {
    supported: false,
    checkpoints: [],
    message:
      "Live checkpoint wait times are not published for this airport. Check the official airport site or app before travel.",
  };
}

function disruptionStatus(items: AirportDisruption[]): OperationalStatus {
  if (items.some((item) => item.type === "closure" || item.type === "ground_stop")) {
    return "closed";
  }

  if (items.length > 0) {
    return "delayed";
  }

  return "normal";
}

async function fetchFlightyDisruptions(iata: string): Promise<AirportLiveData["disruptions"]> {
  const code = iata.toUpperCase();
  const sourceUrl = flightyAirportUrl(code);

  try {
    const response = await fetch(sourceUrl, {
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "User-Agent": "TravelGuide/1.0 (+https://github.com/DerMatte/travelguide)",
      },
      signal: withTimeout(),
      next: { revalidate: LIVE_DATA_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      throw new Error(`Flighty Airports returned ${response.status}`);
    }

    const html = await response.text();
    const lines = htmlToVisibleLines(html);
    const items: AirportDisruption[] = [];
    const statusLabel = lines.find((line) =>
      /^(Normal Operations|Good Operations|Minor Issues|Major Issues|Delays Reported|Ground Stop|Closed)$/i.test(
        line,
      ),
    );
    const updatedAt = lines.find((line) => /^\d{1,2}:\d{2}\s?[A-Z]{2,4}$/.test(line));
    const departureSummary = findLineAfter(lines, "Departures", (line) =>
      /^Flights are taking off/i.test(line),
    );
    const arrivalSummary = findLineAfter(lines, "Arrivals", (line) =>
      /^Flights are landing/i.test(line),
    );
    const weatherSummary = findLineAfter(lines, "Weather", (line) => !/^View Full/i.test(line));

    if (departureSummary && !/\bon time\b/i.test(departureSummary)) {
      items.push({
        type: "departure_delay",
        reason: departureSummary,
        minDelay: flightyAverageDelay(departureSummary),
      });
    }

    if (arrivalSummary && !/\bon time\b/i.test(arrivalSummary)) {
      items.push({
        type: "arrival_delay",
        reason: arrivalSummary,
        minDelay: flightyAverageDelay(arrivalSummary),
      });
    }

    if (weatherSummary && isAdverseWeatherSummary(weatherSummary)) {
      items.push({
        type: "other",
        reason: `Weather: ${weatherSummary}`,
      });
    }

    if (items.length === 0 && statusLabel && !/normal|good/i.test(statusLabel)) {
      items.push({
        type: "other",
        reason: statusLabel,
      });
    }

    const status = flightyStatusFromLabel(statusLabel, items);

    return {
      supported: true,
      status,
      items,
      updatedAt,
      message:
        items.length === 0
          ? status === "normal"
            ? "No Flighty-reported operational issues for this airport."
            : "Flighty did not publish detailed operational issue text for this airport."
          : undefined,
      source: "Flighty Airports",
      sourceUrl,
    };
  } catch (error) {
    return {
      supported: false,
      status: "unknown",
      items: [],
      message: error instanceof Error ? error.message : "Unable to load Flighty airport status.",
      source: "Flighty Airports",
      sourceUrl,
    };
  }
}

async function fetchFaaDisruptions(iata: string): Promise<AirportLiveData["disruptions"]> {
  const code = iata.toUpperCase();

  if (!FAA_US_AIRPORTS.has(code)) {
    return {
      supported: false,
      status: "unknown",
      items: [],
      message:
        "Live FAA operational status is only available for US airports. Check the official airport site for international disruptions.",
    };
  }

  try {
    const response = await fetch(FAA_NAS_STATUS_URL, {
      signal: withTimeout(),
      next: { revalidate: LIVE_DATA_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      throw new Error(`FAA NAS Status returned ${response.status}`);
    }

    const xml = await response.text();
    const updatedAt = readXmlValue(xml, "Update_Time");
    const items: AirportDisruption[] = [];

    for (const block of parseXmlBlocks(xml, "Ground_Delay")) {
      if (readXmlValue(block, "ARPT") !== code) {
        continue;
      }

      items.push({
        type: "ground_delay",
        reason: readXmlValue(block, "Reason") ?? "Ground delay program",
        minDelay: readXmlValue(block, "Avg"),
        maxDelay: readXmlValue(block, "Max"),
      });
    }

    for (const block of parseXmlBlocks(xml, "Delay")) {
      if (readXmlValue(block, "ARPT") !== code) {
        continue;
      }

      const delayBlock = block.match(/<Arrival_Departure[^>]*>([\s\S]*?)<\/Arrival_Departure>/)?.[1];
      const delayType = block.match(/Type="([^"]+)"/)?.[1]?.toLowerCase();

      items.push({
        type: delayType === "arrival" ? "arrival_delay" : "departure_delay",
        reason: readXmlValue(block, "Reason") ?? "Operational delay",
        minDelay: delayBlock ? readXmlValue(delayBlock, "Min") : undefined,
        maxDelay: delayBlock ? readXmlValue(delayBlock, "Max") : undefined,
        trend: delayBlock ? readXmlValue(delayBlock, "Trend") : undefined,
      });
    }

    for (const block of parseXmlBlocks(xml, "Airport")) {
      if (readXmlValue(block, "ARPT") !== code) {
        continue;
      }

      items.push({
        type: "closure",
        reason: readXmlValue(block, "Reason") ?? "Airport closure",
        minDelay: readXmlValue(block, "Start"),
        maxDelay: readXmlValue(block, "Reopen"),
      });
    }

    return {
      supported: true,
      status: disruptionStatus(items),
      items,
      updatedAt,
      message: items.length === 0 ? "No FAA-reported operational issues for this airport." : undefined,
      source: "FAA National Airspace System Status",
      sourceUrl: "https://nasstatus.faa.gov/",
    };
  } catch (error) {
    return {
      supported: true,
      status: "unknown",
      items: [],
      message: error instanceof Error ? error.message : "Unable to load FAA operational status.",
      source: "FAA National Airspace System Status",
      sourceUrl: "https://nasstatus.faa.gov/",
    };
  }
}

export async function getAirportLiveData(iata: string): Promise<AirportLiveData> {
  const normalizedIata = iata.toUpperCase();
  const [security, flightyDisruptions] = await Promise.all([
    fetchSecurityWaitTimes(normalizedIata),
    fetchFlightyDisruptions(normalizedIata),
  ]);
  const disruptions = flightyDisruptions.supported
    ? flightyDisruptions
    : await fetchFaaDisruptions(normalizedIata);

  return {
    iata: normalizedIata,
    fetchedAt: new Date().toISOString(),
    security,
    disruptions,
  };
}

export function getSecurityLaneLabel(laneType: SecurityLaneType): string {
  return laneLabel(laneType);
}
