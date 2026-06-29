  // -------- procedural pixel-art textures --------
  // Minification tuning shared by every procedural WORLD-SURFACE texture
  // (tiles, cottage panels, island-side strata). The voxel look wants crisp
  // texels up close, so magFilter stays NEAREST (sharp when magnified). But at
  // the game's grazing isometric angle the ground and island sides minify hard:
  // with no mipmaps + no anisotropy that produces the swimming moiré "stripes"
  // that rotate as the camera orbits, plus hard LOD-band steps from nearest-mip
  // selection. The fix is two-part and BOTH halves matter (the strata sheet
  // already had mipmaps yet still striped because it lacked these):
  //   * NearestMipmapLinear  -> mipmaps with LINEAR blending between LOD levels,
  //                             which removes the visible "various LOD level"
  //                             band steps the user reported.
  //   * anisotropy           -> multi-tap sampling along the grazing axis, which
  //                             is what actually kills the diagonal moiré on
  //                             surfaces viewed edge-on (the dominant symptom).
  // All tile textures are power-of-two (16..128); the strata sheet is NPOT
  // (1024x192) but WebGL2 generates its mips fine.
  function tuneWorldTextureFiltering(tex) {
    if (!tex) return tex;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true;
    const maxAniso = (renderer && renderer.capabilities && renderer.capabilities.getMaxAnisotropy)
      ? renderer.capabilities.getMaxAnisotropy() : 1;
    tex.anisotropy = Math.min(8, maxAniso || 1);
    if (typeof twMarkTextureNeedsUpdateIfReady === 'function') twMarkTextureNeedsUpdateIfReady(tex);
    else if (tex.image) tex.needsUpdate = true;
    return tex;
  }

  function createPixelTexture(type, scale = 16) {
    const canvas = document.createElement('canvas');
    canvas.width = scale;
    canvas.height = scale;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rand = makeMulberry32('pixel-texture:' + type + ':' + scale);
    function tileRect(x, y, w, h) {
      ctx.fillRect(x, y, w, h);
      if (x < 0) ctx.fillRect(x + scale, y, w, h);
      if (x + w > scale) ctx.fillRect(x - scale, y, w, h);
      if (y < 0) ctx.fillRect(x, y + scale, w, h);
      if (y + h > scale) ctx.fillRect(x, y - scale, w, h);
    }

    if (type === 'checkered') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#e2e2e2';
      const half = scale / 2;
      ctx.fillRect(0, 0, half, half);
      ctx.fillRect(half, half, half, half);
    } else if (type === 'noise') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x++) {
        for (let y = 0; y < scale; y++) {
          const r = rand();
          if (r > 0.75) ctx.fillStyle = '#f2f2f2';
          else if (r > 0.45) ctx.fillStyle = '#e5e5e5';
          else if (r > 0.15) ctx.fillStyle = '#dcdcdc';
          else ctx.fillStyle = '#ffffff';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else if (type === 'brick') {
      ctx.fillStyle = '#bfbfbf'; // mortar
      ctx.fillRect(0, 0, scale, scale);
      const rows = 4;
      const rowH = scale / rows;
      for (let r = 0; r < rows; r++) {
        const offset = (r % 2) * (scale / 4);
        ctx.fillStyle = (r % 2 === 0) ? '#ffffff' : '#f0f0f0';
        ctx.fillRect(offset + 0.5, r * rowH + 0.5, scale / 2 - 1, rowH - 1);
        ctx.fillRect(scale / 2 + offset + 0.5, r * rowH + 0.5, scale / 2 - 1, rowH - 1);
        if (offset > 0) {
          ctx.fillRect(-scale / 2 + offset + 0.5, r * rowH + 0.5, scale / 2 - 1, rowH - 1);
        }
      }
    } else if (type === 'shingles') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#d0d0d0';
      const rows = 4;
      const rowH = scale / rows;
      for (let r = 0; r < rows; r++) {
        ctx.fillRect(0, r * rowH, scale, 1);
        for (let c = 0; c < 2; c++) {
          const cx = Math.floor(c * (scale / 2) + (r % 2) * (scale / 4));
          ctx.fillRect(cx, r * rowH, 1, rowH);
        }
      }
    } else if (type === 'planks') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      const plankH = 4;
      for (let y = 0; y < scale; y += plankH) {
        ctx.fillStyle = '#b8b8b8';
        ctx.fillRect(0, y, scale, 1);
        ctx.fillStyle = '#f8f8f8';
        ctx.fillRect(0, y + 1, scale, 1);
        const offset = (y / plankH) % 2 === 0 ? 0 : scale / 2;
        ctx.fillStyle = '#d0d0d0';
        ctx.fillRect(offset, y, 1, plankH);
        ctx.fillRect((offset + scale / 2) % scale, y, 1, plankH);
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = rand() > 0.45 ? '#e5e5e5' : '#f4f4f4';
          ctx.fillRect(Math.floor(rand() * scale), y + 1 + Math.floor(rand() * Math.max(1, plankH - 1)), 1, 1);
        }
      }
    } else if (type === 'stone') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < scale * 1.8; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = 1 + Math.floor(rand() * 2);
        const h = 1 + Math.floor(rand() * 2);
        ctx.fillStyle = rand() > 0.45 ? '#d8d8d8' : '#f1f1f1';
        ctx.fillRect(x, y, w, h);
      }
      ctx.fillStyle = '#c8c8c8';
      ctx.fillRect(0, 0, scale, 1);
      ctx.fillRect(0, scale - 1, scale, 1);
      ctx.fillRect(0, 0, 1, scale);
      ctx.fillRect(scale - 1, 0, 1, scale);
    } else if (type === 'hay') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < 15; i++) {
        const x = rand() * scale;
        const y = rand() * scale;
        const len = 3 + rand() * 5;
        const a = rand() * Math.PI;
        ctx.strokeStyle = rand() > 0.4 ? '#d8d8d8' : '#efefef';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
    } else if (type === 'ripples') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      // Neutral water albedo. The true motion/refraction/reflection comes from
      // the enhanced water shader; do not bake fake wave stripes into the map.
      for (let i = 0; i < scale * scale * 0.10; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const a = 0.025 + rand() * 0.040;
        ctx.fillStyle = rand() > 0.5
          ? 'rgba(255,255,255,' + a.toFixed(3) + ')'
          : 'rgba(190,220,232,' + a.toFixed(3) + ')';
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (type === 'leaves') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x++) {
        for (let y = 0; y < scale; y++) {
          if ((x + y) % 2 === 0) {
            ctx.fillStyle = '#ffffff';
          } else {
            const r = rand();
            ctx.fillStyle = r > 0.6 ? '#f2f2f2' : (r > 0.2 ? '#e0e0e0' : '#d0d0d0');
          }
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else if (type === 'wood') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#f0f0f0';
      for (let x = 0; x < scale; x += 4) {
        ctx.fillRect(x, 0, 2, scale);
      }
      for (let i = 0; i < scale * scale * 0.1; i++) {
        const px = Math.floor(rand() * scale);
        const py = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.5 ? '#e0e0e0' : '#ffffff';
        ctx.fillRect(px, py, 1, 1);
      }
    } else if (type === 'dirt') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < 28; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.65 ? '#d2d2d2' : (rand() > 0.35 ? '#e5e5e5' : '#f4f4f4');
        ctx.fillRect(x, y, 1 + Math.floor(rand() * 2), 1 + Math.floor(rand() * 2));
      }
    } else if (type === 'sand') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < scale * scale * 0.22; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const r = rand();
        ctx.fillStyle = r > 0.72 ? '#f6f6f6' : (r > 0.35 ? '#e4e4e4' : '#d7d7d7');
        ctx.fillRect(x, y, 1, 1);
      }
    } else if (type === 'rock-face') {
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < scale * scale * 0.32; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = 1 + Math.floor(rand() * 3);
        const h = 1 + Math.floor(rand() * 3);
        const r = rand();
        ctx.fillStyle = r > 0.72 ? '#ffffff' : (r > 0.38 ? '#d8d8d8' : '#c8c8c8');
        ctx.fillRect(x, y, w, h);
      }
      for (let i = 0; i < Math.max(6, scale * 0.45); i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const len = 3 + Math.floor(rand() * 7);
        ctx.strokeStyle = rand() > 0.5 ? 'rgba(70,70,70,0.16)' : 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + Math.floor(rand() * 3) - 1);
        ctx.stroke();
      }
    } else if (type === 'island-side-blocks') {
      ctx.fillStyle = '#a8a49a';
      ctx.fillRect(0, 0, scale, scale);
      const blockW = Math.max(36, Math.floor(scale / 2.8));
      const blockH = Math.max(28, Math.floor(scale / 3.6));
      for (let y = -blockH; y < scale + blockH; y += blockH) {
        const row = Math.floor((y + blockH) / blockH);
        const offset = (row % 2) * Math.floor(blockW * 0.42);
        for (let x = -blockW - offset; x < scale + blockW; x += blockW) {
          const w = blockW + Math.floor((rand() - 0.5) * blockW * 0.32);
          const h = blockH + Math.floor((rand() - 0.5) * blockH * 0.30);
          const px = x + Math.floor((rand() - 0.5) * blockW * 0.12);
          const py = y + Math.floor((rand() - 0.5) * blockH * 0.12);
          const r = rand();
          ctx.fillStyle = r > 0.72 ? '#c4c0b4' : (r > 0.36 ? '#aaa69b' : '#8f8a80');
          tileRect(px + 1, py + 1, w - 2, h - 2);
          ctx.fillStyle = 'rgba(255,255,255,0.18)';
          tileRect(px + 2, py + 2, Math.max(4, w - 5), 2);
          tileRect(px + 2, py + 2, 2, Math.max(4, h - 5));
          ctx.fillStyle = 'rgba(40,38,34,0.16)';
          tileRect(px + 1, py + h - 3, Math.max(4, w - 3), 2);
          tileRect(px + w - 3, py + 1, 2, Math.max(4, h - 3));
        }
      }
      for (let i = 0; i < scale * 0.16; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const len = 3 + Math.floor(rand() * Math.max(3, scale / 12));
        ctx.strokeStyle = rand() > 0.50 ? 'rgba(255,255,255,0.10)' : 'rgba(42,40,36,0.10)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + Math.floor(rand() * 3) - 1);
        ctx.stroke();
      }
    } else if (type === 'pipe-metal') {
      const grad = ctx.createLinearGradient(0, 0, scale, 0);
      grad.addColorStop(0, '#8f9aa3');
      grad.addColorStop(0.30, '#c6ced4');
      grad.addColorStop(0.58, '#eef2f4');
      grad.addColorStop(1, '#6c747c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, scale, scale);
      for (let y = 0; y < scale; y += Math.max(4, Math.floor(scale / 8))) {
        ctx.fillStyle = y % 16 === 0 ? 'rgba(40,48,54,0.16)' : 'rgba(255,255,255,0.16)';
        ctx.fillRect(0, y, scale, 1);
      }
      for (let x = 0; x < scale; x += Math.max(8, Math.floor(scale / 4))) {
        ctx.fillStyle = 'rgba(28,34,40,0.12)';
        ctx.fillRect(x, 0, 1, scale);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(Math.min(scale - 1, x + 1), 0, 1, scale);
      }
      for (let i = 0; i < scale * scale * 0.10; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.54 ? 'rgba(255,255,255,0.14)' : 'rgba(20,28,34,0.12)';
        ctx.fillRect(x, y, 1 + Math.floor(rand() * 2), 1);
      }
    } else if (type === 'water-froth') {
      ctx.fillStyle = '#f7fdff';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < Math.max(24, scale * 0.65); i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = 2 + Math.floor(rand() * Math.max(3, scale / 9));
        const h = 1 + Math.floor(rand() * Math.max(2, scale / 18));
        const r = rand();
        ctx.fillStyle = r > 0.72 ? '#ffffff' : (r > 0.38 ? '#dfeff4' : '#c8e6ef');
        ctx.fillRect(x, y, w, h);
        if (x + w > scale) ctx.fillRect(0, y, x + w - scale, h);
        if (y + h > scale) ctx.fillRect(x, 0, w, y + h - scale);
      }
      for (let i = 0; i < Math.max(6, scale * 0.16); i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const len = 2 + Math.floor(rand() * Math.max(3, scale / 10));
        ctx.strokeStyle = rand() > 0.50 ? 'rgba(0,170,220,0.26)' : 'rgba(255,255,255,0.52)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo((x + len) % scale, y + Math.floor(rand() * 3) - 1);
        ctx.stroke();
      }
    } else if (type === 'path-pavers') {
      ctx.fillStyle = '#b6b4aa';
      ctx.fillRect(0, 0, scale, scale);
      const paver = Math.max(44, Math.floor(scale / 3));
      for (let y = 0; y < scale + paver; y += paver) {
        const row = Math.floor(y / paver);
        const offset = (row % 2) * Math.floor(paver * 0.46);
        for (let x = -offset; x < scale + paver; x += paver) {
          const w = paver + Math.floor(rand() * 9) - 4;
          const h = paver + Math.floor(rand() * 7) - 3;
          const r = rand();
          ctx.fillStyle = r > 0.76 ? '#e5e2d7' : (r > 0.38 ? '#d0cdc1' : '#bdb9ad');
          tileRect(x + 1, y + 1, w - 2, h - 2);
          const chip = Math.max(16, Math.floor(paver / 2));
          for (let yy = y + 3; yy < y + h - 4; yy += chip) {
            for (let xx = x + 3; xx < x + w - 4; xx += chip) {
              if (rand() < 0.70) continue;
              ctx.fillStyle = rand() > 0.55 ? 'rgba(255,255,255,0.06)' : 'rgba(82,80,72,0.04)';
              tileRect(xx, yy, chip, chip);
            }
          }
          ctx.fillStyle = 'rgba(255,255,255,0.20)';
          tileRect(x + 2, y + 2, w - 4, 2);
          tileRect(x + 2, y + 2, 2, h - 4);
          ctx.fillStyle = 'rgba(64,62,56,0.14)';
          tileRect(x + 1, y + h - 3, w - 3, 2);
          tileRect(x + w - 3, y + 1, 2, h - 3);
        }
      }
      for (let i = 0; i < scale * 0.22; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.52 ? 'rgba(255,255,255,0.08)' : 'rgba(76,74,66,0.07)';
        ctx.fillRect(x, y, 2, 2);
      }
    } else if (type === 'castle-block') {
      ctx.fillStyle = '#aba79e';
      ctx.fillRect(0, 0, scale, scale);
      const rowH = Math.max(7, Math.floor(scale / 8));
      for (let y = -rowH; y < scale + rowH; y += rowH) {
        const row = Math.floor((y + rowH) / rowH);
        const offset = (row % 2) * Math.floor(rowH * 1.45);
        let x = -offset - Math.floor(rand() * Math.max(2, rowH));
        while (x < scale + rowH * 3) {
          const w = Math.max(12, Math.floor(rowH * (1.7 + rand() * 1.15)));
          const h = rowH + (rand() > 0.68 ? 1 : 0);
          const r = rand();
          ctx.fillStyle = r > 0.70 ? '#d5d2c8' : (r > 0.34 ? '#c4c1b8' : '#b7b3aa');
          tileRect(x + 1, y + 1, w - 2, h - 2);
          ctx.fillStyle = 'rgba(255,255,255,0.14)';
          tileRect(x + 2, y + 2, w - 4, 1);
          ctx.fillStyle = 'rgba(54,52,48,0.13)';
          tileRect(x + 1, y + h - 2, w - 2, 1);
          if (rand() > 0.58) {
            ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(66,63,58,0.10)';
            tileRect(x + 2 + Math.floor(rand() * Math.max(1, w - 5)), y + 2 + Math.floor(rand() * Math.max(1, h - 4)), 2, 1);
          }
          x += w;
        }
      }
      for (let i = 0; i < scale * 0.60; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.55 ? 'rgba(255,255,255,0.07)' : 'rgba(72,70,64,0.06)';
        ctx.fillRect(x, y, 1 + Math.floor(rand() * 2), 1);
      }
    } else if (type === 'brick-building') {
      ctx.fillStyle = '#6e241e';
      ctx.fillRect(0, 0, scale, scale);
      const rowH = Math.max(7, Math.floor(scale / 8));
      const brickW = Math.max(15, Math.floor(scale / 4));
      for (let y = 0; y < scale + rowH; y += rowH) {
        const offset = (Math.floor(y / rowH) % 2) * Math.floor(brickW * 0.5);
        for (let x = -offset; x < scale + brickW; x += brickW) {
          const r = rand();
          ctx.fillStyle = r > 0.66 ? '#b74c37' : (r > 0.28 ? '#91402f' : '#6f2d25');
          tileRect(x + 1, y + 1, brickW - 2, rowH - 2);
          ctx.fillStyle = 'rgba(255,224,180,0.18)';
          tileRect(x + 2, y + 2, brickW - 5, 1);
          ctx.fillStyle = 'rgba(24,11,9,0.22)';
          tileRect(x + 1, y + rowH - 2, brickW - 2, 1);
          if (rand() > 0.58) {
            ctx.fillStyle = 'rgba(255,230,180,0.16)';
            tileRect(x + Math.floor(rand() * Math.max(2, brickW - 5)) + 2, y + 2, 2, 2);
          }
        }
      }
    } else if (type === 'roof-shingles') {
      ctx.fillStyle = '#76767e';
      ctx.fillRect(0, 0, scale, scale);
      const rowH = Math.max(22, Math.floor(scale / 3));
      const shingleW = Math.max(44, Math.floor(scale / 1.5));
      for (let y = 0; y < scale + rowH; y += rowH) {
        const offset = (Math.floor(y / rowH) % 2) * Math.floor(shingleW * 0.5);
        for (let x = -offset; x < scale + shingleW; x += shingleW) {
          const r = rand();
          ctx.fillStyle = r > 0.70 ? '#d9d6e0' : (r > 0.32 ? '#aaa6b5' : '#858193');
          tileRect(x + 1, y + 1, shingleW - 2, rowH - 1);
          ctx.fillStyle = 'rgba(255,255,255,0.16)';
          tileRect(x + 2, y + 2, shingleW - 4, 2);
          ctx.fillStyle = 'rgba(24,20,34,0.22)';
          tileRect(x + 1, y + rowH - 2, shingleW - 2, 2);
          tileRect(x + shingleW - 2, y + 2, 1, rowH - 3);
        }
      }
    } else if (type === 'window-lit') {
      const g = ctx.createRadialGradient(scale * 0.5, scale * 0.50, scale * 0.05, scale * 0.5, scale * 0.5, scale * 0.70);
      g.addColorStop(0, '#fff0a6');
      g.addColorStop(0.55, '#f0a83e');
      g.addColorStop(1, '#5a2c16');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = 'rgba(42,23,15,0.70)';
      ctx.fillRect(0, 0, scale, 4);
      ctx.fillRect(0, scale - 4, scale, 4);
      ctx.fillRect(0, 0, 4, scale);
      ctx.fillRect(scale - 4, 0, 4, scale);
      ctx.fillRect(Math.floor(scale * 0.49), 3, 3, scale - 6);
      ctx.fillRect(3, Math.floor(scale * 0.48), scale - 6, 3);
      ctx.fillStyle = 'rgba(255,255,210,0.55)';
      ctx.fillRect(Math.floor(scale * 0.20), Math.floor(scale * 0.12), Math.floor(scale * 0.16), Math.floor(scale * 0.76));
      ctx.fillRect(Math.floor(scale * 0.58), Math.floor(scale * 0.12), Math.floor(scale * 0.08), Math.floor(scale * 0.76));
    } else if (type === 'window-unlit') {
      const g = ctx.createLinearGradient(0, 0, scale, scale);
      g.addColorStop(0, '#36465a');
      g.addColorStop(0.55, '#151d2a');
      g.addColorStop(1, '#080b10');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = 'rgba(11,12,14,0.78)';
      ctx.fillRect(0, 0, scale, 4);
      ctx.fillRect(0, scale - 4, scale, 4);
      ctx.fillRect(0, 0, 4, scale);
      ctx.fillRect(scale - 4, 0, 4, scale);
      ctx.fillRect(Math.floor(scale * 0.49), 3, 3, scale - 6);
      ctx.fillRect(3, Math.floor(scale * 0.48), scale - 6, 3);
      ctx.fillStyle = 'rgba(120,154,190,0.28)';
      ctx.fillRect(Math.floor(scale * 0.18), Math.floor(scale * 0.12), Math.floor(scale * 0.12), Math.floor(scale * 0.72));
      ctx.fillRect(Math.floor(scale * 0.55), Math.floor(scale * 0.10), Math.floor(scale * 0.06), Math.floor(scale * 0.72));
    } else if (type === 'grass-side') {
      ctx.fillStyle = '#618e2c';
      ctx.fillRect(0, 0, scale, scale);
      const block = Math.max(42, Math.floor(scale / 1.5));
      for (let y = 0; y < scale + block; y += block) {
        for (let x = 0; x < scale; x += block) {
          const r = rand();
          ctx.fillStyle = r > 0.68 ? '#93bf45' : (r > 0.30 ? '#76a533' : '#5b8628');
          tileRect(x + 1, y + 1, block - 2, block - 2);
          ctx.fillStyle = 'rgba(255,255,150,0.18)';
          tileRect(x + 2, y + 2, block - 4, 2);
          ctx.fillStyle = 'rgba(20,52,15,0.24)';
          tileRect(x + 1, y + block - 3, block - 2, 2);
        }
      }
      for (let i = 0; i < scale * 0.55; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.5 ? 'rgba(192,238,88,0.24)' : 'rgba(44,92,26,0.18)';
        ctx.fillRect(x, y, 2, 2 + Math.floor(rand() * 2));
      }
    } else if (type === 'grass-voxel') {
      ctx.fillStyle = '#78ab3c';
      ctx.fillRect(0, 0, scale, scale);
      const chip = Math.max(26, Math.floor(scale / 2.4));
      for (let y = 0; y < scale; y += chip) {
        for (let x = 0; x < scale; x += chip) {
          const r = rand();
          ctx.fillStyle = r > 0.70 ? '#9ec24f' : (r > 0.34 ? '#80aa3f' : '#629032');
          ctx.fillRect(x, y, chip, chip);
        }
      }
      for (let i = 0; i < scale * 0.42; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const h = 2 + Math.floor(rand() * 4);
        ctx.fillStyle = rand() > 0.52 ? 'rgba(206,238,110,0.26)' : 'rgba(48,100,28,0.20)';
        ctx.fillRect(x, y, 1, h);
        if (rand() > 0.82 && x + 1 < scale) ctx.fillRect(x + 1, y + Math.floor(h * 0.5), 1, 1);
      }
    } else if (type === 'soil-side') {
      ctx.fillStyle = '#7d522c';
      ctx.fillRect(0, 0, scale, scale);
      const patch = Math.max(24, Math.floor(scale / 2.45));
      for (let y = -patch; y < scale + patch; y += patch) {
        const rowOffset = Math.floor((rand() - 0.5) * patch * 0.70);
        for (let x = -patch; x < scale + patch; x += patch) {
          const r = rand();
          const px = x + rowOffset + Math.floor((rand() - 0.5) * patch * 0.32);
          const py = y + Math.floor((rand() - 0.5) * patch * 0.22);
          const w = patch + Math.floor((rand() - 0.5) * patch * 0.45);
          const h = patch + Math.floor((rand() - 0.5) * patch * 0.38);
          ctx.fillStyle = r > 0.74 ? '#a66c39' : (r > 0.34 ? '#80502a' : '#643b20');
          tileRect(px, py, w, h);
          if (rand() > 0.48) {
            ctx.fillStyle = 'rgba(224,154,76,0.12)';
            tileRect(px + 2, py + 2, Math.max(3, w - 5), 2);
          }
          if (rand() > 0.42) {
            ctx.fillStyle = 'rgba(43,24,12,0.10)';
            tileRect(px + Math.floor(w * 0.58), py + Math.floor(h * 0.18), 2, Math.max(4, Math.floor(h * 0.55)));
          }
        }
      }
      for (let i = 0; i < scale * 0.36; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.58 ? 'rgba(220,146,70,0.18)' : 'rgba(38,22,12,0.15)';
        ctx.fillRect(x, y, 1 + Math.floor(rand() * 3), 1 + Math.floor(rand() * 2));
      }
      for (let i = 0; i < scale * 0.10; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const len = 3 + Math.floor(rand() * Math.max(4, scale / 8));
        ctx.strokeStyle = rand() > 0.45 ? 'rgba(232,170,92,0.13)' : 'rgba(34,19,10,0.14)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + len, y + Math.floor(rand() * 5) - 2);
        ctx.stroke();
      }
    } else if (type === 'fence-timber') {
      ctx.fillStyle = '#a86d35';
      ctx.fillRect(0, 0, scale, scale);
      const plank = Math.max(12, Math.floor(scale / 4));
      for (let y = 0; y < scale; y += plank) {
        const r = rand();
        ctx.fillStyle = r > 0.64 ? '#d19655' : (r > 0.28 ? '#bd7d3c' : '#985f2d');
        ctx.fillRect(0, y + 1, scale, plank - 2);
        ctx.fillStyle = 'rgba(255,224,150,0.20)';
        ctx.fillRect(0, y + 3, scale, 2);
        ctx.fillStyle = 'rgba(72,38,18,0.16)';
        ctx.fillRect(0, y + plank - 3, scale, 2);
      }
      for (let y = 0; y < scale; y += Math.max(7, Math.floor(scale / 8))) {
        ctx.strokeStyle = y % 16 === 0 ? 'rgba(86,45,20,0.18)' : 'rgba(255,222,145,0.18)';
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(scale * 0.22, y + rand() * 5 - 2, scale * 0.66, y + rand() * 5 - 2, scale, y + rand() * 4 - 2);
        ctx.stroke();
      }
    } else if (type === 'crop-stalk') {
      ctx.fillStyle = '#5f8b2e';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x += Math.max(6, Math.floor(scale / 8))) {
        const r = rand();
        ctx.fillStyle = r > 0.58 ? '#b2c94f' : (r > 0.28 ? '#87aa3f' : '#4e7b2a');
        ctx.fillRect(x, 0, 2 + Math.floor(rand() * 3), scale);
        ctx.fillStyle = 'rgba(255,235,120,0.18)';
        ctx.fillRect(x + 1, 0, 1, scale);
      }
      for (let i = 0; i < scale * 0.8; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.5 ? 'rgba(225,230,92,0.28)' : 'rgba(28,74,20,0.28)';
        ctx.fillRect(x, y, 1 + Math.floor(rand() * 2), 2);
      }
    } else if (type === 'corn-cob') {
      ctx.fillStyle = '#d7b032';
      ctx.fillRect(0, 0, scale, scale);
      const kernel = Math.max(6, Math.floor(scale / 9));
      for (let y = 0; y < scale + kernel; y += kernel) {
        const offset = (Math.floor(y / kernel) % 2) * Math.floor(kernel * 0.5);
        for (let x = -offset; x < scale + kernel; x += kernel) {
          const r = rand();
          ctx.fillStyle = r > 0.72 ? '#ffe372' : (r > 0.34 ? '#e4c24a' : '#b9952c');
          tileRect(x + 1, y + 1, kernel - 1, kernel - 1);
          ctx.fillStyle = 'rgba(255,248,160,0.24)';
          tileRect(x + 2, y + 2, Math.max(1, kernel - 4), 1);
        }
      }
    } else if (type === 'sunflower-petal') {
      ctx.fillStyle = '#d0a820';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x += Math.max(8, Math.floor(scale / 8))) {
        ctx.fillStyle = rand() > 0.5 ? '#ffe16a' : '#e8be35';
        ctx.fillRect(x, 0, 5, scale);
        ctx.fillStyle = 'rgba(129,80,18,0.20)';
        ctx.fillRect(x + 5, 0, 1, scale);
      }
      for (let i = 0; i < scale; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,240,116,0.26)' : 'rgba(120,72,14,0.18)';
        ctx.fillRect(x, y, 1, 1 + Math.floor(rand() * 2));
      }
    } else if (type === 'sunflower-center') {
      ctx.fillStyle = '#5a3518';
      ctx.fillRect(0, 0, scale, scale);
      const seed = Math.max(5, Math.floor(scale / 10));
      for (let y = 0; y < scale + seed; y += seed) {
        const offset = (Math.floor(y / seed) % 2) * Math.floor(seed * 0.5);
        for (let x = -offset; x < scale + seed; x += seed) {
          const r = rand();
          ctx.fillStyle = r > 0.70 ? '#8a5a24' : (r > 0.34 ? '#6a431d' : '#321d0e');
          tileRect(x + 1, y + 1, seed - 1, seed - 1);
        }
      }
    } else if (type === 'grass') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x++) {
        for (let y = 0; y < scale; y++) {
          const r = rand();
          if (r > 0.88) {
            ctx.fillStyle = '#f7f7f7';
            ctx.fillRect(x, y, 1, 1);
          } else if (r < 0.12) {
            ctx.fillStyle = '#f0f0f0';
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      ctx.fillStyle = '#e2e2e2';
      const numBlades = Math.floor(scale * scale * 0.08);
      for (let i = 0; i < numBlades; i++) {
        const bx = Math.floor(rand() * scale);
        const by = Math.floor(rand() * (scale - 1));
        ctx.fillRect(bx, by, 1, 2);
        if (rand() > 0.6 && bx < scale - 1) {
          ctx.fillRect(bx + 1, by + 1, 1, 1);
        }
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, scale, scale);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    twSetTextureSRGB(tex);
    tuneWorldTextureFiltering(tex);
    return tex;
  }

  function createCottageTexture(type, scale = 128) {
    const canvas = document.createElement('canvas');
    canvas.width = scale;
    canvas.height = scale;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const rand = makeMulberry32('cottage-texture:' + type + ':' + scale);
    function addNoise(amount = 42, alpha = 0.14) {
      const image = ctx.getImageData(0, 0, scale, scale);
      for (let i = 0; i < image.data.length; i += 4) {
        const n = Math.floor((rand() - 0.5) * amount);
        image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
        image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n));
        image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n));
        image.data[i + 3] = Math.floor(255 * (1 - alpha + alpha * rand()));
      }
      ctx.putImageData(image, 0, 0);
    }

    if (type === 'grass') {
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(0, 0, scale, scale);
      for (let i = 0; i < 850; i++) {
        const x = rand() * scale;
        const y = rand() * scale;
        const h = 2 + rand() * 8;
        ctx.strokeStyle = rand() > 0.5 ? '#d4d4d4' : '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rand() * 3 - 1.5, y - h);
        ctx.stroke();
      }
    } else if (type === 'wood') {
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(0, 0, scale, scale);
      for (let x = 0; x < scale; x += 9) {
        ctx.strokeStyle = x % 18 === 0 ? '#b8b8b8' : '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 4, scale * 0.25, x - 3, scale * 0.65, x + 2, scale);
        ctx.stroke();
      }
      addNoise(30, 0.08);
    } else if (type === 'glass') {
      const g = ctx.createLinearGradient(0, 0, scale, scale);
      g.addColorStop(0, '#9fe3ff');
      g.addColorStop(1, '#417fa8');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = 'rgba(255,255,255,0.70)';
      ctx.fillRect(scale * 0.19, scale * 0.16, scale * 0.13, scale * 0.78);
      ctx.fillRect(scale * 0.53, scale * 0.16, scale * 0.05, scale * 0.78);
      ctx.fillStyle = 'rgba(20,42,70,0.22)';
      ctx.fillRect(0, scale * 0.5 - 3, scale, 6);
      ctx.fillRect(scale * 0.5 - 3, 0, 6, scale);
    } else if (type === 'dirt') {
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(0, 0, scale, scale);
      for (let y = 0; y < scale; y += 11) {
        ctx.fillStyle = y % 22 === 0 ? '#d8d8d8' : '#e6e6e6';
        ctx.fillRect(0, y + Math.floor(rand() * 2), scale, 2);
      }
      for (let i = 0; i < 420; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = rand() > 0.78 ? 2 : 1;
        ctx.fillStyle = rand() > 0.55 ? '#d0d0d0' : '#f7f7f7';
        ctx.fillRect(x, y, w, 1);
      }
      addNoise(24, 0.06);
    } else {
      ctx.fillStyle = '#eeeeee';
      ctx.fillRect(0, 0, scale, scale);
      ctx.fillStyle = '#b8b8b8';
      for (let y = 0; y < scale; y += 18) {
        ctx.fillRect(0, y, scale, 2);
      }
      for (let y = 0; y < scale; y += 36) {
        for (let x = 0; x < scale; x += 32) {
          ctx.fillRect(x + (y % 72 ? 16 : 0), y, 2, 18);
        }
      }
      for (let i = 0; i < 110; i++) {
        const x = Math.floor(rand() * scale);
        const y = Math.floor(rand() * scale);
        const w = 1 + Math.floor(rand() * 4);
        const h = 1 + Math.floor(rand() * 3);
        ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(90,90,90,0.14)';
        ctx.fillRect(x, y, w, h);
      }
      addNoise(26, 0.06);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    twSetTextureSRGB(tex);
    tuneWorldTextureFiltering(tex);
    return tex;
  }

  function createIslandSideStrataReferenceTexture(width = 1024, height = 192) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    const rand = makeMulberry32('island-side-strata-reference:' + width + ':' + height);
    function wrapRect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
      if (x < 0) ctx.fillRect(x + width, y, w, h);
      if (x + w > width) ctx.fillRect(x - width, y, w, h);
    }
    function strokeWrapped(x1, y1, x2, y2, color, widthPx = 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = widthPx;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      if (x1 < 0 || x2 < 0 || x1 > width || x2 > width) {
        ctx.beginPath();
        ctx.moveTo(x1 + width, y1);
        ctx.lineTo(x2 + width, y2);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1 - width, y1);
        ctx.lineTo(x2 - width, y2);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#161610';
    ctx.fillRect(0, 0, width, height);

    const grassMax = Math.floor(height * 0.34);
    const dirtTop = Math.floor(height * 0.23);
    const rockTop = Math.floor(height * 0.72);
    ctx.fillStyle = '#5a3518';
    ctx.fillRect(0, dirtTop, width, rockTop - dirtTop);
    ctx.fillStyle = '#4b493b';
    ctx.fillRect(0, rockTop, width, height - rockTop);

    for (let y = dirtTop; y < rockTop + 8; y += Math.floor(height * 0.19)) {
      const rowH = Math.floor(height * (0.17 + rand() * 0.035));
      const blockW = Math.floor(width * (0.075 + rand() * 0.025));
      const rowOffset = rand() > 0.5 ? -blockW * 0.45 : 0;
      for (let x = -blockW * 2 + rowOffset; x < width + blockW; x += blockW) {
        const bw = Math.floor(blockW * (0.82 + rand() * 0.34));
        const bh = Math.max(12, Math.floor(rowH * (0.80 + rand() * 0.26)));
        const px = Math.floor(x + (rand() - 0.5) * blockW * 0.22);
        const py = Math.floor(y + (rand() - 0.5) * rowH * 0.10);
        const base = rand();
        const fill = base > 0.72 ? '#8c5a22' : (base > 0.30 ? '#6b4019' : '#3d2512');
        wrapRect(px - 2, py - 2, bw + 4, bh + 4, 'rgba(14,10,6,0.72)');
        wrapRect(px, py, bw, bh, fill);
        wrapRect(px + 3, py + 3, Math.max(8, bw - 8), 2, 'rgba(236,189,99,0.22)');
        wrapRect(px + 3, py + bh - 5, Math.max(8, bw - 8), 3, 'rgba(18,11,5,0.30)');
        if (rand() > 0.65) {
          wrapRect(px + Math.floor(bw * rand()), py + 5 + Math.floor(rand() * Math.max(4, bh - 10)), 2, Math.max(6, Math.floor(bh * 0.40)), 'rgba(8,6,4,0.35)');
        }
      }
    }

    wrapRect(0, Math.floor(height * 0.55), width, 3, 'rgba(232,190,92,0.46)');
    wrapRect(0, Math.floor(height * 0.57), width, 2, 'rgba(26,16,8,0.35)');

    const rockRowH = Math.floor(height * 0.16);
    for (let y = rockTop - 6; y < height + rockRowH; y += rockRowH) {
      const offset = ((Math.floor(y / rockRowH) % 2) ? 0.5 : 0) * Math.floor(width * 0.07);
      for (let x = -80 + offset; x < width + 80; x += Math.floor(width * 0.08)) {
        const bw = Math.floor(width * (0.060 + rand() * 0.035));
        const bh = Math.floor(rockRowH * (0.72 + rand() * 0.30));
        const shade = rand();
        const fill = shade > 0.66 ? '#6b6653' : (shade > 0.30 ? '#504d42' : '#34342f');
        wrapRect(x - 2, y - 2, bw + 4, bh + 4, 'rgba(11,11,10,0.58)');
        wrapRect(x, y, bw, bh, fill);
        wrapRect(x + 3, y + 3, Math.max(7, bw - 8), 2, 'rgba(230,225,190,0.14)');
      }
    }

    for (let x = -24; x < width + 48; x += Math.floor(width * (0.035 + rand() * 0.018))) {
      const capW = Math.floor(width * (0.035 + rand() * 0.035));
      const drop = Math.floor(height * (0.18 + rand() * 0.22));
      const color = rand() > 0.60 ? '#7c962c' : (rand() > 0.25 ? '#5f781f' : '#384f15');
      wrapRect(x - 2, 0, capW + 4, drop + 3, 'rgba(20,31,9,0.45)');
      wrapRect(x, 0, capW, drop, color);
      wrapRect(x + 2, 2, Math.max(4, capW - 5), 3, 'rgba(202,223,91,0.18)');
      const dripCount = 1 + Math.floor(rand() * 4);
      for (let i = 0; i < dripCount; i++) {
        const rx = x + Math.floor(rand() * Math.max(1, capW));
        const rh = Math.floor(height * (0.12 + rand() * 0.30));
        wrapRect(rx, drop - 4, 2 + Math.floor(rand() * 3), rh, rand() > 0.35 ? '#27370e' : '#0e1707');
      }
    }

    for (let i = 0; i < width * 1.25; i++) {
      const x = Math.floor(rand() * width);
      const y = Math.floor(rand() * grassMax);
      const len = 4 + Math.floor(rand() * 14);
      const lean = Math.floor(rand() * 9) - 4;
      strokeWrapped(x, y + len, x + lean, y, rand() > 0.55 ? '#a9c94a' : '#304817', 1);
    }
    for (let i = 0; i < width * 0.55; i++) {
      const x = Math.floor(rand() * width);
      const y = Math.floor(rand() * height);
      const shade = rand();
      const color = shade > 0.66 ? 'rgba(255,240,160,0.16)' : (shade > 0.33 ? 'rgba(0,0,0,0.17)' : 'rgba(94,72,35,0.20)');
      wrapRect(x, y, 1 + Math.floor(rand() * 5), 1 + Math.floor(rand() * 3), color);
    }

    const image = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < image.data.length; i += 4) {
      const n = Math.floor((rand() - 0.5) * 24);
      image.data[i] = Math.max(0, Math.min(255, image.data[i] + n));
      image.data[i + 1] = Math.max(0, Math.min(255, image.data[i + 1] + n));
      image.data[i + 2] = Math.max(0, Math.min(255, image.data[i + 2] + n));
    }
    ctx.putImageData(image, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;
    twSetTextureSRGB(tex);
    tuneWorldTextureFiltering(tex);
    return tex;
  }

  function createIslandSideStrataImageTexture(src) {
    const width = 1024;
    const height = 192;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    const fallback = createIslandSideStrataReferenceTexture(width, height);
    if (fallback && fallback.image) ctx.drawImage(fallback.image, 0, 0, width, height);
    // Only the canvas pixels were needed; release the texture wrapper so it
    // can't be uploaded or retained.
    if (fallback && fallback.dispose) fallback.dispose();
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.flipY = false;
    twSetTextureSRGB(tex);
    tuneWorldTextureFiltering(tex);
    tex.userData = Object.assign({}, tex.userData || {}, {
      sourceSrc: src,
      sourceKind: 'island-side-strata-image',
    });
    function liftStrataCanvasShadows() {
      const image = ctx.getImageData(0, 0, width, height);
      const data = image.data;
      for (let i = 0; i < data.length; i += 4) {
        const y = Math.floor((i / 4) / width);
        const floor = y < height * 0.34 ? 56 : (y < height * 0.72 ? 62 : 68);
        const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (lum > 0 && lum < floor) {
          const scale = floor / lum;
          data[i] = Math.min(255, Math.round(data[i] * scale));
          data[i + 1] = Math.min(255, Math.round(data[i + 1] * scale));
          data[i + 2] = Math.min(255, Math.round(data[i + 2] * scale));
        }
      }
      ctx.putImageData(image, 0, 0);
    }
    liftStrataCanvasShadows();
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      liftStrataCanvasShadows();
      tex.needsUpdate = true;
      repaintAfterTextureLoad();
    };
    img.src = src;
    return tex;
  }

  function applyWorldUVs(material, texture, textureScale = 1.0, opts = {}) {
    if (!material) return;
    const needsWorldVoxel = !!(opts.voxelSeams || opts.edgeStrata);
    const edgeStrataTopY = Number.isFinite(opts.edgeTopY) ? opts.edgeTopY : 0;
    const edgeStrataHeight = Number.isFinite(opts.edgeHeight) ? opts.edgeHeight : DIRT_H + 0.035;
    material.map = texture;
    material.userData = material.userData || {};
    material.userData.worldTextureScale = textureScale;
    material.userData.worldVoxelSeams = !!opts.voxelSeams;
    material.userData.worldEdgeStrata = !!opts.edgeStrata;
    // The voxel side/strata branches below use fwidth() for screen-space LOD
    // anti-aliasing. In GLSL ES 1.00 (three's default for Lambert) derivatives
    // need this extension flag, or the shader fails to compile. Base
    // Material.clone() does NOT copy .extensions (only ShaderMaterial does), so
    // the clone helpers (customMaterial / surfaceMaterial) re-copy it.
    if (needsWorldVoxel) {
      material.extensions = Object.assign({}, material.extensions, { derivatives: true });
    }
    material.needsUpdate = true;
    material.customProgramCacheKey = () => [
      'tw-world-uv',
      textureScale.toFixed(4),
      opts.voxelSeams ? 'seams' : 'plain',
      opts.edgeStrata ? 'edge' : 'no-edge',
      edgeStrataTopY.toFixed(4),
      edgeStrataHeight.toFixed(4),
    ].join(':');
    material.onBeforeCompile = (shader) => {
      if (needsWorldVoxel) {
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          `
          #include <common>
          varying vec3 vWorldVoxelPos;
          varying vec3 vWorldVoxelNormal;
          `
        );
      }
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 worldPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          worldPos = instanceMatrix * worldPos;
        #endif
        worldPos = modelMatrix * worldPos;

        vec4 localNormal = vec4(normal, 0.0);
        #ifdef USE_INSTANCING
          localNormal = instanceMatrix * localNormal;
        #endif
        vec3 worldNormal = normalize((modelMatrix * localNormal).xyz);

        #ifdef USE_MAP
          if (abs(worldNormal.y) > 0.5) {
            vMapUv = worldPos.xz * ${textureScale.toFixed(4)};
          } else if (abs(worldNormal.x) > 0.5) {
            vMapUv = worldPos.zy * ${textureScale.toFixed(4)};
          } else {
            vMapUv = worldPos.xy * ${textureScale.toFixed(4)};
          }
        #endif
        ${needsWorldVoxel ? `
        vWorldVoxelPos = worldPos.xyz;
        vWorldVoxelNormal = worldNormal;
        ` : ''}
        `
      );
      if (needsWorldVoxel) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <common>',
          `
          #include <common>
          varying vec3 vWorldVoxelPos;
          varying vec3 vWorldVoxelNormal;

          float twVoxelSeamLine(float coord, float scale, float width) {
            float f = fract(coord * scale);
            float d = min(f, 1.0 - f);
            return 1.0 - smoothstep(width, width * 2.8, d);
          }

          float twVoxelBlockHash(vec2 cell) {
            return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
          }
          `
        );
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <map_fragment>',
          `
          #include <map_fragment>
          vec3 twVoxelNormal = normalize(vWorldVoxelNormal);
          float twSideFace = 1.0 - smoothstep(0.42, 0.72, abs(twVoxelNormal.y));
          float twSideCoord = abs(twVoxelNormal.x) > abs(twVoxelNormal.z) ? vWorldVoxelPos.z : vWorldVoxelPos.x;
          ${opts.voxelSeams ? `
          float sideY = vWorldVoxelPos.y + 0.08;
          float sideNoiseA = twVoxelBlockHash(floor(vec2(twSideCoord * 7.3, sideY * 5.1)));
          float sideNoiseB = twVoxelBlockHash(floor(vec2(twSideCoord * 15.7 + sideY * 0.9, sideY * 11.3)));
          float underFace = smoothstep(0.62, 0.86, -twVoxelNormal.y);
          float underNoiseA = twVoxelBlockHash(floor(vWorldVoxelPos.xz * 5.6));
          float underNoiseB = twVoxelBlockHash(floor(vWorldVoxelPos.xz * 13.2 + vec2(17.0, 41.0)));
          // Each per-cell hash above aliases once its cells drop below ~1 screen
          // pixel (grazing side walls hit this hard). Fade every term to its mean
          // as the screen-space footprint grows, so the noise stops swimming into
          // diagonal stripes at distance while staying crisp up close.
          float dSide = fwidth(twSideCoord);
          float dSideY = fwidth(sideY);
          float dXZ = max(fwidth(vWorldVoxelPos.x), fwidth(vWorldVoxelPos.z));
          float fadeSideA  = 1.0 - smoothstep(0.45, 1.0, max(7.3  * dSide, 5.1  * dSideY));
          float fadeSideB  = 1.0 - smoothstep(0.45, 1.0, max(15.7 * dSide, 11.3 * dSideY));
          float fadeUnderA = 1.0 - smoothstep(0.45, 1.0, 5.6  * dXZ);
          float fadeUnderB = 1.0 - smoothstep(0.45, 1.0, 13.2 * dXZ);
          float rockNoise = (sideNoiseA - 0.5) * 0.10 * fadeSideA + (sideNoiseB - 0.5) * 0.045 * fadeSideB;
          float underNoise = (underNoiseA - 0.5) * 0.12 * fadeUnderA + (underNoiseB - 0.5) * 0.050 * fadeUnderB;
          float faintCrack = step(0.965, sideNoiseB) * twSideFace * 0.10 * fadeSideB;
          diffuseColor.rgb *= 1.0 + twSideFace * rockNoise + underFace * underNoise;
          diffuseColor.rgb *= mix(1.0, 0.88, faintCrack);
          ` : ''}
          ${opts.edgeStrata ? `
          float edgeTopY = ${edgeStrataTopY.toFixed(4)};
          float edgeDepth = clamp((edgeTopY - vWorldVoxelPos.y) / ${edgeStrataHeight.toFixed(4)}, 0.0, 1.0);
          float edgeTopGate = 1.0 - smoothstep(edgeTopY - 0.010, edgeTopY + 0.025, vWorldVoxelPos.y);
          float edgeBody = edgeTopGate * (1.0 - smoothstep(0.98, 1.04, edgeDepth));
          float edgeCell = floor(twSideCoord * 3.85);
          float edgeSeed = twVoxelBlockHash(vec2(edgeCell, 41.0));
          float grassDrop = 0.16 + edgeSeed * 0.14;
          float grassMask = 1.0 - smoothstep(grassDrop, grassDrop + 0.050, edgeDepth);
          float dirtMask = smoothstep(0.12, 0.20, edgeDepth) * (1.0 - smoothstep(0.68, 0.80, edgeDepth));
          float rockMask = smoothstep(0.66, 0.78, edgeDepth);
          vec2 dirtCell = floor(vec2(twSideCoord * 3.55, edgeDepth * 4.80));
          vec2 rockCell = floor(vec2(twSideCoord * 3.15 + 2.0, edgeDepth * 4.15));
          float dirtShade = twVoxelBlockHash(dirtCell) - 0.5;
          float rockShade = twVoxelBlockHash(rockCell) - 0.5;
          vec3 grassColor = mix(vec3(0.36, 0.54, 0.17), vec3(0.74, 0.82, 0.34), 0.44 + edgeSeed * 0.34);
          vec3 dirtColor = vec3(0.50, 0.31, 0.14) + vec3(dirtShade * 0.095);
          vec3 rockColor = vec3(0.30, 0.30, 0.27) + vec3(rockShade * 0.070);
          float blockLineX = twVoxelSeamLine(twSideCoord + edgeDepth * 0.035, 3.55, 0.012);
          float blockLineY = twVoxelSeamLine(edgeDepth, 4.80, 0.010);
          float blockLine = clamp(blockLineX * 0.44 + blockLineY * 0.36, 0.0, 1.0);
          float bladeLine = 1.0 - smoothstep(0.012, 0.030, abs(fract(twSideCoord * 24.0 + edgeSeed * 0.21) - 0.5));
          float bladeSeed = step(0.42, twVoxelBlockHash(vec2(floor(twSideCoord * 24.0), 13.0)));
          float bladeMask = bladeLine * bladeSeed * (1.0 - smoothstep(0.0, grassDrop * 0.90, edgeDepth));
          float fringeLine = 1.0 - smoothstep(0.010, 0.030, abs(fract(twSideCoord * 11.0 + edgeSeed * 0.37) - 0.5));
          float fringeDrop = grassDrop + 0.10 * twVoxelBlockHash(vec2(floor(twSideCoord * 11.0), 31.0));
          float fringeMask = fringeLine * (1.0 - smoothstep(fringeDrop, fringeDrop + 0.060, edgeDepth));
          float rootLine = 1.0 - smoothstep(0.010, 0.026, abs(fract(twSideCoord * 15.0 + edgeSeed * 0.19) - 0.5));
          float rootSeed = step(0.52, twVoxelBlockHash(vec2(floor(twSideCoord * 15.0), 23.0)));
          float rootMask = rootLine * rootSeed * smoothstep(0.13, 0.20, edgeDepth) * (1.0 - smoothstep(0.52, 0.66, edgeDepth));
          vec3 strataColor = mix(dirtColor, rockColor, rockMask * 0.94);
          strataColor = mix(strataColor, dirtColor * 0.70, blockLine * dirtMask * 0.52);
          strataColor = mix(strataColor, grassColor, grassMask * 0.98);
          strataColor = mix(strataColor, grassColor * 0.62, max(bladeMask * 0.34, fringeMask * 0.42));
          strataColor *= mix(1.0, 0.68, blockLine * max(dirtMask, rockMask));
          strataColor = mix(strataColor, vec3(0.11, 0.075, 0.035), rootMask * 0.72);
          diffuseColor.rgb = mix(diffuseColor.rgb, strataColor, edgeBody);
          ` : ''}
          `
        );
      }
    };
  }

  const waterTextureFlowStates = new Map();

  function waterTextureFlowState(dx = 1, dz = 0) {
    const sx = Math.sign(dx || 0);
    const sz = Math.sign(dz || 0);
    const key = sx + ',' + sz;
    if (!waterTextureFlowStates.has(key)) {
      waterTextureFlowStates.set(key, {
        offset: new THREE.Vector2(0, 0),
        direction: new THREE.Vector2(sx, sz),
        speed: 0.20,
      });
    }
    return waterTextureFlowStates.get(key);
  }

  // Shared clock + procedural noise for the enhanced water surface shader
  // (planar reflection, refractive bend, sun glints, crest foam). Advanced by tickWaterTextureFlow
  // and shared across every water material so one update drives them all.
  const WATER_SURFACE_SHADER_VARIANT = 'planar-reflect-v3';
  const waterShaderTimeUniform = { value: 0 };
  const WATER_SHADER_NOISE_GLSL = `
    float twWaterHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
    float twWaterNoise(vec2 p){
      vec2 i = floor(p); vec2 f = fract(p);
      vec2 u = f*f*(3.0-2.0*f);
      return mix(mix(twWaterHash(i), twWaterHash(i+vec2(1.0,0.0)), u.x),
                 mix(twWaterHash(i+vec2(0.0,1.0)), twWaterHash(i+vec2(1.0,1.0)), u.x), u.y);
    }
  `;

  function applyFlowingWaterUVs(material, texture, textureScale = 1.0, flowState = waterTextureFlowState(1, 0)) {
    if (!material) return;
    material.map = texture;
    material.userData = material.userData || {};
    material.userData.worldTextureScale = textureScale;
    material.userData.twWaterReflective = true;
    material.needsUpdate = true;
    // The enhanced surface shimmer is injected via onBeforeCompile, whose output
    // is NOT part of the default program cache key — so give each enhanced/plain
    // state its own key. That lets the Settings toggle recompile water cleanly.
    material.customProgramCacheKey = () =>
      'tw-water-' + WATER_SURFACE_SHADER_VARIANT + '-' + textureScale.toFixed(4) + '-' +
        (renderEnhancedWater ? 'fx' : 'plain');
    material.onBeforeCompile = (shader) => {
      const enhanced = (typeof renderEnhancedWater === 'undefined') ? true : renderEnhancedWater;
      const reflectionUniforms = (typeof twWaterReflectionUniforms === 'function') ? twWaterReflectionUniforms() : null;
      shader.uniforms.waterFlowOffset = { value: flowState.offset };
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform vec2 waterFlowOffset;
        ${enhanced ? 'uniform mat4 twReflectionMatrix; varying vec2 vTwWaterSurfaceUv; varying vec3 vTwWaterWorld; varying vec3 vTwWaterView; varying vec3 vTwWaterNrm; varying vec4 vTwReflectCoord;' : ''}
        `
      );
      shader.vertexShader = shader.vertexShader.replace(
        '#include <project_vertex>',
        `
        #include <project_vertex>
        vec4 worldPos = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          worldPos = instanceMatrix * worldPos;
        #endif
        worldPos = modelMatrix * worldPos;

        vec4 localNormal = vec4(normal, 0.0);
        #ifdef USE_INSTANCING
          localNormal = instanceMatrix * localNormal;
        #endif
        vec3 worldNormal = normalize((modelMatrix * localNormal).xyz);
        ${enhanced ? 'vTwWaterWorld = worldPos.xyz; vTwWaterView = cameraPosition - worldPos.xyz; vTwWaterNrm = worldNormal; vTwReflectCoord = twReflectionMatrix * worldPos;' : ''}

        vec2 twWaterFlowUv;
        if (abs(worldNormal.y) > 0.5) {
          twWaterFlowUv = worldPos.xz * ${textureScale.toFixed(4)} + waterFlowOffset;
        } else if (abs(worldNormal.x) > 0.5) {
          twWaterFlowUv = worldPos.zy * ${textureScale.toFixed(4)} + waterFlowOffset.yx;
        } else {
          twWaterFlowUv = worldPos.xy * ${textureScale.toFixed(4)} + waterFlowOffset;
        }
        ${enhanced ? 'vTwWaterSurfaceUv = twWaterFlowUv;' : ''}
        #ifdef USE_MAP
          vMapUv = twWaterFlowUv;
        #endif
        `
      );
      if (!enhanced) return;
      // --- enhanced water surface: animated ripple normal -> refractive lensing,
      //     planar reflection, Blinn-Phong sun glint and foam, masked to upward-facing faces ---
      shader.uniforms.uWaterTime = waterShaderTimeUniform;
      shader.uniforms.twReflectionMap = reflectionUniforms ? reflectionUniforms.map : { value: null };
      shader.uniforms.twReflectionMatrix = reflectionUniforms ? reflectionUniforms.matrix : { value: new THREE.Matrix4() };
      shader.uniforms.twReflectionStrength = reflectionUniforms ? reflectionUniforms.strength : { value: 0 };
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        uniform float uWaterTime;
        uniform sampler2D twReflectionMap;
        uniform float twReflectionStrength;
        varying vec2 vTwWaterSurfaceUv;
        varying vec3 vTwWaterWorld;
        varying vec3 vTwWaterView;
        varying vec3 vTwWaterNrm;
        varying vec4 vTwReflectCoord;
        ${WATER_SHADER_NOISE_GLSL}
        `
      );
      // Inject before <fog_fragment> (not <dithering_fragment>) so the shimmer
      // gets fogged with distance instead of bypassing fog/tonemapping.
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <fog_fragment>',
        `
        {
          float twTop = smoothstep(0.45, 0.82, vTwWaterNrm.y);
          if (twTop > 0.001) {
            vec2 wp = vTwWaterWorld.xz;
            float t = uWaterTime;
            // Two scrolling noise fields -> a moving wave height h0. Everything
            // below is VIEW-INDEPENDENT (depends only on world pos + time) so it
            // reads clearly even from the default top-down-ish camera.
            vec2 f1 = wp * 0.70 + vec2(t * 0.11, t * 0.07);
            vec2 f2 = wp * 1.70 - vec2(t * 0.08, t * 0.12);
            float h0 = twWaterNoise(f1) * 0.6 + twWaterNoise(f2) * 0.4;
            float e = 0.30;
            float hX = twWaterNoise(f1 + vec2(e, 0.0)) * 0.6 + twWaterNoise(f2 + vec2(e, 0.0)) * 0.4;
            float hZ = twWaterNoise(f1 + vec2(0.0, e)) * 0.6 + twWaterNoise(f2 + vec2(0.0, e)) * 0.4;
            vec3 rn = normalize(vec3(-(hX - h0) * 2.4, 1.0, -(hZ - h0) * 2.4));
            vec3 vdir = normalize(vTwWaterView);
            vec3 sdir = normalize(vec3(0.40, 0.72, 0.55));
            vec3 hvec = normalize(sdir + vdir);
            float glint = pow(max(dot(rn, hvec), 0.0), 60.0);
            vec3 refr = refract(-vdir, rn, 0.7502);
            float refrLean = clamp(length(refr.xz) * 1.35 + (1.0 - rn.y) * 3.4, 0.0, 1.0);
            vec2 refrBend = refr.xz * (0.070 + refrLean * 0.120);
            #ifdef USE_MAP
              vec2 refrUv = vMapUv + refrBend + vec2(t * 0.020, -t * 0.015);
              vec3 refrTex = vec3(
                texture2D(map, refrUv + refrBend * 0.80 + vec2(0.006, -0.003)).r,
                texture2D(map, refrUv + refrBend * 0.18).g,
                texture2D(map, refrUv - refrBend * 0.55 + vec2(-0.004, 0.004)).b
              );
              float refrLum = dot(refrTex, vec3(0.299, 0.587, 0.114));
            #else
              float refrLum = twWaterNoise(wp * 2.20 + refr.xz * 2.7 + vec2(t * 0.07, -t * 0.05));
            #endif
            float refrDepth = clamp(refrLum * 0.65 + h0 * 0.35, 0.0, 1.0);
            vec3 refrCol = mix(vec3(0.015, 0.25, 0.42), vec3(0.46, 0.96, 1.0), refrDepth);
            float refrMask = clamp(0.26 + refrLean * 0.30, 0.0, 0.58) * twTop;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, refrCol, refrMask);
            vec2 reflUv = vTwReflectCoord.xy / max(vTwReflectCoord.w, 0.0001);
            vec2 reflBend = refrBend * 0.46 + rn.xz * 0.018;
            vec2 reflSampleUv = clamp(reflUv + reflBend, vec2(0.001), vec2(0.999));
            float reflInside = step(0.001, reflUv.x) * step(0.001, reflUv.y) *
              step(reflUv.x, 0.999) * step(reflUv.y, 0.999);
            vec3 reflectedScene = texture2D(twReflectionMap, reflSampleUv).rgb;
            float fres = pow(1.0 - max(dot(rn, vdir), 0.0), 2.0);
            float reflectedLuma = dot(reflectedScene, vec3(0.299, 0.587, 0.114));
            vec3 reflectedWaterScene = mix(reflectedScene, reflectedScene * vec3(0.72, 0.90, 1.08) + vec3(0.01, 0.03, 0.05), 0.18);
            reflectedWaterScene += vec3(0.16, 0.42, 0.62) * smoothstep(0.08, 0.34, reflectedLuma) * 0.04;
            float reflectMask = clamp(0.88 + fres * 0.32 + refrLean * 0.18, 0.0, 1.0) *
              twReflectionStrength * twTop * reflInside;
            gl_FragColor.rgb = mix(gl_FragColor.rgb, reflectedWaterScene, reflectMask);
            float refrCaustic = pow(max(1.0 - abs(twWaterNoise(wp * 4.40 + refr.xz * 5.2 + vec2(t * 0.20, -t * 0.14)) - 0.52) * 2.25, 0.0), 4.0);
            float refrCausticFine = pow(max(1.0 - abs(twWaterNoise(wp * 9.20 - refr.xz * 8.0 + vec2(-t * 0.24, t * 0.19)) - 0.50) * 2.15, 0.0), 6.0);
            float foam = smoothstep(0.62, 0.84, h0);
            float broadSheen = smoothstep(0.46, 0.88, h0);
            gl_FragColor.rgb *= mix(0.94, 1.08, broadSheen) * twTop + (1.0 - twTop);
            vec3 addCol = vec3(0.42, 0.92, 1.0) * refrCaustic * 0.12
                        + vec3(0.80, 1.0, 1.0) * refrCausticFine * 0.08
                        + vec3(1.0, 1.0, 0.98) * glint * 1.25
                        + vec3(0.50, 0.88, 1.0) * refrLean * 0.08
                        + vec3(0.95, 0.99, 1.0) * foam * 0.18;
            gl_FragColor.rgb += addCol * twTop;
          }
        }
        #include <fog_fragment>
        `
      );
    };
  }

  // Rebuild water materials after the enhanced-water Settings toggle changes:
  // drop cached flow clones and reset the base materials so they recompile with
  // the new program cache key. Callers follow up with rebuildTerrainRender().
  function refreshWaterShaderMaterials() {
    waterFlowMaterialCache.clear();
    const sW = (M.water.userData && M.water.userData.worldTextureScale) || 1;
    const sD = (M.waterDk.userData && M.waterDk.userData.worldTextureScale) || 1;
    applyFlowingWaterUVs(M.water, M.water.map || texRipples, sW);
    applyFlowingWaterUVs(M.waterDk, M.waterDk.map || texRipples, sD);
  }

  function applyTerrainWorldUVs(name, material, texture, textureScale = 1.0) {
    if (name === 'water' || name === 'waterDk') applyFlowingWaterUVs(material, texture, textureScale);
    else applyWorldUVs(material, texture, textureScale);
  }

  function tickWaterTextureFlow(dt) {
    if (!dt) return;
    waterShaderTimeUniform.value += dt;
    for (const state of waterTextureFlowStates.values()) {
      state.offset.x = (state.offset.x + state.direction.x * state.speed * dt) % 1;
      state.offset.y = (state.offset.y + state.direction.y * state.speed * dt) % 1;
    }
  }

  const WATER_FLOW_DIRECTIONS = new Set(['auto', 'n', 's', 'e', 'w']);
  const waterFlowMaterialCache = new Map();

  function normalizeWaterFlow(value) {
    const key = String(value || 'auto').trim().toLowerCase();
    return WATER_FLOW_DIRECTIONS.has(key) ? key : 'auto';
  }

  function waterFlowVectorForKey(key) {
    if (key === 'n') return { dx: 0, dz: -1 };
    if (key === 's') return { dx: 0, dz: 1 };
    if (key === 'e') return { dx: 1, dz: 0 };
    if (key === 'w') return { dx: -1, dz: 0 };
    return null;
  }

  function waterFlowAxisForCell(terrainN) {
    const ew = terrainN && (terrainN.e === 'water' || terrainN.w === 'water');
    const ns = terrainN && (terrainN.n === 'water' || terrainN.s === 'water');
    if (ew && !ns) return 'x';
    if (ns && !ew) return 'z';
    return ew ? 'x' : 'z';
  }

  function waterFlowBridgeSplit(axis, x, z) {
    let total = 0;
    let count = 0;
    for (let i = 0; i < GRID; i++) {
      const cell = axis === 'x' ? getWorldCell(i, z) : getWorldCell(x, i);
      if (cell && cell.terrain === 'water' && cell.kind === 'bridge') {
        total += i;
        count++;
      }
    }
    return count ? total / count : (GRID - 1) / 2;
  }

  function waterFlowVectorForCell(x, z, terrainN) {
    const cell = getWorldCell(x, z);
    const forced = waterFlowVectorForKey(normalizeWaterFlow(cell && cell.waterFlow));
    if (forced) return forced;
    const axis = waterFlowAxisForCell(terrainN);
    const split = waterFlowBridgeSplit(axis, x, z);
    // Each side of the bridge flows TOWARD the bridge (converging) instead of
    // away from it — gives the river a subtle "draws in under the bridge" look.
    if (axis === 'x') return { dx: x < split ? 1 : -1, dz: 0 };
    return { dx: 0, dz: z < split ? 1 : -1 };
  }

  function waterFlowMaterial(base, dx, dz) {
    if (!base) return base;
    const scale = base.userData && base.userData.worldTextureScale ? base.userData.worldTextureScale : 1;
    const map = base.map || texRipples;
    const color = base.color ? base.color.getHexString() : 'none';
    const key = WATER_SURFACE_SHADER_VARIANT + ':' + (base.uuid || base.id) + ':' +
      (map && (map.uuid || map.id)) + ':' + scale + ':' + color + ':' +
      Math.sign(dx || 0) + ',' + Math.sign(dz || 0);
    if (!waterFlowMaterialCache.has(key)) {
      const mat = base.clone();
      applyFlowingWaterUVs(mat, map, scale, waterTextureFlowState(dx, dz));
      waterFlowMaterialCache.set(key, mat);
    }
    return waterFlowMaterialCache.get(key);
  }

  const texCheckered = createPixelTexture('checkered', 16);
  const texNoise = createPixelTexture('noise', 16);
  const texBrick = createPixelTexture('brick', 32);
  const texShingles = createPixelTexture('shingles', 16);
  const texRipples = createPixelTexture('ripples', 16);
  const texLeaves = createPixelTexture('leaves', 16);
  const texWood = createPixelTexture('wood', 16);
  const texGrass = createPixelTexture('grass', 16);
  const texPlanks = createPixelTexture('planks', 16);
  const texStone = createPixelTexture('stone', 16);
  const texHay = createPixelTexture('hay', 16);
  const texDirt = createPixelTexture('dirt', 16);
  const texSand = createPixelTexture('sand', 16);
  const texRockFace = createPixelTexture('rock-face', 32);
  const texIslandSideBlocks = createPixelTexture('island-side-blocks', 128);
  const texPipeMetal = createPixelTexture('pipe-metal', 64);
  const texWaterFroth = createPixelTexture('water-froth', 64);
  const texPathPavers = createPixelTexture('path-pavers', 128);
  const texCastleBlock = createPixelTexture('castle-block', 64);
  const texBuildingBrick = createPixelTexture('brick-building', 64);
  const texRoofShingles = createPixelTexture('roof-shingles', 64);
  const texWindowLit = createPixelTexture('window-lit', 64);
  const texWindowUnlit = createPixelTexture('window-unlit', 64);
  const texGrassVoxel = createPixelTexture('grass-voxel', 64);
  const texGrassSide = createPixelTexture('grass-side', 64);
  const texSoilSide = createPixelTexture('soil-side', 64);
  const texFenceTimber = createPixelTexture('fence-timber', 64);
  const texCropStalk = createPixelTexture('crop-stalk', 64);
  const texCornCob = createPixelTexture('corn-cob', 64);
  const texSunflowerPetal = createPixelTexture('sunflower-petal', 64);
  const texSunflowerCenter = createPixelTexture('sunflower-center', 64);
  const texCottageGrass = createCottageTexture('grass', 128);
  const texCottageWood = createCottageTexture('wood', 128);
  const texCottageGlass = createCottageTexture('glass', 128);
  const texCottageStone = createCottageTexture('stone', 128);
  const texCottageDirt = createCottageTexture('dirt', 128);

  function createMaterialImageTexture(src) {
    const tex = new THREE.TextureLoader().load(src, () => {
      repaintAfterTextureLoad();
    });
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter || THREE.LinearFilter;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    twSetTextureSRGB(tex);
    return tex;
  }

  function createTerrainVariantImageTexture(src) {
    const tex = new THREE.TextureLoader().load(src, () => {
      repaintAfterTextureLoad();
    });
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    twSetTextureSRGB(tex);
    tuneWorldTextureFiltering(tex);
    return tex;
  }

  const texAtlasNatureWood = createMaterialImageTexture('textures/HJCliEibkAAmqIj.jpeg');
  const texAtlasTileSet = createMaterialImageTexture('textures/HJCliEjbEAA9Ah2.jpeg');
  const texAtlasRoofStrips = createMaterialImageTexture('textures/HJCliEqagAAE8e4.jpeg');
  const texAtlasReference = createMaterialImageTexture('textures/reference.jpeg');
  const texIslandUndersideVoxel = createMaterialImageTexture('textures/island-underside-voxel.png');
  const terrainSheetTextureNames = [
    'grass-plain-01',
    'grass-plain-02',
    'grass-mushrooms-01',
    'grass-flowers-01',
    'grass-mushrooms-02',
    'grass-flower-01',
    'dirt-blocks-01',
    'dirt-clean-01',
    'dirt-clean-02',
    'dirt-pebbles-01',
    'stone-blocks-01',
    'stone-broken-01',
    'stone-slabs-01',
    'stone-moss-01',
    'rock-cliff-01',
    'rock-cliff-02',
    'rock-cliff-moss-01',
    'rock-cliff-moss-02',
    'path-pavers-01',
    'path-pavers-02',
    'path-pavers-03',
    'path-pavers-04',
    'wood-planks-01',
    'wood-planks-02',
    'wood-rings-01',
    'wood-crate-01',
    'water-flat-01',
    'water-flat-02',
    'water-ripples-01',
    'water-deep-01',
  ];
  const terrainSheetTextureMap = {};
  for (const name of terrainSheetTextureNames) {
    terrainSheetTextureMap['terrain-sheet-' + name] = createTerrainVariantImageTexture('textures/terrain-variants/' + name + '.png');
  }
  const proceduralPixelTextures = {
    checkered: texCheckered,
    noise: texNoise,
    brick: texBrick,
    shingles: texShingles,
    ripples: texRipples,
    leaves: texLeaves,
    wood: texWood,
    grass: texGrass,
    planks: texPlanks,
    stone: texStone,
    hay: texHay,
    dirt: texDirt,
    sand: texSand,
    'rock-face': texRockFace,
    'island-side-blocks': texIslandSideBlocks,
    'pipe-metal': texPipeMetal,
    'water-froth': texWaterFroth,
    'path-pavers': texPathPavers,
    'castle-block': texCastleBlock,
    'brick-building': texBuildingBrick,
    'roof-shingles': texRoofShingles,
    'window-lit': texWindowLit,
    'window-unlit': texWindowUnlit,
    'grass-voxel': texGrassVoxel,
    'grass-side': texGrassSide,
    'soil-side': texSoilSide,
    'fence-timber': texFenceTimber,
    'crop-stalk': texCropStalk,
    'corn-cob': texCornCob,
    'sunflower-petal': texSunflowerPetal,
    'sunflower-center': texSunflowerCenter,
    'cottage-grass': texCottageGrass,
    'cottage-wood': texCottageWood,
    'cottage-glass': texCottageGlass,
    'cottage-stone': texCottageStone,
    'cottage-dirt': texCottageDirt,
  };

  const MATERIAL_TEXTURE_OPTIONS = [
    { key: 'default', label: 'Default' },
    { key: 'checkered', label: 'Checker' },
    { key: 'noise', label: 'Soft noise' },
    { key: 'brick', label: 'Brick' },
    { key: 'shingles', label: 'Shingles' },
    { key: 'planks', label: 'Planks' },
    { key: 'stone', label: 'Stone chips' },
    { key: 'leaves', label: 'Leaves' },
    { key: 'wood', label: 'Wood grain' },
    { key: 'grass', label: 'Grass blades' },
    { key: 'hay', label: 'Hay / straw' },
    { key: 'dirt', label: 'Dirt specks' },
    { key: 'sand', label: 'Sand grain' },
    { key: 'rock-face', label: 'Rock face' },
    { key: 'island-side-blocks', label: 'Large island side blocks' },
    { key: 'path-pavers', label: 'Chunky path pavers' },
    { key: 'castle-block', label: 'Stone masonry' },
    { key: 'brick-building', label: 'Red brick building' },
    { key: 'roof-shingles', label: 'Chunky roof shingles' },
    { key: 'window-lit', label: 'Lit mullion window' },
    { key: 'window-unlit', label: 'Unlit mullion window' },
    { key: 'grass-voxel', label: 'Voxel grass blades' },
    { key: 'grass-side', label: 'Grass side blocks' },
    { key: 'soil-side', label: 'Soil side blocks' },
    { key: 'fence-timber', label: 'Fence timber' },
    { key: 'crop-stalk', label: 'Crop stalks' },
    { key: 'corn-cob', label: 'Corn kernels' },
    { key: 'sunflower-petal', label: 'Sunflower petals' },
    { key: 'sunflower-center', label: 'Sunflower seeds' },
    { key: 'ripples', label: 'Water ripples' },
    { key: 'cottage-grass', label: 'Cottage grass' },
    { key: 'cottage-wood', label: 'Cottage wood' },
    { key: 'cottage-glass', label: 'Cottage glass' },
    { key: 'cottage-stone', label: 'Cottage stone' },
    { key: 'cottage-dirt', label: 'Cottage dirt' },
    { key: 'atlas-nature-wood', label: 'Texture folder: nature + wood' },
    { key: 'atlas-tiles', label: 'Texture folder: tile set' },
    { key: 'atlas-roofs', label: 'Texture folder: roof strips' },
    { key: 'atlas-reference', label: 'Texture folder: reference board' },
    { key: 'terrain-sheet-grass-plain-01', label: 'Sheet grass plain 1' },
    { key: 'terrain-sheet-grass-mushrooms-01', label: 'Sheet grass mushrooms' },
    { key: 'terrain-sheet-grass-flowers-01', label: 'Sheet grass flowers' },
    { key: 'terrain-sheet-dirt-blocks-01', label: 'Sheet mud blocks' },
    { key: 'terrain-sheet-dirt-pebbles-01', label: 'Sheet mud pebbles' },
    { key: 'terrain-sheet-stone-blocks-01', label: 'Sheet stone blocks' },
    { key: 'terrain-sheet-stone-moss-01', label: 'Sheet stone moss' },
    { key: 'terrain-sheet-path-pavers-01', label: 'Sheet path pavers 1' },
    { key: 'terrain-sheet-path-pavers-04', label: 'Sheet path pavers 4' },
    { key: 'terrain-sheet-water-flat-01', label: 'Sheet water flat' },
    { key: 'terrain-sheet-water-ripples-01', label: 'Sheet water ripples' },
    { key: 'terrain-sheet-wood-planks-01', label: 'Sheet wood planks' },
    { key: 'terrain-sheet-wood-rings-01', label: 'Sheet wood rings' },
  ];

  const ISLAND_SIDE_STRATA_TOP_Y = TOP_H;
  const ISLAND_SIDE_STRATA_TOP_OVERLAP = 0.015;
  const ISLAND_SIDE_STRATA_HEIGHT = TOP_H + DIRT_H + 0.035;
  const ISLAND_SIDE_STRATA_RENDER_TOP_Y = ISLAND_SIDE_STRATA_TOP_Y + ISLAND_SIDE_STRATA_TOP_OVERLAP;
  const ISLAND_SIDE_STRATA_RENDER_HEIGHT = ISLAND_SIDE_STRATA_HEIGHT + ISLAND_SIDE_STRATA_TOP_OVERLAP;

  function makeIslandSideStrataMaterial() {
    return new THREE.ShaderMaterial({
      name: 'island-side-strata-shader',
      side: THREE.FrontSide,
      extensions: { derivatives: true }, // fwidth() LOD anti-aliasing in the fragment shader
      uniforms: {
        uTopY: { value: ISLAND_SIDE_STRATA_RENDER_TOP_Y },
        uHeight: { value: ISLAND_SIDE_STRATA_RENDER_HEIGHT },
      },
      vertexShader: `
        varying vec3 vTwWorldPos;
        varying vec3 vTwWorldNormal;
        void main() {
          vec4 worldPos = vec4(position, 1.0);
          #ifdef USE_INSTANCING
            worldPos = instanceMatrix * worldPos;
          #endif
          worldPos = modelMatrix * worldPos;
          vec4 localNormal = vec4(normal, 0.0);
          #ifdef USE_INSTANCING
            localNormal = instanceMatrix * localNormal;
          #endif
          vTwWorldPos = worldPos.xyz;
          vTwWorldNormal = normalize((modelMatrix * localNormal).xyz);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform float uTopY;
        uniform float uHeight;
        varying vec3 vTwWorldPos;
        varying vec3 vTwWorldNormal;

        float twStrataHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        void main() {
          vec3 n = normalize(vTwWorldNormal);
          float coord = abs(n.x) > abs(n.z) ? vTwWorldPos.z : vTwWorldPos.x;
          float down = clamp(uTopY - vTwWorldPos.y, 0.0, uHeight);
          float v = clamp(down / max(uHeight, 0.0001), 0.0, 1.0);
          // Screen-space footprint of the two procedural axes (world units / pixel).
          // Every detail term is a hash sampled per integer cell at some frequency f;
          // once f*footprint nears ~1 the cells go sub-pixel and alias into swimming
          // diagonal stripes (the side walls, viewed nearly edge-on, are the worst
          // case). Fade each term to its mean before that so the band smooths with
          // distance/grazing instead of striping, while staying crisp up close.
          float dCoord = fwidth(coord);
          float dV = fwidth(v);
          float fadeSeed   = 1.0 - smoothstep(0.45, 1.0, 4.0  * dCoord);
          float fadeD2R    = 1.0 - smoothstep(0.45, 1.0, 2.1  * dCoord);
          float fadeCoarse = 1.0 - smoothstep(0.45, 1.0, max(6.2  * dCoord, 9.4  * dV));
          float fadeFine   = 1.0 - smoothstep(0.45, 1.0, max(18.0 * dCoord, 23.0 * dV));
          float fadeRoot   = 1.0 - smoothstep(0.45, 1.0, 13.0 * dCoord);
          float seed = mix(0.5, twStrataHash(vec2(floor(coord * 4.0), 19.0)), fadeSeed);
          float grassDrop = 0.18 + seed * 0.10;
          float dirtToRock = 0.62 + mix(0.5, twStrataHash(vec2(floor(coord * 2.1), 31.0)), fadeD2R) * 0.12;
          float grassW = max(0.055, dV * 1.5);
          float rockW = max(0.11, dV * 1.5);
          // The continuous green cap strip read as a thin floating panel around
          // the island edge in build/tilt-down views. Keep the variable so the
          // strata math stays stable, but disable the green band for now.
          float grassMask = 0.0 * (1.0 - smoothstep(grassDrop, grassDrop + grassW, v));
          float rockMask = smoothstep(dirtToRock, dirtToRock + rockW, v);
          float dirtMask = (1.0 - grassMask) * (1.0 - rockMask);
          float coarse = (twStrataHash(floor(vec2(coord * 6.2, v * 9.4))) - 0.5) * fadeCoarse;
          float fine = (twStrataHash(floor(vec2(coord * 18.0 + v * 1.7, v * 23.0))) - 0.5) * fadeFine;
          vec3 grass = vec3(0.40, 0.62, 0.17) + vec3(coarse * 0.08, coarse * 0.10, fine * 0.035);
          vec3 dirt = vec3(0.43, 0.27, 0.12) + vec3(coarse * 0.07, fine * 0.035, fine * 0.015);
          vec3 rock = vec3(0.28, 0.29, 0.27) + vec3(coarse * 0.10 + fine * 0.04);
          float root = step(0.78, twStrataHash(vec2(floor(coord * 13.0), 7.0))) * smoothstep(0.12, 0.22, v) * (1.0 - smoothstep(0.54, 0.70, v)) * fadeRoot;
          vec3 col = grass * grassMask + dirt * dirtMask + rock * rockMask;
          col = mix(col, vec3(0.12, 0.07, 0.035), root * 0.45);
          col = max(col, vec3(0.14, 0.13, 0.11));
          float light = 0.82 + 0.18 * clamp(dot(normalize(vec3(-0.45, 0.35, 0.75)), n) * 0.5 + 0.5, 0.0, 1.0);
          gl_FragColor = vec4(col * light, 1.0);
        }
      `,
    });
  }

  const materialTextureMap = Object.assign({}, proceduralPixelTextures, {
    'atlas-nature-wood': texAtlasNatureWood,
    'atlas-tiles': texAtlasTileSet,
    'atlas-roofs': texAtlasRoofStrips,
    'atlas-reference': texAtlasReference,
  }, terrainSheetTextureMap);

  function normalizeMaterialTextureKey(value) {
    const key = String(value || 'default').toLowerCase();
    if (key === 'none' || key === 'default') return 'default';
    return materialTextureMap[key] ? key : 'default';
  }

  function normalizeMaterialTextureScale(value) {
    const n = parseFloat(value);
    if (!Number.isFinite(n)) return 1;
    return Math.max(0.5, Math.min(4, n));
  }

  function materialTextureForKey(key) {
    return materialTextureMap[normalizeMaterialTextureKey(key)] || null;
  }

  function terrainSheetTexture(name) {
    return terrainSheetTextureMap['terrain-sheet-' + name] || null;
  }

  function applySheetWorldUVs(material, sheetName, textureScale, opts = {}) {
    const tex = terrainSheetTexture(sheetName);
    if (!tex) return false;
    applyWorldUVs(material, tex, textureScale, opts);
    return true;
  }

  function applySheetTerrainUVs(materialName, material, sheetName, textureScale) {
    const tex = terrainSheetTexture(sheetName);
    if (!tex) return false;
    applyTerrainWorldUVs(materialName, material, tex, textureScale);
    return true;
  }

  const TERRAIN_SHEET_VARIANT_SETS = {
    grass: [
      'terrain-sheet-grass-plain-01',
      'terrain-sheet-grass-plain-02',
      'terrain-sheet-grass-mushrooms-01',
      'terrain-sheet-grass-flowers-01',
      'terrain-sheet-grass-mushrooms-02',
      'terrain-sheet-grass-flower-01',
    ],
    dirt: [
      'terrain-sheet-dirt-blocks-01',
      'terrain-sheet-dirt-clean-01',
      'terrain-sheet-dirt-clean-02',
      'terrain-sheet-dirt-pebbles-01',
    ],
    stone: [
      'terrain-sheet-stone-blocks-01',
      'terrain-sheet-stone-broken-01',
      'terrain-sheet-stone-slabs-01',
      'terrain-sheet-stone-moss-01',
    ],
    rock: [
      'terrain-sheet-rock-cliff-01',
      'terrain-sheet-rock-cliff-02',
      'terrain-sheet-rock-cliff-moss-01',
      'terrain-sheet-rock-cliff-moss-02',
    ],
    path: [
      'terrain-sheet-path-pavers-01',
      'terrain-sheet-path-pavers-02',
      'terrain-sheet-path-pavers-03',
      'terrain-sheet-path-pavers-04',
    ],
    water: [
      'terrain-sheet-water-flat-01',
      'terrain-sheet-water-flat-02',
      'terrain-sheet-water-ripples-01',
      'terrain-sheet-water-deep-01',
    ],
    wood: [
      'terrain-sheet-wood-planks-01',
      'terrain-sheet-wood-planks-02',
      'terrain-sheet-wood-rings-01',
      'terrain-sheet-wood-crate-01',
    ],
  };
  const TERRAIN_SHEET_VARIANT_SCALES = {
    grass: 4.0,
    dirt: 4.0,
    stone: 2.0,
    rock: 2.8,
    path: 2.0,
    water: 4.0,
    wood: 2.0,
  };
  // Only hard-surface terrain gets deterministic per-cell sheet variants.
  // Grass/dirt stay on one material so fields do not turn into patchwork.
  const TERRAIN_SHEET_AUTO_MIX_TERRAINS = new Set(['path', 'stone', 'water']);
  const terrainSheetVariantMaterialCache = new Map();

  function terrainSheetVariantsAllowed(terrain) {
    if (!TERRAIN_SHEET_AUTO_MIX_TERRAINS.has(terrain)) return false;
    if (terrain === 'grass' && typeof renderTexturedGrass !== 'undefined' && !renderTexturedGrass) return false;
    const adjustment = (typeof renderTerrainMaterialAdjustments !== 'undefined' && renderTerrainMaterialAdjustments)
      ? renderTerrainMaterialAdjustments[terrain]
      : null;
    return normalizeMaterialTextureKey(adjustment && adjustment.texture) === 'default';
  }

  function terrainSheetVariantTextureKey(terrain, x = 0, z = 0, salt = 0) {
    const set = TERRAIN_SHEET_VARIANT_SETS[terrain];
    if (!set || !set.length || !terrainSheetVariantsAllowed(terrain)) return null;
    const n = typeof cellRand === 'function'
      ? cellRand(x, z, 3300 + salt)
      : Math.abs(Math.sin((x + 1) * 91.7 + (z + 1) * 53.3 + salt * 11.1));
    return set[Math.min(set.length - 1, Math.floor((n % 1) * set.length))];
  }

  function terrainSheetVariantMaterial(base, terrain, materialName, x = 0, z = 0, salt = 0) {
    const textureKey = terrainSheetVariantTextureKey(terrain, x, z, salt);
    const tex = textureKey ? materialTextureForKey(textureKey) : null;
    if (!base || !base.clone || !tex) return base;
    const scale = TERRAIN_SHEET_VARIANT_SCALES[terrain] || 1;
    const color = base.color ? base.color.getHexString() : 'none';
    const programState = materialName === 'water' || materialName === 'waterDk'
      ? (renderEnhancedWater ? 'water-fx' : 'water-plain')
      : 'plain';
    const key = [
      base.uuid || base.id || 'mat',
      terrain,
      materialName || '',
      textureKey,
      scale.toFixed(3),
      color,
      programState,
    ].join(':');
    if (!terrainSheetVariantMaterialCache.has(key)) {
      const mat = base.clone();
      if (base.onBeforeCompile) mat.onBeforeCompile = base.onBeforeCompile;
      if (typeof base.customProgramCacheKey === 'function') mat.customProgramCacheKey = base.customProgramCacheKey;
      if (base.extensions) mat.extensions = base.extensions;
      mat.userData = Object.assign({}, base.userData || {}, mat.userData || {}, {
        terrainSheetVariant: textureKey,
      });
      applyTerrainWorldUVs(materialName || terrain, mat, tex, scale);
      terrainSheetVariantMaterialCache.set(key, mat);
    }
    return terrainSheetVariantMaterialCache.get(key);
  }

  M.grass.color.set(0x57842b);
  M.grassEdge.color.set(0x46701f);
  M.grassHi.color.set(0x6a9632);
  M.door.color.set(0x7b4b2a);
  M.woodTrim.color.set(0x5c361d);
  M.bridgeWood.color.set(0x7b4b2a);
  M.bridgeWoodD.color.set(0x5c361d);
  M.fence.color.set(0x7b4b2a);
  M.trunk.color.set(0x7b4b2a);

  const initialGrassTex = texCottageGrass;
  if (!applySheetWorldUVs(M.grass, 'grass-plain-01', 4.0)) applyWorldUVs(M.grass, initialGrassTex, 1.0);
  if (!applySheetWorldUVs(M.grassEdge, 'grass-plain-02', 4.0)) applyWorldUVs(M.grassEdge, initialGrassTex, 1.0);
  if (!applySheetWorldUVs(M.grassHi, 'grass-plain-01', 4.0)) applyWorldUVs(M.grassHi, initialGrassTex, 1.0);
  M.boardSide.color.set(0xffffff);
  if (!applySheetWorldUVs(M.boardSide, 'dirt-blocks-01', 3.6, { voxelSeams: true })) {
    applyWorldUVs(M.boardSide, texSoilSide, 0.22, { voxelSeams: true });
  }
  M.boardSideEdge = makeIslandSideStrataMaterial();

  M.path.color.set(0xf2d29c);
  M.pathTrim.color.set(0xd9b780);
  M.pathScuff.color.set(0xc9aa70);
  if (!applySheetTerrainUVs('path', M.path, 'path-pavers-01', 2.0)) applyWorldUVs(M.path, texPathPavers, 0.22);
  if (!applySheetTerrainUVs('pathTrim', M.pathTrim, 'path-pavers-02', 2.0)) applyWorldUVs(M.pathTrim, texPathPavers, 0.22);
  if (!applySheetTerrainUVs('pathScuff', M.pathScuff, 'path-pavers-03', 2.0)) applyWorldUVs(M.pathScuff, texPathPavers, 0.22);

  M.dirt.color.set(0xffffff);
  M.dirtRich.color.set(0xffffff);
  if (!applySheetWorldUVs(M.dirt, 'dirt-clean-01', 4.0)) applyWorldUVs(M.dirt, texSoilSide, 0.22);
  if (!applySheetWorldUVs(M.dirtRich, 'dirt-blocks-01', 4.0)) applyWorldUVs(M.dirtRich, texSoilSide, 0.20);

  if (!applySheetTerrainUVs('water', M.water, 'water-flat-01', 4.0)) applyFlowingWaterUVs(M.water, texRipples, 1.0);
  if (!applySheetTerrainUVs('waterDk', M.waterDk, 'water-deep-01', 4.0)) applyFlowingWaterUVs(M.waterDk, texRipples, 1.0);

  M.wallCream.color.set(0xffffff);
  M.wallTrim.color.set(0xf4f3ee);
  if (!applySheetWorldUVs(M.wallCream, 'stone-blocks-01', 2.2)) applyWorldUVs(M.wallCream, texCastleBlock, 0.86);
  if (!applySheetWorldUVs(M.wallTrim, 'stone-slabs-01', 2.2)) applyWorldUVs(M.wallTrim, texCastleBlock, 0.86);
  applyWorldUVs(M.roofBlue, texRoofShingles, 0.34);
  applyWorldUVs(M.roofBlueD, texRoofShingles, 0.34);
  M.islandUnder.color.set(0xffffff);
  M.islandUnderD.color.set(0xffffff);
  applyWorldUVs(M.islandUnder, texIslandUndersideVoxel, 0.58, { voxelSeams: true });
  applyWorldUVs(M.islandUnderD, texIslandUndersideVoxel, 0.58, { voxelSeams: true });
  M.utilityPipe.color.set(0x55616a);
  M.utilityPipeD.color.set(0x2f373e);
  M.utilityClamp.color.set(0x66717a);
  M.utilityCable.color.set(0x10141a);
  M.utilityCableB.color.set(0x16263a);
  applyWorldUVs(M.utilityPipe, texPipeMetal, 1.8);
  applyWorldUVs(M.utilityPipeD, texPipeMetal, 1.8);
  applyWorldUVs(M.utilityClamp, texPipeMetal, 2.6);
  M.waterFoam.color.set(0xffffff);
  applyWorldUVs(M.waterFoam, texWaterFroth, 2.4);
  M.waterfallFoamPuff.map = texWaterFroth;
  M.waterfallFoamPuff.color.set(0xffffff);
  M.waterfallFoamPuff.needsUpdate = true;

  M.castleStone.color.set(0xffffff);
  M.castleStoneD.color.set(0xe8e7df);
  if (!applySheetWorldUVs(M.castleStone, 'stone-blocks-01', 2.4)) applyWorldUVs(M.castleStone, texCastleBlock, 0.86);
  if (!applySheetWorldUVs(M.castleStoneD, 'stone-slabs-01', 2.4)) applyWorldUVs(M.castleStoneD, texCastleBlock, 0.86);
  M.stone.color.set(0x8b8d88);
  M.stoneDk.color.set(0x5f6668);
  if (!applySheetTerrainUVs('stone', M.stone, 'stone-blocks-01', 2.0)) applyWorldUVs(M.stone, texCastleBlock, 0.86);
  if (!applySheetTerrainUVs('stoneDk', M.stoneDk, 'stone-broken-01', 2.0)) applyWorldUVs(M.stoneDk, texCastleBlock, 0.86);
  M.stoneSide = M.stone.clone();
  M.stoneSide.color.set(0x8c8980);
  if (!applySheetTerrainUVs('stoneSide', M.stoneSide, 'stone-slabs-01', 2.2)) applyWorldUVs(M.stoneSide, texCastleBlock, 0.86, { voxelSeams: true });
  if (!applySheetWorldUVs(M.rock, 'rock-cliff-01', 2.8)) applyWorldUVs(M.rock, texRockFace, 3.8);
  if (!applySheetWorldUVs(M.rockDk, 'rock-cliff-02', 2.8)) applyWorldUVs(M.rockDk, texRockFace, 3.8);
  if (!applySheetWorldUVs(M.rockHi, 'rock-cliff-moss-01', 2.8)) applyWorldUVs(M.rockHi, texRockFace, 3.8);

  M.manorBrick.color.set(0xffffff);
  M.manorBrickD.color.set(0xd0a096);
  M.manorTrim.color.set(0xf4f3ee);
  applyWorldUVs(M.manorBrick, texBuildingBrick, 2.0);
  applyWorldUVs(M.manorBrickD, texBuildingBrick, 2.0);
  applyWorldUVs(M.manorTrim, texCastleBlock, 0.86);
  applyWorldUVs(M.manorRoof, texRoofShingles, 0.34);
  applyWorldUVs(M.manorRoofD, texRoofShingles, 0.34);

  applyWorldUVs(M.towerRoof, texRoofShingles, 0.34);
  applyWorldUVs(M.towerRoofD, texRoofShingles, 0.34);
  if (M.skyRoof) applyWorldUVs(M.skyRoof, texRoofShingles, 0.34);

  applyWorldUVs(M.leaves, texLeaves, 4.0);
  applyWorldUVs(M.leavesDk, texLeaves, 4.0);
  if (!applySheetWorldUVs(M.trunk, 'wood-rings-01', 2.4)) applyWorldUVs(M.trunk, texCottageWood, 3.0);
  if (!applySheetWorldUVs(M.bridgeWood, 'wood-planks-01', 3.0)) applyWorldUVs(M.bridgeWood, texCottageWood, 3.0);
  if (!applySheetWorldUVs(M.bridgeWoodD, 'wood-planks-02', 3.0)) applyWorldUVs(M.bridgeWoodD, texCottageWood, 3.0);
  M.fence.color.set(0xffffff);
  M.fenceGarden.color.set(0xffffff);
  M.fenceGardenD.color.set(0xe0bd91);
  if (!applySheetWorldUVs(M.fence, 'wood-planks-01', 2.6)) applyWorldUVs(M.fence, texFenceTimber, 1.4);
  if (!applySheetWorldUVs(M.fenceGarden, 'wood-planks-01', 2.6)) applyWorldUVs(M.fenceGarden, texFenceTimber, 1.4);
  if (!applySheetWorldUVs(M.fenceGardenD, 'wood-planks-02', 2.6)) applyWorldUVs(M.fenceGardenD, texFenceTimber, 1.4);
  if (!applySheetWorldUVs(M.door, 'wood-planks-02', 3.0)) applyWorldUVs(M.door, texCottageWood, 3.0);
  if (!applySheetWorldUVs(M.woodTrim, 'wood-planks-01', 3.0)) applyWorldUVs(M.woodTrim, texCottageWood, 3.0);
  applyWorldUVs(M.sand, texSand, 1.8);
  applyWorldUVs(M.sandDk, texSand, 1.8);
  M.towerStone.color.set(0xffffff);
  M.towerStoneD.color.set(0xe8e7df);
  if (!applySheetWorldUVs(M.towerStone, 'stone-blocks-01', 2.6)) applyWorldUVs(M.towerStone, texCastleBlock, 0.86);
  if (!applySheetWorldUVs(M.towerStoneD, 'stone-slabs-01', 2.6)) applyWorldUVs(M.towerStoneD, texCastleBlock, 0.86);
  M.chimney.color.set(0xffffff);
  M.step.color.set(0xf4f3ee);
  if (!applySheetWorldUVs(M.chimney, 'stone-blocks-01', 2.4)) applyWorldUVs(M.chimney, texCastleBlock, 1.0);
  if (!applySheetWorldUVs(M.step, 'stone-slabs-01', 2.2)) applyWorldUVs(M.step, texCastleBlock, 0.86);
  M.windowB.map = texWindowUnlit;
  M.windowB.color.set(0xffffff);
  M.windowB.emissive.set(0x07101a);
  M.windowB.emissiveIntensity = 0.06;
  M.windowB.needsUpdate = true;
  M.windowNight.map = texWindowUnlit;
  M.windowNight.color.set(0xffffff);
  M.windowNight.emissive.set(0x07101a);
  M.windowNight.emissiveIntensity = 0.08;
  M.windowNight.needsUpdate = true;
  M.windowLit.map = texWindowLit;
  M.windowLit.color.set(0xffffff);
  M.windowLit.emissive.set(0xffb74a);
  M.windowLit.emissiveIntensity = 0.86;
  M.windowLit.needsUpdate = true;
  M.castleSlit.map = texWindowUnlit;
  M.castleSlit.color.set(0xffffff);
  M.castleSlit.emissive.set(0x080d14);
  M.castleSlit.emissiveIntensity = 0.06;
  M.castleSlit.needsUpdate = true;
  M.manorWindow.map = texWindowUnlit;
  M.manorWindow.color.set(0xffffff);
  M.manorWindow.emissive.set(0x07101a);
  M.manorWindow.emissiveIntensity = 0.06;
  M.manorWindow.needsUpdate = true;
  M.skyGlass.map = texCottageGlass;
  M.skyGlass.color.set(0xffffff);
  M.skyGlass.needsUpdate = true;
  M.cornStalk.color.set(0xffffff);
  M.cornCob.color.set(0xffffff);
  M.cornLeaf.color.set(0xffffff);
  M.cropLeaf.color.set(0xffffff);
  M.cropStem.color.set(0xffffff);
  M.wheatStalk.color.set(0xffffff);
  M.wheatHead.color.set(0xffffff);
  M.sunflowerStalk.color.set(0xffffff);
  M.sunflowerPetal.color.set(0xffffff);
  M.sunflowerCenter.color.set(0xffffff);
  applyWorldUVs(M.cropLeaf, texCropStalk, 2.2);
  applyWorldUVs(M.cropStem, texCropStalk, 2.2);
  applyWorldUVs(M.cornStalk, texCropStalk, 2.2);
  applyWorldUVs(M.cornLeaf, texCropStalk, 2.2);
  applyWorldUVs(M.cornCob, texCornCob, 3.2);
  applyWorldUVs(M.wheatStalk, texCropStalk, 2.2);
  applyWorldUVs(M.wheatHead, texHay, 2.8);
  applyWorldUVs(M.sunflowerStalk, texCropStalk, 2.2);
  applyWorldUVs(M.sunflowerPetal, texSunflowerPetal, 2.0);
  applyWorldUVs(M.sunflowerCenter, texSunflowerCenter, 3.2);

  const customMaterialCache = new Map();
  // Soft-cap to bound steady-state growth over long (e.g. multiplayer) sessions
  // where many distinct color/texture/surface variants get cloned. Cap is well
  // above realistic peak (~hundreds), so evicted entries rarely need re-cloning.
  const CUSTOM_MATERIAL_CACHE_CAP = 1024;
  function cacheCustomMaterial(key, mat) {
    if (customMaterialCache.size >= CUSTOM_MATERIAL_CACHE_CAP) {
      const oldest = customMaterialCache.keys().next().value;
      if (oldest !== undefined) customMaterialCache.delete(oldest);
    }
    customMaterialCache.set(key, mat);
  }
  function normalizeHexColor(value) {
    if (typeof value !== 'string') return null;
    const s = value.trim();
    if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
    if (/^[0-9a-f]{6}$/i.test(s)) return ('#' + s).toLowerCase();
    return null;
  }
  function shadeHexColor(hex, amount) {
    const clean = normalizeHexColor(hex);
    if (!clean) return null;
    const n = parseInt(clean.slice(1), 16);
    const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amount));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amount));
    const b = Math.max(0, Math.min(255, (n & 255) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }
  function normalizeProceduralTextureKind(kind) {
    const key = String(kind || '').toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (!key) return null;
    if (key === 'leaf' || key === 'leaves' || key === 'foliage') return 'leaves';
    if (key === 'shingle' || key === 'shingles' || key === 'roof' || key === 'roofing') return 'roof-shingles';
    if (key === 'plank' || key === 'planks' || key === 'board' || key === 'boards') return 'planks';
    if (key === 'masonry' || key === 'castle' || key === 'tower' || key === 'blocks') return 'castle-block';
    if (key === 'stone' || key === 'rock') return 'stone';
    if (key === 'wood' || key === 'trunk' || key === 'timber') return 'wood';
    if (key === 'hay' || key === 'straw' || key === 'wheat') return 'hay';
    if (key === 'dirt' || key === 'soil' || key === 'mud') return 'soil-side';
    if (key === 'sand' || key === 'beach' || key === 'desert') return 'sand';
    if (proceduralPixelTextures[key]) return key;
    return null;
  }
  function proceduralTextureKindForMaterialName(name) {
    const key = String(name || '').toLowerCase();
    if (!key) return null;
    if (/roof|shingle/.test(key)) return 'roof-shingles';
    if (/plank|board|crate|bridge/.test(key)) return 'planks';
    if (/wood|trunk|fence|post|rail|door/.test(key)) return 'wood';
    if (/castle|tower|masonry|block|column|chimney/.test(key)) return 'castle-block';
    if (/stone|rock|slate|grey|gray/.test(key)) return 'stone';
    if (/leaf|leaves|foliage|crop|green|bush|grass|blossom/.test(key)) return 'leaves';
    if (/hay|straw|wheat|yellow/.test(key)) return 'hay';
    if (/path|paver|paving/.test(key)) return 'path-pavers';
    if (/dirt|soil|mud/.test(key)) return 'soil-side';
    if (/sand|beach|desert/.test(key)) return 'sand';
    return null;
  }
  function inferProceduralTextureKind(hex, hint) {
    const named = normalizeProceduralTextureKind(hint) || proceduralTextureKindForMaterialName(hint);
    if (named) return named;
    const clean = normalizeHexColor(hex);
    if (!clean) return 'noise';
    const n = parseInt(clean.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max > 0 ? (max - min) / max : 0;
    const val = max / 255;
    let h = 0;
    if (max !== min) {
      if (max === r) h = 60 * (((g - b) / (max - min)) % 6);
      else if (max === g) h = 60 * ((b - r) / (max - min) + 2);
      else h = 60 * ((r - g) / (max - min) + 4);
      if (h < 0) h += 360;
    }
    if (sat < 0.14 && val < 0.86) return 'castle-block';
    if (h >= 15 && h <= 45 && val < 0.74 && sat > 0.20) return 'wood';
    if (h >= 38 && h <= 64 && val > 0.52 && sat > 0.32) return 'hay';
    if (h >= 65 && h <= 165 && sat > 0.18) return 'leaves';
    if (h >= 8 && h <= 38 && val < 0.56) return 'soil-side';
    if (h >= 35 && h <= 58 && val >= 0.56 && sat > 0.14) return 'sand';
    return 'noise';
  }
  function proceduralTextureScaleForKind(kind) {
    if (kind === 'roof-shingles') return 0.35;
    if (kind === 'shingles' || kind === 'planks' || kind === 'wood') return 3.0;
    if (kind === 'path-pavers') return 0.2;
    if (kind === 'castle-block') return 0.86;
    if (kind === 'grass-voxel') return 0.2;
    if (kind === 'grass-side') return 0.18;
    if (kind === 'soil-side') return 0.25;
    if (kind === 'fence-timber') return 1.0;
    if (kind === 'brick' || kind === 'stone' || kind === 'leaves') return 4.0;
    if (kind === 'dirt' || kind === 'hay' || kind === 'sand') return 2.0;
    return 1.6;
  }

  const TERRAIN_COLOR_KEYS = ['grass', 'path', 'dirt', 'water', 'stone', 'sand', 'snow', 'lava'];
  const TERRAIN_COLOR_MATERIALS = {
    grass: ['grass', 'grassEdge', 'grassHi'],
    path: ['path', 'pathTrim', 'pathScuff'],
    dirt: ['dirt', 'dirtRich'],
    water: ['water', 'waterDk'],
    stone: ['stone', 'stoneDk', 'stoneSide'],
    sand: ['sand', 'sandDk'],
    snow: ['snow', 'snowDk'],
    lava: ['lava', 'lavaCrust'],
  };
  const terrainMaterialBaseColors = new Map();
  const terrainMaterialBaseMaps = new Map();
  const terrainMaterialBaseScales = new Map();
  const PART_MATERIAL_GROUPS = {
    walls: { label: 'Walls', materials: ['wallCream', 'wallTrim', 'manorBrick', 'manorBrickD', 'towerStone', 'towerStoneD', 'castleStone', 'castleStoneD', 'skyBody'] },
    roofs: { label: 'Roofs', materials: ['roofBlue', 'roofBlueD', 'manorRoof', 'manorRoofD', 'towerRoof', 'towerRoofD', 'skyRoof'] },
    trim: { label: 'Trim / frames / columns', materials: ['woodTrim', 'manorTrim', 'skyFrame', 'step', 'chimney'] },
    windows: { label: 'Windows / glass', materials: ['windowB', 'windowLit', 'windowNight', 'manorWindow', 'skyGlass', 'castleSlit'] },
    wood: { label: 'Wood / doors / fences', materials: ['door', 'bridgeWood', 'bridgeWoodD', 'fence'] },
    foliage: { label: 'Trees / foliage', materials: ['leaves', 'leavesDk', 'rockMoss'] },
    crops: { label: 'Crops / flowers', materials: ['cropLeaf', 'cropStem', 'cornStalk', 'cornCob', 'cornLeaf', 'wheatStalk', 'wheatHead', 'pumpkin', 'pumpkinDk', 'pumpkinStem', 'carrotBody', 'sunflowerStalk', 'sunflowerPetal', 'sunflowerCenter'] },
    rocks: { label: 'Rocks / stone props', materials: ['rock', 'rockDk', 'rockHi', 'stone', 'stoneDk'] },
    metal: { label: 'Metal / accents', materials: ['fenceWire', 'fenceSteel', 'knob', 'flagRed'] },
  };
  const partMaterialBaseColors = new Map();
  const partMaterialBaseMaps = new Map();
  const partMaterialBaseScales = new Map();

  const SURFACE_TEXTURE_DEFAULTS = {
    grass: {
      texture: 'terrain-sheet-grass-plain-01',
      fallbackTexture: 'checkered',
      scale: 4.0,
      materials: ['grass', 'grassEdge', 'grassHi'],
      materialTextures: {
        grassEdge: 'terrain-sheet-grass-plain-02',
      },
    },
    dirt: {
      texture: 'terrain-sheet-dirt-blocks-01',
      scale: 4.0,
      materials: ['dirt', 'dirtRich'],
      materialTextures: {
        dirt: 'terrain-sheet-dirt-clean-01',
      },
    },
    sand: { texture: 'sand', scale: 1.8, materials: ['sand', 'sandDk'] },
    stone: {
      texture: 'terrain-sheet-stone-blocks-01',
      scale: 2.0,
      materials: ['stone', 'stoneDk'],
      materialTextures: {
        stoneDk: 'terrain-sheet-stone-broken-01',
      },
    },
  };
  const SURFACE_LINKED_MODEL_DEFAULT_TEXTURES = {
    stone: 'terrain-sheet-stone-blocks-01',
  };
  const SURFACE_LINKED_MODEL_MATERIAL_TEXTURES = {
    stone: {
      rock: 'terrain-sheet-rock-cliff-01',
      rockDk: 'terrain-sheet-rock-cliff-02',
      rockHi: 'terrain-sheet-rock-cliff-moss-01',
      castleStone: 'terrain-sheet-stone-blocks-01',
      castleStoneD: 'terrain-sheet-stone-slabs-01',
      towerStone: 'terrain-sheet-stone-blocks-01',
      towerStoneD: 'terrain-sheet-stone-slabs-01',
      chimney: 'terrain-sheet-stone-blocks-01',
    },
  };
  const SURFACE_LINKED_MODEL_MATERIALS = {
    stone: ['rock', 'rockDk', 'rockHi', 'castleStone', 'castleStoneD', 'towerStone', 'towerStoneD', 'chimney'],
  };
  const SURFACE_LINKED_MODEL_SCALES = {
    stone: {
      rock: 2.8,
      rockDk: 2.8,
      rockHi: 2.8,
      castleStone: 2.4,
      castleStoneD: 2.4,
      towerStone: 2.6,
      towerStoneD: 2.6,
      chimney: 2.4,
    },
  };

  function surfaceDefaultTextureKey(surface) {
    const def = SURFACE_TEXTURE_DEFAULTS[surface];
    if (!def) return 'default';
    if (surface === 'grass' && !renderTexturedGrass) return def.fallbackTexture || 'checkered';
    return def.texture;
  }

  function applySurfaceTextureToMaterial(name, textureKey, scale, updateBaseMaps = false) {
    const mat = M[name];
    const tex = materialTextureForKey(textureKey);
    if (!mat || !tex) return;
    applyTerrainWorldUVs(name, mat, tex, scale);
    if (updateBaseMaps) {
      if (terrainMaterialBaseMaps.has(name)) terrainMaterialBaseMaps.set(name, mat.map || null);
      if (terrainMaterialBaseScales.has(name)) terrainMaterialBaseScales.set(name, scale);
      if (partMaterialBaseMaps.has(name)) partMaterialBaseMaps.set(name, mat.map || null);
      if (partMaterialBaseScales.has(name)) partMaterialBaseScales.set(name, scale);
    }
  }

  function applySurfaceTextureDefaults() {
    for (const [surface, def] of Object.entries(SURFACE_TEXTURE_DEFAULTS)) {
      const textureKey = surfaceDefaultTextureKey(surface);
      for (const name of def.materials) {
        const materialTexture = surface === 'grass' && !renderTexturedGrass
          ? textureKey
          : (def.materialTextures && def.materialTextures[name]) || textureKey;
        const materialScale = (def.materialScales && def.materialScales[name]) || def.scale;
        applySurfaceTextureToMaterial(name, materialTexture, materialScale, true);
      }
    }
  }

  function terrainSurfaceTextureKey(surface) {
    const adjustment = renderTerrainMaterialAdjustments && renderTerrainMaterialAdjustments[surface];
    const texture = normalizeMaterialTextureKey(adjustment && adjustment.texture);
    return texture === 'default' ? surfaceDefaultTextureKey(surface) : texture;
  }

  function terrainSurfaceTextureScale(surface) {
    const def = SURFACE_TEXTURE_DEFAULTS[surface];
    const adjustment = renderTerrainMaterialAdjustments && renderTerrainMaterialAdjustments[surface];
    return (def ? def.scale : 1) * normalizeMaterialTextureScale(adjustment && adjustment.scale);
  }

  function linkedSurfaceMaterialTextureScale(surface, materialName) {
    const def = SURFACE_TEXTURE_DEFAULTS[surface];
    const adjustment = renderTerrainMaterialAdjustments && renderTerrainMaterialAdjustments[surface];
    const linkedScales = SURFACE_LINKED_MODEL_SCALES[surface] || {};
    const baseScale = linkedScales[materialName] || (def ? def.scale : 1);
    return baseScale * normalizeMaterialTextureScale(adjustment && adjustment.scale);
  }

  function applyLinkedSurfaceMaterialTextures() {
    if (!renderSurfaceLinkedMaterials) return;
    for (const [surface, names] of Object.entries(SURFACE_LINKED_MODEL_MATERIALS)) {
      const def = SURFACE_TEXTURE_DEFAULTS[surface];
      if (!def) continue;
      const adjustedTexture = normalizeMaterialTextureKey(renderTerrainMaterialAdjustments && renderTerrainMaterialAdjustments[surface] && renderTerrainMaterialAdjustments[surface].texture);
      const materialTextures = SURFACE_LINKED_MODEL_MATERIAL_TEXTURES[surface] || {};
      for (const name of names) {
        const textureKey = adjustedTexture === 'default'
          ? (materialTextures[name] || SURFACE_LINKED_MODEL_DEFAULT_TEXTURES[surface] || terrainSurfaceTextureKey(surface))
          : adjustedTexture;
        applySurfaceTextureToMaterial(name, textureKey, linkedSurfaceMaterialTextureScale(surface, name));
      }
    }
    if (typeof customMaterialCache !== 'undefined') customMaterialCache.clear();
    if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
  }

  applySurfaceTextureDefaults();

  function loadTerrainMaterialAdjustments() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(RENDER_LS.terrainColors) || '{}'); } catch (_) { raw = {}; }
    const out = {};
    for (const key of TERRAIN_COLOR_KEYS) {
      const src = raw && raw[key];
      if (!src || typeof src !== 'object') continue;
      const tint = normalizeHexColor(src.tint);
      const tone = Math.max(-0.5, Math.min(0.5, parseFloat(src.tone) || 0));
      const texture = normalizeMaterialTextureKey(src.texture);
      const scale = normalizeMaterialTextureScale(src.scale);
      if (tint || Math.abs(tone) > 0.001 || texture !== 'default' || Math.abs(scale - 1) > 0.001) out[key] = { tint, tone, texture, scale };
    }
    return out;
  }

  function loadPartMaterialAdjustments() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(RENDER_LS.materialParts) || '{}'); } catch (_) { raw = {}; }
    const out = {};
    for (const key of Object.keys(PART_MATERIAL_GROUPS)) {
      const src = raw && raw[key];
      if (!src || typeof src !== 'object') continue;
      const tint = normalizeHexColor(src.tint);
      const tone = Math.max(-0.5, Math.min(0.5, parseFloat(src.tone) || 0));
      const texture = normalizeMaterialTextureKey(src.texture);
      const scale = normalizeMaterialTextureScale(src.scale);
      if (tint || Math.abs(tone) > 0.001 || texture !== 'default' || Math.abs(scale - 1) > 0.001) out[key] = { tint, tone, texture, scale };
    }
    return out;
  }

  let renderTerrainColorTarget = localStorage.getItem(RENDER_LS.terrainColorTarget) || 'grass';
  if (!TERRAIN_COLOR_KEYS.includes(renderTerrainColorTarget)) renderTerrainColorTarget = 'grass';
  let renderTerrainMaterialAdjustments = loadTerrainMaterialAdjustments();
  let renderMaterialTarget = localStorage.getItem(RENDER_LS.materialTarget) || 'walls';
  if (!PART_MATERIAL_GROUPS[renderMaterialTarget]) renderMaterialTarget = 'walls';
  let renderPartMaterialAdjustments = loadPartMaterialAdjustments();
  let renderMaterialWear = storedNumber(RENDER_LS.materialWear, 1, 0, 1);

  function captureTerrainMaterialBaseColors() {
    terrainMaterialBaseColors.clear();
    terrainMaterialBaseMaps.clear();
    terrainMaterialBaseScales.clear();
    for (const names of Object.values(TERRAIN_COLOR_MATERIALS)) {
      for (const name of names) {
        const mat = M[name];
        if (!mat) continue;
        if (mat.color) terrainMaterialBaseColors.set(name, mat.color.getHex());
        terrainMaterialBaseMaps.set(name, mat.map || null);
        terrainMaterialBaseScales.set(name, mat.userData && mat.userData.worldTextureScale ? mat.userData.worldTextureScale : 1);
      }
    }
  }

  function restoreTerrainMaterialBaseColors() {
    for (const [name, hex] of terrainMaterialBaseColors.entries()) {
      const mat = M[name];
      if (mat && mat.color) mat.color.setHex(hex);
    }
    for (const [name, map] of terrainMaterialBaseMaps.entries()) {
      const mat = M[name];
      if (mat) {
        if (map) applyTerrainWorldUVs(name, mat, map, terrainMaterialBaseScales.get(name) || 1);
        else {
          mat.map = null;
          mat.needsUpdate = true;
        }
      }
    }
  }

  function terrainBaseColorForTarget(target) {
    const names = TERRAIN_COLOR_MATERIALS[target] || TERRAIN_COLOR_MATERIALS.grass;
    const matName = names && names[0];
    const mat = matName && M[matName];
    const baseHex = matName && terrainMaterialBaseColors.has(matName)
      ? terrainMaterialBaseColors.get(matName)
      : (mat && mat.color ? mat.color.getHex() : 0xffffff);
    return '#' + (baseHex & 0xffffff).toString(16).padStart(6, '0');
  }

  function applyToneToColor(color, tone) {
    const t = Math.max(-0.5, Math.min(0.5, tone || 0));
    if (t > 0) color.lerp(new THREE.Color(0xffffff), t);
    else if (t < 0) color.lerp(new THREE.Color(0x000000), -t);
    return color;
  }

  function applyWearToMaterialColor(color, name, wear) {
    const w = Math.max(0, Math.min(1, wear || 0));
    if (w <= 0.001 || !color) return color;
    const key = String(name || '').toLowerCase();
    let grime = new THREE.Color(0x5f5138);
    let amount = 0.10 + w * 0.16;
    let darken = -8 * w;
    if (/grass|leaf|leaves|foliage|crop|moss|pumpkin|carrot|sunflower|wheat|corn/.test(key)) {
      grime = new THREE.Color(0x71843b);
      amount = 0.07 + w * 0.13;
      darken = -5 * w;
    } else if (/water|glass|window/.test(key)) {
      grime = new THREE.Color(0x8fa0a1);
      amount = 0.04 + w * 0.08;
      darken = -3 * w;
    } else if (/roof|stone|rock|wall|trim|step|chimney|metal|steel|wire/.test(key)) {
      grime = new THREE.Color(0x6d6759);
      amount = 0.08 + w * 0.15;
      darken = -7 * w;
    } else if (/wood|door|fence|trunk|bridge|plank/.test(key)) {
      grime = new THREE.Color(0x4f3a24);
      amount = 0.09 + w * 0.16;
      darken = -9 * w;
    }
    color.lerp(grime, amount);
    return applyToneToColor(color, darken / 100);
  }

  function applyMaterialWearToMaterial(name, mat) {
    if (!mat || !mat.color || renderMaterialWear <= 0.001) return;
    applyWearToMaterialColor(mat.color, name, renderMaterialWear);
  }

  function applyTerrainMaterialAdjustments() {
    if (!terrainMaterialBaseColors.size) captureTerrainMaterialBaseColors();
    restoreTerrainMaterialBaseColors();
    for (const [terrain, adjustment] of Object.entries(renderTerrainMaterialAdjustments || {})) {
      const names = TERRAIN_COLOR_MATERIALS[terrain];
      if (!names) continue;
      const tint = normalizeHexColor(adjustment && adjustment.tint);
      const tone = Math.max(-0.5, Math.min(0.5, parseFloat(adjustment && adjustment.tone) || 0));
      const texture = normalizeMaterialTextureKey(adjustment && adjustment.texture);
      const scale = normalizeMaterialTextureScale(adjustment && adjustment.scale);
      for (const name of names) {
        const mat = M[name];
        if (!mat || !mat.color) continue;
        const c = new THREE.Color(mat.color.getHex());
        if (tint) c.lerp(new THREE.Color(tint), 0.55);
        applyToneToColor(c, tone);
        mat.color.copy(c);
        const baseScale = terrainMaterialBaseScales.get(name) || (mat.userData && mat.userData.worldTextureScale) || 1;
        const nextMap = texture !== 'default' ? materialTextureForKey(texture) : mat.map;
        if (nextMap && (texture !== 'default' || Math.abs(scale - 1) > 0.001)) {
          applyTerrainWorldUVs(name, mat, nextMap, baseScale * scale);
        }
      }
    }
    for (const names of Object.values(TERRAIN_COLOR_MATERIALS)) {
      for (const name of names) applyMaterialWearToMaterial(name, M[name]);
    }
    if (typeof customMaterialCache !== 'undefined') customMaterialCache.clear();
    if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
  }

  function capturePartMaterialBaseState() {
    partMaterialBaseColors.clear();
    partMaterialBaseMaps.clear();
    partMaterialBaseScales.clear();
    for (const group of Object.values(PART_MATERIAL_GROUPS)) {
      for (const name of group.materials) {
        const mat = M[name];
        if (!mat) continue;
        if (mat.color) partMaterialBaseColors.set(name, mat.color.getHex());
        partMaterialBaseMaps.set(name, mat.map || null);
        partMaterialBaseScales.set(name, mat.userData && mat.userData.worldTextureScale ? mat.userData.worldTextureScale : 1);
      }
    }
  }

  function restorePartMaterialBaseState() {
    for (const [name, hex] of partMaterialBaseColors.entries()) {
      const mat = M[name];
      if (mat && mat.color) mat.color.setHex(hex);
    }
    for (const [name, map] of partMaterialBaseMaps.entries()) {
      const mat = M[name];
      if (mat) {
        if (map) applyWorldUVs(mat, map, partMaterialBaseScales.get(name) || 1);
        else {
          mat.map = null;
          mat.needsUpdate = true;
        }
      }
    }
  }

  function partBaseColorForTarget(target) {
    const group = PART_MATERIAL_GROUPS[target] || PART_MATERIAL_GROUPS.walls;
    const matName = group.materials[0];
    const mat = M[matName];
    const baseHex = partMaterialBaseColors.has(matName)
      ? partMaterialBaseColors.get(matName)
      : (mat && mat.color ? mat.color.getHex() : 0xffffff);
    return '#' + (baseHex & 0xffffff).toString(16).padStart(6, '0');
  }

  function applyPartMaterialAdjustments() {
    if (!partMaterialBaseColors.size) capturePartMaterialBaseState();
    restorePartMaterialBaseState();
    for (const [groupKey, adjustment] of Object.entries(renderPartMaterialAdjustments || {})) {
      const group = PART_MATERIAL_GROUPS[groupKey];
      if (!group) continue;
      const tint = normalizeHexColor(adjustment && adjustment.tint);
      const tone = Math.max(-0.5, Math.min(0.5, parseFloat(adjustment && adjustment.tone) || 0));
      const texture = normalizeMaterialTextureKey(adjustment && adjustment.texture);
      const scale = normalizeMaterialTextureScale(adjustment && adjustment.scale);
      for (const name of group.materials) {
        const mat = M[name];
        if (!mat) continue;
        if (mat.color) {
          const c = new THREE.Color(mat.color.getHex());
          if (tint) c.lerp(new THREE.Color(tint), 0.55);
          applyToneToColor(c, tone);
          mat.color.copy(c);
        }
        const baseScale = partMaterialBaseScales.get(name) || (mat.userData && mat.userData.worldTextureScale) || 1;
        const nextMap = texture !== 'default' ? materialTextureForKey(texture) : mat.map;
        if (nextMap && (texture !== 'default' || Math.abs(scale - 1) > 0.001)) {
          applyWorldUVs(mat, nextMap, baseScale * scale);
        }
      }
    }
    for (const group of Object.values(PART_MATERIAL_GROUPS)) {
      for (const name of group.materials) applyMaterialWearToMaterial(name, M[name]);
    }
    if (typeof customMaterialCache !== 'undefined') customMaterialCache.clear();
    if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
  }

  function commitTerrainMaterialAdjustments() {
    applyTerrainMaterialAdjustments();
    applyPartMaterialAdjustments();
    applyLinkedSurfaceMaterialTextures();
    recaptureWeatherMaterialBase();
    applyWeatherMaterialTint();
  }

  function commitPartMaterialAdjustments() {
    applyTerrainMaterialAdjustments();
    applyPartMaterialAdjustments();
    applyLinkedSurfaceMaterialTextures();
    recaptureWeatherMaterialBase();
    applyWeatherMaterialTint();
  }

  function hasPersistedMaterialSettings() {
    return renderMaterialWear > 0.001
      || Object.keys(renderTerrainMaterialAdjustments || {}).length > 0
      || Object.keys(renderPartMaterialAdjustments || {}).length > 0;
  }

  function applyPersistedMaterialSettingsOnBoot() {
    if (!hasPersistedMaterialSettings()) return;
    commitPartMaterialAdjustments();
    if (typeof rebuildTerrainRender === 'function') rebuildTerrainRender();
    if (typeof rebuildObjectsRender === 'function') rebuildObjectsRender();
    if (typeof scheduleVoxelStampRefresh === 'function') scheduleVoxelStampRefresh();
    if (typeof renderSceneIfReady === 'function') renderSceneIfReady();
  }

  function customMaterial(base, hex) {
    const clean = normalizeHexColor(hex);
    if (!base || !base.clone || !clean) return base;
    const key = (base.uuid || base.id || 'mat') + ':' + clean + ':' + renderMaterialWear.toFixed(2);
    if (!customMaterialCache.has(key)) {
      const mat = base.clone();
      if (base.onBeforeCompile) mat.onBeforeCompile = base.onBeforeCompile;
      if (typeof base.customProgramCacheKey === 'function') mat.customProgramCacheKey = base.customProgramCacheKey;
      if (base.extensions) mat.extensions = base.extensions; // Lambert clone() drops .extensions; keep fwidth-derivatives flag
      if (mat.color) {
        mat.color.set(clean);
        applyWearToMaterialColor(mat.color, 'custom', renderMaterialWear);
      }
      cacheCustomMaterial(key, mat);
    }
    return customMaterialCache.get(key);
  }
  // Apply Lambert-native surface props (emissive glow, opacity, finish) from a
  // normalized appearance. Clones+caches off the same cache as customMaterial so
  // identical appearances share one material. MeshBasicMaterial has no .emissive,
  // so the guard simply skips glow there (opacity still applies).
  function surfaceMaterial(base, a) {
    if (!base || !base.clone || !a) return base;
    const hasEmissive = !!a.emissiveColor || (a.finish && a.finish !== 'matte');
    const hasOpacity = a.opacity !== undefined && a.opacity < 0.999;
    if (!hasEmissive && !hasOpacity) return base;
    const emHex = a.emissiveColor || (base.color ? '#' + base.color.getHexString() : '#000000');
    const finishBoost = a.finish === 'glow' ? 0.6 : a.finish === 'satin' ? 0.12 : 0;
    const emInt = Math.max(0, Math.min(2, (a.emissiveIntensity || 0) + finishBoost));
    const op = hasOpacity ? a.opacity : 1;
    const key = (base.uuid || base.id || 'mat') + ':surf:' + emHex + ':' + emInt.toFixed(3) + ':' + op.toFixed(3);
    if (!customMaterialCache.has(key)) {
      const mat = base.clone();
      if (base.onBeforeCompile) mat.onBeforeCompile = base.onBeforeCompile;
      if (typeof base.customProgramCacheKey === 'function') mat.customProgramCacheKey = base.customProgramCacheKey;
      if (base.extensions) mat.extensions = base.extensions; // keep fwidth-derivatives flag through clone
      if (mat.emissive && hasEmissive) { mat.emissive.set(emHex); mat.emissiveIntensity = emInt; }
      if (hasOpacity) { mat.transparent = true; mat.opacity = op; }
      cacheCustomMaterial(key, mat);
    }
    return customMaterialCache.get(key);
  }
  function customTextureMaterial(base, textureKey, textureScale) {
    const cleanKey = normalizeMaterialTextureKey(textureKey);
    const tex = materialTextureForKey(cleanKey);
    if (!base || !base.clone || !tex || cleanKey === 'default') return base;
    const scale = normalizeMaterialTextureScale(textureScale || 1);
    const baseScale = base.userData && base.userData.worldTextureScale
      ? base.userData.worldTextureScale
      : proceduralTextureScaleForKind(cleanKey);
    const key = (base.uuid || base.id || 'mat') + ':tex:' + cleanKey + ':' + baseScale.toFixed(3) + ':' + scale.toFixed(3);
    if (!customMaterialCache.has(key)) {
      const mat = base.clone();
      if (mat.color) applyWearToMaterialColor(mat.color, 'custom', renderMaterialWear);
      applyWorldUVs(mat, tex, baseScale * scale);
      cacheCustomMaterial(key, mat);
    }
    return customMaterialCache.get(key);
  }
  function normalizeAppearance(value) {
    if (!value || typeof value !== 'object') return null;
    const bodyColor = normalizeHexColor(value.bodyColor || value.body || value.wallColor || value.walls);
    const topColor = normalizeHexColor(value.topColor || value.top || value.roofColor || value.roof);
    const rawVoxelBuildId = value.voxelBuildId || value.voxelBuild || value.stampId || value.stamp;
    const voxelBuildId = (typeof rawVoxelBuildId === 'string' && /^[a-z0-9][a-z0-9_-]{0,63}$/i.test(rawVoxelBuildId))
      ? rawVoxelBuildId
      : null;
    const rawModelStampId = value.modelStampId || value.modelStamp || value.modelAssetId || value.assetId;
    const modelStampId = (typeof rawModelStampId === 'string' && /^[a-z0-9][a-z0-9_-]{0,95}$/i.test(rawModelStampId))
      ? rawModelStampId
      : null;
    const rawScale = Array.isArray(value.objectScale) || Array.isArray(value.scale)
      ? null
      : (value.objectScale !== undefined ? value.objectScale : value.scale);
    const objectScaleNumber = rawScale === null ? NaN : Number(rawScale);
    // Generous upper cap — let people build giants. This is the master clamp:
    // every appearance write flows through here, so the radial Size button and
    // the inspector slider both honor it. Keep in sync with the limits in
    // 21-object-transform-voxel-build.js and the inspector slider in 28.
    const objectScale = Number.isFinite(objectScaleNumber)
      ? Math.max(0.2, Math.min(24, objectScaleNumber))
      : null;
    const axisScale = raw => {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(0.15, Math.min(24, n)) : null;
    };
    const scaleX = axisScale(value.scaleX !== undefined ? value.scaleX : value.objectScaleX);
    const scaleY = axisScale(value.scaleY !== undefined ? value.scaleY : value.objectScaleY);
    const scaleZ = axisScale(value.scaleZ !== undefined ? value.scaleZ : value.objectScaleZ);
    const materialTexture = normalizeMaterialTextureKey(value.materialTexture || value.textureKey || value.texture);
    const materialTextureScale = normalizeMaterialTextureScale(value.materialTextureScale || value.textureScale || 1);
    const bodyTexture = normalizeMaterialTextureKey(value.bodyTexture || value.bodyMaterial || value.wallTexture);
    const bodyTextureScale = normalizeMaterialTextureScale(value.bodyTextureScale || value.bodyMaterialScale || 1);
    const topTexture = normalizeMaterialTextureKey(value.topTexture || value.topMaterial || value.roofTexture);
    const topTextureScale = normalizeMaterialTextureScale(value.topTextureScale || value.topMaterialScale || 1);
    const rawObjectStyle = String(value.objectStyle || value.style || '').toLowerCase();
    const objectStyle = rawObjectStyle === 'normal' || rawObjectStyle === 'voxel'
      ? rawObjectStyle
      : null;
    const rawFenceStyle = String(value.fenceStyle || value.fence || '').toLowerCase();
    const fenceStyle = rawFenceStyle === 'garden' || rawFenceStyle === 'gate' ? rawFenceStyle : null;
    const rawOreMetal = String(value.oreMetal || value.ore || value.metal || '').toLowerCase();
    const oreMetal = rawOreMetal === 'copper' || rawOreMetal === 'iron' || rawOreMetal === 'silver' || rawOreMetal === 'gold'
      ? rawOreMetal
      : null;
    const clampNum = (raw, lo, hi) => {
      const n = Number(raw);
      return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null;
    };
    const emissiveColor = normalizeHexColor(value.emissiveColor || value.emissive || value.glowColor);
    const emissiveIntensity = clampNum(value.emissiveIntensity !== undefined ? value.emissiveIntensity : value.glow, 0, 2);
    const opacity = clampNum(value.opacity, 0, 1);
    const rawFinish = String(value.finish || '').toLowerCase();
    const finish = (rawFinish === 'matte' || rawFinish === 'satin' || rawFinish === 'glow') ? rawFinish : null;
    let light = null;
    if (value.light && typeof value.light === 'object') {
      const lt = String(value.light.type || '').toLowerCase();
      const lightType = (lt === 'point' || lt === 'spot') ? lt : null;
      if (lightType) {
        const li = clampNum(value.light.intensity, 0, 4);
        const lr = clampNum(value.light.range, 0, 20);
        light = {
          type: lightType,
          color: normalizeHexColor(value.light.color) || '#ffd9a0',
          intensity: li === null ? 1 : +li.toFixed(3),
          range: lr === null ? 6 : +lr.toFixed(3),
        };
      }
    }
    // Per-object window glass overrides: any of glassRatio (geometry — bigger
    // glass / thinner wood), tint (hex), darkness, brightness, reflect. Only the
    // keys the caller actually set are kept; missing ones fall back to the global
    // WINDOW defaults at build/draw time.
    let win = null;
    if (value.window && typeof value.window === 'object') {
      const w = {};
      const gr = clampNum(value.window.glassRatio, 0.3, 1);
      if (gr !== null) w.glassRatio = +gr.toFixed(3);
      const tint = normalizeHexColor(value.window.tint);
      if (tint) w.tint = tint;
      const dk = clampNum(value.window.darkness, 0, 1);
      if (dk !== null) w.darkness = +dk.toFixed(3);
      const br = clampNum(value.window.brightness, 0, 3);
      if (br !== null) w.brightness = +br.toFixed(3);
      const rf = clampNum(value.window.reflect, 0, 1);
      if (rf !== null) w.reflect = +rf.toFixed(3);
      if (Object.keys(w).length) win = w;
    }
    // Per-part overrides (sub-object editing, req 9): map of stable partKey →
    // { ox,oy,oz, sx,sy,sz, rx,ry,rz } (offset, scale, rotation). Keys are
    // validated to the partKey shapes; values clamped. Reattaches by key on reload.
    let parts = null;
    if (value.parts && typeof value.parts === 'object') {
      // Accept voxel grid keys (v:x,y,z), customParts ids (p:id), and house role
      // keys (wall, roof, door, window:0, chimney:1, ...).
      const keyOk = k => typeof k === 'string' && /^(v:-?\d+,-?\d+,-?\d+|p:[a-z0-9_-]{1,64}|[a-z][a-z0-9_-]{0,31}(:[a-z0-9_-]{1,64})?)$/i.test(k);
      const num = (raw, lo, hi, dflt) => {
        const n = Number(raw);
        return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
      };
      const acc = {};
      for (const k of Object.keys(value.parts)) {
        if (!keyOk(k)) continue;
        const p = value.parts[k] || {};
        const rx = +num(p.rx, -Math.PI * 2, Math.PI * 2, 0).toFixed(3);
        const ry = +num(p.ry, -Math.PI * 2, Math.PI * 2, 0).toFixed(3);
        const rz = +num(p.rz, -Math.PI * 2, Math.PI * 2, 0).toFixed(3);
        const entry = {
          ox: +num(p.ox, -8, 8, 0).toFixed(3), oy: +num(p.oy, -8, 8, 0).toFixed(3), oz: +num(p.oz, -8, 8, 0).toFixed(3),
          sx: +num(p.sx, 0.1, 8, 1).toFixed(3), sy: +num(p.sy, 0.1, 8, 1).toFixed(3), sz: +num(p.sz, 0.1, 8, 1).toFixed(3),
        };
        if (rx) entry.rx = rx;
        if (ry) entry.ry = ry;
        if (rz) entry.rz = rz;
        const col = normalizeHexColor(p.col);
        if (col) entry.col = col;
        const isIdentity = !entry.col && !entry.ox && !entry.oy && !entry.oz && entry.sx === 1 && entry.sy === 1 && entry.sz === 1 && !entry.rx && !entry.ry && !entry.rz;
        if (!isIdentity) acc[k] = entry;
      }
      if (Object.keys(acc).length) parts = acc;
    }
    // Voxel sculpt edits (req 8): per-instance add/remove over the base stamp.
    // Kept compact as deltas (not the full voxel array). Moves reuse `parts`.
    let voxelsRemoved = null;
    if (Array.isArray(value.voxelsRemoved)) {
      const acc = value.voxelsRemoved.filter(k => typeof k === 'string' && /^-?\d+,-?\d+,-?\d+$/.test(k));
      if (acc.length) voxelsRemoved = Array.from(new Set(acc));
    }
    let voxelsAdded = null;
    if (Array.isArray(value.voxelsAdded)) {
      const acc = [];
      for (const v of value.voxelsAdded) {
        if (!v || typeof v !== 'object') continue;
        const vx = Math.round(Number(v.x)), vy = Math.round(Number(v.y)), vz = Math.round(Number(v.z));
        if (!Number.isFinite(vx) || !Number.isFinite(vy) || !Number.isFinite(vz)) continue;
        const color = normalizeHexColor(v.color) || '#c8c8c8';
        acc.push({ x: vx, y: vy, z: vz, color });
      }
      if (acc.length) voxelsAdded = acc;
    }
    const out = {};
    if (bodyColor) out.bodyColor = bodyColor;
    if (topColor) out.topColor = topColor;
    if (voxelBuildId) out.voxelBuildId = voxelBuildId;
    if (modelStampId) out.modelStampId = modelStampId;
    if (objectScale !== null && Math.abs(objectScale - 1) > 0.001) out.objectScale = +objectScale.toFixed(3);
    if (scaleX !== null && Math.abs(scaleX - 1) > 0.001) out.scaleX = +scaleX.toFixed(3);
    if (scaleY !== null && Math.abs(scaleY - 1) > 0.001) out.scaleY = +scaleY.toFixed(3);
    if (scaleZ !== null && Math.abs(scaleZ - 1) > 0.001) out.scaleZ = +scaleZ.toFixed(3);
    if (materialTexture !== 'default') {
      out.materialTexture = materialTexture;
      if (Math.abs(materialTextureScale - 1) > 0.001) out.materialTextureScale = +materialTextureScale.toFixed(3);
    }
    if (bodyTexture !== 'default') {
      out.bodyTexture = bodyTexture;
      if (Math.abs(bodyTextureScale - 1) > 0.001) out.bodyTextureScale = +bodyTextureScale.toFixed(3);
    }
    if (topTexture !== 'default') {
      out.topTexture = topTexture;
      if (Math.abs(topTextureScale - 1) > 0.001) out.topTextureScale = +topTextureScale.toFixed(3);
    }
    if (objectStyle) out.objectStyle = objectStyle;
    if (fenceStyle) out.fenceStyle = fenceStyle;
    if (oreMetal) out.oreMetal = oreMetal;
    if (emissiveColor) out.emissiveColor = emissiveColor;
    if (emissiveIntensity !== null && emissiveIntensity > 0.001) out.emissiveIntensity = +emissiveIntensity.toFixed(3);
    if (opacity !== null && opacity < 0.999) out.opacity = +opacity.toFixed(3);
    if (finish && finish !== 'matte') out.finish = finish;
    if (light) out.light = light;
    if (win) out.window = win;
    if (parts) out.parts = parts;
    if (voxelsRemoved) out.voxelsRemoved = voxelsRemoved;
    if (voxelsAdded) out.voxelsAdded = voxelsAdded;
    return Object.keys(out).length ? out : null;
  }
  function sameAppearance(a, b) {
    const aa = normalizeAppearance(a);
    const bb = normalizeAppearance(b);
    return JSON.stringify(aa || null) === JSON.stringify(bb || null);
  }
  function towerPaletteWithAppearance(basePalette, appearance) {
    const a = normalizeAppearance(appearance);
    const p = Object.assign({}, basePalette || {});
    if (a && a.bodyColor) {
      p.stone = customMaterial(p.stone || M.towerStone, a.bodyColor);
      p.stoneD = customMaterial(p.stoneD || M.towerStoneD, shadeHexColor(a.bodyColor, -48));
    }
    if (a && a.topColor) {
      p.roof = customMaterial(p.roof || M.towerRoof, a.topColor);
      p.roofD = customMaterial(p.roofD || M.towerRoofD, shadeHexColor(a.topColor, -52));
    }
    return p;
  }
  function applyAppearanceToObject(root, kind, appearance) {
    const a = normalizeAppearance(appearance);
    if (!root || !a) return root;
    const topBase = new Set([
      M.roofBlue, M.manorRoof, M.towerRoof, M.castleRoof, M.skyRoof,
      M.leaves, M.rockHi, M.cropLeaf, M.cornCob, M.cornLeaf, M.wheatHead,
      M.pumpkin, M.carrotBody, M.sunflowerPetal, M_PLANT.petalRed,
      M_PLANT.petalYellow, M_PLANT.petalPurple, M_PLANT.petalWhite,
      M_PLANT.bushBerry, M_ANIMAL.cowSpot, M_ANIMAL.cowMuzzle,
      M_ANIMAL.sheepFace, M.grass, M.grassHi,
    ]);
    const topDark = new Set([
      M.roofBlueD, M.manorRoofD, M.towerRoofD, M.castleRoofD, M.leavesDk,
      M.pumpkinDk, M.sunflowerCenter, M_ANIMAL.hoof, M.grassEdge,
    ]);
    const bodyBase = new Set([
      M.wallCream, M.manorBrick, M.towerStone, M.castleStone, M.skyBody,
      M.trunk, M.bridgeWood, M.fence, M.rock, M.cropStem, M.cornStalk,
      M.wheatStalk, M.pumpkinStem, M.sunflowerStalk, M_ANIMAL.cowWhite,
      M_ANIMAL.sheepWool, M.dirtRich, M.islandUnder,
    ]);
    const bodyDark = new Set([
      M.wallTrim, M.manorBrickD, M.towerStoneD, M.castleStoneD,
      M.bridgeWoodD, M.fenceWire, M.fenceSteel, M.rockDk, M.islandUnderD,
    ]);
    function remap(mat) {
      if (!mat) return mat;
      let next = mat;
      if (a.topColor && topBase.has(mat)) next = customMaterial(mat, a.topColor);
      else if (a.topColor && topDark.has(mat)) next = customMaterial(mat, shadeHexColor(a.topColor, -48));
      else if (a.bodyColor && bodyBase.has(mat)) next = customMaterial(mat, a.bodyColor);
      else if (a.bodyColor && bodyDark.has(mat)) next = customMaterial(mat, shadeHexColor(a.bodyColor, -42));
      if (a.topTexture && (topBase.has(mat) || topDark.has(mat))) next = customTextureMaterial(next, a.topTexture, a.topTextureScale || 1);
      else if (a.bodyTexture && (bodyBase.has(mat) || bodyDark.has(mat))) next = customTextureMaterial(next, a.bodyTexture, a.bodyTextureScale || 1);
      if (a.materialTexture) next = customTextureMaterial(next, a.materialTexture, a.materialTextureScale || 1);
      next = surfaceMaterial(next, a);
      return next;
    }
    root.traverse(node => {
      if (!node.isMesh) return;
      node.material = Array.isArray(node.material) ? node.material.map(remap) : remap(node.material);
    });
    return root;
  }

  const SEASON_FOLIAGE = {
    spring: {
      grass: 0x79a838, grass2: 0x5c8a2b, leaves: 0x5f9e28, leavesDk: 0x47781c,
      cropLeaf: 0x96d943, cropStem: 0x5e9c2e, cornStalk: 0x6fa848, cornLeaf: 0xa8c948,
      pumpkinStem: 0x4d6a18, sunflowerStalk: 0x4d8a2a, rockMoss: 0x6f8a3a,
    },
    summer: {
      grass: 0x6f9e30, grass2: 0x547a26, leaves: 0x5f9e28, leavesDk: 0x47781c,
      cropLeaf: 0x96d943, cropStem: 0x5e9c2e, cornStalk: 0x6fa848, cornLeaf: 0xa8c948,
      pumpkinStem: 0x4d6a18, sunflowerStalk: 0x4d8a2a, rockMoss: 0x6f8a3a,
    },
    autumn: {
      grass: 0xb0ad5a, grass2: 0x8c9240, leaves: 0xc07a2f, leavesDk: 0x8f5b24,
      cropLeaf: 0xb99638, cropStem: 0x8a7d2d, cornStalk: 0xa27c32, cornLeaf: 0xb99738,
      pumpkinStem: 0x6f5a20, sunflowerStalk: 0x8a6b24, rockMoss: 0x7b7336,
    },
    winter: {
      grass: 0x9fb27f, grass2: 0x7f9668, leaves: 0x7ba66d, leavesDk: 0x5f874f,
      cropLeaf: 0x8eb278, cropStem: 0x6f8f5a, cornStalk: 0x8e9154, cornLeaf: 0xa6a96a,
      pumpkinStem: 0x65743e, sunflowerStalk: 0x6f864e, rockMoss: 0x687c4e,
    },
  };
  const weatherMaterialBase = new Map();
  const WEATHER_MATERIAL_SKIP = new Set(['hover', 'hoverErase', 'waterFoam', 'cloud', 'cloudShade']);
  function rememberWeatherMaterialBase() {
    for (const [name, mat] of Object.entries(M)) {
      if (!mat || !mat.color || WEATHER_MATERIAL_SKIP.has(name)) continue;
      if (!weatherMaterialBase.has(name)) weatherMaterialBase.set(name, mat.color.getHex());
    }
  }
  function resetWeatherMaterialTint() {
    rememberWeatherMaterialBase();
    for (const [name, hex] of weatherMaterialBase.entries()) {
      const mat = M[name];
      if (mat && mat.color) mat.color.setHex(hex);
    }
  }
  function recaptureWeatherMaterialBase() {
    weatherMaterialBase.clear();
    rememberWeatherMaterialBase();
  }
  function applyWeatherMaterialTint() {
    resetWeatherMaterialTint();
    const mode = typeof tileWeatherMode === 'string' ? tileWeatherMode : 'clear';
    if (mode !== 'rain' && mode !== 'snow') {
      if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
      return;
    }
    const heavy = (typeof weatherEffectFactor === 'function') ? weatherEffectFactor() : 0;
    const tint = new THREE.Color(mode === 'snow' ? 0xeaf3ff : 0x5f6f7f);
    const amount = mode === 'snow' ? 0.06 + heavy * 0.18 : 0.08 + heavy * 0.20;
    for (const [name] of weatherMaterialBase.entries()) {
      const mat = M[name];
      if (mat && mat.color) mat.color.lerp(tint, amount);
    }
    if (typeof fadeMatCache !== 'undefined') fadeMatCache.clear();
  }

  function applySeasonFoliage(seasonName) {
    resetWeatherMaterialTint();
    const palette = SEASON_FOLIAGE[seasonName === 'fall' ? 'autumn' : seasonName] || SEASON_FOLIAGE.summer;
    for (const [name, hex] of Object.entries(palette)) {
      const mat = M[name];
      if (mat && mat.color) mat.color.setHex(hex);
    }
    captureTerrainMaterialBaseColors();
    applyTerrainMaterialAdjustments();
    capturePartMaterialBaseState();
    applyPartMaterialAdjustments();
    applyLinkedSurfaceMaterialTextures();
    recaptureWeatherMaterialBase();
    applyWeatherMaterialTint();
  }

  function castReceive(obj) {
    obj.traverse(c => {
      if (c.isMesh) {
        if (c.userData && c.userData.noShadow) {
          c.castShadow = false;
          c.receiveShadow = false;
        } else {
          c.castShadow = true;
          c.receiveShadow = c.material !== M.wallCream;
        }
        c.frustumCulled = true;
      }
    });
    return obj;
  }

  const _twTerrainShadowReceivers = new Set();
  let _twTerrainShadowReceiveEnabled = null;

  function terrainShadowReceiveEnabledForCamera() {
    if (typeof viewSize === 'undefined') return true;
    const scaledDefaultView = (typeof DEFAULT_VIEW_SIZE !== 'undefined' && typeof HOME_GRID_DEFAULT !== 'undefined')
      ? DEFAULT_VIEW_SIZE * (GRID / HOME_GRID_DEFAULT)
      : GRID;
    const farShadowCutoff = Math.max(10, scaledDefaultView * 1.18);
    return viewSize <= farShadowCutoff;
  }

  function updateTerrainShadowReceiversForCamera(force = false) {
    const enabled = terrainShadowReceiveEnabledForCamera();
    if (!force && _twTerrainShadowReceiveEnabled === enabled) return;
    _twTerrainShadowReceiveEnabled = enabled;
    _twTerrainShadowReceivers.forEach(mesh => {
      if (!mesh || !mesh.isMesh || !mesh.parent) {
        _twTerrainShadowReceivers.delete(mesh);
        return;
      }
      mesh.receiveShadow = enabled && !(mesh.userData && mesh.userData.noReceiveShadow);
    });
  }

  function groundReceiveOnly(obj) {
    obj.traverse(c => {
      if (c.isMesh) {
        c.castShadow = false;
        c.receiveShadow = terrainShadowReceiveEnabledForCamera() && !(c.userData && c.userData.noReceiveShadow);
        c.frustumCulled = true;
        c.userData.terrainShadowReceiver = true;
        _twTerrainShadowReceivers.add(c);
      }
    });
    return obj;
  }

  function cellRand(x, z, salt) {
    const n = Math.sin((x + 1) * 127.1 + (z + 1) * 311.7 + (salt || 0) * 74.7) * 43758.5453123;
    return n - Math.floor(n);
  }

  function edgeBand(dir, width, depth, y, mat) {
    const alongX = dir === 'n' || dir === 's';
    const geo = alongX
      ? getBoxGeometry(width, depth, 0.05)
      : getBoxGeometry(0.05, depth, width);
    const m = new THREE.Mesh(geo, mat);
    if (dir === 'n') m.position.set(0, y, -0.465);
    if (dir === 's') m.position.set(0, y,  0.465);
    if (dir === 'w') m.position.set(-0.465, y, 0);
    if (dir === 'e') m.position.set( 0.465, y, 0);
    return m;
  }
