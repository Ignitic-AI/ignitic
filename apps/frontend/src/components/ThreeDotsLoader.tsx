import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// Define the types
type LoaderSize = 'small' | 'medium' | 'large'
interface ThreeDotsLoaderProps {
  size?: LoaderSize
  color?: string
  speed?: number
}

const ThreeDotsLoader = ({ 
  size = 'medium',
  color,
  speed = 1.3
}: ThreeDotsLoaderProps) => {
  // Size variants with proper typing
  const sizeMap: Record<LoaderSize, { dot: number; gap: number }> = {
    small: { dot: 6, gap: 4 },
    medium: { dot: 8, gap: 6 },
    large: { dot: 12, gap: 8 }
  }

  const { dot: dotSize, gap } = sizeMap[size]

  // Animation variants for each dot
  const dotVariants = {
    animate: (i: number) => ({
      y: [0, -dotSize * 1, 0],
      transition: {
        y: {
          repeat: Infinity,
          duration: speed,
          delay: i * 0.25,
          ease: "easeInOut" as const
        }
      }
    })
  }

  return (
    <div 
      className="three-dots-loader"
      style={{ 
        display: 'flex',
        gap: `${gap}px`,
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          custom={index}
          variants={dotVariants}
          animate="animate"
          className={cn(
            "rounded-full opacity-70",
            !color && "bg-black dark:bg-blue-500"
          )}
          style={{
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            backgroundColor: color,
          }}
        />
      ))}
    </div>
  )
}

export default ThreeDotsLoader