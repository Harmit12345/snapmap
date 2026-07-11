import { NextRequest, NextResponse } from 'next/server';
import { getFavorites } from '@/lib/store';

export async function GET(request: NextRequest) {
  const cursor = request.nextUrl.searchParams.get('cursor') || undefined;
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '20');

  const result = getFavorites({ cursor, limit });

  return NextResponse.json(result);
}
