'use client'

import { motion } from "framer-motion"
import Image from "next/image"
import wlogo from "@/../public/white-logo.png"
import darkLogo from "@/../public/dark-logo.png"

interface LoadingLogoProps {
  bgColor?: string; 
}

export function LoadingLogo({ bgColor = "bg-bg-dark-lm dark:bg-bg-dark" }: LoadingLogoProps) {
  return (
    <div className={`flex items-center justify-center h-screen ${bgColor}`}>
      <motion.div
        initial={{ opacity: 0.4 }}
        animate={{ opacity: [0.2, 0.8, 0.2] }}
        transition={{
          duration: 1.2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Light / Dark logos */}
        <Image
          src={darkLogo}
          alt="White Logo"
          width={100}
          height={50}
          className="block dark:hidden"
        />
        <Image
          src={wlogo}
          alt="Dark Logo"
          width={100}
          height={50}
          className="hidden dark:block"
        />
      </motion.div>
    </div>
  )
}
