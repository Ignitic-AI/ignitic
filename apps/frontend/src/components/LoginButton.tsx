"use client";

import gsap from "gsap";
import { useRef } from "react";
import Link from 'next/link';
import { LogIn } from 'lucide-react';


export default function LoginButton(){
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const iconRef = useRef<SVGSVGElement>(null);

  const handleMouseEnter = () => {
    const button = buttonRef.current;
    if (!button) return;

    // Animate wave from bottom to top
    gsap.fromTo(
      button,
      {
        "--wave-y": "100%",
        "--wave-size": "100%",
      },
      {
        "--wave-y": "0%",
        duration: 0.15,
        ease: "power1.out",
      }
    );
    // Change text color for all content with z-10 class
    gsap.to(button.querySelectorAll(".relative.z-10"), {
      color: "#000",
      duration: 0.15,
      ease: "power1.out",
    });

  };

  const handleMouseLeave = () => {
    const button = buttonRef.current;
    if (!button) return;
    // Animate wave from top to bottom
    gsap.to(buttonRef.current, {
      "--wave-y": "100%",
      duration: 0.1,
      ease: "power1.out",
    });
    // Revert text color
    gsap.to(button.querySelectorAll(".relative.z-10"), {
      color: "#fff",
      duration: 0.1,
      ease: "power1.out",
    });
  };

  return (
     <Link
  href="/signup"
  ref={buttonRef}
  className="flex align-middle relative overflow-hidden bg-bg text-white border-2 rounded-full px-4 py-2 sm:px-4 sm:py-1.5 lg:px-6 lg:py-2 text-sm sm:text-lg lg:text-xl font-bold font-coconPro transition-colors duration-300 ease-in-out font-manrope
             before:content-[''] before:absolute before:left-0 before:top-[var(--wave-y,100%)] before:w-full before:h-full before:bg-white before:rounded-full before:transform before:transition-all before:duration-200 before:ease-out"
  onMouseEnter={handleMouseEnter}
  onMouseLeave={handleMouseLeave}
>
  <span className="relative z-10 whitespace-nowrap">Login</span>
  <LogIn className="inline-block ml-2 relative z-10" ref={iconRef} />
</Link>
  )
}
