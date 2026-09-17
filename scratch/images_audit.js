const fs = require('fs');
const path = require('path');
const sharp = require('../backend/node_modules/sharp');

const BASE_URL = 'http://localhost:5000/api';
const TEST_USER = 'img_audit_user';
const OTHER_USER = 'img_other_user';

const VHOSTS_DIR = path.resolve(__dirname, '../backend/data/vhosts');
const TEST_USER_DIR = path.join(VHOSTS_DIR, TEST_USER, 'public_html');
const OTHER_USER_DIR = path.join(VHOSTS_DIR, OTHER_USER, 'public_html');

let passedCount = 0;
let totalCount = 0;

function assert(condition, message) {
  totalCount++;
  if (condition) {
    passedCount++;
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const user = options.user || TEST_USER;
  const headers = {
    'Content-Type': 'application/json',
    'X-cPanel-User': user,
    ...(options.headers || {})
  };

  const fetchOpts = {
    method: options.method || 'GET',
    headers,
    ...(options.body ? { body: JSON.stringify(options.body) } : {})
  };

  const res = await fetch(url, fetchOpts);
  let data = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.arrayBuffer();
  }
  return { status: res.status, headers: res.headers, data };
}

async function runAudit() {
  console.log('=== STARTING CPANEL IMAGES FEATURE AUDIT ===\n');

  // Setup test directories
  if (fs.existsSync(TEST_USER_DIR)) fs.rmSync(TEST_USER_DIR, { recursive: true, force: true });
  if (fs.existsSync(OTHER_USER_DIR)) fs.rmSync(OTHER_USER_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_USER_DIR, { recursive: true });
  fs.mkdirSync(OTHER_USER_DIR, { recursive: true });

  // 1. Create sample test images
  console.log('1. Generating Real Fixture Images...');
  const testJpg = path.join(TEST_USER_DIR, 'banner.jpg');
  await sharp({ create: { width: 800, height: 400, channels: 3, background: { r: 255, g: 108, b: 44 } } })
    .jpeg({ quality: 90 })
    .toFile(testJpg);

  const testPngAlpha = path.join(TEST_USER_DIR, 'logo-alpha.png');
  await sharp({ create: { width: 300, height: 300, channels: 4, background: { r: 39, g: 35, b: 92, alpha: 0.5 } } })
    .png()
    .toFile(testPngAlpha);

  const testWebp = path.join(TEST_USER_DIR, 'hero.webp');
  await sharp({ create: { width: 600, height: 300, channels: 3, background: { r: 16, g: 185, b: 129 } } })
    .webp({ quality: 85 })
    .toFile(testWebp);

  const subDir = path.join(TEST_USER_DIR, 'gallery');
  fs.mkdirSync(subDir, { recursive: true });
  const testSubJpg = path.join(subDir, 'photo1.jpg');
  await sharp({ create: { width: 500, height: 500, channels: 3, background: { r: 200, g: 200, b: 200 } } })
    .jpeg()
    .toFile(testSubJpg);

  // Other user image for isolation test
  const otherJpg = path.join(OTHER_USER_DIR, 'secret.jpg');
  await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 0, g: 0, b: 0 } } })
    .jpeg()
    .toFile(otherJpg);

  // Corrupted image file
  const corruptImg = path.join(TEST_USER_DIR, 'corrupt.jpg');
  fs.writeFileSync(corruptImg, 'THIS_IS_NOT_A_VALID_IMAGE_DATA');

  // Non-image file
  const nonImg = path.join(TEST_USER_DIR, 'document.pdf');
  fs.writeFileSync(nonImg, '%PDF-1.4 Fake PDF');

  // Test 1: Directory discovery endpoint
  console.log('\n2. Directory Discovery:');
  const dirRes = await request('/images/directories');
  assert(dirRes.status === 200 && Array.isArray(dirRes.data), 'GET /images/directories returns 200 array');
  const foundGallery = dirRes.data.some(d => d.relPath.includes('gallery'));
  assert(foundGallery, 'Discovered subfolder "public_html/gallery" in directories');

  // Test 2: Scanning & Listing Images
  console.log('\n3. Real Filesystem Image Scanning:');
  const listRes = await request('/images/list?path=public_html');
  assert(listRes.status === 200 && Array.isArray(listRes.data), 'GET /images/list returns 200 array');
  const banner = listRes.data.find(i => i.name === 'banner.jpg');
  assert(banner !== undefined, 'Found real image banner.jpg');
  assert(banner.width === 800 && banner.height === 400, `Real dimensions extracted: ${banner?.width}x${banner?.height}`);
  assert(banner.format === 'JPEG', `Real format extracted: ${banner?.format}`);
  assert(banner.size > 0, `Real file size reported: ${banner?.sizeFormatted}`);

  // Test 3: Alpha channel detection
  const logo = listRes.data.find(i => i.name === 'logo-alpha.png');
  assert(logo && logo.hasAlpha === true, 'Detected alpha channel on PNG with transparency');

  // Test 4: Corrupt image handling
  const corrupt = listRes.data.find(i => i.name === 'corrupt.jpg');
  assert(corrupt !== undefined && corrupt.dimensions === 'Unknown', 'Corrupt image listed safely without crashing metadata scan');

  // Test 5: Non-image file exclusion
  const pdfFound = listRes.data.some(i => i.name === 'document.pdf');
  assert(!pdfFound, 'Non-image file (document.pdf) excluded from image scan');

  // Test 6: Single image metadata endpoint
  console.log('\n4. Image Metadata Endpoint:');
  const metaRes = await request('/images/metadata?path=public_html/banner.jpg');
  assert(metaRes.status === 200, 'GET /images/metadata returns 200');
  assert(metaRes.data.width === 800 && metaRes.data.format === 'JPEG', 'Accurate metadata details returned');

  // Test 7: Missing image metadata (404)
  const missingMeta = await request('/images/metadata?path=public_html/nonexistent.jpg');
  assert(missingMeta.status === 404, 'Missing image metadata returns 404');

  // Test 8: Thumbnail generation & caching
  console.log('\n5. Thumbnail Generation & Caching:');
  const thumb1 = await request('/images/thumbnail?path=public_html/banner.jpg&w=200&h=200');
  assert(thumb1.status === 200, 'GET /images/thumbnail generates thumbnail with 200');
  assert(thumb1.headers.get('content-type') === 'image/webp', 'Thumbnail served as image/webp');
  
  // Second request serves cache
  const thumb2 = await request('/images/thumbnail?path=public_html/banner.jpg&w=200&h=200');
  assert(thumb2.status === 200, 'Cached thumbnail request returns 200');

  // Test 9: Image preview endpoint
  console.log('\n6. Image Preview & Download:');
  const prevRes = await request('/images/view?path=public_html/banner.jpg');
  assert(prevRes.status === 200, 'GET /images/view returns 200');
  assert(prevRes.headers.get('content-type') === 'image/jpeg', 'Preview Content-Type matches image MIME');

  // Test 10: Image download endpoint
  const dlRes = await request('/images/download?path=public_html/banner.jpg');
  assert(dlRes.status === 200, 'GET /images/download returns 200');
  assert(dlRes.headers.get('content-disposition')?.includes('attachment'), 'Download sets Content-Disposition: attachment');

  // Test 11: Image Resize with Aspect Ratio
  console.log('\n7. Image Resizing:');
  const resizeRes = await request('/images/resize', {
    method: 'POST',
    body: {
      sourcePath: 'public_html/banner.jpg',
      newWidth: 400,
      maintainAspectRatio: true,
      outputName: 'banner-400.jpg',
      overwrite: false
    }
  });
  assert(resizeRes.status === 200 && resizeRes.data.success, 'POST /images/resize returns 200 success');
  assert(resizeRes.data.image.width === 400 && resizeRes.data.image.height === 200, 'Proportional aspect-ratio preserved (800x400 -> 400x200)');
  assert(fs.existsSync(path.join(TEST_USER_DIR, 'banner-400.jpg')), 'Resized file physically exists on disk');

  // Test 12: Duplicate Output Name Conflict
  const dupResize = await request('/images/resize', {
    method: 'POST',
    body: {
      sourcePath: 'public_html/banner.jpg',
      newWidth: 200,
      outputName: 'banner-400.jpg',
      overwrite: false
    }
  });
  assert(dupResize.status === 409, 'Duplicate output without overwrite returns 409 Conflict');

  // Test 13: Overwrite when enabled
  const overwriteResize = await request('/images/resize', {
    method: 'POST',
    body: {
      sourcePath: 'public_html/banner.jpg',
      newWidth: 200,
      outputName: 'banner-400.jpg',
      overwrite: true
    }
  });
  assert(overwriteResize.status === 200 && overwriteResize.data.image.width === 200, 'Resize with overwrite=true safely replaces destination');

  // Test 14: Invalid dimensions validation
  const invalidW = await request('/images/resize', {
    method: 'POST',
    body: { sourcePath: 'public_html/banner.jpg', newWidth: 0, outputName: 'bad.jpg' }
  });
  assert(invalidW.status === 400, 'Zero width rejected with 400');

  const invalidH = await request('/images/resize', {
    method: 'POST',
    body: { sourcePath: 'public_html/banner.jpg', newWidth: 500, newHeight: -10, outputName: 'bad.jpg' }
  });
  assert(invalidH.status === 400, 'Negative height rejected with 400');

  const hugeDim = await request('/images/resize', {
    method: 'POST',
    body: { sourcePath: 'public_html/banner.jpg', newWidth: 99999, outputName: 'bad.jpg' }
  });
  assert(hugeDim.status === 400, 'Excessive dimension (>10,000) rejected with 400');

  // Test 15: Image Conversion with Alpha Flattening (PNG -> JPEG)
  console.log('\n8. Image Format Conversion:');
  const convertJpg = await request('/images/convert', {
    method: 'POST',
    body: {
      sourcePath: 'public_html/logo-alpha.png',
      targetFormat: 'jpeg',
      quality: 90,
      outputName: 'logo-converted.jpg',
      overwrite: true
    }
  });
  assert(convertJpg.status === 200 && convertJpg.data.image.format === 'JPEG', 'Converted PNG with alpha to JPEG successfully');
  assert(!convertJpg.data.image.hasAlpha, 'JPEG output verified to have no alpha channel');

  // Test 16: Image Conversion (JPEG -> WEBP)
  const convertWebp = await request('/images/convert', {
    method: 'POST',
    body: {
      sourcePath: 'public_html/banner.jpg',
      targetFormat: 'webp',
      quality: 80,
      outputName: 'banner.webp',
      overwrite: true
    }
  });
  assert(convertWebp.status === 200 && convertWebp.data.image.format === 'WEBP', 'Converted JPEG to WEBP successfully');

  // Test 17: Unsupported target format
  const badFormat = await request('/images/convert', {
    method: 'POST',
    body: { sourcePath: 'public_html/banner.jpg', targetFormat: 'exe', outputName: 'bad.exe' }
  });
  assert(badFormat.status === 400, 'Unsupported target format rejected with 400');

  // Test 18: Image Optimization / Recompression
  console.log('\n9. Image Optimization:');
  const optRes = await request('/images/optimize', {
    method: 'POST',
    body: {
      sourcePath: 'public_html/banner.jpg',
      quality: 75,
      outputName: 'banner-opt.jpg',
      overwrite: true
    }
  });
  assert(optRes.status === 200 && optRes.data.success, 'POST /images/optimize returns 200');
  assert(optRes.data.optimizedSize > 0, `Optimized size: ${optRes.data.optimizedFormatted} (saved: ${optRes.data.savedPercentage})`);

  // Test 19: Rename Image
  console.log('\n10. Image Rename & Delete:');
  const renameRes = await request('/images/rename', {
    method: 'POST',
    body: {
      oldPath: 'public_html/banner-opt.jpg',
      newName: 'banner-renamed.jpg'
    }
  });
  assert(renameRes.status === 200 && renameRes.data.image.name === 'banner-renamed.jpg', 'POST /images/rename renames file successfully');
  assert(fs.existsSync(path.join(TEST_USER_DIR, 'banner-renamed.jpg')), 'Renamed file exists on disk');

  // Test 20: Delete Image
  const delRes = await request('/images/delete', {
    method: 'POST',
    body: { path: 'public_html/banner-renamed.jpg' }
  });
  assert(delRes.status === 200 && delRes.data.success, 'POST /images/delete deletes image');
  assert(!fs.existsSync(path.join(TEST_USER_DIR, 'banner-renamed.jpg')), 'Deleted file removed from disk');

  // Test 21: Security & Sandboxing (Path Traversal Penetration)
  console.log('\n11. Security Penetration & Multi-Tenant Isolation:');
  const trav1 = await request('/images/list?path=../../');
  assert(trav1.status === 400, 'Directory traversal in list (?path=../../) blocked with 400');

  const travEncoded = await request('/images/list?path=%2e%2e%2f%2e%2e%2f');
  assert(travEncoded.status === 400, 'Encoded traversal in list (?path=%2e%2e%2f) blocked with 400');

  const travView = await request('/images/view?path=../../etc/passwd');
  assert(travView.status === 400, 'Path traversal in view blocked with 400');

  const travThumb = await request('/images/thumbnail?path=../../etc/passwd');
  assert(travThumb.status === 400, 'Path traversal in thumbnail blocked with 400');

  const travResize = await request('/images/resize', {
    method: 'POST',
    body: { sourcePath: '../../etc/passwd', newWidth: 100, outputName: 'leak.jpg' }
  });
  assert(travResize.status === 400, 'Path traversal in resize source blocked with 400');

  const nullByte = await request('/images/view?path=public_html/banner.jpg%00.png');
  assert(nullByte.status === 400, 'Null-byte injection blocked with 400');

  // Test 22: Cross-user Sandbox Isolation
  const crossUserView = await request('/images/view?path=public_html/secret.jpg', { user: TEST_USER });
  assert(crossUserView.status === 400 || crossUserView.status === 404, 'User A cannot access User B private image (cross-tenant 400/404)');

  const crossUserList = await request('/images/list?path=public_html', { user: OTHER_USER });
  assert(crossUserList.status === 200, 'User B list succeeds within User B root');
  assert(crossUserList.data.some(i => i.name === 'secret.jpg'), 'User B sees secret.jpg in User B root');
  assert(!crossUserList.data.some(i => i.name === 'banner.jpg'), 'User B cannot see User A banner.jpg');

  // Cleanup test directories
  try {
    fs.rmSync(path.join(VHOSTS_DIR, TEST_USER), { recursive: true, force: true });
    fs.rmSync(path.join(VHOSTS_DIR, OTHER_USER), { recursive: true, force: true });
  } catch (e) {}

  console.log(`\n=========================================`);
  console.log(`AUDIT COMPLETE: ${passedCount} / ${totalCount} PASSED (${Math.round((passedCount / totalCount) * 100)}%)`);
  console.log(`=========================================\n`);

  if (passedCount !== totalCount) {
    process.exit(1);
  }
}

runAudit().catch(err => {
  console.error('Fatal audit error:', err);
  process.exit(1);
});
