import { Suspense } from "react";
import { ResumeWireframe } from "@/components/resume/ResumeWireframe";

export default function Home() {
  return (
    <Suspense fallback={null}>
      <ResumeWireframe />
    </Suspense>
  );
}
