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
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.setupControls();
        this.init();
        this.animate();
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.width = this.canvas.width;
        this.height = this.canvas.height;
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
        // 기존 Voronoi 움직임
        for (let i = 0; i < this.points.length; i++) {
            const current = this.points[i];
            const target = this.targetPoints[i];
            const speed = this.speeds[i];
            
            const dx = target[0] - current[0];
            const dy = target[1] - current[1];
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 5) {
                const angle = Math.random() * Math.PI * 2;
                const distance = 80 + Math.random() * 150;
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
        // 시간에 따라 크기 noise 오프셋 업데이트 (부드러운 변화를 위해)
        const currentTime = Date.now() / 1000;
        this.sizeNoiseOffset = currentTime * 0.2; // 느린 속도로 변화
        
        // 캔버스 클리어
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Ellipse 영역 설정 (화면 중앙에 위치)
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const ellipseWidth = this.height * 0.8; // 화면 너비의 80%
        const ellipseHeight = this.height * 0.8; // 화면 높이의 60%
        
        // Delaunay 삼각분할 생성
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
        
        // Voronoi 셀을 둥근 blob 형태로 그리기
        for (let i = 0; i < this.points.length; i++) {
            const cell = voronoi.renderCell(i);
            
            if (cell) {
                const area = this.cellAreas[i] || avgArea;
                const x = this.points[i][0];
                const y = this.points[i][1];
                
                // 면적에 비례한 반지름 계산 (원의 면적 = π * r²)
                const radius = Math.sqrt(area / Math.PI) * 0.85; // 0.85 배율로 약간 작게
                
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
            const x = this.points[i][0];
            const y = this.points[i][1];
            
            // Perlin noise를 사용해서 크기 계산 (0~1 범위)
            const noiseValue = this.noise2D(x * noiseScale + this.sizeNoiseOffset, y * noiseScale + this.sizeNoiseOffset);
            // noise 값이 -1~1 범위이므로 0~1로 정규화
            const normalizedNoise = (noiseValue + 1) / 2;
            
            // 크기 범위 설정 (0.6 ~ 1.4 배율로 부드럽게 변화)
            let minSize = 0.6;
            let maxSize = 1.4;
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
            this.ctx.font = `${fontSize}px sans-serif`;
            
            // 텍스트 위치 및 크기 계산
            const textX = x + dotRadius + 3;
            const textY = y;
            const text = 'ccid';
            const textMetrics = this.ctx.measureText(text);
            const textWidth = textMetrics.width;
            const textHeight = fontSize;
            
            // Voronoi 모드일 때만 텍스트 겹침 체크
            let shouldDrawText = true;
            if (this.animationState === 'voronoi') {
                // 기존에 그려진 텍스트들과의 거리 확인
                for (const drawnText of drawnTexts) {
                    const dx = textX - drawnText.x;
                    const dy = textY - drawnText.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    // 텍스트 박스 간 최소 거리 (텍스트 높이의 0.5배)
                    const minDistance = Math.max(textHeight, drawnText.height) * 0.5;
                    
                    if (dist < minDistance) {
                        shouldDrawText = false;
                        break;
                    }
                }
            }
            
            // 텍스트 그리기 (겹치지 않을 때만)
            if (shouldDrawText) {
                this.ctx.fillStyle = '#000000';
                this.ctx.fillText(text, textX, textY);
                
                // 그려진 텍스트 정보 저장 (Voronoi 모드일 때만)
                if (this.animationState === 'voronoi') {
                    drawnTexts.push({
                        x: textX,
                        y: textY,
                        width: textWidth,
                        height: textHeight
                    });
                }
            }
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
    new VoronoiPattern('voronoiCanvas');
});