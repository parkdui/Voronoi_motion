class VoronoiPattern {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.targetPoints = [];
        this.velocities = [];
        this.speeds = []; // 각 포인트의 개별 속도
        this.numPoints = 60; // 30% 감소 (180 -> 126)
        this.colors = [];
        this.cellAreas = []; // 각 cell의 면적 저장
        
        // 커스터마이징 변수
        this.cellColorEnabled = false;
        this.cellColor = '#ffffff';
        this.strokeVisible = false;
        this.strokeColor = '#000000';
        this.baseDotSize = 6;
        this.baseTextSize = 24;
        
        // 버전 관리
        this.versions = {
            v1: null, // v1 설정 저장
            v2: null  // v2 설정 저장 (나중에 사용)
        };
        this.currentVersion = null; // 현재 활성화된 버전
        
        // 애니메이션 상태 관리
        this.animationState = 'voronoi'; // 'voronoi', 'toGrid', 'gridDeform', 'gridDynamic', 'toVoronoi'
        this.animationTime = 0;
        this.stateStartTime = 0;
        this.stateDuration = 3000; // 3초 (기본)
        this.gridDynamicDuration = 5000; // gridDynamic 모드 전용 duration (4초)
        this.gridPositions = []; // Grid 위치 저장
        this.noiseOffset = 0; // Perlin noise 오프셋
        this.sizeNoiseOffset = 0; // 크기 계산용 Perlin noise 오프셋
        this.originalVoronoiPoints = []; // Voronoi로 돌아갈 때 사용할 원래 위치
        this.dynamicSizeMultiplier = 1; // gridDynamic 모드에서 사용할 크기 배율
        this.gridDeformEndPoints = []; // gridDeform 종료 시점의 포인트 위치 저장
        this.gridDynamicEndPoints = []; // gridDynamic 종료 시점의 포인트 위치 저장
        
        // 텍스트 애니메이션 관리 (모드 기반)
        this.textRevealProgress = 0; // 텍스트가 점진적으로 나타나는 진행도
        this.currentModeText = 'creative'; // 현재 모드의 텍스트 (초기값: voronoi 모드)
        this.lastLogTime = null; // 디버깅용
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        // localStorage에서 저장된 버전 로드
        this.loadVersionsFromStorage();
        
        this.setupControls();
        this.init();
        this.animate();
    }
    
    resize() {
        // 고해상도 렌더링을 위해 devicePixelRatio 사용
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;
        
        // 실제 캔버스 크기 설정 (고해상도)
        this.canvas.width = displayWidth * dpr;
        this.canvas.height = displayHeight * dpr;
        
        // CSS 크기는 디스플레이 크기로 설정
        this.canvas.style.width = displayWidth + 'px';
        this.canvas.style.height = displayHeight + 'px';
        
        // 컨텍스트 스케일 조정
        this.ctx.scale(dpr, dpr);
        
        // 논리적 크기 저장
        this.width = displayWidth;
        this.height = displayHeight;
        // 리사이즈 시 포인트 위치 조정
        if (this.points.length > 0) {
            for (let i = 0; i < this.points.length; i++) {
                this.points[i][0] = Math.min(this.width, this.points[i][0]);
                this.points[i][1] = Math.min(this.height, this.points[i][1]);
                this.targetPoints[i][0] = Math.min(this.width, this.targetPoints[i][0]);
                this.targetPoints[i][1] = Math.min(this.height, this.targetPoints[i][1]);
            }
        }
        // Grid 위치 재계산
        this.calculateGridPositions();
    }
    
    init() {
        // 랜덤 포인트 생성
        this.points = [];
        this.targetPoints = [];
        this.velocities = [];
        this.colors = [];
        this.cellAreas = [];
        
        for (let i = 0; i < this.numPoints; i++) {
            const x = Math.random() * this.width;
            const y = Math.random() * this.height;
            
            this.points.push([x, y]);
            this.targetPoints.push([x, y]);
            
            // 각 포인트마다 다른 속도 (0.01 ~ 0.04)
            this.speeds.push(0.01 + Math.random() * 0.03);
        }
        
        // 초기 목표 위치 설정
        this.setNewTargets();
        
        // Grid 위치 계산
        this.calculateGridPositions();
        
        // Noise 오프셋 초기화
        this.noiseOffset = 0;
        
        // 애니메이션 시작 시간 설정
        this.stateStartTime = Date.now();
        // 초기 모드에 맞는 텍스트 설정
        this.currentModeText = 'creative';
        this.textRevealProgress = 0;
    }
    
    // 컨트롤 설정
    setupControls() {
        // Cell 개수 슬라이더
        const cellCountSlider = document.getElementById('cellCount');
        const cellCountValue = document.getElementById('cellCountValue');
        
        cellCountSlider.addEventListener('input', (e) => {
            const newValue = parseInt(e.target.value);
            cellCountValue.textContent = newValue;
            this.numPoints = newValue;
            // 포인트 개수가 변경되면 재초기화
            this.init();
        });
        
        // Cell Color Toggle
        const cellColorToggle = document.getElementById('cellColorToggle');
        const colorPickerContainer = document.getElementById('colorPickerContainer');
        const cellColorPicker = document.getElementById('cellColorPicker');
        
        cellColorToggle.addEventListener('change', (e) => {
            this.cellColorEnabled = e.target.checked;
            colorPickerContainer.style.display = e.target.checked ? 'block' : 'none';
        });
        
        cellColorPicker.addEventListener('input', (e) => {
            this.cellColor = e.target.value;
        });
        
        // Stroke Visible Toggle
        const strokeVisibleToggle = document.getElementById('strokeVisibleToggle');
        const strokeColorPickerContainer = document.getElementById('strokeColorPickerContainer');
        const strokeColorPicker = document.getElementById('strokeColorPicker');
        
        strokeVisibleToggle.addEventListener('change', (e) => {
            this.strokeVisible = e.target.checked;
            strokeColorPickerContainer.style.display = e.target.checked ? 'block' : 'none';
        });
        
        strokeColorPicker.addEventListener('input', (e) => {
            this.strokeColor = e.target.value;
        });
        
        // Dot Size 슬라이더
        const dotSizeSlider = document.getElementById('dotSize');
        const dotSizeValue = document.getElementById('dotSizeValue');
        
        dotSizeSlider.addEventListener('input', (e) => {
            const newValue = parseFloat(e.target.value);
            dotSizeValue.textContent = newValue.toFixed(1);
            this.baseDotSize = newValue;
        });
        
        // Text Size 슬라이더
        const textSizeSlider = document.getElementById('textSize');
        const textSizeValue = document.getElementById('textSizeValue');
        
        textSizeSlider.addEventListener('input', (e) => {
            const newValue = parseInt(e.target.value);
            textSizeValue.textContent = newValue;
            this.baseTextSize = newValue;
        });
        
        // v3 전용 Dot Size 슬라이더
        const v3DotSizeSlider = document.getElementById('v3DotSize');
        const v3DotSizeValue = document.getElementById('v3DotSizeValue');
        
        if (v3DotSizeSlider && v3DotSizeValue) {
            v3DotSizeSlider.addEventListener('input', (e) => {
                const newValue = parseFloat(e.target.value);
                v3DotSizeValue.textContent = newValue.toFixed(1);
                if (typeof v3PARAMS !== 'undefined' && v3PARAMS) {
                    v3PARAMS.DotSize = newValue;
                }
            });
        }
        
        // v3 전용 Text Size 슬라이더
        const v3TextSizeSlider = document.getElementById('v3TextSize');
        const v3TextSizeValue = document.getElementById('v3TextSizeValue');
        
        if (v3TextSizeSlider && v3TextSizeValue) {
            v3TextSizeSlider.addEventListener('input', (e) => {
                const newValue = parseInt(e.target.value);
                v3TextSizeValue.textContent = newValue;
                if (typeof v3PARAMS !== 'undefined' && v3PARAMS) {
                    v3PARAMS.TextSize = newValue;
                }
            });
        }
        
        // Version 버튼 설정
        this.setupVersionButtons();
        
        // 초기 v1 설정 저장 (v1이 없을 때만 현재 기본값으로 저장)
        if (!this.versions.v1) {
            this.saveVersion('v1');
            this.updateActiveButton('v1');
        }
    }
    
    // localStorage에서 버전 로드
    loadVersionsFromStorage() {
        try {
            const v1Saved = localStorage.getItem('voronoi_v1');
            if (v1Saved) {
                this.versions.v1 = JSON.parse(v1Saved);
            }
            
            const v2Saved = localStorage.getItem('voronoi_v2');
            if (v2Saved) {
                this.versions.v2 = JSON.parse(v2Saved);
            }
        } catch (e) {
            console.warn('localStorage에서 버전 로드 실패:', e);
        }
    }
    
    // 버전 버튼 설정
    setupVersionButtons() {
        const v1Button = document.getElementById('v1Button');
        const v2Button = document.getElementById('v2Button');
        const v3Button = document.getElementById('v3Button');
        
        // v1 버튼: 저장된 설정 로드
        v1Button.addEventListener('click', () => {
            this.switchToVersion('v1');
        });
        
        // v2 버튼: 저장된 설정 로드 또는 현재 설정을 v2로 저장
        v2Button.addEventListener('click', () => {
            this.switchToVersion('v2');
        });
        
        // v3 버튼: p5.js shader 기반 Voronoi
        if (v3Button) {
            v3Button.addEventListener('click', () => {
                this.switchToVersion('v3');
            });
        }
        
        // 초기 활성 버튼 설정 (v1이 저장되어 있으면 v1 활성화)
        if (this.versions.v1) {
            this.updateActiveButton('v1');
        }
    }
    
    // 버전 전환
    switchToVersion(version) {
        if (version === 'v3') {
            // v3로 전환: p5.js 사용
            this.switchToV3();
        } else {
            // v1 또는 v2로 전환: 기존 canvas 사용
            this.switchFromV3();
            
            if (this.versions[version]) {
                this.loadVersion(version);
            } else {
                // 버전이 없으면 현재 설정을 해당 버전으로 저장 후 로드
                this.saveVersion(version);
            }
            this.updateActiveButton(version);
        }
    }
    
    // v3로 전환
    switchToV3() {
        console.log('Switching to v3...');
        
        // 기존 canvas 숨기기
        if (this.canvas) {
            this.canvas.style.display = 'none';
        }
        
        // 기존 컨트롤 숨기기 (v3 전용 컨트롤 제외)
        const controlGroups = document.querySelectorAll('#controlPanel > .control-group');
        controlGroups.forEach(group => {
            const isV3Control = group.id === 'v3DotSizeGroup' || group.id === 'v3TextSizeGroup';
            if (!isV3Control) {
                group.style.display = 'none';
            } else {
                group.style.display = 'block'; // v3 전용 컨트롤은 표시
            }
        });
        
        // Tweakpane이 아직 생성되지 않았으면 먼저 생성 시도
        if (typeof setupV3Controls === 'function' && typeof Tweakpane !== 'undefined') {
            // v3PARAMS가 없으면 기본값으로 초기화
            if (typeof v3PARAMS === 'undefined' || v3PARAMS === null) {
                window.v3PARAMS = {
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
            }
            setupV3Controls();
        }
        
        // p5.js 초기화 (아직 초기화되지 않았으면)
        if (!window.v3P5Instance && typeof p5 !== 'undefined' && typeof v3Sketch !== 'undefined') {
            try {
                window.v3P5Instance = new p5(v3Sketch);
                console.log('v3 p5.js instance created');
            } catch (error) {
                console.error('Error creating p5.js instance:', error);
            }
        } else if (!window.v3P5Instance) {
            console.error('p5.js or v3Sketch not available');
        }
        
        // 컨트롤 표시 (약간의 지연 후)
        setTimeout(() => {
            if (typeof showV3Controls === 'function') {
                showV3Controls();
            }
        }, 200);
        
        this.currentVersion = 'v3';
        this.updateActiveButton('v3');
    }
    
    // v3에서 다른 버전으로 전환
    switchFromV3() {
        // p5.js 제거
        if (window.v3P5Instance) {
            window.v3P5Instance.remove();
            window.v3P5Instance = null;
        }
        
        // Tweakpane 제거
        if (typeof v3Pane !== 'undefined' && v3Pane) {
            v3Pane.dispose();
            v3Pane = null;
        }
        
        // 기존 canvas 보이기
        if (this.canvas) {
            this.canvas.style.display = 'block';
        }
        
        // 기존 컨트롤 보이기 (v3 전용 컨트롤 숨기기)
        const controlGroups = document.querySelectorAll('#controlPanel > .control-group');
        controlGroups.forEach(group => {
            const isV3Control = group.id === 'v3DotSizeGroup' || group.id === 'v3TextSizeGroup';
            if (isV3Control) {
                group.style.display = 'none';
            } else {
                group.style.display = 'block';
            }
        });
        
        // v3 컨트롤 숨기기
        if (typeof hideV3Controls === 'function') {
            hideV3Controls();
        }
    }
    
    // 현재 설정을 버전으로 저장
    saveVersion(version) {
        this.versions[version] = {
            numPoints: this.numPoints,
            cellColorEnabled: this.cellColorEnabled,
            cellColor: this.cellColor,
            strokeVisible: this.strokeVisible,
            strokeColor: this.strokeColor,
            baseDotSize: this.baseDotSize,
            baseTextSize: this.baseTextSize
        };
        
        // localStorage에도 저장 (페이지 새로고침 후에도 유지)
        try {
            localStorage.setItem(`voronoi_${version}`, JSON.stringify(this.versions[version]));
        } catch (e) {
            console.warn('localStorage 저장 실패:', e);
        }
        
        console.log(`${version} 버전이 저장되었습니다.`, this.versions[version]);
    }
    
    // 버전 설정 로드
    loadVersion(version) {
        if (!this.versions[version]) {
            // localStorage에서 시도
            try {
                const saved = localStorage.getItem(`voronoi_${version}`);
                if (saved) {
                    this.versions[version] = JSON.parse(saved);
                } else {
                    console.warn(`${version} 버전이 없습니다.`);
                    return;
                }
            } catch (e) {
                console.warn('localStorage 로드 실패:', e);
                return;
            }
        }
        
        const config = this.versions[version];
        
        // 설정 적용
        this.numPoints = config.numPoints;
        this.cellColorEnabled = config.cellColorEnabled;
        this.cellColor = config.cellColor;
        this.strokeVisible = config.strokeVisible;
        this.strokeColor = config.strokeColor;
        this.baseDotSize = config.baseDotSize;
        this.baseTextSize = config.baseTextSize;
        
        // UI 업데이트
        this.updateUIFromConfig(config);
        
        // 포인트 재초기화 (numPoints가 변경되었을 수 있음)
        this.init();
        
        this.currentVersion = version;
        console.log(`${version} 버전이 로드되었습니다.`, config);
    }
    
    // UI를 설정값에 맞게 업데이트
    updateUIFromConfig(config) {
        // Cell 개수
        const cellCountSlider = document.getElementById('cellCount');
        const cellCountValue = document.getElementById('cellCountValue');
        if (cellCountSlider && cellCountValue) {
            cellCountSlider.value = config.numPoints;
            cellCountValue.textContent = config.numPoints;
        }
        
        // Cell Color
        const cellColorToggle = document.getElementById('cellColorToggle');
        const colorPickerContainer = document.getElementById('colorPickerContainer');
        const cellColorPicker = document.getElementById('cellColorPicker');
        if (cellColorToggle && colorPickerContainer && cellColorPicker) {
            cellColorToggle.checked = config.cellColorEnabled;
            colorPickerContainer.style.display = config.cellColorEnabled ? 'block' : 'none';
            cellColorPicker.value = config.cellColor;
        }
        
        // Stroke Visible
        const strokeVisibleToggle = document.getElementById('strokeVisibleToggle');
        const strokeColorPickerContainer = document.getElementById('strokeColorPickerContainer');
        const strokeColorPicker = document.getElementById('strokeColorPicker');
        if (strokeVisibleToggle && strokeColorPickerContainer && strokeColorPicker) {
            strokeVisibleToggle.checked = config.strokeVisible;
            strokeColorPickerContainer.style.display = config.strokeVisible ? 'block' : 'none';
            strokeColorPicker.value = config.strokeColor;
        }
        
        // Dot Size
        const dotSizeSlider = document.getElementById('dotSize');
        const dotSizeValue = document.getElementById('dotSizeValue');
        if (dotSizeSlider && dotSizeValue) {
            dotSizeSlider.value = config.baseDotSize;
            dotSizeValue.textContent = config.baseDotSize.toFixed(1);
        }
        
        // Text Size
        const textSizeSlider = document.getElementById('textSize');
        const textSizeValue = document.getElementById('textSizeValue');
        if (textSizeSlider && textSizeValue) {
            textSizeSlider.value = config.baseTextSize;
            textSizeValue.textContent = config.baseTextSize;
        }
    }
    
    // 활성 버튼 업데이트
    updateActiveButton(version) {
        const v1Button = document.getElementById('v1Button');
        const v2Button = document.getElementById('v2Button');
        const v3Button = document.getElementById('v3Button');
        
        // 모든 버튼에서 active 클래스 제거
        if (v1Button) v1Button.classList.remove('active');
        if (v2Button) v2Button.classList.remove('active');
        if (v3Button) v3Button.classList.remove('active');
        
        // 선택된 버튼에 active 클래스 추가
        if (version === 'v1' && v1Button) {
            v1Button.classList.add('active');
        } else if (version === 'v2' && v2Button) {
            v2Button.classList.add('active');
        } else if (version === 'v3' && v3Button) {
            v3Button.classList.add('active');
        }
    }
    
    // 텍스트 시퀀스 업데이트 (모드 기반)
    updateTextSequence() {
        const currentTime = Date.now();
        const elapsed = currentTime - this.stateStartTime; // 밀리초 단위
        
        // 모드에 따라 텍스트와 duration 설정
        let modeText = '';
        let modeDuration = this.stateDuration; // 밀리초 단위
        
        switch (this.animationState) {
            case 'voronoi':
                modeText = 'creative';
                modeDuration = this.stateDuration;
                break;
            case 'gridDeform':
                modeText = 'intelligence';
                modeDuration = this.stateDuration;
                break;
            case 'gridDynamic':
                modeText = 'design';
                modeDuration = this.gridDynamicDuration;
                break;
            default:
                // 전환 모드에서는 이전 모드의 텍스트 유지
                modeText = this.currentModeText || 'ccid';
                modeDuration = this.stateDuration;
                break;
        }
        
        // 모드가 변경되면 텍스트 초기화
        if (this.currentModeText !== modeText) {
            this.currentModeText = modeText;
            this.textRevealProgress = 0;
            this.lastLogTime = null; // 로그 시간도 리셋
        }
        
        // 텍스트가 점진적으로 나타나는 진행도 계산
        // elapsed와 modeDuration 모두 밀리초 단위이므로 정상적으로 계산됨
        const progress = Math.min(1, Math.max(0, elapsed / modeDuration));
        
        // 텍스트가 나타나는 속도를 빠르게 (전체 duration의 50% 동안 완성)
        // 완성 후에는 1.0으로 유지하여 다음 모드 전환까지 텍스트 유지
        const textRevealSpeed = 2.0; // 2배 속도로 나타남
        const textRevealDuration = 0.5; // 전체 duration의 50% 동안 완성
        const textProgress = Math.min(1, progress / textRevealDuration);
        this.textRevealProgress = Math.min(1, textProgress * textRevealSpeed);
        
        // 디버깅: 진행도가 증가하는지 확인 (매 0.1초마다 로그 출력)
        if (this.currentModeText && this.currentModeText.length > 1) {
            const currentText = this.getCurrentText();
            // 매 0.1초마다 로그 출력 (더 자주 확인)
            const logInterval = 100; // 밀리초 단위 (0.1초)
            const currentLogTime = Math.floor(elapsed / logInterval);
            if (!this.lastLogTime || currentLogTime !== this.lastLogTime) {
                this.lastLogTime = currentLogTime;
                const targetLength = this.currentModeText.length;
                const calculatedLength = Math.ceil(1 + (targetLength - 1) * this.textRevealProgress);
                console.log('Text reveal:', {
                    mode: this.animationState,
                    modeText: this.currentModeText,
                    progress: progress.toFixed(3),
                    revealProgress: this.textRevealProgress.toFixed(3),
                    currentText: currentText,
                    textLength: currentText.length,
                    fullLength: targetLength,
                    elapsed: (elapsed / 1000).toFixed(2) + 's',
                    modeDuration: (modeDuration / 1000).toFixed(2) + 's',
                    calculatedLength: calculatedLength
                });
            }
        }
    }
    
    // 현재 표시할 텍스트 가져오기
    getCurrentText() {
        // v2일 때는 항상 'cciD' 반환
        if (this.currentVersion === 'v2') {
            return 'cciD';
        }
        
        if (!this.currentModeText) {
            return 'ccid'; // 기본값
        }
        
        // 긴 텍스트일 때 점진적으로 나타나도록
        if (this.currentModeText.length > 1) {
            // 진행도에 따라 점진적으로 나타나도록
            // textRevealProgress가 0일 때는 1글자, 1일 때는 전체 글자
            const targetLength = this.currentModeText.length;
            
            if (this.textRevealProgress <= 0) {
                return this.currentModeText.substring(0, 1); // 최소 1글자
            } else if (this.textRevealProgress >= 1) {
                return this.currentModeText; // 전체 글자
            } else {
                // 0과 1 사이: 점진적으로 증가
                // textRevealProgress가 매우 작을 때는 1글자 유지
                // 첫 글자가 나타나기 위한 최소 progress 계산
                const minProgressForSecondChar = 1 / (targetLength - 1); // 두 번째 글자가 나타나기 위한 최소 progress
                
                if (this.textRevealProgress < minProgressForSecondChar) {
                    return this.currentModeText.substring(0, 1); // 첫 글자만
                } else if (this.textRevealProgress >= 0.99) {
                    // 거의 완료되었을 때는 전체 글자 표시
                    return this.currentModeText;
                } else {
                    // 두 번째 글자부터 점진적으로 증가
                    // Math.round를 사용하여 더 정확하게 계산
                    const revealLength = Math.min(targetLength, Math.round(1 + (targetLength - 1) * this.textRevealProgress));
                    return this.currentModeText.substring(0, revealLength);
                }
            }
        } else {
            return this.currentModeText;
        }
    }
    
    // 둥근 blob 형태 그리기 함수
    drawBlob(x, y, radius) {
        // superellipse를 사용하여 둥근 blob 형태 만들기
        const n = 2.5; // superellipse 지수 (2보다 크면 더 둥글게)
        const segments = 32; // 원의 세그먼트 수
        
        for (let i = 0; i <= segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            // superellipse 공식 사용
            const cosAngle = Math.cos(angle);
            const sinAngle = Math.sin(angle);
            const signX = cosAngle >= 0 ? 1 : -1;
            const signY = sinAngle >= 0 ? 1 : -1;
            
            const rx = Math.pow(Math.abs(cosAngle), 2 / n) * signX;
            const ry = Math.pow(Math.abs(sinAngle), 2 / n) * signY;
            
            const px = x + rx * radius;
            const py = y + ry * radius;
            
            if (i === 0) {
                this.ctx.moveTo(px, py);
            } else {
                this.ctx.lineTo(px, py);
            }
        }
    }
    
    // Ease in-out 함수
    easeInOut(t) {
        return t < 0.5 
            ? 2 * t * t 
            : -1 + (4 - 2 * t) * t;
    }
    
    // Ease in 함수
    easeIn(t) {
        return t * t;
    }
    
    // Ease out 함수
    easeOut(t) {
        return t * (2 - t);
    }
    
    // 간단한 Perlin noise 함수 (2D)
    // 간단한 해시 함수
    hash(n) {
        n = (n << 13) ^ n;
        return ((n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff) / 2147483648.0;
    }
    
    // 간단한 2D noise (Perlin noise의 간단한 버전)
    noise2D(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        
        x -= Math.floor(x);
        y -= Math.floor(y);
        
        const u = x * x * (3 - 2 * x);
        const v = y * y * (3 - 2 * y);
        
        const a = this.hash(X + this.hash(Y));
        const b = this.hash(X + 1 + this.hash(Y));
        const c = this.hash(X + this.hash(Y + 1));
        const d = this.hash(X + 1 + this.hash(Y + 1));
        
        return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    
    // 해바라기 씨 배열 (피보나치 나선) 위치 계산
    calculateGridPositions() {
        this.gridPositions = [];
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const ellipseWidth = this.height * 0.8;
        const ellipseHeight = this.height * 0.8;
        
        // 황금각 (Golden Angle) - 약 137.508도
        const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // 약 2.39996 라디안 (137.508도)
        
        // 최대 반지름 (ellipse의 작은 반지름 사용)
        const maxRadius = Math.min(ellipseWidth, ellipseHeight) / 2;
        
        for (let i = 0; i < this.numPoints; i++) {
            // 피보나치 나선 패턴
            const angle = i * goldenAngle;
            // 반지름을 점진적으로 증가 (해바라기 씨 패턴)
            const radius = maxRadius * Math.sqrt(i / this.numPoints);
            
            // 원형 좌표를 타원형으로 변환
            const x = centerX + Math.cos(angle) * radius * (ellipseWidth / ellipseHeight);
            const y = centerY + Math.sin(angle) * radius;
            
            // Ellipse 내부인지 확인
            const dx = (x - centerX) / (ellipseWidth / 2);
            const dy = (y - centerY) / (ellipseHeight / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= 1) {
                this.gridPositions.push([x, y]);
            } else {
                // Ellipse 밖이면 가장 가까운 경계점으로
                const boundaryAngle = Math.atan2(dy, dx);
                this.gridPositions.push([
                    centerX + Math.cos(boundaryAngle) * (ellipseWidth / 2),
                    centerY + Math.sin(boundaryAngle) * (ellipseHeight / 2)
                ]);
            }
        }
    }
    
    // 새로운 목표 위치 설정
    setNewTargets() {
        for (let i = 0; i < this.numPoints; i++) {
            // 현재 위치에서 랜덤한 새 목표 위치 설정 (더 큰 거리)
            const angle = Math.random() * Math.PI * 2;
            const distance = 80 + Math.random() * 150; // 80-230px 거리 (더 다이내믹하게)
            
            this.targetPoints[i] = [
                Math.max(0, Math.min(this.width, this.points[i][0] + Math.cos(angle) * distance)),
                Math.max(0, Math.min(this.height, this.points[i][1] + Math.sin(angle) * distance))
            ];
        }
    }
    
    // 두 점 사이의 거리 계산
    distance(p1, p2) {
        return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
    }
    
    // SVG path 문자열로부터 면적 계산
    getPathArea(pathString) {
        if (!pathString) return 0;
        
        // SVG path를 파싱하여 점 배열 추출
        const points = this.parsePath(pathString);
        if (points.length < 3) return 0;
        
        // Shoelace formula로 polygon 면적 계산
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i][0] * points[j][1];
            area -= points[j][0] * points[i][1];
        }
        return Math.abs(area) / 2;
    }
    
    // SVG path 문자열을 점 배열로 파싱
    parsePath(pathString) {
        const points = [];
        const regex = /([ML])\s*([\d.-]+)\s*,?\s*([\d.-]+)/g;
        let match;
        
        while ((match = regex.exec(pathString)) !== null) {
            const x = parseFloat(match[2]);
            const y = parseFloat(match[3]);
            if (!isNaN(x) && !isNaN(y)) {
                points.push([x, y]);
            }
        }
        
        return points;
    }
    
    update() {
        const currentTime = Date.now();
        const elapsed = currentTime - this.stateStartTime;
        // gridDynamic 모드일 때는 별도의 duration 사용
        const duration = this.animationState === 'gridDynamic' ? this.gridDynamicDuration : this.stateDuration;
        const progress = Math.min(1, elapsed / duration);
        
        // 상태 전환 체크
        if (progress >= 1) {
            this.transitionToNextState();
            return;
        }
        
        // 상태에 따른 업데이트
        switch (this.animationState) {
            case 'voronoi':
                this.updateVoronoi();
                break;
            case 'toGrid':
                this.updateToGrid(progress);
                break;
            case 'gridDeform':
                this.updateGridDeform(progress);
                break;
            case 'gridDynamic':
                this.updateGridDynamic(progress);
                break;
            case 'toVoronoi':
                this.updateToVoronoi(progress);
                break;
        }
    }
    
    transitionToNextState() {
        this.stateStartTime = Date.now();
        
        switch (this.animationState) {
            case 'voronoi':
                // Voronoi -> Grid로 이동
                this.animationState = 'toGrid';
                this.originalVoronoiPoints = this.points.map(p => [p[0], p[1]]);
                break;
            case 'toGrid':
                // Grid 도달 -> 변형 시작
                this.animationState = 'gridDeform';
                this.noiseOffset = 0;
                break;
            case 'gridDeform':
                // 변형 완료 -> Grid Dynamic 모드로 전환
                // 현재 위치를 저장하여 smooth 전환을 위해 사용
                this.gridDeformEndPoints = this.points.map(p => [p[0], p[1]]);
                this.animationState = 'gridDynamic';
                this.noiseOffset = 0;
                this.dynamicSizeMultiplier = 1;
                break;
            case 'gridDynamic':
                // Grid Dynamic 완료 -> Voronoi로 복귀
                // 현재 위치를 저장하여 smooth 전환을 위해 사용
                this.gridDynamicEndPoints = this.points.map(p => [p[0], p[1]]);
                this.animationState = 'toVoronoi';
                // Voronoi target 위치 설정
                this.setNewTargets();
                break;
            case 'toVoronoi':
                // Voronoi 복귀 완료 -> 다시 Voronoi 모드
                this.animationState = 'voronoi';
                break;
        }
    }
    
    updateVoronoi() {
        // 텍스트가 나타날 때 dot들이 겹치지 않도록 이동
        const isLongText = this.currentModeText && this.currentModeText.length > 1;
        const isRevealing = isLongText && this.textRevealProgress > 0 && this.textRevealProgress < 1;
        
        // 텍스트가 나타나는 동안 repulsion force 적용
        if (isRevealing) {
            const repulsionStrength = 0.5 * this.textRevealProgress; // 점진적으로 증가 (더 강하게)
            const minDistance = this.baseTextSize * 2.5; // 최소 거리 (더 넓게)
            
            for (let i = 0; i < this.points.length; i++) {
                let fx = 0, fy = 0; // force
                
                for (let j = 0; j < this.points.length; j++) {
                    if (i === j) continue;
                    
                    const dx = this.points[j][0] - this.points[i][0];
                    const dy = this.points[j][1] - this.points[i][1];
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0 && dist < minDistance) {
                        // 너무 가까우면 밀어내기 (ease-in-out 적용)
                        const normalizedDist = dist / minDistance; // 0~1 범위
                        const easedDist = this.easeInOut(1 - normalizedDist); // 거리가 가까울수록 큰 값
                        const force = easedDist;
                        fx -= (dx / dist) * force * repulsionStrength;
                        fy -= (dy / dist) * force * repulsionStrength;
                    }
                }
                
                // force 적용
                this.points[i][0] += fx;
                this.points[i][1] += fy;
                
                // 경계 체크
                this.points[i][0] = Math.max(0, Math.min(this.width, this.points[i][0]));
                this.points[i][1] = Math.max(0, Math.min(this.height, this.points[i][1]));
            }
        }
        
        // 기존 Voronoi 움직임
        const isV2 = this.currentVersion === 'v2';
        const currentTime = Date.now() / 1000;
        
        for (let i = 0; i < this.points.length; i++) {
            const current = this.points[i];
            const target = this.targetPoints[i];
            let speed = this.speeds[i];
            
            // v2일 때 더 빠른 속도와 자유로운 움직임
            if (isV2) {
                speed *= 1.5; // 1.5배 빠른 속도
                
                // Perlin noise를 사용한 추가적인 자유로운 움직임
                const noiseX = this.noise2D(current[0] * 0.01 + currentTime * 0.5, current[1] * 0.01 + currentTime * 0.5);
                const noiseY = this.noise2D(current[0] * 0.01 + currentTime * 0.5 + 100, current[1] * 0.01 + currentTime * 0.5 + 100);
                const noiseStrength = 15; // noise 강도
                
                // noise 기반 추가 움직임
                this.points[i][0] += (noiseX - 0.5) * noiseStrength;
                this.points[i][1] += (noiseY - 0.5) * noiseStrength;
            }
            
            const dx = target[0] - current[0];
            const dy = target[1] - current[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 5) {
                // v2일 때 더 큰 이동 거리
                const maxDistance = isV2 ? 200 : 150;
                const minDistance = isV2 ? 100 : 80;
                const angle = Math.random() * Math.PI * 2;
                const distance = minDistance + Math.random() * (maxDistance - minDistance);
                this.targetPoints[i] = [
                    Math.max(0, Math.min(this.width, current[0] + Math.cos(angle) * distance)),
                    Math.max(0, Math.min(this.height, current[1] + Math.sin(angle) * distance))
                ];
            } else {
                const moveAmount = Math.min(dist, dist * speed);
                const progress = moveAmount / dist;
                const easedProgress = this.easeInOut(progress);
                
                this.points[i][0] += dx * easedProgress;
                this.points[i][1] += dy * easedProgress;
                
                this.points[i][0] = Math.max(0, Math.min(this.width, this.points[i][0]));
                this.points[i][1] = Math.max(0, Math.min(this.height, this.points[i][1]));
            }
        }
    }
    
    updateToGrid(progress) {
        // Ease-in-out으로 Grid 위치로 이동 (부드러운 전환)
        const easedProgress = this.easeInOut(progress);
        
        for (let i = 0; i < this.points.length; i++) {
            if (i < this.gridPositions.length) {
                const start = this.originalVoronoiPoints[i] || this.points[i];
                const end = this.gridPositions[i];
                
                this.points[i][0] = start[0] + (end[0] - start[0]) * easedProgress;
                this.points[i][1] = start[1] + (end[1] - start[1]) * easedProgress;
            }
        }
    }
    
    updateGridDeform(progress) {
        // 텍스트가 나타날 때 dot들이 겹치지 않도록 이동
        const isLongText = this.currentModeText && this.currentModeText.length > 1;
        const isRevealing = isLongText && this.textRevealProgress > 0 && this.textRevealProgress < 1;
        
        // 텍스트가 나타나는 동안 repulsion force 적용
        if (isRevealing) {
            const repulsionStrength = 0.4 * this.textRevealProgress; // 점진적으로 증가 (더 강하게)
            const minDistance = this.baseTextSize * 2.5; // 최소 거리 (더 넓게)
            
            for (let i = 0; i < this.points.length; i++) {
                let fx = 0, fy = 0; // force
                
                for (let j = 0; j < this.points.length; j++) {
                    if (i === j) continue;
                    
                    const dx = this.points[j][0] - this.points[i][0];
                    const dy = this.points[j][1] - this.points[i][1];
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0 && dist < minDistance) {
                        // 너무 가까우면 밀어내기 (ease-in-out 적용)
                        const normalizedDist = dist / minDistance; // 0~1 범위
                        const easedDist = this.easeInOut(1 - normalizedDist); // 거리가 가까울수록 큰 값
                        const force = easedDist;
                        fx -= (dx / dist) * force * repulsionStrength;
                        fy -= (dy / dist) * force * repulsionStrength;
                    }
                }
                
                // force 적용 (gridPositions 기준으로 조정)
                if (i < this.gridPositions.length) {
                    this.gridPositions[i][0] += fx;
                    this.gridPositions[i][1] += fy;
                }
            }
        }
        
        // Grid 상태에서 Perlin noise로 변형 + 시계 방향 회전
        // 전환 시작과 끝에 easing 적용 (진입: ease-out, 진출: ease-in)
        const elapsed = (Date.now() - this.stateStartTime) / 1000;
        this.noiseOffset = elapsed * 0.5; // 시간에 따라 noise 오프셋 증가
        
        const noiseScale = 0.01; // Noise 스케일
        const baseDeformationStrength = 30; // 기본 변형 강도
        const rotationSpeed = 0.3; // 시계 방향 회전 속도 (라디안/초)
        
        // 중심점 계산
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // 전환 시작과 끝에 easing 적용하여 변형 강도 조절
        let deformationStrength;
        if (progress < 0.1) {
            // 시작 부분: ease-out으로 부드럽게 진입
            const startProgress = progress / 0.1;
            deformationStrength = baseDeformationStrength * this.easeOut(startProgress);
        } else if (progress > 0.9) {
            // 끝 부분: ease-in으로 부드럽게 진출
            const endProgress = (progress - 0.9) / 0.1;
            deformationStrength = baseDeformationStrength * (1 - this.easeIn(endProgress));
        } else {
            // 중간 부분: 최대 강도
            deformationStrength = baseDeformationStrength;
        }
        
        // 회전 각도 계산 (시계 방향 = 음수)
        const rotationAngle = -elapsed * rotationSpeed;
        
        for (let i = 0; i < this.points.length; i++) {
            if (i < this.gridPositions.length) {
                const baseX = this.gridPositions[i][0];
                const baseY = this.gridPositions[i][1];
                
                // 중심점으로부터의 거리와 각도 계산
                const dx = baseX - centerX;
                const dy = baseY - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // 시계 방향 회전 적용
                const rotatedAngle = angle + rotationAngle;
                const rotatedX = centerX + Math.cos(rotatedAngle) * distance;
                const rotatedY = centerY + Math.sin(rotatedAngle) * distance;
                
                // Perlin noise로 변형량 계산 (회전된 위치 기준)
                const noiseX = this.noise2D(rotatedX * noiseScale + this.noiseOffset, rotatedY * noiseScale + this.noiseOffset);
                const noiseY = this.noise2D(rotatedX * noiseScale + this.noiseOffset + 100, rotatedY * noiseScale + this.noiseOffset + 100);
                
                // 회전 + 변형 적용
                this.points[i][0] = rotatedX + (noiseX - 0.5) * deformationStrength;
                this.points[i][1] = rotatedY + (noiseY - 0.5) * deformationStrength;
            }
        }
    }
    
    updateGridDynamic(progress) {
        // 텍스트가 나타날 때 dot들이 겹치지 않도록 이동
        const isLongText = this.currentModeText && this.currentModeText.length > 1;
        const isRevealing = isLongText && this.textRevealProgress > 0 && this.textRevealProgress < 1;
        
        // 텍스트가 나타나는 동안 repulsion force 적용
        if (isRevealing) {
            const repulsionStrength = 0.4 * this.textRevealProgress; // 점진적으로 증가 (더 강하게)
            const minDistance = this.baseTextSize * 2.5; // 최소 거리 (더 넓게)
            
            for (let i = 0; i < this.gridPositions.length; i++) {
                let fx = 0, fy = 0; // force
                
                for (let j = 0; j < this.gridPositions.length; j++) {
                    if (i === j) continue;
                    
                    const dx = this.gridPositions[j][0] - this.gridPositions[i][0];
                    const dy = this.gridPositions[j][1] - this.gridPositions[i][1];
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist > 0 && dist < minDistance) {
                        // 너무 가까우면 밀어내기 (ease-in-out 적용)
                        const normalizedDist = dist / minDistance; // 0~1 범위
                        const easedDist = this.easeInOut(1 - normalizedDist); // 거리가 가까울수록 큰 값
                        const force = easedDist;
                        fx -= (dx / dist) * force * repulsionStrength;
                        fy -= (dy / dist) * force * repulsionStrength;
                    }
                }
                
                // force 적용
                this.gridPositions[i][0] += fx;
                this.gridPositions[i][1] += fy;
            }
        }
        
        // Grid Dynamic 모드: 회전 + dot/text 크기 애니메이션
        const elapsed = (Date.now() - this.stateStartTime) / 1000;
        
        const noiseScale = 0.01; // Noise 스케일
        const baseDeformationStrength = 30; // 기본 변형 강도
        
        // 중심점 계산
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // gridDeform에서 gridDynamic으로 전환 시 smooth하게 전환
        // 전환 시작 부분(0~0.2)에서 ease-in-out 적용
        let transitionProgress = 1;
        if (progress < 0.2) {
            // 전환 구간: ease-in-out으로 부드럽게 전환
            transitionProgress = this.easeInOut(progress / 0.2);
        }
        
        // 회전 각도 계산 (시계 방향 = 음수)
        // gridDynamic 모드에서는 전체 시간 동안 한 바퀴(2π) 회전
        // 더 느린 회전 속도로 조절 (4초 동안 한 바퀴)
        const totalRotation = -Math.PI * 2; // 한 바퀴 (시계 방향)
        const rotationAngle = totalRotation * progress;
        
        // 크기 애니메이션: ease-in-out으로 커졌다가 작아지기
        // 전체 시간의 0.3~0.7 구간에서 크기 변화
        let sizeMultiplier = 1;
        if (progress >= 0.3 && progress <= 0.7) {
            // 0.3~0.7 구간에서 크기 변화
            const sizeProgress = (progress - 0.3) / 0.4; // 0~1로 정규화
            // ease-in-out으로 커졌다가 작아지기 (0~0.5: 커지기, 0.5~1: 작아지기)
            if (sizeProgress < 0.5) {
                // 커지기 (0~0.5)
                const growProgress = sizeProgress * 2; // 0~1로 정규화
                const easedGrow = this.easeInOut(growProgress);
                sizeMultiplier = 1 + easedGrow * 0.5; // 1.0 ~ 1.5
            } else {
                // 작아지기 (0.5~1)
                const shrinkProgress = (sizeProgress - 0.5) * 2; // 0~1로 정규화
                const easedShrink = this.easeInOut(shrinkProgress);
                sizeMultiplier = 1.5 - easedShrink * 0.5; // 1.5 ~ 1.0
            }
        }
        this.dynamicSizeMultiplier = sizeMultiplier;
        
        // 변형 강도는 중간에 최대
        let deformationStrength = baseDeformationStrength;
        if (progress < 0.1) {
            const startProgress = progress / 0.1;
            deformationStrength = baseDeformationStrength * this.easeOut(startProgress);
        } else if (progress > 0.9) {
            const endProgress = (progress - 0.9) / 0.1;
            deformationStrength = baseDeformationStrength * (1 - this.easeIn(endProgress));
        }
        
        for (let i = 0; i < this.points.length; i++) {
            if (i < this.gridPositions.length) {
                const baseX = this.gridPositions[i][0];
                const baseY = this.gridPositions[i][1];
                
                // 중심점으로부터의 거리와 각도 계산
                const dx = baseX - centerX;
                const dy = baseY - centerY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);
                
                // 시계 방향 회전 적용
                const rotatedAngle = angle + rotationAngle;
                const rotatedX = centerX + Math.cos(rotatedAngle) * distance;
                const rotatedY = centerY + Math.sin(rotatedAngle) * distance;
                
                // Perlin noise로 변형량 계산 (회전된 위치 기준)
                const noiseX = this.noise2D(rotatedX * noiseScale + elapsed * 0.5, rotatedY * noiseScale + elapsed * 0.5);
                const noiseY = this.noise2D(rotatedX * noiseScale + elapsed * 0.5 + 100, rotatedY * noiseScale + elapsed * 0.5 + 100);
                
                // 최종 위치 계산
                const finalX = rotatedX + (noiseX - 0.5) * deformationStrength;
                const finalY = rotatedY + (noiseY - 0.5) * deformationStrength;
                
                // gridDeform에서 gridDynamic으로 전환 시 smooth하게 전환
                if (progress < 0.2 && this.gridDeformEndPoints.length > 0) {
                    // 전환 구간: gridDeform 종료 위치에서 새로운 위치로 ease-in-out 전환
                    const startX = this.gridDeformEndPoints[i][0];
                    const startY = this.gridDeformEndPoints[i][1];
                    this.points[i][0] = startX + (finalX - startX) * transitionProgress;
                    this.points[i][1] = startY + (finalY - startY) * transitionProgress;
                } else {
                    // 전환 완료 후: 직접 적용
                    this.points[i][0] = finalX;
                    this.points[i][1] = finalY;
                }
            }
        }
    }
    
    updateToVoronoi(progress) {
        // 변형된 Grid에서 Voronoi로 복귀 - Ease-in-out으로 부드러운 전환
        // 전체 구간에서 ease-in-out 적용
        const easedProgress = this.easeInOut(progress);
        
        // gridDynamic에서 전환된 경우, gridDynamic 종료 위치에서 바로 target으로 전환
        if (this.gridDynamicEndPoints.length > 0) {
            // gridDynamic 종료 위치에서 Voronoi target 위치로 부드럽게 전환
            for (let i = 0; i < this.points.length; i++) {
                if (i < this.gridDynamicEndPoints.length && i < this.targetPoints.length) {
                    const start = this.gridDynamicEndPoints[i];
                    const end = this.targetPoints[i];
                    this.points[i][0] = start[0] + (end[0] - start[0]) * easedProgress;
                    this.points[i][1] = start[1] + (end[1] - start[1]) * easedProgress;
                }
            }
        } else {
            // 일반적인 경우: originalVoronoi에서 target으로 전환
            for (let i = 0; i < this.points.length; i++) {
                if (i < this.originalVoronoiPoints.length && i < this.targetPoints.length) {
                    const start = this.originalVoronoiPoints[i];
                    const end = this.targetPoints[i];
                    this.points[i][0] = start[0] + (end[0] - start[0]) * easedProgress;
                    this.points[i][1] = start[1] + (end[1] - start[1]) * easedProgress;
                }
            }
        }
    }
    
    draw() {
        try {
            // 고품질 렌더링 설정
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
            
            // 시간에 따라 크기 noise 오프셋 업데이트 (부드러운 변화를 위해)
            const currentTime = Date.now() / 1000;
            this.sizeNoiseOffset = currentTime * 0.2; // 느린 속도로 변화
            
            // 텍스트 시퀀스 업데이트
            this.updateTextSequence();
            
            // 캔버스 클리어 (v2일 때는 #794CD4, 그 외는 #ffffff)
            this.ctx.fillStyle = this.currentVersion === 'v2' ? '#794CD4' : '#ffffff';
            this.ctx.fillRect(0, 0, this.width, this.height);
            
            // Ellipse 영역 설정 (화면 중앙에 위치)
            const centerX = this.width / 2;
            const centerY = this.height / 2;
            const ellipseWidth = this.height * 0.8; // 화면 너비의 80%
            const ellipseHeight = this.height * 0.8; // 화면 높이의 60%
            
            // Delaunay 삼각분할 생성
            if (!this.points || this.points.length === 0) {
                return; // 포인트가 없으면 그리지 않음
            }
            
            if (typeof d3 === 'undefined' || typeof d3.Delaunay === 'undefined') {
                console.error('d3.Delaunay is not available in draw()');
                return;
            }
            
            const delaunay = d3.Delaunay.from(this.points);
            const voronoi = delaunay.voronoi([0, 0, this.width, this.height]);
        
        // Cell 면적 계산 및 저장
        this.cellAreas = [];
        for (let i = 0; i < this.points.length; i++) {
            const cell = voronoi.renderCell(i);
            if (cell) {
                const area = this.getPathArea(cell);
                this.cellAreas[i] = area;
            } else {
                this.cellAreas[i] = 0;
            }
        }
        
        // 평균 면적 계산 (크기 정규화용)
        const totalArea = this.cellAreas.reduce((sum, area) => sum + area, 0);
        const avgArea = totalArea / this.points.length;
        
        // v2일 때 blob 크기 변형을 위한 변수
        const isV2 = this.currentVersion === 'v2';
        const blobSizeNoiseOffset = currentTime * 0.3; // v2일 때 더 빠른 크기 변화
        
        // Voronoi 셀을 둥근 blob 형태로 그리기
        for (let i = 0; i < this.points.length; i++) {
            const cell = voronoi.renderCell(i);
            
            if (cell) {
                const area = this.cellAreas[i] || avgArea;
                const x = this.points[i][0];
                const y = this.points[i][1];
                
                // 면적에 비례한 반지름 계산 (원의 면적 = π * r²)
                let radius = Math.sqrt(area / Math.PI) * 0.85; // 0.85 배율로 약간 작게
                
                // v2일 때 blob 크기를 실시간으로 변형
                if (isV2) {
                    const sizeNoise = this.noise2D(x * 0.02 + blobSizeNoiseOffset, y * 0.02 + blobSizeNoiseOffset);
                    const sizeVariation = 0.7 + (sizeNoise + 1) / 2 * 0.6; // 0.7 ~ 1.3 배율
                    radius *= sizeVariation;
                }
                
                // 커스터마이징된 색상 사용
                this.ctx.fillStyle = this.cellColorEnabled ? this.cellColor : '#ffffff';
                
                // Stroke 설정 (visible일 때만)
                if (this.strokeVisible) {
                    this.ctx.strokeStyle = this.strokeColor;
                    this.ctx.lineWidth = 1.5;
                } else {
                    this.ctx.strokeStyle = 'transparent';
                    this.ctx.lineWidth = 0;
                }
                
                // 둥근 blob 형태로 그리기 (superellipse 사용하여 더 둥글게)
                this.ctx.beginPath();
                this.drawBlob(x, y, radius);
                this.ctx.fill();
                
                // Stroke는 visible일 때만 그리기
                if (this.strokeVisible) {
                    this.ctx.stroke();
                }
            }
        }
        
        // 포인트와 텍스트 그리기 (cell 크기에 반응적)
        this.ctx.fillStyle = '#000000';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        
        // Voronoi 모드일 때 텍스트 겹침 방지를 위한 배열
        const drawnTexts = []; // {x, y, width, height}
        
        // Perlin noise를 사용한 크기 계산을 위한 스케일
        const noiseScale = 0.005; // 작은 값으로 더 부드러운 변화
        
        for (let i = 0; i < this.points.length; i++) {
            let x = this.points[i][0];
            let y = this.points[i][1];
            
            // v2일 때 dot과 text가 blob의 outline에 위치하도록
            if (isV2) {
                const cell = voronoi.renderCell(i);
                if (cell) {
                    // cell의 경계점들을 파싱
                    const boundaryPoints = this.parsePath(cell);
                    if (boundaryPoints.length > 0) {
                        // 중심점에서 가장 먼 경계점 찾기
                        let maxDist = 0;
                        let farthestPoint = [x, y];
                        
                        for (const bp of boundaryPoints) {
                            const dx = bp[0] - x;
                            const dy = bp[1] - y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            if (dist > maxDist) {
                                maxDist = dist;
                                farthestPoint = bp;
                            }
                        }
                        
                        // 가장 먼 경계점에 dot과 text 배치
                        x = farthestPoint[0];
                        y = farthestPoint[1];
                    }
                }
            }
            
            // Perlin noise를 사용해서 크기 계산 (0~1 범위)
            const noiseValue = this.noise2D(x * noiseScale + this.sizeNoiseOffset, y * noiseScale + this.sizeNoiseOffset);
            // noise 값이 -1~1 범위이므로 0~1로 정규화
            const normalizedNoise = (noiseValue + 1) / 2;
            
            // 크기 범위 설정 (v2일 때 더 큰 변형)
            let minSize = isV2 ? 0.5 : 0.6;
            let maxSize = isV2 ? 1.6 : 1.4;
            let sizeFactor = minSize + (maxSize - minSize) * normalizedNoise;
            
            // gridDynamic 모드일 때는 동적 크기 배율 적용
            if (this.animationState === 'gridDynamic') {
                sizeFactor *= this.dynamicSizeMultiplier;
            }
            
            // Dot 크기 - Perlin noise 기반 크기 사용
            const dotRadius = this.baseDotSize * sizeFactor;
            
            // Dot 그리기
            this.ctx.beginPath();
            this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
            this.ctx.fill();
            
            // 텍스트 크기 - Perlin noise 기반 크기 사용
            const fontSize = this.baseTextSize * sizeFactor;
            // 고품질 텍스트 렌더링을 위한 폰트 설정
            this.ctx.font = `${fontSize}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`;
            
            // 텍스트 위치 및 크기 계산
            const textX = x + dotRadius + 3;
            const textY = y;
            const text = this.getCurrentText();
            const textMetrics = this.ctx.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            
            // 텍스트 겹침 체크 및 dot 위치 조정
            let shouldDrawText = true;
            let adjustedX = textX;
            let adjustedY = textY;
            
            if (this.animationState === 'voronoi' || this.animationState === 'gridDeform' || this.animationState === 'gridDynamic') {
                // 긴 텍스트가 나타날 때 dot들이 이동하여 겹치지 않게
                const isLongText = this.currentModeText && this.currentModeText.length > 1;
                const isRevealing = isLongText && this.textRevealProgress > 0 && this.textRevealProgress < 1;
                
                // 기존에 그려진 텍스트들과의 거리 확인
                for (const drawnText of drawnTexts) {
                    const dx = textX - drawnText.x;
                    const dy = textY - drawnText.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // 텍스트 박스 간 최소 거리 (더 넓게 설정)
                    const minDistance = Math.max(textHeight, drawnText.height) * 1.2 + textWidth * 0.3;
                    
                    if (dist < minDistance) {
                        // 겹칠 경우 위치 조정 또는 그리지 않기
                        if (isRevealing) {
                            // 텍스트가 나타나는 동안 부드럽게 이동 (ease-in-out 적용)
                            const angle = Math.atan2(dy, dx);
                            const normalizedDist = dist / minDistance; // 0~1 범위
                            const easedDist = this.easeInOut(1 - normalizedDist); // 거리가 가까울수록 큰 값
                            const pushDistance = (minDistance - dist) * 1.5 * easedDist; // ease-in-out 적용
                            adjustedX += Math.cos(angle) * pushDistance * this.textRevealProgress;
                            adjustedY += Math.sin(angle) * pushDistance * this.textRevealProgress;
                        } else {
                            // 텍스트가 완성된 후에는 겹치면 그리지 않음
                            shouldDrawText = false;
                            break;
                        }
                    }
                }
            }
            
            // 텍스트 그리기 (겹치지 않을 때만)
            if (shouldDrawText && text.length > 0) {
                this.ctx.fillStyle = '#000000';
                this.ctx.fillText(text, adjustedX, adjustedY);
                
                // 그려진 텍스트 정보 저장 (Voronoi 모드일 때만)
                if (this.animationState === 'voronoi') {
                    drawnTexts.push({
                        x: adjustedX,
                        y: adjustedY,
                        width: textWidth,
                        height: textHeight
                    });
                }
            }
        }
        } catch (error) {
            console.error('Error in draw():', error);
            console.error('Stack trace:', error.stack);
        }
    }
    
    animate() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// 페이지 로드 시 시작
window.addEventListener('load', () => {
    try {
        // d3.Delaunay 로드 확인
        if (typeof d3 === 'undefined' || typeof d3.Delaunay === 'undefined') {
            console.error('d3.Delaunay is not loaded! Check CDN connection.');
            document.body.innerHTML = '<div style="padding: 20px; font-family: sans-serif;"><h1>Error</h1><p>d3.Delaunay library failed to load. Please check your internet connection.</p></div>';
            return;
        }
        
        const canvas = document.getElementById('voronoiCanvas');
        if (!canvas) {
            console.error('Canvas element not found!');
            return;
        }
        
        console.log('Initializing VoronoiPattern...');
        new VoronoiPattern('voronoiCanvas');
        console.log('VoronoiPattern initialized successfully');
    } catch (error) {
        console.error('Error initializing VoronoiPattern:', error);
        console.error('Stack trace:', error.stack);
    }
});