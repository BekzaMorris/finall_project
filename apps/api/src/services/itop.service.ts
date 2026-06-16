import { env } from '../config/env.js';

type LocalTicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

interface SendTicketToItopInput {
  ticketNumber: string;
  subject: string;
  description: string;
  priority: LocalTicketPriority;
  requesterEmail: string;
  requesterName?: string | null;
}

interface ItopCreateSuccessObject {
  key?: string;
  fields?: {
    id?: string | number;
    friendlyname?: string;
  };
}

interface ItopResponse {
  code: number;
  message: string;
  objects?: Record<string, ItopCreateSuccessObject>;
}

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function toItopHtmlDescription(input: {
  ticketNumber: string;
  requesterEmail: string;
  requesterName?: string | null;
  description: string;
}): string {
  const safeTicketNumber = escapeHtml(input.ticketNumber);
  const safeEmail = escapeHtml(input.requesterEmail);
  const safeName = escapeHtml(input.requesterName ?? 'Unknown');
  const safeDescription = escapeHtml(input.description).replace(/\r?\n/g, '<br>');

  return [
    `<p><strong>Local ticket:</strong> ${safeTicketNumber}</p>`,
    `<p><strong>Requester:</strong> ${safeName} (${safeEmail})</p>`,
    `<p><strong>Message:</strong><br>${safeDescription}</p>`,
  ].join('');
}

function mapPriorityToUrgency(priority: LocalTicketPriority): string {
  switch (priority) {
    case 'LOW':
      return '4';
    case 'MEDIUM':
      return '3';
    case 'HIGH':
      return '2';
    case 'URGENT':
      return '1';
    default:
      return '3';
  }
}

export function isItopEnabled(): boolean {
  return env.ITOP_ENABLED === 'true';
}

export async function sendTicketToItop(input: SendTicketToItopInput): Promise<{
  success: boolean;
  itopId?: string | number;
  itopRef?: string;
  raw?: unknown;
}> {
  if (!isItopEnabled()) {
    return { success: false };
  }

  // ITOP_URL already contains the full endpoint URL:
  // e.g. https://itsm.bgrc.kz/webservices/rest.php?version=1.3
  const apiUrl = env.ITOP_URL;

  const jsonData = {
    operation: 'core/create',
    comment: `Created from website support ticket ${input.ticketNumber}`,
    class: env.ITOP_TICKET_CLASS,
    output_fields: 'id,friendlyname',
    fields: {
      title: `[${input.ticketNumber}] ${input.subject}`,
      description: toItopHtmlDescription({
        ticketNumber: input.ticketNumber,
        requesterEmail: input.requesterEmail,
        requesterName: input.requesterName,
        description: input.description,
      }),
      origin: 'portal',
      urgency: mapPriorityToUrgency(input.priority),
    },
  };

  const form = new URLSearchParams();

  // Use auth_token if available, otherwise fall back to user/pwd
  if (env.ITOP_AUTH_TOKEN) {
    form.set('auth_token', env.ITOP_AUTH_TOKEN);
  } else {
    form.set('auth_user', env.ITOP_AUTH_USER);
    form.set('auth_pwd', env.ITOP_AUTH_PWD);
  }

  form.set('json_data', JSON.stringify(jsonData));

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`iTop HTTP error ${response.status}: ${responseText}`);
  }

  let parsed: ItopResponse;
  try {
    parsed = JSON.parse(responseText) as ItopResponse;
  } catch {
    throw new Error(`iTop returned non-JSON response: ${responseText}`);
  }

  if (parsed.code !== 0) {
    throw new Error(`iTop API error ${parsed.code}: ${parsed.message}`);
  }

  const firstObject = parsed.objects ? Object.values(parsed.objects)[0] : undefined;
  const itopId = firstObject?.fields?.id;
  const itopRef = firstObject?.fields?.friendlyname;

  return {
    success: true,
    itopId,
    itopRef,
    raw: parsed,
  };
}
