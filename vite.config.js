import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
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
    // 프로덕션 빌드에서 console과 debugger 완전 제거
    drop: mode === 'production' ? ['console', 'debugger'] : []
  }
}))
