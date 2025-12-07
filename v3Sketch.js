// v3 Sketch - p5.js WebGL Shader based Voronoi
let v3Sketch = function(p) {
    let theShader;
    let WebGL;
    let Canvas;
    let OverlayCanvas;
    let PARAMS;
    
    // Shader와 동일한 hash 함수 (JavaScript 버전)
    // shader: fract(sin(dot(uv, vec2(1234.5678, 567.8901)))*12345.67)
    function hash1(uv) {
        const dot = uv[0] * 1234.5678 + uv[1] * 567.8901;
        const sinVal = Math.sin(dot) * 12345.67;
        // fract = 소수 부분만 (0~1 범위)
        return sinVal - Math.floor(sinVal);
    }
    
    function hash2(uv) {
        const x = hash1(uv);
        // shader: hash1(uv+x) - 여기서 uv+x는 vec2이므로 [uv[0]+x, uv[1]+x]로 해석
        return [x, hash1([uv[0] + x, uv[1] + x])];
    }
    
    // 각 픽셀에서 가장 가까운 cell 찾기 (shader와 동일한 로직)
    function findClosestCell(screenX, screenY, time, scale) {
        const TAU = Math.PI * 2;
        const aspectRatio = p.width / p.height;
        
        // shader 좌표 변환 (정확히 동일)
        // shader: uv = (gl_FragCoord/resolution - 0.5) * [aspectRatio, 1]
        let uvX = (screenX / p.width - 0.5) * aspectRatio;
        let uvY = screenY / p.height - 0.5;
        // shader: uv *= Scale
        uvX *= scale;
        uvY *= scale;
        
        // voronoi: iuv = floor(uv), fuv = fract(uv)
        const iuvX = Math.floor(uvX);
        const iuvY = Math.floor(uvY);
        const fuvX = uvX - iuvX;
        const fuvY = uvY - iuvY;
        
        let minDist = Infinity;
        let closestCell = null;
        let moff = [0, 0];
        
        // 주변 3x3 그리드 확인 (shader와 동일)
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                const off = [x, y];
                // shader: pos = hash2(iuv+off)
                const pos = hash2([iuvX + off[0], iuvY + off[1]]);
                // shader: pos = .5+.49*sin(t+pos*TAU)
                const animatedPos = [
                    0.5 + 0.49 * Math.sin(time + pos[0] * TAU),
                    0.5 + 0.49 * Math.sin(time + pos[1] * TAU)
                ];
                // shader: dir = pos+off-fuv
                const dirX = animatedPos[0] + off[0] - fuvX;
                const dirY = animatedPos[1] + off[1] - fuvY;
                // shader: dst = dot(dir, dir)
                const dist = dirX * dirX + dirY * dirY;
                
                if (dist < minDist) {
                    minDist = dist;
                    moff = off;
                    // cell 중심의 shader 좌표 계산
                    // shader에서: dir = pos+off-fuv
                    // cell 중심에서 fuv=0이므로: dir = pos+off
                    // cell 중심의 shader 좌표 = iuv + pos + off = (iuv + off) + pos
                    const cellIuvX = iuvX + off[0];
                    const cellIuvY = iuvY + off[1];
                    const cellCenterShaderX = cellIuvX + animatedPos[0];
                    const cellCenterShaderY = cellIuvY + animatedPos[1];
                    
                    // 화면 좌표로 역변환 (정확히 동일)
                    // shader: uv = (gl_FragCoord/resolution - 0.5) * [aspectRatio, 1] * Scale
                    // 역변환: 
                    // 1. uv/Scale
                    // 2. /[aspectRatio, 1]
                    // 3. +0.5
                    // 4. *resolution
                    const normalizedX = cellCenterShaderX / scale;
                    const normalizedY = cellCenterShaderY / scale;
                    const centerX = (normalizedX / aspectRatio + 0.5) * p.width;
                    const centerY = (normalizedY + 0.5) * p.height;
                    
                    closestCell = {
                        centerX: centerX,
                        centerY: centerY,
                        iuv: [cellIuvX, cellIuvY]
                    };
                }
            }
        }
        
        return closestCell;
    }
    
    // Cell 중심점 계산 (shader의 point 위치와 정확히 동일)
    // shader에서 Point는 각 cell의 중심에 그려지므로, 각 cell의 중심점을 직접 계산
    // cell 중심점에서 mdst를 계산하여 정확한 위치 확인
    function getCellPositions(time, scale, numCells) {
        const TAU = Math.PI * 2;
        const aspectRatio = p.width / p.height;
        const centerRadius = 0.35; // shader와 동일
        const cellMap = new Map(); // 중복 제거용
        
        // 가능한 모든 cell의 범위를 순회
        const gridRange = Math.ceil(centerRadius * scale * 2) + 3;
        
        // 모든 가능한 cellIuv를 순회하여 중심점 직접 계산
        for (let cellIuvX = -gridRange; cellIuvX <= gridRange; cellIuvX++) {
            for (let cellIuvY = -gridRange; cellIuvY <= gridRange; cellIuvY++) {
                // shader와 동일한 로직으로 cell 중심점 계산
                const pos = hash2([cellIuvX, cellIuvY]);
                const animatedPos = [
                    0.5 + 0.49 * Math.sin(time + pos[0] * TAU),
                    0.5 + 0.49 * Math.sin(time + pos[1] * TAU)
                ];
                
                // cell 중심의 shader 좌표 = cellIuv + animatedPos
                const cellCenterShaderX = cellIuvX + animatedPos[0];
                const cellCenterShaderY = cellIuvY + animatedPos[1];
                
                // 화면 좌표로 변환 (shader의 역변환)
                const normalizedX = cellCenterShaderX / scale;
                const normalizedY = cellCenterShaderY / scale;
                
                // 중앙 영역 확인
                const distFromCenter = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
                if (distFromCenter <= centerRadius) {
                    // 화면 좌표로 변환
                    const centerX = (normalizedX / aspectRatio + 0.5) * p.width;
                    const centerY = (normalizedY + 0.5) * p.height;
                    
                    // cell 중심점에서 mdst를 계산하여 정확성 확인
                    // cell 중심점의 shader 좌표를 다시 변환
                    const testUvX = (centerX / p.width - 0.5) * aspectRatio * scale;
                    const testUvY = (centerY / p.height - 0.5) * scale;
                    const testIuvX = Math.floor(testUvX);
                    const testIuvY = Math.floor(testUvY);
                    const testFuvX = testUvX - testIuvX;
                    const testFuvY = testUvY - testIuvY;
                    
                    // 이 위치에서 mdst 계산
                    let mdst = 8;
                    for (let x = -1; x <= 1; x++) {
                        for (let y = -1; y <= 1; y++) {
                            const off = [x, y];
                            const testPos = hash2([testIuvX + off[0], testIuvY + off[1]]);
                            const testAnimatedPos = [
                                0.5 + 0.49 * Math.sin(time + testPos[0] * TAU),
                                0.5 + 0.49 * Math.sin(time + testPos[1] * TAU)
                            ];
                            const dirX = testAnimatedPos[0] + off[0] - testFuvX;
                            const dirY = testAnimatedPos[1] + off[1] - testFuvY;
                            const dst = dirX * dirX + dirY * dirY;
                            if (dst < mdst) {
                                mdst = dst;
                            }
                        }
                    }
                    
                    // mdst가 매우 작으면 (Point가 그려지는 위치)
                    if (mdst < 0.1) {
                        // cell 식별자로 중복 제거
                        const cellKey = `${cellIuvX},${cellIuvY}`;
                        if (!cellMap.has(cellKey) || cellMap.get(cellKey).mdst > mdst) {
                            cellMap.set(cellKey, {
                                centerX: centerX,
                                centerY: centerY,
                                iuv: [cellIuvX, cellIuvY],
                                mdst: mdst
                            });
                        }
                    }
                }
            }
        }
        
        // Map에서 배열로 변환
        const cellsArray = Array.from(cellMap.values());
        
        // 거리순으로 정렬하고 가까운 30개만 선택
        const centerX = p.width / 2;
        const centerY = p.height / 2;
        cellsArray.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.centerX - centerX, 2) + Math.pow(a.centerY - centerY, 2));
            const distB = Math.sqrt(Math.pow(b.centerX - centerX, 2) + Math.pow(b.centerY - centerY, 2));
            return distA - distB;
        });
        
        return cellsArray.slice(0, Math.min(numCells, cellsArray.length));
    }

    p.preload = function() {
        // Shader를 문자열로 직접 생성
        // p5.js는 loadShader를 파일 경로로 사용하지만, 
        // 우리는 문자열을 사용하므로 setup에서 직접 생성
    };

    p.setup = function() {
        console.log('v3 setup called');
        
        // 기존 canvas 숨기기
        const existingCanvas = document.getElementById('voronoiCanvas');
        if (existingCanvas) {
            existingCanvas.style.display = 'none';
        }
        
        const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
        // canvas가 다른 요소에 가려지지 않도록 스타일 설정
        if (canvas && canvas.elt) {
            canvas.elt.style.position = 'fixed';
            canvas.elt.style.top = '0';
            canvas.elt.style.left = '0';
            canvas.elt.style.zIndex = '1';
            canvas.elt.style.pointerEvents = 'none'; // UI 클릭을 방해하지 않도록
            console.log('Canvas created and styled');
        }
        
        p.pixelDensity(1);
        WebGL = p.createGraphics(p.width, p.height, p.WEBGL);
        Canvas = p.createGraphics(p.width, p.height);
        // Dot과 Text를 그릴 별도 레이어
        OverlayCanvas = p.createGraphics(p.width, p.height);
        p.noStroke();
        WebGL.noStroke();
        Canvas.noStroke();
        OverlayCanvas.noStroke();
        p.background(255); // 흰색 배경
        
        // Shader 생성 (WebGL graphics가 생성된 후에)
        // shader 변수 확인
        const vertSrc = typeof vertShader !== 'undefined' ? vertShader : (typeof window.vertShader !== 'undefined' ? window.vertShader : null);
        const fragSrc = typeof fragShader !== 'undefined' ? fragShader : (typeof window.fragShader !== 'undefined' ? window.fragShader : null);
        const voronoiSrc = typeof voronoiShader !== 'undefined' ? voronoiShader : (typeof window.voronoiShader !== 'undefined' ? window.voronoiShader : null);
        
        if (!vertSrc || !fragSrc || !voronoiSrc) {
            console.error('Shader variables not defined:', {
                vertShader: !!vertSrc,
                fragShader: !!fragSrc,
                voronoiShader: !!voronoiSrc
            });
            theShader = null;
        } else {
            // fragShader에서 주석 부분을 voronoiShader로 치환
            const frag = fragSrc.replace('// Voronoi shader code will be inserted here', voronoiSrc);
            try {
                // WebGL graphics의 renderer를 사용하여 shader 생성
                theShader = WebGL.createShader(vertSrc, frag);
                if (!theShader) {
                    console.error('Shader creation failed - createShader returned null');
                    // 폴백: p5 인스턴스의 createShader 시도
                    try {
                        theShader = p.createShader(vertSrc, frag);
                        console.log('Shader created using p5 instance');
                    } catch (e2) {
                        console.error('Fallback shader creation also failed:', e2);
                    }
                } else {
                    console.log('Shader created successfully using WebGL graphics');
                }
            } catch (error) {
                console.error('Error creating shader:', error);
                // 폴백 시도
                try {
                    theShader = p.createShader(vertSrc, frag);
                    console.log('Shader created using fallback method');
                } catch (e2) {
                    console.error('Fallback shader creation failed:', e2);
                    theShader = null;
                }
            }
        }

        // PARAMS 초기화
        PARAMS = {
            Mode: 'Fill',
            FillColor: { r: 1, g: 1, b: 1 }, // rgb(255, 255, 255)
            Contour: false,
            Edge: true,
            EdgeColor: { r: 121/255, g: 76/255, b: 212/255 }, // rgb(121, 76, 212)
            Point: true, // point를 활성화하여 위치 추적
            PointColor: { r: 0, g: 0, b: 0 },
            Speed: 0.027,
            Scale: 7.7, // 30% 큰 cell을 위해 10.0에서 7.7로 조정 (작을수록 큰 cell)
            Smin: 1.0, // 고정값: 1.0
            DotSize: 6.0,
            TextSize: 24,
        };
        
        // 전역 변수에 저장
        v3PARAMS = PARAMS;

        // UI 컨트롤 설정
        setupV3Controls();
    };

    p.windowResized = function() {
        p.resizeCanvas(p.windowWidth, p.windowHeight);
        WebGL = p.createGraphics(p.width, p.height, p.WEBGL);
        Canvas = p.createGraphics(p.width, p.height);
        OverlayCanvas = p.createGraphics(p.width, p.height);
        WebGL.noStroke();
        Canvas.noStroke();
        OverlayCanvas.noStroke();
    };

    p.draw = function() {
        if (!theShader || !PARAMS) {
            if (!theShader) console.warn('Shader not initialized');
            if (!PARAMS) console.warn('PARAMS not initialized');
            // shader가 없어도 배경은 그리기
            p.background(255);
            return;
        }
        
        try {
            // 배경 그리기
            p.background(255);
            
            // WebGL graphics에 shader 설정
            WebGL.shader(theShader);
            if (!theShader) {
                console.warn('Shader is null');
                return;
            }
            
            theShader.setUniform('iResolution', [p.width, p.height]);
            // Canvas는 texture로 전달 (필요한 경우)
            if (Canvas) {
                theShader.setUniform('iCanvas', Canvas);
            }
            theShader.setUniform('iMouse', [p.mouseX, p.mouseY]);
            theShader.setUniform('iTime', p.frameCount);

        // Mode
        theShader.setUniform('Fill', PARAMS.Mode == 'Fill');
        theShader.setUniform('Distances', PARAMS.Mode == 'Distances');
        theShader.setUniform('InteriorDistances', PARAMS.Mode == 'InteriorDistances');
        theShader.setUniform('Grayscale', PARAMS.Mode == 'Grayscale');
        theShader.setUniform('Colorful', PARAMS.Mode == 'Colorful');
        theShader.setUniform('FillColor', [PARAMS.FillColor.r, PARAMS.FillColor.g, PARAMS.FillColor.b]);

        // Contour
        theShader.setUniform('Contour', PARAMS.Contour);

        // Edge
        theShader.setUniform('Edge', PARAMS.Edge);
        theShader.setUniform('EdgeColor', [PARAMS.EdgeColor.r, PARAMS.EdgeColor.g, PARAMS.EdgeColor.b]);

        // Point
        theShader.setUniform('Point', PARAMS.Point);
        theShader.setUniform('PointColor', [PARAMS.PointColor.r, PARAMS.PointColor.g, PARAMS.PointColor.b]);

        // Other
        theShader.setUniform('Speed', PARAMS.Speed);
        theShader.setUniform('Scale', PARAMS.Scale);

        // Smooth Minimum Value
        theShader.setUniform('SminValue', PARAMS.Smin);

        WebGL.rect(0, 0, p.width, p.height);

        p.image(WebGL, 0, 0);
        
        // Text 그리기 (point 위치를 정확히 따라)
        // getCellPositions 함수를 사용하여 cell 중심점 계산
        OverlayCanvas.clear();
        
        // Point가 활성화되어 있을 때만 텍스트 그리기
        if (!PARAMS.Point) {
            p.image(OverlayCanvas, 0, 0);
            return;
        }
        
        OverlayCanvas.fill(0); // #000 color
        OverlayCanvas.noStroke();
        OverlayCanvas.textAlign(p.CENTER, p.CENTER); // 중앙 정렬
        
        const time = p.frameCount * PARAMS.Speed;
        const textSize = PARAMS.TextSize || 24;
        const text = 'cciD';
        
        // getCellPositions 함수를 사용하여 cell 중심점 가져오기
        const cellsArray = getCellPositions(time, PARAMS.Scale, 30);
        
        // 각 cell의 중심점에 텍스트 그리기
        for (let i = 0; i < cellsArray.length; i++) {
            const cell = cellsArray[i];
            OverlayCanvas.fill(0);
            OverlayCanvas.textSize(textSize);
            // Point의 정확한 위치에 텍스트 배치
            OverlayCanvas.text(text, cell.centerX, cell.centerY);
        }
        
        p.image(OverlayCanvas, 0, 0);
        } catch (error) {
            console.error('Error in draw():', error);
        }
    };
};

