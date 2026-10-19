/**
 * Minimal client for Mailpit, the local Supabase stack's mail catcher (`pnpm db:start`, port 54324).
 * Shared by the integration tests (Vitest, node) and the e2e tests (Playwright).
 *
 * API (Mailpit v1.31): GET /api/v1/search?query=…, GET /api/v1/message/{ID},
 * DELETE /api/v1/messages with {"IDs": […]}. Tests only ever delete their own messages: an empty
 * ID list would delete the whole mailbox, so it is never sent.
 */

export interface MailMessage {
  id: string;
  subject: string;
  html: string;
  text: string;
}

interface MessageSummary {
  id: string;
  to: string[];
  created: number;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(record: JsonRecord, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function parseSummary(value: unknown): MessageSummary | undefined {
  if (!isRecord(value)) return undefined;
  const id = stringField(value, 'ID');
  if (id === '') return undefined;
  const recipients = Array.isArray(value.To) ? value.To : [];
  const to = recipients.flatMap((entry) =>
    isRecord(entry) ? [stringField(entry, 'Address').toLowerCase()] : [],
  );
  return { id, to, created: Date.parse(stringField(value, 'Created')) || 0 };
}

const POLL_INTERVAL_MS = 250;
export const MAIL_TIMEOUT_MS = 30_000;

export class Mailpit {
  readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async send(path: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      throw new Error(
        `Mailpit ${init.method ?? 'GET'} ${path} failed with HTTP ${response.status}`,
      );
    }
    return response;
  }

  /** All messages addressed to exactly this address, oldest first. */
  async messagesTo(address: string): Promise<MessageSummary[]> {
    const wanted = address.toLowerCase();
    const query = encodeURIComponent(`to:"${wanted}"`);
    const body: unknown = await (await this.send(`/api/v1/search?query=${query}&limit=200`)).json();
    const messages = isRecord(body) && Array.isArray(body.messages) ? body.messages : [];
    return messages
      .map(parseSummary)
      .filter((message): message is MessageSummary => message?.to.includes(wanted) === true)
      .sort((a, b) => a.created - b.created);
  }

  async message(id: string): Promise<MailMessage> {
    const body: unknown = await (
      await this.send(`/api/v1/message/${encodeURIComponent(id)}`)
    ).json();
    if (!isRecord(body)) throw new Error(`Mailpit returned no message for ${id}`);
    return {
      id,
      subject: stringField(body, 'Subject'),
      html: stringField(body, 'HTML'),
      text: stringField(body, 'Text'),
    };
  }

  /**
   * Waits (polling, up to 30 s) for the oldest message to `address` whose ID is not in `seen`,
   * adds it to `seen` and returns it.
   */
  async nextMessage(
    address: string,
    seen: Set<string>,
    timeoutMs = MAIL_TIMEOUT_MS,
  ): Promise<MailMessage> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const next = (await this.messagesTo(address)).find((message) => !seen.has(message.id));
      if (next !== undefined) {
        seen.add(next.id);
        return this.message(next.id);
      }
      if (Date.now() > deadline) {
        throw new Error(`No new e-mail to ${address} arrived in Mailpit within ${timeoutMs} ms`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  /** Deletes every message to the given addresses (and nothing else). */
  async deleteMessagesTo(addresses: Iterable<string>): Promise<void> {
    const ids = new Set<string>();
    for (const address of addresses) {
      for (const message of await this.messagesTo(address)) ids.add(message.id);
    }
    if (ids.size === 0) return;
    await this.send('/api/v1/messages', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ IDs: [...ids] }),
    });
  }
}

/** Link types the app's e-mail templates use ({{ .SiteURL }}/auth/confirm?token_hash=…&type=…). */
export type ConfirmLinkType = 'email' | 'recovery' | 'email_change';

/**
 * The /auth/confirm link of an auth e-mail. Throws if the mail has none or the link type differs,
 * so a wrongly wired template fails loudly.
 */
export function confirmLink(message: MailMessage, expectedType: ConfirmLinkType): URL {
  const hrefs = [...message.html.matchAll(/href="([^"]+)"/g)].map((match) =>
    (match[1] ?? '').replaceAll('&amp;', '&'),
  );
  const textLinks = message.text.match(/https?:\/\/\S+/g) ?? [];
  const link = [...hrefs, ...textLinks]
    .flatMap((candidate) => (URL.canParse(candidate) ? [new URL(candidate)] : []))
    .find((url) => url.pathname === '/auth/confirm');
  if (link === undefined) {
    throw new Error(`E-mail "${message.subject}" contains no /auth/confirm link`);
  }
  const type = link.searchParams.get('type');
  if (type !== expectedType || !link.searchParams.get('token_hash')) {
    throw new Error(
      `E-mail "${message.subject}" links to /auth/confirm with type=${String(type)}, ` +
        `expected type=${expectedType} and a token_hash`,
    );
  }
  return link;
}
