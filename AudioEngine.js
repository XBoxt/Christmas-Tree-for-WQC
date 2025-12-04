// 这是一个纯 JS 类，用于处理音频合成和分析
export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.analyser = null;
        this.dataArray = null;
        this.isPlaying = false;
    }

    init() {
        if (this.ctx) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 64; // 分析精度
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    }

    playMelody() {
        if (!this.ctx) this.init();
        if (this.ctx.state === 'suspended') this.ctx.resume();
        this.isPlaying = true;

        // "Meow" Jingle Bells 旋律
        const notes = [
            {f:659,d:0.25}, {f:659,d:0.25}, {f:659,d:0.5}, // 3 3 3
            {f:659,d:0.25}, {f:659,d:0.25}, {f:659,d:0.5}, // 3 3 3
            {f:659,d:0.25}, {f:783,d:0.25}, {f:523,d:0.25}, {f:587,d:0.25}, {f:659,d:1.0}, // 3 5 1 2 3
            {f:698,d:0.25}, {f:698,d:0.25}, {f:698,d:0.25}, {f:698,d:0.25}, // 4 4 4 4
            {f:698,d:0.25}, {f:659,d:0.25}, {f:659,d:0.25}, {f:659,d:0.25}, // 4 3 3 3
            {f:783,d:0.25}, {f:783,d:0.25}, {f:698,d:0.25}, {f:587,d:0.25}, {f:523,d:1.0}  // 5 5 4 2 1
        ];

        let time = this.ctx.currentTime;
        notes.forEach((n, i) => {
            // 简单的循环播放，为了演示只放一次，实际可加 Loop 逻辑
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();

            osc.type = i % 2 === 0 ? 'triangle' : 'sawtooth'; // 混合音色
            osc.frequency.value = n.f;

            // 喵喵音效滤波器 (Wah-Wah)
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(200, time);
            filter.frequency.linearRampToValueAtTime(n.f * 4, time + 0.1);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.analyser); // 连接到分析器！
            this.analyser.connect(this.ctx.destination);

            osc.start(time);
            gain.gain.setValueAtTime(0, time);
            gain.gain.linearRampToValueAtTime(0.3, time + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, time + n.d * 0.9);
            osc.stop(time + n.d);
            
            time += n.d * 0.45; // 速度控制
        });
    }

    // 获取当前的低音能量 (0.0 - 1.0)
    getEnergy() {
        if (!this.analyser) return 0;
        this.analyser.getByteFrequencyData(this.dataArray);
        // 取低频部分的平均值
        let sum = 0;
        for(let i=0; i<5; i++) sum += this.dataArray[i];
        return sum / 5 / 255; 
    }
}