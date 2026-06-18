  // -------- render settings --------
  // Was an immediately-invoked IIFE; converted to a deferred named function
  // (called from engine/world/99-late-boot.js) because it reaches forward into
  // later modules (syncPlanetUnderlayToggle @27, syncAiSettings) at run time.
  function setupRenderSettings() {
    const modal = document.getElementById('render-modal');
    const openBtn = document.getElementById('render-settings');
    const closeBtn = document.getElementById('render-close');
    const resetBtn = document.getElementById('render-reset');
    const status = document.getElementById('render-status');
    const settingsSearchEl = document.getElementById('settings-search');
    const settingsSearchStatus = document.getElementById('settings-search-status');
    const shadowEl = document.getElementById('render-shadow');
    const resolutionEl = document.getElementById('render-resolution');
    const distanceEl = null;
    const visibleSizeEl = null;
    const homeGridEl = document.getElementById('render-home-grid');
    fillGridSizeSelect(homeGridEl);
    const brightnessEl = document.getElementById('render-brightness');
    const lightingEl = document.getElementById('render-lighting');
    const ambientFillEl = document.getElementById('render-ambient-fill');
    const frontFillEl = document.getElementById('render-front-fill');
    const sideFillEl = document.getElementById('render-side-fill');
    const backFillEl = document.getElementById('render-back-fill');
    const saturationEl = document.getElementById('render-saturation');
    const contrastEl = document.getElementById('render-contrast');
    const cloudsEl = document.getElementById('render-clouds');
    const cloudSpeedEl = document.getElementById('render-cloud-speed');
    const cloudHeightEl = document.getElementById('render-cloud-height');
    const cloudShadowEl = document.getElementById('render-cloud-shadow');
    const planesEnabledEl = document.getElementById('render-planes-enabled');
    const enhancedWaterEl = document.getElementById('render-enhanced-water');
    const distantWorldsEl = document.getElementById('render-distant-worlds');
    const cloudSeaEl = document.getElementById('render-cloud-sea');
    const cloudSoftEl = document.getElementById('render-cloud-soft');
    const starVaultEl = document.getElementById('render-star-vault');
    const starVaultStrengthEl = document.getElementById('render-star-vault-strength');
    const cloudRimLightEl = document.getElementById('render-cloud-rim-light');
    const accentLightsEl = document.getElementById('render-accent-lights');
    const underCloudSpreadEl = document.getElementById('render-undercloud-spread');
    const skyBlueDepthEl = document.getElementById('render-sky-blue-depth');
    const skyBlueSaturationEl = document.getElementById('render-sky-blue-saturation');
    const distanceMistEl = document.getElementById('render-distance-mist');
    const backdropEl = document.getElementById('render-backdrop');
    const backdropVignetteEl = document.getElementById('render-backdrop-vignette');
    const pixelSizeEl = document.getElementById('render-pixel-size');
    const pixelDepthEdgeEl = document.getElementById('render-pixel-depth-edge');
    const pixelNormalEdgeEl = document.getElementById('render-pixel-normal-edge');
    const shaderAntialiasEl = document.getElementById('render-shader-antialias');
    const tiltBlurEl = document.getElementById('render-tilt-blur');
    const tiltFocusEl = document.getElementById('render-tilt-focus');
    const crowdCountEl = document.getElementById('crowd-count');
    const crowdScaleEl = document.getElementById('crowd-scale');
    const crowdSpeedEl = document.getElementById('crowd-speed');
    const crowdBobEl = document.getElementById('crowd-bob');
    const crowdSwayEl = document.getElementById('crowd-sway');
    const crowdLeanEl = document.getElementById('crowd-lean');
    const crowdZoneRadiusEl = document.getElementById('crowd-zone-radius');
    const crowdShowZonesEl = document.getElementById('crowd-show-zones');
    const crowdPausedEl = document.getElementById('crowd-paused');
    const crowdEnabledEl = document.getElementById('crowd-enabled');
    const crowdDebugEl = document.getElementById('crowd-debug');
    const crowdReseedEl = document.getElementById('crowd-reseed');
    const crowdModeEl = document.getElementById('crowd-mode');
    const crowdCountLiveEl = document.getElementById('crowd-count-live');
    const crowdScaleLiveEl = document.getElementById('crowd-scale-live');
    const crowdSpeedLiveEl = document.getElementById('crowd-speed-live');
    const crowdZoneRadiusLiveEl = document.getElementById('crowd-zone-radius-live');
    const crowdShowZonesLiveEl = document.getElementById('crowd-show-zones-live');
    const crowdShowArrowsLiveEl = document.getElementById('crowd-show-arrows-live');
    const crowdPausedLiveEl = document.getElementById('crowd-paused-live');
    const crowdEnabledLiveEl = document.getElementById('crowd-enabled-live');
    const crowdReseedLiveEl = document.getElementById('crowd-reseed-live');
    const crowdDebugLiveEl = document.getElementById('crowd-debug-live');
    const ghostOpacityEl = null;
    const floorOpacityEl = null;
    const objectOpacityEl = null;
    const voxelGapEl = null;
    const voxelBevelEl = document.getElementById('render-voxel-bevel');
    const landscapeMeshContainer = document.getElementById('render-landscape-mesh-container');
    const landscapeMeshModeEl = document.getElementById('render-landscape-mesh-mode');
    const voxelTerrainEl = document.getElementById('render-voxel-terrain');
    const texturedGrassEl = document.getElementById('render-textured-grass');
    const surfaceLinkedMaterialsEl = document.getElementById('render-surface-linked-materials');
    const showCrownsEl = null;
    const terrainVoxelResolutionEl = document.getElementById('render-terrain-voxel-resolution');
    const terrainColorTargetEl = document.getElementById('render-terrain-color-target');
    const terrainTintEl = document.getElementById('render-terrain-tint');
    const terrainTextureEl = document.getElementById('render-terrain-texture');
    const terrainTextureScaleEl = document.getElementById('render-terrain-texture-scale');
    const terrainToneEl = document.getElementById('render-terrain-tone');
    const terrainColorResetEl = document.getElementById('render-terrain-color-reset');
    const materialTargetEl = document.getElementById('render-material-target');
    const materialTintEl = document.getElementById('render-material-tint');
    const materialTextureEl = document.getElementById('render-material-texture');
    const materialTextureScaleEl = document.getElementById('render-material-texture-scale');
    const materialToneEl = document.getElementById('render-material-tone');
    const materialResetEl = document.getElementById('render-material-reset');
    const materialWearEl = document.getElementById('render-material-wear');
    const resolutionValue = document.getElementById('render-resolution-value');
    const distanceValue = null;
    const visibleSizeValue = null;
    const brightnessValue = document.getElementById('render-brightness-value');
    const lightingValue = document.getElementById('render-lighting-value');
    const ambientFillValue = document.getElementById('render-ambient-fill-value');
    const frontFillValue = document.getElementById('render-front-fill-value');
    const sideFillValue = document.getElementById('render-side-fill-value');
    const backFillValue = document.getElementById('render-back-fill-value');
    const saturationValue = document.getElementById('render-saturation-value');
    const contrastValue = document.getElementById('render-contrast-value');
    const cloudsValue = document.getElementById('render-clouds-value');
    const cloudSpeedValue = document.getElementById('render-cloud-speed-value');
    const cloudHeightValue = document.getElementById('render-cloud-height-value');
    const cloudShadowValue = document.getElementById('render-cloud-shadow-value');
    const starVaultStrengthValue = document.getElementById('render-star-vault-strength-value');
    const cloudRimLightValue = document.getElementById('render-cloud-rim-light-value');
    const accentLightsValue = document.getElementById('render-accent-lights-value');
    const underCloudSpreadValue = document.getElementById('render-undercloud-spread-value');
    const skyBlueDepthValue = document.getElementById('render-sky-blue-depth-value');
    const skyBlueSaturationValue = document.getElementById('render-sky-blue-saturation-value');
    const distanceMistValue = document.getElementById('render-distance-mist-value');
    const backdropValue = document.getElementById('render-backdrop-value');
    const backdropVignetteValue = document.getElementById('render-backdrop-vignette-value');
    const pixelSizeValue = document.getElementById('render-pixel-size-value');
    const pixelDepthEdgeValue = document.getElementById('render-pixel-depth-edge-value');
    const pixelNormalEdgeValue = document.getElementById('render-pixel-normal-edge-value');
    const shaderAntialiasValue = document.getElementById('render-shader-antialias-value');
    const tiltBlurValue = document.getElementById('render-tilt-blur-value');
    const tiltFocusValue = document.getElementById('render-tilt-focus-value');
    const ghostOpacityValue = null;
    const floorOpacityValue = null;
    const objectOpacityValue = null;
    const voxelGapValue = null;
    const voxelBevelValue = document.getElementById('render-voxel-bevel-value');
    const terrainToneValue = document.getElementById('render-terrain-tone-value');
    const terrainTextureScaleValue = document.getElementById('render-terrain-texture-scale-value');
    const materialToneValue = document.getElementById('render-material-tone-value');
    const materialTextureScaleValue = document.getElementById('render-material-texture-scale-value');
    const materialWearValue = document.getElementById('render-material-wear-value');
    const settingsTabs = Array.from(modal.querySelectorAll('[data-settings-tab]'));
    const settingsPanels = Array.from(modal.querySelectorAll('[data-settings-panel]'));

    settingsTabs.forEach(tab => {
      if (tab.querySelector('.settings-tab-label')) return;
      const labelText = tab.textContent.trim();
      const hintText = tab.dataset.settingsDescription || '';
      tab.dataset.settingsLabel = labelText;
      tab.textContent = '';
      const copy = document.createElement('span');
      copy.className = 'settings-tab-copy';
      const label = document.createElement('span');
      label.className = 'settings-tab-label';
      label.textContent = labelText;
      copy.appendChild(label);
      if (hintText) {
        const hint = document.createElement('span');
        hint.className = 'settings-tab-hint';
        hint.textContent = hintText;
        copy.appendChild(hint);
      }
      const count = document.createElement('span');
      count.className = 'settings-tab-count';
      count.hidden = true;
      count.setAttribute('aria-hidden', 'true');
      tab.append(copy, count);
      tab.setAttribute('aria-label', hintText ? labelText + ', ' + hintText : labelText);
    });

    function fillMaterialTextureSelect(select) {
      if (!select || select.options.length) return;
      for (const opt of MATERIAL_TEXTURE_OPTIONS) {
        const el = document.createElement('option');
        el.value = opt.key;
        el.textContent = opt.label;
        select.appendChild(el);
      }
    }

    function fillPartMaterialSelect(select) {
      if (!select || select.options.length) return;
      for (const [key, group] of Object.entries(PART_MATERIAL_GROUPS)) {
        const el = document.createElement('option');
        el.value = key;
        el.textContent = group.label;
        select.appendChild(el);
      }
    }
    fillMaterialTextureSelect(terrainTextureEl);
    fillMaterialTextureSelect(materialTextureEl);
    fillPartMaterialSelect(materialTargetEl);

    function selectSettingsTab(name, opts = {}) {
      const activeTab = settingsTabs.find(tab => tab.dataset.settingsTab === name);
      const activePanel = settingsPanels.find(panel => panel.dataset.settingsPanel === name);
      if (!activeTab || !activePanel) return false;
      settingsTabs.forEach(tab => {
        const active = tab === activeTab;
        tab.classList.toggle('active', active);
        tab.setAttribute('aria-selected', active ? 'true' : 'false');
        tab.tabIndex = active ? 0 : -1;
      });
      settingsPanels.forEach(panel => {
        const active = panel === activePanel;
        panel.classList.toggle('active', active);
        panel.hidden = !active;
      });
      if (opts.focus && activeTab.focus) activeTab.focus();
      return true;
    }
    function settingsSearchTerms() {
      return (settingsSearchEl && settingsSearchEl.value || '')
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    }
    function searchableSettingsText(el) {
      if (!el) return '';
      const metadata = [
        el.dataset && el.dataset.settingsKeywords,
        el.dataset && el.dataset.settingsDescription,
        el.dataset && el.dataset.settingsPanel,
        el.dataset && el.dataset.settingsTab,
      ].filter(Boolean).join(' ');
      const ids = Array.from(el.querySelectorAll('[id]')).map(node => node.id.replace(/^render-/, '').replace(/^crowd-/, '')).join(' ');
      const values = Array.from(el.querySelectorAll('select, input, output')).map(node => {
        if (node.tagName === 'SELECT') return Array.from(node.options).map(opt => opt.textContent || '').join(' ');
        return node.getAttribute('placeholder') || '';
      }).join(' ');
      return (el.textContent + ' ' + metadata + ' ' + ids + ' ' + values).toLowerCase();
    }
    function matchesSettingsTerms(text, terms) {
      return !terms.length || terms.every(term => text.includes(term));
    }
    function updateSettingsSearch(opts = {}) {
      const terms = settingsSearchTerms();
      const activePanel = settingsPanels.find(panel => panel.classList.contains('active')) || settingsPanels[0];
      let totalMatches = 0;
      let firstMatchPanel = null;
      settingsPanels.forEach(panel => {
        const panelMetadata = [
          panel.dataset && panel.dataset.settingsKeywords,
          panel.dataset && panel.dataset.settingsPanel,
        ].filter(Boolean).join(' ').toLowerCase();
        const panelMetadataMatches = terms.length > 0 && matchesSettingsTerms(panelMetadata, terms);
        const groups = [];
        let current = null;
        Array.from(panel.children).forEach(child => {
          if (child.classList && child.classList.contains('settings-section-title')) {
            current = { title: child, rows: [] };
            groups.push(current);
          } else {
            if (!current) {
              current = { title: null, rows: [] };
              groups.push(current);
            }
            current.rows.push(child);
          }
        });
        let panelMatches = 0;
        groups.forEach(group => {
          const titleText = searchableSettingsText(group.title);
          const titleMatches = panelMetadataMatches || matchesSettingsTerms(titleText, terms);
          let visibleRows = 0;
          group.rows.forEach(row => {
            const rowMatches = panelMetadataMatches || titleMatches || matchesSettingsTerms(searchableSettingsText(row), terms);
            row.hidden = terms.length ? !rowMatches : false;
            if (rowMatches) {
              visibleRows++;
              panelMatches++;
            }
          });
          if (group.title) group.title.hidden = terms.length ? !(titleMatches || visibleRows > 0) : false;
        });
        totalMatches += panelMatches;
        if (panelMatches && !firstMatchPanel) firstMatchPanel = panel;
        panel.dataset.settingsSearchMatches = String(panelMatches);
        const tab = settingsTabs.find(t => t.dataset.settingsTab === panel.dataset.settingsPanel);
        if (tab) {
          tab.classList.toggle('search-miss', terms.length > 0 && panelMatches === 0);
          tab.title = terms.length ? (panelMatches ? panelMatches + ' matching settings' : 'No matching settings') : '';
          const count = tab.querySelector('.settings-tab-count');
          if (count) {
            count.textContent = String(panelMatches);
            count.hidden = !(terms.length && panelMatches > 0);
          }
          const label = tab.dataset.settingsLabel || tab.textContent.trim();
          const hint = tab.dataset.settingsDescription || '';
          const baseLabel = hint ? label + ', ' + hint : label;
          tab.setAttribute('aria-label', terms.length
            ? baseLabel + ', ' + panelMatches + ' matching setting' + (panelMatches === 1 ? '' : 's')
            : baseLabel);
        }
      });
      if (terms.length && activePanel && !Number(activePanel.dataset.settingsSearchMatches) && firstMatchPanel && !opts.keepActive) {
        selectSettingsTab(firstMatchPanel.dataset.settingsPanel);
      }
      if (settingsSearchStatus) {
        settingsSearchStatus.textContent = terms.length
          ? (totalMatches + (totalMatches === 1 ? ' match' : ' matches'))
          : '';
      }
    }
    settingsTabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => {
        selectSettingsTab(tab.dataset.settingsTab);
        updateSettingsSearch({ keepActive: true });
      });
      tab.addEventListener('keydown', e => {
        const key = e.key;
        if (key !== 'ArrowDown' && key !== 'ArrowRight' && key !== 'ArrowUp' && key !== 'ArrowLeft' && key !== 'Home' && key !== 'End') return;
        e.preventDefault();
        const last = settingsTabs.length - 1;
        const nextIdx = key === 'Home' ? 0
          : key === 'End' ? last
            : (key === 'ArrowDown' || key === 'ArrowRight') ? (idx + 1) % settingsTabs.length
              : (idx - 1 + settingsTabs.length) % settingsTabs.length;
        const next = settingsTabs[nextIdx];
        if (next) {
          selectSettingsTab(next.dataset.settingsTab, { focus: true });
          updateSettingsSearch({ keepActive: true });
        }
      });
    });
    if (settingsSearchEl) settingsSearchEl.addEventListener('input', () => updateSettingsSearch());
    const initialSettingsTab = (settingsTabs.find(tab => tab.classList.contains('active')) || settingsTabs[0]);
    if (initialSettingsTab) selectSettingsTab(initialSettingsTab.dataset.settingsTab);
    updateSettingsSearch({ keepActive: true });

    function syncControls() {
      shadowEl.value = renderShadowQuality;
      resolutionEl.value = String(Math.round(renderResolutionScale * 100));
      if (distanceEl) {
        distanceEl.min = '0';
        distanceEl.max = '0';
        distanceEl.value = '0';
      }
      if (visibleSizeEl) {
        visibleSizeEl.min = '0';
        visibleSizeEl.max = '0';
        visibleSizeEl.value = '0';
      }
      if (homeGridEl) homeGridEl.value = String(GRID);
      brightnessEl.value = String(Math.round(renderBrightness * 100));
      lightingEl.value = String(Math.round(renderLighting * 100));
      ambientFillEl.value = String(Math.round(renderAmbientFill * 100));
      frontFillEl.value = String(Math.round(renderFrontFill * 100));
      sideFillEl.value = String(Math.round(renderSideFill * 100));
      backFillEl.value = String(Math.round(renderBackFill * 100));
      saturationEl.value = String(Math.round(renderSaturation * 100));
      contrastEl.value = String(Math.round(renderContrast * 100));
      cloudsEl.value = String(Math.round(renderCloudAmount * 100));
      cloudSpeedEl.value = String(Math.round(renderCloudSpeed * 100));
      cloudHeightEl.value = String(renderCloudHeight);
      cloudShadowEl.value = String(Math.round(renderCloudShadow * 100));
      if (planesEnabledEl) planesEnabledEl.checked = !!renderPlanesEnabled;
      if (enhancedWaterEl) enhancedWaterEl.checked = !!renderEnhancedWater;
      if (distantWorldsEl) distantWorldsEl.checked = !!renderDistantWorlds;
      if (cloudSeaEl) cloudSeaEl.checked = !!renderCloudSea;
      if (cloudSoftEl) cloudSoftEl.checked = (renderCloudStyle === 'soft');
      if (starVaultEl) starVaultEl.checked = !!renderStarVault;
      if (starVaultStrengthEl) starVaultStrengthEl.value = String(Math.round(renderStarVaultStrength * 100));
      if (cloudRimLightEl) cloudRimLightEl.value = String(Math.round(renderCloudRimLight * 100));
      if (accentLightsEl) accentLightsEl.value = String(Math.round(renderAccentLights * 100));
      if (underCloudSpreadEl) underCloudSpreadEl.value = String(Math.round(renderUnderCloudSpread * 100));
      if (skyBlueDepthEl) skyBlueDepthEl.value = String(Math.round(renderSkyBlueDepth * 100));
      if (skyBlueSaturationEl) skyBlueSaturationEl.value = String(Math.round(renderSkyBlueSaturation * 100));
      distanceMistEl.value = String(Math.round(renderDistanceMist * 100));
      backdropEl.value = String(Math.round(renderBackdrop * 100));
      backdropVignetteEl.value = String(Math.round(renderBackdropVignette * 100));
      pixelSizeEl.value = String(renderPixelSize);
      pixelDepthEdgeEl.value = String(Math.round(renderPixelDepthEdge * 100));
      pixelNormalEdgeEl.value = String(Math.round(renderPixelNormalEdge * 100));
      shaderAntialiasEl.value = String(Math.round(renderShaderAntialias * 100));
      tiltBlurEl.value = String(renderTiltBlur);
      tiltFocusEl.value = String(Math.round(renderTiltFocus));
      if (ghostOpacityEl) ghostOpacityEl.value = '0';
      if (floorOpacityEl) floorOpacityEl.value = '0';
      if (objectOpacityEl) objectOpacityEl.value = '0';
      if (voxelGapEl) voxelGapEl.value = '0';
      voxelBevelEl.value = renderVoxelBevel.toFixed(3);
      if (landscapeMeshContainer) {
        landscapeMeshContainer.style.display = useLandscapeEngine ? 'flex' : 'none';
      }
      if (landscapeMeshModeEl) {
        landscapeMeshModeEl.checked = !!landscapeMeshMode;
      }
      syncPlanetUnderlayToggle();
      if (voxelTerrainEl) voxelTerrainEl.checked = !!renderVoxelTerrain;
      if (texturedGrassEl) texturedGrassEl.checked = !!renderTexturedGrass;
      if (surfaceLinkedMaterialsEl) surfaceLinkedMaterialsEl.checked = !!renderSurfaceLinkedMaterials;
      if (showCrownsEl) showCrownsEl.checked = false;
      if (terrainVoxelResolutionEl) terrainVoxelResolutionEl.value = renderTerrainVoxelResolution;
      if (terrainColorTargetEl) terrainColorTargetEl.value = renderTerrainColorTarget;
      const terrainAdjustment = renderTerrainMaterialAdjustments[renderTerrainColorTarget] || {};
      if (terrainTintEl) terrainTintEl.value = terrainAdjustment.tint || terrainBaseColorForTarget(renderTerrainColorTarget);
      if (terrainToneEl) terrainToneEl.value = String(Math.round((terrainAdjustment.tone || 0) * 100));
      if (terrainTextureEl) terrainTextureEl.value = normalizeMaterialTextureKey(terrainAdjustment.texture);
      if (terrainTextureScaleEl) terrainTextureScaleEl.value = String(Math.round(normalizeMaterialTextureScale(terrainAdjustment.scale) * 100));
      if (materialTargetEl) materialTargetEl.value = renderMaterialTarget;
      const materialAdjustment = renderPartMaterialAdjustments[renderMaterialTarget] || {};
      if (materialTintEl) materialTintEl.value = materialAdjustment.tint || partBaseColorForTarget(renderMaterialTarget);
      if (materialToneEl) materialToneEl.value = String(Math.round((materialAdjustment.tone || 0) * 100));
      if (materialTextureEl) materialTextureEl.value = normalizeMaterialTextureKey(materialAdjustment.texture);
      if (materialTextureScaleEl) materialTextureScaleEl.value = String(Math.round(normalizeMaterialTextureScale(materialAdjustment.scale) * 100));
      if (materialWearEl) materialWearEl.value = String(Math.round(renderMaterialWear * 100));
      if (crowdCountEl) crowdCountEl.value = String(crowdCount);
      if (crowdScaleEl) crowdScaleEl.value = String(Math.round(crowdScale * 100));
      if (crowdSpeedEl) crowdSpeedEl.value = String(Math.round(crowdSpeedMul * 50));
      if (crowdBobEl) crowdBobEl.value = String(crowdBob);
      if (crowdSwayEl) crowdSwayEl.value = String(crowdSway);
      if (crowdLeanEl) crowdLeanEl.value = crowdLean.toFixed(2);
      if (crowdZoneRadiusEl) crowdZoneRadiusEl.value = String(Math.round(crowdZoneRadius * 100));
      if (crowdShowZonesEl) crowdShowZonesEl.checked = !!crowdShowZones;
      if (crowdPausedEl) crowdPausedEl.checked = !!crowdPaused;
      if (crowdEnabledEl) crowdEnabledEl.checked = !!crowdEnabled;
      if (crowdDebugEl) crowdDebugEl.checked = !!crowdDebug;
      if (crowdModeEl) crowdModeEl.value = crowdMode;
      if (crowdCountLiveEl) crowdCountLiveEl.value = String(crowdCount);
      if (crowdScaleLiveEl) crowdScaleLiveEl.value = String(Math.round(crowdScale * 100));
      if (crowdSpeedLiveEl) crowdSpeedLiveEl.value = String(Math.round(crowdSpeedMul * 50));
      if (crowdZoneRadiusLiveEl) crowdZoneRadiusLiveEl.value = String(Math.round(crowdZoneRadius * 100));
      if (crowdShowZonesLiveEl) crowdShowZonesLiveEl.checked = !!crowdShowZones;
      if (crowdShowArrowsLiveEl) crowdShowArrowsLiveEl.checked = !!crowdShowArrows;
      if (crowdPausedLiveEl) crowdPausedLiveEl.checked = !!crowdPaused;
      if (crowdEnabledLiveEl) crowdEnabledLiveEl.checked = !!crowdEnabled;
      resolutionValue.textContent = resolutionEl.value + '%';
      if (distanceValue && distanceEl) distanceValue.textContent = distanceEl.value;
      if (visibleSizeValue && visibleSizeEl) visibleSizeValue.textContent = visibleSizeEl.value + 'x' + visibleSizeEl.value;
      brightnessValue.textContent = brightnessEl.value + '%';
      lightingValue.textContent = lightingEl.value + '%';
      ambientFillValue.textContent = ambientFillEl.value + '%';
      frontFillValue.textContent = frontFillEl.value + '%';
      sideFillValue.textContent = sideFillEl.value + '%';
      backFillValue.textContent = backFillEl.value + '%';
      saturationValue.textContent = saturationEl.value + '%';
      contrastValue.textContent = contrastEl.value + '%';
      cloudsValue.textContent = cloudsEl.value + '%';
      cloudSpeedValue.textContent = cloudSpeedEl.value + '%';
      cloudHeightValue.textContent = cloudHeightEl.value;
      cloudShadowValue.textContent = cloudShadowEl.value + '%';
      if (starVaultStrengthValue && starVaultStrengthEl) starVaultStrengthValue.textContent = starVaultStrengthEl.value + '%';
      if (cloudRimLightValue && cloudRimLightEl) cloudRimLightValue.textContent = cloudRimLightEl.value + '%';
      if (accentLightsValue && accentLightsEl) accentLightsValue.textContent = accentLightsEl.value + '%';
      if (underCloudSpreadValue && underCloudSpreadEl) underCloudSpreadValue.textContent = underCloudSpreadEl.value + '%';
      if (skyBlueDepthValue && skyBlueDepthEl) skyBlueDepthValue.textContent = skyBlueDepthEl.value + '%';
      if (skyBlueSaturationValue && skyBlueSaturationEl) skyBlueSaturationValue.textContent = skyBlueSaturationEl.value + '%';
      distanceMistValue.textContent = distanceMistEl.value + '%';
      backdropValue.textContent = backdropEl.value + '%';
      backdropVignetteValue.textContent = backdropVignetteEl.value + '%';
      pixelSizeValue.textContent = pixelSizeEl.value + (pixelSizeEl.value === '1' ? ' (off)' : 'x');
      pixelDepthEdgeValue.textContent = pixelDepthEdgeEl.value + '%';
      pixelNormalEdgeValue.textContent = pixelNormalEdgeEl.value + '%';
      shaderAntialiasValue.textContent = shaderAntialiasEl.value + '%';
      tiltBlurValue.textContent = tiltBlurEl.value + 'px';
      tiltFocusValue.textContent = tiltFocusEl.value + '%';
      if (ghostOpacityValue && ghostOpacityEl) ghostOpacityValue.textContent = ghostOpacityEl.value + '%';
      if (floorOpacityValue && floorOpacityEl) floorOpacityValue.textContent = floorOpacityEl.value + '%';
      if (objectOpacityValue && objectOpacityEl) objectOpacityValue.textContent = objectOpacityEl.value + '%';
      if (voxelGapValue && voxelGapEl) voxelGapValue.textContent = (parseInt(voxelGapEl.value, 10) / 100).toFixed(2);
      voxelBevelValue.textContent = parseFloat(voxelBevelEl.value).toFixed(3);
      if (terrainToneValue && terrainToneEl) {
        const tone = parseInt(terrainToneEl.value, 10) || 0;
        terrainToneValue.textContent = tone === 0 ? 'neutral' : (tone > 0 ? '+' : '') + tone + '%';
      }
      if (terrainTextureScaleValue && terrainTextureScaleEl) terrainTextureScaleValue.textContent = terrainTextureScaleEl.value + '%';
      if (materialToneValue && materialToneEl) {
        const tone = parseInt(materialToneEl.value, 10) || 0;
        materialToneValue.textContent = tone === 0 ? 'neutral' : (tone > 0 ? '+' : '') + tone + '%';
      }
      if (materialTextureScaleValue && materialTextureScaleEl) materialTextureScaleValue.textContent = materialTextureScaleEl.value + '%';
      if (materialWearValue && materialWearEl) materialWearValue.textContent = materialWearEl.value + '%';
      if (crowdCountEl) document.getElementById('crowd-count-value').textContent = crowdCount;
      if (crowdScaleEl) document.getElementById('crowd-scale-value').textContent = Math.round(crowdScale * 100) + '%';
      if (crowdSpeedEl) document.getElementById('crowd-speed-value').textContent = Math.round(crowdSpeedMul * 100) + '%';
      if (crowdBobEl) document.getElementById('crowd-bob-value').textContent = crowdBob.toFixed(1);
      if (crowdSwayEl) document.getElementById('crowd-sway-value').textContent = crowdSway.toFixed(1);
      if (crowdLeanEl) document.getElementById('crowd-lean-value').textContent = crowdLean.toFixed(2);
      if (crowdZoneRadiusEl) document.getElementById('crowd-zone-radius-value').textContent = crowdZoneRadius.toFixed(2);
      if (crowdCountLiveEl) document.getElementById('crowd-count-live-value').textContent = crowdCount;
      if (crowdScaleLiveEl) document.getElementById('crowd-scale-live-value').textContent = Math.round(crowdScale * 100) + '%';
      if (crowdSpeedLiveEl) document.getElementById('crowd-speed-live-value').textContent = Math.round(crowdSpeedMul * 100) + '%';
      if (crowdZoneRadiusLiveEl) document.getElementById('crowd-zone-radius-live-value').textContent = crowdZoneRadius.toFixed(2);
      status.textContent = 'DPR ' + renderer.getPixelRatio().toFixed(2) + ' · shadow ' + sun.shadow.mapSize.x + ' · preview off · planes ' + (renderPlanesEnabled ? 'on' : 'off') + ' · crowd ' + crowdCount;
    }

    function persistSettings() {
      localStorage.setItem(RENDER_LS.resolution, renderResolutionScale.toFixed(2));
      localStorage.setItem(RENDER_LS.visibleDistance, '0');
      localStorage.setItem(RENDER_LS.visibleSize, '0');
      localStorage.setItem(RENDER_LS.brightness, renderBrightness.toFixed(2));
      localStorage.setItem(RENDER_LS.lighting, renderLighting.toFixed(2));
      localStorage.setItem(RENDER_LS.ambientFill, renderAmbientFill.toFixed(2));
      localStorage.setItem(RENDER_LS.frontFill, renderFrontFill.toFixed(2));
      localStorage.setItem(RENDER_LS.sideFill, renderSideFill.toFixed(2));
      localStorage.setItem(RENDER_LS.backFill, renderBackFill.toFixed(2));
      localStorage.setItem(RENDER_LS.saturation, renderSaturation.toFixed(2));
      localStorage.setItem(RENDER_LS.contrast, renderContrast.toFixed(2));
      localStorage.setItem(RENDER_LS.shadow, renderShadowQuality);
      localStorage.setItem(RENDER_LS.clouds, renderCloudAmount.toFixed(2));
      localStorage.setItem(RENDER_LS.cloudSpeed, renderCloudSpeed.toFixed(2));
      localStorage.setItem(RENDER_LS.cloudHeight, renderCloudHeight.toFixed(1));
      localStorage.setItem(RENDER_LS.cloudShadow, renderCloudShadow.toFixed(2));
      localStorage.setItem(RENDER_LS.planesEnabled, renderPlanesEnabled ? '1' : '0');
      localStorage.setItem(RENDER_LS.enhancedWater, renderEnhancedWater ? '1' : '0');
      localStorage.setItem(RENDER_LS.distantWorlds, renderDistantWorlds ? '1' : '0');
      localStorage.setItem(RENDER_LS.cloudSea, renderCloudSea ? '1' : '0');
      localStorage.setItem(RENDER_LS.cloudStyle, renderCloudStyle);
      localStorage.setItem(RENDER_LS.starVault, renderStarVault ? '1' : '0');
      localStorage.setItem(RENDER_LS.starVaultStrength, renderStarVaultStrength.toFixed(2));
      localStorage.setItem(RENDER_LS.cloudRimLight, renderCloudRimLight.toFixed(2));
      localStorage.setItem(RENDER_LS.accentLights, renderAccentLights.toFixed(2));
      localStorage.setItem(RENDER_LS.underCloudSpread, renderUnderCloudSpread.toFixed(2));
      localStorage.setItem(RENDER_LS.skyBlueDepth, renderSkyBlueDepth.toFixed(2));
      localStorage.setItem(RENDER_LS.skyBlueSaturation, renderSkyBlueSaturation.toFixed(2));
      localStorage.setItem(RENDER_LS.distanceMist, renderDistanceMist.toFixed(2));
      localStorage.setItem(RENDER_LS.backdrop, renderBackdrop.toFixed(2));
      localStorage.setItem(RENDER_LS.backdropVignette, renderBackdropVignette.toFixed(2));
      localStorage.setItem(RENDER_LS.pixelSize, String(renderPixelSize));
      localStorage.setItem(RENDER_LS.pixelDepthEdge, renderPixelDepthEdge.toFixed(2));
      localStorage.setItem(RENDER_LS.pixelNormalEdge, renderPixelNormalEdge.toFixed(2));
      localStorage.setItem(RENDER_LS.shaderAntialias, renderShaderAntialias.toFixed(2));
      localStorage.setItem(RENDER_LS.tiltBlur, renderTiltBlur.toFixed(1));
      localStorage.setItem(RENDER_LS.tiltFocus, renderTiltFocus.toFixed(0));
      localStorage.setItem(RENDER_LS.ghostOpacity, '0');
      localStorage.setItem(RENDER_LS.floorOpacity, '0');
      localStorage.setItem(RENDER_LS.objectOpacity, '0');
      localStorage.setItem(RENDER_LS.voxelGap, '0');
      localStorage.setItem(RENDER_LS.voxelBevel, renderVoxelBevel.toFixed(3));
      localStorage.setItem(RENDER_LS.voxelTerrain, renderVoxelTerrain ? '1' : '0');
      localStorage.setItem(RENDER_LS.texturedGrass, renderTexturedGrass ? '1' : '0');
      localStorage.setItem(RENDER_LS.surfaceLinkedMaterials, renderSurfaceLinkedMaterials ? '1' : '0');
      localStorage.setItem(RENDER_LS.terrainColors, JSON.stringify(renderTerrainMaterialAdjustments || {}));
      localStorage.setItem(RENDER_LS.terrainColorTarget, renderTerrainColorTarget);
      localStorage.setItem(RENDER_LS.materialParts, JSON.stringify(renderPartMaterialAdjustments || {}));
      localStorage.setItem(RENDER_LS.materialTarget, renderMaterialTarget);
      localStorage.setItem(RENDER_LS.materialWear, renderMaterialWear.toFixed(2));
      localStorage.setItem(RENDER_LS.landscapeMeshMode, landscapeMeshMode ? '1' : '0');
      localStorage.setItem(RENDER_LS.showCrowns, '0');
      localStorage.setItem(RENDER_LS.terrainVoxelResolution, renderTerrainVoxelResolution);
      localStorage.setItem(RENDER_LS.autoExpand, renderAutoExpand ? '1' : '0');
      localStorage.setItem(RENDER_LS.crowdEnabled, crowdEnabled ? '1' : '0');
    }

    function applyFromControls() {
      const oldLandscapeMeshMode = landscapeMeshMode;
      const oldVoxelGap = renderVoxelGap;
      const oldVoxelBevel = renderVoxelBevel;
      const oldVoxelTerrain = renderVoxelTerrain;
      const oldTexturedGrass = renderTexturedGrass;
      const oldSurfaceLinkedMaterials = renderSurfaceLinkedMaterials;
      const oldTerrainVoxelResolution = renderTerrainVoxelResolution;
      const oldShowCrowns = showCrowns;
      const oldCrowdEnabled = crowdEnabled;
      const oldTerrainColors = JSON.stringify(renderTerrainMaterialAdjustments || {});
      const oldPartMaterials = JSON.stringify(renderPartMaterialAdjustments || {});
      const oldMaterialWear = renderMaterialWear;
      const oldCloudHeight = renderCloudHeight;
      const oldUnderCloudSpread = renderUnderCloudSpread;
      const oldPlanesEnabled = renderPlanesEnabled;
      const oldEnhancedWater = renderEnhancedWater;
      const oldDistantWorlds = renderDistantWorlds;
      const oldCloudSea = renderCloudSea;
      const oldCloudStyle = renderCloudStyle;
      const oldCloudAmount = renderCloudAmount;
      const oldStarVault = renderStarVault;
      const oldStarVaultStrength = renderStarVaultStrength;
      const oldCloudRimLight = renderCloudRimLight;
      const oldAccentLights = renderAccentLights;
      setShadowQuality(shadowEl.value);
      setRenderResolutionScale(parseInt(resolutionEl.value, 10) / 100);
      setRenderVisibleDistance(0);
      setRenderVisibleSize(0);
      renderBrightness = parseInt(brightnessEl.value, 10) / 100;
      renderLighting = parseInt(lightingEl.value, 10) / 100;
      renderAmbientFill = parseInt(ambientFillEl.value, 10) / 100;
      renderFrontFill = parseInt(frontFillEl.value, 10) / 100;
      renderSideFill = parseInt(sideFillEl.value, 10) / 100;
      renderBackFill = parseInt(backFillEl.value, 10) / 100;
      applyLightingSettings();
      renderSaturation = parseInt(saturationEl.value, 10) / 100;
      renderContrast = parseInt(contrastEl.value, 10) / 100;
      renderCloudAmount = parseInt(cloudsEl.value, 10) / 100;
      renderCloudSpeed = parseInt(cloudSpeedEl.value, 10) / 100;
      renderCloudHeight = parseFloat(cloudHeightEl.value);
      renderCloudShadow = parseInt(cloudShadowEl.value, 10) / 100;
      renderPlanesEnabled = planesEnabledEl ? !!planesEnabledEl.checked : renderPlanesEnabled;
      renderEnhancedWater = enhancedWaterEl ? !!enhancedWaterEl.checked : renderEnhancedWater;
      renderDistantWorlds = distantWorldsEl ? !!distantWorldsEl.checked : renderDistantWorlds;
      renderCloudSea = cloudSeaEl ? !!cloudSeaEl.checked : renderCloudSea;
      renderCloudStyle = cloudSoftEl && cloudSoftEl.checked ? 'soft' : 'voxel';
      renderStarVault = starVaultEl ? !!starVaultEl.checked : renderStarVault;
      renderStarVaultStrength = starVaultStrengthEl ? parseInt(starVaultStrengthEl.value, 10) / 100 : renderStarVaultStrength;
      renderCloudRimLight = cloudRimLightEl ? parseInt(cloudRimLightEl.value, 10) / 100 : renderCloudRimLight;
      renderAccentLights = accentLightsEl ? parseInt(accentLightsEl.value, 10) / 100 : renderAccentLights;
      renderUnderCloudSpread = underCloudSpreadEl ? parseInt(underCloudSpreadEl.value, 10) / 100 : renderUnderCloudSpread;
      renderSkyBlueDepth = skyBlueDepthEl ? parseInt(skyBlueDepthEl.value, 10) / 100 : renderSkyBlueDepth;
      renderSkyBlueSaturation = skyBlueSaturationEl ? parseInt(skyBlueSaturationEl.value, 10) / 100 : renderSkyBlueSaturation;
      if (typeof applyCloudShadowSetting === 'function') applyCloudShadowSetting();
      applyCloudSettings();
      if (typeof applyCloudHeight === 'function') applyCloudHeight();
      if (
        (Math.abs(renderUnderCloudSpread - oldUnderCloudSpread) > 0.001 ||
          Math.abs(renderCloudHeight - oldCloudHeight) > 0.001) &&
        typeof buildUnderIslandClouds === 'function'
      ) buildUnderIslandClouds();
      renderDistanceMist = parseInt(distanceMistEl.value, 10) / 100;
      renderBackdrop = parseInt(backdropEl.value, 10) / 100;
      renderBackdropVignette = parseInt(backdropVignetteEl.value, 10) / 100;
      applyBackdropSettings();
      if (typeof applySkyBubbleSettings === 'function') applySkyBubbleSettings();
      applyDistanceMistSettings();
      renderPixelSize = Math.max(1, Math.min(12, parseInt(pixelSizeEl.value, 10) || 1));
      renderPixelDepthEdge = parseInt(pixelDepthEdgeEl.value, 10) / 100;
      renderPixelNormalEdge = parseInt(pixelNormalEdgeEl.value, 10) / 100;
      renderShaderAntialias = parseInt(shaderAntialiasEl.value, 10) / 100;
      renderTiltBlur = parseFloat(tiltBlurEl.value);
      renderTiltFocus = parseInt(tiltFocusEl.value, 10);
      applyTiltShiftSettings();
      renderGhostOpacity = 0;
      renderFloorOpacity = 0;
      renderObjectOpacity = 0;
      renderVoxelGap = 0;
      renderVoxelBevel = Math.max(0, Math.min(0.06, parseFloat(voxelBevelEl.value) || 0));
      if (landscapeMeshModeEl && useLandscapeEngine) {
        const nextMode = !!landscapeMeshModeEl.checked;
        if (nextMode !== oldLandscapeMeshMode) {
          if (nextMode) {
            initLandscapeMesh();
            rebuildTerrainRender();
            rebuildObjectsRender();
          } else {
            disposeLandscapeMesh({ rebuild: true });
          }
        }
      }
      if (voxelTerrainEl) renderVoxelTerrain = !!voxelTerrainEl.checked;
      if (texturedGrassEl) {
        renderTexturedGrass = !!texturedGrassEl.checked;
        if (oldTexturedGrass !== renderTexturedGrass) {
          applySurfaceTextureDefaults();
          commitTerrainMaterialAdjustments();
          customMaterialCache.clear();
          rebuildTerrainRender();
        }
      }
      if (surfaceLinkedMaterialsEl) renderSurfaceLinkedMaterials = !!surfaceLinkedMaterialsEl.checked;
      showCrowns = false;
      if (terrainVoxelResolutionEl) renderTerrainVoxelResolution = terrainVoxelResolutionEl.value;
      if (terrainColorTargetEl && TERRAIN_COLOR_KEYS.includes(terrainColorTargetEl.value)) {
        renderTerrainColorTarget = terrainColorTargetEl.value;
      }
      if (terrainTintEl && terrainToneEl) {
        const tint = normalizeHexColor(terrainTintEl.value) || terrainBaseColorForTarget(renderTerrainColorTarget);
        const tone = Math.max(-0.5, Math.min(0.5, (parseInt(terrainToneEl.value, 10) || 0) / 100));
        const texture = normalizeMaterialTextureKey(terrainTextureEl && terrainTextureEl.value);
        const scale = normalizeMaterialTextureScale((parseInt(terrainTextureScaleEl && terrainTextureScaleEl.value, 10) || 100) / 100);
        const baseTint = terrainBaseColorForTarget(renderTerrainColorTarget).toLowerCase();
        if (Math.abs(tone) > 0.001 || tint.toLowerCase() !== baseTint || texture !== 'default' || Math.abs(scale - 1) > 0.001) {
          renderTerrainMaterialAdjustments[renderTerrainColorTarget] = { tint, tone, texture, scale };
        } else {
          delete renderTerrainMaterialAdjustments[renderTerrainColorTarget];
        }
      }
      if (materialTargetEl && PART_MATERIAL_GROUPS[materialTargetEl.value]) {
        renderMaterialTarget = materialTargetEl.value;
      }
      if (materialTintEl && materialToneEl) {
        const tint = normalizeHexColor(materialTintEl.value) || partBaseColorForTarget(renderMaterialTarget);
        const tone = Math.max(-0.5, Math.min(0.5, (parseInt(materialToneEl.value, 10) || 0) / 100));
        const texture = normalizeMaterialTextureKey(materialTextureEl && materialTextureEl.value);
        const scale = normalizeMaterialTextureScale((parseInt(materialTextureScaleEl && materialTextureScaleEl.value, 10) || 100) / 100);
        const baseTint = partBaseColorForTarget(renderMaterialTarget).toLowerCase();
        if (Math.abs(tone) > 0.001 || tint.toLowerCase() !== baseTint || texture !== 'default' || Math.abs(scale - 1) > 0.001) {
          renderPartMaterialAdjustments[renderMaterialTarget] = { tint, tone, texture, scale };
        } else {
          delete renderPartMaterialAdjustments[renderMaterialTarget];
        }
      }
      if (materialWearEl) renderMaterialWear = Math.max(0, Math.min(1, parseInt(materialWearEl.value, 10) / 100));
      if (crowdCountEl) crowdCount = parseInt(crowdCountEl.value, 10) || 0;
      if (crowdScaleEl) crowdScale = parseInt(crowdScaleEl.value, 10) / 100;
      if (crowdSpeedEl) crowdSpeedMul = parseInt(crowdSpeedEl.value, 10) / 50;
      if (crowdBobEl) crowdBob = parseFloat(crowdBobEl.value) || 0;
      if (crowdSwayEl) crowdSway = parseFloat(crowdSwayEl.value) || 0;
      if (crowdLeanEl) crowdLean = parseFloat(crowdLeanEl.value) || 0;
      if (crowdZoneRadiusEl) crowdZoneRadius = parseInt(crowdZoneRadiusEl.value, 10) / 100;
      if (crowdShowZonesEl) crowdShowZones = !!crowdShowZonesEl.checked;
      if (crowdPausedEl) crowdPaused = !!crowdPausedEl.checked;
      if (crowdModeEl) crowdMode = crowdModeEl.value;
      if (crowdCountLiveEl) crowdCount = parseInt(crowdCountLiveEl.value, 10) || 0;
      if (crowdScaleLiveEl) crowdScale = parseInt(crowdScaleLiveEl.value, 10) / 100;
      if (crowdSpeedLiveEl) crowdSpeedMul = parseInt(crowdSpeedLiveEl.value, 10) / 50;
      if (crowdZoneRadiusLiveEl) crowdZoneRadius = parseInt(crowdZoneRadiusLiveEl.value, 10) / 100;
      if (crowdShowZonesLiveEl) crowdShowZones = !!crowdShowZonesLiveEl.checked;
      if (crowdShowArrowsLiveEl) crowdShowArrows = !!crowdShowArrowsLiveEl.checked;
      if (crowdPausedLiveEl) crowdPaused = !!crowdPausedLiveEl.checked;
      if (crowdDebugEl) crowdDebug = !!crowdDebugEl.checked;
      if (crowdEnabledEl) crowdEnabled = !!crowdEnabledEl.checked;
      if (crowdEnabledLiveEl) crowdEnabled = !!crowdEnabledLiveEl.checked;
      applyCrowdSettings({ reseed: oldCrowdEnabled !== crowdEnabled });
      if (crowdEnabled && !crowdLayer) {
        initCrowdLayer();
      }
      if (Math.abs(oldVoxelGap - renderVoxelGap) > 0.001 || Math.abs(oldVoxelBevel - renderVoxelBevel) > 0.001) scheduleVoxelStampRefresh();
      if (oldVoxelTerrain !== renderVoxelTerrain || oldTerrainVoxelResolution !== renderTerrainVoxelResolution) {
        rebuildTerrainRender();
        if (oldVoxelTerrain !== renderVoxelTerrain) rebuildObjectsRender();
      }
      if (oldTerrainColors !== JSON.stringify(renderTerrainMaterialAdjustments || {})) {
        commitTerrainMaterialAdjustments();
        rebuildTerrainRender();
      }
      if (oldPlanesEnabled !== renderPlanesEnabled && typeof setPlanesEnabled === 'function') {
        setPlanesEnabled(renderPlanesEnabled);
      }
      if (oldEnhancedWater !== renderEnhancedWater) {
        // Rebuild water materials (voxel tiles) and retune the landscape ocean
        // so the enhanced-water toggle applies in every environment at once.
        if (typeof refreshWaterShaderMaterials === 'function') refreshWaterShaderMaterials();
        rebuildTerrainRender();
        if (landscapeEngineInstance && landscapeEngineInstance.waterMat
            && landscapeEngineInstance.waterMat.uniforms
            && landscapeEngineInstance.waterMat.uniforms.uEnhance) {
          landscapeEngineInstance.waterMat.uniforms.uEnhance.value = renderEnhancedWater ? 1.0 : 0.0;
        }
      }
      if (oldDistantWorlds !== renderDistantWorlds && typeof setDistantWorldsVisible === 'function') {
        setDistantWorldsVisible(renderDistantWorlds);
      }
      if (oldCloudSea !== renderCloudSea && typeof setCloudSeaEnabled === 'function') {
        setCloudSeaEnabled(renderCloudSea);
      }
      if ((oldStarVault !== renderStarVault || Math.abs(oldStarVaultStrength - renderStarVaultStrength) > 0.001) && typeof applyStarlitAtmosphereSettings === 'function') {
        applyStarlitAtmosphereSettings();
      }
      if (Math.abs(oldCloudRimLight - renderCloudRimLight) > 0.001 && typeof applyCloudRimLightSetting === 'function') {
        applyCloudRimLightSetting();
      }
      if (Math.abs(oldAccentLights - renderAccentLights) > 0.001 && typeof applyAccentLightingSettings === 'function') {
        applyAccentLightingSettings();
      }
      if (oldCloudStyle !== renderCloudStyle && typeof setCloudStyle === 'function') {
        setCloudStyle(renderCloudStyle);
      } else if (renderCloudStyle === 'soft'
                 && (oldCloudHeight !== renderCloudHeight || oldCloudAmount !== renderCloudAmount)
                 && typeof refreshSoftCloudsIfActive === 'function') {
        // amount/height drive the soft-cloud layout — rebuild when they move
        refreshSoftCloudsIfActive();
      }
      if (oldSurfaceLinkedMaterials !== renderSurfaceLinkedMaterials) {
        commitPartMaterialAdjustments();
        rebuildTerrainRender();
        rebuildObjectsRender();
      }
      if (oldPartMaterials !== JSON.stringify(renderPartMaterialAdjustments || {})) {
        commitPartMaterialAdjustments();
        rebuildTerrainRender();
        rebuildObjectsRender();
      }
      if (Math.abs(oldMaterialWear - renderMaterialWear) > 0.001) {
        commitPartMaterialAdjustments();
        rebuildTerrainRender();
        rebuildObjectsRender();
      }
      if (oldShowCrowns !== showCrowns) rebuildObjectsRender();
      updateGhostRenderBubble();
      applyColorFilterFallback();
      persistSettings();
      syncControls();
    }

    // Brightness / saturation / contrast affect the look by way of a CSS
    // filter applied directly to the WebGL canvas. The browser does the math
    // at compositing time, so this keeps the render path single-pass.
    function applyColorFilterFallback() {
      const el = renderer && renderer.domElement;
      if (!el) return;
      const b = renderBrightness;
      const s = renderSaturation;
      const c = renderContrast;
      // Only set the property when the value is non-trivial; saves a small
      // amount of compositor work in the all-neutral case.
      if (b === 1 && s === 1 && c === 1) {
        el.style.filter = '';
      } else {
        el.style.filter = 'brightness(' + b + ') saturate(' + s + ') contrast(' + c + ')';
      }
    }

    openBtn.addEventListener('click', () => {
      // Render settings are gated for anonymous users — prompt to sign in.
      if (!window.__loggedIn && typeof window.__openLoginModal === 'function') {
        window.__openLoginModal('Sign in to use settings');
        return;
      }
      syncControls();
      if (typeof window.__syncAiSettings === 'function') window.__syncAiSettings();
      openTinyModal(modal, closeBtn);
      setTimeout(() => {
        updateSettingsSearch({ keepActive: true });
        if (settingsSearchEl && settingsSearchEl.focus) settingsSearchEl.focus();
      }, 0);
    });
    closeBtn.addEventListener('click', () => { closeTinyModal(modal); });
    modal.addEventListener('click', e => { if (e.target === modal) closeTinyModal(modal); });
    for (const el of [shadowEl, resolutionEl, distanceEl, visibleSizeEl, brightnessEl, lightingEl, ambientFillEl, frontFillEl, sideFillEl, backFillEl, saturationEl, contrastEl, cloudsEl, cloudSpeedEl, cloudHeightEl, cloudShadowEl, planesEnabledEl, enhancedWaterEl, distantWorldsEl, cloudSeaEl, cloudSoftEl, starVaultEl, starVaultStrengthEl, cloudRimLightEl, accentLightsEl, underCloudSpreadEl, skyBlueDepthEl, skyBlueSaturationEl, distanceMistEl, backdropEl, backdropVignetteEl, pixelSizeEl, pixelDepthEdgeEl, pixelNormalEdgeEl, shaderAntialiasEl, tiltBlurEl, tiltFocusEl, ghostOpacityEl, floorOpacityEl, objectOpacityEl, voxelGapEl, voxelBevelEl, voxelTerrainEl, surfaceLinkedMaterialsEl, showCrownsEl, terrainVoxelResolutionEl, terrainTintEl, terrainTextureEl, terrainTextureScaleEl, terrainToneEl, materialTintEl, materialTextureEl, materialTextureScaleEl, materialToneEl, materialWearEl, crowdCountEl, crowdScaleEl, crowdSpeedEl, crowdBobEl, crowdSwayEl, crowdLeanEl, crowdZoneRadiusEl, crowdShowZonesEl, crowdPausedEl, crowdEnabledEl, crowdDebugEl, crowdModeEl, crowdCountLiveEl, crowdScaleLiveEl, crowdSpeedLiveEl, crowdZoneRadiusLiveEl, crowdShowZonesLiveEl, crowdShowArrowsLiveEl, crowdPausedLiveEl, crowdEnabledLiveEl]) {
      if (!el) continue;
      el.addEventListener('input', applyFromControls);
      el.addEventListener('change', applyFromControls);
    }
    if (terrainColorTargetEl) {
      terrainColorTargetEl.addEventListener('change', () => {
        if (TERRAIN_COLOR_KEYS.includes(terrainColorTargetEl.value)) {
          renderTerrainColorTarget = terrainColorTargetEl.value;
          persistSettings();
          syncControls();
        }
      });
    }
    if (materialTargetEl) {
      materialTargetEl.addEventListener('change', () => {
        if (PART_MATERIAL_GROUPS[materialTargetEl.value]) {
          renderMaterialTarget = materialTargetEl.value;
          persistSettings();
          syncControls();
        }
      });
    }
    if (terrainColorResetEl) {
      terrainColorResetEl.addEventListener('click', () => {
        delete renderTerrainMaterialAdjustments[renderTerrainColorTarget];
        commitTerrainMaterialAdjustments();
        rebuildTerrainRender();
        persistSettings();
        syncControls();
      });
    }
    if (materialResetEl) {
      materialResetEl.addEventListener('click', () => {
        delete renderPartMaterialAdjustments[renderMaterialTarget];
        commitPartMaterialAdjustments();
        rebuildTerrainRender();
        rebuildObjectsRender();
        persistSettings();
        syncControls();
      });
    }
    // Home grid size — a separate listener because it triggers a full
    // re-render rather than uniforms/material tweaks.
    if (homeGridEl) {
      homeGridEl.addEventListener('change', () => {
        const n = parseInt(homeGridEl.value, 10);
        setHomeGridSize(n);
      });
    }
    resetBtn.addEventListener('click', () => {
      setShadowQuality('balanced');
      setRenderResolutionScale(0.75);
      setRenderVisibleDistance(0);
      setRenderVisibleSize(0);
      renderBrightness = 0.80;
      renderLighting = 0.50;
      renderAmbientFill = 1.00;
      renderFrontFill = 0.10;
      renderSideFill = 0.10;
      renderBackFill = 0.10;
      applyLightingSettings();
      renderSaturation = 1.09;
      renderContrast = 1.20;
      renderCloudAmount = 0.40;
      renderCloudSpeed = 0.35;
      renderCloudHeight = 9.5;
      renderCloudShadow = 0;
      renderCloudSea = true;
      renderCloudStyle = 'soft';
      renderPlanesEnabled = false;
      if (typeof setPlanesEnabled === 'function') setPlanesEnabled(false);
      renderEnhancedWater = true;
      if (typeof refreshWaterShaderMaterials === 'function') refreshWaterShaderMaterials();
      if (landscapeEngineInstance && landscapeEngineInstance.waterMat
          && landscapeEngineInstance.waterMat.uniforms
          && landscapeEngineInstance.waterMat.uniforms.uEnhance) {
        landscapeEngineInstance.waterMat.uniforms.uEnhance.value = 1.0;
      }
      renderStarVault = true;
      renderStarVaultStrength = 0.92;
      renderCloudRimLight = 0.78;
      renderAccentLights = 0.65;
      if (typeof applyStarlitAtmosphereSettings === 'function') applyStarlitAtmosphereSettings();
      if (typeof applyCloudRimLightSetting === 'function') applyCloudRimLightSetting();
      if (typeof applyAccentLightingSettings === 'function') applyAccentLightingSettings();
      applyCloudSettings();
      if (typeof applyCloudHeight === 'function') applyCloudHeight();
      if (typeof setCloudSeaEnabled === 'function') setCloudSeaEnabled(renderCloudSea);
      if (typeof setCloudStyle === 'function') setCloudStyle(renderCloudStyle);
      renderDistanceMist = 0.28;
      applyDistanceMistSettings();
      renderBackdrop = 0.78;
      renderBackdropVignette = 0.18;
      applyBackdropSettings();
      renderPixelSize = 1;
      renderPixelDepthEdge = 0;
      renderPixelNormalEdge = 0;
      renderShaderAntialias = 0;
      renderTiltBlur = 10.5;
      renderTiltFocus = 21;
      applyTiltShiftSettings();
      renderGhostOpacity = 0;
      renderFloorOpacity = 0;
      renderObjectOpacity = 0;
      renderVoxelGap = 0;
      renderVoxelBevel = parseFloat(RENDER_DEFAULTS.voxelBevel);
      renderVoxelTerrain = true;
      renderTexturedGrass = true;
      showCrowns = false;
      renderSurfaceLinkedMaterials = true;
      renderTerrainMaterialAdjustments = {};
      renderTerrainColorTarget = 'grass';
      renderPartMaterialAdjustments = {};
      renderMaterialTarget = 'walls';
      renderMaterialWear = 0;
      if (typeof texCottageGrass !== 'undefined') {
        applySurfaceTextureDefaults();
      }
      commitTerrainMaterialAdjustments();
      commitPartMaterialAdjustments();
      customMaterialCache.clear();
      renderTerrainVoxelResolution = 'mixed';
      crowdCount = 12;
      crowdScale = 0.75;
      crowdSpeedMul = 1;
      crowdBob = 2.4;
      crowdSway = 1.4;
      crowdLean = 0.07;
      crowdZoneRadius = 0.16;
      crowdShowZones = false;
      crowdPaused = false;
      crowdDebug = true;
      crowdMode = 'wander';
      crowdShowArrows = true;
      crowdEnabled = false;
      applyCrowdSettings({ reseed: true });
      if (crowdEnabled && !crowdLayer) {
        initCrowdLayer();
      }
      renderAutoExpand = false;
      const autoExpandEl = document.getElementById('minimap-autoexpand');
      if (autoExpandEl) autoExpandEl.checked = false;
      if (voxelTerrainEl) voxelTerrainEl.checked = true;
      if (terrainVoxelResolutionEl) terrainVoxelResolutionEl.value = renderTerrainVoxelResolution;
      rebuildTerrainRender();
      rebuildObjectsRender();
      scheduleVoxelStampRefresh();
      updateGhostRenderBubble();
      applyColorFilterFallback();
      persistSettings();
      syncControls();
    });
    if (crowdDebugLiveEl) crowdDebugLiveEl.addEventListener('click', () => {
      crowdDebug = !crowdDebug;
      applyCrowdSettings();
      syncControls();
    });
    if (crowdReseedLiveEl) crowdReseedLiveEl.addEventListener('click', () => {
      applyCrowdSettings({ reseed: true });
      syncControls();
    });
    if (crowdReseedEl) crowdReseedEl.addEventListener('click', () => {
      applyCrowdSettings({ reseed: true });
      syncControls();
    });
    // Planet underlay live on/off — acts immediately so the user can kill the
    // per-frame chunk streaming without re-opening the Generate panel.
    const planetUnderlayEl = document.getElementById('render-planet-underlay-active');
    if (planetUnderlayEl) {
      planetUnderlayEl.addEventListener('change', () => {
        if (planetUnderlayEl.checked) {
          if (lastPlanetLandscapeConfig) initPlanetLandscape(lastPlanetLandscapeConfig);
          if (status) status.textContent = isPlanetLandscapeActive() ? 'Planet underlay re-enabled' : 'No saved planet to restore — use the Generate panel';
        } else {
          disposePlanetLandscape();
          if (status) status.textContent = 'Planet underlay disabled — chunks unloaded';
        }
        syncControls();
      });
    }
    syncControls();
    applyColorFilterFallback();
  }

  function selectedBoardObjectTarget() {
    const objects = selectedBoardObjectTargets();
    return objects.length === 1 ? objects[0] : null;
  }

  function selectedBoardObjectTargets() {
    const sel = window.__tinyworldSelection;
    if (!sel || !sel.worldCoords) return [];
    const coords = sel.worldCoords();
    const byKey = new Map();
    coords.forEach(({ x, z }) => {
      const cell = getWorldCell(x, z);
      if (!cell || !cell.kind) return;
      let tx = x, tz = z, targetCell = cell;
      if (cell.kind === 'house' && !cell.buildingType) {
        try {
          const cluster = findHouseCluster(x, z);
          if (cluster && Number.isInteger(cluster.anchorX) && Number.isInteger(cluster.anchorZ)) {
            tx = cluster.anchorX;
            tz = cluster.anchorZ;
            targetCell = getWorldCell(tx, tz);
          }
        } catch (_) {}
      }
      byKey.set(tx + ',' + tz, { x: tx, z: tz, cell: targetCell || cell });
    });
    return Array.from(byKey.values());
  }

  function selectedBoardObjectLabel(target) {
    if (!target || !target.cell) return 'selected object';
    const cell = target.cell;
    if (cell.kind === 'voxel-build') {
      const stamp = getVoxelBuildStamp(cell.appearance && cell.appearance.voxelBuildId);
      return stamp ? stamp.name : 'Voxel build';
    }
    if (cell.kind === 'model-stamp') {
      const asset = getModelStamp(cell.appearance && cell.appearance.modelStampId);
      return asset ? asset.label : 'Model stamp';
    }
    if (cell.kind === 'house') {
      const bt = cell.buildingType || 'cottage';
      return bt.charAt(0).toUpperCase() + bt.slice(1) + ' house';
    }
    return cell.kind.charAt(0).toUpperCase() + cell.kind.slice(1);
  }

  function isObjectScaleEditableCell(cell) {
    return !!(cell && cell.kind);
  }

  function transformLimitsForCell(cell) {
    return {
      xz: 0.48,
      yMin: -0.75,
      yMax: 2.5,
    };
  }

  function updateSelectedBoardObject(target, patch) {
    if (!target || !target.cell) return false;
    const cell = getWorldCell(target.x, target.z);
    if (!cell || !cell.kind) return false;
    setCell(target.x, target.z, Object.assign({}, cell, patch || {}, {
      animate: false,
      impactDust: false,
    }));
    if (window.__tinyworldSelection) window.__tinyworldSelection.materialize();
    notifySelectionChanged();
    return true;
  }

  function updateSelectedBoardObjects(patchForTarget) {
    const targets = selectedBoardObjectTargets();
    if (!targets.length) return false;
    let changed = false;
    for (const target of targets) {
      const patch = typeof patchForTarget === 'function' ? patchForTarget(target) : patchForTarget;
      if (patch) changed = updateSelectedBoardObject(target, patch) || changed;
    }
    if (changed && window.__tinyworldSelection) window.__tinyworldSelection.materialize();
    if (changed) notifySelectionChanged();
    return changed;
  }

  function scaleSelectedBoardObject(amount, axis) {
    return updateSelectedBoardObjects(target => {
      if (!isObjectScaleEditableCell(target.cell)) return null;
      const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
      const key = axis === 'x' ? 'scaleX' : axis === 'y' ? 'scaleY' : axis === 'z' ? 'scaleZ' : 'objectScale';
      if (amount === 'reset') {
        delete appearance[key];
      } else {
        const current = appearance[key] || 1;
        const min = key === 'objectScale' ? 0.25 : 0.15;
        const max = 24; // unlocked — matches normalizeAppearance (04)
        appearance[key] = Math.max(min, Math.min(max, current * amount));
        if (Math.abs(appearance[key] - 1) < 0.001) delete appearance[key];
      }
      return { appearance: Object.keys(appearance).length ? appearance : null };
    });
  }

  function moveSelectedBoardObject(dx = 0, dy = 0, dz = 0) {
    return updateSelectedBoardObjects(target => {
      const limits = transformLimitsForCell(target.cell);
      return {
        offsetX: Math.max(-limits.xz, Math.min(limits.xz, (target.cell.offsetX || 0) + dx)),
        offsetY: Math.max(limits.yMin, Math.min(limits.yMax, (target.cell.offsetY || 0) + dy)),
        offsetZ: Math.max(-limits.xz, Math.min(limits.xz, (target.cell.offsetZ || 0) + dz)),
      };
    });
  }

  function centerSelectedBoardObjectOffset() {
    return updateSelectedBoardObjects(() => ({
      offsetX: 0,
      offsetY: 0,
      offsetZ: 0,
    }));
  }

  function resetSelectedBoardObjectTransform() {
    return updateSelectedBoardObjects(target => {
      const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
      delete appearance.objectScale;
      delete appearance.scaleX;
      delete appearance.scaleY;
      delete appearance.scaleZ;
      return {
        rotationY: 0,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        appearance: Object.keys(appearance).length ? appearance : null,
      };
    });
  }

  // Absolute setters for the inspector's Precise controls. Unlike the relative
  // move/scale helpers above, these set the value directly (computed from a
  // numeric input) while honoring the same clamps.
  function setSelectedBoardObjectOffsetAxis(axis, value) {
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    return updateSelectedBoardObjects(target => {
      const limits = transformLimitsForCell(target.cell);
      if (axis === 'x') return { offsetX: Math.max(-limits.xz, Math.min(limits.xz, v)) };
      if (axis === 'y') return { offsetY: Math.max(limits.yMin, Math.min(limits.yMax, v)) };
      if (axis === 'z') return { offsetZ: Math.max(-limits.xz, Math.min(limits.xz, v)) };
      return null;
    });
  }

  function setSelectedBoardObjectRotation(rad) {
    const v = Number(rad);
    if (!Number.isFinite(v)) return false;
    return updateSelectedBoardObjects(() => ({ rotationY: v }));
  }

  function setSelectedBoardObjectScaleValue(value, axis) {
    const v = Number(value);
    if (!Number.isFinite(v)) return false;
    return updateSelectedBoardObjects(target => {
      if (!isObjectScaleEditableCell(target.cell)) return null;
      const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
      const key = axis === 'x' ? 'scaleX' : axis === 'y' ? 'scaleY' : axis === 'z' ? 'scaleZ' : 'objectScale';
      const min = key === 'objectScale' ? 0.25 : 0.15;
      const max = 24; // unlocked — matches normalizeAppearance (04)
      appearance[key] = Math.max(min, Math.min(max, v));
      if (Math.abs(appearance[key] - 1) < 0.001) delete appearance[key];
      return { appearance: Object.keys(appearance).length ? appearance : null };
    });
  }

  function seedVoxelBuildForSelectedObject(target) {
    if (!target || !target.cell || !target.cell.kind) return null;
    const cell = target.cell;
    if (cell.kind === 'voxel-build') {
      const existing = getVoxelBuildStamp(cell.appearance && cell.appearance.voxelBuildId);
      if (existing) {
        return Object.assign({}, existing, {
          sourceCell: cloneCellIntent(cell),
          sourceCoord: { x: target.x, z: target.z },
        });
      }
    }
    if (cell.kind === 'house') {
      const seed = builderStylePartsForSelectedObject(target);
      const stamp = seed && normalizeVoxelBuildStamp({
        id: 'selected-' + seed.stamp + '-' + Date.now().toString(36),
        name: selectedBoardObjectLabel(target),
        customParts: seed.customParts,
        footprint: selectedBuildingRenderFootprint(seed.stamp),
        custom: true,
      }, selectedBoardObjectLabel(target));
      if (stamp) {
        return Object.assign({}, stamp, {
          sourceCell: cloneCellIntent(cell),
          sourceCoord: { x: target.x, z: target.z },
        });
      }
    }
    // Neutral, non-themed seeds — never default to Japanese (machiya / sakura /
    // torii / bamboo) styling. The AI enhances FROM these, so the seed sets the
    // look; keep it culturally neutral unless the user explicitly asks otherwise.
    let seedId = 'watchtower';
    if (cell.kind === 'house') {
      if (cell.buildingType === 'tower' || cell.buildingType === 'skyscraper') seedId = 'watchtower';
      else if (cell.buildingType === 'turret') seedId = 'watchtower';
      else seedId = 'watchtower';
    } else if (cell.kind === 'tree' || cell.kind === 'flower' || cell.kind === 'bush') {
      seedId = 'oak-grove-build';
    } else if (cell.kind === 'rock') {
      seedId = 'rock-outcrop-build';
    } else if (cell.kind === 'fence' || cell.kind === 'bridge') {
      seedId = 'fence-build';
    } else if (CROP_KINDS.has(cell.kind) || cell.kind === 'tuft') {
      seedId = 'crop-patch-build';
    }
    const base = getVoxelBuildStamp(seedId) || getVoxelBuildStamp('oak-grove-build') || getVoxelBuildStamp('watchtower');
    if (!base) return null;
    return Object.assign({}, base, {
      id: 'selected-' + cell.kind + '-' + Date.now().toString(36),
      name: selectedBoardObjectLabel(target),
      sourceCell: cloneCellIntent(cell),
      sourceCoord: { x: target.x, z: target.z },
    });
  }

  function selectedBuildingStampId(cell) {
    if (!cell || cell.kind !== 'house') return null;
    if (cell.buildingType === 'tower' || cell.buildingType === 'skyscraper') return 'tower';
    if (cell.buildingType === 'manor') return 'manor';
    if (cell.buildingType === 'turret') return 'tower';
    return 'house';
  }

  function selectedBuildingRenderFootprint(stamp) {
    if (stamp === 'manor') return 2.05;
    if (stamp === 'pagoda') return 2.15;
    if (stamp === 'tower') return 1.55;
    return 1.72;
  }

  function part(id, kind, material, size, pos, scale = [1, 1, 1], segments) {
    const out = { id, kind, material, size, pos, scale };
    if (segments) out.segments = segments;
    return out;
  }

  function builderStylePartsForSelectedObject(target) {
    if (!target || !target.cell || target.cell.kind !== 'house') return null;
    const stamp = selectedBuildingStampId(target.cell);
    const parts = [];
    if (stamp === 'tower') {
      parts.push(
        part('base', 'box', 'stone', [1.45, 0.34, 1.45], [0, 0.17, 0]),
        part('shaft', 'box', 'cream', [1.05, 2.2, 1.05], [0, 1.42, 0]),
        part('frame-front', 'box', 'woodDark', [1.12, 1.9, 0.12], [0, 1.36, -0.59]),
        part('window', 'box', 'white', [0.34, 0.34, 0.08], [0, 1.55, -0.66]),
        part('balcony', 'box', 'wood', [1.6, 0.18, 1.6], [0, 2.62, 0]),
        part('roof', 'box', 'roof', [1.5, 0.34, 1.5], [0, 2.98, 0]),
        part('roof-top', 'box', 'roofEdge', [0.9, 0.24, 0.9], [0, 3.34, 0]),
        part('finial', 'box', 'gold', [0.32, 0.32, 0.32], [0, 3.68, 0]),
      );
    } else if (stamp === 'manor') {
      parts.push(
        part('base', 'box', 'white', [2.4, 0.22, 1.65], [0, 0.11, 0]),
        part('body', 'box', 'red', [2.0, 1.05, 1.35], [0, 0.74, 0]),
        part('body-shadow', 'box', 'woodDark', [0.08, 0.95, 1.36], [-1.04, 0.76, 0]),
        part('body-shadow-right', 'box', 'woodDark', [0.08, 0.95, 1.36], [1.04, 0.76, 0]),
        part('cornice', 'box', 'white', [2.12, 0.12, 1.44], [0, 1.32, 0]),
        part('roof-slab', 'box', 'roof', [2.25, 0.28, 1.55], [0, 1.55, 0]),
        part('roof-cap', 'box', 'roofEdge', [1.75, 0.18, 1.1], [0, 1.78, 0]),
        part('roof-ridge', 'box', 'roofEdge', [1.25, 0.12, 0.14], [0, 1.95, 0]),
        part('front-step', 'box', 'white', [1.05, 0.12, 0.35], [0, 0.12, -0.96]),
        part('threshold', 'box', 'white', [0.46, 0.08, 0.18], [0, 0.22, -0.76]),
        part('portico-top', 'box', 'white', [0.95, 0.16, 0.34], [0, 0.92, -0.73]),
        part('portico-left', 'cylinder', 'white', [0.11, 0.82, 0.11], [-0.31, 0.52, -0.86], [1, 1, 1], 8),
        part('portico-right', 'cylinder', 'white', [0.11, 0.82, 0.11], [0.31, 0.52, -0.86], [1, 1, 1], 8),
        part('portico-left-pilaster', 'box', 'white', [0.13, 0.82, 0.08], [-0.31, 0.52, -0.69]),
        part('portico-right-pilaster', 'box', 'white', [0.13, 0.82, 0.08], [0.31, 0.52, -0.69]),
        part('door', 'box', 'woodDark', [0.34, 0.58, 0.08], [0, 0.52, -0.71]),
        part('door-knob', 'box', 'gold', [0.05, 0.05, 0.04], [0.1, 0.52, -0.77]),
      );
      for (const x of [-0.72, 0.72]) {
        for (const y of [0.56, 0.98]) {
          parts.push(
            part(`front-window-${x}-${y}`, 'box', 'white', [0.28, 0.24, 0.07], [x, y, -0.72]),
            part(`front-window-glass-${x}-${y}`, 'box', 'waterDark', [0.18, 0.16, 0.08], [x, y, -0.77]),
          );
        }
      }
      for (const x of [-0.24, 0.24]) {
        parts.push(
          part(`entry-window-${x}`, 'box', 'white', [0.22, 0.22, 0.07], [x, 0.98, -0.72]),
          part(`entry-window-glass-${x}`, 'box', 'waterDark', [0.14, 0.14, 0.08], [x, 0.98, -0.77]),
        );
      }
    } else if (stamp === 'pagoda') {
      parts.push(part('stone-base', 'box', 'stone', [2.25, 0.4, 2.0], [0, 0.2, 0]));
      for (let i = 0; i < 3; i++) {
        const y = 0.65 + i * 0.9;
        const w = 1.6 - i * 0.26;
        parts.push(
          part(`floor-${i}`, 'box', i % 2 ? 'cream' : 'red', [w, 0.55, w], [0, y, 0]),
          part(`roof-${i}`, 'box', 'roof', [w + 0.6, 0.22, w + 0.6], [0, y + 0.42, 0]),
          part(`roof-cap-${i}`, 'box', 'roofEdge', [w + 0.25, 0.14, w + 0.25], [0, y + 0.63, 0]),
        );
        for (const sx of [-1, 1]) {
          for (const sz of [-1, 1]) {
            parts.push(part(`gold-${i}-${sx}-${sz}`, 'box', 'gold', [0.16, 0.16, 0.16], [sx * (w * 0.5 + 0.22), y + 0.62, sz * (w * 0.5 + 0.22)]));
          }
        }
      }
      parts.push(part('spire', 'cylinder', 'gold', [0.16, 0.75, 0.16], [0, 3.75, 0], [1, 1, 1], 6));
    } else {
      parts.push(
        part('base', 'box', 'stone', [2.2, 0.35, 1.8], [0, 0.18, 0]),
        part('body', 'box', 'cream', [1.8, 1.1, 1.35], [0, 0.9, 0]),
        part('front-beam', 'box', 'woodDark', [1.95, 0.15, 0.12], [0, 1.25, -0.74]),
        part('door', 'box', 'wood', [0.42, 0.72, 0.08], [0, 0.72, -0.72]),
        part('window-left', 'box', 'white', [0.28, 0.28, 0.08], [-0.55, 0.9, -0.72]),
        part('window-right', 'box', 'white', [0.28, 0.28, 0.08], [0.55, 0.9, -0.72]),
        part('roof-slab', 'box', 'roof', [2.35, 0.28, 1.85], [0, 1.55, 0]),
        part('roof-cap', 'box', 'roofEdge', [2.0, 0.2, 1.5], [0, 1.82, 0]),
        part('lantern-left', 'box', 'gold', [0.18, 0.24, 0.1], [-0.82, 0.74, -0.78]),
        part('lantern-right', 'box', 'gold', [0.18, 0.24, 0.1], [0.82, 0.74, -0.78]),
      );
    }
    return {
      stamp,
      label: selectedBoardObjectLabel(target),
      customParts: normalizeVoxelCustomParts(parts),
    };
  }

  function compactPartsForAi(parts) {
    const buckets = new Map();
    const cableParts = [];
    normalizeVoxelCustomParts(parts).forEach(part => {
      if (part.kind === 'cable') {
        cableParts.push({
          id: part.id,
          kind: part.kind,
          material: part.material,
          from: part.from,
          to: part.to,
          radius: part.radius,
          sag: part.sag || 0,
          segments: part.segments || 24,
          size: part.size,
          pos: part.pos,
          scale: part.scale,
        });
        return;
      }
      const baseId = String(part.id || 'part').replace(/-v-\d+-\d+-\d+$/, '').replace(/-\d+$/, '');
      const key = `${baseId}|${part.kind}|${part.material}`;
      const bucket = buckets.get(key) || {
        id: baseId,
        kind: part.kind,
        material: part.material,
        count: 0,
        min: [Infinity, Infinity, Infinity],
        max: [-Infinity, -Infinity, -Infinity],
        sampleSize: part.size,
      };
      bucket.count += 1;
      for (let axis = 0; axis < 3; axis++) {
        const half = (part.size[axis] || 0) * (part.scale[axis] || 1) * 0.5;
        bucket.min[axis] = Math.min(bucket.min[axis], (part.pos[axis] || 0) - half);
        bucket.max[axis] = Math.max(bucket.max[axis], (part.pos[axis] || 0) + half);
      }
      buckets.set(key, bucket);
    });
    const compact = Array.from(buckets.values()).slice(0, Math.max(0, 120 - cableParts.length)).map(bucket => ({
      id: bucket.id,
      kind: bucket.kind,
      material: bucket.material,
      count: bucket.count,
      size: bucket.max.map((value, axis) => Number((value - bucket.min[axis]).toFixed(3))),
      pos: bucket.max.map((value, axis) => Number(((value + bucket.min[axis]) * 0.5).toFixed(3))),
      sampleSize: bucket.sampleSize,
    }));
    return cableParts.slice(0, 40).concat(compact);
  }

  function shouldEnhanceSelectedObjectPrompt(text) {
    return /\b(ai\s*)?(enhance|reinterpret|upscale|detail|detailed|refine|upgrade|rebuild|remake|redesign|voxel|stamp|create|build|make|design|generate|turn|convert|transform|change)\b.*\b(it|this|into|to|a|an|as)\b/i.test(String(text || '')) ||
           /\b(enhance|reinterpret|upscale|detail|refine|upgrade|rebuild|voxel|stamp|make it|turn it|change it|convert it)\b/i.test(String(text || ''));
  }

  function voxelBuildBounds(voxels) {
    if (!Array.isArray(voxels) || !voxels.length) return null;
    const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
    for (const v of voxels) {
      b.minX = Math.min(b.minX, v.x); b.maxX = Math.max(b.maxX, v.x);
      b.minY = Math.min(b.minY, v.y); b.maxY = Math.max(b.maxY, v.y);
      b.minZ = Math.min(b.minZ, v.z); b.maxZ = Math.max(b.maxZ, v.z);
    }
    return b;
  }

  function wantsCreativeVoxelModel(userInstruction) {
    const text = String(userInstruction || '').trim();
    if (!text) return false;
    const transform = /\b(turn|convert|transform|change|reinterpret|redesign|remake)\b[\s\S]{0,90}\b(into|to|as)\b/i;
    const create = /\b(make|build|create|generate|design)\b/i;
    const bespokeObject = /\b(airship|hot.?air|hot-air|balloon|zeppelin|spaceship|space\s*ship|rocket|robot|vehicle|car|truck|train|plane|airplane|aircraft|boat|ship|submarine|windmill|watermill|lighthouse|fountain|statue|monument|greenhouse|glasshouse|dome|observatory|market\s*stall|stall|sign|portal|gatehouse|factory|workshop|crane|engine|propeller|bridge|tower)\b/i;
    return transform.test(text) || (create.test(text) && bespokeObject.test(text));
  }

  function allowedVoxelBuildBounds(stamp, profile) {
    const b = voxelBuildBounds(stamp && stamp.voxels);
    if (!b) return null;
    const kind = profile && profile.selectedKind;
    if (profile && profile.creativeRebuild) {
      const spanX = Math.max(1, b.maxX - b.minX + 1);
      const spanZ = Math.max(1, b.maxZ - b.minZ + 1);
      const margin = Math.max(5, Math.ceil(Math.max(spanX, spanZ) * 0.8));
      return {
        minX: b.minX - margin,
        maxX: b.maxX + margin,
        minY: 0,
        maxY: Math.max(b.maxY + 12, 22),
        minZ: b.minZ - margin,
        maxZ: b.maxZ + margin,
      };
    }
    const margin = kind === 'tree' ? 3 : kind === 'rock' ? 1 : 2;
    return {
      minX: b.minX - margin,
      maxX: b.maxX + margin,
      minY: 0,
      maxY: b.maxY + (kind === 'tree' ? 8 : 5),
      minZ: b.minZ - margin,
      maxZ: b.maxZ + margin,
    };
  }

  function filterVoxelsToBounds(voxels, bounds) {
    if (!bounds || !Array.isArray(voxels)) return Array.isArray(voxels) ? voxels : [];
    return voxels.filter(v =>
      v.x >= bounds.minX && v.x <= bounds.maxX &&
      v.y >= bounds.minY && v.y <= bounds.maxY &&
      v.z >= bounds.minZ && v.z <= bounds.maxZ
    );
  }

  function enhancedFootprintForStamp(stamp, profile) {
    const kind = profile && profile.selectedKind;
    if (profile && profile.creativeRebuild) return profile.renderFootprint || 2.2;
    if (kind === 'rock') return 0.86;
    if (kind === 'tree' || kind === 'bush' || kind === 'flower') return 1.0;
    if (kind === 'house' || kind === 'voxel-build') return 0.96;
    return Math.min(stamp.footprint || 1, 1);
  }

  function customPartsEnhanceSchema(allowedMaterials) {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['notes', 'customParts'],
      properties: {
        notes: { type: 'string' },
        customParts: {
          type: 'array',
          maxItems: 180,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['id', 'kind', 'material', 'size', 'pos', 'scale'],
            properties: {
              id: { type: 'string' },
              kind: { type: 'string', enum: ['box', 'cylinder', 'cone', 'sphere', 'ellipsoid', 'cable'] },
              material: { type: 'string', enum: allowedMaterials },
              size: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'number' },
              },
              pos: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'number' },
              },
              scale: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'number' },
              },
              from: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'number' },
              },
              to: {
                type: 'array',
                minItems: 3,
                maxItems: 3,
                items: { type: 'number' },
              },
              radius: { type: 'number', minimum: 0.006, maximum: 0.3 },
              sag: { type: 'number', minimum: -8, maximum: 8 },
              segments: { type: 'integer', minimum: 4, maximum: 64 },
              verticalSegments: { type: 'integer', minimum: 3, maximum: 24 },
              phiStart: { type: 'number', minimum: 0, maximum: 6.28319 },
              phiLength: { type: 'number', minimum: 0.05, maximum: 6.28319 },
              thetaStart: { type: 'number', minimum: 0, maximum: 3.14159 },
              thetaLength: { type: 'number', minimum: 0.05, maximum: 3.14159 },
            },
          },
        },
      },
    };
  }

  function postAiDebugLog(entry) {
    if (!/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) return;
    fetch('/api/ai-debug-log', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(entry),
    }).catch(() => {});
  }

  function selectedVoxelEnhanceProfile(stamp, userInstruction) {
    const sourceCell = stamp && stamp.sourceCell;
    const kind = sourceCell && sourceCell.kind ? sourceCell.kind : 'voxel-build';
    const text = (String(userInstruction || '') + ' ' + String((stamp && (stamp.name || stamp.id)) || '')).toLowerCase();
    const explicitJapanese = /\b(japanese|japan|pagoda|shrine|temple|torii|sakura|zen)\b/i.test(text);
    const creativeRebuild = wantsCreativeVoxelModel(userInstruction);
    const base = {
      selectedKind: kind,
      selectedLabel: stamp && stamp.name ? stamp.name : 'selected object',
      creativeRebuild,
      renderFootprint: creativeRebuild && /\b(airship|hot.?air|hot-air|balloon|zeppelin|spaceship|space\s*ship|ship|boat|submarine|train|greenhouse|glasshouse|dome|factory|workshop)\b/i.test(text) ? 2.2 : (/\b(bridge|walkway|deck|platform)\b/i.test(text) ? 1.2 : 1.8),
      style: creativeRebuild
        ? 'Tiny World creative low-poly voxel model, colorful semantic parts, strong silhouette, build the requested object from scratch'
        : 'Tiny World low-poly voxel diorama, readable chunky blocks, preserve the selected object category',
      requirements: [
        creativeRebuild
          ? 'The user instruction overrides the selected source kind. Use the source only as a scale/placement seed and build the requested object freely.'
          : 'Use the source voxels and selected object intent as the contract for what this is.',
        creativeRebuild
          ? 'Create semantic low-poly components for the requested object: body, frame, top/canopy, openings/windows, trim, supports, machinery, and accent details as appropriate.'
          : 'Preserve the selected object category, footprint, scale, and silhouette language unless the user explicitly asks to change them.',
        'Do not introduce a Japanese garden, shrine, temple, pagoda, or sakura influence unless the selected object or user instruction explicitly asks for it.',
        'Use many small voxels and visible silhouette breaks instead of a few broad slabs.',
        'Keep every returned voxel inside allowedBounds and centered on the selected tile.',
        'Do not create floating orbit rings, detached columns, detached symbols, or unsupported chunks.',
        'Avoid filling the bounding box solid. Omit hidden interior voxels when they do not affect the visible silhouette.',
        'Use varied local colors and accents. Do not default to gray stone/rock unless the requested object is actually stone.',
      ],
    };
    if (creativeRebuild) {
      base.seedId = 'creative-custom-model';
      base.requirements.push(
        'Native TinyWorld pieces are allowed only when they are semantically part of the object or surrounding scene; do not use rocks/houses as substitutes for a glass, metal, fabric, or wood model.',
        'For glass greenhouses or domes, use colored glass panes plus metal/steel/brass frame ribs. For vehicles or airships, use hull, engines/propellers, windows, rails, ladders, cables, and fabric/canvas parts where relevant.',
      );
    } else if (kind === 'rock') {
      base.seedId = 'rock-outcrop-build';
      base.style = 'Natural low-poly voxel rock outcrop, irregular stone chunks, moss and highlights only where useful';
      base.requirements.push(
        'This is a rock or boulder. Keep it geological, irregular, grounded, and compact.',
        'Add fractured stone facets, stepped ledges, small pebbles, cracks, moss patches, and highlight stones.',
        'Do not add roofs, windows, doors, lanterns, fences, garden gates, petals, trees, or building trim.',
      );
    } else if (kind === 'tree' || kind === 'bush' || kind === 'flower') {
      base.seedId = 'oak-grove-build';
      base.style = 'Organic low-poly voxel foliage prop, clustered leaves, branch structure, readable chunky blocks';
      base.requirements.push(
        'This is foliage. Keep the clustered leaf canopy and trunk/branch relationship.',
        'Add layered leaf clumps, branch forks, roots, small ground details, and varied leaf tones.',
        'Do not convert it into a building, gate, shrine, or decorative garden structure.',
      );
    } else if (kind === 'house' || kind === 'voxel-build') {
      base.seedId = stamp && stamp.id ? stamp.id : 'building';
      base.style = explicitJapanese
        ? 'Japanese-influenced low-poly voxel building, crisp stepped roof, trim, windows, base details'
        : 'Tiny World low-poly voxel building, crisp stepped roof, trim, windows, door, base details';
      base.requirements.push(
        'This is a building. Keep roof, walls, windows, door, base, and trim visually distinct.',
        explicitJapanese
          ? 'Japanese architectural influence is allowed because the prompt asks for it.'
          : 'Use the existing building language; do not force Japanese architecture.',
        'Add higher-resolution eaves, roof ridges, window frames, door detail, steps, and foundation blocks.',
      );
    } else if (kind === 'fence' || kind === 'bridge') {
      base.style = 'Tiny World low-poly constructed prop, rails, posts, crossbeams, plank or stone details';
      base.requirements.push(
        'This is a constructed prop. Keep posts, rails, planks, supports, and crossings readable.',
        'Do not turn it into a building or landscape scene.',
      );
    } else if (CROP_KINDS.has(kind) || kind === 'tuft') {
      base.style = 'Tiny World low-poly farm or ground-detail prop, small plant voxels, rows, stems, leaves';
      base.requirements.push(
        'This is a farm or ground-detail prop. Keep plants, stems, rows, and soil/base detail readable.',
        'Do not turn it into a garden building, gate, or tree unless requested.',
      );
    }
    return base;
  }

  function selectedCustomPartsStyle(seed, instruction, creativeRebuild) {
    if (creativeRebuild) return 'Tiny World creative low-poly custom object, colorful semantic materials, strong silhouette, build the requested object from scratch';
    if (seed && seed.stamp === 'manor') return 'Tiny World Georgian manor house, red brick walls, slate roof, white trim, portico columns, sash windows, large readable manor render with small detail parts';
    if (seed && seed.stamp === 'tower') return 'Tiny World stone tower, readable vertical render with small crenellation, window, roof cap, and door parts';
    if (seed && seed.stamp === 'pagoda') return 'Tiny World pagoda building, tiered roof, readable render with small trim parts';
    const text = (String(instruction || '') + ' ' + String((seed && (seed.label || seed.name || seed.id)) || '')).toLowerCase();
    if (/\b(hot.?air|hot-air|balloon|airship|zeppelin)\b/.test(text)) return 'Tiny World low-poly hot-air balloon or airship, colorful fabric panels, basket or hull, frame, cable rigging, mooring-style connections, readable toy scale';
    if (/\b(bridge|walkway|deck|platform|pier|dock)\b/.test(text)) return 'Tiny World compact low-poly bridge or walkway, stone/wood deck, side rails, anchors, supports, fitted to one tile unless explicitly larger';
    if (seed && seed.isCustomPartsSource) return 'Tiny World low-poly custom voxel object, preserve the selected object identity while increasing semantic part detail';
    return 'Tiny World low-poly house, readable roof, walls, windows, door, trim, larger render with small detail parts';
  }

  function selectedCustomPartsFootprint(seed, instruction, creativeRebuild) {
    const text = (String(instruction || '') + ' ' + String((seed && (seed.label || seed.name || seed.id)) || '')).toLowerCase();
    if (creativeRebuild) {
      if (/\b(bridge|walkway|deck|platform|pier|dock)\b/.test(text)) return 1.2;
      if (/\b(airship|hot.?air|hot-air|balloon|zeppelin|spaceship|space\s*ship|ship|boat|submarine|train|greenhouse|glasshouse|dome|factory|workshop)\b/i.test(text)) return 1.8;
      return 1.45;
    }
    if (seed && Number.isFinite(seed.footprint)) return Math.max(0.6, Math.min(3.2, seed.footprint));
    return selectedBuildingRenderFootprint(seed && seed.stamp);
  }

  // Latest-wins controllers for object AI generation flows.
  let aiCustomPartsCtrl = null;
  let aiVoxelBuildCtrl = null;

  async function enhanceSelectedCustomPartsObject(target, userInstruction, seed, opts = {}) {
    if (!seed || !Array.isArray(seed.customParts) || !seed.customParts.length) return null;
    if (aiCustomPartsCtrl) aiCustomPartsCtrl.abort();
    const _cpCtrl = new AbortController();
    aiCustomPartsCtrl = _cpCtrl;
    const ai = getAIProviderState();
    const provider = ai.provider || 'openai';
    const def = AI_DEFAULTS[provider] || AI_DEFAULTS.openai;
    const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    const allowedMaterials = Object.keys(VOXEL_PART_COLORS);
    const sourceParts = compactPartsForAi(seed.customParts);
    const sourceBounds = customPartsBounds(seed.customParts);
    const model = textModelForGeneration(provider, ai.model);
    const instruction = String(userInstruction || '').trim() || (seed.isCustomPartsSource ? 'Enhance this selected custom object as a richer low-poly voxel model.' : 'Enhance this selected building as a richer low-poly voxel model.');
    const creativeRebuild = wantsCreativeVoxelModel(instruction);
    const buildingStyle = selectedCustomPartsStyle(seed, instruction, creativeRebuild);
    const renderFootprint = selectedCustomPartsFootprint(seed, instruction, creativeRebuild);
    const allowedBounds = sourceBounds ? (creativeRebuild ? {
      minX: sourceBounds.minX - 2.5,
      maxX: sourceBounds.maxX + 2.5,
      minY: 0,
      maxY: Math.max(sourceBounds.maxY + 3.5, 5.5),
      minZ: sourceBounds.minZ - 2.5,
      maxZ: sourceBounds.maxZ + 2.5,
    } : {
      minX: sourceBounds.minX - 0.15,
      maxX: sourceBounds.maxX + 0.15,
      minY: 0,
      maxY: sourceBounds.maxY + 0.75,
      minZ: sourceBounds.minZ - 0.15,
      maxZ: sourceBounds.maxZ + 0.15,
    }) : null;
    const payload = {
      model,
      reasoningEffort: 'low',
      reasoningSummary: 'off',
      textVerbosity: 'low',
      maxOutputTokens: 12000,
      allowedMaterials,
      creativeRebuild,
      selectedObject: {
        id: target.cell.kind + '-' + target.x + '-' + target.z,
        stamp: seed.stamp || seed.id || 'custom-parts',
        label: seed.label,
        position: [target.x, 0, target.z],
        rotation: target.cell.rotationY || 0,
        scale: [1, 1, 1],
      },
      desiredScale: [1, 1, 1],
      style: buildingStyle,
      instruction,
      renderFootprint,
      sourceParts,
      sourceCustomParts: seed.customParts,
      sourceBounds,
      allowedBounds,
      imageDataUrl: opts.imageDataUrl || null,
    };
    postAiDebugLog({
      kind: 'selected-building-parts-before',
      instruction,
      target: { x: target.x, z: target.z, label: seed.label },
      beforeCell: cloneCellIntent(target.cell),
      payload,
    });
    let result = null;
    const useLocalEndpoint = isLocalHost && (provider === 'openai' || !ai.key);
    if (useLocalEndpoint) {
      const r = await fetch('/api/reinterpret-stamp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(Object.assign({}, payload, {
          model: provider === 'openai' ? model : AI_DEFAULTS.openai.model,
        })),
      });
      const text = await r.text();
      try { result = text ? JSON.parse(text) : null; } catch (_) {}
      if (!r.ok || !result || !result.ok) throw new Error((result && result.error) || text.slice(0, 180) || 'AI reinterpret failed');
    } else {
      if (!ai.key) throw new Error('AI key missing');
      const schema = customPartsEnhanceSchema(allowedMaterials);
      const system = [
        'You generate geometry for a Three.js voxel stamp builder. You CAN create brand-new 3D objects from scratch, not just re-arrange existing parts.',
        'Return ONLY valid JSON, no markdown.',
        'The JSON shape must be {"customParts":[...], "notes":"short optional note"}.',
        'Use customParts with box/cylinder/cone/sphere/ellipsoid/cable, material, size [x,y,z], pos [x,y,z], scale [1,1,1].',
        'For ropes, tethers, rigging, balloon basket lines, or mooring-style connections use kind:"cable" with from [x,y,z], to [x,y,z], radius, sag, and segments. Cable parts must still include size/pos/scale for schema compatibility.',
        'For hot-air balloon envelopes, domes, rounded tanks, and canopies use sphere/ellipsoid, not a box. A hot-air balloon must have a rounded envelope with colored curved fabric panel bands plus a smaller basket and cable connections.',
        'For colored balloon panels, use ellipsoid slices with phiStart/phiLength (and a slightly larger size if layered over a base envelope). Do not use flat rectangular side plates for the envelope colors.',
        'Available material names: ' + allowedMaterials.join(', ') + '.',
        creativeRebuild
          ? 'The user is asking for a new bespoke low-poly model. Build THAT requested object freely — invent its shape, parts, silhouette, colors, and materials. Do not preserve the selected source type.'
          : 'If the user asks for a new or different object, build THAT object freely — invent its shape, parts, and silhouette (you may change type entirely). If they only ask to enhance, preserve the selected object identity.',
        creativeRebuild
          ? 'Use the selected object only as a placement/scale seed. Native TinyWorld components are allowed only when semantically needed; do not substitute rocks or houses for glass, metal, fabric, or wood geometry.'
          : 'Keep the result roughly within the original tile footprint.',
        'Respect renderFootprint and allowedBounds. Increase resolution with smaller connected parts, not by enlarging the whole object.',
        'Do not introduce Japanese, pagoda, temple, shrine, torii, sakura, or garden styling unless the selected object or user instruction explicitly asks for it.',
        'Do not add detached floating rings, detached columns, orbiting blocks, or broad terrain patches.',
        'Keep all returned parts inside allowedBounds when provided.',
        creativeRebuild
          ? 'Create semantic connected parts such as hull/body, rounded envelope, frame, ribs, glass panes, engines/propellers, rails, ladders, doors, windows, supports, fabric/canvas panels, trim, and accents as relevant to the requested object.'
          : 'Enhance the selected object with connected semantic parts. For buildings use roof, walls, windows, door, posts, trim, steps, and base. For balloons/airships use fabric panels, basket/hull, frame, cable rigging, anchors, and trim.',
        'Use varied local colors and at least 3 distinct material families for complex bespoke objects. Do not default to stone/rock unless the requested object is actually stone.',
        'Do not simply stretch parts. Rebuild semantically with richer low-poly detail.',
        '',
        'Schema:',
        JSON.stringify(schema),
      ].join('\n');
      const user = JSON.stringify(payload);
      const _cpCallOpts = { imageDataUrl: payload.imageDataUrl, signal: _cpCtrl.signal };
      const raw = provider === 'anthropic'
        ? await callAnthropic(def.endpoint, ai.key, model, system, user, { name: 'emit_custom_parts', schema }, _cpCallOpts)
        : provider === 'gemini'
          ? await callGemini(def.endpoint, ai.key, model, system, user, _cpCallOpts)
          : await callOpenAI(def.endpoint, ai.key, model, system, user, _cpCallOpts);
      if (_cpCtrl.signal.aborted) return null;
      result = extractJSON(raw);
      if (!result) throw new Error('AI returned non-JSON');
    }
    if (_cpCtrl.signal.aborted) return null;
    const customParts = fitCustomPartsToBounds(result.customParts || result.parts || result.response?.customParts, payload.allowedBounds);
    if (!customParts.length) throw new Error('AI returned no customParts');
    const stampKey = seed.stamp || seed.id || 'custom-parts';
    return normalizeVoxelBuildStamp({
      id: 'enhanced-' + stampKey + '-' + Date.now().toString(36),
      name: seed.label + ' enhanced',
      customParts,
      footprint: renderFootprint,
      custom: true,
    }, seed.label + ' enhanced');
  }

  async function enhanceSelectedBuildingPartsObject(target, userInstruction, opts = {}) {
    const seed = builderStylePartsForSelectedObject(target);
    if (!seed) return null;
    seed.isBuildingSource = true;
    return enhanceSelectedCustomPartsObject(target, userInstruction, seed, opts);
  }

  async function enhanceSelectedBoardObject(userInstruction, opts = {}) {
    const target = selectedBoardObjectTarget();
    if (!target) throw new Error('Shift-select exactly one object first.');
    const beforeCell = cloneCellIntent(target.cell);
    if (target.cell && target.cell.kind === 'house') {
      const stamp = await enhanceSelectedBuildingPartsObject(target, userInstruction, opts);
      if (!stamp && aiCustomPartsCtrl && aiCustomPartsCtrl.signal.aborted) return null;
      if (!stamp) throw new Error('No enhanced building returned');
      VOXEL_BUILD_STAMPS.push(stamp);
      saveCustomVoxelBuildStamps();
      selectedVoxelBuildId = stamp.id;
      const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
      appearance.voxelBuildId = stamp.id;
      updateSelectedBoardObject(target, {
        kind: 'voxel-build',
        floors: 1,
        buildingType: null,
        fenceSide: null,
        appearance,
      });
      const afterCell = cloneCellIntent(getWorldCell(target.x, target.z));
      postAiDebugLog({
        kind: 'selected-building-parts-after',
        instruction: userInstruction || '',
        target: { x: target.x, z: target.z, label: selectedBoardObjectLabel(target) },
        beforeCell,
        enhancedStamp: {
          id: stamp.id,
          name: stamp.name,
          footprint: stamp.footprint,
          customPartCount: stamp.customParts.length,
          bounds: customPartsBounds(stamp.customParts),
        },
        afterCell,
      });
      renderStampBuilderCards();
      selectTool({ id: 'voxel-build:' + stamp.id, label: stamp.name, kind: 'voxel-build', voxelBuildId: stamp.id, isVoxelBuild: true });
      return stamp;
    }
    const seed = seedVoxelBuildForSelectedObject(target);
    if (!seed) throw new Error('That selected object cannot be converted yet.');
    if (Array.isArray(seed.customParts) && seed.customParts.length) {
      const partsSeed = Object.assign({}, seed, {
        label: selectedBoardObjectLabel(target),
        stamp: seed.id || 'voxel-build',
        isCustomPartsSource: true,
      });
      const stamp = await enhanceSelectedCustomPartsObject(target, userInstruction || '', partsSeed, opts);
      if (!stamp && aiCustomPartsCtrl && aiCustomPartsCtrl.signal.aborted) return null;
      if (!stamp) throw new Error('No enhanced custom object returned');
      VOXEL_BUILD_STAMPS.push(stamp);
      saveCustomVoxelBuildStamps();
      selectedVoxelBuildId = stamp.id;
      const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
      appearance.voxelBuildId = stamp.id;
      updateSelectedBoardObject(target, {
        kind: 'voxel-build',
        floors: 1,
        buildingType: null,
        fenceSide: null,
        appearance,
      });
      const afterCell = cloneCellIntent(getWorldCell(target.x, target.z));
      postAiDebugLog({
        kind: 'selected-custom-parts-after',
        instruction: userInstruction || '',
        target: { x: target.x, z: target.z, label: selectedBoardObjectLabel(target) },
        beforeCell,
        seed: {
          id: seed.id,
          name: seed.name,
          footprint: seed.footprint,
          customPartCount: seed.customParts.length,
          bounds: customPartsBounds(seed.customParts),
        },
        enhancedStamp: {
          id: stamp.id,
          name: stamp.name,
          footprint: stamp.footprint,
          customPartCount: stamp.customParts.length,
          bounds: customPartsBounds(stamp.customParts),
        },
        afterCell,
      });
      renderStampBuilderCards();
      selectTool({ id: 'voxel-build:' + stamp.id, label: stamp.name, kind: 'voxel-build', voxelBuildId: stamp.id, isVoxelBuild: true });
      return stamp;
    }
    const highResolutionSeed = upscaleVoxelBuildStampResolution(seed, 2, false) || seed;
    const stamp = await enhanceVoxelBuildStamp(highResolutionSeed, userInstruction || '', opts);
    if (!stamp && aiVoxelBuildCtrl && aiVoxelBuildCtrl.signal.aborted) return null;
    if (!stamp) throw new Error('No enhanced build returned');
    VOXEL_BUILD_STAMPS.push(stamp);
    saveCustomVoxelBuildStamps();
    selectedVoxelBuildId = stamp.id;
    const appearance = Object.assign({}, normalizeAppearance(target.cell.appearance) || {});
    appearance.voxelBuildId = stamp.id;
    updateSelectedBoardObject(target, {
      kind: 'voxel-build',
      floors: 1,
      buildingType: null,
      fenceSide: null,
      appearance,
    });
    const afterCell = cloneCellIntent(getWorldCell(target.x, target.z));
    postAiDebugLog({
      kind: 'selected-object-after',
      instruction: userInstruction || '',
      target: { x: target.x, z: target.z, label: selectedBoardObjectLabel(target) },
      beforeCell,
      seed: {
        id: seed.id,
        name: seed.name,
        footprint: seed.footprint,
        voxelCount: seed.voxels.length,
      },
      highResolutionSeed: {
        footprint: highResolutionSeed.footprint,
        voxelCount: highResolutionSeed.voxels.length,
        bounds: voxelBuildBounds(highResolutionSeed.voxels),
      },
      enhancedStamp: {
        id: stamp.id,
        name: stamp.name,
        footprint: stamp.footprint,
        voxelCount: stamp.voxels.length,
        bounds: voxelBuildBounds(stamp.voxels),
      },
      afterCell,
    });
    renderStampBuilderCards();
    selectTool({ id: 'voxel-build:' + stamp.id, label: stamp.name, kind: 'voxel-build', voxelBuildId: stamp.id, isVoxelBuild: true });
    return stamp;
  }

  function upscaleVoxelBuildStamp(stamp) {
    if (!stamp || !Array.isArray(stamp.voxels)) return null;
    return upscaleVoxelBuildStampResolution(stamp, 2, true);
  }

  function upscaleVoxelBuildStampResolution(stamp, factor, makeCustom) {
    factor = Math.max(2, Math.min(4, Math.round(factor || 2)));
    if (!stamp || !Array.isArray(stamp.voxels)) return null;
    const out = [];
    for (const v of stamp.voxels) {
      const bx = v.x * factor;
      const by = v.y * factor;
      const bz = v.z * factor;
      for (let dx = 0; dx < factor; dx++) {
        for (let dy = 0; dy < factor; dy++) {
          for (let dz = 0; dz < factor; dz++) {
            out.push({ x: bx + dx, y: by + dy, z: bz + dz, color: v.color });
          }
        }
      }
    }
    const raw = {
      name: stamp.name + ' ' + factor + 'x',
      id: stamp.id + '-' + factor + 'x',
      voxels: out,
      footprint: stamp.footprint,
      custom: !!makeCustom,
      sourceCell: stamp.sourceCell || null,
      sourceCoord: stamp.sourceCoord || null,
    };
    if (!makeCustom) return raw;
    return normalizeVoxelBuildStamp(raw, stamp.name + ' ' + factor + 'x');
  }

  function voxelBuildEnhanceSchema() {
    return {
      type: 'object',
      additionalProperties: false,
      required: ['name', 'voxels'],
      properties: {
        name: { type: 'string' },
        voxels: {
          type: 'array',
          minItems: 80,
          maxItems: 1800,
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['x', 'y', 'z', 'color'],
            properties: {
              x: { type: 'integer' },
              y: { type: 'integer' },
              z: { type: 'integer' },
              color: { type: 'string', pattern: '^#[0-9a-fA-F]{6}$' },
            },
          },
        },
      },
    };
  }

  async function enhanceVoxelBuildStamp(stamp, userInstruction, opts = {}) {
    if (aiVoxelBuildCtrl) aiVoxelBuildCtrl.abort();
    const _vbCtrl = new AbortController();
    aiVoxelBuildCtrl = _vbCtrl;
    const ai = getAIProviderState();
    const def = AI_DEFAULTS[ai.provider] || AI_DEFAULTS.openai;
    const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname);
    const canUseLocalOpenAI = isLocalHost && (ai.provider === 'openai' || !ai.key);
    const model = canUseLocalOpenAI
      ? textModelForGeneration('openai', ai.provider === 'openai' ? ai.model : AI_DEFAULTS.openai.model)
      : textModelForGeneration(ai.provider, ai.model);
    const schema = voxelBuildEnhanceSchema();
    const profile = selectedVoxelEnhanceProfile(stamp, userInstruction);
    const sourceBounds = voxelBuildBounds(stamp.voxels);
    const allowedBounds = allowedVoxelBuildBounds(stamp, profile);
    const userPayload = {
      name: stamp.name,
      selectedKind: profile.selectedKind,
      selectedLabel: profile.selectedLabel,
      seedId: profile.seedId || stamp.id || null,
      style: profile.style,
      creativeRebuild: !!profile.creativeRebuild,
      instruction: String(userInstruction || '').trim() || 'Enhance this voxel object while keeping its role recognisable.',
      sourceCell: stamp.sourceCell || null,
      sourceCoord: stamp.sourceCoord || null,
      sourceBounds,
      allowedBounds,
      renderFootprint: enhancedFootprintForStamp(stamp, profile),
      desiredScale: (stamp.sourceCell && stamp.sourceCell.appearance && stamp.sourceCell.appearance.objectScale) || 1,
      sourceVoxelCount: stamp.voxels.length,
      targetVoxelCount: profile.creativeRebuild
        ? Math.min(1800, Math.max(420, Math.round(stamp.voxels.length * 2.2)))
        : Math.min(1800, Math.max(180, Math.round(stamp.voxels.length * 1.25))),
      requirements: profile.requirements,
      imageDataUrl: opts.imageDataUrl || null,
      voxels: stamp.voxels,
    };
    if (canUseLocalOpenAI) {
      const r = await fetch('/api/enhance-voxel-build', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model,
          instruction: userPayload.instruction,
          stamp: userPayload,
          schema,
          imageDataUrl: userPayload.imageDataUrl,
        }),
      });
      const text = await r.text();
      let j = null;
      try { j = text ? JSON.parse(text) : null; } catch (_) {}
      if (!r.ok || !j || !j.ok) {
        throw new Error((j && j.error) || text.slice(0, 180) || 'AI enhance failed');
      }
      const filtered = filterVoxelsToBounds(j.voxels, allowedBounds);
      return normalizeVoxelBuildStamp({
        name: (j.name || stamp.name) + ' enhanced',
        voxels: filtered.length >= 24 ? filtered : j.voxels,
        footprint: enhancedFootprintForStamp(stamp, profile),
        custom: true,
      }, stamp.name + ' enhanced');
    }
    if (!ai.key) throw new Error('AI key missing');
    const system = [
      'You build and enhance voxel objects for Tiny World Builder. You CAN create brand-new 3D objects, not just rearrange existing parts.',
      'Input voxels are integer x/y/z cubes with hex colors — a starting seed you may keep, extend, or completely replace.',
      'If the user instruction asks for a different or new object (e.g. "make it a windmill", "turn this into a spaceship/robot/lighthouse"), CREATE that new object from scratch: invent its shape, silhouette, and colors freely — you are NOT limited to the seed\'s original category.',
      'When creativeRebuild is true in the payload, the user instruction wins over selectedKind, sourceCell, and source voxels. Use the source only for placement scale and bounds.',
      'If the instruction only asks to enhance/refine/detail, keep the selected object category recognisable, preserve its rough footprint, and add higher-resolution voxel detail.',
      'Use many small voxels on the supplied coordinate grid. Do not collapse the object into a few broad blocks or fill a solid rectangular mass.',
      'Keep all returned voxels inside allowedBounds when it is present. Do not create detached floating decoration.',
      'Build a readable, characterful low-poly object that matches what the user asked for.',
      'Use varied local colors and accents. Do not default to gray stone/rock unless the requested object is actually stone.',
      'Do not return prose. Do not include markdown.',
      '',
      'Schema:',
      JSON.stringify(schema),
    ].join('\n');
    const user = JSON.stringify(userPayload);
    const _vbCallOpts = { imageDataUrl: userPayload.imageDataUrl, signal: _vbCtrl.signal };
    const raw = ai.provider === 'anthropic'
      ? await callAnthropic(def.endpoint, ai.key, model, system, user, { name: 'emit_voxel_build', schema }, _vbCallOpts)
      : ai.provider === 'gemini'
        ? await callGemini(def.endpoint, ai.key, model, system, user, _vbCallOpts)
        : await callOpenAI(def.endpoint, ai.key, model, system, user, _vbCallOpts);
    if (_vbCtrl.signal.aborted) return null;
    const parsed = extractJSON(raw);
    if (!parsed) throw new Error('AI returned non-JSON');
    const filtered = filterVoxelsToBounds(parsed.voxels, allowedBounds);
    return normalizeVoxelBuildStamp({
      name: (parsed.name || stamp.name) + ' enhanced',
      voxels: filtered.length >= 24 ? filtered : parsed.voxels,
      footprint: enhancedFootprintForStamp(stamp, profile),
      custom: true,
    }, stamp.name + ' enhanced');
  }

  (function setupStampBuilder() {
    const panel = document.getElementById('stamp-builder-panel');
    const openBtn = document.getElementById('stamp-builder');
    const closeBtn = document.getElementById('stamp-builder-close');
    const rebuildBtn = document.getElementById('stamp-builder-rebuild');
    const modelRefreshBtn = document.getElementById('model-stamp-refresh');
    const searchInput = document.getElementById('stamp-builder-search');
    const importBtn = document.getElementById('voxel-build-import');
    const importFile = document.getElementById('voxel-build-import-file');
    const status = document.getElementById('stamp-builder-status');
    const modelRangeInputs = ['model-stamp-size', 'model-stamp-offset-y', 'model-stamp-rotation']
      .map(id => document.getElementById(id))
      .filter(Boolean);
    const modelSaveBtn = document.getElementById('model-stamp-save-default');
    const modelResetBtn = document.getElementById('model-stamp-reset-default');
    const head = panel && panel.querySelector('.stamp-panel-head');
    const PANEL_POS_KEY = 'tinyworld:stamp-panel-pos';
    let panelDrag = null;
    if (!panel || !openBtn || !closeBtn) return;

    function clampStampPanel(left, top) {
      const w = panel.offsetWidth || 350;
      const h = panel.offsetHeight || 420;
      return {
        left: Math.max(8, Math.min(window.innerWidth - w - 8, left)),
        top: Math.max(8, Math.min(window.innerHeight - h - 8, top)),
      };
    }

    function applySavedStampPanelPosition() {
      let pos = null;
      try { pos = JSON.parse(localStorage.getItem(PANEL_POS_KEY) || 'null'); } catch (_) {}
      if (!pos || !Number.isFinite(pos.left) || !Number.isFinite(pos.top)) return;
      const clamped = clampStampPanel(pos.left, pos.top);
      panel.style.left = clamped.left + 'px';
      panel.style.top = clamped.top + 'px';
    }

    function open() {
      renderStampBuilderCards();
      updateStampBuilderSummary();
      panel.hidden = false;
      const grid = document.getElementById('stamp-builder-grid');
      if (grid) grid.scrollTop = 0;
      applySavedStampPanelPosition();
      if (status) status.textContent = 'Choose a stamp to place (' + stampBuilderTools().length + ' shown)';
      (searchInput || closeBtn).focus({ preventScroll: true });
    }

    function close() { panel.hidden = true; }

    function firstSelectableStampCard() {
      return panel.querySelector('.stamp-card:not(.unsupported)');
    }

    function activateFirstSelectableStampCard() {
      const card = firstSelectableStampCard();
      if (!card) {
        if (status) status.textContent = 'No selectable stamps in this view';
        return false;
      }
      card.click();
      return true;
    }

    openBtn.addEventListener('click', () => {
      if (panel.hidden) open();
      else close();
    });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.hidden) close();
    });
    if (rebuildBtn) {
      rebuildBtn.addEventListener('click', async () => {
        if (status) status.textContent = 'Refreshing stamps…';
        rebuildVoxelStampRender();
        await refreshModelStampManifest().catch(() => null);
        renderStampBuilderCards();
        if (status) status.textContent = 'Stamps refreshed';
      });
    }
    if (modelRefreshBtn) {
      modelRefreshBtn.addEventListener('click', async () => {
        if (status) status.textContent = 'Scanning models/…';
        modelStampAssetCache.clear();
        crowdModelAssetLoadIds.clear();
        clearCrowdModelActors();
        await refreshModelStampManifest().catch(() => null);
        renderStampBuilderCards();
        if (status) status.textContent = modelStampScanMessage;
      });
    }
    if (searchInput) {
      searchInput.addEventListener('input', () => renderStampBuilderCards());
      searchInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          e.preventDefault();
          activateFirstSelectableStampCard();
          return;
        }
        if (e.key === 'ArrowDown') {
          const card = firstSelectableStampCard();
          if (!card) return;
          e.preventDefault();
          card.focus({ preventScroll: true });
          card.scrollIntoView({ block: 'nearest' });
          return;
        }
        if (e.key === 'Escape' && searchInput.value) {
          e.preventDefault();
          e.stopPropagation();
          searchInput.value = '';
          renderStampBuilderCards();
        }
      });
    }
    modelRangeInputs.forEach(input => {
      input.addEventListener('input', () => updateSelectedModelStampDefaults(false));
      input.addEventListener('change', () => updateSelectedModelStampDefaults(false));
    });
    if (modelSaveBtn) {
      modelSaveBtn.addEventListener('click', () => updateSelectedModelStampDefaults(true));
    }
    if (modelResetBtn) {
      modelResetBtn.addEventListener('click', () => {
        if (!selectedModelStampId) return;
        const asset = getModelStamp(selectedModelStampId);
        resetModelStampSettings(selectedModelStampId);
        syncModelStampSettingsPanel(selectedTool);
        ghostPreviewKey = null;
        ensureGhostPreview();
        updateGhostPlacement();
        renderStampBuilderCards();
        if (status) status.textContent = 'Reset defaults for ' + (asset ? asset.label : selectedModelStampId);
      });
    }
    if (importBtn && importFile) {
      importBtn.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', async () => {
        const file = importFile.files && importFile.files[0];
        importFile.value = '';
        if (!file) return;
        try {
          const payload = JSON.parse(await file.text());
          const imported = importVoxelBuildPayload(payload, file.name.replace(/\.json$/i, ''));
          renderStampBuilderCards();
          if (imported[0]) {
            selectedVoxelBuildId = imported[0].id;
            selectTool({ id: 'voxel-build:' + imported[0].id, label: imported[0].name, kind: 'voxel-build', voxelBuildId: imported[0].id, isVoxelBuild: true });
          }
          if (status) status.textContent = imported.length ? 'Imported ' + imported.length + ' build' + (imported.length === 1 ? '' : 's') : 'No voxel builds found';
        } catch (err) {
          if (status) status.textContent = 'Import failed: ' + String(err.message || err).slice(0, 80);
        }
      });
    }
    if (head) {
      head.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target.closest('button')) return;
        const r = panel.getBoundingClientRect();
        panelDrag = {
          startX: e.clientX,
          startY: e.clientY,
          leftAtStart: r.left,
          topAtStart: r.top,
          moved: false,
        };
        try { panel.setPointerCapture(e.pointerId); } catch (_) {}
      });
    }
    panel.addEventListener('pointermove', e => {
      if (!panelDrag) return;
      const dx = e.clientX - panelDrag.startX;
      const dy = e.clientY - panelDrag.startY;
      if (!panelDrag.moved && Math.hypot(dx, dy) < 4) return;
      panelDrag.moved = true;
      panel.classList.add('dragging');
      const pos = clampStampPanel(panelDrag.leftAtStart + dx, panelDrag.topAtStart + dy);
      panel.style.left = pos.left + 'px';
      panel.style.top = pos.top + 'px';
    });
    function endPanelDrag() {
      if (!panelDrag) return;
      const moved = panelDrag.moved;
      panelDrag = null;
      panel.classList.remove('dragging');
      if (moved) {
        const r = panel.getBoundingClientRect();
        try { localStorage.setItem(PANEL_POS_KEY, JSON.stringify({ left: r.left, top: r.top })); } catch (_) {}
      }
    }
    panel.addEventListener('pointerup', endPanelDrag);
    panel.addEventListener('pointercancel', endPanelDrag);
    window.addEventListener('resize', () => {
      if (panel.hidden) return;
      const r = panel.getBoundingClientRect();
      const pos = clampStampPanel(r.left, r.top);
      panel.style.left = pos.left + 'px';
      panel.style.top = pos.top + 'px';
    });
  })();
