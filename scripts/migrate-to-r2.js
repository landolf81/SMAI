/**
 * Supabase → Cloudflare R2 미디어 마이그레이션 스크립트
 *
 * 사용법:
 * 1. 프로젝트 루트에서 실행: node scripts/migrate-to-r2.js
 * 2. --dry-run 옵션으로 테스트: node scripts/migrate-to-r2.js --dry-run
 */

import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env 파일 로드
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 설정
const config = {
  supabase: {
    url: process.env.VITE_SUPABASE_URL,
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
  r2: {
    accountId: process.env.VITE_R2_ACCOUNT_ID,
    accessKeyId: process.env.VITE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.VITE_R2_SECRET_ACCESS_KEY,
    bucketName: process.env.VITE_R2_BUCKET_NAME,
    publicUrl: process.env.VITE_R2_PUBLIC_URL,
  },
  dryRun: process.argv.includes('--dry-run'),
};

// 클라이언트 초기화
const supabase = createClient(config.supabase.url, config.supabase.serviceKey);

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

// 통계
const stats = {
  total: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
  errors: [],
};

/**
 * URL에서 파일 다운로드
 */
async function downloadFile(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const buffer = await response.buffer();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    return { buffer, contentType };
  } catch (error) {
    throw new Error(`다운로드 실패: ${error.message}`);
  }
}

/**
 * R2에 파일 업로드
 */
async function uploadToR2(key, buffer, contentType) {
  const command = new PutObjectCommand({
    Bucket: config.r2.bucketName,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000',
  });

  await s3Client.send(command);
  return `${config.r2.publicUrl}/${key}`;
}

/**
 * R2에 파일이 이미 존재하는지 확인
 */
async function existsInR2(key) {
  try {
    const command = new HeadObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch (error) {
    if (error.name === 'NotFound') return false;
    throw error;
  }
}

/**
 * Supabase URL에서 R2 키 생성
 */
function generateR2Key(supabaseUrl, folder) {
  // URL에서 파일명 추출
  const urlParts = supabaseUrl.split('/');
  const filename = urlParts[urlParts.length - 1];

  // 특수문자 제거
  const sanitizedFilename = filename.replace(/[?#]/g, '').split('?')[0];

  // 타임스탬프 추가로 고유성 보장
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 6);

  return `${folder}/${timestamp}_${randomStr}_${sanitizedFilename}`;
}

/**
 * Supabase URL인지 확인
 */
function isSupabaseStorageUrl(url) {
  if (!url) return false;
  return url.includes('supabase.co/storage') || url.includes('supabase.in/storage');
}

/**
 * 단일 URL 마이그레이션
 */
async function migrateUrl(url, folder) {
  if (!isSupabaseStorageUrl(url)) {
    return { success: false, reason: 'not_supabase_url', newUrl: url };
  }

  const r2Key = generateR2Key(url, folder);

  // 이미 R2에 있는지 확인
  if (await existsInR2(r2Key)) {
    return { success: true, reason: 'already_exists', newUrl: `${config.r2.publicUrl}/${r2Key}` };
  }

  if (config.dryRun) {
    console.log(`  [DRY-RUN] 마이그레이션 예정: ${url} → ${r2Key}`);
    return { success: true, reason: 'dry_run', newUrl: `${config.r2.publicUrl}/${r2Key}` };
  }

  try {
    // 다운로드
    const { buffer, contentType } = await downloadFile(url);

    // 업로드
    const newUrl = await uploadToR2(r2Key, buffer, contentType);

    console.log(`  ✅ 마이그레이션 완료: ${url.substring(0, 50)}... → ${r2Key}`);
    return { success: true, reason: 'migrated', newUrl };
  } catch (error) {
    console.error(`  ❌ 마이그레이션 실패: ${error.message}`);
    return { success: false, reason: error.message, newUrl: url };
  }
}

/**
 * JSON 배열 또는 단일 URL 파싱
 */
function parsePhotoField(photo) {
  if (!photo) return [];

  // 이미 배열인 경우
  if (Array.isArray(photo)) return photo;

  // JSON 문자열인 경우 (예: '["url1", "url2"]')
  if (typeof photo === 'string' && photo.startsWith('[')) {
    try {
      const parsed = JSON.parse(photo);
      return Array.isArray(parsed) ? parsed : [photo];
    } catch (e) {
      // JSON 파싱 실패 시 단일 URL로 처리
      return [photo];
    }
  }

  // 단일 URL 문자열
  return [photo];
}

/**
 * posts 테이블 마이그레이션
 */
async function migratePosts() {
  console.log('\n📝 Posts 테이블 마이그레이션...');

  const { data: posts, error } = await supabase
    .from('posts')
    .select('id, photo')
    .not('photo', 'is', null);

  if (error) {
    console.error('Posts 조회 실패:', error);
    return;
  }

  console.log(`  총 ${posts.length}개 게시물 발견`);

  for (const post of posts) {
    const urls = parsePhotoField(post.photo);

    if (urls.length === 0) {
      stats.skipped++;
      continue;
    }

    // 각 URL에 대해 Supabase URL인지 확인
    const supabaseUrls = urls.filter(url => isSupabaseStorageUrl(url));

    if (supabaseUrls.length === 0) {
      stats.skipped++;
      continue;
    }

    stats.total += supabaseUrls.length;

    // 모든 URL 마이그레이션
    const newUrls = [];
    let migratedCount = 0;

    for (const url of urls) {
      if (!isSupabaseStorageUrl(url)) {
        // 이미 R2 URL이거나 다른 URL인 경우 그대로 유지
        newUrls.push(url);
        continue;
      }

      const result = await migrateUrl(url, 'posts');

      if (result.success) {
        newUrls.push(result.newUrl);
        if (result.reason === 'migrated' || result.reason === 'dry_run') {
          migratedCount++;
        }
      } else {
        newUrls.push(url); // 실패 시 원본 유지
        stats.failed++;
        stats.errors.push({ table: 'posts', id: post.id, url, error: result.reason });
      }
    }

    // DB 업데이트 (배열 형태로 저장)
    if (migratedCount > 0 && !config.dryRun) {
      const newPhotoValue = newUrls.length === 1 ? newUrls[0] : JSON.stringify(newUrls);

      const { error: updateError } = await supabase
        .from('posts')
        .update({ photo: newPhotoValue })
        .eq('id', post.id);

      if (updateError) {
        console.error(`  DB 업데이트 실패 (post ${post.id}):`, updateError);
        stats.failed++;
        stats.errors.push({ table: 'posts', id: post.id, error: updateError });
      } else {
        stats.migrated += migratedCount;
      }
    } else if (config.dryRun) {
      stats.migrated += migratedCount;
    }
  }
}

/**
 * post_images 테이블 마이그레이션
 */
async function migratePostImages() {
  console.log('\n🖼️ Post Images 테이블 마이그레이션...');

  const { data: images, error } = await supabase
    .from('post_images')
    .select('id, post_id, image_url');

  if (error) {
    console.error('Post images 조회 실패:', error);
    return;
  }

  console.log(`  총 ${images.length}개 이미지 발견`);

  for (const image of images) {
    stats.total++;

    if (!isSupabaseStorageUrl(image.image_url)) {
      stats.skipped++;
      continue;
    }

    const result = await migrateUrl(image.image_url, 'posts');

    if (result.success && result.reason === 'migrated' && !config.dryRun) {
      const { error: updateError } = await supabase
        .from('post_images')
        .update({ image_url: result.newUrl })
        .eq('id', image.id);

      if (updateError) {
        console.error(`  DB 업데이트 실패 (post_image ${image.id}):`, updateError);
        stats.failed++;
      } else {
        stats.migrated++;
      }
    } else if (result.reason === 'dry_run') {
      stats.migrated++;
    } else {
      stats.skipped++;
    }
  }
}

/**
 * users 테이블 마이그레이션 (프로필/커버 이미지)
 */
async function migrateUsers() {
  console.log('\n👤 Users 테이블 마이그레이션...');

  const { data: users, error } = await supabase
    .from('users')
    .select('id, profile_pic, cover_pic');

  if (error) {
    console.error('Users 조회 실패:', error);
    return;
  }

  console.log(`  총 ${users.length}명 사용자 발견`);

  for (const user of users) {
    // Profile pic
    if (user.profile_pic && isSupabaseStorageUrl(user.profile_pic)) {
      stats.total++;
      const result = await migrateUrl(user.profile_pic, 'avatars');

      if (result.success && result.reason === 'migrated' && !config.dryRun) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ profile_pic: result.newUrl })
          .eq('id', user.id);

        if (updateError) {
          stats.failed++;
        } else {
          stats.migrated++;
        }
      } else if (result.reason === 'dry_run') {
        stats.migrated++;
      }
    }

    // Cover pic
    if (user.cover_pic && isSupabaseStorageUrl(user.cover_pic)) {
      stats.total++;
      const result = await migrateUrl(user.cover_pic, 'covers');

      if (result.success && result.reason === 'migrated' && !config.dryRun) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ cover_pic: result.newUrl })
          .eq('id', user.id);

        if (updateError) {
          stats.failed++;
        } else {
          stats.migrated++;
        }
      } else if (result.reason === 'dry_run') {
        stats.migrated++;
      }
    }
  }
}

