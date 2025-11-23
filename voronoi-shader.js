// Voronoi shader code
// ref: https://www.shadertoy.com/view/ldl3W8
// This software is based on Inigo Quilez's work, which is licensed under the MIT License.

const voronoiShader = `
	// This software is based on Inigo Quilez's work, which is licensed under the MIT License.
	// Original Work: https://www.shadertoy.com/view/ldl3W8
	// Original License: MIT License. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
	// See Inigo Quilez's Articles for details: https://iquilezles.org/articles/voronoilines
	//
	// This modification is also licensed under the MIT License.
	//
	// MIT License
	// Copyright © 2023 Zaron
	// Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
	// The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
	// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
	// Feel free to replace the hash function with your own
	float hash1(vec2 uv) {
		return fract(sin(dot(uv, vec2(1234.5678, 567.8901)))*12345.67);
	}

	vec2 hash2(vec2 uv) {
		float x = hash1(uv);
		return vec2(x, hash1(uv+x));
	}

	vec3 hash3(vec2 uv) {
		vec2 xy = hash2(uv);
		return vec3(xy, hash1(uv+xy));
	}

	// Calculate smooth minimum
	float smin(float a, float b, float t) {
		float c = clamp(.5+(a-b)/t, 0., 1.);
		return (1.-c)*(a-.5*t*c)+c*b;
	}

	//	Input:
	//		t: animate
	//		mt: smooth minimum effect scale
	//	Output:
	//		moff: offset from current grid to the grid where the closest point is
	//		mdst: distances
	//		midst: interior distances
	vec4 voronoi(vec2 uv, vec2 t, float mt) {
		#define TAU 6.28318530718
		vec2 fuv = fract(uv);
		vec2 iuv = floor(uv);
		
		vec2 moff, mdir, off, pos, dir;
		float dst, idst;
		
		float mdst = 8.;
		for (int x = -1; x <= 1; x++)
		for (int y = -1; y <= 1; y++) {
			off = vec2(float(x), float(y));
			pos = hash2(iuv+off);
			pos = .5+.49*sin(t+pos*TAU);
			dir = pos+off-fuv;
			dst = dot(dir, dir);
			if (dst < mdst) {
				mdst = dst;
				moff = off;
				mdir = dir;
			}
		}
		
		float midst = 8.;
		for (int x = -2; x <= 2; x++)
		for (int y = -2; y <= 2; y++) {
			off = moff+vec2(float(x), float(y));
			pos = hash2(iuv+off);
			pos = .5+.49*sin(t+pos*TAU);
			dir = pos+off-fuv;
			if (dot(mdir-dir, mdir-dir) > 0.00001) {
				idst = dot(.5*(mdir+dir), normalize(dir-mdir));
				midst = smin(midst, idst, abs(mt));
			}
		}
		
		return vec4(moff, mdst, midst);
	}
`;

const vertShader = `
	#ifdef GL_ES
	precision mediump float;
	#endif
	attribute vec3 aPosition;
	attribute vec2 aTexCoord;
	varying vec2 vTexCoord;
	void main() {
		vTexCoord = aTexCoord;
		vec4 positionVec4 = vec4(aPosition, 1.0);
		positionVec4.xy = positionVec4.xy * 2.0 - 1.0;
		gl_Position = positionVec4;
	}
`;

const fragShader = `
	#ifdef GL_ES
	precision mediump float;
	#endif
	uniform vec2 iResolution;
	uniform sampler2D iCanvas;
	uniform vec2 iMouse;
	uniform float iTime;
	uniform bool Fill;
	uniform bool Distances;
	uniform bool InteriorDistances;
	uniform bool Grayscale;
	uniform bool Colorful;
	uniform vec3 FillColor;
	uniform bool Contour;
	uniform bool Edge;
	uniform vec3 EdgeColor;
	uniform bool Point;
	uniform vec3 PointColor;
	uniform float Speed;
	uniform float Scale;
	uniform float SminValue;

	// Voronoi shader code will be inserted here

	varying vec2 vTexCoord;

	void main() {
		vec2 uv = gl_FragCoord.xy/iResolution.xy;
		vec3 color = vec3(0.);
		// Center the origin and adjust aspect ratio
		vec2 originalUv = uv;
		uv -= .5;
		uv.x *= iResolution.x/iResolution.y;
		
		// 중앙 30개 cell만 표시하기 위한 영역 제한
		// Scale을 곱하기 전의 좌표로 거리 계산
		float centerRadius = 0.35; // 화면 중앙 35% 영역만
		float distFromCenter = length(uv);
		if (distFromCenter > centerRadius) {
			// 중앙 영역 밖은 배경색으로
			gl_FragColor = vec4(1., 1., 1., 1.);
			return;
		}
		
		uv *= Scale;
		vec2 t = vec2(iTime*Speed);
		float mt = SminValue;

		// Voronoi
		vec4 voro = voronoi(uv, t, mt);

		// Mode
		if (Fill)      color += FillColor;
		if (Grayscale) color += hash1(floor(uv)+voro.xy);
		if (Colorful)  color += hash3(floor(uv)+voro.xy);
		if (Distances) color += vec3(voro.z);
		if (InteriorDistances) color += vec3(voro.w);

		// Contour
		if (Contour) {
			vec3 ct = vec3(.5+.5*cos(voro.w*70.));
			color = mix(color, ct, voro.w);
		}
		
		// Edge
		if (Edge)
		color = mix(EdgeColor, color, smoothstep(.03, .06, voro.w));

		// Point
		if (Point)
		color = mix(PointColor, color, smoothstep(.003, .005, voro.z));

		gl_FragColor = vec4(color, 1.);
	}
`;

