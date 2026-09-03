import { NextResponse } from "next/server";
import { isRateLimited } from "@/lib/customer/rateLimit";
import { getServiceAssistantReply } from "@/lib/customer/serviceAssistantReply";
import { isServiceVerticalKey } from "@/lib/customer/serviceVerticals";

const MAX_MESSAGE_LENGTH = 500;

interface ServiceAssistantRequestBody {
  message?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ vertical: string; qrToken: string }> },
) {
  const { vertical, qrToken } = await params;
  if (!isServiceVerticalKey(vertical)) {
    return NextResponse.json({ error: "invalid_vertical" }, { status: 404 });
  }

  const rateLimitKey = `service-assistant:${vertical}:${qrToken}:${req.headers.get("x-forwarded-for") ?? "unknown"}`;
  if (isRateLimited(rateLimitKey)) {
    return NextResponse.json(
      { reply: "Muitas mensagens em pouco tempo. Aguarde um instante e tente de novo." },
      { status: 429 },
    );
  }

  let body: ServiceAssistantRequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) {
    return NextResponse.json({ error: "empty_message" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }

  const result = await getServiceAssistantReply({ vertical, qrToken, message, history: body.history });
  return NextResponse.json({ reply: result.reply }, { status: result.status });
}
