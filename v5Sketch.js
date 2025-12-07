// v5 Sketch - p5.js JavaScript only Voronoi (no shader)
let v5Sketch = function(p) {
    let Canvas;
    let OverlayCanvas;
    let PARAMS;
    let points = []; // Voronoi cell 중심점들
    let numCells = 30; // 중앙 영역의 cell 개수
    
    // Shader와 동일한 hash 함수 (JavaScript 버전)
    function hash1(uv) {
        const dot = uv[0] * 1234.5678 + uv[1] * 567.8901;
        const sinVal = Math.sin(dot) * 12345.67;
        return sinVal - Math.floor(sinVal);
    }
    
    function hash2(uv) {
        const x = hash1(uv);
        return [x, hash1([uv[0] + x, uv[1] + x])];
    }
    
    // Smooth minimum 함수 (shader와 동일)
    function smin(a, b, t) {
        const c = Math.max(0, Math.min(1, 0.5 + (a - b) / t));
        return (1 - c) * (a - 0.5 * t * c) + c * b;
    }
    
    // Smooth Voronoi 계산 (shader의 voronoi 함수와 동일한 로직)
    function calculateSmoothVoronoi(uv, time, sminValue) {
        const TAU = Math.PI * 2;
        const fuv = [uv[0] - Math.floor(uv[0]), uv[1] - Math.floor(uv[1])];
        const iuv = [Math.floor(uv[0]), Math.floor(uv[1])];
        
        let mdst = 8;
        let moff = [0, 0];
        let mdir = [0, 0];
        
        // 가장 가까운 cell 찾기
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                const off = [x, y];
                const pos = hash2([iuv[0] + off[0], iuv[1] + off[1]]);
                const animatedPos = [
                    0.5 + 0.49 * Math.sin(time + pos[0] * TAU),
                    0.5 + 0.49 * Math.sin(time + pos[1] * TAU)
                ];
                const dir = [
                    animatedPos[0] + off[0] - fuv[0],
                    animatedPos[1] + off[1] - fuv[1]
                ];
                const dst = dir[0] * dir[0] + dir[1] * dir[1];
                
                if (dst < mdst) {
                    mdst = dst;
                    moff = off;
                    mdir = dir;
                }
            }
        }
        
        // Interior distances 계산 (smooth minimum 사용)
        let midst = 8;
        for (let x = -2; x <= 2; x++) {
            for (let y = -2; y <= 2; y++) {
                const off = [moff[0] + x, moff[1] + y];
                const pos = hash2([iuv[0] + off[0], iuv[1] + off[1]]);
                const animatedPos = [
                    0.5 + 0.49 * Math.sin(time + pos[0] * TAU),
                    0.5 + 0.49 * Math.sin(time + pos[1] * TAU)
                ];
                const dir = [
                    animatedPos[0] + off[0] - fuv[0],
                    animatedPos[1] + off[1] - fuv[1]
                ];
                
                const mdirMinusDir = [mdir[0] - dir[0], mdir[1] - dir[1]];
                const dotDiff = mdirMinusDir[0] * mdirMinusDir[0] + mdirMinusDir[1] * mdirMinusDir[1];
                
                if (dotDiff > 0.00001) {
                    const dirDiff = [dir[0] - mdir[0], dir[1] - mdir[1]];
                    const dirDiffLen = Math.sqrt(dirDiff[0] * dirDiff[0] + dirDiff[1] * dirDiff[1]);
                    if (dirDiffLen > 0) {
                        const normalized = [dirDiff[0] / dirDiffLen, dirDiff[1] / dirDiffLen];
                        const midDir = [(mdir[0] + dir[0]) * 0.5, (mdir[1] + dir[1]) * 0.5];
                        const idst = midDir[0] * normalized[0] + midDir[1] * normalized[1];
                        midst = smin(midst, idst, Math.abs(sminValue));
                    }
                }
            }
        }
        
        return { mdst: mdst, midst: midst };
    }
    
    // Cell 경계를 smooth하게 변환하는 함수 (v3의 smooth minimum 효과 모방)
    // v3의 shader는 smooth minimum을 사용하여 cell 경계를 둥글게 만듭니다
    function smoothCellBoundary(cellPoints, centerX, centerY, sminValue) {
        if (!cellPoints || cellPoints.length < 3) return cellPoints;
        
        // Smin 값에 따라 smoothing 강도 조절 (1.0일 때 최대 효과)
        // v3에서는 Smin이 1.0일 때 가장 둥근 모양 (물방울처럼)
        const smoothingStrength = sminValue * 3.0; // Smin 값에 비례하여 smoothing 강도
        
        // 각 꼭짓점에서 중심까지의 거리 계산
        const distances = cellPoints.map(pt => {
            const dx = pt[0] - centerX;
            const dy = pt[1] - centerY;
            return Math.sqrt(dx * dx + dy * dy);
        });
        const avgDist = distances.reduce((a, b) => a + b, 0) / distances.length;
        
        const smoothed = [];
        for (let i = 0; i < cellPoints.length; i++) {
            const prev = cellPoints[(i - 1 + cellPoints.length) % cellPoints.length];
            const curr = cellPoints[i];
            const next = cellPoints[(i + 1) % cellPoints.length];
            
            // 현재 점에서 중심으로 향하는 방향
            const toCenterX = centerX - curr[0];
            const toCenterY = centerY - curr[1];
            const toCenterLen = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);
            
            if (toCenterLen > 0) {
                // 중심 방향으로 이동하여 둥글게 만들기
                // v3의 smooth minimum 효과를 모방: 중심 방향으로 이동
                const moveAmount = smoothingStrength * 0.15; // 이동 거리
                const smoothX = curr[0] + (toCenterX / toCenterLen) * moveAmount;
                const smoothY = curr[1] + (toCenterY / toCenterLen) * moveAmount;
                smoothed.push([smoothX, smoothY]);
            } else {
                smoothed.push(curr);
            }
        }
        
        return smoothed;
    }
    
    // Cell 위치 생성 (v3의 shader 로직과 동일)
    function generateCellPositions(time, scale) {
        const TAU = Math.PI * 2;
        const aspectRatio = p.width / p.height;
        const centerRadius = 0.35;
        const cellMap = new Map();
        
        // 가능한 모든 cell의 범위를 순회
        const gridRange = Math.ceil(centerRadius * scale * 2) + 3;
        
        for (let cellIuvX = -gridRange; cellIuvX <= gridRange; cellIuvX++) {
            for (let cellIuvY = -gridRange; cellIuvY <= gridRange; cellIuvY++) {
                const pos = hash2([cellIuvX, cellIuvY]);
                const animatedPos = [
                    0.5 + 0.49 * Math.sin(time + pos[0] * TAU),
                    0.5 + 0.49 * Math.sin(time + pos[1] * TAU)
                ];
                
                const cellCenterShaderX = cellIuvX + animatedPos[0];
                const cellCenterShaderY = cellIuvY + animatedPos[1];
                
                const normalizedX = cellCenterShaderX / scale;
                const normalizedY = cellCenterShaderY / scale;
                
                const distFromCenter = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
                if (distFromCenter <= centerRadius) {
                    const centerX = (normalizedX / aspectRatio + 0.5) * p.width;
                    const centerY = (normalizedY + 0.5) * p.height;
                    
                    const cellKey = `${cellIuvX},${cellIuvY}`;
                    if (!cellMap.has(cellKey)) {
                        cellMap.set(cellKey, {
                            x: centerX,
                            y: centerY,
                            iuv: [cellIuvX, cellIuvY]
                        });
                    }
                }
            }
        }
        
        const cellsArray = Array.from(cellMap.values());
        cellsArray.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.x - p.width/2, 2) + Math.pow(a.y - p.height/2, 2));
            const distB = Math.sqrt(Math.pow(b.x - p.width/2, 2) + Math.pow(b.y - p.height/2, 2));
            return distA - distB;
        });
        
        return cellsArray.slice(0, Math.min(numCells, cellsArray.length));
    }
    
    // Color conversion helpers
    function rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => {
            const hex = Math.round(x * 255).toString(16);
            return hex.length === 1 ? '0' + hex : hex;
        }).join('');
    }
    
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16) / 255,
            g: parseInt(result[2], 16) / 255,
            b: parseInt(result[3], 16) / 255
        } : null;
    }
    
    p.preload = function() {
        // No preload needed
    };

    p.setup = function() {
        console.log('v5 setup called');
        
        // 기존 canvas 숨기기
        const existingCanvas = document.getElementById('voronoiCanvas');
        if (existingCanvas) {
            existingCanvas.style.display = 'none';
        }
        
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        if (canvas && canvas.elt) {
            canvas.elt.style.position = 'fixed';
            canvas.elt.style.top = '0';
            canvas.elt.style.left = '0';
            canvas.elt.style.zIndex = '1';
            canvas.elt.style.pointerEvents = 'none';
            console.log('Canvas created and styled');
        }
        
        p.pixelDensity(1);
        Canvas = p.createGraphics(p.width, p.height);
        OverlayCanvas = p.createGraphics(p.width, p.height);
        p.noStroke();
        Canvas.noStroke();
        OverlayCanvas.noStroke();
        p.background(255);
        
        // PARAMS 초기화 (v3와 동일한 기본값)
        PARAMS = {
            Mode: 'Fill',
            FillColor: { r: 1, g: 1, b: 1 },
            Contour: false,
            Edge: true,
            EdgeColor: { r: 121/255, g: 76/255, b: 212/255 },
            Point: true,
            PointColor: { r: 0, g: 0, b: 0 },
            Speed: 0.027,
            Scale: 7.7,
            Smin: 1.0,
            DotSize: 6.0,
            TextSize: 24,
        };
        
        // 전역 변수에 저장
        v5PARAMS = PARAMS;
        
        // UI 컨트롤 설정
        setupV5Controls();
    };

    p.windowResized = function() {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        Canvas = p.createGraphics(p.width, p.height);
        OverlayCanvas = p.createGraphics(p.width, p.height);
        Canvas.noStroke();
        OverlayCanvas.noStroke();
    };

    p.draw = function() {
        if (!PARAMS) {
            console.warn('PARAMS not initialized');
            p.background(255);
            return;
        }
        
        try {
            // 배경 그리기
            p.background(255);
            Canvas.clear();
            OverlayCanvas.clear();
            
            const time = p.frameCount * PARAMS.Speed;
            const scale = PARAMS.Scale;
            
            // Cell 위치 생성
            points = generateCellPositions(time, scale);
            
            // d3.Delaunay를 사용하여 Voronoi diagram 생성
            if (typeof d3 === 'undefined' || typeof d3.Delaunay === 'undefined') {
                console.error('d3.Delaunay is not available');
                return;
            }
            
            // Point 배열 준비
            const pointArray = points.map(pt => [pt.x, pt.y]);
            const delaunay = d3.Delaunay.from(pointArray);
            const voronoi = delaunay.voronoi([0, 0, p.width, p.height]);
            
            // Voronoi cells 그리기
            for (let i = 0; i < points.length; i++) {
                const cellPath = voronoi.renderCell(i);
                if (!cellPath) continue;
                
                const point = points[i];
                
                // SVG path를 파싱하여 좌표 추출
                // path 형식: "M x,y L x,y L x,y ... Z"
                const pathMatch = cellPath.match(/[ML]\s*([\d.e-]+)\s*,\s*([\d.e-]+)/g);
                if (!pathMatch || pathMatch.length === 0) continue;
                
                const cellPoints = [];
                for (const match of pathMatch) {
                    const coords = match.substring(1).trim().split(/\s*,\s*/);
                    if (coords.length >= 2) {
                        cellPoints.push([parseFloat(coords[0]), parseFloat(coords[1])]);
                    }
                }
                
                if (cellPoints.length === 0) continue;
                
                // Smooth cell boundary 적용 (Smin 값에 따라)
                const sminValue = PARAMS.Smin || 1.0;
                const smoothedPoints = smoothCellBoundary(cellPoints, point.x, point.y, sminValue);
                
                // Fill
                if (PARAMS.Mode === 'Fill') {
                    Canvas.fill(
                        PARAMS.FillColor.r * 255,
                        PARAMS.FillColor.g * 255,
                        PARAMS.FillColor.b * 255
                    );
                    Canvas.noStroke();
                    Canvas.beginShape();
                    for (const pt of smoothedPoints) {
                        Canvas.vertex(pt[0], pt[1]);
                    }
                    Canvas.endShape(p.CLOSE);
                }
                
                // Grayscale
                if (PARAMS.Mode === 'Grayscale') {
                    const gray = hash1(point.iuv) * 255;
                    Canvas.fill(gray);
                    Canvas.noStroke();
                    Canvas.beginShape();
                    for (const pt of smoothedPoints) {
                        Canvas.vertex(pt[0], pt[1]);
                    }
                    Canvas.endShape(p.CLOSE);
                }
                
                // Colorful
                if (PARAMS.Mode === 'Colorful') {
                    const color = hash2(point.iuv);
                    Canvas.fill(
                        color[0] * 255,
                        color[1] * 255,
                        (color[0] + color[1]) / 2 * 255
                    );
                    Canvas.noStroke();
                    Canvas.beginShape();
                    for (const pt of smoothedPoints) {
                        Canvas.vertex(pt[0], pt[1]);
                    }
                    Canvas.endShape(p.CLOSE);
                }
                
                // Distances (간단한 구현)
                if (PARAMS.Mode === 'Distances') {
                    const centerX = p.width / 2;
                    const centerY = p.height / 2;
                    const dist = Math.sqrt(
                        Math.pow(point.x - centerX, 2) + 
                        Math.pow(point.y - centerY, 2)
                    );
                    const normalized = dist / (Math.min(p.width, p.height) * 0.5);
                    Canvas.fill(normalized * 255);
                    Canvas.noStroke();
                    Canvas.beginShape();
                    for (const pt of smoothedPoints) {
                        Canvas.vertex(pt[0], pt[1]);
                    }
                    Canvas.endShape(p.CLOSE);
                }
                
                // Contour
                if (PARAMS.Contour) {
                    const centerX = p.width / 2;
                    const centerY = p.height / 2;
                    const dist = Math.sqrt(
                        Math.pow(point.x - centerX, 2) + 
                        Math.pow(point.y - centerY, 2)
                    );
                    const contour = 0.5 + 0.5 * Math.cos(dist * 0.1);
                    Canvas.fill(contour * 255);
                    Canvas.noStroke();
                    Canvas.beginShape();
                    for (const pt of smoothedPoints) {
                        Canvas.vertex(pt[0], pt[1]);
                    }
                    Canvas.endShape(p.CLOSE);
                }
                
                // Edge
                if (PARAMS.Edge) {
                    Canvas.stroke(
                        PARAMS.EdgeColor.r * 255,
                        PARAMS.EdgeColor.g * 255,
                        PARAMS.EdgeColor.b * 255
                    );
                    Canvas.strokeWeight(1);
                    Canvas.noFill();
                    Canvas.beginShape();
                    for (const pt of smoothedPoints) {
                        Canvas.vertex(pt[0], pt[1]);
                    }
                    Canvas.endShape(p.CLOSE);
                }
                
                // Point
                if (PARAMS.Point) {
                    OverlayCanvas.fill(
                        PARAMS.PointColor.r * 255,
                        PARAMS.PointColor.g * 255,
                        PARAMS.PointColor.b * 255
                    );
                    OverlayCanvas.noStroke();
                    OverlayCanvas.circle(point.x, point.y, PARAMS.DotSize);
                }
            }
            
            p.image(Canvas, 0, 0);
            
            // Text 그리기 (Point 위치를 따라 - 오른쪽에 배치)
            if (PARAMS.Point) {
                OverlayCanvas.fill(0);
                OverlayCanvas.textAlign(p.LEFT, p.CENTER); // 왼쪽 정렬로 변경
                OverlayCanvas.textSize(PARAMS.TextSize);
                
                for (let i = 0; i < points.length; i++) {
                    const point = points[i];
                    // Point의 오른쪽에 텍스트 배치 (Point 크기의 절반 + 여백)
                    const textOffset = PARAMS.DotSize / 2 + 5;
                    OverlayCanvas.text('cciD', point.x + textOffset, point.y);
                }
            }
            
            p.image(OverlayCanvas, 0, 0);
        } catch (error) {
            console.error('Error in draw():', error);
        }
    };
};

