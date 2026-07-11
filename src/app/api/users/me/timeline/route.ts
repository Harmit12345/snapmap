import { NextRequest, NextResponse } from 'next/server';
import { getTimeline } from '@/lib/store';

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get('cursor') || undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');
  const category = request.nextUrl.searchParams.get('category') || undefined;
  const status = request.nextUrl.searchParams.get('status') || undefined;

  const result = getTimeline({ cursor, limit, category, status });

  return NextResponse.json(result);
}