// p5.js 인스턴스는 나중에 초기화
let v3P5Instance = null;

// PARAMS를 전역으로 접근 가능하도록
let v3PARAMS = null;

// Tweakpane 인스턴스
let v3Pane = null;

function setupV3Controls() {
    // 이미 Tweakpane이 생성되어 있으면 제거
    if (v3Pane) {
        v3Pane.dispose();
        v3Pane = null;
    }

    // Tweakpane이 로드되어 있는지 확인
    // Tweakpane 3.x는 전역 변수로 사용 가능
    let TweakpaneAvailable = typeof Tweakpane !== 'undefined';
    
    if (!TweakpaneAvailable && typeof window !== 'undefined') {
        // window 객체에서도 확인
        TweakpaneAvailable = !!window.Tweakpane;
        if (TweakpaneAvailable) {
            console.log('Found Tweakpane in window object');
        }
    }
    
    if (!TweakpaneAvailable) {
        console.error('Tweakpane not loaded. Checking available globals...');
        if (typeof window !== 'undefined') {
            const tweakKeys = Object.keys(window).filter(k => k.toLowerCase().includes('tweak'));
            console.log('Tweak-related globals:', tweakKeys);
        }
        console.error('Tweakpane not found, retrying in 500ms...');
        // Tweakpane이 로드될 때까지 기다림
        setTimeout(setupV3Controls, 500);
        return;
    }

    // v3PARAMS가 초기화되어 있는지 확인
    if (!v3PARAMS) {
        console.warn('v3PARAMS not initialized, using default values');
        v3PARAMS = {
            Mode: 'Fill',
            FillColor: { r: 1, g: 1, b: 1 }, // rgb(255, 255, 255)
            Contour: false,
            Edge: true,
            EdgeColor: { r: 121/255, g: 76/255, b: 212/255 }, // rgb(121, 76, 212)
            Point: true, // point를 활성화하여 위치 추적
            PointColor: { r: 0, g: 0, b: 0 },
            Speed: 0.027,
            Scale: 7.7, // 30% 큰 cell
            Smin: 1.0,
            DotSize: 6.0,
            TextSize: 24,
        };
    } else {
        // DotSize와 TextSize가 없으면 추가
        if (typeof v3PARAMS.DotSize === 'undefined') {
            v3PARAMS.DotSize = 6.0;
        }
        if (typeof v3PARAMS.TextSize === 'undefined') {
            v3PARAMS.TextSize = 24;
        }
    }
    
    console.log('Setting up v3 Tweakpane with params:', v3PARAMS);

    // Tweakpane 생성 (오른쪽에 배치)
    // Tweakpane 3.x는 전역 변수로 사용 가능
    const TweakpaneClass = typeof Tweakpane !== 'undefined' ? Tweakpane : (typeof window !== 'undefined' && window.Tweakpane ? window.Tweakpane : null);
    
    if (!TweakpaneClass) {
        console.error('Tweakpane class not available. Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('tweak')));
        return;
    }
    
    try {
        v3Pane = new TweakpaneClass.Pane({
            title: 'V3 Parameters',
            container: document.body,
        });
        console.log('Tweakpane instance created successfully');
    } catch (error) {
        console.error('Error creating Tweakpane instance:', error);
        return;
    }

    // 위치를 오른쪽으로 설정
    const paneElement = v3Pane.element;
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
        Mode = v3Pane.addInput(v3PARAMS, 'Mode', {
            options: {
                Fill: 'Fill',
                Distances: 'Distances',
                Interior_Distances: 'InteriorDistances',
                Grayscale: 'Grayscale',
                Colorful: 'Colorful',
            },
        });

        // Fill Color (Mode가 Fill일 때만 활성화)
        FillColor = v3Pane.addInput(v3PARAMS, 'FillColor', {
            label: 'Fill Color',
            color: { type: 'float' },
            picker: 'inline',
            disabled: v3PARAMS.Mode !== 'Fill',
        });

        if (Mode && Mode.on) {
            Mode.on('change', (ev) => {
                const isFill = ev.value === 'Fill';
                if (FillColor) FillColor.disabled = !isFill;
                v3PARAMS.Mode = ev.value === 'Interior_Distances' ? 'InteriorDistances' : ev.value;
            });
        }
    } catch (e) {
        console.error('Error adding Mode/FillColor to Tweakpane:', e);
    }

    // Contour
    try {
        v3Pane.addInput(v3PARAMS, 'Contour', { label: 'Contour' });
    } catch (e) {
        console.warn('Error adding Contour to Tweakpane:', e);
    }

    v3Pane.addSeparator();

    // Edge
    let Edge, BorderColor;
    try {
        Edge = v3Pane.addInput(v3PARAMS, 'Edge', { label: 'Edge' });
        BorderColor = v3Pane.addInput(v3PARAMS, 'EdgeColor', {
            label: 'Edge Color',
            color: { type: 'float' },
            picker: 'inline',
            disabled: !v3PARAMS.Edge,
        });

        if (Edge && Edge.on) {
            Edge.on('change', (ev) => {
                if (BorderColor) BorderColor.disabled = !ev.value;
            });
        }
    } catch (e) {
        console.warn('Error adding Edge to Tweakpane:', e);
    }

    v3Pane.addSeparator();

    // Point
    let Point, PointColor;
    try {
        Point = v3Pane.addInput(v3PARAMS, 'Point', { label: 'Point' });
        PointColor = v3Pane.addInput(v3PARAMS, 'PointColor', {
            label: 'Point Color',
            color: { type: 'float' },
            picker: 'inline',
            disabled: !v3PARAMS.Point,
        });

        if (Point && Point.on) {
            Point.on('change', (ev) => {
                if (PointColor) PointColor.disabled = !ev.value;
            });
        }
    } catch (e) {
        console.warn('Error adding Point to Tweakpane:', e);
    }

    v3Pane.addSeparator();

    // Speed
    try {
        v3Pane.addInput(v3PARAMS, 'Speed', {
            min: 0,
            max: 0.05,
            step: 0.001,
        });
    } catch (e) {
        console.warn('Error adding Speed to Tweakpane:', e);
    }

    // Scale
    try {
        v3Pane.addInput(v3PARAMS, 'Scale', {
            min: 1,
            max: 20,
            step: 0.1,
        });
    } catch (e) {
        console.warn('Error adding Scale to Tweakpane:', e);
    }

    // Smooth Minimum (고정값이지만 표시용)
    try {
        v3Pane.addInput(v3PARAMS, 'Smin', {
            label: 'Smooth minimum',
            min: 0,
            max: 1,
            step: 0.01,
            disabled: true, // 고정값이므로 비활성화
        });
    } catch (e) {
        console.warn('Error adding Smin to Tweakpane:', e);
    }
    
    v3Pane.addSeparator();
    
    // Dot Size
    try {
        v3Pane.addInput(v3PARAMS, 'DotSize', {
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
        v3Pane.addInput(v3PARAMS, 'TextSize', {
            label: 'Text Size',
            min: 12,
            max: 72,
            step: 1,
        });
    } catch (e) {
        console.warn('Error adding TextSize to Tweakpane:', e);
    }

    console.log('v3 Tweakpane created');
    
    // Tweakpane을 즉시 표시
    if (v3Pane && v3Pane.element) {
        v3Pane.element.style.display = 'block';
        console.log('v3 Tweakpane displayed');
    }
}

function showV3Controls() {
    // Tweakpane 표시
    if (v3Pane && v3Pane.element) {
        v3Pane.element.style.display = 'block';
    }
}

function hideV3Controls() {
    // Tweakpane 숨기기
    if (v3Pane && v3Pane.element) {
        v3Pane.element.style.display = 'none';
    }
}

