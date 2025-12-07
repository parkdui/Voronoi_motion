// v4 Sketch - Pixelated Grid Voronoi with 4 colors and 4 letters
let v4Sketch = function(p) {
    let WebGL;
    let Canvas;
    let OverlayCanvas;
    let theShader;
    let PARAMS;
    let isRecording = false; // 녹화 상태
    let frameCount = 0; // 저장된 프레임 카운터
    let customFont; // 커스텀 폰트
    
    // 4가지 letter: c, c, i, d
    const LETTERS = ['c', 'c', 'i', 'd'];
    
    // emoji인지 확인하는 함수
    function isEmoji(char) {
        // emoji 유니코드 범위 체크
        const code = char.codePointAt(0);
        return (
            (code >= 0x1F300 && code <= 0x1F9FF) || // Miscellaneous Symbols and Pictographs
            (code >= 0x1F600 && code <= 0x1F64F) || // Emoticons
            (code >= 0x1F680 && code <= 0x1F6FF) || // Transport and Map Symbols
            (code >= 0x2600 && code <= 0x26FF) ||   // Miscellaneous Symbols
            (code >= 0x2700 && code <= 0x27BF) ||   // Dingbats
            (code >= 0xFE00 && code <= 0xFE0F) ||   // Variation Selectors
            (code >= 0x1F900 && code <= 0x1F9FF) || // Supplemental Symbols and Pictographs
            (code >= 0x1F1E0 && code <= 0x1F1FF)    // Regional Indicator Symbols
        );
    }
    
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
    
    // 각 픽셀에서 가장 가까운 cell 찾기 (바깥으로 퍼지는 애니메이션 포함)
    function findClosestCell(screenX, screenY, time, scale, spreadSpeed) {
        const TAU = Math.PI * 2;
        const aspectRatio = p.width / p.height;
        
        // 중심점 계산 (먼저 정의)
        const centerX = p.width / 2;
        const centerY = p.height / 2;
        
        // 중심에서의 거리 계산 (정규화)
        const distFromCenter = Math.sqrt(
            Math.pow((screenX - centerX) / p.width, 2) + 
            Math.pow((screenY - centerY) / p.height, 2)
        );
        
        let uvX = (screenX / p.width - 0.5) * aspectRatio;
        let uvY = screenY / p.height - 0.5;
        uvX *= scale;
        uvY *= scale;
        
        const iuvX = Math.floor(uvX);
        const iuvY = Math.floor(uvY);
        const fuvX = uvX - iuvX;
        const fuvY = uvY - iuvY;
        
        let minDist = Infinity;
        let closestCell = null;
        
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                const offX = iuvX + x;
                const offY = iuvY + y;
                const pos = hash2([offX, offY]);
                
                // 바깥으로 퍼지는 애니메이션
                // 시간에 따라 바깥으로 퍼지는 효과
                const spreadFactor = 1.0 + distFromCenter * spreadSpeed * time;
                const animatedPos = [
                    0.5 + 0.49 * Math.sin(time + pos[0] * TAU) * spreadFactor,
                    0.5 + 0.49 * Math.sin(time + pos[1] * TAU) * spreadFactor
                ];
                
                const dirX = animatedPos[0] + x - fuvX;
                const dirY = animatedPos[1] + y - fuvY;
                const dist = dirX * dirX + dirY * dirY;
                
                if (dist < minDist) {
                    minDist = dist;
                    const cellCenterShaderX = offX + animatedPos[0];
                    const cellCenterShaderY = offY + animatedPos[1];
                    
                    const normalizedX = cellCenterShaderX / scale;
                    const normalizedY = cellCenterShaderY / scale;
                    const cellCenterX = (normalizedX / aspectRatio + 0.5) * p.width;
                    const cellCenterY = (normalizedY + 0.5) * p.height;
                    
                    closestCell = {
                        centerX: cellCenterX,
                        centerY: cellCenterY,
                        iuv: [offX, offY],
                        hash: hash1([offX, offY])
                    };
                }
            }
        }
        
        return closestCell;
    }
    
    // 폰트 로드
    p.preload = function() {
        customFont = p.loadFont('NHaasGroteskDSPro-45Lt.ttf');
    };
    
    // Cell 중심점 계산
    function getCellPositions(time, scale, numCells, spreadSpeed) {
        const aspectRatio = p.width / p.height;
        const centerRadius = 0.6; // 중앙 영역
        const cellMap = new Map();
        
        const sampleStep = 15;
        const centerX = p.width / 2;
        const centerY = p.height / 2;
        const radius = Math.min(p.width, p.height) * centerRadius;
        
        for (let screenX = centerX - radius; screenX <= centerX + radius; screenX += sampleStep) {
            for (let screenY = centerY - radius; screenY <= centerY + radius; screenY += sampleStep) {
                const dx = (screenX - centerX) / (p.width * 0.5);
                const dy = (screenY - centerY) / (p.height * 0.5);
                const distFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                if (distFromCenter <= centerRadius) {
                    const closestCell = findClosestCell(screenX, screenY, time, scale, spreadSpeed);
                    if (closestCell) {
                        const cellKey = `${closestCell.iuv[0]},${closestCell.iuv[1]}`;
                        if (!cellMap.has(cellKey)) {
                            cellMap.set(cellKey, {
                                centerX: closestCell.centerX,
                                centerY: closestCell.centerY,
                                iuv: closestCell.iuv,
                                hash: closestCell.hash
                            });
                        }
                    }
                }
            }
        }
        
        const cellsArray = Array.from(cellMap.values());
        cellsArray.sort((a, b) => {
            const distA = Math.sqrt(Math.pow(a.centerX - centerX, 2) + Math.pow(a.centerY - centerY, 2));
            const distB = Math.sqrt(Math.pow(b.centerX - centerX, 2) + Math.pow(b.centerY - centerY, 2));
            return distA - distB;
        });
        
        return cellsArray.slice(0, Math.min(numCells, cellsArray.length));
    }

    p.setup = function() {
        console.log('v4 setup called');
        
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
        WebGL = p.createGraphics(p.width, p.height, p.WEBGL);
        Canvas = p.createGraphics(p.width, p.height);
        OverlayCanvas = p.createGraphics(p.width, p.height);
        p.noStroke();
        WebGL.noStroke();
        Canvas.noStroke();
        OverlayCanvas.noStroke();
        p.background(255);
        
        // Shader 생성
        const vertSrc = typeof vertShader !== 'undefined' ? vertShader : (typeof window.vertShader !== 'undefined' ? window.vertShader : null);
        const fragSrc = typeof fragShader !== 'undefined' ? fragShader : (typeof window.fragShader !== 'undefined' ? window.fragShader : null);
        const voronoiSrc = typeof voronoiShader !== 'undefined' ? voronoiShader : (typeof window.voronoiShader !== 'undefined' ? window.voronoiShader : null);
        
        if (!vertSrc || !fragSrc || !voronoiSrc) {
            console.error('Shader variables not defined');
            theShader = null;
        } else {
            const frag = fragSrc.replace('// Voronoi shader code will be inserted here', voronoiSrc);
            try {
                theShader = WebGL.createShader(vertSrc, frag);
                if (!theShader) {
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
            Mode: 'Colorful',
            Speed: 0.06, // 애니메이션 속도 (더 빠르게)
            Scale: 6.0, // 작을수록 큰 cell
            Smin: 1.0,
            GridSize: 15, // Pixelated grid 크기 (더 pixelated하게)
            SpreadSpeed: 1.2, // 퍼지는 속도 (더 빠르게)
            // 4가지 색상 (RGB 0-1 범위)
            Color0: { r: 167/255, g: 111/255, b: 255/255 }, // #A76FFF - 보라색
            Color1: { r: 246/255, g: 255/255, b: 67/255 },   // #F6FF43 - 노란색
            Color2: { r: 78/255, g: 255/255, b: 102/255 },   // #4EFF66 - 초록색
            Color3: { r: 51/255, g: 255/255, b: 236/255 },  // #33FFEC - 청록색
            Recording: false // 녹화 상태
        };
        
        v4PARAMS = PARAMS;
        
        // UI 컨트롤 설정
        setupV4Controls();
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
        if (!PARAMS) {
            p.background(255);
            return;
        }
        
        try {
            p.background(255);
            
            // Pixelated grid 렌더링
            const gridSize = PARAMS.GridSize || 15;
            const time = p.frameCount * PARAMS.Speed;
            const spreadSpeed = PARAMS.SpreadSpeed || 0.8;
            
            Canvas.clear();
            
            // Grid 기반으로 각 셀의 색상 결정 및 letter 그리기
            for (let x = 0; x < p.width; x += gridSize) {
                for (let y = 0; y < p.height; y += gridSize) {
                    // 각 grid 셀의 중심점에서 가장 가까운 voronoi cell 찾기
                    const cellX = x + gridSize / 2;
                    const cellY = y + gridSize / 2;
                    const closestCell = findClosestCell(cellX, cellY, time, PARAMS.Scale, spreadSpeed);
                    
                    if (closestCell) {
                        // hash 값으로 색상 선택 (4가지 색상 중 하나)
                        const colorIndex = Math.floor(closestCell.hash * 4) % 4;
                        let color;
                        switch(colorIndex) {
                            case 0:
                                color = PARAMS.Color0;
                                break;
                            case 1:
                                color = PARAMS.Color1;
                                break;
                            case 2:
                                color = PARAMS.Color2;
                                break;
                            case 3:
                                color = PARAMS.Color3;
                                break;
                            default:
                                color = PARAMS.Color0;
                        }
                        
                        // Grid cell 색상 그리기
                        Canvas.fill(color.r * 255, color.g * 255, color.b * 255);
                        Canvas.stroke(0); // #000
                        Canvas.strokeWeight(1);
                        Canvas.rect(x, y, gridSize, gridSize);
                        
                        // 각 grid cell마다 letter 그리기
                        const letterIndex = Math.floor(closestCell.hash * 4) % 4;
                        const letter = LETTERS[letterIndex];
                        
                        Canvas.fill(0);
                        Canvas.textAlign(p.CENTER, p.CENTER);
                        Canvas.textSize(12);
                        // emoji가 아니면 커스텀 폰트 사용
                        if (customFont && !isEmoji(letter)) {
                            Canvas.textFont(customFont);
                        } else {
                            // emoji는 기본 폰트 사용
                            Canvas.textFont('sans-serif');
                        }
                        Canvas.text(letter, cellX, cellY);
                    }
                }
            }
            
            p.image(Canvas, 0, 0);
            
            // 녹화 중이면 프레임 저장
            if (PARAMS.Recording) {
                // 프레임 번호를 4자리 숫자로 포맷팅
                const frameNumber = String(frameCount).padStart(4, '0');
                const filename = `v4-frame-${frameNumber}.png`;
                
                // 첫 프레임일 때만 콘솔에 알림
                if (frameCount === 0) {
                    console.log('녹화 시작! 파일은 브라우저의 다운로드 폴더에 저장됩니다.');
                    console.log('파일명 형식: v4-frame-0000.png, v4-frame-0001.png, ...');
                }
                
                // canvas를 이미지로 저장
                try {
                    // p5.js의 saveCanvas 사용
                    if (typeof p.saveCanvas === 'function') {
                        p.saveCanvas(p.canvas, filename);
                    } else {
                        // saveCanvas가 없으면 직접 다운로드
                        p.canvas.elt.toBlob(function(blob) {
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = filename;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                        }, 'image/png');
                    }
                } catch (error) {
                    console.error('프레임 저장 오류:', error);
                }
                
                frameCount++;
                
                // 100프레임마다 진행 상황 출력
                if (frameCount % 100 === 0) {
                    console.log(`${frameCount}개 프레임 저장됨`);
                }
            } else {
                // 녹화가 중지되면 카운터 리셋
                if (frameCount > 0) {
                    console.log(`녹화 완료! 총 ${frameCount}개 프레임이 저장되었습니다.`);
                    console.log('파일 위치: 브라우저의 다운로드 폴더 (보통 ~/Downloads/)');
                    frameCount = 0;
                }
            }
        } catch (error) {
            console.error('Error in draw():', error);
        }
    };
    
    // 키보드 입력 처리 (녹화 시작/중지)
    p.keyPressed = function() {
        if (p.key === 'r' || p.key === 'R') {
            if (PARAMS) {
                PARAMS.Recording = !PARAMS.Recording;
                if (PARAMS.Recording) {
                    console.log('녹화 시작');
                } else {
                    console.log('녹화 중지');
                }
            }
        }
    };
};

// p5.js 인스턴스
let v4P5Instance = null;

// PARAMS를 전역으로 접근 가능하도록
let v4PARAMS = null;

// Tweakpane 인스턴스
let v4Pane = null;

function setupV4Controls() {
    // 이미 Tweakpane이 생성되어 있으면 제거
    if (v4Pane) {
        v4Pane.dispose();
        v4Pane = null;
    }

    // Tweakpane이 로드되어 있는지 확인
    let TweakpaneAvailable = typeof Tweakpane !== 'undefined';
    
    if (!TweakpaneAvailable && typeof window !== 'undefined') {
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
        setTimeout(setupV4Controls, 500);
        return;
    }

    // v4PARAMS가 초기화되어 있는지 확인
    if (!v4PARAMS) {
        console.warn('v4PARAMS not initialized, using default values');
        v4PARAMS = {
            Mode: 'Colorful',
            Speed: 0.06,
            Scale: 6.0,
            Smin: 1.0,
            GridSize: 15,
            SpreadSpeed: 1.2,
            Color0: { r: 167/255, g: 111/255, b: 255/255 },
            Color1: { r: 246/255, g: 255/255, b: 67/255 },
            Color2: { r: 78/255, g: 255/255, b: 102/255 },
            Color3: { r: 51/255, g: 255/255, b: 236/255 }
        };
    }
    
    console.log('Setting up v4 Tweakpane with params:', v4PARAMS);

    const TweakpaneClass = typeof Tweakpane !== 'undefined' ? Tweakpane : (typeof window !== 'undefined' && window.Tweakpane ? window.Tweakpane : null);
    
    if (!TweakpaneClass) {
        console.error('Tweakpane class not available. Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('tweak')));
        return;
    }
    
    try {
        v4Pane = new TweakpaneClass.Pane({
            title: 'V4 Parameters',
            container: document.body,
        });
        console.log('Tweakpane instance created successfully');
    } catch (error) {
        console.error('Error creating Tweakpane instance:', error);
        return;
    }

    // 위치를 오른쪽으로 설정
    const paneElement = v4Pane.element;
    if (paneElement) {
        paneElement.style.position = 'fixed';
        paneElement.style.right = '20px';
        paneElement.style.top = '50%';
        paneElement.style.transform = 'translateY(-50%)';
        paneElement.style.zIndex = '1001';
    }

    // 4가지 색상 Color Picker 추가
    try {
        v4Pane.addInput(v4PARAMS, 'Color0', {
            label: 'Color 1 (Purple)',
            color: { type: 'float' },
            picker: 'inline',
        });

        v4Pane.addInput(v4PARAMS, 'Color1', {
            label: 'Color 2 (Yellow)',
            color: { type: 'float' },
            picker: 'inline',
        });

        v4Pane.addInput(v4PARAMS, 'Color2', {
            label: 'Color 3 (Green)',
            color: { type: 'float' },
            picker: 'inline',
        });

        v4Pane.addInput(v4PARAMS, 'Color3', {
            label: 'Color 4 (Cyan)',
            color: { type: 'float' },
            picker: 'inline',
        });
    } catch (e) {
        console.error('Error adding Color inputs to Tweakpane:', e);
    }

    v4Pane.addSeparator();

    // Speed
    try {
        v4Pane.addInput(v4PARAMS, 'Speed', {
            min: 0,
            max: 0.1,
            step: 0.001,
        });
    } catch (e) {
        console.warn('Error adding Speed to Tweakpane:', e);
    }

    // Scale
    try {
        v4Pane.addInput(v4PARAMS, 'Scale', {
            min: 1,
            max: 20,
            step: 0.1,
        });
    } catch (e) {
        console.warn('Error adding Scale to Tweakpane:', e);
    }

    // Grid Size
    try {
        v4Pane.addInput(v4PARAMS, 'GridSize', {
            label: 'Grid Size',
            min: 5,
            max: 50,
            step: 1,
        });
    } catch (e) {
        console.warn('Error adding GridSize to Tweakpane:', e);
    }

    // Spread Speed
    try {
        v4Pane.addInput(v4PARAMS, 'SpreadSpeed', {
            label: 'Spread Speed',
            min: 0,
            max: 3,
            step: 0.1,
        });
    } catch (e) {
        console.warn('Error adding SpreadSpeed to Tweakpane:', e);
    }

    v4Pane.addSeparator();

    // Recording
    try {
        v4Pane.addInput(v4PARAMS, 'Recording', {
            label: 'Recording (Press R)',
        });
    } catch (e) {
        console.warn('Error adding Recording to Tweakpane:', e);
    }

    console.log('v4 Tweakpane created');
    
    // Tweakpane을 즉시 표시
    if (v4Pane && v4Pane.element) {
        v4Pane.element.style.display = 'block';
        console.log('v4 Tweakpane displayed');
    }
}

function showV4Controls() {
    // Tweakpane 표시
    if (v4Pane && v4Pane.element) {
        v4Pane.element.style.display = 'block';
    }
}

function hideV4Controls() {
    // Tweakpane 숨기기
    if (v4Pane && v4Pane.element) {
        v4Pane.element.style.display = 'none';
    }
}

