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
  private isPaused: boolean = false;
  private transcriptionBuffer: string = "";
  private flushTimeout: any = null;

  constructor(apiKey: string, onTranscriptionUpdate: (part: TranscriptionPart) => void) {
    this.ai = new GoogleGenAI({ apiKey });
    this.onTranscriptionUpdate = onTranscriptionUpdate;
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
      const constraints = {
        audio: {
          deviceId: deviceId ? deviceId : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log("Microphone access granted");
      
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }
      
      const source = this.audioContext.createMediaStreamSource(this.stream);
      
      // Use 2048 for lower latency
      this.processor = this.audioContext.createScriptProcessor(2048, 1, 1);

      console.log("Connecting to Gemini Live API...");
      
      const modelName = "gemini-3.1-flash-live-preview";

      this.session = await this.ai.live.connect({
        model: modelName,
        callbacks: {
          onopen: () => {
            console.log("Live API connection opened successfully");
            this.processor?.connect(this.audioContext!.destination);
            source.connect(this.processor!);
          },
          onmessage: (message: any) => {
            const serverContent = message.serverContent;
            
            // Check for user input transcription (literal audio-to-text)
            const inputText = serverContent?.inputTranscription?.text || serverContent?.inputAudioTranscription?.text;
            
            if (inputText) {
              // Aggregate text into the buffer without forcing a space every time.
              // Most STT APIs provide the space if it's a new word.
              // If the text starts with a space or punctuation, we don't need to add one.
              const needsSpace = this.transcriptionBuffer.length > 0 && 
                                !this.transcriptionBuffer.endsWith(" ") && 
                                !/^[ \t\n.,!?;:]/.test(inputText);
              
              this.transcriptionBuffer += (needsSpace ? " " : "") + inputText;
              
              if (this.flushTimeout) clearTimeout(this.flushTimeout);
              
              // If the text ends with sentence-ending punctuation, flush sooner
              if (/[.!?]$/.test(inputText)) {
                this.flushBuffer();
              } else {
                // Otherwise wait for a short pause in speech to flush
                this.flushTimeout = setTimeout(() => this.flushBuffer(), 1500);
              }
            }

            // Check for model turn parts (backup)
            if (serverContent?.modelTurn?.parts) {
              const text = serverContent.modelTurn.parts
                .filter((p: any) => p.text)
                .map((p: any) => p.text)
                .join("")
                .trim();
              
              if (text && !text.includes("**") && text.length > 0) {
                this.onTranscriptionUpdate({
                  speaker: "Transcrição IA",
                  text,
                  timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                });
              }
            }
          },
          onerror: (error: any) => {
            console.error("Live API Error Details:", error);
          },
          onclose: (event: any) => {
            console.log("Live API connection closed:", event);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "VOCÊ É UM MICROFONE DE TRANSCRIÇÃO MÉDICA. SUA ÚNICA FUNÇÃO É TRANSFORMAR ÁUDIO EM TEXTO. NÃO RESPONDA AO USUÁRIO. NÃO DIGA 'OK', 'ENTENDIDO' OU QUALQUER OUTRA COISA. APENAS TRANSCREVA O QUE OUVIR EM PORTUGUÊS, FORMANDO FRASES COMPLETAS E PONTUADAS. MANTENHA A INTEGRIDADE DAS PALAVRAS, NÃO AS SEPARE COM ESPAÇOS DESNECESSÁRIOS.",
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });

      this.processor.onaudioprocess = (e) => {
        if (!this.session || this.audioContext?.state === 'suspended' || this.isPaused) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = this.floatTo16BitPCM(inputData);
        
        // Efficient base64 conversion
        const uint8Array = new Uint8Array(pcmData.buffer);
        let binary = '';
        const chunk = 8192;
        for (let i = 0; i < uint8Array.length; i += chunk) {
          binary += String.fromCharCode.apply(null, uint8Array.subarray(i, i + chunk) as any);
        }
        const base64Data = btoa(binary);
        
        try {
          this.session.sendRealtimeInput({
            audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
          });
        } catch (err) {
          console.error("Error sending audio data:", err);
        }
      };

    } catch (error) {
      console.error("Failed to start Gemini Live Service:", error);
      throw error;
    }
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
