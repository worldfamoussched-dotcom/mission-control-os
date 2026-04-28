"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { worlds, worldIds, type WorldId } from "../lib/worlds";

const worldIcons: Record<WorldId, string> = {
  batman: "\u2666",
  wakanda: "\u2726",
  jarvis: "\u2699",
  oracle: "\u25C8",
};

export default function HomePage() {
  const router = useRouter();

  function enter(id: WorldId) {
    router.push(`/${id}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "#030308" }}>
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="text-center mb-16"
      >
        <h1
          className="font-[family-name:var(--font-display)] text-[14px] font-semibold tracking-[6px] uppercase mb-2"
          style={{ color: "#3cb4dc" }}
        >
          Oracle OS
        </h1>
        <p className="text-[28px] font-[family-name:var(--font-display)] font-light tracking-[3px]" style={{ color: "#c8d6e5" }}>
          Select Your World
        </p>
      </motion.div>

      {/* World Portals */}
      <div className="grid grid-cols-2 gap-[1px] max-w-[800px] w-full mx-8" style={{ background: "rgba(60,180,220,0.04)" }}>
        {worldIds.map((id, i) => {
          const w = worlds[id];
          return (
            <motion.button
              key={id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => enter(id)}
              className="relative p-8 text-left transition-all group cursor-pointer"
              style={{ background: w.colors.bg }}
            >
              {/* Background gradient on hover */}
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: w.gradients.hero }}
              />

              {/* Icon */}
              <div className="relative z-10">
                <span
                  className="text-[32px] block mb-4 transition-all group-hover:scale-110"
                  style={{ color: w.colors.accent + "60" }}
                >
                  {worldIcons[id]}
                </span>

                <h2
                  className="font-[family-name:var(--font-display)] text-[18px] font-semibold tracking-[3px] uppercase mb-1 transition-colors"
                  style={{ color: w.colors.textDim }}
                >
                  <span className="group-hover:text-current" style={{ color: undefined }}>
                    {w.name}
                  </span>
                </h2>

                <p className="text-[10px] tracking-[1px] uppercase mb-3" style={{ color: w.colors.accent + "80" }}>
                  {w.subtitle}
                </p>

                <p className="text-[9px] leading-relaxed" style={{ color: w.colors.textDim }}>
                  {w.domain}
                </p>

                {/* Module preview */}
                <div className="mt-4 flex flex-wrap gap-1">
                  {w.modules.slice(0, 4).map((mod) => (
                    <span
                      key={mod}
                      className="text-[7px] tracking-[0.5px] uppercase px-1.5 py-0.5 rounded"
                      style={{
                        background: w.colors.glow,
                        color: w.colors.accent + "80",
                      }}
                    >
                      {mod}
                    </span>
                  ))}
                  {w.modules.length > 4 && (
                    <span className="text-[7px]" style={{ color: w.colors.textDim }}>
                      +{w.modules.length - 4}
                    </span>
                  )}
                </div>
              </div>

              {/* Bottom accent line */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: w.colors.accent }}
              />
            </motion.button>
          );
        })}
      </div>

      {/* Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="mt-12 text-center"
      >
        <p className="text-[9px] tracking-[2px] uppercase" style={{ color: "rgba(200,214,229,0.2)" }}>
          Oracle sits above all worlds. It governs them.
        </p>
      </motion.div>
    </div>
  );
}
