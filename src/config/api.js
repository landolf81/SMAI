// API 설정 상수
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8801';
export const API_URL = `${API_BASE_URL}/api`;

// 기본 이미지 (SVG base64)
export const DEFAULT_AD_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQiIGhlaWdodD0iNjQiIHZpZXdCb3g9IjAgMCA2NCA2NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0zMiAyNkMzNC4yMDkxIDI2IDM2IDI3Ljc5MDkgMzYgMzBDMzYgMzIuMjA5MSAzNC4yMDkxIDM0IDMyIDM0QzI5Ljc5MDkgMzQgMjggMzIuMjA5MSAyOCAzMEMyOCAyNy43OTA5IDI5Ljc5MDkgMjYgMzIgMjZaIiBmaWxsPSIjOUIxMDNGIi8+CjxwYXRoIGQ9Ik0yMiAyNEMyMy4xMDQ2IDI0IDI0IDIzLjEwNDYgMjQgMjJDMjQgMjAuODk1NCAyMy4xMDQ2IDIwIDIyIDIwQzIwLjg5NTQgMjAgMjAgMjAuODk1NCAyMCAyMkMyMCAyMy4xMDQ2IDIwLjg5NTQgMjQgMjIgMjRaIiBmaWxsPSIjOUIxMDNGIi8+CjxwYXRoIGQ9Ik0xNiA0MEg0OFY0MkgxNlY0MFoiIGZpbGw9IiM5QjEwM0YiLz4KPC9zdmc+';

// 이미지 URL 생성 헬퍼 함수
export const getImageUrl = (imagePath) => {
  if (!imagePath) return DEFAULT_AD_IMAGE;
  if (imagePath.startsWith('http')) return imagePath;
  return `${API_BASE_URL}${imagePath}`;
};