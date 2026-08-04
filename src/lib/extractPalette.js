export function extractPalette(imageUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const w = (canvas.width = 60);
      const h = (canvas.height = 60);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      let data;
      try {
        data = ctx.getImageData(0, 0, w, h).data;
      } catch {
        resolve(null);
        return;
      }

      const buckets = {};
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 200) continue;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const lightness = (max + min) / 2;
        if (lightness > 235 || lightness < 20) continue;
        const key = [Math.round(r / 24), Math.round(g / 24), Math.round(b / 24)].join(',');
        if (!buckets[key]) buckets[key] = { count: 0, r: 0, g: 0, b: 0 };
        buckets[key].count++;
        buckets[key].r += r;
        buckets[key].g += g;
        buckets[key].b += b;
      }

      const sorted = Object.values(buckets).sort((a, b) => b.count - a.count);
      if (sorted.length === 0) {
        resolve(null);
        return;
      }

      const toHex = (c) => {
        const r = Math.round(c.r / c.count), g = Math.round(c.g / c.count), b = Math.round(c.b / c.count);
        return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
      };

      const saturation = (c) => {
        const r = c.r / c.count, g = c.g / c.count, b = c.b / c.count;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        return max - min;
      };

      const theme = toHex(sorted[0]);
      const accentCandidate = [...sorted].sort((a, b) => saturation(b) - saturation(a))[0];
      const accent = toHex(accentCandidate);

      resolve({ theme, accent });
    };
    img.onerror = () => resolve(null);
    img.src = imageUrl;
  });
}
