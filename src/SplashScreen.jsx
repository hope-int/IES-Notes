
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

            // Smooth noise helpers
            float hash(vec2 p) {
                p = fract(p * vec2(127.1, 311.7));
                p += dot(p, p + 19.19);
                return fract(p.x * p.y);
            }

            float smoothNoise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(
                    mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
                    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
                    u.y
                );
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i = 0; i < 5; i++) {
                    v += a * smoothNoise(p);
                    p = p * 2.1 + vec2(1.7, 9.2);
                    a *= 0.48;
                }
                return v;
            }

            void main(void) {
                vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
                float t = time * 0.18;

                // Warped nebula domain
                vec2 q = vec2(fbm(uv + t * 0.11), fbm(uv + vec2(1.3, 0.9)));
                vec2 r = vec2(fbm(uv + 1.7 * q + vec2(1.7, 9.2) + t * 0.07),
                              fbm(uv + 1.7 * q + vec2(8.3, 2.8) + t * 0.06));
                float n = fbm(uv + 1.9 * r);

                // Deep base — near-black indigo
                vec3 base = vec3(0.02, 0.03, 0.10);

                // Flowing aurora bands in indigo → violet → electric-cyan
                float a1 = smoothstep(0.42, 0.78, n);
                float a2 = smoothstep(0.56, 0.84, n + 0.18 * sin(uv.x * 2.2 + t));
                float a3 = smoothstep(0.30, 0.62, n - 0.12 * cos(uv.y * 1.8 + t * 0.8));

                vec3 indigo  = vec3(0.24, 0.10, 0.72);   // deep indigo
                vec3 violet  = vec3(0.56, 0.18, 0.90);   // violet
                vec3 ecyan   = vec3(0.04, 0.82, 1.00);   // electric cyan
                vec3 rose    = vec3(0.72, 0.12, 0.52);   // accent magenta-rose

                vec3 aurora = indigo * a1 * 0.72
                            + violet * a2 * 0.54
                            + ecyan  * a3 * 0.38
                            + rose   * a1 * a2 * 0.22;

                // Luminous soft orbs
                float orb1 = exp(-3.8 * length(uv - vec2(-0.55 + 0.12 * sin(t * 0.5),  0.22 + 0.09 * cos(t * 0.4))));
                float orb2 = exp(-5.2 * length(uv - vec2( 0.60 + 0.10 * cos(t * 0.35), -0.30 + 0.08 * sin(t * 0.6))));
                float orb3 = exp(-4.5 * length(uv - vec2( 0.05 + 0.08 * sin(t * 0.7), -0.65 + 0.06 * cos(t * 0.3))));

                vec3 orbs = violet * orb1 * 0.55
                          + ecyan  * orb2 * 0.40
                          + indigo * orb3 * 0.35;

                // Subtle shimmer veil
                float shimmer = 0.5 + 0.5 * sin(uv.x * 6.0 + uv.y * 4.2 + t * 1.4);
                float veil = smoothstep(0.62, 0.78, n) * shimmer * 0.10;
                vec3 shim = ecyan * veil;

                // Radial vignette — dark at edges
                float vignette = smoothstep(1.72, 0.22, length(uv));

                vec3 final = base + (aurora + orbs + shim) * vignette;

                // Tone-map & slight gamma lift
                final = final / (final + 0.55);
                final = pow(final, vec3(0.88));

                gl_FragColor = vec4(final, 1.0);
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
