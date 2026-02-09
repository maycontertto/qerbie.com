import { Suspense } from "react";
import AttendantSignUpClient from "./AttendantSignUpClient";

export default function AttendantSignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950" />}>
      <AttendantSignUpClient />
    </Suspense>
  );
}
