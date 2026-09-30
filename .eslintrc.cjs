module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
  ],
  // 앱 JSX는 현재 Vite의 React.createElement 변환을 사용한다.
  overrides: [{
    files: ['src/**/*.jsx'],
    rules: {
      'react/jsx-uses-react': 'error',
      // React 18은 표준 fetchpriority HTML 속성을 소문자로 전달해야 경고가 없다.
      // unknown-property 검사는 유지하고 이 표준 속성만 허용한다.
      'react/no-unknown-property': ['error', { ignore: ['fetchpriority'] }],
    },
  }, {
    files: ['api/**/*.js', 'scripts/**/*.js', 'src/test/**/*.js'],
    env: { node: true },
  }],
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  settings: { react: { version: '18.2' } },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
  },
}
