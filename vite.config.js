import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    // React transform 수동 설정
    {
      name: 'react-transform',
      transform(code, id) {
        if (id.endsWith('.jsx') || id.endsWith('.tsx')) {
          // React import 자동 추가
          if (!code.includes('import React')) {
            return `import React from 'react';\n${code}`;
          }
        }
        return null;
      }
    }
  ],
  server: {
    host: '0.0.0.0',  // 모든 네트워크 인터페이스에서 접근 허용
    port: 3000,       // 포트 명시적 설정
  },
  build: {
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
        }
      }
    }
  },
  esbuild: {
    // 개발 모드에서는 console.log 유지, production에서만 제거
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : []
  }
})
