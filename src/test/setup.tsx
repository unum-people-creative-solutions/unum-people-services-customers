import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock do framer-motion para evitar delays de animação nos testes
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))