// p5.js 인스턴스
let v5P5Instance = null;

// PARAMS를 전역으로 접근 가능하도록
let v5PARAMS = null;

// Tweakpane 인스턴스
let v5Pane = null;

function setupV5Controls() {
    // 이미 Tweakpane이 생성되어 있으면 제거
    if (v5Pane) {
        v5Pane.dispose();
        v5Pane = null;
    }

    let TweakpaneAvailable = typeof Tweakpane !== 'undefined';
    
    if (!TweakpaneAvailable && typeof window !== 'undefined') {
        TweakpaneAvailable = !!window.Tweakpane;
    }
    
    if (!TweakpaneAvailable) {
        console.error('Tweakpane not loaded. Retrying in 500ms...');
        setTimeout(setupV5Controls, 500);
        return;
    }

    if (!v5PARAMS) {
        console.warn('v5PARAMS not initialized, using default values');
        v5PARAMS = {
            Mode: 'Fill',
            FillColor: { r: 1, g: 1, b: 1 },
            Contour: false,
            Edge: true,
            EdgeColor: { r: 121/255, g: 76/255, b: 212/255 },
            Point: true,
            PointColor: { r: 0, g: 0, b: 0 },
            Speed: 0.027,
            Scale: 7.7,
            Smin: 1.0,
            DotSize: 6.0,
            TextSize: 24,
        };
    } else {
        if (typeof v5PARAMS.DotSize === 'undefined') {
            v5PARAMS.DotSize = 6.0;
        }
        if (typeof v5PARAMS.TextSize === 'undefined') {
            v5PARAMS.TextSize = 24;
        }
    }
    
    console.log('Setting up v5 Tweakpane with params:', v5PARAMS);

    const TweakpaneClass = typeof Tweakpane !== 'undefined' ? Tweakpane : (typeof window !== 'undefined' && window.Tweakpane ? window.Tweakpane : null);
    
    if (!TweakpaneClass) {
        console.error('Tweakpane class not available');
        return;
    }
    
    try {
        v5Pane = new TweakpaneClass.Pane({
            title: 'V5 Parameters',
            container: document.body,
        });
        console.log('Tweakpane instance created successfully');
    } catch (error) {
        console.error('Error creating Tweakpane instance:', error);
        return;
    }

    // 위치를 오른쪽으로 설정
    const paneElement = v5Pane.element;
    if (paneElement) {
        paneElement.style.position = 'fixed';
        paneElement.style.right = '20px';
        paneElement.style.top = '50%';
        paneElement.style.transform = 'translateY(-50%)';
        paneElement.style.zIndex = '1001';
    }

    // Mode 선택
    let Mode, FillColor;
    try {
        Mode = v5Pane.addInput(v5PARAMS, 'Mode', {
            options: {
                Fill: 'Fill',
                Distances: 'Distances',
                Interior_Distances: 'InteriorDistances',
                Grayscale: 'Grayscale',
                Colorful: 'Colorful',
            },
        });

        FillColor = v5Pane.addInput(v5PARAMS, 'FillColor', {
            label: 'Fill Color',
            color: { type: 'float' },
            picker: 'inline',
            disabled: v5PARAMS.Mode !== 'Fill',
        });

        if (Mode && Mode.on) {
            Mode.on('change', (ev) => {
                const isFill = ev.value === 'Fill';
                if (FillColor) FillColor.disabled = !isFill;
                v5PARAMS.Mode = ev.value === 'Interior_Distances' ? 'InteriorDistances' : ev.value;
            });
        }
    } catch (e) {
        console.error('Error adding Mode/FillColor to Tweakpane:', e);
    }

    // Contour
    try {
        v5Pane.addInput(v5PARAMS, 'Contour', { label: 'Contour' });
    } catch (e) {
        console.warn('Error adding Contour to Tweakpane:', e);
    }

    v5Pane.addSeparator();

    // Edge
    let Edge, BorderColor;
    try {
        Edge = v5Pane.addInput(v5PARAMS, 'Edge', { label: 'Edge' });
        BorderColor = v5Pane.addInput(v5PARAMS, 'EdgeColor', {
            label: 'Edge Color',
            color: { type: 'float' },
            picker: 'inline',
            disabled: !v5PARAMS.Edge,
        });

        if (Edge && Edge.on) {
            Edge.on('change', (ev) => {
                if (BorderColor) BorderColor.disabled = !ev.value;
            });
        }
    } catch (e) {
        console.warn('Error adding Edge to Tweakpane:', e);
    }

    v5Pane.addSeparator();

    // Point
    let Point, PointColor;
    try {
        Point = v5Pane.addInput(v5PARAMS, 'Point', { label: 'Point' });
        PointColor = v5Pane.addInput(v5PARAMS, 'PointColor', {
            label: 'Point Color',
            color: { type: 'float' },
            picker: 'inline',
            disabled: !v5PARAMS.Point,
        });

        if (Point && Point.on) {
            Point.on('change', (ev) => {
                if (PointColor) PointColor.disabled = !ev.value;
            });
        }
    } catch (e) {
        console.warn('Error adding Point to Tweakpane:', e);
    }

    v5Pane.addSeparator();

    // Speed
    try {
        v5Pane.addInput(v5PARAMS, 'Speed', {
            min: 0,
            max: 0.05,
            step: 0.001,
        });
    } catch (e) {
        console.warn('Error adding Speed to Tweakpane:', e);
    }

    // Scale
    try {
        v5Pane.addInput(v5PARAMS, 'Scale', {
            min: 1,
            max: 20,
            step: 0.1,
        });
    } catch (e) {
        console.warn('Error adding Scale to Tweakpane:', e);
    }

    // Smooth Minimum
    try {
        v5Pane.addInput(v5PARAMS, 'Smin', {
            label: 'Smooth minimum',
            min: 0,
            max: 1,
            step: 0.01,
            disabled: true,
        });
    } catch (e) {
        console.warn('Error adding Smin to Tweakpane:', e);
    }
    
    v5Pane.addSeparator();
    
    // Dot Size
    try {
        v5Pane.addInput(v5PARAMS, 'DotSize', {
            label: 'Dot Size',
            min: 1,
            max: 20,
            step: 0.5,
        });
    } catch (e) {
        console.warn('Error adding DotSize to Tweakpane:', e);
    }
    
    // Text Size
    try {
        v5Pane.addInput(v5PARAMS, 'TextSize', {
            label: 'Text Size',
            min: 12,
            max: 72,
            step: 1,
        });
    } catch (e) {
        console.warn('Error adding TextSize to Tweakpane:', e);
    }

    console.log('v5 Tweakpane created');
    
    if (v5Pane && v5Pane.element) {
        v5Pane.element.style.display = 'block';
        console.log('v5 Tweakpane displayed');
    }
}

function showV5Controls() {
    if (v5Pane && v5Pane.element) {
        v5Pane.element.style.display = 'block';
    }
}

function hideV5Controls() {
    if (v5Pane && v5Pane.element) {
        v5Pane.element.style.display = 'none';
    }
}

