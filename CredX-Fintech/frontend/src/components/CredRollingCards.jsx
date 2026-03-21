// import { useState } from "react";
// import { useAnimationFrame } from "framer-motion";

// export default function CredRollingCards() {
//   const [offset, setOffset] = useState(0);

//   useAnimationFrame((_, delta) => {
//     setOffset((prev) => prev + delta * 0.0004);
//   });

//   return (
//     <div className="absolute inset-0 pointer-events-none overflow-hidden">

//       {/* Deep Executive Gradient Base */}
//       <div
//         className="absolute inset-0"
//         style={{
//           background: `
//             radial-gradient(circle at 20% 30%, rgba(30,60,120,0.4), transparent 60%),
//             radial-gradient(circle at 80% 70%, rgba(10,20,40,0.6), transparent 60%)
//           `
//         }}
//       />

//       {/* Animated Grid Overlay */}
//       <div
//         className="absolute inset-0"
//         style={{
//           backgroundImage: `
//             linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
//             linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)
//           `,
//           backgroundSize: "60px 60px",
//           transform: `translateY(${offset * 200}px)`,
//           opacity: 0.25
//         }}
//       />

//       {/* Diagonal Light Sweep */}
//       <div
//         className="absolute w-[600px] h-[1200px]"
//         style={{
//           top: "-20%",
//           left: "50%",
//           transform: `
//             translateX(-50%)
//             rotate(20deg)
//             translateY(${Math.sin(offset) * 80}px)
//           `,
//           background:
//             "linear-gradient(to bottom, transparent, rgba(255,255,255,0.08), transparent)",
//           filter: "blur(120px)",
//           opacity: 0.6
//         }}
//       />

//       {/* Subtle Dark Vignette */}
//       <div
//         className="absolute inset-0"
//         style={{
//           background:
//             "radial-gradient(circle at center, transparent 60%, rgba(0,0,0,0.6))"
//         }}
//       />
//     </div>
//   );
// }
import { useState } from "react";
import { useAnimationFrame } from "framer-motion";

export default function CredRollingCards() {
  const [offset, setOffset] = useState(0);

  useAnimationFrame((_, delta) => {
    setOffset((prev) => prev + delta * 0.0005); // smooth & calm
  });

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">

      {/* Base soft gradient depth */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(120,160,255,0.15), transparent 60%),
            radial-gradient(circle at 80% 70%, rgba(255,200,150,0.10), transparent 60%)
          `
        }}
      />

      {/* Floating Soft Blobs */}
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: `${300 + i * 120}px`,
            height: `${300 + i * 120}px`,
            top: `${20 + i * 15}%`,
            left: `${60 + i * 8}%`,
            background: `
              radial-gradient(circle,
                rgba(255,255,255,0.08),
                transparent 70%
              )
            `,
            transform: `
              translateY(${Math.sin(offset + i) * 40}px)
              translateX(${Math.cos(offset + i) * 20}px)
            `,
            filter: "blur(80px)"
          }}
        />
      ))}

      {/* Thin Structured Lines */}
      {[...Array(4)].map((_, i) => (
        <div
          key={`line-${i}`}
          className="absolute"
          style={{
            width: "1px",
            height: "100%",
            left: `${20 + i * 15}%`,
            background: "rgba(255,255,255,0.05)",
            opacity: 0.5
          }}
        />
      ))}

      {/* Soft bottom fade */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, transparent 70%, rgba(0,0,0,0.6))"
        }}
      />
    </div>
  );
}