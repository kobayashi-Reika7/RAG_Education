import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 開発サーバーの優先ポートは 5100。5100 が使用中なら次の空きポートを使用する。
    port: 5100,
    strictPort: false,
    // 常に localhost で開き、既存タブと localStorage を共有しやすくする（TAB_ZERO_ISSUE.md 参照）
    open: 'http://localhost:5100',
  },
})
