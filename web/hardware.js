/* CookieTime serial hardware bridge: desktop Web Serial + Android HC-06 SPP. */
(() => {
  const SPP_SERVICE_ID = '00001101-0000-1000-8000-00805f9b34fb';
  let port = null;
  let writer = null;
  let reader = null;
  let mode = window.NativeMvp?.isHardwareConnected?.() ? 'android' : '';
  let connected = mode === 'android';
  let connecting = false;
  let reading = false;

  const buttonLabel = () => connecting ? '연결 중…' : connected ? '하드웨어 연결 끊기' : '🍪 LCD 타이머 연결';
  const statusLabel = () => connecting ? 'HC-06 연결을 기다리고 있어요.' : connected ? `연결됨 · ${mode === 'android' ? 'HC-06' : '시리얼'}` : 'Uno + HC-06을 연결하면 LCD에 집중 상태가 표시돼요.';

  function mountHardwareControls() {
    const controls = document.querySelector('.focus-controls');
    if (!controls || document.querySelector('#hardware-connect-row')) return;
    const row = document.createElement('div');
    row.id = 'hardware-connect-row';
    row.className = 'hardware-connect-row';
    row.innerHTML = `<button type="button" class="button secondary" id="hardware-connect" ${connecting ? 'disabled' : ''}>${buttonLabel()}</button><small id="hardware-status" aria-live="polite">${statusLabel()}</small>`;
    controls.after(row);
  }

  function refreshHardwareControls() {
    const button = document.querySelector('#hardware-connect');
    const status = document.querySelector('#hardware-status');
    if (button) { button.textContent = buttonLabel(); button.disabled = connecting; }
    if (status) status.textContent = statusLabel();
  }

  function setConnection(isConnected, connectionMode = mode, message = '') {
    connected = isConnected;
    mode = isConnected ? connectionMode : '';
    connecting = !isConnected && message.includes('연결하는 중');
    refreshHardwareControls();
    if (message) showToast(message);
    if (isConnected) syncCurrentFocusState();
  }

  async function sendToHardware(command) {
    if (!connected) return;
    if (mode === 'android') {
      window.NativeMvp?.sendHardwareCommand?.(command);
      return;
    }
    if (!writer) return;
    try {
      await writer.write(`${command}\n`);
    } catch (error) {
      console.warn('Hardware serial write failed:', error);
      setConnection(false);
      showToast('하드웨어에 명령을 보내지 못했어요. 연결 상태를 확인해주세요.');
    }
  }

  function syncCurrentFocusState() {
    if (!connected) return;
    if (!state.focus.active) sendToHardware('READY');
    else if (state.focus.deviation) sendToHardware('PAUSE');
    else sendToHardware(`SYNC:${Math.max(0, Math.floor(state.focus.sessionSeconds || 0))}`);
  }

  async function connectDesktopSerial() {
    if (!('serial' in navigator)) {
      showToast('Android 앱에서는 네이티브 연결을 사용하고, 웹에서는 데스크톱 Chrome을 이용해주세요.');
      return;
    }
    connecting = true;
    refreshHardwareControls();
    try {
      port = await navigator.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP_SERVICE_ID] });
      await port.open({ baudRate: 9600 });

      const encoder = new TextEncoderStream();
      encoder.readable.pipeTo(port.writable).catch(error => {
        if (connected) console.warn('Hardware serial writer closed:', error);
      });
      writer = encoder.writable.getWriter();

      const decoder = new TextDecoderStream();
      port.readable.pipeTo(decoder.writable).catch(error => {
        if (connected) console.warn('Hardware serial reader closed:', error);
      });
      reader = decoder.readable.getReader();
      mode = 'web';
      setConnection(true, 'web');
      reading = true;
      void readDesktopSerial();
      showToast('하드웨어가 연결됐어요. LCD 표시를 확인해보세요.');
    } catch (error) {
      console.warn('Hardware connection cancelled or failed:', error);
      connecting = false;
      refreshHardwareControls();
      if (error?.name !== 'NotFoundError') showToast('연결하지 못했어요. 페어링과 포트를 확인해주세요.');
      await closeDesktopSerial();
    }
  }

  async function readDesktopSerial() {
    let buffer = '';
    try {
      while (reading && reader) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || '';
        for (const line of lines) handleHardwareMessage(line.trim());
        if (buffer.length > 256) buffer = '';
      }
    } catch (error) {
      if (reading) console.warn('Hardware serial disconnected:', error);
    } finally {
      if (reading) {
        reading = false;
        setConnection(false);
        showToast('하드웨어 연결이 끊어졌어요.');
      }
    }
  }

  async function closeDesktopSerial() {
    reading = false;
    try { await reader?.cancel(); } catch { }
    try { await writer?.close(); } catch { }
    try { reader?.releaseLock(); } catch { }
    try { writer?.releaseLock(); } catch { }
    try { await port?.close(); } catch { }
    reader = null;
    writer = null;
    port = null;
  }

  async function toggleHardwareConnection() {
    if (connecting) return;
    if (connected) {
      if (mode === 'android') window.NativeMvp?.disconnectHardware?.();
      else await closeDesktopSerial();
      setConnection(false);
      showToast('하드웨어 연결을 해제했어요.');
      return;
    }
    if (typeof window.NativeMvp?.connectHardware === 'function') {
      mode = 'android';
      connecting = true;
      refreshHardwareControls();
      window.NativeMvp.connectHardware();
    } else {
      await connectDesktopSerial();
    }
  }

  function handleHardwareMessage(message) {
    if (!message) return;
    if (message === 'BTN' || message === 'TOGGLE') {
      if (page !== 'focus') go('focus');
      focusAction(state.focus.active ? 'stop-focus' : 'start-focus');
    } else if (message === 'PAUSE_BTN' && state.focus.active) {
      if (page !== 'focus') go('focus');
      focusAction('deviation');
    } else if (message === 'READY' || message === 'OK') {
      // The LCD sketch may send a simple acknowledgement; app state remains authoritative.
    } else {
      console.info('Hardware message:', message);
    }
  }

  window.onHardwareMessage = handleHardwareMessage;
  window.onHardwareStatus = (isConnected, name, message) => {
    setConnection(!!isConnected, 'android', message || '');
    if (isConnected && name) {
      const status = document.querySelector('#hardware-status');
      if (status) status.textContent = `연결됨 · ${name}`;
    }
  };

  const originalRender = render;
  render = function () {
    originalRender();
    if (page === 'focus') mountHardwareControls();
  };

  const originalFocusAction = focusAction;
  focusAction = function (action) {
    originalFocusAction(action);
    if (action === 'start-focus') sendToHardware(`SYNC:${Math.max(0, Math.floor(state.focus.sessionSeconds || 0))}`);
    else if (action === 'deviation') sendToHardware(state.focus.deviation ? 'PAUSE' : `SYNC:${Math.max(0, Math.floor(state.focus.sessionSeconds || 0))}`);
    else if (action === 'stop-focus') sendToHardware('STOP');
  };

  document.addEventListener('click', event => {
    if (event.target.closest('#hardware-connect')) void toggleHardwareConnection();
  });

  setInterval(() => {
    if (connected && state.focus.active && !state.focus.deviation) {
      sendToHardware(`SYNC:${Math.max(0, Math.floor(state.focus.sessionSeconds || 0))}`);
    }
  }, 1000);
})();
