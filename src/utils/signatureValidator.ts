export interface Point {
  x: number;
  y: number;
  time?: number;
}

export type Stroke = Point[];

export interface SignatureValidationResult {
  valid: boolean;
  error?: string;
  strokeCount: number;
  pointCount: number;
  totalLength: number;
}

/**
 * Validates that digital signature contains sufficient strokes and points
 * to prevent blank or single accidental dot submissions.
 */
export function validateSignatureStrokes(
  strokes: Stroke[],
  minPoints: number = 10,
  minTotalLength: number = 30
): SignatureValidationResult {
  if (!Array.isArray(strokes) || strokes.length === 0) {
    return {
      valid: false,
      error: 'Tanda tangan digital belum digoreskan',
      strokeCount: 0,
      pointCount: 0,
      totalLength: 0
    };
  }

  let totalPoints = 0;
  let totalLength = 0;

  for (const stroke of strokes) {
    if (!Array.isArray(stroke)) continue;
    totalPoints += stroke.length;

    for (let i = 1; i < stroke.length; i++) {
      const p1 = stroke[i - 1];
      const p2 = stroke[i];
      if (typeof p1.x === 'number' && typeof p1.y === 'number' && typeof p2.x === 'number' && typeof p2.y === 'number') {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        totalLength += Math.sqrt(dx * dx + dy * dy);
      }
    }
  }

  if (totalPoints < minPoints) {
    return {
      valid: false,
      error: `Goresan tanda tangan terlalu singkat (minimal ${minPoints} titik gerakan)`,
      strokeCount: strokes.length,
      pointCount: totalPoints,
      totalLength
    };
  }

  if (totalLength < minTotalLength) {
    return {
      valid: false,
      error: 'Tanda tangan tidak boleh hanya berupa titik kecil',
      strokeCount: strokes.length,
      pointCount: totalPoints,
      totalLength
    };
  }

  return {
    valid: true,
    strokeCount: strokes.length,
    pointCount: totalPoints,
    totalLength
  };
}
