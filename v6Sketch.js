// v6 Sketch - Pixelated Grid Voronoi with 4 colors and 4 letters
let v6Sketch = function(p) {
    let WebGL;
    let Canvas;
    let OverlayCanvas;
    let theShader;
    let PARAMS;
    let isRecording = false; // 녹화 상태
    let frameCount = 0; // 저장된 프레임 카운터
    let sectionStartTime = 0; // 섹션 시작 시간
    let currentSection = 0; // 현재 섹션 (0-3)
    let customFont; // 커스텀 폰트
    
    // hex 색상을 RGB로 변환하는 함수
    function hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }
    
    // 섹션별 letter 배열
    const SECTION_LETTERS = [
        // 1번 섹션: a, r, t, e, c, h, 🖌️🎨🧵📱🖥️📡🤖
        ['a', 'r', 't', 'e', 'c', 'h', '🖌️', '🎨', '🧵', '📱', '🖥️', '📡', '🤖'],
        // 2번 섹션: c, r, e, a, t, i, o, n, 🪄🔮🧬✨💡
        ['c', 'r', 'e', 'a', 't', 'i', 'o', 'n', '🪄', '🔮', '🧬', '✨', '💡'],
        // 3번 섹션: h, u, m, a, n, 👨 👩 🧓 👵🧑‍🦱✋🏻✋🏼✋🏽✋🏾✋🏿
        ['h', 'u', 'm', 'a', 'n', '👨', '👩', '🧓', '👵', '🧑‍🦱', '✋🏻', '✋🏼', '✋🏽', '✋🏾', '✋🏿'],
        // 4번 섹션: m, o, r, e, t, h, a, n, 🐦🐋🐇🦋🌱🌳🌍🌈🔥⛰️
        ['m', 'o', 'r', 'e', 't', 'h', 'a', 'n', '🐦', '🐋', '🐇', '🦋', '🌱', '🌳', '🌍', '🌈', '🔥', '⛰️']
    ];
    
    // Grid 크기 옵션: 80, 40, 20 (최대 80, 최소 20)
    const GRID_SIZES = [80, 40, 20];
    
    // 각 cell의 grid 크기를 저장하는 Map (cellIuv -> gridSize)
    let cellGridSizes = new Map();
    
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
                    
                    // hash 값 계산 (항상 유효한 값 보장)
                    let cellHash = hash1([offX, offY]);
                    if (typeof cellHash !== 'number' || isNaN(cellHash) || !isFinite(cellHash)) {
                        // hash가 유효하지 않으면 기본값 사용
                        cellHash = (offX * 0.1 + offY * 0.1) % 1;
                    }
                    
                    closestCell = {
                        centerX: cellCenterX,
                        centerY: cellCenterY,
                        iuv: [offX, offY],
                        hash: cellHash
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
        console.log('v6 setup called');
        
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
            TextColor: '#000000', // 텍스트 색상 (hex 형식)
            Recording: false // 녹화 상태
        };
        
        v6PARAMS = PARAMS;
        
        // 섹션 초기화
        sectionStartTime = Date.now();
        currentSection = 0;
        cellGridSizes.clear();
        
        // UI 컨트롤 설정
        setupV6Controls();
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

    // 섹션 업데이트 (3초마다 전환)
    function updateSection() {
        const sectionDuration = 3000; // 3초
        const elapsed = Date.now() - sectionStartTime;
        
        if (elapsed >= sectionDuration) {
            // 다음 섹션으로 전환
            currentSection = (currentSection + 1) % 4;
            sectionStartTime = Date.now();
            // 섹션 전환 시 grid 크기 재할당
            cellGridSizes.clear();
        }
    }
    
    // cell의 grid 크기 가져오기 (랜덤하게 할당)
    function getCellGridSize(cellIuv) {
        const cellKey = `${cellIuv[0]},${cellIuv[1]}`;
        if (!cellGridSizes.has(cellKey)) {
            // 랜덤하게 grid 크기 선택
            const randomIndex = Math.floor(hash1(cellIuv) * GRID_SIZES.length);
            cellGridSizes.set(cellKey, GRID_SIZES[randomIndex]);
        }
        return cellGridSizes.get(cellKey);
    }
    
    // 현재 섹션의 letter 가져오기 (항상 유효한 letter 반환 보장 - 절대 빈 값 반환 안 함)
    // isLargeCell: 최대 크기 cell인 경우 true (emoji 선택 확률 증가)
    function getSectionLetter(cellHash, isLargeCell = false) {
        // 현재 섹션이 유효한지 확인
        let section = currentSection;
        if (section < 0 || section >= SECTION_LETTERS.length) {
            section = 0; // 기본값으로 0번 섹션 사용
        }
        
        const letters = SECTION_LETTERS[section];
        if (!letters || letters.length === 0) {
            // 기본값 반환 (안전장치)
            console.warn('SECTION_LETTERS[section] is empty, using default');
            return '?';
        }
        
        // cellHash가 유효한지 확인
        if (typeof cellHash !== 'number' || isNaN(cellHash) || !isFinite(cellHash)) {
            cellHash = 0.5; // 기본 hash 값
        }
        
        // 최대 크기 cell인 경우 emoji 선택 확률 증가 (약 15% 확률)
        if (isLargeCell) {
            const emojiThreshold = 0.15; // 15% 확률로 emoji 선택
            const hashValue = Math.abs(cellHash);
            
            if (hashValue < emojiThreshold) {
                // emoji만 선택 (각 섹션의 emoji는 보통 뒤쪽에 위치)
                // 섹션별 emoji 시작 인덱스 (정확한 인덱스)
                let emojiStartIndex = 0;
                if (section === 0) emojiStartIndex = 6; // ['a', 'r', 't', 'e', 'c', 'h', '🖌️', ...]
                else if (section === 1) emojiStartIndex = 8; // ['c', 'r', 'e', 'a', 't', 'i', 'o', 'n', '🪄', ...]
                else if (section === 2) emojiStartIndex = 5; // ['h', 'u', 'm', 'a', 'n', '👨', ...]
                else if (section === 3) emojiStartIndex = 8; // ['m', 'o', 'r', 'e', 't', 'h', 'a', 'n', '🐦', ...]
                
                const emojiCount = letters.length - emojiStartIndex;
                if (emojiCount > 0 && emojiStartIndex < letters.length) {
                    // emoji 중에서 선택 (hashValue를 사용하여 다양한 emoji 선택)
                    const emojiHash = (hashValue / emojiThreshold) * 1000; // 더 다양한 분산을 위해
                    const emojiIndex = emojiStartIndex + (Math.floor(emojiHash) % emojiCount);
                    if (emojiIndex >= 0 && emojiIndex < letters.length) {
                        const letter = letters[emojiIndex];
                        // letter가 유효한지 확인 (빈 문자열도 체크)
                        if (letter != null && String(letter).trim() !== '') {
                            return String(letter).trim();
                        }
                    }
                }
                // emoji 선택 실패 시 일반 letter로 fallback
            }
            // emoji를 선택하지 않은 경우 (85% 확률) 일반 letter 선택
        }
        
        // letterIndex 계산 (항상 유효한 범위 내)
        let letterIndex = Math.floor(Math.abs(cellHash) * letters.length) % letters.length;
        // 인덱스가 범위를 벗어나면 0으로 설정
        if (letterIndex < 0 || letterIndex >= letters.length) {
            letterIndex = 0;
        }
        
        // 최대 letters.length번 시도하여 유효한 letter 찾기
        for (let attempt = 0; attempt < letters.length; attempt++) {
            if (letterIndex >= 0 && letterIndex < letters.length) {
                const letter = letters[letterIndex];
                
                // letter가 유효한지 확인 (빈 문자열도 체크)
                if (letter != null && String(letter).trim() !== '') {
                    return String(letter).trim();
                }
            }
            // 다음 인덱스 시도
            letterIndex = (letterIndex + 1) % letters.length;
        }
        
        // 모든 방법이 실패하면 첫 번째 유효한 letter 반환
        for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            if (letter != null && String(letter).trim() !== '') {
                return String(letter).trim();
            }
        }
        
        // 최후의 수단: 기본값 (절대 빈 문자열 반환 안 함)
        return '?';
    }
    
    // letter 유효성 검증 및 강제 할당 함수 (절대 빈 값 반환 안 함)
    function ensureValidLetter(letter, section) {
        // section이 유효한지 확인
        let validSection = section;
        if (validSection < 0 || validSection >= SECTION_LETTERS.length) {
            validSection = 0;
        }
        
        const letters = SECTION_LETTERS[validSection];
        if (!letters || letters.length === 0) {
            console.error('ensureValidLetter: No letters for section', validSection);
            return '?';
        }
        
        // letter가 유효한지 확인
        if (letter != null && letter !== undefined && letter !== '' && String(letter).trim() !== '') {
            const trimmed = String(letter).trim();
            if (trimmed !== '') {
                return trimmed;
            }
        }
        
        // 유효하지 않으면 첫 번째 letter 반환
        if (letters[0] != null && letters[0] !== undefined && letters[0] !== '') {
            const trimmed = String(letters[0]).trim();
            if (trimmed !== '') {
                return trimmed;
            }
        }
        
        // 그것도 실패하면 첫 번째 유효한 letter 찾기
        for (let i = 0; i < letters.length; i++) {
            if (letters[i] != null && letters[i] !== undefined && letters[i] !== '') {
                const trimmed = String(letters[i]).trim();
                if (trimmed !== '') {
                    return trimmed;
                }
            }
        }
        
        // 최후의 수단
        console.error('ensureValidLetter: All letters invalid for section', validSection, letters);
        return '?';
    }
    
    p.draw = function() {
        if (!PARAMS) {
            p.background(255);
            return;
        }
        
        try {
            p.background(255);
            
            // 섹션 업데이트
            updateSection();
            
            // Pixelated grid 렌더링
            const time = p.frameCount * PARAMS.Speed;
            const spreadSpeed = PARAMS.SpreadSpeed || 1.2; // v4와 동일하게 더 빠른 spread speed
            
            Canvas.clear();
            
            // 최적화: 먼저 모든 위치를 최소 grid size로 채우고, 그 다음 큰 grid로 덮어쓰기
            const minGridSize = Math.min(...GRID_SIZES);
            const cellRects = []; // 그려질 rect 정보 저장 {x, y, size, color, letter, centerX, centerY}
            const coveredAreas = new Set(); // 큰 grid에 의해 덮여진 영역 추적
            
            // 1단계: 모든 위치를 최소 grid size로 먼저 채우기 (빈 공간 없이 보장)
            for (let x = 0; x < p.width; x += minGridSize) {
                for (let y = 0; y < p.height; y += minGridSize) {
                    const cellX = x + minGridSize / 2;
                    const cellY = y + minGridSize / 2;
                    const closestCell = findClosestCell(cellX, cellY, time, PARAMS.Scale, spreadSpeed);
                    
                    // closestCell이 null이어도 cell은 항상 추가 (빈 공간 방지)
                    let cellHash = 0.5; // 기본 hash 값
                    let colorIndex = 0;
                    
                    if (closestCell) {
                        // hash 값으로 색상 선택
                        cellHash = typeof closestCell.hash === 'number' && isFinite(closestCell.hash) 
                            ? closestCell.hash 
                            : (x * 0.1 + y * 0.1) % 1;
                        colorIndex = Math.floor(Math.abs(cellHash) * 4) % 4;
                    } else {
                        // closestCell이 null인 경우 위치 기반 hash 사용
                        cellHash = (x * 0.1 + y * 0.1) % 1;
                        colorIndex = Math.floor(Math.abs(cellHash) * 4) % 4;
                    }
                    
                    let color;
                    switch(colorIndex) {
                        case 0: color = PARAMS.Color0; break;
                        case 1: color = PARAMS.Color1; break;
                        case 2: color = PARAMS.Color2; break;
                        case 3: color = PARAMS.Color3; break;
                        default: color = PARAMS.Color0;
                    }
                    
                    // 현재 섹션의 letter (항상 유효한 값 보장)
                    let letter = getSectionLetter(cellHash, false);
                    // 최종 검증 및 강제 할당 (절대 빈 값이 되지 않도록)
                    letter = ensureValidLetter(letter, currentSection);
                    
                    // 최종 최종 검증: 절대 빈 값이 되지 않도록
                    if (!letter || letter === '' || letter === undefined || letter === null || String(letter).trim() === '') {
                        const letters = SECTION_LETTERS[currentSection];
                        if (letters && letters.length > 0) {
                            letter = String(letters[0]).trim();
                            if (!letter || letter === '') {
                                // 모든 letter를 순회하여 첫 번째 유효한 것 찾기
                                for (let i = 0; i < letters.length; i++) {
                                    const testLetter = String(letters[i]).trim();
                                    if (testLetter && testLetter !== '') {
                                        letter = testLetter;
                                        break;
                                    }
                                }
                            }
                        }
                        if (!letter || letter === '') {
                            letter = '?';
                        }
                    }
                    
                    // 항상 cell 추가 (closestCell이 null이어도) - letter는 반드시 유효한 값
                    cellRects.push({
                        x: x,
                        y: y,
                        size: minGridSize,
                        color: color,
                        letter: String(letter).trim(), // 항상 유효한 letter 보장 (빈 문자열 아님)
                        centerX: cellX,
                        centerY: cellY
                    });
                }
            }
            
            // 2단계: 큰 grid를 그리기 (작은 grid를 덮어쓰기)
            const sortedGridSizes = [...GRID_SIZES].sort((a, b) => b - a);
            
            for (const gridSize of sortedGridSizes) {
                if (gridSize === minGridSize) continue; // 최소 크기는 이미 처리됨
                
                for (let x = 0; x < p.width; x += gridSize) {
                    for (let y = 0; y < p.height; y += gridSize) {
                        const cellX = x + gridSize / 2;
                        const cellY = y + gridSize / 2;
                        const closestCell = findClosestCell(cellX, cellY, time, PARAMS.Scale, spreadSpeed);
                        
                        // closestCell이 null이어도 처리
                        if (closestCell) {
                            const cellGridSize = getCellGridSize(closestCell.iuv);
                            
                            // 이 위치의 cell이 이 grid size를 사용하는 경우에만
                            if (cellGridSize === gridSize) {
                                // hash 값으로 색상 선택
                                let cellHash = typeof closestCell.hash === 'number' && isFinite(closestCell.hash) 
                                    ? closestCell.hash 
                                    : (x * 0.1 + y * 0.1) % 1;
                                const colorIndex = Math.floor(Math.abs(cellHash) * 4) % 4;
                                let color;
                                switch(colorIndex) {
                                    case 0: color = PARAMS.Color0; break;
                                    case 1: color = PARAMS.Color1; break;
                                    case 2: color = PARAMS.Color2; break;
                                    case 3: color = PARAMS.Color3; break;
                                    default: color = PARAMS.Color0;
                                }
                                
                                // 현재 섹션의 letter (항상 유효한 값 보장)
                                // 최대 크기 cell(gridSize >= 80)인 경우 emoji 선택 확률 증가
                                const isLargeCell = (gridSize >= 80);
                                let letter = getSectionLetter(cellHash, isLargeCell);
                                // 최종 검증 및 강제 할당 (절대 빈 값이 되지 않도록)
                                letter = ensureValidLetter(letter, currentSection);
                                
                                // 최종 최종 검증: 절대 빈 값이 되지 않도록
                                if (!letter || letter === '' || letter === undefined || letter === null || String(letter).trim() === '') {
                                    const letters = SECTION_LETTERS[currentSection];
                                    if (letters && letters.length > 0) {
                                        letter = String(letters[0]).trim();
                                        if (!letter || letter === '') {
                                            // 모든 letter를 순회하여 첫 번째 유효한 것 찾기
                                            for (let i = 0; i < letters.length; i++) {
                                                const testLetter = String(letters[i]).trim();
                                                if (testLetter && testLetter !== '') {
                                                    letter = testLetter;
                                                    break;
                                                }
                                            }
                                        }
                                    }
                                    if (!letter || letter === '') {
                                        letter = '?';
                                    }
                                }
                                
                                // 이 grid 영역의 작은 cell들을 표시 (나중에 제거)
                                const cellsPerGrid = gridSize / minGridSize;
                                for (let offsetX = 0; offsetX < cellsPerGrid; offsetX++) {
                                    for (let offsetY = 0; offsetY < cellsPerGrid; offsetY++) {
                                        const smallX = x + offsetX * minGridSize;
                                        const smallY = y + offsetY * minGridSize;
                                        const areaKey = `${smallX},${smallY}`;
                                        coveredAreas.add(areaKey);
                                    }
                                }
                                
                                // 큰 cell 추가 (나중에 그려서 작은 cell 위에 덮어쓰기)
                                cellRects.push({
                                    x: x,
                                    y: y,
                                    size: gridSize,
                                    color: color,
                                    letter: String(letter).trim(), // 항상 유효한 letter 보장 (빈 문자열 아님)
                                    centerX: cellX,
                                    centerY: cellY
                                });
                            }
                        }
                    }
                }
            }
            
            // 3단계: 최종 렌더링 (작은 cell 먼저, 큰 cell 나중에 - 큰 cell이 작은 cell을 덮음)
            // 작은 cell부터 큰 cell 순서로 정렬
            const finalRects = cellRects.sort((a, b) => a.size - b.size);
            
            for (const rect of finalRects) {
                // 작은 cell이 큰 cell 영역에 포함되면 건너뛰기
                if (rect.size === minGridSize) {
                    const areaKey = `${rect.x},${rect.y}`;
                    if (coveredAreas.has(areaKey)) continue;
                }
                
                // Grid cell 그리기
                Canvas.fill(rect.color.r * 255, rect.color.g * 255, rect.color.b * 255);
                Canvas.stroke(0);
                Canvas.strokeWeight(1);
                Canvas.rect(rect.x, rect.y, rect.size, rect.size);
                
                // Letter를 cell의 정확한 center에 배치
                // letter가 유효한지 확인 (최종 안전장치 - 절대 빈 cell이 없도록)
                let letter = ensureValidLetter(rect.letter, currentSection);
                
                // 최종 최종 검증: 절대 빈 값이 되지 않도록
                if (!letter || letter === '' || letter === undefined || letter === null || String(letter).trim() === '') {
                    const letters = SECTION_LETTERS[currentSection];
                    if (letters && letters.length > 0) {
                        letter = String(letters[0]).trim();
                        if (!letter || letter === '') {
                            // 모든 letter를 순회하여 첫 번째 유효한 것 찾기
                            for (let i = 0; i < letters.length; i++) {
                                const testLetter = String(letters[i]).trim();
                                if (testLetter && testLetter !== '') {
                                    letter = testLetter;
                                    break;
                                }
                            }
                        }
                    }
                    if (!letter || letter === '') {
                        letter = '?';
                    }
                }
                
                letter = String(letter).trim();
                
                // Letter 그리기 (항상 그리기)
                // TextColor 사용 (hex 형식에서 RGB로 변환)
                const textColorHex = PARAMS.TextColor || '#000000';
                const textColorRgb = hexToRgb(textColorHex);
                Canvas.fill(textColorRgb.r, textColorRgb.g, textColorRgb.b);
                Canvas.textAlign(p.CENTER, p.CENTER);
                // cell 크기에 따라 letter 크기 조정 (최대 크기 cell은 더 큰 letter)
                let textSizeRatio = 0.4; // 기본 비율
                if (rect.size >= 80) {
                    textSizeRatio = 0.65; // 최대 크기 cell (80)은 더 큰 letter
                } else if (rect.size >= 40) {
                    textSizeRatio = 0.5; // 중간 크기 cell (40)은 중간 크기 letter
                }
                const textSize = Math.max(8, Math.min(60, rect.size * textSizeRatio));
                Canvas.textSize(textSize);
                // emoji가 아니면 커스텀 폰트 사용
                if (customFont && !isEmoji(letter)) {
                    Canvas.textFont(customFont);
                } else {
                    // emoji는 기본 폰트 사용
                    Canvas.textFont('sans-serif');
                }
                // letter가 확실히 있으므로 항상 그리기
                Canvas.text(String(letter), rect.centerX, rect.centerY);
            }
            
            p.image(Canvas, 0, 0);
            
            // 녹화 중이면 프레임 저장
            if (PARAMS.Recording) {
                // 프레임 번호를 4자리 숫자로 포맷팅
                const frameNumber = String(frameCount).padStart(4, '0');
                const filename = `v6-frame-${frameNumber}.png`;
                
                // 첫 프레임일 때만 콘솔에 알림
                if (frameCount === 0) {
                    console.log('녹화 시작! 파일은 브라우저의 다운로드 폴더에 저장됩니다.');
                    console.log('파일명 형식: v6-frame-0000.png, v6-frame-0001.png, ...');
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
let v6P5Instance = null;

// PARAMS를 전역으로 접근 가능하도록
let v6PARAMS = null;

// Tweakpane 인스턴스
let v6Pane = null;

function setupV6Controls() {
    // 이미 Tweakpane이 생성되어 있으면 제거
    if (v6Pane) {
        v6Pane.dispose();
        v6Pane = null;
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
        setTimeout(setupV6Controls, 500);
        return;
    }

    // v6PARAMS가 초기화되어 있는지 확인
    if (!v6PARAMS) {
        console.warn('v6PARAMS not initialized, using default values');
        v6PARAMS = {
            Mode: 'Colorful',
            Speed: 0.06,
            Scale: 6.0,
            Smin: 1.0,
            GridSize: 15,
            SpreadSpeed: 1.2,
            Color0: { r: 167/255, g: 111/255, b: 255/255 },
            Color1: { r: 246/255, g: 255/255, b: 67/255 },
            Color2: { r: 78/255, g: 255/255, b: 102/255 },
            Color3: { r: 51/255, g: 255/255, b: 236/255 },
            TextColor: '#000000' // 텍스트 색상 (hex 형식)
        };
    }
    
    console.log('Setting up v6 Tweakpane with params:', v6PARAMS);

    const TweakpaneClass = typeof Tweakpane !== 'undefined' ? Tweakpane : (typeof window !== 'undefined' && window.Tweakpane ? window.Tweakpane : null);
    
    if (!TweakpaneClass) {
        console.error('Tweakpane class not available. Available globals:', Object.keys(window).filter(k => k.toLowerCase().includes('tweak')));
        return;
    }
    
    try {
        v6Pane = new TweakpaneClass.Pane({
            title: 'V6 Parameters',
            container: document.body,
        });
        console.log('Tweakpane instance created successfully');
    } catch (error) {
        console.error('Error creating Tweakpane instance:', error);
        return;
    }

    // 위치를 오른쪽으로 설정
    const paneElement = v6Pane.element;
    if (paneElement) {
        paneElement.style.position = 'fixed';
        paneElement.style.right = '20px';
        paneElement.style.top = '50%';
        paneElement.style.transform = 'translateY(-50%)';
        paneElement.style.zIndex = '1001';
    }

    // 4가지 색상 Color Picker 추가
    try {
        v6Pane.addInput(v6PARAMS, 'Color0', {
            label: 'Color 1 (Purple)',
            color: { type: 'float' },
            picker: 'inline',
        });

        v6Pane.addInput(v6PARAMS, 'Color1', {
            label: 'Color 2 (Yellow)',
            color: { type: 'float' },
            picker: 'inline',
        });

        v6Pane.addInput(v6PARAMS, 'Color2', {
            label: 'Color 3 (Green)',
            color: { type: 'float' },
            picker: 'inline',
        });

        v6Pane.addInput(v6PARAMS, 'Color3', {
            label: 'Color 4 (Cyan)',
            color: { type: 'float' },
            picker: 'inline',
        });
    } catch (e) {
        console.error('Error adding Color inputs to Tweakpane:', e);
    }

    v6Pane.addSeparator();

    // Speed
    try {
        v6Pane.addInput(v6PARAMS, 'Speed', {
            min: 0,
            max: 0.1,
            step: 0.001,
        });
    } catch (e) {
        console.warn('Error adding Speed to Tweakpane:', e);
    }

    // Scale
    try {
        v6Pane.addInput(v6PARAMS, 'Scale', {
            min: 1,
            max: 20,
            step: 0.1,
        });
    } catch (e) {
        console.warn('Error adding Scale to Tweakpane:', e);
    }

    // Grid Size
    try {
        v6Pane.addInput(v6PARAMS, 'GridSize', {
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
        v6Pane.addInput(v6PARAMS, 'SpreadSpeed', {
            label: 'Spread Speed',
            min: 0,
            max: 3,
            step: 0.1,
        });
    } catch (e) {
        console.warn('Error adding SpreadSpeed to Tweakpane:', e);
    }

    v6Pane.addSeparator();

    // Recording
    try {
        v6Pane.addInput(v6PARAMS, 'Recording', {
            label: 'Recording (Press R)',
        }).on('change', (ev) => {
            // UI 토글도 동기화
            const recordingToggle = document.getElementById('recordingToggle');
            if (recordingToggle) {
                recordingToggle.checked = ev.value;
                // VoronoiPattern 인스턴스의 녹화 상태도 업데이트
                if (window.voronoiPatternInstance) {
                    window.voronoiPatternInstance.isRecording = ev.value;
                    if (ev.value) {
                        window.voronoiPatternInstance.frameCount = 0;
                    }
                }
            }
        });
    } catch (e) {
        console.warn('Error adding Recording to Tweakpane:', e);
    }

    console.log('v6 Tweakpane created');
    
    // Tweakpane을 즉시 표시
    if (v6Pane && v6Pane.element) {
        v6Pane.element.style.display = 'block';
        console.log('v6 Tweakpane displayed');
    }
}

function showV6Controls() {
    // Tweakpane 표시
    if (v6Pane && v6Pane.element) {
        v6Pane.element.style.display = 'block';
    }
}

function hideV6Controls() {
    // Tweakpane 숨기기
    if (v6Pane && v6Pane.element) {
        v6Pane.element.style.display = 'none';
    }
}

