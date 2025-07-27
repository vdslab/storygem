// SVGパスデータを座標配列に変換するユーティリティ

export function parseSVGPath(pathData, scale = 1, offsetX = 0, offsetY = 0) {
  const points = [];
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  
  if (!commands) return points;
  
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  
  commands.forEach(command => {
    const type = command[0];
    const args = command.slice(1).trim().split(/[\s,]+/).map(Number);
    
    switch (type) {
    case "M": // Move to absolute
      currentX = args[0];
      currentY = args[1];
      startX = currentX;
      startY = currentY;
      points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      break;
      
    case "m": // Move to relative
      currentX += args[0];
      currentY += args[1];
      startX = currentX;
      startY = currentY;
      points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      break;
      
    case "L": // Line to absolute
      for (let i = 0; i < args.length; i += 2) {
        currentX = args[i];
        currentY = args[i + 1];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "l": // Line to relative
      for (let i = 0; i < args.length; i += 2) {
        currentX += args[i];
        currentY += args[i + 1];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "H": // Horizontal line absolute
      currentX = args[0];
      points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      break;
      
    case "h": // Horizontal line relative
      currentX += args[0];
      points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      break;
      
    case "V": // Vertical line absolute
      currentY = args[0];
      points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      break;
      
    case "v": // Vertical line relative
      currentY += args[0];
      points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      break;
      
    case "C": // Cubic bezier absolute
      // 簡略化: ベジェ曲線の終点のみを使用
      for (let i = 0; i < args.length; i += 6) {
        // 制御点をスキップして終点のみ追加
        currentX = args[i + 4];
        currentY = args[i + 5];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "c": // Cubic bezier relative
      for (let i = 0; i < args.length; i += 6) {
        currentX += args[i + 4];
        currentY += args[i + 5];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "Z": // Close path
    case "z":
      currentX = startX;
      currentY = startY;
      // 閉じるパスは開始点に戻るが、重複を避けるため追加しない
      break;
      
      // 他のコマンド（S, Q, T, A）は簡略化のため省略
    }
  });
  
  return points;
}

// SVGファイルからパスデータを抽出
export async function loadSVGPath(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // DOMParserを使用してSVGを解析
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "image/svg+xml");
    
    // 最初のpathエレメントを取得
    const pathElement = doc.querySelector("path");
    if (!pathElement) {
      throw new Error("No path element found in SVG");
    }
    
    const pathData = pathElement.getAttribute("d");
    const transform = pathElement.getAttribute("transform");
    
    // transformから translate値を抽出
    let translateX = 0;
    let translateY = 0;
    if (transform) {
      const translateMatch = transform.match(/translate\(([^,]+),([^)]+)\)/);
      if (translateMatch) {
        translateX = parseFloat(translateMatch[1]);
        translateY = parseFloat(translateMatch[2]);
      }
    }
    
    return { pathData, translateX, translateY };
  } catch (error) {
    console.error("Error loading SVG:", error);
    throw error;
  }
}

// 座標配列を簡略化（重複点の削除）
export function simplifyPoints(points, tolerance = 1) {
  if (points.length < 3) return points;
  
  const simplified = [points[0]];
  let lastPoint = points[0];
  
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const distance = Math.sqrt(
      Math.pow(point[0] - lastPoint[0], 2) + 
      Math.pow(point[1] - lastPoint[1], 2)
    );
    
    if (distance > tolerance) {
      simplified.push(point);
      lastPoint = point;
    }
  }
  
  return simplified;
}
