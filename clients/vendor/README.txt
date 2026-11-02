lame.min.js is lamejs 1.2.1, a JavaScript port of LAME (https://lame.sourceforge.io), used unmodified as a separate file under the LGPL (see LAME-LICENSE.txt). It encodes MP3s on your device when you export a song at a custom speed.

ffmpeg/ is ffmpeg.wasm 0.12.10 (MIT, https://github.com/ffmpegwasm/ffmpeg.wasm), unmodified. Its 31 MB engine is downloaded from unpkg.com only the first time you import a video format the browser cannot read itself, then the browser keeps it.

demucs/ is demucs-web 1.0.2 (MIT, https://github.com/timcsy/demucs-web), unmodified: Meta's HTDemucs model run in the browser. The model (about 170 MB) and ONNX Runtime Web download from Hugging Face and jsDelivr the first time you split stems on a device, then the browser keeps them.
