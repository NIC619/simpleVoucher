import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    hasPimlicoKey: !!process.env.PIMLICO_API_KEY,
  });
}
