import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { essayFs } from './scripts/essay-fs-plugin.ts'

export default defineConfig({
  plugins: [react(), essayFs()],
})
