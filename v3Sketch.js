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
        
        // shader 좌표 변환
        let uvX = (screenX / p.width - 0.5) * aspectRatio;
        let uvY = screenY / p.height - 0.5;
        uvX *= scale;
        uvY *= scale;
        
        // voronoi: iuv = floor(uv)
        const iuvX = Math.floor(uvX);
        const iuvY = Math.floor(uvY);
        const fuvX = uvX - iuvX;
        const fuvY = uvY - iuvY;
        
        let minDist = Infinity;
        let closestCell = null;
        
        // 주변 3x3 그리드 확인 (shader와 동일)
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                const offX = iuvX + x;
                const offY = iuvY + y;
                const pos = hash2([offX, offY]);
                
                const animatedPos = [
                    0.5 + 0.49 * Math.sin(time + pos[0] * TAU),
                    0.5 + 0.49 * Math.sin(time + pos[1] * TAU)
                ];
                
                const dirX = animatedPos[0] + x - fuvX;
                const dirY = animatedPos[1] + y - fuvY;
                const dist = dirX * dirX + dirY * dirY;
                
                if (dist < minDist) {
                    minDist = dist;
                    // cell 중심의 shader 좌표 계산
                    // shader에서: dir = pos+off-fuv
                    // cell 중심의 shader space 좌표 = iuv + pos + off
                    // offX = iuvX + x, offY = iuvY + y이므로:
                    const cellCenterShaderX = offX + animatedPos[0];
                    const cellCenterShaderY = offY + animatedPos[1];
                    
                    // 화면 좌표로 역변환
                    // shader: uv = (gl_FragCoord/resolution - 0.5) * [aspectRatio, 1] * Scale
                    // 역변환: screenCoord = ((uv/Scale) / [aspectRatio, 1] + 0.5) * resolution
                    const normalizedX = cellCenterShaderX / scale;
                    const normalizedY = cellCenterShaderY / scale;
                    const centerX = (normalizedX / aspectRatio + 0.5) * p.width;
                    const centerY = (normalizedY + 0.5) * p.height;
                    
                    closestCell = {
                        centerX: centerX,
                        centerY: centerY,
                        iuv: [offX, offY]
                    };
                }
            }
        }
        
        return closestCell;
    }
    
    // Cell 중심점 계산 (shader의 point 위치와 정확히 동일)
    // shader에서 point는 각 cell의 중심에 그려지는데, 이는 voronoi 함수에서 계산된 위치입니다
    function getCellPositions(time, scale, numCells) {
        const TAU = Math.PI * 2;
        const aspectRatio = p.width / p.height;
        const centerRadius = 0.35; // shader와 동일
        const cellMap = new Map(); // 중복 제거용
        
        // 가능한 모든 cell의 iuv 범위를 순회
        // 중앙 영역에 해당하는 cell만 찾기
        const gridRange = Math.ceil(centerRadius * scale * 2) + 2;
        
        for (let iuvX = -gridRange; iuvX <= gridRange; iuvX++) {
            for (let iuvY = -gridRange; iuvY <= gridRange; iuvY++) {
                // shader의 voronoi 함수와 동일한 로직
                // pos = hash2(iuv+off), 여기서 off는 0 (자기 자신)
                const pos = hash2([iuvX, iuvY]);
                // pos = .5+.49*sin(t+pos*TAU)
                const animatedPos = [
                    0.5 + 0.49 * Math.sin(time + pos[0] * TAU),
                    0.5 + 0.49 * Math.sin(time + pos[1] * TAU)
                ];
                
                // shader에서 point가 그려지는 위치는 각 cell의 중심점
                // cell 중심의 shader 좌표 = iuv + pos (off는 0이므로)
                // 하지만 실제로는 voronoi 함수에서 가장 가까운 cell을 찾을 때
                // dir = pos+off-fuv에서 pos+off가 cell 중심의 상대 위치
                // 실제 cell 중심 = iuv + pos + off (여기서 off는 해당 cell의 offset)
                // point는 각 cell의 중심에 그려지므로, iuv + pos가 cell 중심
                const cellCenterShaderX = iuvX + animatedPos[0];
                const cellCenterShaderY = iuvY + animatedPos[1];
                
                // 화면 좌표로 변환 (shader의 역변환)
                // shader: uv = (gl_FragCoord/resolution - 0.5) * [aspectRatio, 1] * Scale
                // 역변환: screenCoord = ((uv/Scale) / [aspectRatio, 1] + 0.5) * resolution
                const normalizedX = cellCenterShaderX / scale;
                const normalizedY = cellCenterShaderY / scale;
                
                // 중앙 영역에 있는지 확인 (shader와 동일한 로직)
                const distFromCenter = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
                if (distFromCenter <= centerRadius) {
                    const centerX = (normalizedX / aspectRatio + 0.5) * p.width;
                    const centerY = (normalizedY + 0.5) * p.height;
                    
                    const key = `${iuvX},${iuvY}`;
                    if (!cellMap.has(key)) {
                        cellMap.set(key, {
                            centerX: centerX,
                            centerY: centerY,
                            iuv: [iuvX, iuvY]
                        });
                    }
                }
            }
        }
        
        // Map에서 배열로 변환
        const cellsArray = Array.from(cellMap.values());
        
        // 거리순으로 정렬하고 가까운 30개만 선택
        cellsArray.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.centerX - p.width/2, 2) + Math.pow(a.centerY - p.height/2, 2));
            const distB = Math.sqrt(Math.pow(b.centerX - p.width/2, 2) + Math.pow(b.centerY - p.height/2, 2));
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
        
        // Text 그리기 (point 위치를 따라)
        // shader에서 point는 각 cell의 중심에 그려지므로, 그 위치를 정확히 계산
        // shader의 point는 voro.z (mdst)가 0.003~0.005 사이일 때 그려지는데,
        // 이것은 각 픽셀에서 가장 가까운 cell까지의 거리입니다.
        // 따라서 각 cell의 중심점을 정확히 계산해야 합니다.
        OverlayCanvas.clear();
        OverlayCanvas.fill(0); // #000 color
        OverlayCanvas.noStroke();
        OverlayCanvas.textAlign(p.LEFT);
        
        const time = p.frameCount * PARAMS.Speed;
        const scale = PARAMS.Scale;
        const aspectRatio = p.width / p.height;
        const TAU = Math.PI * 2;
        const centerRadius = 0.35;
        const textSize = PARAMS.TextSize || 24;
        const text = 'cciD';
        
        // shader의 point 위치를 정확히 계산
        // shader에서 point는 voro.z (mdst)가 0.003~0.005 사이일 때 그려집니다
        // mdst = dot(dir, dir)이고, dir = pos+off-fuv입니다
        // cell 중심 = iuv + pos + off (shader space에서)
        const cellMap = new Map();
        
        // 가능한 모든 cell의 범위를 순회
        const gridRange = Math.ceil(centerRadius * scale * 2) + 2;
        
        for (let iuvX = -gridRange; iuvX <= gridRange; iuvX++) {
            for (let iuvY = -gridRange; iuvY <= gridRange; iuvY++) {
                // 각 iuv에 대해 주변 offset을 확인
                // shader의 voronoi 함수는 3x3 그리드를 확인하므로
                for (let offX = -1; offX <= 1; offX++) {
                    for (let offY = -1; offY <= 1; offY++) {
                        // cell 식별자: iuv + off
                        const cellIuvX = iuvX + offX;
                        const cellIuvY = iuvY + offY;
                        
                        // shader와 동일한 로직으로 cell 중심점 계산
                        // shader에서: pos = hash2(iuv+off), pos = .5+.49*sin(t+pos*TAU)
                        const pos = hash2([cellIuvX, cellIuvY]);
                        const animatedPos = [
                            0.5 + 0.49 * Math.sin(time + pos[0] * TAU),
                            0.5 + 0.49 * Math.sin(time + pos[1] * TAU)
                        ];
                        
                        // cell 중심의 shader 좌표 = iuv + pos + off
                        // 여기서 iuv는 floor(uv)이고, off는 offset (-1, 0, 1)입니다
                        // 실제로는: cell 중심 = (iuv + off) + pos = cellIuv + pos
                        // 하지만 shader를 보면 dir = pos+off-fuv이므로
                        // cell 중심 = iuv + pos + off입니다
                        const cellCenterShaderX = iuvX + animatedPos[0] + offX;
                        const cellCenterShaderY = iuvY + animatedPos[1] + offY;
                        
                        // 화면 좌표로 변환
                        const normalizedX = cellCenterShaderX / scale;
                        const normalizedY = cellCenterShaderY / scale;
                        
                        // 중앙 영역에 있는지 확인
                        const distFromCenter = Math.sqrt(normalizedX * normalizedX + normalizedY * normalizedY);
                        if (distFromCenter <= centerRadius) {
                            const centerX = (normalizedX / aspectRatio + 0.5) * p.width;
                            const centerY = (normalizedY + 0.5) * p.height;
                            
                            // cell 식별자로 중복 제거 (iuv + off)
                            const cellKey = `${cellIuvX},${cellIuvY}`;
                            if (!cellMap.has(cellKey)) {
                                cellMap.set(cellKey, {
                                    centerX: centerX,
                                    centerY: centerY
                                });
                            }
                        }
                    }
                }
            }
        }
        
        // Map에서 배열로 변환하고 거리순으로 정렬
        const cellsArray = Array.from(cellMap.values());
        cellsArray.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.centerX - p.width/2, 2) + Math.pow(a.centerY - p.height/2, 2));
            const distB = Math.sqrt(Math.pow(b.centerX - p.width/2, 2) + Math.pow(b.centerY - p.height/2, 2));
            return distA - distB;
        });
        
        // 가까운 30개 cell에만 text 그리기
        const numCells = Math.min(30, cellsArray.length);
        for (let i = 0; i < numCells; i++) {
            const cell = cellsArray[i];
            OverlayCanvas.fill(0);
            OverlayCanvas.textSize(textSize);
            // point의 오른쪽에 text 배치
            OverlayCanvas.text(text, cell.centerX + 5, cell.centerY + textSize * 0.35);
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

