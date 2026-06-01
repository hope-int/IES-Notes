
import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MotionDiv = motion.div;

function ShaderBackdrop() {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return undefined;

        const gl = canvas.getContext('webgl', { alpha: false, antialias: true });
        if (!gl) return undefined;

        const vertexShaderSource = `
            attribute vec2 a_position;

            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
            }
        `;

        const fragmentShaderSource = `
            #define PI 3.14159265359

            precision highp float;
            uniform vec2 resolution;
            uniform float time;

            void main(void) {
                vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
                float t = time * 0.04;
                float lineWidth = 0.0024;
                vec3 color = vec3(0.0);

                for(int j = 0; j < 3; j++) {
                    for(int i = 0; i < 5; i++) {
                        float band = abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
                        color[j] += lineWidth * float(i * i) / max(band, 0.005);
                    }
                }

                float sweep = 0.5 + 0.5 * sin(uv.x * 4.0 + uv.y * 2.0 + time * 0.12);
                float ribbon = smoothstep(0.16, 0.0, abs(sin(uv.x * 2.3 + uv.y * 3.4 + time * 0.08) * 0.28 + uv.y * 0.36));
                float diagonal = pow(1.0 - smoothstep(0.0, 0.22, abs(mod(uv.x + uv.y + time * 0.01, 0.22) - 0.11)), 3.0);
                vec3 aurora = vec3(0.05, 0.28, 0.9) * ribbon * sweep * 0.52;
                vec3 trace = vec3(0.14, 0.78, 1.0) * diagonal * 0.42;
                vec3 tint = vec3(0.06, 0.12, 0.25);
                vec3 glow = vec3(color.r * 1.25, color.g * 1.45, color.b * 1.85);
                float vignette = smoothstep(1.65, 0.25, length(uv));
                gl_FragColor = vec4(tint + glow * vignette + aurora + trace, 1.0);
            }
        `;

        const createShader = (type, source) => {
            const shader = gl.createShader(type);
            gl.shaderSource(shader, source);
            gl.compileShader(shader);
            if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                console.warn('Splash shader compile failed:', gl.getShaderInfoLog(shader));
                gl.deleteShader(shader);
                return null;
            }
            return shader;
        };

        const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
        if (!vertexShader || !fragmentShader) return undefined;

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.warn('Splash shader link failed:', gl.getProgramInfoLog(program));
            gl.deleteProgram(program);
            return undefined;
        }

        const positionBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([
                -1, -1,
                1, -1,
                -1, 1,
                -1, 1,
                1, -1,
                1, 1
            ]),
            gl.STATIC_DRAW
        );

        const positionLocation = gl.getAttribLocation(program, 'a_position');
        const resolutionLocation = gl.getUniformLocation(program, 'resolution');
        const timeLocation = gl.getUniformLocation(program, 'time');

        let animationFrame = 0;
        let startTime = performance.now();

        const resize = () => {
            const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
            const width = Math.max(1, Math.floor(canvas.clientWidth * pixelRatio));
            const height = Math.max(1, Math.floor(canvas.clientHeight * pixelRatio));

            if (canvas.width !== width || canvas.height !== height) {
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
            }
        };

        const render = (now) => {
            resize();

            gl.useProgram(program);
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
            gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
            gl.uniform1f(timeLocation, (now - startTime) * 0.001);
            gl.drawArrays(gl.TRIANGLES, 0, 6);

            animationFrame = requestAnimationFrame(render);
        };

        resize();
        window.addEventListener('resize', resize);
        animationFrame = requestAnimationFrame((now) => {
            startTime = now;
            render(now);
        });

        return () => {
            cancelAnimationFrame(animationFrame);
            window.removeEventListener('resize', resize);
            gl.deleteBuffer(positionBuffer);
            gl.deleteProgram(program);
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
        };
    }, []);

    useEffect(() => {
        document.body.classList.add('splash-active');
        return () => document.body.classList.remove('splash-active');
    }, []);

    return <canvas ref={canvasRef} className="splash-shader-canvas" aria-hidden="true" />;
}

const SplashScreen = ({ onComplete, isAppReady = false }) => {
    const [minTimeElapsed, setMinTimeElapsed] = useState(false);
    const isExiting = minTimeElapsed && isAppReady;

    useEffect(() => {
        const timer = setTimeout(() => setMinTimeElapsed(true), 1900);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (isExiting) {
            // Give the framer exit animation time (1s), then call onComplete.
            const timer = setTimeout(onComplete, 1100);
            return () => clearTimeout(timer);
        }
        return undefined;
    }, [isExiting, onComplete]);

    return (
        <AnimatePresence>
            {!isExiting && (
                <MotionDiv
                    key="splash"
                    className="splash-screen fixed-top w-100 d-flex flex-column align-items-center justify-content-center"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0, scale: 1.05, filter: 'blur(8px)' }}
                    transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
                >
                    <ShaderBackdrop />
                    <div className="splash-energy" aria-hidden="true" />
                    <div className="splash-noise" aria-hidden="true" />
                    <div className="splash-vignette" aria-hidden="true" />

                    <MotionDiv
                        initial={{ scale: 0.96, opacity: 1, y: 8 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        transition={{ duration: 1.15, ease: [0.16, 1, 0.3, 1] }}
                        className="splash-content d-flex flex-column align-items-center justify-content-center"
                    >
                        <div className="splash-logo-shell d-flex justify-content-center align-items-center">
                            <img
                                src="/hope-logo.png"
                                alt="HOPE-Edu-Hub Logo"
                                className="splash-logo"
                            />
                        </div>

                        <div className="splash-title-wrap text-center">
                            <span className="splash-eyebrow">Initializing workspace</span>
                            <h1 className="splash-title mb-2">
                                HOPE<span>-Edu-Hub</span>
                            </h1>
                            <p className="splash-subtitle">
                                Your Academic Superpower
                            </p>
                            <div className="splash-loader" aria-hidden="true">
                                <span />
                            </div>
                        </div>
                    </MotionDiv>
                </MotionDiv>
            )}
        </AnimatePresence>
    );
};

export default SplashScreen;