/**
 * 메인 실행
 */
async function main() {
  console.log('🚀 Supabase → R2 마이그레이션 시작');
  console.log(`   모드: ${config.dryRun ? 'DRY-RUN (테스트)' : 'LIVE (실제 마이그레이션)'}`);
  console.log(`   R2 버킷: ${config.r2.bucketName}`);
  console.log(`   R2 퍼블릭 URL: ${config.r2.publicUrl}`);
  console.log('');

  // 설정 검증
  if (!config.supabase.url || !config.supabase.serviceKey) {
    console.error('❌ Supabase 설정이 없습니다. .env 파일을 확인하세요.');
    process.exit(1);
  }

  if (!config.r2.accessKeyId || !config.r2.secretAccessKey) {
    console.error('❌ R2 설정이 없습니다. .env 파일을 확인하세요.');
    process.exit(1);
  }

  const startTime = Date.now();

  // 마이그레이션 실행
  await migratePosts();
  await migratePostImages();
  await migrateUsers();

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // 결과 출력
  console.log('\n========================================');
  console.log('📊 마이그레이션 결과');
  console.log('========================================');
  console.log(`총 파일: ${stats.total}`);
  console.log(`마이그레이션 완료: ${stats.migrated}`);
  console.log(`건너뜀: ${stats.skipped}`);
  console.log(`실패: ${stats.failed}`);
  console.log(`소요 시간: ${duration}초`);

  if (stats.errors.length > 0) {
    console.log('\n❌ 오류 목록:');
    stats.errors.forEach(e => console.log(`  - ${e.table} (id: ${e.id}): ${e.error}`));
  }

  if (config.dryRun) {
    console.log('\n⚠️ DRY-RUN 모드였습니다. 실제 마이그레이션을 하려면 --dry-run 옵션을 제거하세요.');
  }
}

main().catch(console.error);
