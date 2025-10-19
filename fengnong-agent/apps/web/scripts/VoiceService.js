export class VoiceService {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.speechSynthesis = window.speechSynthesis;
        this.initSpeechRecognition();
    }

    // 初始化语音识别
    initSpeechRecognition() {
        // 检查浏览器支持
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.updateVoiceStatus('您的浏览器不支持语音识别，请使用Chrome或Edge浏览器', 'error');
            return false;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        // 配置识别参数
        this.recognition.continuous = false;
        this.recognition.interimResults = false;
        this.recognition.lang = 'zh-CN';
        this.recognition.maxAlternatives = 1;

        return true;
    }

    // 开始语音识别
    startListening(onResult, onError, onStatusUpdate) {
        if (!this.recognition) {
            onError('语音识别未初始化');
            return;
        }

        // 绑定事件处理
        this.recognition.onstart = () => {
            this.isListening = true;
            onStatusUpdate('正在聆听...请说话', 'listening');
        };

        this.recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            onResult(transcript);
            onStatusUpdate(`识别到: "${transcript}"`, 'info');
        };

        this.recognition.onerror = (event) => {
            let errorMessage = '语音识别错误: ';
            
            switch(event.error) {
                case 'not-allowed':
                    errorMessage += '麦克风访问被拒绝，请检查浏览器权限';
                    break;
                case 'no-speech':
                    errorMessage += '没有检测到语音，请重试';
                    break;
                case 'audio-capture':
                    errorMessage += '无法捕获音频，请检查麦克风设备';
                    break;
                default:
                    errorMessage += event.error;
            }
            
            onError(errorMessage);
        };

        this.recognition.onend = () => {
            this.isListening = false;
            onStatusUpdate('点击麦克风按钮开始语音输入', 'info');
        };

        try {
            this.recognition.start();
        } catch (error) {
            onError('无法启动语音识别: ' + error.message);
        }
    }

    // 停止语音识别
    stopListening() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }

    // 语音合成 - 朗读文本
    speakText(text) {
        if (!this.speechSynthesis) {
            console.warn('浏览器不支持语音合成');
            return;
        }

        // 停止当前播放
        this.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-CN';
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        utterance.onerror = (event) => {
            console.error('语音合成错误:', event.error);
        };

        this.speechSynthesis.speak(utterance);
    }
}