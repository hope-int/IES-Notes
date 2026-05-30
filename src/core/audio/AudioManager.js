import { getAudioFromCache, saveAudioToCache } from '../../utils/indexedDB';
import { eventBus } from '../events/EventBus';

class AudioManager {
    constructor() {
        this.currentAudio = null;
        this.isPlaying = false;
        this.synthesis = window.speechSynthesis;
        this.utterance = null;
    }

    // Helper to generate text hash for cache indexing
    async getHash(text) {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-1', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Prefetches audio for the upcoming node to achieve seamless playback
    async prefetchAudio(text) {
        if (!text || text.trim() === "") return;
        try {
            const hash = await this.getHash(text);
            const cached = await getAudioFromCache(hash);
            if (cached) return; // already in cache
            
            // Call Puter AI txt2speech to pre-cache
            if (window.puter && window.puter.ai) {
                const audioObj = await window.puter.ai.txt2speech(text);
                const src = audioObj.src || audioObj;
                if (src) {
                    const resp = await fetch(src);
                    const blob = await resp.blob();
                    
                    // Convert blob to base64
                    const reader = new FileReader();
                    reader.readAsDataURL(blob);
                    reader.onloadend = () => {
                        saveAudioToCache(hash, reader.result).catch(err => 
                            console.warn("Audio cache write failure:", err)
                        );
                    };
                }
            }
        } catch (e) {
            console.warn("Audio prefetch failed", e);
        }
    }

    async playNarration(text, onBoundary) {
        this.stop();
        if (!text || text.trim() === "") {
            // Emits immediate complete if text is empty
            setTimeout(() => {
                eventBus.dispatch({ type: 'AUDIO_PLAYBACK_COMPLETE' });
            }, 500);
            return;
        }

        const hash = await this.getHash(text);
        
        try {
            // 1. Try cache
            const cachedBase64 = await getAudioFromCache(hash);
            if (cachedBase64) {
                await this.playAudioUrl(cachedBase64);
                return;
            }

            // 2. Puter Online Generation
            if (window.puter && window.puter.ai) {
                const audioObj = await window.puter.ai.txt2speech(text);
                const src = audioObj.src || audioObj;
                if (src) {
                    await this.playAudioUrl(src);
                    
                    // Cache asynchronously
                    fetch(src).then(r => r.blob()).then(blob => {
                        const reader = new FileReader();
                        reader.readAsDataURL(blob);
                        reader.onloadend = () => {
                            saveAudioToCache(hash, reader.result).catch(err => {});
                        };
                    }).catch(() => {});
                    return;
                }
            }
        } catch (err) {
            console.warn("Puter audio generation failed, falling back to Web Speech Synthesis", err);
        }

        // 3. Fallback: Web Speech API (completely offline & low bandwidth safe)
        this.playSpeechSynthesis(text, onBoundary);
    }

    playAudioUrl(url) {
        return new Promise((resolve, reject) => {
            this.currentAudio = new Audio(url);
            this.currentAudio.play()
                .then(() => {
                    this.isPlaying = true;
                    this.currentAudio.onended = () => {
                        this.isPlaying = false;
                        eventBus.dispatch({ type: 'AUDIO_PLAYBACK_COMPLETE' });
                        resolve();
                    };
                })
                .catch(err => {
                    console.error("Audio playback error:", err);
                    // Force Web Speech Synthesis as fallback
                    reject(err);
                });
        });
    }

    playSpeechSynthesis(text, onBoundary) {
        if (!this.synthesis) {
            // If browser doesn't support Web Speech, skip audio narration gracefully
            setTimeout(() => eventBus.dispatch({ type: 'AUDIO_PLAYBACK_COMPLETE' }), 1000);
            return;
        }

        this.utterance = new SpeechSynthesisUtterance(text);
        
        // Detect Malayalam tags and adjust voice/accent if present
        const hasMalayalam = /[\u0D00-\u0D7F]/.test(text);
        if (hasMalayalam) {
            this.utterance.lang = 'ml-IN';
        } else {
            this.utterance.lang = 'en-IN'; // Indian English matches local KTU academic vocabulary
        }

        this.utterance.rate = 1.0;
        this.utterance.pitch = 1.0;

        this.utterance.onboundary = (event) => {
            if (event.name === 'word') {
                const charIndex = event.charIndex;
                const remainingText = text.substring(charIndex);
                const word = remainingText.split(/\s+/)[0];
                if (onBoundary) onBoundary(word, charIndex);
            }
        };

        this.utterance.onend = () => {
            this.isPlaying = false;
            eventBus.dispatch({ type: 'AUDIO_PLAYBACK_COMPLETE' });
        };

        this.utterance.onerror = (e) => {
            console.error("Speech Synthesis Error:", e);
            this.isPlaying = false;
            eventBus.dispatch({ type: 'AUDIO_PLAYBACK_COMPLETE' });
        };

        this.isPlaying = true;
        this.synthesis.speak(this.utterance);
    }

    stop() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio = null;
        }
        if (this.synthesis) {
            this.synthesis.cancel();
        }
        this.isPlaying = false;
    }
}

export const audioManager = new AudioManager();
