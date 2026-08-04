export function isPlatformDemoUser(email: string | null | undefined): boolean {
  if (!email) return false;
  const demoEmails = (process.env.PLATFORM_DEMO_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return demoEmails.includes(email.toLowerCase());
}
