import { XMLParser } from 'fast-xml-parser';

import { fallbackAlerts } from '../data/content';
import { ScamAlert } from '../types/app';

const FTC_CONSUMER_RSS = 'https://www.consumer.ftc.gov/blog/gd-rss.xml';

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

export async function fetchScamAlerts(): Promise<ScamAlert[]> {
  try {
    const response = await fetch(FTC_CONSUMER_RSS);
    if (!response.ok) throw new Error(`FTC feed unavailable: ${response.status}`);

    const xml = await response.text();
    const parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
    const parsed = parser.parse(xml);
    const items = toArray(parsed?.rss?.channel?.item).slice(0, 8);

    const alerts = items
      .map((item, index) => ({
        id: item.guid?.['#text'] ?? item.link ?? `ftc-${index}`,
        title: item.title ?? 'Consumer alert',
        source: 'FTC Consumer Alerts',
        date: item.pubDate ?? 'Recent',
        summary: String(item.description ?? '').replace(/<[^>]*>/g, '').slice(0, 180),
        url: item.link ?? 'https://consumer.ftc.gov/consumer-alerts',
      }))
      .filter((item) => /scam|fraud|phish|impersonat|identity|text|call|qr|medicare|bank/i.test(`${item.title} ${item.summary}`));

    return alerts.length ? alerts : fallbackAlerts;
  } catch {
    return fallbackAlerts;
  }
}
