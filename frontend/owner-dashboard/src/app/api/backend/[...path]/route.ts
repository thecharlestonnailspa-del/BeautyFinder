import { NextResponse } from 'next/server';
import { getApiBaseUrl } from '../../../../lib/owner-api';
import { getOwnerSessionToken } from '../../../../lib/owner-session';

type RouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

async function handleRequest(request: Request, context: RouteContext) {
  const sessionToken = await getOwnerSessionToken();

  if (!sessionToken) {
    return NextResponse.json({ message: 'Owner session is required.' }, { status: 401 });
  }

  const { path = [] } = await context.params;
  const search = new URL(request.url).search;
  const upstreamUrl = `${getApiBaseUrl()}/${path.join('/')}${search}`;
  const headers = new Headers();
  const contentType = request.headers.get('content-type');

  headers.set('Authorization', `Bearer ${sessionToken}`);
  if (contentType) {
    headers.set('Content-Type', contentType);
  }

  try {
    const response = await fetch(upstreamUrl, {
      body:
        request.method === 'GET' || request.method === 'HEAD'
          ? undefined
          : await request.text(),
      cache: 'no-store',
      headers,
      method: request.method,
    });
    const responseHeaders = new Headers();
    const responseContentType = response.headers.get('content-type');

    if (responseContentType) {
      responseHeaders.set('Content-Type', responseContentType);
    }

    return new NextResponse(await response.arrayBuffer(), {
      headers: responseHeaders,
      status: response.status,
    });
  } catch {
    return NextResponse.json({ message: 'Could not reach the owner API.' }, { status: 503 });
  }
}

export function GET(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}

export function POST(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}

export function PATCH(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}

export function PUT(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}

export function DELETE(request: Request, context: RouteContext) {
  return handleRequest(request, context);
}
