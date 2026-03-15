import { computed, onBeforeUnmount, ref, watch, type Ref } from 'vue';
import { formatMillisecondFraction, formatPipClockHead } from '../utils/time-format';

type DocumentPictureInPictureApi = {
  requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
};

type PipVideo = HTMLVideoElement & {
  webkitSupportsPresentationMode?: (mode: string) => boolean;
  webkitSetPresentationMode?: (mode: string) => void;
  webkitPresentationMode?: string;
};

export function usePictureInPictureClock(msRef: Ref<number | null>, pushError: (message: string) => void) {
  const pipActive = ref(false);
  const pipSupported = ref(false);
  const pipModeLabel = computed(() => (docApi.value ? '窗口画中画' : videoPipSupported.value ? '视频画中画' : '不支持'));

  const docApi = ref<DocumentPictureInPictureApi | null>(null);
  const pipClockWindow = ref<Window | null>(null);
  const pipClockTimer = ref<number | null>(null);
  const pipResizeHandler = ref<(() => void) | null>(null);

  const videoPipSupported = ref(false);
  const hiddenVideo = ref<PipVideo | null>(null);
  const hiddenCanvas = ref<HTMLCanvasElement | null>(null);
  const hiddenCtx = ref<CanvasRenderingContext2D | null>(null);
  const canvasTimer = ref<number | null>(null);
  const videoPipListenerBound = ref(false);
  const webkitPresentationModeHandler = ref<((event: Event) => void) | null>(null);

  function setupSupportFlags() {
    docApi.value = getDocumentPictureInPictureApi();
    videoPipSupported.value = 'pictureInPictureEnabled' in document || 'webkitSupportsPresentationMode' in HTMLVideoElement.prototype;
    pipSupported.value = docApi.value !== null || videoPipSupported.value;
  }

  function getDocumentPictureInPictureApi(): DocumentPictureInPictureApi | null {
    const candidate = (window as Window & { documentPictureInPicture?: DocumentPictureInPictureApi }).documentPictureInPicture;
    return candidate ?? null;
  }

  function formatClockHtml(ms: number | null): string {
    return `${formatPipClockHead(ms)}.<span class="pip-ms-accent">${formatMillisecondFraction(ms, 2)}</span>`;
  }

  function stopWindowPipTimer() {
    if (pipClockTimer.value !== null) {
      window.clearInterval(pipClockTimer.value);
      pipClockTimer.value = null;
    }
  }

  function updateWindowPip() {
    const pipWindow = pipClockWindow.value;
    if (!pipWindow || pipWindow.closed) {
      cleanupWindowPip();
      return;
    }

    const clock = pipWindow.document.getElementById('pip-clock');
    if (clock) {
      clock.innerHTML = formatClockHtml(msRef.value);
      pipResizeHandler.value?.();
    }
  }

  function startWindowPipTimer() {
    stopWindowPipTimer();
    pipClockTimer.value = window.setInterval(updateWindowPip, 33);
  }

  function cleanupWindowPip() {
    stopWindowPipTimer();
    if (pipClockWindow.value && pipResizeHandler.value) {
      pipClockWindow.value.removeEventListener('resize', pipResizeHandler.value);
    }
    pipResizeHandler.value = null;
    pipClockWindow.value = null;
  }

  async function openWindowPip() {
    if (!docApi.value) {
      return false;
    }

    const pipWindow = await docApi.value.requestWindow({ width: 360, height: 220 });
    pipClockWindow.value = pipWindow;

    const doc = pipWindow.document;
    doc.body.innerHTML = '';

    const style = doc.createElement('style');
    style.textContent = `
      :root { color-scheme: dark; }
      body { margin:0;display:grid;place-items:center;background:#0a1420;font-family:'Sora','Manrope','Segoe UI Variable','PingFang SC','Noto Sans SC',sans-serif; }
      #pip-clock { font-size:64px;font-weight:900;line-height:1;color:#e8f3ff;letter-spacing:.04em;font-variant-numeric:tabular-nums;text-shadow:0 10px 28px rgba(58,132,255,.35);white-space:nowrap;user-select:none; }
      .pip-ms-accent { color:#ffb6c8; }
    `;
    doc.head.append(style);

    const clock = doc.createElement('div');
    clock.id = 'pip-clock';
    clock.innerHTML = formatClockHtml(msRef.value);
    doc.body.append(clock);

    const applyScale = () => {
      const target = pipWindow.document.getElementById('pip-clock');
      if (!target) {
        return;
      }
      const width = Math.max(1, pipWindow.innerWidth);
      const height = Math.max(1, pipWindow.innerHeight);
      const content = target.textContent ?? '00:00:00';
      const size = Math.floor(Math.min((width - 12) / Math.max(1, content.length * 0.72), (height - 12) * 0.78));
      target.style.fontSize = `${Math.max(18, size)}px`;
    };

    pipResizeHandler.value = applyScale;
    pipWindow.addEventListener('resize', applyScale);
    pipWindow.addEventListener('pagehide', () => {
      cleanupWindowPip();
      pipActive.value = false;
    });

    startWindowPipTimer();
    updateWindowPip();
    applyScale();
    return true;
  }

  function ensureVideoAssets() {
    if (!hiddenCanvas.value) {
      hiddenCanvas.value = document.createElement('canvas');
      hiddenCanvas.value.width = 640;
      hiddenCanvas.value.height = 360;
      hiddenCtx.value = hiddenCanvas.value.getContext('2d');
    }

    if (!hiddenVideo.value) {
      hiddenVideo.value = document.createElement('video') as PipVideo;
      hiddenVideo.value.muted = true;
      hiddenVideo.value.playsInline = true;
      hiddenVideo.value.style.position = 'fixed';
      hiddenVideo.value.style.opacity = '0';
      hiddenVideo.value.style.pointerEvents = 'none';
      hiddenVideo.value.style.width = '1px';
      hiddenVideo.value.style.height = '1px';
      document.body.append(hiddenVideo.value);
    }
  }

  function drawCanvasClock() {
    const canvas = hiddenCanvas.value;
    const ctx = hiddenCtx.value;
    if (!canvas || !ctx) {
      return;
    }

    const w = canvas.width;
    const h = canvas.height;
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#07121f');
    g.addColorStop(1, '#132a46');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = '#e8f3ff';
    ctx.font = 'bold 92px Sora, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${formatPipClockHead(msRef.value)}.${formatMillisecondFraction(msRef.value, 2)}`, w / 2, h / 2);

    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.font = '24px sans-serif';
    ctx.fillText('OpenRealm Time', w / 2, h - 34);
  }

  function startCanvasTimer() {
    stopCanvasTimer();
    drawCanvasClock();
    canvasTimer.value = window.setInterval(drawCanvasClock, 120);
  }

  function stopCanvasTimer() {
    if (canvasTimer.value !== null) {
      window.clearInterval(canvasTimer.value);
      canvasTimer.value = null;
    }
  }

  function onVideoPipClosed() {
    cleanupVideoPip();
    pipActive.value = false;
  }

  function bindVideoPipListeners(video: PipVideo) {
    if (videoPipListenerBound.value) {
      return;
    }

    video.addEventListener('leavepictureinpicture', onVideoPipClosed);
    webkitPresentationModeHandler.value = () => {
      if (video.webkitPresentationMode !== 'picture-in-picture') {
        onVideoPipClosed();
      }
    };
    video.addEventListener('webkitpresentationmodechanged', webkitPresentationModeHandler.value);
    videoPipListenerBound.value = true;
  }

  function unbindVideoPipListeners(video: PipVideo) {
    if (!videoPipListenerBound.value) {
      return;
    }

    video.removeEventListener('leavepictureinpicture', onVideoPipClosed);
    if (webkitPresentationModeHandler.value) {
      video.removeEventListener('webkitpresentationmodechanged', webkitPresentationModeHandler.value);
      webkitPresentationModeHandler.value = null;
    }
    videoPipListenerBound.value = false;
  }

  async function openVideoPip() {
    if (!videoPipSupported.value) {
      return false;
    }

    ensureVideoAssets();
    const canvas = hiddenCanvas.value;
    const video = hiddenVideo.value;
    if (!canvas || !video) {
      return false;
    }

    const stream = canvas.captureStream(30);
    video.srcObject = stream;
    startCanvasTimer();
    bindVideoPipListeners(video);

    await video.play();

    if ('requestPictureInPicture' in video) {
      await video.requestPictureInPicture();
      pipActive.value = true;
      return true;
    }

    if (video.webkitSupportsPresentationMode?.('picture-in-picture')) {
      video.webkitSetPresentationMode?.('picture-in-picture');
      pipActive.value = true;
      return true;
    }

    return false;
  }

  function cleanupVideoPip() {
    stopCanvasTimer();
    if (hiddenVideo.value) {
      const stream = hiddenVideo.value.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      hiddenVideo.value.srcObject = null;
    }
  }

  async function openPipClock() {
    try {
      setupSupportFlags();
      if (docApi.value && (await openWindowPip())) {
        pipActive.value = true;
        return;
      }

      if (await openVideoPip()) {
        return;
      }

      pushError('当前浏览器不支持画中画时钟');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown_error';
      pushError(`开启画中画失败: ${message}`);
      cleanupAll();
    }
  }

  async function closePipClock() {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    }

    if (pipClockWindow.value && !pipClockWindow.value.closed) {
      pipClockWindow.value.close();
    }

    if (hiddenVideo.value?.webkitPresentationMode === 'picture-in-picture') {
      hiddenVideo.value.webkitSetPresentationMode?.('inline');
    }

    cleanupAll();
  }

  function cleanupAll() {
    cleanupWindowPip();
    cleanupVideoPip();
    pipActive.value = false;
  }

  async function togglePipClock() {
    if (pipActive.value) {
      await closePipClock();
      return;
    }

    await openPipClock();
  }

  watch(msRef, () => {
    if (pipActive.value && docApi.value) {
      updateWindowPip();
    }
  });

  onBeforeUnmount(() => {
    cleanupAll();
    if (hiddenVideo.value) {
      unbindVideoPipListeners(hiddenVideo.value);
      hiddenVideo.value.remove();
    }
  });

  setupSupportFlags();

  return {
    pipSupported,
    pipActive,
    pipModeLabel,
    togglePipClock,
    closePipClock,
    setupSupportFlags
  };
}
