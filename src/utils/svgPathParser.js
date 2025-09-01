function cubicBezier(p0, p1, p2, p3, steps = 10) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const t2 = t * t;
    const t3 = t2 * t;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    
    const x = mt3 * p0[0] + 3 * mt2 * t * p1[0] + 3 * mt * t2 * p2[0] + t3 * p3[0];
    const y = mt3 * p0[1] + 3 * mt2 * t * p1[1] + 3 * mt * t2 * p2[1] + t3 * p3[1];
    
    points.push([x, y]);
  }
  return points;
}

function quadraticBezier(p0, p1, p2, steps = 8) {
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;
    
    const x = mt2 * p0[0] + 2 * mt * t * p1[0] + t2 * p2[0];
    const y = mt2 * p0[1] + 2 * mt * t * p1[1] + t2 * p2[1];
    
    points.push([x, y]);
  }
  return points;
}

export function parseSVGPath(pathData, scale = 1, offsetX = 0, offsetY = 0) {
  const points = [];
  const commands = pathData.match(/[MmLlHhVvCcSsQqTtAaZz][^MmLlHhVvCcSsQqTtAaZz]*/g);
  
  if (!commands) return points;
  
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;
  let lastControlX = 0;
  let lastControlY = 0;
  
  commands.forEach(command => {
    const type = command[0];
    const args = command.slice(1).trim().split(/[\s,]+/).map(Number);
    
    switch (type) {
    case "M":
      currentX = args[0];
      currentY = args[1];
      startX = currentX;
      startY = currentY;
      points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      break;
      
    case "m":
      currentX += args[0];
      currentY += args[1];
      startX = currentX;
      startY = currentY;
      points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      break;
      
    case "L":
      for (let i = 0; i < args.length; i += 2) {
        currentX = args[i];
        currentY = args[i + 1];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "l":
      for (let i = 0; i < args.length; i += 2) {
        currentX += args[i];
        currentY += args[i + 1];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "H":
      for (let i = 0; i < args.length; i++) {
        currentX = args[i];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "h":
      for (let i = 0; i < args.length; i++) {
        currentX += args[i];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "V":
      for (let i = 0; i < args.length; i++) {
        currentY = args[i];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "v":
      for (let i = 0; i < args.length; i++) {
        currentY += args[i];
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
      
    case "C":
      for (let i = 0; i < args.length; i += 6) {
        const cp1x = args[i];
        const cp1y = args[i + 1];
        const cp2x = args[i + 2];
        const cp2y = args[i + 3];
        const endX = args[i + 4];
        const endY = args[i + 5];
        
        const bezierPoints = cubicBezier(
          [currentX, currentY],
          [cp1x, cp1y],
          [cp2x, cp2y],
          [endX, endY],
          15
        );
        
        for (let j = 1; j < bezierPoints.length; j++) {
          points.push([
            offsetX + bezierPoints[j][0] * scale,
            offsetY + bezierPoints[j][1] * scale
          ]);
        }
        
        currentX = endX;
        currentY = endY;
        lastControlX = cp2x;
        lastControlY = cp2y;
      }
      break;
      
    case "c":
      for (let i = 0; i < args.length; i += 6) {
        const cp1x = currentX + args[i];
        const cp1y = currentY + args[i + 1];
        const cp2x = currentX + args[i + 2];
        const cp2y = currentY + args[i + 3];
        const endX = currentX + args[i + 4];
        const endY = currentY + args[i + 5];
        
        const bezierPoints = cubicBezier(
          [currentX, currentY],
          [cp1x, cp1y],
          [cp2x, cp2y],
          [endX, endY],
          15
        );
        
        for (let j = 1; j < bezierPoints.length; j++) {
          points.push([
            offsetX + bezierPoints[j][0] * scale,
            offsetY + bezierPoints[j][1] * scale
          ]);
        }
        
        currentX = endX;
        currentY = endY;
        lastControlX = cp2x;
        lastControlY = cp2y;
      }
      break;
      
    case "S":
      for (let i = 0; i < args.length; i += 4) {
        const cp1x = 2 * currentX - lastControlX;
        const cp1y = 2 * currentY - lastControlY;
        const cp2x = args[i];
        const cp2y = args[i + 1];
        const endX = args[i + 2];
        const endY = args[i + 3];
        
        const bezierPoints = cubicBezier(
          [currentX, currentY],
          [cp1x, cp1y],
          [cp2x, cp2y],
          [endX, endY],
          15
        );
        
        for (let j = 1; j < bezierPoints.length; j++) {
          points.push([
            offsetX + bezierPoints[j][0] * scale,
            offsetY + bezierPoints[j][1] * scale
          ]);
        }
        
        currentX = endX;
        currentY = endY;
        lastControlX = cp2x;
        lastControlY = cp2y;
      }
      break;
      
    case "s":
      for (let i = 0; i < args.length; i += 4) {
        const cp1x = 2 * currentX - lastControlX;
        const cp1y = 2 * currentY - lastControlY;
        const cp2x = currentX + args[i];
        const cp2y = currentY + args[i + 1];
        const endX = currentX + args[i + 2];
        const endY = currentY + args[i + 3];
        
        const bezierPoints = cubicBezier(
          [currentX, currentY],
          [cp1x, cp1y],
          [cp2x, cp2y],
          [endX, endY],
          15
        );
        
        for (let j = 1; j < bezierPoints.length; j++) {
          points.push([
            offsetX + bezierPoints[j][0] * scale,
            offsetY + bezierPoints[j][1] * scale
          ]);
        }
        
        currentX = endX;
        currentY = endY;
        lastControlX = cp2x;
        lastControlY = cp2y;
      }
      break;
      
    case "Q":
      for (let i = 0; i < args.length; i += 4) {
        const cpx = args[i];
        const cpy = args[i + 1];
        const endX = args[i + 2];
        const endY = args[i + 3];
        
        const bezierPoints = quadraticBezier(
          [currentX, currentY],
          [cpx, cpy],
          [endX, endY],
          10
        );
        
        for (let j = 1; j < bezierPoints.length; j++) {
          points.push([
            offsetX + bezierPoints[j][0] * scale,
            offsetY + bezierPoints[j][1] * scale
          ]);
        }
        
        currentX = endX;
        currentY = endY;
        lastControlX = cpx;
        lastControlY = cpy;
      }
      break;
      
    case "q":
      for (let i = 0; i < args.length; i += 4) {
        const cpx = currentX + args[i];
        const cpy = currentY + args[i + 1];
        const endX = currentX + args[i + 2];
        const endY = currentY + args[i + 3];
        
        const bezierPoints = quadraticBezier(
          [currentX, currentY],
          [cpx, cpy],
          [endX, endY],
          10
        );
        
        for (let j = 1; j < bezierPoints.length; j++) {
          points.push([
            offsetX + bezierPoints[j][0] * scale,
            offsetY + bezierPoints[j][1] * scale
          ]);
        }
        
        currentX = endX;
        currentY = endY;
        lastControlX = cpx;
        lastControlY = cpy;
      }
      break;
      
    case "T":
      for (let i = 0; i < args.length; i += 2) {
        const cpx = 2 * currentX - lastControlX;
        const cpy = 2 * currentY - lastControlY;
        const endX = args[i];
        const endY = args[i + 1];
        
        const bezierPoints = quadraticBezier(
          [currentX, currentY],
          [cpx, cpy],
          [endX, endY],
          10
        );
        
        for (let j = 1; j < bezierPoints.length; j++) {
          points.push([
            offsetX + bezierPoints[j][0] * scale,
            offsetY + bezierPoints[j][1] * scale
          ]);
        }
        
        currentX = endX;
        currentY = endY;
        lastControlX = cpx;
        lastControlY = cpy;
      }
      break;
      
    case "t":
      for (let i = 0; i < args.length; i += 2) {
        const cpx = 2 * currentX - lastControlX;
        const cpy = 2 * currentY - lastControlY;
        const endX = currentX + args[i];
        const endY = currentY + args[i + 1];
        
        const bezierPoints = quadraticBezier(
          [currentX, currentY],
          [cpx, cpy],
          [endX, endY],
          10
        );
        
        for (let j = 1; j < bezierPoints.length; j++) {
          points.push([
            offsetX + bezierPoints[j][0] * scale,
            offsetY + bezierPoints[j][1] * scale
          ]);
        }
        
        currentX = endX;
        currentY = endY;
        lastControlX = cpx;
        lastControlY = cpy;
      }
      break;
      
    case "Z":
    case "z":
      currentX = startX;
      currentY = startY;
      break;
    case "A":
    case "a": {
      const isRelative = type === "a";
      for (let i = 0; i < args.length; i += 7) {
        if (isRelative) {
          currentX += args[i + 5];
          currentY += args[i + 6];
        } else {
          currentX = args[i + 5];
          currentY = args[i + 6];
        }
        points.push([offsetX + currentX * scale, offsetY + currentY * scale]);
      }
      break;
    }
    }
  });
  
  return points;
}

export async function loadSVGPath(url) {
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, "image/svg+xml");
    
    const pathElement = doc.querySelector("path");
    if (!pathElement) {
      throw new Error("No path element found in SVG");
    }
    
    const pathData = pathElement.getAttribute("d");
    const transform = pathElement.getAttribute("transform");
    
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

export function simplifyPoints(points, tolerance = 0.5) {
  if (points.length < 3) return points;
  function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd[0] - lineStart[0];
    const dy = lineEnd[1] - lineStart[1];

    if (dx === 0 && dy === 0) {
      const pdx = point[0] - lineStart[0];
      const pdy = point[1] - lineStart[1];
      return Math.sqrt(pdx * pdx + pdy * pdy);
    }

    const t =
      ((point[0] - lineStart[0]) * dx + (point[1] - lineStart[1]) * dy) /
      (dx * dx + dy * dy);

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

  //Douglas−Peuckerアルゴリズムで点を簡略化
  function douglasPeucker(points, start, end, tolerance) {
    let maxDistance = 0;
    let maxIndex = 0;

    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDistance(
        points[i],
        points[start],
        points[end],
      );
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

  const isClosed =
    Math.abs(points[0][0] - points[points.length - 1][0]) < 0.01 &&
    Math.abs(points[0][1] - points[points.length - 1][1]) < 0.01;

  if (isClosed && points.length > 1) {
    const simplified = douglasPeucker(
      points.slice(0, -1),
      0,
      points.length - 2,
      tolerance,
    );
    simplified.push(simplified[0]);
    return simplified;
  } else {
    return douglasPeucker(points, 0, points.length - 1, tolerance);
  }
}
