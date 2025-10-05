// PNG画像から輪郭を抽出するユーティリティ

/**
 * PNG画像から輪郭点を抽出する
 * @param {string} imageUrl - 画像のURL（データURL可）
 * @param {number} scale - スケール係数
 * @param {number} offsetX - X方向のオフセット
 * @param {number} offsetY - Y方向のオフセット
 * @param {number} alphaThreshold - アルファ値の閾値（0-255）
 * @returns {Promise<Array<[number, number]>>} 輪郭の座標配列
 */
export async function extractContourFromPNG(imageUrl, scale = 1, offsetX = 0, offsetY = 0, alphaThreshold = 128) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      
      canvas.width = img.width;
      canvas.height = img.height;
      
      // 画像を描画
      ctx.drawImage(img, 0, 0);
      
      // ピクセルデータを取得
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;
      
      // 二値化画像を作成（透明/不透明）
      const binaryImage = new Array(height).fill(null).map(() => new Array(width).fill(false));
      
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const alpha = data[idx + 3];
          binaryImage[y][x] = alpha >= alphaThreshold;
        }
      }
      
      // すべての輪郭を検出
      const allContours = [];
      const visited = new Array(height).fill(null).map(() => new Array(width).fill(false));
      
      // すべての輪郭を見つける
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          if (binaryImage[y][x] && !visited[y][x] && isBoundaryPixel(binaryImage, x, y, width, height)) {
            const contour = traceContour(binaryImage, x, y, width, height, visited);
            if (contour.length > 10) { // 小さすぎる輪郭は無視
              allContours.push(contour);
            }
          }
        }
      }
      
      if (allContours.length === 0) {
        resolve([]);
        return;
      }
      
      // 最も外側の輪郭を選択（最も大きい面積を持つ輪郭）
      let outerContour = allContours[0];
      let maxArea = 0;
      
      for (const contour of allContours) {
        // 輪郭の面積を計算（Shoelace formula）
        let area = 0;
        for (let i = 0; i < contour.length; i++) {
          const j = (i + 1) % contour.length;
          area += contour[i][0] * contour[j][1];
          area -= contour[j][0] * contour[i][1];
        }
        area = Math.abs(area) / 2;
        
        if (area > maxArea) {
          maxArea = area;
          outerContour = contour;
        }
      }
      
      // スケールとオフセットを適用
      const contourPoints = outerContour.map(([x, y]) => [
        offsetX + x * scale,
        offsetY + y * scale
      ]);
      
      // 点を簡略化
      const simplifiedPoints = simplifyPoints(contourPoints, 2);
      
      resolve(simplifiedPoints);
    };
    
    img.onerror = () => {
      reject(new Error("Failed to load image"));
    };
    
    img.src = imageUrl;
  });
}

/**
 * 輪郭を追跡する
 */
function traceContour(binaryImage, startX, startY, width, height, visited) {
  const contour = [];
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [1, 0], [1, 1], [0, 1],
    [-1, 1], [-1, 0]
  ];
  
  let currentX = startX;
  let currentY = startY;
  let dir = 0;
  
  // 開始方向を見つける（外側に向かう方向）
  for (let i = 0; i < 8; i++) {
    const dx = directions[i][0];
    const dy = directions[i][1];
    const nx = currentX + dx;
    const ny = currentY + dy;
    
    if (nx < 0 || nx >= width || ny < 0 || ny >= height || !binaryImage[ny][nx]) {
      dir = (i + 4) % 8; // 反対方向から開始
      break;
    }
  }
  
  let steps = 0;
  const maxSteps = width * height;
  
  do {
    contour.push([currentX, currentY]);
    visited[currentY][currentX] = true;
    
    // 次の境界点を探す
    let found = false;
    for (let i = 0; i < 8; i++) {
      const checkDir = (dir + 6 + i) % 8; // 前の方向の反対側から時計回りに探索
      const dx = directions[checkDir][0];
      const dy = directions[checkDir][1];
      const nextX = currentX + dx;
      const nextY = currentY + dy;
      
      if (nextX >= 0 && nextX < width && nextY >= 0 && nextY < height) {
        if (binaryImage[nextY][nextX] && isBoundaryPixel(binaryImage, nextX, nextY, width, height)) {
          currentX = nextX;
          currentY = nextY;
          dir = checkDir;
          found = true;
          break;
        }
      }
    }
    
    if (!found) break;
    
    // 開始点に戻ったら終了
    if (currentX === startX && currentY === startY && contour.length > 2) {
      break;
    }
    
    steps++;
  } while (steps < maxSteps);
  
  return contour;
}

/**
 * 境界ピクセルかどうかをチェック
 */
function isBoundaryPixel(binaryImage, x, y, width, height) {
  // 8近傍をチェック
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      
      const nx = x + dx;
      const ny = y + dy;
      
      // 画像の外側は透明として扱う
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) {
        return true;
      }
      
      // 透明なピクセルが隣接している
      if (!binaryImage[ny][nx]) {
        return true;
      }
    }
  }
  
  return false;
}

/**
 * Douglas-Peucker アルゴリズムで点を簡略化
 */
function simplifyPoints(points, tolerance = 1) {
  if (points.length < 3) return points;
  
  function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];
    
    if (dx === 0 && dy === 0) {
      const pdx = point[0] - lineStart[0];
      const pdy = point[1] - lineStart[1];
      return Math.sqrt(pdx * pdx + pdy * pdy);
    }
    
    const t = ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) / (dx * dx + dy * dy);
    
    let closestPoint;
    if (t < 0) {
      closestPoint = lineStart;
    } else if (t > 1) {
      closestPoint = lineEnd;
    } else {
      closestPoint = [lineStart[0] + t * dx, lineStart[1] + t * dy];
    }
    
    const pdx = point[0] - closestPoint[0];
    const pdy = point[1] - closestPoint[1];
    return Math.sqrt(pdx * pdx + pdy * pdy);
  }
  
  function douglasPeucker(points, start, end, tolerance) {
    let maxDistance = 0;
    let maxIndex = 0;
    
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDistance(points[i], points[start], points[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    if (maxDistance > tolerance) {
      const results1 = douglasPeucker(points, start, maxIndex, tolerance);
      const results2 = douglasPeucker(points, maxIndex, end, tolerance);
      
      return results1.slice(0, -1).concat(results2);
    } else {
      return [points[start], points[end]];
    }
  }
  
  const simplified = douglasPeucker(points, 0, points.length - 1, tolerance);
  
  // 閉じたパスの場合、最初の点を最後に追加
  if (points.length > 0 && 
      Math.abs(points[0][0] - points[points.length - 1][0]) < 1 &&
      Math.abs(points[0][1] - points[points.length - 1][1]) < 1) {
    simplified.push(simplified[0]);
  }
  
  return simplified;
}
