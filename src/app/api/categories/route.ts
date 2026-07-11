import { NextResponse } from 'next/server';
import { getAllCategories } from '@/lib/store';

export async function GET() {
  const categories = getAllCategories();
  return NextResponse.json({ data: categories });
}
