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
    proxy: {
      // 기상청 API 프록시 (CORS 우회)
      '/api/kma': {
        target: 'https://apis.data.go.kr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/kma/, ''),
        secure: true,
      }
    }
  },
  build: {
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000, // 1MB로 제한 증가
    rollupOptions: {
      onwarn(warning, warn) {
        // MUI "use client" 디렉티브 경고 무시 (RSC 호환용 디렉티브, 빌드에 영향 없음)
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return;
        warn(warning);
      },
      output: {
        manualChunks: {
          // 핵심 라이브러리
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // UI 라이브러리
          'vendor-ui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          // 데이터 라이브러리
          'vendor-data': ['@tanstack/react-query', '@supabase/supabase-js'],
          // 유틸리티
          'vendor-utils': ['moment', 'axios'],
        }
      }
    }
  },
  esbuild: {
    // 프로덕션 빌드에서 debugger만 제거 (console.log는 디버깅용 유지)
    drop: mode === 'production' ? ['debugger'] : []
  }
}))
