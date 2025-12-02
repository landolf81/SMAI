/**
 * Cloudflare R2 Storage Service
 * Worker 프록시를 통한 안전한 파일 업로드
 */

// Worker 프록시 URL
const R2_WORKER_URL = import.meta.env.VITE_R2_WORKER_URL || 'https://smai-r2-proxy.landolf.workers.dev';
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL || 'https://pub-1d5977ce7cec48079bcd6f847b2f3dd1.r2.dev';

/**
 * 파일을 R2에 업로드 (Worker 프록시 사용)
 * @param {File} file - 업로드할 파일
 * @param {string} folder - 저장할 폴더 경로 (예: 'posts', 'profiles')
 * @returns {Promise<{url: string, key: string}>} - 업로드된 파일의 퍼블릭 URL과 키
 */
export const uploadToR2 = async (file, folder = 'uploads') => {
  try {
    // FormData 생성
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    // Worker 프록시로 업로드
    const response = await fetch(`${R2_WORKER_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `업로드 실패: ${response.status}`);
    }

    const result = await response.json();

    console.log('✅ R2 업로드 성공:', result.url);
    return {
      url: result.url,
      key: result.key,
    };
  } catch (error) {
    console.error('❌ R2 업로드 실패:', error);
    throw new Error(`파일 업로드 실패: ${error.message}`);
  }
};

/**
 * 여러 파일을 R2에 업로드
 * @param {File[]} files - 업로드할 파일 배열
 * @param {string} folder - 저장할 폴더 경로
 * @returns {Promise<Array<{url: string, key: string}>>} - 업로드된 파일들의 URL과 키 배열
 */
export const uploadMultipleToR2 = async (files, folder = 'uploads') => {
  const results = [];

  for (const file of files) {
    const result = await uploadToR2(file, folder);
    results.push(result);
  }

  return results;
};

/**
 * R2에서 파일 삭제 (Worker 프록시 사용)
 * @param {string} key - 삭제할 파일의 키 (예: 'posts/123_abc_image.jpg')
 */
export const deleteFromR2 = async (key) => {
  try {
    const response = await fetch(`${R2_WORKER_URL}/delete`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `삭제 실패: ${response.status}`);
    }

    console.log('✅ R2 파일 삭제 성공:', key);
  } catch (error) {
    console.error('❌ R2 파일 삭제 실패:', error);
    throw new Error(`파일 삭제 실패: ${error.message}`);
  }
};

/**
 * URL에서 R2 키 추출
 * @param {string} url - R2 퍼블릭 URL
 * @returns {string|null} - 추출된 키 또는 null
 */
export const extractR2KeyFromUrl = (url) => {
  if (!url || !url.includes(R2_PUBLIC_URL)) {
    return null;
  }
  return url.replace(`${R2_PUBLIC_URL}/`, '');
};

/**
 * Supabase URL인지 확인
 * @param {string} url - 확인할 URL
 * @returns {boolean}
 */
export const isSupabaseUrl = (url) => {
  if (!url) return false;
  return url.includes('supabase.co/storage');
};

/**
 * R2 URL인지 확인
 * @param {string} url - 확인할 URL
 * @returns {boolean}
 */
export const isR2Url = (url) => {
  if (!url) return false;
  return url.includes('r2.dev') || url.includes('r2.cloudflarestorage.com');
};

// R2 서비스 객체
export const r2Service = {
  upload: uploadToR2,
  uploadMultiple: uploadMultipleToR2,
  delete: deleteFromR2,
  extractKey: extractR2KeyFromUrl,
  isSupabaseUrl,
  isR2Url,
  publicUrl: R2_PUBLIC_URL,
  workerUrl: R2_WORKER_URL,
};

export default r2Service;
