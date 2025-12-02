/**
 * Cloudflare R2 Storage Service
 * 이미지/동영상 업로드를 위한 서비스
 */
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// R2 설정
const R2_ACCOUNT_ID = import.meta.env.VITE_R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = import.meta.env.VITE_R2_BUCKET_NAME;
const R2_PUBLIC_URL = import.meta.env.VITE_R2_PUBLIC_URL;

// S3 클라이언트 설정 (R2는 S3 호환)
const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

/**
 * 파일을 R2에 업로드
 * @param {File} file - 업로드할 파일
 * @param {string} folder - 저장할 폴더 경로 (예: 'posts', 'profiles')
 * @returns {Promise<{url: string, key: string}>} - 업로드된 파일의 퍼블릭 URL과 키
 */
export const uploadToR2 = async (file, folder = 'uploads') => {
  try {
    // 파일명 생성: timestamp_랜덤문자열_원본파일명
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const key = `${folder}/${timestamp}_${randomStr}_${sanitizedFileName}`;

    // 파일을 ArrayBuffer로 변환
    const arrayBuffer = await file.arrayBuffer();

    // S3 PutObject 명령 생성
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: new Uint8Array(arrayBuffer),
      ContentType: file.type,
      // 캐시 설정 (1년)
      CacheControl: 'public, max-age=31536000',
    });

    // 업로드 실행
    await s3Client.send(command);

    // 퍼블릭 URL 생성
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    console.log('✅ R2 업로드 성공:', publicUrl);
    return {
      url: publicUrl,
      key: key,
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
 * R2에서 파일 삭제
 * @param {string} key - 삭제할 파일의 키 (예: 'posts/123_abc_image.jpg')
 */
export const deleteFromR2 = async (key) => {
  try {
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    await s3Client.send(command);
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
};

export default r2Service;
