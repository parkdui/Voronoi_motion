class VoronoiPattern {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.points = [];
        this.targetPoints = [];
        this.velocities = [];
        this.speeds = []; // 각 포인트의 개별 속도
        this.numPoints = 200; // 더 많은 dot과 text
        this.colors = [];
        this.cellAreas = []; // 각 cell의 면적 저장
        
        // 애니메이션 상태 관리
        this.animationState = 'voronoi'; // 'voronoi', 'toGrid', 'gridRotate', 'toVoronoi'
        this.animationTime = 0;
        this.stateStartTime = 0;
        this.stateDuration = 3000; // 3초
        this.gridPositions = []; // Grid 위치 저장
        this.rotationAngles = []; // 각 dot의 회전 각도
        this.originalVoronoiPoints = []; // Voronoi로 돌아갈 때 사용할 원래 위치
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
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
            
            // 흑백 스타일 - 랜덤 그레이스케일
            const brightness = Math.random() * 30 + 70; // 70-100% 밝기
            this.colors.push(`hsl(0, 0%, ${brightness}%)`);
        }
        
        // 초기 목표 위치 설정
        this.setNewTargets();
        
        // Grid 위치 계산
        this.calculateGridPositions();
        
        // 회전 각도 초기화
        this.rotationAngles = new Array(this.numPoints).fill(0);
        
        // 애니메이션 시작 시간 설정
        this.stateStartTime = Date.now();
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
    
    // Grid 위치 계산
    calculateGridPositions() {
        this.gridPositions = [];
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const ellipseWidth = this.height * 0.8;
        const ellipseHeight = this.height * 0.8;
        
        // Grid 행과 열 계산
        const cols = Math.ceil(Math.sqrt(this.numPoints * (this.width / this.height)));
        const rows = Math.ceil(this.numPoints / cols);
        
        const cellWidth = ellipseWidth / cols;
        const cellHeight = ellipseHeight / rows;
        
        const startX = centerX - ellipseWidth / 2 + cellWidth / 2;
        const startY = centerY - ellipseHeight / 2 + cellHeight / 2;
        
        for (let i = 0; i < this.numPoints; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            
            const x = startX + col * cellWidth;
            const y = startY + row * cellHeight;
            
            // Ellipse 내부인지 확인
            const dx = (x - centerX) / (ellipseWidth / 2);
            const dy = (y - centerY) / (ellipseHeight / 2);
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist <= 1) {
                this.gridPositions.push([x, y]);
            } else {
                // Ellipse 밖이면 가장 가까운 경계점으로
                const angle = Math.atan2(dy, dx);
                this.gridPositions.push([
                    centerX + Math.cos(angle) * (ellipseWidth / 2),
                    centerY + Math.sin(angle) * (ellipseHeight / 2)
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
        const progress = Math.min(1, elapsed / this.stateDuration);
        
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
            case 'gridRotate':
                this.updateGridRotate(progress);
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
                // Grid 도달 -> 회전 시작
                this.animationState = 'gridRotate';
                break;
            case 'gridRotate':
                // 회전 완료 -> Voronoi로 복귀
                this.animationState = 'toVoronoi';
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
        // Ease-in으로 Grid 위치로 이동
        const easedProgress = this.easeIn(progress);
        
        for (let i = 0; i < this.points.length; i++) {
            if (i < this.gridPositions.length) {
                const start = this.originalVoronoiPoints[i] || this.points[i];
                const end = this.gridPositions[i];
                
                this.points[i][0] = start[0] + (end[0] - start[0]) * easedProgress;
                this.points[i][1] = start[1] + (end[1] - start[1]) * easedProgress;
            }
        }
    }
    
    updateGridRotate(progress) {
        // Grid 상태에서 시계 방향 회전
        const rotationSpeed = Math.PI * 2; // 1초에 한 바퀴
        const elapsed = (Date.now() - this.stateStartTime) / 1000;
        
        for (let i = 0; i < this.points.length; i++) {
            if (i < this.gridPositions.length) {
                // Grid 위치 유지
                this.points[i][0] = this.gridPositions[i][0];
                this.points[i][1] = this.gridPositions[i][1];
                
                // 회전 각도 업데이트 (시계 방향)
                this.rotationAngles[i] = elapsed * rotationSpeed;
            }
        }
    }
    
    updateToVoronoi(progress) {
        // Grid에서 Voronoi로 복귀
        const easedProgress = this.easeOut(progress);
        
        for (let i = 0; i < this.points.length; i++) {
            if (i < this.gridPositions.length) {
                const start = this.gridPositions[i];
                const end = this.targetPoints[i];
                
                this.points[i][0] = start[0] + (end[0] - start[0]) * easedProgress;
                this.points[i][1] = start[1] + (end[1] - start[1]) * easedProgress;
            }
        }
        
        // 회전 각도 리셋
        if (progress >= 1) {
            this.rotationAngles = new Array(this.numPoints).fill(0);
        }
    }
    
    draw() {
        // 캔버스 클리어
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.width, this.height);
        
        // Ellipse mask 설정 (화면 중앙에 위치)
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        const ellipseWidth = this.height * 0.8; // 화면 너비의 80%
        const ellipseHeight = this.height * 0.8; // 화면 높이의 60%
        
        // Clipping path로 ellipse mask 적용
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, ellipseWidth / 2, ellipseHeight / 2, 0, 0, Math.PI * 2);
        this.ctx.clip();
        
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
        
        // Voronoi 셀 그리기
        for (let i = 0; i < this.points.length; i++) {
            const cell = voronoi.renderCell(i);
            
            if (cell) {
                this.ctx.beginPath();
                this.ctx.fillStyle = '#ffffff';
                
                // 경로 그리기 (stroke 제거)
                const path = new Path2D(cell);
                this.ctx.fill(path);
                // stroke 제거됨
            }
        }
        
        // 포인트와 텍스트 그리기 (cell 크기에 반응적)
        this.ctx.fillStyle = '#000000';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'middle';
        
        for (let i = 0; i < this.points.length; i++) {
            const x = this.points[i][0];
            const y = this.points[i][1];
            const area = this.cellAreas[i] || avgArea;
            
            // Cell 면적에 비례한 크기 계산 (면적의 제곱근에 비례)
            const sizeFactor = Math.sqrt(area / avgArea);
            const minSize = 0.5;
            const maxSize = 2.0;
            const normalizedSize = Math.max(minSize, Math.min(maxSize, sizeFactor));
            
            // Dot 크기 (cell 크기에 반응)
            const dotRadius = 3 * normalizedSize;
            
            // 회전 상태일 때 회전 적용
            if (this.animationState === 'gridRotate' && this.rotationAngles[i] !== undefined) {
                this.ctx.save();
                this.ctx.translate(x, y);
                this.ctx.rotate(this.rotationAngles[i]);
                
                // Dot 그리기
                this.ctx.beginPath();
                this.ctx.arc(0, 0, dotRadius, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 텍스트 크기
                const fontSize = Math.max(8, Math.min(16, 10 * normalizedSize));
                this.ctx.font = `${fontSize}px sans-serif`;
                
                // 'ccid' 텍스트 그리기 (회전된 좌표계에서)
                this.ctx.fillStyle = '#000000';
                this.ctx.fillText('ccid', dotRadius + 3, 0);
                
                this.ctx.restore();
            } else {
                // 일반 상태 (회전 없음)
                this.ctx.beginPath();
                this.ctx.arc(x, y, dotRadius, 0, Math.PI * 2);
                this.ctx.fill();
                
                // 텍스트 크기 (cell 크기에 반응)
                const fontSize = Math.max(8, Math.min(16, 10 * normalizedSize));
                this.ctx.font = `${fontSize}px sans-serif`;
                
                // 'ccid' 텍스트 그리기
                this.ctx.fillStyle = '#000000';
                this.ctx.fillText('ccid', x + dotRadius + 3, y);
            }
        }
        
        // Clipping path 해제
        this.ctx.restore();
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

