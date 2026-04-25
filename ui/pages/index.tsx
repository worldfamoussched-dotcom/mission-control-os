import { useEffect } from "react";
import { useRouter } from "next/router";

/**
 * Landing page — auto-redirects to the cockpit. Kept tiny so it never
 * blocks first paint or pulls in heavy components.
 */
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/cockpit");
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0a0a0f",
        color: "#9ca3af",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p>Loading cockpit…</p>
    </main>
  );
}
