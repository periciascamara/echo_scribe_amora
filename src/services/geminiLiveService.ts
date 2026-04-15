import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

export interface TranscriptionPart {
  speaker: string;
  text: string;
  timestamp: string;
}

export class GeminiLiveService {
  private ai: any;
  private session: any;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private stream: MediaStream | null = null;
  private onTranscriptionUpdate: (part: TranscriptionPart) => void;
  private onError?: (error: any) => void;
  private isPaused: boolean = false;
  private transcriptionBuffer: string = "";
  private flushTimeout: any = null;
  private messageCount: number = 0;
  private silentChunks: number = 0;

  constructor(apiKey: string, onTranscriptionUpdate: (part: TranscriptionPart) => void, onError?: (error: any) => void) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onTranscriptionUpdate = onTranscriptionUpdate;
    this.onError = onError;
  }

  private handleMessage(message: any) {
    // Log first few messages for debugging
    if (this.messageCount < 20) {
      console.log("Gemini Live Message keys:", Object.keys(message));
      console.log("Gemini Live Message:", JSON.stringify(message));
      this.messageCount++;
    }
    
    if (message.error) {
      console.error("Gemini Live Message Error:", JSON.stringify(message.error));
      return;
    }
    
    const serverContent = message.serverContent;
    if (!serverContent) return;

    if (this.messageCount < 20) {
      console.log("ServerContent keys:", Object.keys(serverContent));
    }

    const transcription = serverContent.inputTranscription || 
                          serverContent.inputAudioTranscription || 
                          serverContent.input_audio_transcription ||
                          serverContent.transcription ||
                          serverContent.outputTranscription ||
                          serverContent.outputAudioTranscription;
    
    const inputText = transcription?.text;
    if (inputText && transcription?.interim) {
      console.log(">>> INTERIM TRANSCRIPTION:", inputText);
    }
    
    if (inputText && inputText.trim().length > 0) {
      const text = inputText.trim();
      console.log(">>> TRANSCRIPTION:", text);
      const needsSpace = this.transcriptionBuffer.length > 0 && 
                        !this.transcriptionBuffer.endsWith(" ") && 
                        !/^[ \t\n.,!?;:]/.test(inputText);
      
      this.transcriptionBuffer += (needsSpace ? " " : "") + inputText;
      
      if (this.flushTimeout) clearTimeout(this.flushTimeout);
      
      if (/[.!?]$/.test(inputText)) {
        this.flushBuffer();
      } else {
        this.flushTimeout = setTimeout(() => this.flushBuffer(), 1000);
      }
    } else {
      // Catch-all for any text in the message if the standard properties fail
      const anyText = JSON.stringify(message).match(/"text":"([^"]+)"/);
      if (anyText && anyText[1] && !anyText[1].includes("Zephyr")) {
        console.log("Found text via regex fallback:", anyText[1]);
      }
    }

    // 2. Handle Model Response
    if (serverContent.modelTurn?.parts) {
      console.log("Model turn parts:", serverContent.modelTurn.parts.length);
      const modelText = serverContent.modelTurn.parts
        .filter((p: any) => p.text)
        .map((p: any) => p.text)
        .join("")
        .trim();
      
      if (modelText && modelText.length > 0) {
        console.log("Model Text:", modelText);
        this.onTranscriptionUpdate({
          speaker: "IA",
          text: modelText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
      }
    }
  }

  private flushBuffer() {
    const text = this.transcriptionBuffer.trim();
    if (text) {
      this.onTranscriptionUpdate({
        speaker: "Paciente/Médico",
        text: text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      });
      this.transcriptionBuffer = "";
    }
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }
  }

  setPaused(paused: boolean) {
    this.isPaused = paused;
    console.log("GeminiLiveService paused state:", paused);
  }

  public getStream() { return this.stream; }
  public getAudioContext() { return this.audioContext; }

  async start(deviceId?: string) {
    try {
      console.log("Starting audio capture with device:", deviceId || "default");
      console.log("Gemini API Key present:", !!this.ai.apiKey);
      console.log("Live API available:", !!this.ai.live);
      
      const constraints = {
        audio: deviceId ? { deviceId: { exact: deviceId } } : true
      };
      
      try {
        this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        console.error("Microphone access error:", err);
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error("Acesso ao microfone negado. Por favor, verifique as permissões do seu navegador e do sistema operacional.");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          throw new Error("Nenhum microfone encontrado. Verifique se o dispositivo está conectado corretamente.");
        } else {
          throw new Error("Erro ao acessar o microfone: " + (err.message || "Erro desconhecido"));
        }
      }
      
      console.log("Microphone access granted");
      
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      console.log("AudioContext created with state:", this.audioContext.state, "and sampleRate:", this.audioContext.sampleRate);
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

      const models = ["gemini-3.1-flash-live-preview", "gemini-2.0-flash-exp"];
      let lastError: any = null;

      for (const modelName of models) {
        try {
          console.log(`Attempting connection with model: ${modelName}`);
          
          await new Promise<void>((resolve, reject) => {
            const connectionTimeout = setTimeout(() => {
              reject(new Error(`Tempo de conexão esgotado para o modelo ${modelName}`));
            }, 8000);

            const sessionPromise = this.ai.live.connect({
              model: modelName,
              callbacks: {
                onopen: () => {
                  clearTimeout(connectionTimeout);
                  console.log(`Live API connection opened successfully with ${modelName}`);
                  const gain = this.audioContext!.createGain();
                  gain.gain.value = 0;
                  this.processor?.connect(gain);
                  gain.connect(this.audioContext!.destination);
                  source.connect(this.processor!);
                  
                  sessionPromise.then((session: any) => {
                    this.session = session;
                    console.log("Session assigned successfully");
                    resolve();
                  }).catch(reject);
                },
                onmessage: (message: any) => this.handleMessage(message),
                onerror: (error: any) => {
                  clearTimeout(connectionTimeout);
                  console.error(`Live API Error with ${modelName}:`, error);
                  
                  let friendlyError = error?.message || "Erro na conexão com a API Gemini.";
                  if (friendlyError.includes("API_KEY_INVALID") || friendlyError.includes("invalid API key")) {
                    friendlyError = "Chave da API Gemini inválida. Verifique as configurações do ambiente.";
                  } else if (friendlyError.includes("PERMISSION_DENIED")) {
                    friendlyError = "Acesso negado pela API Gemini. Verifique se sua chave tem permissão para usar este modelo.";
                  }
                  
                  reject(new Error(friendlyError));
                },
                onclose: (event: any) => {
                  console.log(`Live API connection closed (${modelName}). Code: ${event.code}, Reason: ${event.reason}`);
                  this.session = null;
                },
              },
                config: {
                  responseModalities: [Modality.AUDIO],
                  systemInstruction: "Você é um assistente de transcrição. Transcreva o áudio do usuário fielmente para português brasileiro.",
                  inputAudioTranscription: {},
                  outputAudioTranscription: {},
                },
            });
          });

          // If we reached here, connection is open
          this.setupAudioProcessing();
          return;
        } catch (err) {
          console.warn(`Failed to connect with ${modelName}:`, err);
          lastError = err;
          if (this.session) {
            try { this.session.close(); } catch(e) {}
            this.session = null;
          }
        }
      }

      throw lastError || new Error("Não foi possível conectar a nenhum modelo da API Gemini.");

    } catch (error) {
      console.error("Failed to start Gemini Live Service:", error);
      throw error;
    }
  }

  private setupAudioProcessing() {
    if (!this.processor) return;
    
    this.processor.onaudioprocess = (e) => {
      if (Math.random() < 0.001) {
        console.log("onaudioprocess firing, context state:", this.audioContext?.state, "session active:", !!this.session);
      }
      if (!this.session || this.audioContext?.state === 'suspended' || this.isPaused) {
        if (Math.random() < 0.001 && !this.session) console.log("onaudioprocess: session is null, skipping send");
        return;
      }
      
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Basic signal detection
      let maxVal = 0;
      for (let i = 0; i < inputData.length; i++) {
        const val = Math.abs(inputData[i]);
        if (val > maxVal) maxVal = val;
      }
      
      if (maxVal < 0.005) {
        this.silentChunks++;
        if (this.silentChunks % 100 === 0) console.log("Audio signal very low/silent (max:", maxVal, ")");
      } else {
        this.silentChunks = 0;
      }

      const pcmData = this.floatTo16BitPCM(inputData);
      
      // Convert PCM to Base64
      let binary = '';
      const bytes = new Uint8Array(pcmData.buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);
      
      try {
        if (Math.random() < 0.01) console.log("Sending audio chunk, size:", base64Data.length, "session state:", this.session?.readyState);
        this.session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      } catch (err) {
        console.error("CRITICAL: Error sending audio data to Gemini:", err);
      }
    };
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  stop() {
    this.flushBuffer();
    this.session?.close();
    this.processor?.disconnect();
    this.audioContext?.close();
    this.stream?.getTracks().forEach(track => track.stop());
  }
}
