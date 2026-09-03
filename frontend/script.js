/**
 * ============================================================================
 * GeoTrack — Professional LULC GIS & Google Earth Mapping Workstation
 * Interactive AOI Selection, Satellite Extraction & Live U-Net Inference
 * ============================================================================
 */

(function () {
  'use strict';

  window.GeoTrackAppLoaded = true;

  // ── 1. Constants & Configurations ──────────────────────────────────────────
  // Use the configured Render API, the same-origin API in production, or the
  // local FastAPI server during development.
  const RENDER_API_URL = 'https://geotrack-4clh.onrender.com';
  const API_BASE = window.GEOTRACK_API_URL || (
    window.location.port === '8000' || window.location.hostname === 'geotrack-4clh.onrender.com'
      ? ''
      : window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://127.0.0.1:8000'
        : RENDER_API_URL
  );
  const API_HOST = API_BASE || window.location.origin;

  function resolveUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('blob:')) {
      return url;
    }
    return `${API_HOST}${url.startsWith('/') ? '' : '/'}${url}`;
  }

  const LULC_COLORS = {
    urban_land:       '#00FFFF',
    agriculture_land: '#FFFF00',
    rangeland:        '#FF00FF',
    forest_land:      '#00FF00',
    water:            '#0000FF',
    barren_land:      '#FFFFFF'
  };

  const LULC_LABELS = {
    urban_land: 'Urban Land',
    agriculture_land: 'Agriculture Land',
    rangeland: 'Rangeland',
    forest_land: 'Forest Land',
    water: 'Water Body',
    barren_land: 'Barren Land'
  };

  document.querySelectorAll('.legend-color-dot[data-class]').forEach((swatch) => {
    swatch.style.backgroundColor = LULC_COLORS[swatch.dataset.class] || 'transparent';
  });

  // Initial geographic center
  const DEFAULT_CENTER = { lat: 38.162, lng: -121.685 };
  const DEFAULT_ZOOM = 14;

  // ── 2. Application State ───────────────────────────────────────────────────
  const state = {
    // AOI State
    isSelectingAOI: false,
    aoiStartLatLng: null,
    aoiRectangle: null,
    aoiBounds: null,

    // Upload & Results State
    selectedFile: null,
    selectedFileUrl: null,
    activeFilterClass: null,
    currentGeoJSON: null,
    currentFeatures: [],
    currentMetrics: null,

    // Measurement State
    isMeasuring: false,
    measurePoints: [],
    measureMarkers: [],
    measureLine: null,
    measurePolygon: null,

    // Overlays & Layers
    layers: {
      mapType: 'hybrid',
      rawVisible: true,
      rawOpacity: 1.0,
      maskVisible: true,
      maskOpacity: 0.75,
      vectorVisible: true,
      vectorOpacity: 0.65,
      vectorOutline: true,
      hoverHighlight: true,
      qcVisible: true
    }
  };

  // ── 3. DOM Elements ────────────────────────────────────────────────────────
  const dom = {
    // Header & Telemetry
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    sidebarMobileClose: document.getElementById('sidebarMobileClose'),
    telemetryLat: document.getElementById('telemetryLat'),
    telemetryLon: document.getElementById('telemetryLon'),
    telemetryZoom: document.getElementById('telemetryZoom'),

    // Top Tools
    btnSelectAOI: document.getElementById('btnSelectAOI'),
    btnUseCurrentView: document.getElementById('btnUseCurrentView'),
    btnMeasure: document.getElementById('btnMeasure'),
    btnAttrTable: document.getElementById('btnAttrTable'),
    btnResetView: document.getElementById('btnResetView'),
    btnFullscreen: document.getElementById('btnFullscreen'),

    // Sidebar & Navigation
    gisSidebar: document.getElementById('gisSidebar'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    sidebarToggleIcon: document.getElementById('sidebarToggleIcon'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabPanes: document.querySelectorAll('.tab-pane'),

    // Tab 1: AOI & Ingestion
    btnDrawBox: document.getElementById('btnDrawBox'),
    btnCaptureView: document.getElementById('btnCaptureView'),
    aoiBadge: document.getElementById('aoiBadge'),
    aoiDetailsBox: document.getElementById('aoiDetailsBox'),
    aoiAreaM2: document.getElementById('aoiAreaM2'),
    aoiNorth: document.getElementById('aoiNorth'),
    aoiSouth: document.getElementById('aoiSouth'),
    aoiEast: document.getElementById('aoiEast'),
    aoiWest: document.getElementById('aoiWest'),
    btnClearAOI: document.getElementById('btnClearAOI'),
    btnAnalyseAOI: document.getElementById('btnAnalyseAOI'),

    // Direct Upload
    dropZone: document.getElementById('dropZone'),
    fileInput: document.getElementById('fileInput'),
    filePreview: document.getElementById('filePreview'),
    fileName: document.getElementById('fileName'),
    fileSize: document.getElementById('fileSize'),
    btnRemoveFile: document.getElementById('btnRemoveFile'),
    btnRunInference: document.getElementById('btnRunInference'),

    // Pipeline Stepper
    pipelineStatusBadge: document.getElementById('pipelineStatusBadge'),
    pipelineStepper: document.getElementById('pipelineStepper'),

    // Tab 2: Earth Layers
    basemapOptions: document.querySelectorAll('.basemap-opt'),
    toggleRaw: document.getElementById('toggleRaw'),
    opacityRaw: document.getElementById('opacityRaw'),
    opacityRawVal: document.getElementById('opacityRawVal'),
    toggleMask: document.getElementById('toggleMask'),
    opacityMask: document.getElementById('opacityMask'),
    opacityMaskVal: document.getElementById('opacityMaskVal'),
    toggleVector: document.getElementById('toggleVector'),
    opacityVector: document.getElementById('opacityVector'),
    opacityVectorVal: document.getElementById('opacityVectorVal'),
    checkPolygonOutline: document.getElementById('checkPolygonOutline'),
    checkHoverHighlight: document.getElementById('checkHoverHighlight'),
    toggleQC: document.getElementById('toggleQC'),

    // Tab 3: LULC Classes
    donutSvg: document.getElementById('donutSvg'),
    donutDominantPct: document.getElementById('donutDominantPct'),
    donutDominantClass: document.getElementById('donutDominantClass'),
    classMatrix: document.getElementById('classMatrix'),
    btnResetFilter: document.getElementById('btnResetFilter'),

    // Tab 4: Metrics & Export
    kpiConfidence: document.getElementById('kpiConfidence'),
    kpiArea: document.getElementById('kpiArea'),
    kpiPatches: document.getElementById('kpiPatches'),
    kpiGreenIndex: document.getElementById('kpiGreenIndex'),
    qcBanner: document.getElementById('qcBanner'),
    qcBannerIcon: document.getElementById('qcBannerIcon'),
    qcBannerTitle: document.getElementById('qcBannerTitle'),
    qcBannerSub: document.getElementById('qcBannerSub'),
    btnDownloadGeoJSON: document.getElementById('btnDownloadGeoJSON'),
    btnDownloadMask: document.getElementById('btnDownloadMask'),
    btnDownloadReport: document.getElementById('btnDownloadReport'),
    btnExportCSV: document.getElementById('btnExportCSV'),
    btnCopyGeoJSON: document.getElementById('btnCopyGeoJSON'),
    btnRefreshReports: document.getElementById('btnRefreshReports'),
    reportHistory: document.getElementById('reportHistory'),

    // Map Viewport Controls & Banners
    earthMap: document.getElementById('earthMap'),
    aoiMapBanner: document.getElementById('aoiMapBanner'),
    btnCancelAOIDraw: document.getElementById('btnCancelAOIDraw'),
    measureBanner: document.getElementById('measureBanner'),
    measureVal: document.getElementById('measureVal'),
    btnFinishMeasure: document.getElementById('btnFinishMeasure'),
    btnClearMeasure: document.getElementById('btnClearMeasure'),
    floatingLegend: document.getElementById('floatingLegend'),
    btnToggleLegend: document.getElementById('btnToggleLegend'),
    legendChevron: document.getElementById('legendChevron'),
    legendItems: document.getElementById('legendItems'),

    // Attribute Table Drawer
    attrDrawer: document.getElementById('attrDrawer'),
    attrFeatureCount: document.getElementById('attrFeatureCount'),
    attrSearchInput: document.getElementById('attrSearchInput'),
    attrQcFilter: document.getElementById('attrQcFilter'),
    btnExportTable: document.getElementById('btnExportTable'),
    attrCloseBtn: document.getElementById('attrCloseBtn'),
    attrTableBody: document.getElementById('attrTableBody'),

    // Mobile Bottom Navigation
    mobileBottomNav: document.getElementById('mobileBottomNav')
  };

  // ── 4. Initialize Google Earth API ─────────────────────────────────────────
  let map = null;
  let infoWindow = null;
  let rawGroundOverlay = null;
  let maskGroundOverlay = null;
  let qcMarkers = [];

  function initGoogleEarth() {
    if (!window.google || !window.google.maps) {
      console.warn('Google Maps / Earth API loading...');
      setTimeout(initGoogleEarth, 250);
      return;
    }

    // Create Map with 3D Earth perspective
    map = new google.maps.Map(dom.earthMap, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: 20,
      mapTypeId: google.maps.MapTypeId.HYBRID,
      tilt: 0,
      heading: 0,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      zoomControlOptions: {
        position: google.maps.ControlPosition.RIGHT_TOP
      },
      rotateControl: true,
      scaleControl: true
    });

    infoWindow = new google.maps.InfoWindow();

    // ── Telemetry Listeners ──
    map.addListener('mousemove', (e) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      dom.telemetryLat.textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
      dom.telemetryLon.textContent = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
    });

    map.addListener('zoom_changed', () => {
      dom.telemetryZoom.textContent = map.getZoom();
    });

    // Configure Data Layer for GeoJSON vectors
    configureGoogleDataLayer();

    // Setup Interactive Map Click & Drag Listeners
    setupMapInteractionListeners();
    fetchRecentReports();
  }

  // ── 5. Area of Interest (AOI) Interactive Selection ───────────────────────
  function setupMapInteractionListeners() {
    map.addListener('click', (e) => {
      if (!e.latLng) return;

      // Handle Measurement Click
      if (state.isMeasuring) {
        addMeasurePoint(e.latLng);
        return;
      }

      // Handle AOI Drawing Clicks
      if (state.isSelectingAOI) {
        if (!state.aoiStartLatLng) {
          // First point: anchor
          state.aoiStartLatLng = e.latLng;
          dom.aoiMapBanner.querySelector('span').textContent = 'Click opposite corner to complete the selection box';
        } else {
          // Second point: finish rectangle
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(state.aoiStartLatLng);
          bounds.extend(e.latLng);
          finishAOISelection(bounds);
        }
      }
    });

    map.addListener('mousemove', (e) => {
      if (state.isSelectingAOI && state.aoiStartLatLng && e.latLng) {
        // Draw live rectangle preview
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(state.aoiStartLatLng);
        bounds.extend(e.latLng);
        updateAOIRectangle(bounds);
      }
    });
  }

  function startAOIDrawing() {
    if (!map) return;
    state.isSelectingAOI = true;
    state.aoiStartLatLng = null;
    dom.btnSelectAOI.classList.add('active');
    dom.btnDrawBox.classList.add('active');
    dom.aoiMapBanner.style.display = 'flex';
    dom.aoiMapBanner.querySelector('span').textContent = 'Click on the map to place the first corner of your selection box';
    map.setOptions({ draggable: false, draggableCursor: 'crosshair' });
  }

  function cancelAOIDrawing() {
    state.isSelectingAOI = false;
    state.aoiStartLatLng = null;
    dom.btnSelectAOI.classList.remove('active');
    dom.btnDrawBox.classList.remove('active');
    dom.aoiMapBanner.style.display = 'none';
    map.setOptions({ draggable: true, draggableCursor: null });

    if (!state.aoiBounds && state.aoiRectangle) {
      state.aoiRectangle.setMap(null);
      state.aoiRectangle = null;
    }
  }

  function updateAOIRectangle(bounds) {
    if (!state.aoiRectangle) {
      state.aoiRectangle = new google.maps.Rectangle({
        bounds: bounds,
        map: map,
        clickable: false,
        editable: false,
        draggable: false,
        fillColor: '#00e5ff',
        fillOpacity: 0.2,
        strokeColor: '#00e5ff',
        strokeWeight: 2,
        strokeOpacity: 0.9,
        zIndex: 100
      });

      // Update when user edits or drags the rectangle
      state.aoiRectangle.addListener('bounds_changed', () => {
        if (!state.isSelectingAOI) {
          const b = state.aoiRectangle.getBounds();
          applyAOIBounds(b);
        }
      });
    } else {
      state.aoiRectangle.setBounds(bounds);
    }
  }

  function finishAOISelection(bounds) {
    state.isSelectingAOI = false;
    state.aoiStartLatLng = null;
    dom.btnSelectAOI.classList.remove('active');
    dom.btnDrawBox.classList.remove('active');
    dom.aoiMapBanner.style.display = 'none';
    map.setOptions({ draggable: true, draggableCursor: null });

    updateAOIRectangle(bounds);
    state.aoiRectangle.setOptions({
      editable: true,
      draggable: true
    });
    applyAOIBounds(bounds);
  }

  function applyAOIBounds(bounds) {
    state.aoiBounds = bounds;

    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    // Coordinates
    const north = ne.lat().toFixed(4);
    const south = sw.lat().toFixed(4);
    const east = ne.lng().toFixed(4);
    const west = sw.lng().toFixed(4);

    dom.aoiNorth.textContent = `${north}° N`;
    dom.aoiSouth.textContent = `${south}° N`;
    dom.aoiEast.textContent = `${east}° E`;
    dom.aoiWest.textContent = `${west}° E`;

    // Compute area in square meters from the selected geographic bounds.
    let areaM2 = null;
    if (window.google && window.google.maps && window.google.maps.geometry) {
      const p1 = new google.maps.LatLng(sw.lat(), sw.lng());
      const p2 = new google.maps.LatLng(sw.lat(), ne.lng());
      const p3 = new google.maps.LatLng(ne.lat(), ne.lng());
      const p4 = new google.maps.LatLng(ne.lat(), sw.lng());
      const areaSqM = google.maps.geometry.spherical.computeArea([p1, p2, p3, p4]);
      areaM2 = areaSqM;
    }

    dom.aoiAreaM2.textContent = areaM2 === null ? '-- m²' : `${areaM2.toFixed(1)} m²`;
    dom.aoiBadge.textContent = 'Selected';
    dom.aoiBadge.style.background = 'rgba(0, 229, 255, 0.15)';
    dom.aoiBadge.style.color = 'var(--accent-cyan)';
    dom.aoiDetailsBox.style.display = 'flex';
    dom.btnAnalyseAOI.disabled = false;
  }

  function clearAOI() {
    if (state.aoiRectangle) {
      state.aoiRectangle.setMap(null);
      state.aoiRectangle = null;
    }
    state.aoiBounds = null;
    dom.aoiBadge.textContent = 'None Selected';
    dom.aoiBadge.style.background = 'transparent';
    dom.aoiBadge.style.color = 'var(--text-muted)';
    dom.aoiDetailsBox.style.display = 'none';
    dom.btnAnalyseAOI.disabled = true;
  }

  // AOI UI Event Listeners
  dom.btnSelectAOI.addEventListener('click', startAOIDrawing);
  dom.btnDrawBox.addEventListener('click', startAOIDrawing);
  dom.btnCancelAOIDraw.addEventListener('click', cancelAOIDrawing);
  dom.btnClearAOI.addEventListener('click', clearAOI);

  // Capture Current Viewport
  function captureCurrentViewAsAOI() {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    // Constrain slightly from screen edges for clean framing
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();
    const latPadding = (ne.lat() - sw.lat()) * 0.1;
    const lngPadding = (ne.lng() - sw.lng()) * 0.1;

    const framedBounds = new google.maps.LatLngBounds(
      new google.maps.LatLng(sw.lat() + latPadding, sw.lng() + lngPadding),
      new google.maps.LatLng(ne.lat() - latPadding, ne.lng() - lngPadding)
    );

    updateAOIRectangle(framedBounds);
    applyAOIBounds(framedBounds);

    // Open sidebar tab 1
    document.getElementById('tabBtnIngest').click();
  }

  dom.btnUseCurrentView.addEventListener('click', captureCurrentViewAsAOI);
  dom.btnCaptureView.addEventListener('click', captureCurrentViewAsAOI);

  // ── Helper: Robust Backend Predict Request ─────────────────────────────────
  async function sendPredictRequest(formData) {
    const endpoints = [`${API_BASE}/predict`];

    let lastError = null;
    let predictResponse = null;

    for (const url of endpoints) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          body: formData
        });

        if (resp.ok) {
          return resp;
        }

        predictResponse = resp;
        if (resp.status !== 405) {
          break;
        }
      } catch (err) {
        lastError = err;
      }
    }

    if (predictResponse) return predictResponse;
    throw new Error(lastError ? lastError.message : 'Could not reach the GeoTrack backend. Please check the Render service.');
  }

  // ── 6. Live Analysis: Extract Satellite Imagery & Call Backend ─────────────
  dom.btnAnalyseAOI.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!state.aoiBounds) return;

    dom.btnAnalyseAOI.disabled = true;
    dom.pipelineStatusBadge.textContent = 'Processing...';
    dom.pipelineStatusBadge.style.color = 'var(--accent-cyan)';

    try {
      const sw = state.aoiBounds.getSouthWest();
      const ne = state.aoiBounds.getNorthEast();
      const minLng = sw.lng();
      const minLat = sw.lat();
      const maxLng = ne.lng();
      const maxLat = ne.lat();

      // Step 1: Capture Satellite Imagery for the exact bounding box
      setPipelineStep(1);
      const exportUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${minLng},${minLat},${maxLng},${maxLat}&bboxSR=4326&imageSR=4326&size=1024,1024&format=png&f=image`;

      const imgResp = await fetch(exportUrl);
      if (!imgResp.ok) throw new Error('Could not extract satellite imagery for the selected area.');
      const imgBlob = await imgResp.blob();

      // Step 2 & 3: Neural Inference via FastAPI backend
      setPipelineStep(2);
      await delay(300);

      setPipelineStep(3);
      const formData = new FormData();
      formData.append('file', imgBlob, 'satellite_aoi.png');

      const predictResp = await sendPredictRequest(formData);

      if (!predictResp.ok) throw new Error(`Backend server status ${predictResp.status}`);
      const data = await predictResp.json();
      if (data.error) throw new Error(data.error);

      // Step 4: Vectorization & Step 5: Area Metrics
      setPipelineStep(4);
      await delay(300);

      setPipelineStep(5);
      await delay(200);

      // Display results directly over the selected AOI bounding box
      await displayInferenceResults(data, state.aoiBounds, URL.createObjectURL(imgBlob));
      await fetchRecentReports();

      dom.pipelineStatusBadge.textContent = 'Success';
      dom.pipelineStatusBadge.style.color = 'var(--status-success)';

      // Switch to LULC tab to show breakdown
      document.getElementById('tabBtnClasses').click();

    } catch (err) {
      console.error('AOI Analysis error:', err);
      dom.pipelineStatusBadge.textContent = `Error: ${err.message}`;
      dom.pipelineStatusBadge.style.color = 'var(--status-danger)';
      alert(`Analysis notification: ${err.message}`);
    } finally {
      dom.btnAnalyseAOI.disabled = false;
    }
  });

  // Direct File Upload Analysis
  dom.btnRunInference.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!state.selectedFile) return;

    dom.btnRunInference.disabled = true;
    dom.pipelineStatusBadge.textContent = 'Processing File...';
    dom.pipelineStatusBadge.style.color = 'var(--accent-cyan)';

    try {
      setPipelineStep(1);
      await delay(200);

      setPipelineStep(2);
      await delay(200);

      setPipelineStep(3);
      const formData = new FormData();
      formData.append('file', state.selectedFile);

      const resp = await sendPredictRequest(formData);

      if (!resp.ok) throw new Error(`Backend status ${resp.status}`);
      const data = await resp.json();
      if (data.error) throw new Error(data.error);

      setPipelineStep(4);
      await delay(200);

      setPipelineStep(5);

      const bounds = state.aoiBounds || map.getBounds();
      await displayInferenceResults(data, bounds, state.selectedFileUrl);
      await fetchRecentReports();

      dom.pipelineStatusBadge.textContent = 'Success';
      dom.pipelineStatusBadge.style.color = 'var(--status-success)';
      document.getElementById('tabBtnClasses').click();

    } catch (err) {
      console.error('File inference error:', err);
      dom.pipelineStatusBadge.textContent = `Error: ${err.message}`;
      dom.pipelineStatusBadge.style.color = 'var(--status-danger)';
      alert(`File analysis error: ${err.message}`);
    } finally {
      dom.btnRunInference.disabled = false;
    }
  });

  document.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  // ── 7. Render Real Results on Google Earth & Dashboard ─────────────────────
  async function displayInferenceResults(data, bounds, localRawUrl) {
    if (!map) return;

    // 1. Raw Satellite Image GroundOverlay
    const rawUrl = data.original_url ? resolveUrl(data.original_url) : localRawUrl;
    if (!rawUrl || !data.mask_url) {
      throw new Error('The API did not return Supabase image URLs for this analysis.');
    }
    if (rawGroundOverlay) rawGroundOverlay.setMap(null);
    rawGroundOverlay = new google.maps.GroundOverlay(rawUrl, bounds, { opacity: state.layers.rawOpacity });
    if (state.layers.rawVisible) rawGroundOverlay.setMap(map);

    // 2. LULC Mask GroundOverlay
    const maskUrl = resolveUrl(data.mask_url);
    if (maskGroundOverlay) maskGroundOverlay.setMap(null);
    maskGroundOverlay = new google.maps.GroundOverlay(maskUrl, bounds, { opacity: state.layers.maskOpacity });
    if (state.layers.maskVisible) maskGroundOverlay.setMap(map);

    // 3. Load & Project Vector Polygons
    let geojsonData = null;
    if (data.geojson_url) {
      try {
        const geoResp = await fetch(resolveUrl(data.geojson_url));
        if (geoResp.ok) {
          geojsonData = await geoResp.json();
        }
      } catch (e) {
        console.warn('Could not fetch GeoJSON file:', e);
      }
    }

    if (geojsonData && geojsonData.features && geojsonData.features.length > 0) {
      // Check if coordinates need geographic projection to the selected bounds
      const firstCoord = geojsonData.features[0].geometry.coordinates[0][0];
      const isNormalized = firstCoord[0] >= 0 && firstCoord[0] <= 1 && firstCoord[1] >= 0 && firstCoord[1] <= 1;

      if (isNormalized) {
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const minLng = sw.lng();
        const minLat = sw.lat();
        const spanLng = ne.lng() - minLng;
        const spanLat = ne.lat() - minLat;

        geojsonData.features.forEach((feat) => {
          if (feat.geometry && feat.geometry.coordinates) {
            feat.geometry.coordinates = feat.geometry.coordinates.map(ring => {
              return ring.map(pt => [
                minLng + pt[0] * spanLng,
                minLat + pt[1] * spanLat
              ]);
            });
          }
        });
      }

      renderGeoJSONVectors(geojsonData);
    }

    // 4. Update Real Class Breakdown & Analytics
    state.currentMetrics = data;
    updateClassBreakdownUI(data.class_breakdown || {}, data.confidence);

    // 5. Setup Download & Export Links
    setupExportHub(data, geojsonData);
  }

  function polygonAreaM2(coordinates) {
    if (!window.google || !google.maps.geometry) return null;
    return coordinates.reduce((area, ring, ringIndex) => {
      const path = ring.map(([lng, lat]) => new google.maps.LatLng(lat, lng));
      const ringArea = google.maps.geometry.spherical.computeArea(path);
      return area + (ringIndex === 0 ? ringArea : -ringArea);
    }, 0);
  }

  function renderGeoJSONVectors(geojsonData) {
    if (!map) return;

    // Clear previous features
    map.data.forEach((feat) => map.data.remove(feat));
    qcMarkers.forEach(m => m.setMap(null));
    qcMarkers = [];

    // Add unique FIDs and calculate feature areas from the returned geometry.
    geojsonData.features.forEach((feat, idx) => {
      feat.properties = feat.properties || {};
      feat.properties.fid = idx + 1;
      if (feat.geometry && feat.geometry.type === 'Polygon') {
        const areaM2 = polygonAreaM2(feat.geometry.coordinates);
        if (areaM2 !== null) feat.properties.area_m2 = areaM2;
      }

      const isReview = feat.properties.confidence < 0.65 || feat.properties.qc_flag === 'review';
      if (isReview) {
        feat.properties.qc_flag = 'review';
        const coord = feat.geometry.coordinates[0][0];
        const marker = new google.maps.Marker({
          position: { lat: coord[1], lng: coord[0] },
          map: state.layers.qcVisible ? map : null,
          icon: {
            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            scale: 3,
            fillColor: '#f59e0b',
            fillOpacity: 1,
            strokeColor: '#000',
            strokeWeight: 1
          },
          title: `QC Review Flag: #${feat.properties.fid}`
        });
        qcMarkers.push(marker);
      }
    });

    state.currentGeoJSON = geojsonData;
    map.data.addGeoJson(geojsonData);

    // Populate attribute table
    populateAttributeTable(geojsonData.features);
  }

  function updateClassBreakdownUI(breakdown, confidence) {
    const matrixEl = dom.classMatrix;
    matrixEl.innerHTML = '';

    let dominantClass = '';
    let dominantPct = 0;
    let greenPct = 0;

    const sorted = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);

    if (sorted.length === 0) {
      matrixEl.innerHTML = '<div style="text-align:center;padding:16px;color:var(--text-muted);">No classes detected.</div>';
      return;
    }

    sorted.forEach(([cls, pct]) => {
      if (pct > dominantPct) {
        dominantPct = pct;
        dominantClass = cls;
      }
      if (['forest_land', 'agriculture_land', 'rangeland'].includes(cls)) {
        greenPct += pct;
      }

      const color = LULC_COLORS[cls] || '#888888';
      const label = LULC_LABELS[cls] || cls.replace(/_/g, ' ');
      const isIsolated = state.activeFilterClass === cls;
      const isDimmed = state.activeFilterClass && state.activeFilterClass !== cls;

      const card = document.createElement('div');
      card.className = `class-card ${isIsolated ? 'isolated' : ''} ${isDimmed ? 'dimmed' : ''}`;
      card.innerHTML = `
        <div class="class-header-row">
          <div class="class-swatch-title">
            <div class="class-swatch" style="background: ${color};"></div>
            <span class="class-title">${label}</span>
          </div>
          <span class="class-pct-val">${pct.toFixed(1)}%</span>
        </div>
        <div class="class-bar-track">
          <div class="class-bar-fill" style="width: ${pct}%; background: ${color};"></div>
        </div>
        <div class="class-submeta">
          <span>Coverage: ${pct.toFixed(1)}%</span>
          <span style="color: var(--accent-cyan); font-weight: 600;">
            ${isIsolated ? '<i class="fa-solid fa-filter"></i> Isolated' : 'Tap to Filter'}
          </span>
        </div>
      `;

      card.addEventListener('click', () => toggleFilterClass(cls));
      matrixEl.appendChild(card);
    });

    // Render Donut Chart
    renderDonutChart(breakdown);
    dom.donutDominantPct.textContent = `${dominantPct.toFixed(1)}%`;
    dom.donutDominantClass.textContent = LULC_LABELS[dominantClass] || '--';

    // Update KPI cards
    dom.kpiConfidence.textContent = Number.isFinite(Number(confidence))
      ? `${(Number(confidence) * 100).toFixed(1)}%`
      : '--';
    dom.kpiArea.textContent = dom.aoiAreaM2.textContent || '-- m²';
    dom.kpiGreenIndex.textContent = `${greenPct.toFixed(1)}%`;
    dom.kpiPatches.textContent = state.currentFeatures.length || Object.keys(breakdown).length;

    // Update QA Banner
    if (confidence >= 0.65) {
      dom.qcBanner.className = 'qc-banner';
      dom.qcBannerIcon.className = 'fa-solid fa-circle-check';
      dom.qcBannerIcon.style.color = 'var(--status-success)';
      dom.qcBannerTitle.textContent = 'Quality Assurance: PASSED';
      dom.qcBannerSub.textContent = 'Model confidence exceeds acceptance standard (>65%).';
    } else {
      dom.qcBanner.className = 'qc-banner warning';
      dom.qcBannerIcon.className = 'fa-solid fa-triangle-exclamation';
      dom.qcBannerIcon.style.color = 'var(--status-warning)';
      dom.qcBannerTitle.textContent = 'Quality Assurance: REVIEW FLAGGED';
      dom.qcBannerSub.textContent = 'Confidence below threshold. Verify boundaries in QGIS.';
    }
  }

  function renderDonutChart(breakdown) {
    const svg = dom.donutSvg;
    svg.innerHTML = '';
    const radius = 15.91549430918954;
    let offset = 0;

    Object.entries(breakdown).forEach(([cls, pct]) => {
      if (pct <= 0) return;
      const color = LULC_COLORS[cls] || '#888888';
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '21');
      circle.setAttribute('cy', '21');
      circle.setAttribute('r', radius);
      circle.setAttribute('fill', 'transparent');
      circle.setAttribute('stroke', color);
      circle.setAttribute('stroke-width', '4');
      circle.setAttribute('stroke-dasharray', `${pct} ${100 - pct}`);
      circle.setAttribute('stroke-dashoffset', `${-offset}`);
      svg.appendChild(circle);
      offset += pct;
    });
  }

  function toggleFilterClass(cls) {
    state.activeFilterClass = state.activeFilterClass === cls ? null : cls;
    if (map) map.data.setStyle(map.data.getStyle());
    filterAttributeTable();
    if (state.currentMetrics) {
      updateClassBreakdownUI(state.currentMetrics.class_breakdown, state.currentMetrics.confidence);
    }
  }

  dom.btnResetFilter.addEventListener('click', () => {
    state.activeFilterClass = null;
    if (map) map.data.setStyle(map.data.getStyle());
    filterAttributeTable();
    if (state.currentMetrics) {
      updateClassBreakdownUI(state.currentMetrics.class_breakdown, state.currentMetrics.confidence);
    }
  });

  // ── 8. GeoJSON Data Layer Symbology & Click InfoWindow ─────────────────────
  function configureGoogleDataLayer() {
    map.data.setStyle((feature) => {
      const className = feature.getProperty('class_name') || 'unknown';
      const color = LULC_COLORS[className] || '#888888';
      const isFiltered = state.activeFilterClass && state.activeFilterClass !== className;
      const isVisible = state.layers.vectorVisible;

      if (!isVisible) return { visible: false };

      return {
        fillColor: color,
        fillOpacity: isFiltered ? 0.05 : state.layers.vectorOpacity,
        strokeColor: '#ffffff',
        strokeWeight: state.layers.vectorOutline ? (isFiltered ? 0.4 : 1.5) : 0,
        strokeOpacity: isFiltered ? 0.2 : 0.9,
        visible: true,
        clickable: true
      };
    });

    map.data.addListener('mouseover', (e) => {
      if (!state.layers.hoverHighlight) return;
      const className = e.feature.getProperty('class_name');
      const isFiltered = state.activeFilterClass && state.activeFilterClass !== className;
      if (isFiltered) return;

      map.data.overrideStyle(e.feature, {
        strokeColor: '#00e5ff',
        strokeWeight: 3.5,
        fillOpacity: Math.min(1.0, state.layers.vectorOpacity + 0.25)
      });
    });

    map.data.addListener('mouseout', () => map.data.revertStyle());

    map.data.addListener('click', (e) => {
      const p = {
        fid: e.feature.getProperty('fid'),
        className: e.feature.getProperty('class_name'),
        confidence: e.feature.getProperty('confidence'),
        areaM2: e.feature.getProperty('area_m2'),
        qcFlag: e.feature.getProperty('qc_flag')
      };

      const color = LULC_COLORS[p.className] || '#888888';
      const label = LULC_LABELS[p.className] || p.className;
      const confPct = Number.isFinite(Number(p.confidence))
        ? `${(Number(p.confidence) * 100).toFixed(1)}%`
        : '--';
      const flag = p.qcFlag || 'review';

      const content = `
        <div class="popup-card">
          <div class="popup-header">
            <div class="popup-title">
              <span class="class-swatch" style="background: ${color}; width: 10px; height: 10px; border-radius: 2px; display:inline-block;"></span>
              ${label}
            </div>
            <span class="badge-qc ${flag === 'review' ? 'review' : 'ok'}">
              ${flag === 'review' ? 'QC: Review' : 'QC: OK'}
            </span>
          </div>
          <div class="popup-row">
            <span>Confidence:</span>
            <strong>${confPct}%</strong>
          </div>
          <div class="popup-row">
            <span>Feature ID:</span>
            <strong>#${p.fid || 1}</strong>
          </div>
          <div class="popup-row">
            <span>Area:</span>
            <strong>${Number.isFinite(Number(p.areaM2)) ? `${Number(p.areaM2).toFixed(1)} m²` : '--'}</strong>
          </div>
        </div>
      `;

      infoWindow.setContent(content);
      infoWindow.setPosition(e.latLng);
      infoWindow.open(map);

      highlightTableRow(p.fid);
    });
  }

  // ── 9. Attribute Table & Feature Inspection ───────────────────────────────
  function populateAttributeTable(features) {
    state.currentFeatures = features;
    dom.attrFeatureCount.textContent = `${features.length} Features`;
    filterAttributeTable();
  }

  function filterAttributeTable() {
    const searchTerm = (dom.attrSearchInput.value || '').toLowerCase().trim();
    const qcFilter = dom.attrQcFilter.value;
    const body = dom.attrTableBody;
    body.innerHTML = '';

    const filtered = state.currentFeatures.filter(f => {
      const p = f.properties || {};
      const className = (p.class_name || '').toLowerCase();
      const fidStr = String(p.fid || '');
      const matchesSearch = !searchTerm || className.includes(searchTerm) || fidStr.includes(searchTerm);
      const flag = p.qc_flag || 'ok';
      const matchesQC = qcFilter === 'all' || flag === qcFilter;
      const matchesActiveLulc = !state.activeFilterClass || p.class_name === state.activeFilterClass;

      return matchesSearch && matchesQC && matchesActiveLulc;
    });

    filtered.forEach(f => {
      const p = f.properties || {};
      const fid = p.fid || 1;
      const className = p.class_name || 'unknown';
      const color = LULC_COLORS[className] || '#888888';
      const label = LULC_LABELS[className] || className;
      const conf = Number.isFinite(Number(p.confidence))
        ? (Number(p.confidence) * 100).toFixed(1)
        : '--';
      const areaM2 = Number.isFinite(Number(p.area_m2)) ? Number(p.area_m2).toFixed(1) : '--';
      const flag = p.qc_flag || 'review';

      const tr = document.createElement('tr');
      tr.id = `attrRow_${fid}`;
      tr.innerHTML = `
        <td><strong>#${fid}</strong></td>
        <td>
          <span style="display:inline-flex;align-items:center;gap:6px;">
            <span style="width:8px;height:8px;border-radius:2px;background:${color};display:inline-block;"></span>
            ${label}
          </span>
        </td>
        <td>${conf === '--' ? '--' : `${conf}%`}</td>
        <td>${areaM2} m²</td>
        <td>
          <span class="badge-qc ${flag === 'review' ? 'review' : 'ok'}">
            ${flag === 'review' ? 'Review' : 'OK'}
          </span>
        </td>
        <td>
          <button class="btn-zoom-feature" data-fid="${fid}">
            <i class="fa-solid fa-crosshairs"></i> Zoom
          </button>
        </td>
      `;

      tr.querySelector('.btn-zoom-feature').addEventListener('click', (e) => {
        e.stopPropagation();
        zoomToFeature(f);
      });

      tr.addEventListener('click', () => zoomToFeature(f));
      body.appendChild(tr);
    });
  }

  function highlightTableRow(fid) {
    document.querySelectorAll('#attrTableBody tr').forEach(r => r.classList.remove('selected'));
    const row = document.getElementById(`attrRow_${fid}`);
    if (row) {
      row.classList.add('selected');
      row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function zoomToFeature(feature) {
    if (!map || !feature.geometry) return;
    const bounds = new google.maps.LatLngBounds();
    const coords = feature.geometry.coordinates[0];

    coords.forEach(coord => {
      bounds.extend(new google.maps.LatLng(coord[1], coord[0]));
    });

    map.fitBounds(bounds);
    highlightTableRow(feature.properties.fid);
  }

  dom.attrSearchInput.addEventListener('input', filterAttributeTable);
  dom.attrQcFilter.addEventListener('change', filterAttributeTable);

  dom.btnAttrTable.addEventListener('click', () => {
    const isCollapsed = dom.attrDrawer.classList.toggle('collapsed');
    dom.btnAttrTable.classList.toggle('active', !isCollapsed);
  });

  dom.attrCloseBtn.addEventListener('click', () => {
    dom.attrDrawer.classList.add('collapsed');
    dom.btnAttrTable.classList.remove('active');
  });

  // ── 10. Setup Real Export Links ───────────────────────────────────────────
  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || '';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => document.body.removeChild(a), 200);
  }

  function setupExportHub(data, geojsonData) {
    if (geojsonData) {
      const geoBlob = new Blob([JSON.stringify(geojsonData, null, 2)], { type: 'application/geo+json' });
      const geoUrl = URL.createObjectURL(geoBlob);
      dom.btnDownloadGeoJSON.onclick = () => triggerDownload(geoUrl, 'geotrack_lulc_vectors.geojson');

      dom.btnCopyGeoJSON.onclick = () => {
        navigator.clipboard.writeText(JSON.stringify(geojsonData, null, 2))
          .then(() => alert('GeoJSON copied to clipboard.'))
          .catch(() => {});
      };
    }

    if (data.mask_url) {
      dom.btnDownloadMask.onclick = () => triggerDownload(resolveUrl(data.mask_url), 'geotrack_lulc_mask.png');
    }

    if (data.report_url) {
      dom.btnDownloadReport.onclick = () => triggerDownload(resolveUrl(data.report_url), 'geotrack_report.pdf');
    }

    dom.btnExportCSV.onclick = () => {
      const rows = [['FID', 'Class_Name', 'Confidence', 'Area_m2', 'QC_Status']];
      state.currentFeatures.forEach(f => {
        const p = f.properties || {};
        rows.push([p.fid, p.class_name, p.confidence, p.area_m2, p.qc_flag]);
      });
      const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.join(',')).join('\n');
      triggerDownload(encodeURI(csvContent), `geotrack_lulc_${Date.now()}.csv`);
    };

    dom.btnExportTable.onclick = dom.btnExportCSV.onclick;

  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>\'"]/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[character]));
  }

  async function fetchRecentReports() {
    try {
      const response = await fetch(resolveUrl('/reports?limit=50'));
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const payload = await response.json();
      renderReportHistory(payload.reports || []);
    } catch (error) {
      console.warn('Could not load Supabase reports:', error);
      dom.reportHistory.innerHTML = '<div class="report-history-empty">Saved analyses are unavailable.</div>';
    }
  }

  function renderReportHistory(reports) {
    if (!reports.length) {
      dom.reportHistory.innerHTML = '<div class="report-history-empty">No saved analyses yet.</div>';
      return;
    }

    dom.reportHistory.innerHTML = reports.map(report => {
      const confidence = Number(report.confidence);
      const confidenceText = Number.isFinite(confidence)
        ? `${(confidence * 100).toFixed(1)}% confidence`
        : 'Confidence unavailable';
      const dateText = report.created_at
        ? new Date(report.created_at).toLocaleString()
        : 'Saved analysis';
      const reportLink = report.report_url
        ? `<a href="${escapeHtml(resolveUrl(report.report_url))}" target="_blank" rel="noopener">Open PDF</a>`
        : '';

      return `<div class="report-history-item">
        <div>
          <strong>${escapeHtml(report.job_id || 'Analysis')}</strong>
          <span>${escapeHtml(dateText)}</span>
        </div>
        <div class="report-history-meta">
          <span>${escapeHtml(confidenceText)}</span>${reportLink}
        </div>
      </div>`;
    }).join('');
  }

  dom.btnRefreshReports.addEventListener('click', fetchRecentReports);

  // ── 11. Overlays & Basemaps Controls ──────────────────────────────────────
  dom.basemapOptions.forEach(opt => {
    opt.addEventListener('click', function () {
      const type = this.getAttribute('data-maptype');
      if (!map) return;

      const mapTypeMap = {
        hybrid: google.maps.MapTypeId.HYBRID,
        satellite: google.maps.MapTypeId.SATELLITE,
        terrain: google.maps.MapTypeId.TERRAIN,
        roadmap: google.maps.MapTypeId.ROADMAP
      };

      if (mapTypeMap[type]) {
        map.setMapTypeId(mapTypeMap[type]);
        dom.basemapOptions.forEach(o => o.classList.remove('active'));
        this.classList.add('active');
        state.layers.mapType = type;
      }
    });
  });

  // Layer Visibility & Opacity
  dom.toggleRaw.addEventListener('click', function () {
    state.layers.rawVisible = !state.layers.rawVisible;
    this.classList.toggle('disabled', !state.layers.rawVisible);
    if (rawGroundOverlay) rawGroundOverlay.setMap(state.layers.rawVisible ? map : null);
  });

  dom.opacityRaw.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    dom.opacityRawVal.textContent = `${val}%`;
    state.layers.rawOpacity = val / 100;
    if (rawGroundOverlay) rawGroundOverlay.setOpacity(state.layers.rawOpacity);
  });

  dom.toggleMask.addEventListener('click', function () {
    state.layers.maskVisible = !state.layers.maskVisible;
    this.classList.toggle('disabled', !state.layers.maskVisible);
    if (maskGroundOverlay) maskGroundOverlay.setMap(state.layers.maskVisible ? map : null);
  });

  dom.opacityMask.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    dom.opacityMaskVal.textContent = `${val}%`;
    state.layers.maskOpacity = val / 100;
    if (maskGroundOverlay) maskGroundOverlay.setOpacity(state.layers.maskOpacity);
  });

  dom.toggleVector.addEventListener('click', function () {
    state.layers.vectorVisible = !state.layers.vectorVisible;
    this.classList.toggle('disabled', !state.layers.vectorVisible);
    if (map) map.data.setStyle(map.data.getStyle());
  });

  dom.opacityVector.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    dom.opacityVectorVal.textContent = `${val}%`;
    state.layers.vectorOpacity = val / 100;
    if (map) map.data.setStyle(map.data.getStyle());
  });

  dom.checkPolygonOutline.addEventListener('change', function () {
    state.layers.vectorOutline = this.checked;
    if (map) map.data.setStyle(map.data.getStyle());
  });

  dom.checkHoverHighlight.addEventListener('change', function () {
    state.layers.hoverHighlight = this.checked;
  });

  dom.toggleQC.addEventListener('click', function () {
    state.layers.qcVisible = !state.layers.qcVisible;
    this.classList.toggle('disabled', !state.layers.qcVisible);
    qcMarkers.forEach(m => m.setMap(state.layers.qcVisible ? map : null));
  });

  // ── 12. Measurement Tool ──────────────────────────────────────────────────
  dom.btnMeasure.addEventListener('click', () => {
    if (state.isMeasuring) finishMeasurement();
    else startMeasurement();
  });

  dom.btnFinishMeasure.addEventListener('click', finishMeasurement);
  dom.btnClearMeasure.addEventListener('click', clearMeasurement);

  function startMeasurement() {
    state.isMeasuring = true;
    dom.btnMeasure.classList.add('active');
    dom.measureBanner.classList.add('active');
    dom.measureVal.textContent = 'Click Earth points to measure distance & area';
    if (map) map.setOptions({ draggableCursor: 'crosshair' });
  }

  function finishMeasurement() {
    state.isMeasuring = false;
    dom.btnMeasure.classList.remove('active');
    dom.measureBanner.classList.remove('active');
    if (map) map.setOptions({ draggableCursor: null });
  }

  function clearMeasurement() {
    state.measurePoints = [];
    state.measureMarkers.forEach(m => m.setMap(null));
    state.measureMarkers = [];
    if (state.measureLine) state.measureLine.setMap(null);
    if (state.measurePolygon) state.measurePolygon.setMap(null);
    state.measureLine = null;
    state.measurePolygon = null;
    dom.measureVal.textContent = 'Click Earth points to measure';
  }

  function addMeasurePoint(latLng) {
    state.measurePoints.push(latLng);

    const marker = new google.maps.Marker({
      position: latLng,
      map: map,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 4,
        fillColor: '#00e5ff',
        fillOpacity: 1,
        strokeColor: '#040c17',
        strokeWeight: 2
      }
    });
    state.measureMarkers.push(marker);

    const pts = state.measurePoints;

    if (pts.length >= 2) {
      if (!state.measureLine) {
        state.measureLine = new google.maps.Polyline({
          path: pts,
          strokeColor: '#00e5ff',
          strokeWeight: 3,
          strokeOpacity: 0.9,
          map: map
        });
      } else {
        state.measureLine.setPath(pts);
      }
    }

    let distM = 0;
    if (window.google.maps.geometry) {
      for (let i = 0; i < pts.length - 1; i++) {
        distM += google.maps.geometry.spherical.computeDistanceBetween(pts[i], pts[i + 1]);
      }
    }

    if (pts.length >= 3) {
      if (!state.measurePolygon) {
        state.measurePolygon = new google.maps.Polygon({
          paths: pts,
          strokeColor: '#00e5ff',
          strokeWeight: 2,
          fillColor: '#00e5ff',
          fillOpacity: 0.15,
          map: map
        });
      } else {
        state.measurePolygon.setPaths(pts);
      }

      let areaSqM = 0;
      if (window.google.maps.geometry) {
        areaSqM = google.maps.geometry.spherical.computeArea(pts);
      }
      const distKm = (distM / 1000).toFixed(2);
      dom.measureVal.textContent = `Distance: ${distKm} km · Area: ${areaSqM.toFixed(1)} m²`;
    } else {
      const distKm = (distM / 1000).toFixed(2);
      dom.measureVal.textContent = `Distance: ${distM > 1000 ? distKm + ' km' : distM.toFixed(0) + ' m'}`;
    }
  }

  // ── 13. File Input Handlers ───────────────────────────────────────────────
  dom.dropZone.addEventListener('click', () => dom.fileInput.click());

  dom.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dom.dropZone.classList.add('dragover');
  });

  dom.dropZone.addEventListener('dragleave', () => dom.dropZone.classList.remove('dragover'));

  dom.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dom.dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  });

  dom.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  });

  dom.btnRemoveFile.addEventListener('click', () => {
    state.selectedFile = null;
    state.selectedFileUrl = null;
    dom.fileInput.value = '';
    dom.filePreview.classList.remove('visible');
    dom.btnRunInference.disabled = true;
  });

  function handleFileSelected(file) {
    state.selectedFile = file;
    state.selectedFileUrl = URL.createObjectURL(file);
    dom.fileName.textContent = file.name;
    dom.fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB`;
    dom.filePreview.classList.add('visible');
    dom.btnRunInference.disabled = false;
  }

  // ── 14. Mobile Navigation & View Controls ─────────────────────────────────
  dom.btnResetView.addEventListener('click', () => {
    if (map && state.aoiBounds) {
      map.fitBounds(state.aoiBounds);
    } else if (map) {
      map.setCenter(DEFAULT_CENTER);
      map.setZoom(DEFAULT_ZOOM);
    }
  });

  dom.btnFullscreen.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      dom.btnFullscreen.classList.add('active');
    } else {
      document.exitFullscreen().catch(() => {});
      dom.btnFullscreen.classList.remove('active');
    }
  });

  dom.btnToggleLegend.addEventListener('click', () => {
    const isHidden = dom.legendItems.style.display === 'none';
    dom.legendItems.style.display = isHidden ? 'flex' : 'none';
    dom.legendChevron.className = isHidden ? 'fa-solid fa-chevron-down' : 'fa-solid fa-chevron-up';
  });

  // Mobile Menu
  dom.mobileMenuBtn.addEventListener('click', () => {
    dom.gisSidebar.classList.add('mobile-open');
    dom.sidebarBackdrop.classList.add('active');
  });

  const closeSidebar = () => {
    dom.gisSidebar.classList.remove('mobile-open');
    dom.sidebarBackdrop.classList.remove('active');
  };

  dom.sidebarBackdrop.addEventListener('click', closeSidebar);
  dom.sidebarMobileClose.addEventListener('click', closeSidebar);

  // Desktop Toggle
  dom.sidebarToggle.addEventListener('click', () => {
    const isCollapsed = dom.gisSidebar.classList.toggle('collapsed');
    dom.sidebarToggleIcon.className = isCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
    setTimeout(() => { if (map) google.maps.event.trigger(map, 'resize'); }, 300);
  });

  // Tabs
  dom.tabButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const target = this.getAttribute('data-tab');
      dom.tabButtons.forEach(b => b.classList.remove('active'));
      dom.tabPanes.forEach(p => p.classList.remove('active'));
      this.classList.add('active');
      const pane = document.getElementById(target);
      if (pane) pane.classList.add('active');
    });
  });

  // Mobile Bottom Nav
  if (dom.mobileBottomNav) {
    dom.mobileBottomNav.querySelectorAll('.mobile-nav-item').forEach(btn => {
      btn.addEventListener('click', function () {
        dom.mobileBottomNav.querySelectorAll('.mobile-nav-item').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const action = this.getAttribute('data-action');

        if (action === 'map') {
          closeSidebar();
          dom.attrDrawer.classList.add('collapsed');
        } else if (action === 'aoi') {
          dom.gisSidebar.classList.add('mobile-open');
          dom.sidebarBackdrop.classList.add('active');
          document.getElementById('tabBtnIngest').click();
        } else if (action === 'lulc') {
          dom.gisSidebar.classList.add('mobile-open');
          dom.sidebarBackdrop.classList.add('active');
          document.getElementById('tabBtnClasses').click();
        } else if (action === 'layers') {
          dom.gisSidebar.classList.add('mobile-open');
          dom.sidebarBackdrop.classList.add('active');
          document.getElementById('tabBtnLayers').click();
        } else if (action === 'table') {
          closeSidebar();
          dom.attrDrawer.classList.remove('collapsed');
          dom.btnAttrTable.classList.add('active');
        }
      });
    });
  }

  // Stepper utility
  function setPipelineStep(stepIdx) {
    for (let i = 1; i <= 5; i++) {
      const step = document.getElementById(`step${i}`);
      if (!step) continue;
      step.classList.remove('active', 'completed');
      if (i < stepIdx) step.classList.add('completed');
      else if (i === stepIdx) step.classList.add('active');
    }
  }

  function delay(ms) {
    return new Promise(res => setTimeout(res, ms));
  }

  // ── 15. Boot Application ───────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGoogleEarth);
  } else {
    initGoogleEarth();
  }

})();