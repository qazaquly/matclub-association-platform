import { authenticateRequest } from "@/lib/auth";
import { assertSameOrigin, clearSessionCookie, clientIp } from "@/lib/security";
import { recordAudit } from "@/db/queries";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const user = await authenticateRequest(request);
    if (user) {
      await recordAudit({
        actorUserId: user.id,
        actionType: "auth.logout",
        targetEntity: "user",
        targetEntityId: user.id,
        ipAddress: clientIp(request),
        sessionId: user.sessionId,
      });
    }
  } catch {
    // The cookie is still cleared even if audit recording is unavailable.
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/", request.url).toString(),
      "Set-Cookie": clearSessionCookie(new URL(request.url).protocol === "https:"),
    },
  });
}
